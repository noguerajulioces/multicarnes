---
description: "Task list for 001-ipc-authorization (server-side authorization for privileged operations)"
---

# Tasks: Server-side Authorization for Privileged Operations

**Input**: Design documents from `/specs/001-ipc-authorization/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Per [research.md](research.md#r9-testing-posture) (R9), this feature ships **without** new test infrastructure. Validation is via the startup self-test (T010) and manual quickstart runs (one verification task per user story phase, plus polish-phase verification of the cross-cutting tests). No `tests/contract/`, `tests/integration/`, or `tests/unit/` tasks are generated.

**Organization**: Tasks are grouped by user story so each can be implemented and demoed independently. US1 and US2 are both P1 — US1 is the MVP increment per the skill's default; US2 immediately follows and is co-equal in priority.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel — different files, no dependency on incomplete tasks.
- **[Story]**: Maps the task to a user story (US1, US2, US3, US4, US5).
- File paths are exact; every task names the file it touches.

## Path Conventions

This is an Electron desktop app with the existing layout:

- Main process code: `src/main/**`
- Preload bridge: `src/preload/**`
- Renderer: `src/renderer/src/**`
- Shared types: `src/shared/**`
- Database: SQLite file at `app.getPath('userData')/pos.db`; schema in `src/main/db/schema.ts`; migrations in `src/main/db/index.ts`; queries in `src/main/db/queries/**`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directory and shared types the rest of the feature builds on.

- [ ] T001 Create the new module directory `src/main/auth/` (will contain `matrix.ts`, `session.ts`, `guard.ts`, `audit.ts`, `alerts.ts`, `self-test.ts`).
- [ ] T002 [P] Create `src/shared/auth-types.ts` with the shared types listed in [data-model.md §Shared types](data-model.md): `Role`, `AuthOutcome`, `AuthRule` (discriminated union with `public` / `self-only` / `self-or-roles` / `privileged`), `AuthAuditEntry`, `AuthAlert`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, repository, session map, matrix skeleton, guard helper, error wiring. **No user story can begin until this phase is complete** — every guarded handler in US1–US5 depends on `registerAuthorized()` and the matrix being in place.

**⚠️ CRITICAL**: All of T003–T015 must complete before Phase 3.

- [ ] T003 Add `auth_audit` and `auth_alert_acks` table declarations to `src/main/db/schema.ts` per [contracts/audit-schema.md](contracts/audit-schema.md). Both inside the existing `createTables()` call.
- [ ] T004 Add idempotent migration blocks to `src/main/db/index.ts` `runMigrations()`: detect missing `auth_audit` / `auth_alert_acks` tables via `sqlite_master` and create them with the index from [contracts/audit-schema.md](contracts/audit-schema.md). Append the 90-day retention `DELETE FROM auth_audit WHERE created_at < datetime('now','-90 days')` statement at the end of `runMigrations()`.
- [ ] T005 [P] Create `src/main/db/queries/auth.ts` repository with prepared-statement-backed functions: `insertAudit(entry)`, `listAudit(filters)`, `detectFailureWindows()` (the 10-minute `HAVING COUNT(*) >= 5` query from [contracts/audit-schema.md](contracts/audit-schema.md)), `ensureAlertWindow(userId, windowStart)`, `listOpenAlerts()`, `acknowledgeAlert(alertId, ackByUserId)`.
- [ ] T006 [P] Create `src/main/auth/session.ts` with an in-memory `Map<number, AuthSession>` keyed by `webContents.id`. Exports: `recordLogin(senderId, userId)`, `clearBySender(senderId)`, `clearByUser(userId)`, `getBySender(senderId)`. Listen for the Electron `web-contents-destroyed` event in `app.on(...)` and clear the corresponding session.
- [ ] T007 [P] Create `src/main/auth/matrix.ts` with: (a) an empty `Record<string, AuthRule>` exported as `AUTH_MATRIX`; (b) a `getRule(channel)` helper that returns the entry or the failure-closed default `{kind:'privileged', roles:[]}` per FR-008; (c) a re-export of the rule types from `src/shared/auth-types.ts`. Entries are populated per user-story phase.
- [ ] T008 Create `src/main/auth/audit.ts` exporting `recordDecision(decision: AuthDecision)` that maps the decision into an `AuthAuditEntry` and calls `insertAudit` from `src/main/db/queries/auth.ts`. Depends on T005.
- [ ] T009 Create `src/main/auth/guard.ts` exporting `registerAuthorized(channel, rule, handler)`: (1) wraps `ipcMain.handle(channel, ...)`, (2) reads `event.sender.id`, (3) looks up session via `src/main/auth/session.ts`, (4) re-resolves the user and role from `src/main/db/queries/users.ts` (`SELECT id, role, active FROM users WHERE id = ?`), (5) evaluates the rule (delegating `self-only` / `self-or-roles` to a `selfArgIndex`-aware helper), (6) calls `recordDecision` from `src/main/auth/audit.ts`, (7) on `allowed` invokes the original handler with `(event, ctx, ...args)` where `ctx={userId,role}`, (8) on rejection throws an `AuthError`. Also export `AuthError`. Depends on T006, T007, T008.
- [ ] T010 [P] Create `src/main/auth/self-test.ts` exporting `assertMatrixCoverage(registeredChannels: string[])` that compares the set of channels passed in to the keys of `AUTH_MATRIX` and throws a descriptive error when any registered channel has no matrix entry. Depends on T007.
- [ ] T011 Modify `src/main/index.ts` to: (1) import `assertMatrixCoverage` and call it after every `register*Ipc()` invocation, passing the union of channels each module reports back; (2) refuse to finish app startup (show an error dialog and quit) if the assertion fails. Depends on T009, T010. Each `register*Ipc()` will be modified in subsequent phases to return its channel list and to use `registerAuthorized`.
- [ ] T012 [P] Create `src/renderer/src/lib/api-error.ts` exporting an `isAuthError(err)` predicate (matches the `outcome: 'blocked-*'` envelope from `AuthError`) and a `handleApiError(err)` helper that emits a uniform toast ("No tenés permiso para realizar esta acción.") via the existing `src/renderer/src/store/toast.store.ts`. Renderer modules will call `handleApiError` from their `.catch(...)` blocks (rolled out per US phase).
- [ ] T013 [P] Add a settings field whitelist in `src/main/ipc/backup.ipc.ts` `settings:getAll` handler. Whitelist = `['business_name','business_address','business_phone','thermal_printer_name','thermal_printer_width','login_keypad_enabled','backup_path','auto_backup','backup_schedule_enabled','backup_schedule_time']` per [contracts/auth-matrix.md](contracts/auth-matrix.md). The handler filters the SELECT result to those keys before returning. Defensive measure for the public `settings:getAll` channel.
- [ ] T014 Modify `users:login` handling in `src/main/db/queries/users.ts` (or its IPC wrapper in `src/main/ipc/users.ipc.ts`, whichever has access to `event.sender`): on bcrypt success, call `recordLogin(event.sender.id, user.id)` from `src/main/auth/session.ts`. Depends on T006.
- [ ] T015 Add `users:logout` handler to `src/main/ipc/users.ipc.ts`: clears the session for `event.sender.id`, returns `{ ok: true }`. Public channel — register via `registerAuthorized` with `{kind:'public'}`. Depends on T006, T009.

**Checkpoint**: Foundation is in place. The matrix is empty (so the boot self-test will fail until at least one channel has an entry — this is expected and forces the team to populate the matrix as each story lands). All user-story phases below can proceed once T015 is done.

---

## Phase 3: User Story 1 — Cashier cannot escalate to administrative actions (Priority: P1) 🎯 MVP

**Goal**: A cashier directly invoking any user-management, backup, or global-settings operation is rejected server-side, regardless of UI gating. Unauthorized attempts produce an audit row.

**Independent Test**: Run [quickstart.md](quickstart.md) Test 1 — log in as `caja1`, invoke `window.api.users.create`, `window.api.backup.restore`, `window.api.settings.set`, and `window.api.users.update(otherUserId, ...)` from dev tools. Each must reject; no DB state may change; an `auth_audit` row must exist for each attempt.

### Implementation for User Story 1

- [ ] T016 [US1] Populate `AUTH_MATRIX` entries for the US1 channels in `src/main/auth/matrix.ts`: `users:getActive` (public), `users:login` (public), `users:logout` (public), `users:getAll` (privileged admin), `users:getById` (`self-or-roles` admin, `selfArgIndex: 0`), `users:create` (privileged admin — recovery-only modifier added in US5/T048), `users:update` (`self-or-roles` admin, `selfArgIndex: 0`), `backup:create` (privileged admin+supervisor), `backup:list` (privileged admin+supervisor), `backup:restore` (privileged admin), `backup:selectFolder` (privileged admin), `settings:getAll` (public), `settings:set` (privileged admin).
- [ ] T017 [US1] Convert all handler registrations in `src/main/ipc/users.ipc.ts` from `ipcMain.handle(...)` to `registerAuthorized(channel, AUTH_MATRIX[channel], handler)`. Update `registerUsersIpc()` to return its channel list for the boot self-test (T011).
- [ ] T018 [P] [US1] Convert all handler registrations in `src/main/ipc/backup.ipc.ts` (the file that owns `backup:*` and `settings:*`) to `registerAuthorized`. Update `registerBackupIpc()` to return its channel list. Different file from T017 → parallelizable.
- [ ] T019 [US1] Implement field-level enforcement on the `users:update` handler in `src/main/db/queries/users.ts`: when `ctx.userId === targetUserId` AND `ctx.role !== 'admin'` (i.e., the caller matched via the `self` branch of `self-or-roles`), reject any payload that touches `role`, `active`, or `name`. Only `pin_hash` may change in that branch. Throws an application error (not an `AuthError`) so the audit row still records `outcome='allowed'` while the operation fails. Depends on T009 to receive `ctx`.
- [ ] T020 [US1] Wire renderer `.catch(handleApiError)` into `src/renderer/src/modules/usuarios/UsuariosPage.tsx`, `src/renderer/src/modules/backup/BackupPage.tsx`, `src/renderer/src/modules/configuracion/ConfiguracionPage.tsx`, and `src/renderer/src/modules/perfil/PerfilPage.tsx` so authorization rejections surface as toasts (FR-024).
- [ ] T021 [US1] Run [quickstart.md](quickstart.md) Test 1 manually: confirm the four documented invocations are rejected and that one `auth_audit` row exists per attempt with `outcome='blocked-insufficient-role'` and `resolved_role='cajero'`.

**Checkpoint**: User Story 1 (MVP) is complete and demoable. The system blocks the highest-impact escalation path — admin-account creation, backup restore, settings change — even if the renderer is compromised.

---

## Phase 4: User Story 2 — Financial mutations require appropriate role (Priority: P1)

**Goal**: A cashier directly invoking `sales:cancel`, `cash:close` (against a register they don't own), `cash:addMovement`, or any customer-payment mutation is rejected. The cashier-who-opened-the-register CAN close their own session.

**Independent Test**: Run [quickstart.md](quickstart.md) Test 2 — verify the cashier-self close path succeeds, supervisor-close any-register succeeds, and `sales:cancel` / `customers:deletePayment` from a cashier are both rejected with audit rows.

### Implementation for User Story 2

- [ ] T022 [US2] Populate matrix entries for US2 channels in `src/main/auth/matrix.ts`: `sales:create` / `sales:getById` / `sales:getRecent` / `sales:getByRegister` / `sales:dayTotal` (privileged all-roles), `sales:cancel` (privileged admin+supervisor), `cash:open` / `cash:getCurrent` / `cash:getMovements` / `cash:getSummary` (privileged all-roles), `cash:close` (privileged admin+supervisor — cashier-self exception handled inside the handler), `cash:addMovement` (privileged admin+supervisor), `cash:getAll` (privileged admin+supervisor), `customers:getAll` / `customers:getById` / `customers:getPayments` / `customers:getSales` (privileged all-roles), `customers:create` / `customers:update` / `customers:delete` / `customers:addPayment` / `customers:updatePayment` / `customers:deletePayment` (privileged admin+supervisor), `products:create` / `products:update` / `products:adjustStock` / `products:createCategory` / `products:uploadImage` / `products:pickImage` / `products:saveImageFromPath` (privileged admin+supervisor), `print:ticket` (privileged all-roles), `print:hasConfig` (public), `products:getImagePath` (public), `notify:show` (public).
- [ ] T023 [US2] Convert handler registrations in `src/main/ipc/sales.ipc.ts` to `registerAuthorized` and return channel list from `registerSalesIpc()`.
- [ ] T024 [P] [US2] Convert handler registrations in `src/main/ipc/cash.ipc.ts` to `registerAuthorized`. Different file → parallelizable.
- [ ] T025 [P] [US2] Convert handler registrations in `src/main/ipc/customers.ipc.ts` to `registerAuthorized`.
- [ ] T026 [P] [US2] Convert handler registrations in `src/main/ipc/products.ipc.ts` to `registerAuthorized` for the **mutating** channels listed in T022. Read channels (`getAll`, `getById`, `getByBarcode`, `categories`, `lowStock`, plus the cost-revealing ones) are wrapped in US3/T031.
- [ ] T027 [P] [US2] Convert handler registrations in `src/main/ipc/print.ipc.ts` and `src/main/ipc/notifications.ipc.ts` to `registerAuthorized`.
- [ ] T028 [US2] Implement the cashier-self exception for `cash:close` in `src/main/db/queries/cash.ts`: receive `ctx`, look up the register, allow when `ctx.role ∈ {'admin','supervisor'}` OR `register.user_id === ctx.userId`. Reject with an application error (not `AuthError`) when neither holds. Required because the `privileged: ['admin','supervisor']` rule alone would block the legitimate cashier-self path.
- [ ] T029 [P] [US2] Wire `.catch(handleApiError)` into `src/renderer/src/modules/ventas/VentasPage.tsx`, `src/renderer/src/modules/ventas/CobroModal.tsx`, `src/renderer/src/modules/caja/CajaPage.tsx`, `src/renderer/src/modules/caja/CierreCajaPage.tsx`, `src/renderer/src/modules/clientes/ClientesPage.tsx`, `src/renderer/src/modules/clientes/ClienteFichaPage.tsx`, and `src/renderer/src/modules/productos/ProductosPage.tsx`.
- [ ] T030 [US2] Run [quickstart.md](quickstart.md) Test 2 manually.

**Checkpoint**: Both P1 stories are live. Privilege-escalation paths (US1) and financial-mutation paths (US2) are protected. This is a fully shippable security release on its own.

---

## Phase 5: User Story 3 — Sensitive reports respect role boundaries (Priority: P2)

**Goal**: A cashier requesting profit margin, last-purchase cost, or supplier data is rejected. Cashier reads of the product list / detail still work but with cost and margin fields stripped.

**Independent Test**: Run [quickstart.md](quickstart.md) Test 3 — log in as cashier, open a product detail (no cost/margin row visible), call `window.api.reports.profitMargin()` (rejected), then re-login as supervisor and confirm the same call returns full cost data.

### Implementation for User Story 3

- [ ] T031 [US3] Populate matrix entries for US3 channels in `src/main/auth/matrix.ts`: `reports:salesByPeriod` / `reports:topProducts` / `reports:salesSummary` / `reports:salesComparison` (privileged all-roles), `reports:profitMargin` / `reports:stockMovements` / `reports:cashRegisters` / `reports:pendingCredits` (privileged admin+supervisor), `products:getAll` / `products:getById` / `products:getByBarcode` / `products:categories` / `products:lowStock` (privileged all-roles), `products:movements` / `products:recentSales` / `products:salesStats` / `products:lastPurchase` (privileged admin+supervisor), `suppliers:getAll` / `suppliers:getById` / `suppliers:create` / `suppliers:update` / `purchases:getAll` / `purchases:getById` / `purchases:create` / `purchases:receive` / `purchases:cancel` (all privileged admin+supervisor).
- [ ] T032 [US3] Convert handler registrations in `src/main/ipc/reports.ipc.ts` to `registerAuthorized`.
- [ ] T033 [P] [US3] Convert the **read** handler registrations in `src/main/ipc/products.ipc.ts` to `registerAuthorized` (the mutating ones were done in T026). Different concern, same file: **NOT** parallel with T026 (already done by this phase) but parallel with T034 below.
- [ ] T034 [P] [US3] Convert handler registrations in `src/main/ipc/purchases.ipc.ts` to `registerAuthorized` (file owns both `suppliers:*` and `purchases:*`).
- [ ] T035 [US3] Implement cost-field stripping in `src/main/db/queries/products.ts` for `getAll` and `getById`: when `ctx.role === 'cajero'`, remove `last_purchase_cost`, any `margin*` field, and the supplier name from each returned row. The query stays the same; the projection happens in TypeScript before return. Depends on T009 to receive `ctx`.
- [ ] T036 [US3] Update `src/renderer/src/modules/productos/ProductoDetallePage.tsx` to render the cost/margin section conditionally (omit when the response lacks those fields). The KPI card "Última compra" / "Margen" hides instead of showing "-".
- [ ] T037 [P] [US3] Wire `.catch(handleApiError)` into `src/renderer/src/modules/reportes/ReportesPage.tsx`, `src/renderer/src/modules/compras/ComprasPage.tsx`, `src/renderer/src/modules/compras/NuevaCompraPage.tsx`, `src/renderer/src/modules/compras/CompraDetallePage.tsx`, and `src/renderer/src/modules/compras/ProveedoresPage.tsx`.
- [ ] T038 [US3] Run [quickstart.md](quickstart.md) Test 3 manually.

**Checkpoint**: Read-side authorization is in place. Cost data does not leak to cashiers via direct invocation or via the product-detail screen.

---

## Phase 6: User Story 4 — Authorization failures audited and surfaced (Priority: P2)

**Goal**: Admins see a banner on the dashboard when a user produces ≥5 blocked attempts in 10 minutes. Acknowledgment persists and clears the banner. Admins can browse the full audit log.

**Independent Test**: Run [quickstart.md](quickstart.md) Test 4 — trigger 6 blocked operations as cashier, log in as admin, see the alert banner, click acknowledge, confirm it clears on reload, query `window.api.auth.listAuditEntries({ outcome: 'blocked-insufficient-role' })` and confirm ≥6 rows.

### Implementation for User Story 4

- [ ] T039 [US4] Add high-level alert detection helpers in `src/main/db/queries/auth.ts`: `findOpenAlertWindows()` runs the CTE from [contracts/audit-schema.md](contracts/audit-schema.md), upserts `auth_alert_acks` rows, and returns currently-open alerts joined with `users.name`. Builds on the prepared statements created in T005.
- [ ] T040 [US4] Create `src/main/auth/alerts.ts` exporting `getOpenAlerts()` and `acknowledge(alertId, ackByUserId)` that orchestrate `src/main/db/queries/auth.ts`. Pure orchestration; no DB code lives here.
- [ ] T041 [P] [US4] Create `src/main/ipc/auth.ipc.ts` registering channels `auth:matrixSummary`, `auth:listAuditEntries`, `auth:listAlerts`, `auth:acknowledgeAlert` via `registerAuthorized`. (`auth:recoveryNeeded` is added by US5/T046 in the same file.) Export `registerAuthIpc()` returning the channel list.
- [ ] T042 [US4] Register `registerAuthIpc()` in `src/main/index.ts` and add the four new channels to the matrix entries in `src/main/auth/matrix.ts`: `auth:matrixSummary` / `auth:listAuditEntries` / `auth:listAlerts` / `auth:acknowledgeAlert` all `privileged: ['admin']`. Depends on T041.
- [ ] T043 [P] [US4] Add `window.api.auth = { matrixSummary, listAuditEntries, listAlerts, acknowledgeAlert }` to `src/preload/index.ts`. (Plus `recoveryNeeded` placeholder; the handler is implemented in US5/T046.)
- [ ] T044 [P] [US4] Update `src/preload/index.d.ts` with the typed `window.api.auth` surface, importing `AuthAlert`, `AuthAuditEntry`, `AuthOutcome`, `Role` from `src/shared/auth-types.ts`.
- [ ] T045 [P] [US4] Create `src/renderer/src/store/auth-events.store.ts` (Zustand): state `{alerts: AuthAlert[], loading: boolean}`, actions `fetchAlerts()` and `acknowledge(alertId)` that call `window.api.auth.*`. Domain-scoped per Constitution Principle II.
- [ ] T046 [P] [US4] Create `src/renderer/src/components/AuthAlertsBanner.tsx` that calls `useAuthEventsStore` and renders one banner per open alert with the user name, failure count, window start, and "Acknowledge" button. Hidden entirely when `alerts.length === 0`.
- [ ] T047 [US4] Integrate `<AuthAlertsBanner />` into `src/renderer/src/modules/dashboard/DashboardPage.tsx` above the existing KPI grid, conditional on `useAuthStore.getState().role === 'admin'`. On mount, the banner triggers `fetchAlerts()`.
- [ ] T048 [US4] Run [quickstart.md](quickstart.md) Test 4 manually.

**Checkpoint**: Admins now have visibility into authorization failures and can detect probing or compromised accounts. The full audit list is queryable for incident review.

---

## Phase 7: User Story 5 — Recovery path for empty / corrupted user table (Priority: P3)

**Goal**: When the database has zero active admins, the login screen shows the existing first-run admin-creation form, regardless of how the state arose (fresh install, partial restore, manual deactivation). Once an admin exists, the recovery path closes.

**Independent Test**: Run [quickstart.md](quickstart.md) Test 8 — manually deactivate all admins via SQL, restart the app, observe the recovery form, create an admin, confirm the login picker reappears.

### Implementation for User Story 5

- [ ] T049 [US5] Add `countActiveAdmins(): number` to `src/main/db/queries/users.ts` (`SELECT COUNT(*) FROM users WHERE active = 1 AND role = 'admin'`).
- [ ] T050 [US5] Modify `src/main/index.ts` startup sequence: after `initDatabase()`, compute `recoveryMode = countActiveAdmins() === 0` and store it in a small module under `src/main/auth/recovery.ts` exporting `isRecoveryMode()` and `refreshRecoveryMode()`. The flag is also refreshed inside `users:create` after a successful insert (so creating the first admin closes the recovery path immediately within the same session).
- [ ] T051 [US5] Implement `auth:recoveryNeeded` handler in `src/main/ipc/auth.ipc.ts` (file created in US4/T041): returns `{ recoveryNeeded: isRecoveryMode() }`. Add the matrix entry `auth:recoveryNeeded` (public).
- [ ] T052 [US5] Update the `users:create` handler in `src/main/db/queries/users.ts` to honor the recovery-only modifier: when `isRecoveryMode()` is true, allow the call regardless of caller role **but** force `role = 'admin'` (the recovery flow only creates admins, per FR-022). When recovery mode is false, the matrix's `privileged: ['admin']` rule already blocks non-admins via the guard. After successful insert in recovery, call `refreshRecoveryMode()`.
- [ ] T053 [US5] Update `users:create`'s matrix entry in `src/main/auth/matrix.ts` to `privileged: ['admin']` with `recoveryOnly: true`. Update `src/main/auth/guard.ts` to honor the `recoveryOnly` modifier (allow the call when `isRecoveryMode()` is true, even with no resolved user). Depends on the `recovery.ts` module from T050.
- [ ] T054 [US5] Update `src/renderer/src/modules/login/LoginPage.tsx`: on mount, call `window.api.auth.recoveryNeeded()`; when `true`, render the existing first-run admin-creation form (the branch already keyed on empty user list). When the form submits successfully, refresh the user list and the recoveryNeeded flag.
- [ ] T055 [US5] Run [quickstart.md](quickstart.md) Test 8 manually.

**Checkpoint**: All five user stories are independently functional. The merchant cannot lock themselves out by losing their admin PIN — they can recover by wiping the user table and creating a new admin.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Run the cross-cutting quickstart tests, refresh the project's spec memory, and finalize agent context.

- [ ] T056 [P] Run [quickstart.md](quickstart.md) Test 5 (deactivated user mid-session): pause the renderer, deactivate the logged-in user from a second client (or by SQL), resume, confirm next privileged call → `blocked-inactive`.
- [ ] T057 [P] Run [quickstart.md](quickstart.md) Test 6 (role demoted mid-session): same pattern — confirm role re-resolution on the next call (FR-025).
- [ ] T058 [P] Run [quickstart.md](quickstart.md) Test 7: self PIN change works; self attempt to change `role` is rejected by the field-level enforcement from T019.
- [ ] T059 [P] Run [quickstart.md](quickstart.md) Test 9: deliberately remove a matrix entry, confirm the boot self-test refuses to start the app, restore the entry, confirm normal start.
- [ ] T060 Verify the 90-day retention DELETE statement runs at boot and completes within budget on a populated `auth_audit` (use the production-size estimate of ~2000 rows/day). If retention is slow, add an index on `created_at` or batch the DELETE.
- [ ] T061 Update [.specify/memory/functional-spec.md](../../.specify/memory/functional-spec.md): add a new section "Authentication / Authorization" describing the matrix and audit; mark the relevant items in [.specify/memory/gap-analysis.md](../../.specify/memory/gap-analysis.md) Appendix A as resolved.
- [ ] T062 Update [CLAUDE.md](../../CLAUDE.md) once the feature ships: replace the "Active feature" pointer with the next feature, or remove it if no follow-up is queued.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies; start immediately.
- **Phase 2 (Foundational)** → depends on Phase 1; **blocks** all user stories (the matrix, guard, session, audit, and self-test must exist before any handler is wrapped).
- **Phase 3 (US1)** through **Phase 7 (US5)** → all depend on Phase 2 completion. Once Phase 2 is done, the user-story phases **can run in parallel** if multiple developers are available, with two caveats below.
- **Phase N (Polish)** → depends on the user stories that are in scope for the release.

### Cross-Phase File Conflicts (sequencing constraints inside parallel work)

Several phases edit the same file:

- `src/main/auth/matrix.ts` is touched by T007 (skeleton), T016 (US1), T022 (US2), T031 (US3), T042 (US4), T053 (US5). **Sequencing required**: each US phase appends entries; do not parallelize the matrix-population task across phases.
- `src/main/ipc/products.ipc.ts` is touched by T026 (US2 mutating wraps) and T033 (US3 read wraps). T033 must wait for T026.
- `src/main/db/queries/users.ts` is touched by T014 (foundational), T019 (US1 field enforcement), T049 / T052 (US5 recovery). T019 must wait for T014; T052 must wait for T019 to avoid merge conflicts on the same file.
- `src/main/ipc/auth.ipc.ts` is created by T041 (US4) and extended by T051 (US5). T051 must wait for T041.
- `src/main/index.ts` is touched by T011 (foundational), T042 (US4 IPC registration), T050 (US5 recoveryMode init). All three must serialize against each other.

Within the same user-story phase, tasks marked **[P]** can run in parallel because they touch different files.

### User Story Dependencies (after Phase 2)

- **US1 (P1)**: independent. MVP candidate.
- **US2 (P1)**: independent of US1. Both P1 stories ship the same security release.
- **US3 (P2)**: independent of US1/US2.
- **US4 (P2)**: independent of US1/US2/US3 — the audit table is written by the foundational guard (T008/T009), so meaningful audit rows exist as soon as US1 starts producing rejections. US4 just adds the surfacing layer.
- **US5 (P3)**: independent of US1/US2/US3 functionally, but **shares the file `src/main/db/queries/users.ts`** with US1's T019 and the foundational T014. Sequence those edits.

### Within Each User Story

- Matrix entry first, then handler wrapping, then any handler-internal enforcement (cashier-self, field-level rules, cost-stripping), then renderer error wiring, then the manual quickstart verification.

### Parallel Opportunities

- **Phase 1**: T001 then T002 [P] (file creation, no overlap).
- **Phase 2**: After T003+T004 (schema+migration must be sequential), the cluster T005/T006/T007/T010/T012/T013 can run in parallel; T008 waits on T005; T009 waits on T006+T007+T008; T011 waits on T009+T010; T014 waits on T006; T015 waits on T006+T009.
- **Phase 3 (US1)**: T017 and T018 are different files → parallel. T019 and T020 follow.
- **Phase 4 (US2)**: T024 / T025 / T026 / T027 (four different `*.ipc.ts` files) → all parallel after T022 lands the matrix entries.
- **Phase 5 (US3)**: T033 / T034 → parallel after T031. T036 / T037 → parallel after T035.
- **Phase 6 (US4)**: T043 / T044 / T045 / T046 → parallel (preload, types, store, component all live in different files).
- **Phase N**: T056 / T057 / T058 / T059 → all parallel manual tests.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T003 + T004 (schema + migration) land, fan out:
Task: "Create src/main/db/queries/auth.ts repository (T005)"
Task: "Create src/main/auth/session.ts (T006)"
Task: "Create src/main/auth/matrix.ts skeleton (T007)"
Task: "Create src/main/auth/self-test.ts (T010) — depends on T007"
Task: "Create src/renderer/src/lib/api-error.ts (T012)"
Task: "Add settings field whitelist to src/main/ipc/backup.ipc.ts (T013)"
```

## Parallel Example: User Story 2

```bash
# After T022 (matrix entries for US2) lands, fan out the handler wraps:
Task: "Wrap sales.ipc.ts with registerAuthorized (T023)"
Task: "Wrap cash.ipc.ts with registerAuthorized (T024)"
Task: "Wrap customers.ipc.ts with registerAuthorized (T025)"
Task: "Wrap mutating handlers in products.ipc.ts (T026)"
Task: "Wrap print.ipc.ts and notifications.ipc.ts (T027)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3.
2. **STOP** and run [quickstart.md](quickstart.md) Test 1.
3. If green, this is a shippable security increment: cashiers can no longer escalate to admin actions. Tag `v1.x.0-auth-mvp` and demo to the merchant.

### Recommended ship — Both P1 stories together

P1 stories are co-equal. A single release that covers both administrative escalation **and** financial mutations is the natural "phase-1-of-the-feature" deliverable.

1. Phase 1 → Phase 2 → Phase 3 → Phase 4.
2. Run quickstart Tests 1 and 2.
3. Run polish-phase Tests 5 / 6 / 9 (mid-session deactivation, role demotion, self-test gap).
4. Tag `v1.x.0-auth` and ship.

### Incremental Delivery After P1

5. Phase 5 (US3) → run Test 3 → ship.
6. Phase 6 (US4) → run Test 4 → ship.
7. Phase 7 (US5) → run Test 8 → ship. (Last because it's the only "convenience" story; until US5 ships, an empty admin set forces a manual SQL recovery.)
8. Phase N polish → close the feature; update `.specify/memory/*` (T061) and `CLAUDE.md` (T062).

### Parallel Team Strategy (with 2+ developers)

- Pair on Phase 2 — it's the foundation; one developer drives, the other reviews.
- After Phase 2:
  - Dev A: US1 (Phase 3) + US3 (Phase 5) — both are matrix-and-wrap heavy.
  - Dev B: US2 (Phase 4) + US4 (Phase 6) — financial mutations + alert UI.
  - Either dev: US5 (Phase 7) — small.
- Watch the "Cross-Phase File Conflicts" list above; the matrix file and `users.ts` queries serialize across phases.

---

## Notes

- **Tests**: deliberately none in this tasks list. Quickstart manual runs are the validation surface for v1; a real test runner is its own follow-up feature (gap analysis P4).
- **Each US is independently demoable**: the spec, plan, and matrix were designed for it. If a phase grows scope, push the new work into a follow-up feature rather than expanding this tasks list.
- **Commit after each task or logical group**: especially T009 (guard) and T011 (self-test) — once those land, every subsequent matrix population is a small, reviewable diff.
- **Do not amend a published commit**: Constitution VII rule.
- **Stop at any checkpoint**: each US phase ends with a checkpoint and a quickstart test; that's a valid release boundary.

---

# Extension: Round 2 Gap-Analysis Tasks (P2 – P9)

> The phases below were appended on 2026-05-08 to address the remaining items in
> [.specify/memory/gap-analysis.md](../../.specify/memory/gap-analysis.md) §5
> (P2, P3, P5, P6, P7, P8, P9). They are scoped narrowly so each phase ships an
> independently committable change. They live in the same `tasks.md` for
> tracking convenience but are **not part of the original 001-ipc-authorization
> spec**; they predate or co-exist with the IPC-authorization work.
>
> **Tests**: per the same posture as the original feature (R9), no new test
> infrastructure is added. Validation is by manual quickstart and code review.

---

## Phase 8: P2 — Validate open register in `sales:create` (Priority: CRITICAL)

**Goal**: A sale cannot be posted against a closed register. Validation is at the
**query layer**, not the IPC layer, so a tampered `localStorage` cash-store cannot
bypass it.

**Independent Test**: Open and immediately close a register (note its `id`).
From dev tools, call `window.api.sales.create({ registerId: <closedId>, ... })`.
The call must reject with an application error and **no** `sales` row may be
written.

### Implementation for P2

- [x] T063 [P2] Modify `createSale()` in `src/main/db/queries/sales.ts` to verify the target register is open as the first statement inside the transaction: `SELECT status FROM cash_registers WHERE id = ?`. If missing or not `'open'`, throw `new Error('La caja indicada no está abierta. Abrí una nueva caja antes de continuar.')`. The throw inside the transaction will roll back automatically.
- [x] T064 [P2] Verify manually: with no open register, opening the POS still shows the existing client-side prompt; bypassing via dev tools is now rejected at the DB level. (Verified by reading code; manual run-time test deferred since it depends on app launch.)

**Checkpoint**: Stale-register sale corruption is no longer possible.

---

## Phase 9: P3 — Versioned migrations (Priority: CRITICAL)

**Goal**: Replace the introspection-based ad-hoc migration with a versioned
ledger and pre-migrate safety net, per Constitution Principle VI.

**Independent Test**: On a clean DB, the app boots and applies every migration
in order, leaving N rows in `schema_migrations`. A second boot applies zero new
migrations. Adding a new migration with `version = N+1` is the only way to
evolve the schema; replays are idempotent.

### Implementation for P3

- [x] T065 [P3] Add `schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))` to `src/main/db/schema.ts` `createTables()`.
- [x] T066 [P3] Refactor `runMigrations()` in `src/main/db/index.ts` to a versioned pattern: an in-file array `MIGRATIONS: { version: number; name: string; up: (db) => void }[]` is iterated; each unapplied entry runs inside a single `db.transaction()` and records itself in `schema_migrations` after success. Existing legacy migrations (image column, customers.document backfill, backup_schedule_* settings) become versions 1, 2, 3.
- [x] T067 [P3] Add a pre-migrate safeguard to `runMigrations()`: if `schema_migrations` is non-empty AND any pending migration exists, copy `pos.db` to `{userData}/backups/pre-migrate-<version>-<timestamp>.db` before applying. On a fresh DB (no existing rows in any table) skip the backup since there's nothing to preserve.
- [x] T068 [P3] Backfill the ledger on first boot of an upgraded install: if `schema_migrations` is empty BUT the schema already shows signs of legacy migrations (presence of `products.image`, `customers.document`, or the `backup_schedule_*` rows in `app_settings`), insert ledger rows marking versions 1–3 as already applied so they don't replay. Comment the heuristic clearly.
- [x] T069 [P3] Manually verify: (a) fresh DB → all migrations apply, (b) existing DB on the dev machine → backfill marks 1–3 as applied, no re-run, (c) typecheck passes. (Typecheck verified via `npm run typecheck`.)

**Checkpoint**: Future migrations have a versioned, transactional, backup-protected pipeline.

---

## Phase 10: P5 — Sales-driven stock audit rows (Priority: HIGH)

**Goal**: Every change to `products.stock` produces a `stock_adjustments` row,
so the "Mov. Stock" report is a complete audit trail.

**Independent Test**: Make a sale containing 2 items, then cancel it. The
`stock_adjustments` table now contains 4 new rows: 2 for the sale (reason
`Venta #<id>`) with negative deltas, 2 for the cancellation (reason `Anulación
venta #<id>`) with positive deltas. The Mov. Stock report displays all four.

### Implementation for P5

- [x] T070 [P5] In `createSale()` (`src/main/db/queries/sales.ts`), inside the existing transaction, insert a `stock_adjustments` row for each item: read `quantity_before` from `products.stock` before the UPDATE, compute `quantity_after = quantity_before - item.quantity`, and insert `(product_id, user_id, quantity_before, quantity_after, reason='Venta #<saleId>')` after the UPDATE.
- [x] T071 [P5] In `cancelSale()` (same file), inside the existing transaction, insert a `stock_adjustments` row for each restocked item with `reason='Anulación venta #<saleId>'`. Mirrors T070's pattern.
- [x] T072 [P5] In `receivePurchaseOrder()` and the receive branch of `createPurchaseOrder()` (`src/main/db/queries/purchases.ts`), insert a `stock_adjustments` row per line with `reason='Recepción compra #<orderId>'`. Closes the third bypass identified in gap-analysis §3.1. Note: `receivePurchaseOrder` falls back to the order creator's user_id for the audit attribution because the IPC does not yet pass the receiving user (TODO marker added).
- [x] T073 [P5] Manually verify: typecheck passes; fresh sale / cancellation / purchase-reception each produce the expected audit rows (verified by code review of the new transactions).

**Checkpoint**: The stock audit table reflects every stock change.

---

## Phase 11: P6 — Document and verify sale cancellation (Priority: HIGH)

**Goal**: The cancellation flow is documented in the functional spec and its
behaviour against (a) stock, (b) customer balance, (c) cash session is
verified.

**Independent Test**: A reader can find a §7.11 in `functional-spec.md`
describing exactly what `sales:cancel` does, with `file:line` citations.

### Implementation for P6

- [x] T074 [P6] Add §7.11 "Sale cancellation" to `.specify/memory/functional-spec.md` documenting: (1) who can call (admin/supervisor per the IPC spec), (2) idempotency (already-cancelled is a no-op returning null), (3) restock behaviour (each item's quantity is added back), (4) credit refund (full total returned to customer balance for `payment_method='credit'`), (5) cash-session impact (cancelled sales drop out of the day's totals because cash queries filter `status='completed'`), (6) audit trail (`action_logs` row with `action='cancel_sale'`, plus the `stock_adjustments` rows added in P5).
- [x] T075 [P6] Verify in code that the documentation is accurate by re-reading `cancelSale()` and the cash queries (`getDayCashSalesTotal`, `getRegisterSummary`). Found divergence: `mixed`-payment cancellation does not refund the credit portion. Documented in §7.11 as a known divergence; TODO comment added at the cancelSale credit-refund block in `src/main/db/queries/sales.ts`.
- [x] T076 [P6] Update `gap-analysis.md` Appendix A item 4 to mark §7.11 as added.

**Checkpoint**: The cancellation flow is no longer an undocumented sensitive operation.

---

## Phase 12: P7 — Constitution Principle V amendment (Priority: MEDIUM)

**Goal**: Reconcile Principle V with reality. Conservative choice: amend the
constitution to allow renderer-side xlsx/jsPDF, since the codebase has shipped
this way and a refactor to main is high-risk for no functional gain. Document
the security rationale (trusted internal data, no untrusted input crossing the
formatter boundary).

**Independent Test**: Reading `constitution.md` Principle V matches what the
code does. The Sync Impact Report at the top reflects the amendment.

### Implementation for P7

- [x] T077 [P7] Edit `.specify/memory/constitution.md` Principle V: keep the rule that **thermal printer logic** lives in main, but split out a sub-rule that **report generation (xlsx, jsPDF)** MAY live in the renderer provided (a) the formatters take plain data in and return blobs/buffers out, and (b) no untrusted input crosses the formatter (current behaviour). Added "Rationale (renderer-side reports)" paragraph.
- [x] T078 [P7] Update the Sync Impact Report comment at the top of `constitution.md`: bump version `1.0.0` → `1.1.0` (MINOR — guidance materially expanded), set `LAST_AMENDED_DATE` to today (2026-05-08), and list the modified principle.

**Checkpoint**: Principle V is no longer in conflict with the code.

---

## Phase 13: P8 — Update locked stack with shipping deps (Priority: MEDIUM)

**Goal**: Principle I lists every package shipping in production.

**Independent Test**: `package.json` and Principle I agree on the set of approved
runtime deps; the diff between them is empty.

### Implementation for P8

- [x] T079 [P8] Edit `.specify/memory/constitution.md` Principle I: add `recharts` (charts), `@reactour/tour` (guided tours), `date-fns` (date utilities), `lucide-react` (icons), `clsx` + `tailwind-merge` (className composition), and `@fontsource/inter` (UI font) to the approved list with one-line purposes each. Note that this is documenting reality, not approving anything new.
- [x] T080 [P8] Roll the version bump from P7 (1.0.0 → 1.1.0) into the same Sync Impact Report entry rather than re-bumping; update the report's "Modified principles" line to include Principle I as well.

**Checkpoint**: Principle I is now an enforceable gate (the baseline matches reality).

---

## Phase 14: P9 — Held tickets to SQLite (Priority: MEDIUM)

**Goal**: Held tickets persist in the database, not localStorage. They survive
a userData reset, an OS-user switch, and a backup/restore cycle.

**Independent Test**: Create two held tickets, delete `localStorage`, reload
the app, see both tickets still present. Restore an older backup, see the
tickets from that backup state instead.

### Implementation for P9

- [ ] T081 [P9] Add `held_tickets(id TEXT PRIMARY KEY, label TEXT NOT NULL, payload TEXT NOT NULL, discount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))` to `src/main/db/schema.ts` `createTables()`. `payload` is the JSON-serialized `CartItem[]`; `id` is the renderer-generated string ID (kept TEXT to preserve compatibility with the existing localStorage IDs).
- [ ] T082 [P9] Add a versioned migration entry (depends on Phase 9 / P3) for the `held_tickets` table — guard with `CREATE TABLE IF NOT EXISTS` for the case where P9 ships before P3. If P3 has already landed, register the migration as the next available version.
- [ ] T083 [P9] Create `src/main/db/queries/held-tickets.ts` with: `listHeldTickets()`, `addHeldTicket({id, label, payload, discount})`, `removeHeldTicket(id)`, `clearHeldTickets()`. Repository pattern, prepared statements.
- [ ] T084 [P9] Create `src/main/ipc/held-tickets.ipc.ts` with `held:list`, `held:add`, `held:remove`, `held:clear`. Export `registerHeldTicketsIpc()` returning the channel list. (When the IPC-authorization feature 001 lands, these become matrix entries — until then they register via `ipcMain.handle` directly.)
- [ ] T085 [P9] Register `registerHeldTicketsIpc()` in `src/main/index.ts` next to the existing `register*Ipc()` calls.
- [ ] T086 [P9] Expose `window.api.heldTickets = { list, add, remove, clear }` in `src/preload/index.ts` and add the typed surface to `src/preload/index.d.ts`.
- [ ] T087 [P9] Refactor `src/renderer/src/store/held.store.ts`: remove the `localStorage` read/persist, replace with async calls to `window.api.heldTickets.*`. The store exposes a `loadFromDb()` action and an in-memory cache; mutations call the IPC and refresh the cache. Keep the API shape (`add / remove / consume / clear`) so consumers don't change.
- [ ] T088 [P9] One-shot migration helper in `held.store.ts` (or a dedicated module called once on app boot): on first load, if `localStorage['held-tickets']` exists, push each entry through `window.api.heldTickets.add` and then clear the localStorage key. Idempotent: a second run finds no localStorage entry and no-ops.
- [ ] T089 [P9] Update consumers of `useHeldStore` in `src/renderer/src/modules/ventas/VentasPage.tsx` to call `loadFromDb()` on mount (or wrap the initial render in a Suspense-style loading state). The store retains its existing API so this is the only renderer change beyond ensuring the load happens.
- [ ] T090 [P9] Manually verify: (a) tickets persist across an Electron restart and across a `localStorage.clear()`, (b) backup + restore round-trip preserves them, (c) typecheck and lint pass.

**Checkpoint**: Held tickets are device-survivable and backup-protected.

---

## Round 2 Sequencing & Conservatism Notes

- **Order of execution**: P2 → P3 → P5 → P6 → P7 → P8 → P9. P3 should land before P9 so P9 can register itself as a numbered migration; if scheduling forces P9 first, the table-creation guard plus a follow-up backfill at P3 time covers it.
- **One commit per phase**: each phase's tasks are intentionally small enough to land in a single descriptive commit. The boundaries match the "Checkpoint" markers above.
- **Conservatism rule** (per the operator's instructions): when a task uncovers ambiguity (e.g., what should `mixed`-payment cancellation do to the credit portion?), the implementation makes the **safest** choice — usually "preserve existing behaviour, add a TODO comment with the file:line, document the limitation in the spec section being written" — rather than expanding scope mid-phase.
