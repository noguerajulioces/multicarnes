# E2E Test Plan — POS Multicarnes

**Audience**: QA engineers, Claude Code agents adding new specs, reviewers.
**Last updated**: 2026-05-10.
**Companion**: [README.md](README.md) for the harness + conventions.

The plan is organized by module. Each test has the same shape:

> **Name** — concise behaviour stated as an assertion.
> **Preconditions** — what state the app must be in before the test starts.
> **Steps** — the user-visible actions the test takes.
> **Expected outcome** — what passes/fails the assertion.
> **Priority** — P1 (must run on every PR), P2 (must run before each release), P3 (good-to-have, run weekly).

## Coverage map

| Module | P1 | P2 | P3 | Total |
|---|---|---|---|---|
| Auth / login / recovery | 4 | 2 | 1 | 7 |
| Authorization (IPC guard) | 3 | 2 | 0 | 5 |
| Held tickets (US1 of 002) | 2 | 1 | 0 | 3 |
| Sales — POS happy path | 1 | 4 | 1 | 6 |
| Sales — cancellation (US3 of 002) | 3 | 1 | 0 | 4 |
| Sales — listing & filters | 0 | 2 | 1 | 3 |
| Cash register | 1 | 3 | 1 | 5 |
| Customers | 0 | 4 | 2 | 6 |
| Products | 0 | 3 | 2 | 5 |
| Purchases (US2 of 002) | 2 | 2 | 1 | 5 |
| Reports | 1 | 1 | 2 | 4 |
| Users management | 1 | 2 | 1 | 4 |
| Backup | 0 | 2 | 1 | 3 |
| Settings & profile | 0 | 1 | 2 | 3 |
| Auth audit & alerts (US4 of 001) | 1 | 1 | 0 | 2 |
| **Total** | **19** | **31** | **15** | **65** |

The boot spec (already shipped in `boot.spec.ts`) is implicitly P1 — it gates every other test.

---

## 1. Auth / login / recovery

### auth-1-1 — Recovery flow surfaces on empty database (P1)

**Preconditions**: Fresh app launch, no users in DB.
**Steps**:
1. Launch app via `launchApp()`.
**Expected**: The login page shows the "Configurar primer administrador" form with fields for Nombre, PIN, Confirmar PIN.

### auth-1-2 — Recovery setup creates the first admin (P1)

**Preconditions**: Recovery form visible (no users).
**Steps**:
1. Fill `Nombre` = "Admin Test".
2. Fill `PIN` = "111111".
3. Fill `Confirmar PIN` = "111111".
4. Click `Crear administrador`.
**Expected**: Form is replaced by the user-selection login screen, and one user button ("Admin Test") is visible.

### auth-1-3 — Successful login as admin lands on dashboard (P1)

**Preconditions**: One active admin user exists, login screen visible.
**Steps**:
1. Click the admin's avatar button.
2. Enter PIN "111111".
3. Submit.
**Expected**: User is redirected to `/` (dashboard). The sidebar shows admin-only sections (Usuarios, Configuración, Backup).

### auth-1-4 — Wrong PIN shows an error and the user remains on the PIN screen (P1)

**Preconditions**: Login screen visible with an admin user.
**Steps**:
1. Click admin avatar.
2. Enter PIN "000000".
3. Submit.
**Expected**: An error message appears ("PIN incorrecto" or similar) and the URL is still the login screen.

### auth-1-5 — Logout returns to login screen and clears in-memory state (P2)

**Preconditions**: Admin is logged in on the dashboard.
**Steps**:
1. Click "Cerrar sesión" in the sidebar.
**Expected**: The login screen is shown again. Held tickets are NOT visible (held store reset on logout — FR-005).

### auth-1-6 — Deactivated user cannot log in (P2)

**Preconditions**: A cashier exists with `active = 0` (deactivated via admin UI in a prior test step).
**Steps**:
1. Click the cashier's avatar.
**Expected**: The avatar button is not rendered (only active users appear) — or, if shown, the login attempt is rejected.

### auth-1-7 — Recovery re-opens when the last admin is deactivated (P3)

**Preconditions**: One admin and one cashier exist; admin is logged in.
**Steps**:
1. As admin, navigate to Usuarios.
2. Deactivate self (or another admin via a parallel test).
**Expected**: Within one IPC round-trip the dashboard surfaces the recovery state. (Note: in practice the admin would be logged out first. This is a hardening check, mark as fragile if flaky.)

---

## 2. Authorization (IPC guard, feature 001)

### authz-2-1 — Cashier cannot create a user (P1)

**Preconditions**: Admin + cashier exist. Cashier is logged in.
**Steps**:
1. From the renderer, call `window.api.users.create({ name: 'X', role: 'cajero', pin: '123456' })` via `ipc()`.
**Expected**: The promise rejects with an authorization error. An `auth_audit` row with `operation = 'users:create'`, `resolved_role = 'cajero'`, `outcome = 'blocked-insufficient-role'` exists.

### authz-2-2 — Cashier cannot trigger backup:restore (P1)

**Preconditions**: Cashier logged in.
**Steps**:
1. Call `window.api.backup.restore()` via `ipc()`.
**Expected**: Promise rejects; audit row recorded.

### authz-2-3 — Cashier sees products list without cost or margin fields (P1)

**Preconditions**: Cashier logged in. At least one product seeded by admin with `last_purchase_cost > 0`.
**Steps**:
1. Call `window.api.products.getAll({})` via `ipc()`.
**Expected**: Each product object has no `cost`, no `margin`, no `last_cost` field (US3 of 001).

### authz-2-4 — Supervisor can cancel a sale but cashier cannot (P2)

**Preconditions**: Supervisor + cashier exist. One completed sale exists.
**Steps**:
1. As cashier, call `window.api.sales.cancel(saleId)` → expect rejection.
2. As supervisor, call same → expect success.
**Expected**: First call rejects with audit row `outcome=blocked-insufficient-role`; second call succeeds; sale status flips to `cancelled`.

### authz-2-5 — `users:update` self-or-roles: cashier can read own profile but not another's (P2)

**Preconditions**: Cashier A and Cashier B exist. A is logged in.
**Steps**:
1. Call `window.api.users.getById(A.id)` → expect success.
2. Call `window.api.users.getById(B.id)` → expect rejection.
**Expected**: First succeeds; second rejects with `blocked-insufficient-role` audit row.

---

## 3. Held tickets — US1 of feature 002 (per-cashier privacy)

### held-3-1 — Cashier B does not see Cashier A's held tickets (P1)

**Preconditions**: Admin + Cashier A + Cashier B exist; all active.
**Steps**:
1. Login as Cashier A.
2. `ipc()` add two held tickets ("Cliente Juan", "Reposición").
3. Logout.
4. Login as Cashier B.
5. `ipc()` call `held:list`.
**Expected**: Cashier B sees `[]`. SC-001 satisfied.

### held-3-2 — Cashier A's tickets persist across logout/login (P1)

**Preconditions**: Continuation of held-3-1 — Cashier B is logged in with zero tickets.
**Steps**:
1. As Cashier B, add one held ticket ("Cliente B").
2. Logout.
3. Login as Cashier A.
4. `ipc()` call `held:list`.
**Expected**: Cashier A sees only their original two tickets (Juan + Reposición). FR-004 satisfied (logout did not delete).

### held-3-3 — Cross-user remove writes an `action_logs` row and throws (P2)

**Preconditions**: Cashier A has held ticket `T`. Cashier B is logged in.
**Steps**:
1. As Cashier B, call `window.api.heldTickets.remove(T.id)` via `ipc()`.
**Expected**: Promise rejects with "Held ticket not found or access denied". A row in `action_logs` exists with `action = 'held_ticket_remove_denied'` and `user_id = B.id`. FR-003 satisfied.

---

## 4. Sales — POS happy path

### sales-4-1 — Cash sale completes and writes the audit chain (P1)

**Preconditions**: Cashier logged in, cash register open, one product seeded with stock 10.
**Steps**:
1. Search for the product in the POS.
2. Add 2 units to the cart.
3. Open the payment modal.
4. Choose "Efectivo".
5. Confirm payment.
**Expected**: Sale is created (`sales` row with `status = 'completed'`, `payment_method = 'cash'`); 2 units deducted from stock (assert via IPC); a `stock_adjustments` row with `reason = 'Venta #N'` exists; cash movement is recorded.

### sales-4-2 — Sale on credit increases customer balance (P2)

**Preconditions**: Cashier logged in, register open, customer with balance 0.
**Steps**:
1. Add product to cart.
2. Open payment modal, choose "Crédito (Fiado)", pick the customer.
3. Confirm.
**Expected**: Sale `payment_method = 'credit'`. Customer balance equals the sale total.

### sales-4-3 — Mixed payment splits between cash and credit (P2)

**Preconditions**: Cashier logged in, register open, customer with balance 0.
**Steps**:
1. Add product to cart total ≥ ₲100,000.
2. Open payment modal, split ₲50,000 cash + ₲50,000 credit.
3. Confirm.
**Expected**: Sale `payment_method = 'mixed'`; `sale_payments` has two rows (cash ₲50,000 + credit ₲50,000); customer balance = 50,000.

### sales-4-4 — Cannot create a sale when no register is open (P2)

**Preconditions**: Cashier logged in, register CLOSED.
**Steps**:
1. Attempt to invoke `sales:create` via `ipc()`.
**Expected**: Rejection with the P2 guard message ("No hay caja abierta" or similar). No `sales` row written.

### sales-4-5 — Hold ticket then resume completes the sale (P2)

**Preconditions**: Cashier logged in, register open.
**Steps**:
1. Add 2 products to cart.
2. Click "Suspender" / Hold.
3. Open the held-tickets modal.
4. Click "Reanudar" on the same ticket.
5. Pay in cash.
**Expected**: Final sale matches the held cart's items and total. The held ticket is removed (server returns zero rows for that user).

### sales-4-6 — Ticket print is invoked on cash sale completion (P3)

**Preconditions**: Cashier logged in, printer NOT configured (we just assert the channel is called, not the actual print).
**Steps**:
1. Complete a cash sale.
**Expected**: `print:ticket` was invoked (verify by polling `print:hasConfig` or by spying via a render-side hook).

---

## 5. Sales — cancellation (US3 of feature 002)

### sales-cancel-5-1 — Cancelling a pure-cash sale restocks and writes audit (P1)

**Preconditions**: Supervisor logged in, one completed cash sale exists for product X (stock now N), customer balance unchanged.
**Steps**:
1. Open `/ventas/:id`.
2. Click `Anular`.
3. Confirm the dialog.
**Expected**: Sale status = `cancelled`, product X stock back to N + sold_qty, customer balance unchanged, an `action_logs` row with `action = 'cancel_sale'` is present.

### sales-cancel-5-2 — Mixed cancellation: refund applied returns credit to customer (P1)

**Preconditions**: Supervisor logged in. One mixed sale exists (₲50k cash + ₲50k credit). Customer balance = ₲50,000.
**Steps**:
1. Open `/ventas/:id`.
2. Click `Anular`.
3. Modal opens: assert it shows ₲50,000 / ₲50,000 split.
4. Click `Devolver crédito`.
**Expected**: Customer balance decreases to ₲0. `action_logs.details` contains "(devolución aplicada)".

### sales-cancel-5-3 — Mixed cancellation: refund declined preserves customer balance (P1)

**Preconditions**: Like 5-2.
**Steps**:
1. Open `/ventas/:id`.
2. Click `Anular`.
3. Click `No devolver`.
**Expected**: Customer balance stays at ₲50,000. `action_logs.details` contains "(devolución NO aplicada por decisión del cajero)".

### sales-cancel-5-4 — Cashier cannot cancel any sale (P2)

**Preconditions**: Cashier logged in. One completed sale exists.
**Steps**:
1. Navigate to `/ventas/:id`.
**Expected**: The `Anular` button is NOT rendered (visible only to admin / supervisor).

---

## 6. Sales — listing & filters

### sales-list-6-1 — Filter by payment method narrows the result (P2)

**Preconditions**: Supervisor logged in; one cash + one credit + one mixed sale exist.
**Steps**:
1. Open `/ventas`.
2. Filter "Crédito".
**Expected**: Only the credit sale is visible.

### sales-list-6-2 — Filter by date range excludes older sales (P2)

**Preconditions**: Sales exist with `created_at` in two different days.
**Steps**:
1. Set "Desde" / "Hasta" to today only.
**Expected**: Only today's sales are shown.

### sales-list-6-3 — Pagination shows correct totals (P3)

**Preconditions**: 75 sales seeded.
**Steps**:
1. Open `/ventas`.
2. Click page 2.
**Expected**: Page 2 shows 25 rows (50 per page assumed).

---

## 7. Cash register

### cash-7-1 — Open register with ₲0 confirmation required (P1)

**Preconditions**: Cashier logged in, no active register.
**Steps**:
1. Navigate to `/caja`.
2. App redirects to `/caja/apertura`.
3. Submit with amount = ₲0.
4. Confirm the dialog.
**Expected**: Register is now open with `opening_amount = 0`.

### cash-7-2 — Cashier can close their own register (P2)

**Preconditions**: Cashier opened a register.
**Steps**:
1. Navigate to `/caja`.
2. Click "Cerrar Caja". (Note: the button is gated; cashier-self exception)
3. Enter counted amount.
4. Submit.
**Expected**: Register status flips to `closed`.

### cash-7-3 — Cashier cannot close another cashier's register (P2)

**Preconditions**: Cashier A opens a register; Cashier B logs in.
**Steps**:
1. As Cashier B, attempt `cash:close(registerA.id, ...)` via `ipc()`.
**Expected**: Rejection (`blocked-insufficient-role` per the cashier-self check). Register stays open.

### cash-7-4 — Movement (income/expense) updates the summary (P2)

**Preconditions**: Register is open.
**Steps**:
1. Add an income of ₲50,000 with description "Ajuste".
**Expected**: The summary shows ₲50,000 in income.

### cash-7-5 — Stale-close requires a note (P3)

**Preconditions**: Register opened >24h ago (simulated by manipulating `opened_at`).
**Steps**:
1. Open close form.
**Expected**: Notes field is required; the submit button is disabled until filled.

---

## 8. Customers

### customer-8-1 — Create customer with required name passes validation (P2)

**Preconditions**: Supervisor logged in.
**Steps**:
1. Open `/clientes`.
2. Click "Nuevo Cliente".
3. Fill only "Nombre".
4. Submit.
**Expected**: Customer appears in the list.

### customer-8-2 — Create customer with employee flag tags it (P2)

**Preconditions**: Supervisor logged in.
**Steps**:
1. As above, additionally tick "Es empleado".
**Expected**: List shows an "Empleado" badge.

### customer-8-3 — Cannot delete a customer with sales history (P2)

**Preconditions**: A customer has 1 completed sale on credit.
**Steps**:
1. Click delete on the customer.
**Expected**: Toast shows the rejection reason; customer is NOT deleted.

### customer-8-4 — Register payment decreases balance (P2)

**Preconditions**: Customer has balance ₲100,000.
**Steps**:
1. Open ficha; click "Registrar Pago"; enter ₲40,000.
**Expected**: Balance drops to ₲60,000.

### customer-8-5 — Delete payment refunds the balance (P3)

**Preconditions**: Customer has 1 payment of ₲40,000; balance = ₲60,000.
**Steps**:
1. Edit the payment; click "Eliminar".
**Expected**: Balance is back to ₲100,000.

### customer-8-6 — Cashier cannot access customer CRUD (P3)

**Preconditions**: Cashier logged in.
**Steps**:
1. Confirm sidebar does NOT list "Clientes".
2. Confirm direct navigation to `/clientes` redirects or shows a permission message.
**Expected**: Cashier is blocked.

---

## 9. Products

### product-9-1 — Create product with required fields (P2)

**Preconditions**: Supervisor logged in.
**Steps**:
1. `/productos/nuevo`.
2. Fill Nombre, Categoría, Precio, Tipo unidad.
3. Submit.
**Expected**: Product visible in `/productos`.

### product-9-2 — Adjust stock writes a `stock_adjustments` row (P2)

**Preconditions**: Product with stock 10 exists.
**Steps**:
1. Click adjust icon.
2. New stock = 15, motivo = "Inventario".
**Expected**: Product stock = 15. A `stock_adjustments` row with `quantity_before=10`, `quantity_after=15`, `reason='Inventario'` exists.

### product-9-3 — Stock adjustment by cashier is blocked (P2)

**Preconditions**: Cashier logged in.
**Steps**:
1. Call `products:adjustStock` via `ipc()`.
**Expected**: Rejection. No row written.

### product-9-4 — Low-stock filter shows only flagged products (P3)

**Preconditions**: Two products: one with stock 0 (low), one with stock 100.
**Steps**:
1. Toggle "Stock bajo".
**Expected**: Only the stock-0 product is shown.

### product-9-5 — Cashier viewing product detail does not see cost / margin / stats (P3)

**Preconditions**: Cashier logged in.
**Steps**:
1. Navigate to `/productos/:id`.
**Expected**: The "Stock movements", "Recent sales", "Sales stats", "Last purchase" sections are empty/hidden (Promise.allSettled handling).

---

## 10. Purchases — US2 of feature 002

### purchase-10-1 — Receiving a purchase order attributes audit to the receiver (P1)

**Preconditions**: Admin creates a PO with 2 items. Supervisor will receive it.
**Steps**:
1. As supervisor, navigate to `/compras/:id`.
2. Click "Marcar como recibida".
**Expected**: `stock_adjustments` rows have `user_id = supervisor.id` (NOT admin.id, NOT 0). Stock totals increase by received qty. PO status = `received`.

### purchase-10-2 — Receiving with a deactivated user is rejected (P1)

**Preconditions**: A supervisor is logged in but their account has been deactivated mid-session via a parallel admin call.
**Steps**:
1. Call `purchases:receive(id)` via `ipc()`.
**Expected**: Rejection (`blocked-inactive`) BEFORE any DB mutation.

### purchase-10-3 — Cancelled PO transitions atomically (P2)

**Preconditions**: PO in `draft` status. Supervisor logged in.
**Steps**:
1. Open `/compras/:id`.
2. Click "Cancelar".
3. Confirm.
**Expected**: PO status = `cancelled`. No partial state visible mid-call.

### purchase-10-4 — Create supplier from purchases shortcut (P2)

**Preconditions**: Supervisor on `/proveedores`.
**Steps**:
1. Click "Nuevo Proveedor".
2. Fill required name.
**Expected**: Supplier in list.

### purchase-10-5 — Adding the same product twice to a PO is prevented (P3)

**Preconditions**: New PO form.
**Steps**:
1. Add product A.
2. Try to add product A again.
**Expected**: Add is rejected or the row's qty is updated (whichever the implementation does).

---

## 11. Reports

### report-11-1 — Cashier cannot open profit-margin report (P1)

**Preconditions**: Cashier logged in.
**Steps**:
1. Confirm sidebar does not show "Reportes" OR navigate manually and assert blocked.
2. Also test `ipc()` call to `reports:profitMargin` — expect rejection.
**Expected**: Profit-margin not surfaced; audit row written.

### report-11-2 — Sales summary returns expected aggregations (P2)

**Preconditions**: 3 sales with known totals exist for today.
**Steps**:
1. Open `/reportes` → Resumen.
2. Date range = today.
**Expected**: `totals.sales_count = 3`, `totals.total = expected_sum`.

### report-11-3 — Top products lists the right product (P3)

**Preconditions**: One product sold 5×, another sold 1×.
**Steps**:
1. Reports → Productos.
**Expected**: First row is the higher-revenue product.

### report-11-4 — Export to Excel produces a file (P3)

**Preconditions**: Reports tab with data; export button visible.
**Steps**:
1. Click "Exportar a Excel".
**Expected**: A file save dialog or download triggers (this is hard to assert headlessly — mark fragile).

---

## 12. Users management

### users-12-1 — Admin creates a new cashier and the cashier appears in the login screen (P1)

**Preconditions**: Admin logged in.
**Steps**:
1. `/usuarios` → "Nuevo Usuario".
2. Fill name "Caja 1", rol "Cajero", PIN "222222".
3. Submit.
4. Logout.
**Expected**: Login screen shows "Admin" + "Caja 1".

### users-12-2 — Cannot create user with mismatched PIN confirmation (P2)

**Preconditions**: Admin logged in, "Nuevo Usuario" modal open.
**Steps**:
1. PIN "222222", Confirmar "333333", submit.
**Expected**: Error message under the form; user is NOT created.

### users-12-3 — Cashier cannot open the users page (P2)

**Preconditions**: Cashier logged in.
**Steps**:
1. Confirm sidebar does not show "Usuarios"; manual nav to `/usuarios` is blocked.
**Expected**: Cashier is blocked.

### users-12-4 — Deactivating a user removes them from the login list (P3)

**Preconditions**: Admin + one cashier exist; both active.
**Steps**:
1. Admin edits cashier; unchecks "Activo"; saves.
2. Logout.
**Expected**: Cashier no longer appears on the login screen.

---

## 13. Backup

### backup-13-1 — Admin creates a backup and the file appears in the list (P2)

**Preconditions**: Admin logged in.
**Steps**:
1. `/backup` → "Crear Backup".
**Expected**: A new entry appears in the list with size and timestamp.

### backup-13-2 — Restore confirmation requires explicit acknowledgement (P2)

**Preconditions**: A backup file exists.
**Steps**:
1. Click "Restaurar desde archivo".
2. Pick the backup file.
3. Confirm dialog: "Esto reemplazará la base de datos actual...".
**Expected**: Restore proceeds only after confirmation. Cancel keeps DB unchanged.

### backup-13-3 — Cashier cannot access backup page (P3)

**Preconditions**: Cashier logged in.
**Steps**:
1. Confirm sidebar lacks "Backup"; manual nav blocked.
**Expected**: Cashier is blocked.

---

## 14. Settings & profile

### settings-14-1 — Admin changes business name and it persists across reload (P2)

**Preconditions**: Admin logged in.
**Steps**:
1. `/configuracion` → set "Nombre del negocio" = "Multicarnes Test".
2. Reload (close app + relaunch with same userDataDir — needs harness extension).
**Expected**: Setting persists.

### settings-14-2 — User changes own PIN via profile (P3)

**Preconditions**: Admin logged in.
**Steps**:
1. `/perfil` → "Cambiar PIN".
2. Old PIN "111111", new PIN "112233", confirm "112233".
3. Submit.
**Expected**: Logout → re-login with the new PIN succeeds.

### settings-14-3 — User cannot change PIN with wrong current PIN (P3)

**Preconditions**: As above.
**Steps**:
1. Old PIN "999999", new "112233", confirm "112233".
**Expected**: Error message; PIN unchanged.

---

## 15. Auth audit & alerts (US4 of feature 001)

### audit-15-1 — Five rapid blocked attempts raise an alert visible to admin (P1)

**Preconditions**: Admin + cashier exist. Cashier logged in.
**Steps**:
1. As cashier, call `users:create` via `ipc()` six times consecutively (each one blocked).
2. Logout, login as admin.
3. Navigate to dashboard.
**Expected**: An `AuthAlertsBanner` row says "repeated authorization failures from {cashier name}".

### audit-15-2 — Admin acknowledges the alert and it disappears (P2)

**Preconditions**: Continuation of 15-1.
**Steps**:
1. Click "Marcar visto" on the banner row.
**Expected**: Row is removed from the open-alerts list.

---

## Test execution order

Tests within a spec file run serially (Playwright config `fullyParallel: false`). Spec files themselves are independent and can run in any order — each launches its own Electron app with a fresh DB.

Roughly:

```
boot.spec.ts           ← already shipped
auth.spec.ts           ← auth-1-*, auth-1-7
authorization.spec.ts  ← authz-2-*, audit-15-*
held-tickets.spec.ts   ← held-3-*
sales-cancellation.spec.ts ← sales-cancel-5-*
sales-happy-path.spec.ts   ← sales-4-*
sales-list.spec.ts     ← sales-list-6-*
cash-register.spec.ts  ← cash-7-*
customers.spec.ts      ← customer-8-*
products.spec.ts       ← product-9-*
purchases.spec.ts      ← purchase-10-* (covers US2 of 002)
reports.spec.ts        ← report-11-*
users.spec.ts          ← users-12-*
backup.spec.ts         ← backup-13-*
settings.spec.ts       ← settings-14-*
```

## Out of scope

- **Hardware paths**: thermal printer (`print:ticket`), `print:hasConfig` — no printer in CI.
- **Auto-update**: requires a real GitHub release + a packaged installer.
- **File pickers**: `pickImage`, `selectFolder`, `backup:restore` file-picker — Electron dialogs are not driveable by Playwright. Wrap these flows with a test-mode IPC that bypasses the dialog if/when we need coverage.
- **Native UI menus**: app menubar, system tray, dock menu.
