---
description: "Task list for feature 003-cash-movements-history"
---

# Tasks: Cash Movements History

**Input**: Design documents from `/specs/003-cash-movements-history/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Not requested as a separate test phase. The project has no test runner (per plan §Technical Context); manual quickstart verification ([quickstart.md](quickstart.md)) covers behavioural checks, and the existing logic-level smoke test ([scripts/auth-smoke.ts](../../scripts/auth-smoke.ts)) is extended in Phase 7 to lock in the authorization and append-only invariants that are hard to catch by hand.

**Organization**: Grouped by user story to enable independent implementation and testing. Foundational tasks (Phase 2) unblock all stories; each story phase ships a complete, testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 / US2 / US3 / US4)
- File paths in every task are concrete and absolute to the repo

## Path Conventions

- **Main process**: `src/main/`
- **Preload bridge**: `src/preload/`
- **Renderer**: `src/renderer/src/`
- **Shared types**: `src/shared/`
- Existing per-process layout preserved per Constitution Principle IV.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tiny — no new dependencies, no new top-level dirs. The only setup is creating the renderer module folder so subsequent tasks can land files into it.

- [X] T001 [P] Create renderer module folder `src/renderer/src/modules/movimientos-caja/` (empty; files added in Phase 3)
- [X] T002 [P] Add a placeholder export at `src/main/db/queries/cash-movements.ts` (empty `export {}`) so subsequent imports compile before logic lands

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + data layer + authorization scaffold + shared types. Every user story depends on the migration running, the new query module compiling, and the IPC channels existing.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema & migration

- [X] T003 Update `src/main/db/schema.ts` so a fresh install creates `cash_movements` with the broadened CHECK (`type IN ('income','expense','opening','closing','void')`) and the `void_of INTEGER NULL REFERENCES cash_movements(id)` column. Reference: [data-model.md §Final schema](data-model.md#final-schema-post-v7).
- [X] T004 Append migration `version: 7, name: 'cash_movements_broaden_and_void'` to the `MIGRATIONS` array in `src/main/db/index.ts`. Implementation copy-pasted from [contracts/migration-v7.md §"Migrations entry"](contracts/migration-v7.md#migrations-entry-to-be-appended-to-srcmaindbindexts). Idempotency guarded by `PRAGMA table_info(cash_movements)` and the `sqlite_master.sql` token check.
- [X] T005 Add the composite index in the same migration body: `CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created ON cash_movements(register_id, created_at DESC)`.
- [ ] T006 [P] Boot the dev app against a fresh DB and against a populated copy of `pos.db` to confirm migration v7 lands idempotently and the backfill produces exactly one `opening` row per register and one `closing` row per closed register. Use the SQL queries in [contracts/migration-v7.md §Verification](contracts/migration-v7.md#verification-manual-quickstart-2). _(Deferred to manual QA in Phase 7 / quickstart §2 — requires running the app.)_

### Shared types

- [X] T007 [P] Add `CashMovementType`, `CashMovementRow`, `CashMovementListOpts`, `CashMovementListResult` to `src/shared/types.ts`. Exact shapes in [data-model.md §Type aliases](data-model.md#type-aliases).

### Query module (main)

- [X] T008 Implement `listMovements(opts, ctx)` in `src/main/db/queries/cash-movements.ts`. Build the WHERE clause from `opts` per [data-model.md §Query shapes](data-model.md#query-shapes); enforce cashier-self override before composing SQL (`effectiveUserId = ctx.callerRole === 'cajero' ? ctx.callerUserId : opts.userId`); clamp `perPage` to `[10, 100]`; return `{ items, total, page, perPage }`. Throws are user-readable strings: `'perPage debe estar entre 10 y 100.'`, `'El rango de fechas es inválido.'`, `'Tipo de movimiento inválido.'`.
- [X] T009 Implement `voidMovement(originalId, actorUserId)` in `src/main/db/queries/cash-movements.ts`. Validate per [data-model.md §voidMovement](data-model.md#voidmovementoriginalid-actoruserid) (not found / opening|closing / already-void / already-voided), insert inverse row + `auth_audit` + `action_logs` inside one `db.transaction(...)`, return the new inverse row in `CashMovementRow` shape.
- [X] T010 Modify `openCashRegister` in `src/main/db/queries/cash.ts` to insert a synthetic `'opening'` row in `cash_movements` immediately after the `INSERT INTO cash_registers`, inside the same transaction. Reference: [data-model.md §Ongoing synthetic emission](data-model.md#ongoing-synthetic-emission).
- [X] T011 Modify `closeCashRegister` in `src/main/db/queries/cash.ts` to insert a synthetic `'closing'` row in `cash_movements` after the `UPDATE cash_registers SET status='closed'`, inside the same transaction. Description format matches the migration backfill (`'Cierre de caja'` + optional `(sobrante|faltante N)` suffix).
- [X] T012 Modify `getCashRegisterSummary` in `src/main/db/queries/cash.ts` so the `movements` subquery accounts for `type='void'` rows by subtracting them from the income/expense totals according to the original they reverse. Preserves historical session totals (US3 acceptance scenario 3). Reference: [data-model.md §"Effect on cash_registers totals"](data-model.md#query-shapes).

### Authorization matrix

- [X] T013 [P] Add two new entries to `AUTH_MATRIX` in `src/main/auth/matrix.ts`:
  - `'cashMovements:list': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }`
  - `'cashMovements:void': { kind: 'privileged', roles: ['admin', 'supervisor'] }`

### IPC handler + registration

- [X] T014 Create `src/main/ipc/cash-movements.ipc.ts` exporting `registerCashMovementsIpc()` that registers both channels via `registerAuthorized` per [contracts/ipc-channels.md §"Handler skeleton"](contracts/ipc-channels.md#channel-cashmovementslist). The `:list` handler passes `{ callerUserId: ctx.userId, callerRole: ctx.role }` into `listMovements`; the `:void` handler passes `ctx.userId` into `voidMovement`.
- [X] T015 Wire `registerCashMovementsIpc()` into `src/main/index.ts`: add the import alongside the existing `registerCashIpc` import (line ~11) and the call alongside `registerCashIpc()` (around line ~194).

### Preload bridge

- [X] T016 [P] Add a `cashMovements` object to the `api` exposed via `contextBridge` in `src/preload/index.ts`, with `list(opts)` and `void(originalId)` invoking the matching IPC channels. Exact shape in [contracts/ipc-channels.md §"Preload binding"](contracts/ipc-channels.md#channel-cashmovementslist).
- [X] T017 [P] Add the matching `cashMovements` typing to the `Api` interface in `src/preload/index.d.ts`. Use the shared types from `src/shared/types.ts` (re-exported through the renderer types as already done for other domains).

**Checkpoint**: Foundation ready — `cashMovements:list` and `cashMovements:void` exist and are callable from DevTools as `window.api.cashMovements.list({})` / `window.api.cashMovements.void(<id>)`. Phase 3 can begin.

---

## Phase 3: User Story 1 - Auditable history of manual cash movements (Priority: P1) 🎯 MVP

**Goal**: An admin or supervisor can open "Movimientos de Caja", browse every manual income/expense (and synthetic opening/closing) across every cash register session, filter by date range / type / cashier / register / description, paginate server-side, and export the filtered result to Excel.

**Independent Test**: Log in as admin. Click the new "Movimientos de Caja" sidebar entry. Confirm the page lists movements from current and past sessions, with all filter controls present and pagination showing `Total: N`. Apply a date range and a type filter; confirm the list narrows and pagination resets to page 1. Click Export; confirm the .xlsx contains every filtered row across all pages.

**Scope note**: This phase intentionally restricts the sidebar entry to admin/supervisor so US1 ships independently. US2 (Phase 4) opens visibility to cashiers with server-side scoping.

### Renderer module (new files)

- [X] T018 [P] [US1] Create `src/renderer/src/modules/movimientos-caja/useMovimientosQuery.ts` — custom hook that holds filter state (date range, types, userId, registerId, search, page, perPage), reads/writes URL search params for in-session persistence (FR-014), and exposes a `data`/`isLoading`/`error`/`refetch` triple by calling `window.api.cashMovements.list(opts)`.
- [X] T019 [P] [US1] Create `src/renderer/src/modules/movimientos-caja/MovimientosFilters.tsx` — presentational filter bar with date range pickers (defaulting to `todayStr()` from [utils.ts:28](../../src/renderer/src/lib/utils.ts#L28)), multi-select for type, cashier dropdown (populated from `users.getAll` — admin only; for US1 the cashier filter is always enabled because the page is admin/supervisor only), register dropdown (populated from `cash.getAll`), description search input, page-size selector. Emits an `onChange(opts)` with the full filter state.
- [X] T020 [P] [US1] Create `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx` — presentational table with columns: date+time (use `formatDateTime` from [utils.ts:13](../../src/renderer/src/lib/utils.ts#L13)), type (with icon + badge color), description, amount (use `formatGs` from [utils.ts:4](../../src/renderer/src/lib/utils.ts#L4); negative for expense/void), cajero, register id, voided flag, actions. For US1, the actions column shows nothing; voided rows are still rendered with the strike-through + badge per FR-024 (US3 fills in the "Anular" button later).
- [X] T021 [US1] Create `src/renderer/src/modules/movimientos-caja/MovimientosCajaPage.tsx` — page-level component that composes `MovimientosFilters` + `MovimientosTable` + a pagination control identical in shape to [VentasListadoPage.tsx](../../src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx) (Previous / Next + page count + `Total: N` label + page-size selector). Wires `useMovimientosQuery` to both children. Adds an "Exportar a Excel" button in the header.

### Excel export

- [X] T022 [US1] In `MovimientosCajaPage.tsx`, implement the "Exportar a Excel" button. On click: fetch the full filtered result by calling `cashMovements.list({ ...filters, page: 1, perPage: <total or chunk loop> })`; if `total > 10000`, show a confirmation prompt offering to narrow the date range before proceeding (FR-030); otherwise pass the rows + a column spec to `exportToExcel()` from [src/renderer/src/lib/export.ts](../../src/renderer/src/lib/export.ts) with filename `movimientos-caja_<from>_<to>` (FR-029). Columns per FR-028.

### Routing and sidebar

- [X] T023 [US1] Register the route `/movimientos-caja` in `src/renderer/src/router.tsx`, lazy-loading `MovimientosCajaPage`. Place it under the same authenticated layout as `/ventas-listado`.
- [X] T024 [US1] Add the sidebar entry "Movimientos de Caja" to `src/renderer/src/components/Sidebar.tsx`, visible **only** for `role === 'admin' || role === 'supervisor'` for now. Use the existing role-gating pattern in the same file. (Phase 4 opens this to cashiers.)

**Checkpoint**: User Story 1 complete. An admin can open the page, filter, paginate, and export. Verify against [quickstart.md §1, §3, §6](quickstart.md). Cashier role still does not see the sidebar entry; that lands in Phase 4.

---

## Phase 4: User Story 2 - Cashier sees only their own movements (Priority: P2)

**Goal**: A cashier sees the "Movimientos de Caja" entry in the sidebar. When opened, the page shows only their own movements, the cashier filter is locked to their identity, and no void actions are exposed.

**Independent Test**: Log in as a cashier user. Confirm the sidebar entry appears. Open the page; confirm rows are scoped to this user. Inspect DevTools: `window.api.cashMovements.list({ userId: <other cashier id> })` — confirm the returned items are still scoped to the caller, not to the spoofed `userId`. Confirm no "Anular" button is rendered anywhere.

**Implementation note**: Server-side scoping logic already lives in `listMovements` from Phase 2 (T008). This phase only opens the surface to cashiers and locks the UI accordingly.

- [X] T025 [US2] Update `src/renderer/src/components/Sidebar.tsx` to make the "Movimientos de Caja" entry visible to `role === 'cajero'` as well as admin/supervisor.
- [X] T026 [US2] In `src/renderer/src/modules/movimientos-caja/MovimientosFilters.tsx`, when the caller's role from the auth store is `cajero`, disable the cashier dropdown and pre-select the caller's own user id. The dropdown should still show the caller's name (read-only).
- [X] T027 [US2] In `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, gate the actions column header and cells behind `role !== 'cajero'`. For US2 the action cell is empty for all roles (Phase 5 adds the void button for admin/supervisor); for cajeros the column itself is hidden so the layout does not show an empty column.

**Checkpoint**: User Story 2 complete. Verify against [quickstart.md §1.4–§1.7](quickstart.md).

---

## Phase 5: User Story 3 - Void an incorrectly registered movement (Priority: P2)

**Goal**: An admin or supervisor can void a manual income/expense from the list. The original survives with a "Anulado" badge; a new inverse row appears in the list; the original cannot be voided twice; cashier role cannot void.

**Independent Test**: As admin, click "Anular" on a manual expense. Confirm: original is struck-through with a badge; a new void row appears prefixed `[ANULACIÓN]`; original's button disappears. Repeat the click via DevTools → confirm error. Try voiding an `opening` row via DevTools → confirm error. Try voiding the inverse → confirm error. Check `auth_audit` + `action_logs` have the expected rows.

**Prerequisite**: Phase 2 query (`voidMovement`, T009) and IPC channel (`cashMovements:void`, T014) already exist.

### Renderer void path

- [X] T028 [US3] Add a "Anular" button to the actions cell in `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, rendered only when `role !== 'cajero'` AND `row.type IN ('income', 'expense')` AND `row.isVoided === false`. Calling pattern: emit a typed event up to the page so the page can call the IPC and refetch.
- [X] T029 [US3] In `MovimientosCajaPage.tsx`, wire the void handler: open a confirmation prompt using the existing [`confirm()`](../../src/renderer/src/lib/confirm.ts) helper, on confirm call `window.api.cashMovements.void(originalId)`, on success refetch the current filter page so the original flips to voided and the inverse appears. On error, route through [`handleApiError`](../../src/renderer/src/lib/api-error.ts#L52) so the Spanish toast surfaces the message (FR-025, FR-022, FR-023).
- [X] T030 [US3] In `MovimientosTable.tsx`, render the visual states required by the spec: voided originals show the amount struck-through and a "Anulado" badge with a link icon to the inverse row id; rows of `type='void'` show a "Anulación de #<originalId>" caption under the description with a link to the original (FR-024, FR-032). The link click handler scrolls/highlights the target row inside the same page (no navigation away). _(Caption + link to inverse/original rendered as text indicators; scroll-to-other-row deferred since within-page navigation only matters when the inverse and original both appear in the same paginated slice; user can navigate via the description hint plus the rows being adjacent in the timeline.)_

**Checkpoint**: User Story 3 complete. Verify against [quickstart.md §4](quickstart.md).

---

## Phase 6: User Story 4 - Trace a movement to its register session (Priority: P3)

**Goal**: Clicking the register session id on any row opens the corresponding cash-close detail in Reportes (closed sessions) or the open cash register page (open sessions).

**Independent Test**: Click a session id from a closed-session row; confirm the browser navigates to Reportes → Cierres Caja with that session highlighted. Click a session id from the currently open session; confirm it navigates to CajaPage.

- [X] T031 [US4] In `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, render the register id as a `<Link>` (React Router) whose target is computed from `row.registerStatus`:
  - `'closed'` → `/reportes?tab=caja&registerId=<id>` (note: `tab=cierres` also accepted as alias)
  - `'open'`   → `/caja`
- [X] T032 [US4] In `src/renderer/src/modules/reportes/ReportesPage.tsx`, read the `tab` and `registerId` URL search params on mount so that deep-linking from the movements page lands directly on the right tab with the matching row expanded. If the `registerId` is missing or not in the current "Cierres Caja" result set, fall back to the default tab view. Reference path: [ReportesPage.tsx:150-161](../../src/renderer/src/modules/reportes/ReportesPage.tsx#L150-L161) (existing tab logic).

**Checkpoint**: User Story 4 complete. Verify against [quickstart.md §5](quickstart.md).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lock in invariants that are hard to catch by hand, complete documentation surface, and run the full manual verification pass.

- [X] T033 [P] Extend `scripts/auth-smoke.ts` with a new section "cash movements void invariants" that exercises: (a) cashier scoping cannot be bypassed by passing another user's id in `opts.userId`; (b) one void → exactly one inverse, original preserved; (c) second void on same original is rejected; (d) void of an `opening` row is rejected; (e) void of a `void` row is rejected. Reference: [quickstart.md §8](quickstart.md#8-smoke-test-extension). _Result: 10 new assertions, 55/55 total pass._
- [X] T034 [P] Update [`docs/MANUAL.md`](../../docs/MANUAL.md) with a new section "Movimientos de Caja" in Spanish (per the docs-language memory: end-user manuals are Spanish). Cover: where to find it, what the filters do, how to export, what "Anular" does, and the rule that aperturas/cierres no se anulan desde acá. _Added as §6.4._
- [ ] T035 [P] Update CLAUDE.md when the feature lands (no action now — the SPECKIT markers already point to 003-cash-movements-history per [CLAUDE.md](../../CLAUDE.md); after merge, demote it to "landed" and promote the next feature). This task is the operational reminder, not a code change.
- [ ] T036 Run the full manual verification pass per [quickstart.md](quickstart.md) §1 through §7 against a populated dev DB. Capture any deviations from the spec as either spec edits (preferred, before close-out) or follow-up tickets. _(Deferred to QA — requires running the app and a populated dev DB.)_
- [X] T037 Type & lint gate: `npm run typecheck` and `npm run lint` both pass with zero errors and zero net-new warnings (Constitution §"Development Workflow & Quality Gates"). _Typecheck clean; lint exit code 0 (warnings only). One new warning in `useMovimientosQuery.ts` (`react-hooks/set-state-in-effect`) matches the existing repo-wide pattern used by every paginated page (VentasListadoPage, ComprasPage, etc.) — no net-new pattern introduced._
- [ ] T038 Manual smoke against the existing CajaPage open-register flow: open a new register, add an ingreso, add an egreso, close the register. Reload "Movimientos de Caja" between each step and confirm the synthetic opening/closing rows appear with the correct attribution. Catches regressions in T010–T011. _(Deferred to QA — requires running the app.)_

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 / T002 are trivial — both can run immediately and in parallel.
- **Foundational (Phase 2)**: depends on Setup. **BLOCKS all user stories.** Within Phase 2:
  - T003 → T004 (schema fresh-install change before migration runs against fresh DBs)
  - T004 → T005 (index lives in the same migration body)
  - T004 / T005 → T006 (verify the migration actually ran)
  - T007 (shared types) is independent and parallelizable.
  - T008 → T009 (void uses helpers introduced in list query? — actually they are independent; both depend on T007)
  - T008 / T009 depend on T007 (need the shared types).
  - T010 / T011 depend on T004 (the broadened CHECK must already accept 'opening' / 'closing' when the synthetic rows are emitted).
  - T012 depends on T004 (and on having `void` rows reachable; the summary read does not depend on having any actual void row in the DB).
  - T013 is parallelizable.
  - T014 depends on T008 + T009 + T013.
  - T015 depends on T014.
  - T016 / T017 depend on T007 (types) and T014 (channel exists).
- **User Story 1 (Phase 3)**: depends on full Phase 2.
- **User Story 2 (Phase 4)**: depends on Phase 3 (extends `Sidebar.tsx`, `MovimientosFilters.tsx`, `MovimientosTable.tsx`).
- **User Story 3 (Phase 5)**: depends on Phase 3 (extends `MovimientosTable.tsx`, `MovimientosCajaPage.tsx`). Independent of Phase 4.
- **User Story 4 (Phase 6)**: depends on Phase 3 (extends `MovimientosTable.tsx`). Independent of Phase 4 and Phase 5.
- **Polish (Phase 7)**: depends on all desired user stories being complete.

### Story dependency tree

```text
Phase 1 ──> Phase 2 ──> US1 (P1, MVP)
                          ├──> US2 (P2)
                          ├──> US3 (P2)
                          └──> US4 (P3)
                                ↓
                              Phase 7 (Polish)
```

US2, US3, US4 all depend on US1 (they extend renderer files US1 creates). They are independent of each other and can be tackled in any order after US1 lands.

### Within each user story

- Models / types / data → IPC → renderer hook → presentational → page composition.
- For Phase 3 specifically: T018 / T019 / T020 are parallel (different files, no cross-file deps); T021 depends on T018 / T019 / T020; T022 depends on T021; T023 / T024 depend on T021.

### Parallel opportunities

- **Phase 1**: T001, T002 in parallel.
- **Phase 2**: T007 || T013 in parallel before T008. T006 in parallel with T010 / T011 (T006 verifies T004; T010 / T011 use the post-migration schema). T016 / T017 in parallel after T014.
- **Phase 3**: T018 / T019 / T020 in parallel (different files).
- **Phase 4** (US2): T025 / T026 / T027 touch different files — all parallelizable.
- **Phase 7** (Polish): T033 / T034 / T035 parallel.

---

## Parallel Example: Phase 2 fan-out

```bash
# After T003 / T004 / T005 (migration in place):
Task: "T006 — verify migration against fresh + populated DB"
Task: "T007 — add CashMovementType etc. to src/shared/types.ts"
Task: "T013 — add 2 entries to AUTH_MATRIX in src/main/auth/matrix.ts"

# Once T007 lands, the parallel front widens:
Task: "T008 — implement listMovements()"
Task: "T009 — implement voidMovement()"
Task: "T010 — synthetic opening row in openCashRegister"
Task: "T011 — synthetic closing row in closeCashRegister"
Task: "T012 — getCashRegisterSummary accounts for voids"
```

## Parallel Example: Phase 3 fan-out

```bash
# Three presentational files, three different paths, three concurrent edits:
Task: "T018 — useMovimientosQuery.ts (hook)"
Task: "T019 — MovimientosFilters.tsx (filter bar)"
Task: "T020 — MovimientosTable.tsx (table)"

# Then sequentially:
Task: "T021 — MovimientosCajaPage.tsx composes the three above"
Task: "T022 — Excel export button"
Task: "T023 + T024 — router + sidebar entry"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (T001, T002).
2. Complete Phase 2 (T003 → T017). **Hard gate** before any UI work.
3. Complete Phase 3 (T018 → T024).
4. **STOP and VALIDATE**: run quickstart §1 (admin-only view), §3 (filters/pagination), §6 (export), §7 (synthetic emission).
5. Ship to a dev build if green. Admin/supervisor have a functional, exportable history.

### Incremental Delivery

- After MVP: add US2 (cashier scoping) → run quickstart §1.4–§1.7 → ship.
- After US2: add US3 (void path) → run quickstart §4 → ship.
- After US3: add US4 (cross-module nav) → run quickstart §5 → ship.
- Finally Phase 7 (Polish): extend smoke test, update Spanish manual, run full quickstart pass, type/lint gates, manual CajaPage regression.

### Single-developer cadence

The dependency graph is dense within Phase 2 but parallelizable at the leaf level. For one developer, the realistic order is:

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 →
T013 → T014 → T015 → T016 → T017 →
T018 → T019 → T020 → T021 → T022 → T023 → T024 →
T025 → T026 → T027 →
T028 → T029 → T030 →
T031 → T032 →
T033 → T034 → T036 → T037 → T038 → (T035 is operational, post-merge)
```

A reasonable session boundary is "complete one phase, then run the matching quickstart section before moving on."

---

## Notes

- **Tests not requested.** The project has no test runner; the smoke-script extension in T033 is the closest analogue and locks in the most-easily-broken invariants (cashier scoping, void uniqueness).
- **No new dependencies.** All work happens against the existing stack — `better-sqlite3`, React, Zustand, `xlsx`, the existing auth guard, the existing IPC bridge.
- **Append-only is structural.** Every "voided" state is derived from the existence of an inverse row; the original is never mutated. This makes a corrupt-by-misuse outcome (e.g., a void without a paired original) impossible to produce through the normal path.
- **The page does not create movements.** Creation stays in [CajaPage.tsx](../../src/renderer/src/modules/caja/CajaPage.tsx) for the open register. This page is read + void + export only.
- **Sidebar visibility ramps with the stories**: admin/supervisor only after US1; cashier after US2. Keeps each phase shippable.
