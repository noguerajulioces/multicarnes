# End-to-end test suite

Playwright-driven tests that launch the packaged Electron build against a
throw-away `userData` directory and exercise the renderer through real IPC.

## How to run

```bash
# 1. Build the app (electron-vite produces out/main/index.js).
npm run build

# 2. Run all e2e specs against the packaged build.
npx playwright test

# 3. (optional) Open the HTML report on failure.
npx playwright show-report
```

If `npx playwright test` is the first run on this machine, install the
browser binaries Playwright needs (most Linux distros also need system
libs):

```bash
npx playwright install --with-deps
```

## CI

The `e2e.yml` workflow runs `npm run build` then `npx playwright test`
on **`windows-latest`** — the deployment target for this POS. Mac/Linux
developers can run the same suite locally for fast iteration, but the
authoritative pass/fail signal is the Windows run.

Failures upload the HTML report (`playwright-report`) and the per-test
traces (`playwright-traces`) as artifacts. Open a trace with:

```bash
npx playwright show-trace <trace.zip>
```

## Project conventions

- One spec file per user story (`held-tickets.spec.ts`, `purchase-audit.spec.ts`, etc.).
- Tests run serially (`fullyParallel: false`). Electron apps share the OS audio/display
  on a CI runner; running multiple Electron instances in parallel is flaky.
- Each test launches its own Electron app via `launchApp()` and disposes it in
  `finally { await cleanup() }`. **Always** call cleanup — leaked `userData` dirs
  fill `/tmp` over time.
- The launch helper uses `--user-data-dir=<temp>`, so every test sees an empty
  database. The first window is always the recovery setup form (US5 from feature
  001's spec).
- Prefer `getByText` / `getByLabel` / `getByRole` over CSS selectors. Add
  `data-testid` only when the visible text is ambiguous or generated.
- For assertions on data layer state (e.g. "the held_tickets table has zero rows
  owned by user B"), use `ipc(window, () => window.api.heldTickets.list())` to
  call IPC directly from inside the renderer instead of clicking through the UI.
  This skips slow UI navigation while still exercising the auth guard and the
  repository.

## Adding a new test

1. Create `tests/e2e/<feature>.spec.ts`.
2. Import `launchApp` and `ipc` from `./helpers/electron`.
3. Walk through setup (recovery admin, user creation) using `getByLabel` + `getByRole`.
4. For the actual assertion, prefer the `ipc()` shortcut over UI clicks unless
   the test specifically covers a UI invariant.

### Example skeleton

```ts
import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'

test('cashier B does not see cashier A held tickets after handover', async () => {
  const { window, cleanup } = await launchApp()
  try {
    // 1. Setup admin via recovery flow.
    await window.getByLabel(/Nombre/i).fill('Admin')
    await window.getByLabel(/^PIN/i).fill('111111')
    await window.getByLabel(/Confirmar PIN/i).fill('111111')
    await window.getByRole('button', { name: /Crear administrador/i }).click()

    // 2. Admin creates cashier A and cashier B (TODO: factor into a helper).
    // ...

    // 3. Login as A; add two held tickets via IPC.
    await ipc(window, () =>
      window.api.heldTickets.add({
        id: `t-${Date.now()}-1`,
        label: 'Cliente Juan',
        payload: '[]',
        discount: 0
      })
    )
    // ...

    // 4. Logout, login as B, assert zero held tickets.
    const bList = await ipc(window, () => window.api.heldTickets.list())
    expect(bList).toHaveLength(0)
  } finally {
    await cleanup()
  }
})
```

## Known limitations

- The thermal printer path (`print:*` IPC channels) cannot be exercised in CI
  — the test machine has no printer. Those flows stay in the manual
  quickstart.
- The auto-update path (`electron-updater`) requires a real `latest.yml`
  on a GitHub release. Manual verification only.
- Native module ABI: `npm ci && npm run build` rebuilds `better-sqlite3` for
  Electron via the existing `postinstall`, so Playwright tests (which launch
  the Electron binary) get the right binding. **Do not** mix `npm rebuild
  better-sqlite3` (which targets Node) into the same job — that breaks the
  Electron binding.
