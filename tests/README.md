# Test suite

Two complementary layers live under `tests/`:

```
tests/
├── integration/              # vitest — query-layer SQL against an in-memory DB
│   ├── _fixtures/db.ts       # createTestDb / seedUser / seedCustomer / seedRegister helpers
│   └── *.test.ts
└── e2e/                      # @playwright/test — drives the packaged Electron build
    ├── helpers/              # launchApp + IPC-driven seed helpers
    ├── pom/                  # Page Objects (LoginPage, SidebarNav, …)
    └── *.spec.ts
```

## Integration tests (vitest)

Run the query layer against `better-sqlite3` `:memory:` databases. Each test
applies the full migration ledger (v1…vN) via the test-only hatch
`runMigrationsForTesting(db)` and wires the queries module to it via
`setDbForTesting(db)`. No Electron, no filesystem, no IPC plumbing — pure SQL
semantics.

```bash
# One-shot run with rebuild against the host Node ABI. The pretest hook flips
# better-sqlite3's native binding from Electron's ABI to Node's so vitest can
# require it.
npm run test:integration

# Watch mode (no rebuild — assumes you already ran the line above once).
npm run test:integration:watch

# With v8 coverage on src/main/db/queries/customers.ts (threshold ≥ 85%).
npm run test:integration:coverage

# After integration tests, restore the Electron ABI binding before running
# the app or the e2e suite:
npm run rebuild:electron
```

### Fixtures

`tests/integration/_fixtures/db.ts` exposes:

- `createTestDb()` — fresh `:memory:` better-sqlite3 with every migration
  applied, wired into the queries layer through `setDbForTesting`.
- `seedUser(db, { role, name?, pin? })` — inserts a user, returns
  `{ id, name, role }`.
- `seedCustomer(db, { balance?, name?, isEmployee? })` — inserts a customer
  with the given starting balance.
- `seedOpenRegister(db, userId, opening?)` / `seedClosedRegister(...)` —
  cash_register rows in the expected status with the synthetic
  `cash_movements.opening` row mirroring the production path.
- `countRows(db, table)` — small helper for "should-be-zero" assertions.

### Adding a new integration test

1. Create `tests/integration/<area>.test.ts`.
2. Inside `beforeEach`, call `createTestDb()` and seed the rows the query
   under test depends on.
3. Import the query function directly from
   `src/main/db/queries/<area>.ts` and call it.
4. Assert against the in-memory database with `db.prepare(...).get/all/run`.

Run a single file with `npx vitest run tests/integration/foo.test.ts`.

## End-to-end tests (Playwright + Electron)

See [tests/e2e/README.md](e2e/README.md). One-line summary: `npm run build`
followed by `npx playwright test` launches the packaged Electron build
against a throw-away `userData` directory and drives the renderer through
real IPC. The native ABI must point at Electron (`npm run rebuild:electron`
flips it back if you just ran the integration tests).

## better-sqlite3 ABI dance

`better-sqlite3` is a native module — its `.node` binary is compiled against
either Node's ABI or Electron's ABI, never both. The repository default
(installed by `postinstall` → `electron-builder install-app-deps`) is the
Electron ABI, because that is what the running app needs.

Vitest runs in Node, so `npm run test:integration` automatically calls
`npm run rebuild:node` first (the `pretest:integration` hook). After running
the integration tests, you have a Node-ABI binding — that's wrong for the
Electron app itself; call `npm run rebuild:electron` to flip it back. CI does
both flips around the integration step so the e2e job that follows still
sees the Electron ABI.

## CI matrix

- `.github/workflows/ci.yml` — lint, integration tests, build (Ubuntu).
- `.github/workflows/e2e.yml` — full Playwright suite on Windows (the POS's
  deployment target).

A passing PR has both green.
