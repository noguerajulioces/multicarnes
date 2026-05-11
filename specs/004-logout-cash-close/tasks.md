---

description: "Task list for 004-logout-cash-close — block logout when the signed-in user owns an open cash register, with a one-click shortcut into the existing close-register flow."
---

# Tasks: Logout Requires Cash Register Close

**Input**: Design documents from `/specs/004-logout-cash-close/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: This project has no automated test suite for renderer/IPC paths (matches feature 001/002/003 convention). Verification is via [quickstart.md](quickstart.md). No test tasks are emitted here.

**Organization**: Tasks are grouped by user story (US1 = P1 cashier block, US2 = P2 admin/supervisor symmetry, US3 = P3 alternate logout entry points) so each can be implemented and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on an incomplete task — safe to parallelize.
- **[Story]**: US1 / US2 / US3 maps to spec.md user stories.
- Each task includes the exact path to edit or create.

## Path Conventions

Existing Electron tri-process layout (do not reorganize per Constitution VII):

- Main: `src/main/`
- Preload: `src/preload/`
- Renderer: `src/renderer/src/`
- Shared: `src/shared/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working tree and developer environment are ready. No new tooling is required for this feature.

- [ ] T001 Verify branch and clean tree: from repo root, create or switch to git branch `004-logout-cash-close` off `main`, confirm `git status` is clean before starting.
- [ ] T002 Confirm dev environment runs: `npm install && npm run dev` boots the app and lets you sign in as a cashier with the existing seed users. Do not proceed past Phase 1 if this fails.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the per-user IPC query, its authorization rule, and the preload + renderer type surface so every user story phase can wire its UI to a working backend call.

**⚠️ CRITICAL**: No user-story phase (US1/US2/US3) can begin until this phase is complete — they all consume `window.api.cash.getMyOpenRegister`.

- [X] T003 Add per-user query `getOpenCashRegisterByUserId(userId: number): CashRegister | undefined` in [src/main/db/queries/cash.ts](../../src/main/db/queries/cash.ts), placed alongside `getCurrentCashRegister`. Use `SELECT cr.*, u.name AS user_name FROM cash_registers cr LEFT JOIN users u ON u.id = cr.user_id WHERE cr.user_id = ? AND cr.status = 'open' LIMIT 1`. Return `undefined` when no row. Reference shape from [data-model.md](data-model.md).
- [X] T004 [P] Add authorization-matrix rule for `cash:getMyOpenRegister` in [src/main/auth/matrix.ts](../../src/main/auth/matrix.ts): allow `admin`, `supervisor`, `cashier` (any authenticated user). Mirror the entry style used by existing `cash:getCurrent`.
- [X] T005 Register the IPC handler in [src/main/ipc/cash.ipc.ts](../../src/main/ipc/cash.ipc.ts) using `registerAuthorized('cash:getMyOpenRegister', getRule('cash:getMyOpenRegister'), (_event, ctx) => cashQuery.getOpenCashRegisterByUserId(ctx.userId) ?? null)`. Position the block after `cash:getCurrent` for locality. Depends on T003 and T004.
- [X] T006 [P] Add the preload bridge in [src/preload/index.ts](../../src/preload/index.ts) inside the existing `cash` namespace: `getMyOpenRegister: () => ipcRenderer.invoke('cash:getMyOpenRegister')`. Place it next to `getCurrent` to keep the file's grouping.
- [X] T007 [P] Extend the `ApiCash` interface in [src/preload/index.d.ts](../../src/preload/index.d.ts) (line 114) with `getMyOpenRegister(): Promise<CashRegister | null>`. Use the existing `CashRegister` type already imported by the file.

**Checkpoint**: The renderer can call `await window.api.cash.getMyOpenRegister()` and receive either a `CashRegister` row or `null`. Verify by adding a one-off `console.log(await window.api.cash.getMyOpenRegister())` in the app, then revert.

---

## Phase 3: User Story 1 - Cashier with open register is blocked (Priority: P1) 🎯 MVP

**Goal**: A cashier whose register is open cannot log out; they see a Spanish modal naming their open register and a one-click shortcut to the existing close-register page. A cashier with no open register logs out as before.

**Independent Test**: Sign in as a cashier, open a register, click *Cerrar sesión* in the header. Modal appears with the register info and a *Cerrar caja ahora* button that lands on `/caja/cierre` with the register preselected. Close the register; trigger logout again; logout proceeds.

### Implementation for User Story 1

- [X] T008 [P] [US1] Create the renderer hook in [src/renderer/src/hooks/use-logout-guard.ts](../../src/renderer/src/hooks/use-logout-guard.ts). Export `useLogoutGuard()` returning `{ requestLogout, blockState, dismiss, retry, proceedToClose }`. `blockState` is one of `{ kind: 'idle' } | { kind: 'block', openRegister } | { kind: 'error', message }`. `requestLogout` calls `window.api.cash.getMyOpenRegister()`; on `null` it invokes `useAuthStore.getState().logout()` then navigates to `#/login` via the same path the existing call sites use today (`window.location.hash = '#/login'`); on a register row it sets `blockState` to `block`; on rejection it sets `blockState` to `error`. `proceedToClose` calls `useCashStore.getState().setRegister(register)` then `navigate('/caja/cierre')` from `react-router-dom`. Add a docstring above the hook stating: *"Every UI path that ends the session MUST call requestLogout() instead of auth.store.logout() directly. New entry points (idle timeout, switch-user) must route through here."*
- [X] T009 [P] [US1] Create the modal component in [src/renderer/src/components/LogoutBlockedModal.tsx](../../src/renderer/src/components/LogoutBlockedModal.tsx). Props: `state` (`block | error`), `openRegister?`, `onClose`, `onProceed`, `onRetry`. Render an accessible modal (use the same modal primitives the rest of the app uses — search for existing modal usage in `src/renderer/src/components` if a shared `Modal` component exists, otherwise inline a Tailwind-styled fixed overlay matching the project's existing modals). Spanish copy verbatim:
  - Title (block): **"No podés cerrar sesión con la caja abierta"**.
  - Body (block): one line stating your register opened at `<opened_at formatted>` with apertura `<opening_amount formatted>` is still open; close it first.
  - Primary button (block): **"Cerrar caja ahora"** → `onProceed`.
  - Secondary button (block): **"Cancelar"** → `onClose`.
  - Title (error): **"No se pudo verificar el estado de la caja"**.
  - Body (error): **"Volvé a intentarlo. No vamos a cerrar tu sesión hasta confirmar que no quedó una caja abierta a tu nombre."**
  - Primary button (error): **"Reintentar"** → `onRetry`.
  - Secondary button (error): **"Cancelar"** → `onClose`.
  - No "logout anyway" affordance under any state (FR-008).
- [X] T010 [US1] Wire the header logout button to the guard in [src/renderer/src/components/Header.tsx](../../src/renderer/src/components/Header.tsx). Replace the existing `handleLogout` (line ~117) so it calls `requestLogout()` from `useLogoutGuard()` instead of `logout()` directly. Render `<LogoutBlockedModal …/>` driven by the hook's `blockState`. Remove the existing `window.location.hash = '#/login'` line — the hook owns that side-effect on the allow path. Depends on T008 and T009.
- [ ] T011 [US1] Smoke-check US1 against [quickstart.md](quickstart.md) Test 1 and Test 2 — cashier blocked when register is open, shortcut lands on `/caja/cierre` with register preselected, logout proceeds after close; cashier without open register logs out with no modal. Capture any deviation as a fix-up task before declaring US1 done.

**Checkpoint**: US1 is fully functional from the header logout button. Sidebar logout buttons still call the old path — that's intentional and is closed in US3.

---

## Phase 4: User Story 2 - Admin/Supervisor symmetry (Priority: P2)

**Goal**: Admin and supervisor users follow the same rule: they are blocked only if a register is open in their own name; another user's open register never blocks them.

**Independent Test**: With a cashier holding an open register, sign in as the admin (no own register) and log out — proceeds with no modal. Then have the admin open a register in their own name; logout shows the same modal as US1.

US2 is **already satisfied by the Phase 2 design** because:

- The IPC handler scopes the lookup to `ctx.userId`, never to a client-supplied id (see [contracts/ipc-cash-get-my-open-register.md](contracts/ipc-cash-get-my-open-register.md)).
- The authorization rule from T004 permits all three roles.
- The hook from T008 has no role branching.

Therefore the only US2 work is verifying the property end-to-end against a live build — no additional code edits.

### Implementation for User Story 2

- [ ] T012 [US2] Walk [quickstart.md](quickstart.md) Test 3 (admin and supervisor not blocked by another user's open register) and Test 4 (admin and supervisor blocked by their *own* open register). If either path fails, the regression points to a leak between `ctx.userId` and the query — investigate T003/T005 before adding any role-branching code. Do **not** add role checks; the design is intentionally per-user, not per-role (research.md Decision 2 and 3).

**Checkpoint**: US1 + US2 hold simultaneously: cashier, admin, and supervisor are each blocked iff they personally own an open register.

---

## Phase 5: User Story 3 - All session-ending paths use the same guard (Priority: P3)

**Goal**: Every UI affordance that ends the session — header logout (already done in US1), sidebar expanded logout, sidebar collapsed logout, and any future idle-timeout or switch-user flow — routes through `requestLogout`. No silent bypass exists.

**Independent Test**: Repeat [quickstart.md](quickstart.md) Test 1 from each of the three logout affordances. Same blocked-logout modal appears in every case.

### Implementation for User Story 3

- [X] T013 [P] [US3] Wire the expanded-sidebar logout button to the guard in [src/renderer/src/components/Sidebar.tsx](../../src/renderer/src/components/Sidebar.tsx) at the line-218 button. Replace the direct `logout()` call with `requestLogout()` from `useLogoutGuard()`. Remove the matching `window.location.hash = '#/login'` line that follows it. The same `<LogoutBlockedModal …/>` instance (from the same hook) should be rendered once at the Sidebar root so both buttons share it. Depends on T008/T009.
- [X] T014 [US3] Wire the collapsed-sidebar logout button to the guard in [src/renderer/src/components/Sidebar.tsx](../../src/renderer/src/components/Sidebar.tsx) at the line-244 button. Reuse the same hook instance and modal rendered at the Sidebar root in T013 — do not instantiate a second hook. Same edits: replace `logout()` with `requestLogout()`, drop the hash navigation.
- [X] T015 [US3] Inventory check: from the repo root, run `grep -rn "useAuthStore" src/renderer/src/components src/renderer/src/pages src/renderer/src/modules` and confirm the only remaining callers of `logout` outside [src/renderer/src/hooks/use-logout-guard.ts](../../src/renderer/src/hooks/use-logout-guard.ts) are non-UI fallbacks (e.g., session-expiry handlers in interceptors, if any). If any UI button still calls `logout()` directly, add a follow-up task here to route it through `requestLogout()` before closing US3.
- [ ] T016 [US3] Run [quickstart.md](quickstart.md) Test 5 (all three logout affordances guarded) and Test 7 (force-quit recovery — next login still surfaces the block).

**Checkpoint**: Every UI path that ends a session in the current codebase is guarded. The docstring on `useLogoutGuard` documents the invariant for any future entry point.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Manual QA against the fail-closed path, final regression sweep, and constitution-aligned cleanups.

- [ ] T017 Run [quickstart.md](quickstart.md) Test 6 (fail-closed on IPC error). If the dev environment cannot inject a synthetic failure into the handler, mark this test as "deferred to runtime monitoring" in the quickstart sign-off block and record the rationale.
- [X] T018 [P] Run `npm run typecheck` and `npm run lint` from the repo root; both must pass with zero new errors and zero net-new warnings (per constitution Development Workflow gates).
- [ ] T019 [P] Performance spot-check for SC-004: in a session with no open register, observe perceived logout latency from button click to login screen. Should be indistinguishable from pre-feature (sub-200 ms added). If a regression is observed, profile `getOpenCashRegisterByUserId` — likely candidate is missing index, addressed in T020 if needed.
- [ ] T020 (conditional) If T019 surfaces a latency regression in the no-open-register case, add a follow-up migration creating `CREATE INDEX idx_cash_registers_user_status ON cash_registers(user_id, status)` under [src/main/db/migrations/](../../src/main/db/migrations/) following the existing migration-versioning pattern. Do **not** add this index speculatively — Principle VII.
- [ ] T021 Sign off all checkboxes in [quickstart.md](quickstart.md). Update the *Active feature* block in [CLAUDE.md](../../CLAUDE.md) to mark 004 as landed once the feature merges to `main` (mirroring how 003 was archived after landing).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks** every US phase.
- **US1 (Phase 3)**: Depends on Foundational complete.
- **US2 (Phase 4)**: Depends on Foundational complete. Logically independent of US1 (purely verification + design property), so it can run in parallel with US1 by a second developer.
- **US3 (Phase 5)**: Depends on Foundational complete **and** on T008 + T009 (hook + modal exist). Can run in parallel with US1's T010/T011 once T008/T009 land, by editing a different file (Sidebar.tsx vs Header.tsx).
- **Polish (Phase 6)**: Depends on US1 + US3 implementation tasks. US2 (verification-only) can be folded in here if scheduling prefers.

### Within Each Phase

- T003 → T005 (handler consumes query).
- T004 → T005 (handler consumes matrix rule).
- T008 + T009 → T010, T013, T014 (UI tasks consume the hook + modal).
- T010 / T013 / T014 touch *different* files → safe to parallelize, but they share the design contract that the modal renders once per parent component; coordinate to ensure Sidebar uses one shared modal instance for its two buttons.
- T011 / T012 / T016 / T017 are verification — must run *after* the implementation tasks they verify.

### Parallel Opportunities

- T004, T006, T007 in Phase 2 are all [P] — three different files, no inter-dependencies. A single developer can implement them back-to-back; two developers can split them.
- T008 and T009 in Phase 3 are [P] — hook and modal live in separate files. T009 has no runtime dependency on T008 (the modal is presentational with props).
- T013 and T014 in Phase 5 both edit `Sidebar.tsx` and are therefore **NOT** parallelizable with each other; do them sequentially or fold into one commit. They are [P] only relative to tasks in other files.
- T018 and T019 in Phase 6 are [P] — different commands, no shared state.

---

## Parallel Example: User Story 1

```bash
# Once Phase 2 (T003–T007) is green, kick off US1's two foundational pieces in parallel:
Task: "Create the renderer hook in src/renderer/src/hooks/use-logout-guard.ts (T008)"
Task: "Create the modal component in src/renderer/src/components/LogoutBlockedModal.tsx (T009)"

# Then T010 (Header wiring) consumes both. T011 (quickstart Test 1+2) runs last.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001–T002).
2. Phase 2: Foundational (T003–T007). Verify with a one-off console.log against `window.api.cash.getMyOpenRegister`.
3. Phase 3: US1 (T008–T011). At T011 the header logout flow is fully guarded.
4. **STOP and VALIDATE**: This is the demo-able MVP. Cashier with open register cannot log out from the header button.
5. If timeboxed, ship US1 alone — US2 is a verification-only property of the foundational design, and US3 only widens to other buttons.

### Incremental Delivery

1. Setup + Foundational → IPC ready.
2. US1 (header) → demo to stakeholders; the most-used logout path is guarded.
3. US2 (verification) → confirm admin/supervisor symmetry; no code change.
4. US3 (sidebar buttons + audit) → close any remaining bypass affordance.
5. Polish → typecheck/lint, latency spot-check, quickstart sign-off.

### Parallel Team Strategy

With two developers:

1. Both: Setup + Foundational together (T003–T007 split: dev A takes T003/T005, dev B takes T004/T006/T007).
2. Once Phase 2 is green:
   - Dev A: US1 (T008–T011).
   - Dev B: US3 prep — once T008/T009 are merged, take T013–T016. US2 (T012) is a 30-minute walkthrough either dev can claim.
3. Polish phase together.

---

## Notes

- [P] tasks = different files, no dependencies — safe to run in parallel.
- [Story] label maps each task to its user story for traceability and for partial-ship decisions.
- No automated test tasks are emitted — this codebase has no renderer/IPC test harness today; verification is via [quickstart.md](quickstart.md) (same convention as features 001–003).
- Commit after each task or coherent group of tasks (e.g., Phase 2 as one commit, T008+T009 as one commit, T010+T011 as one commit).
- Stop at each phase checkpoint to validate the increment before continuing.
- Avoid: adding a "logout anyway" escape hatch (violates FR-008 and Decision 5 in [research.md](research.md)); adding role checks inside the new handler (violates Decision 2 — the per-user scoping is the whole point); modifying [CierreCajaPage.tsx](../../src/renderer/src/modules/caja/CierreCajaPage.tsx) (violates FR-011 — the close flow is reused as-is via store hydration + navigation).
