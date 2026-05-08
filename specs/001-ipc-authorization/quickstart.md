# Quickstart — Manual Verification

Pre-conditions:

- Fresh build of the app or a checkout where the feature is implemented.
- A clean `pos.db` (rename or move the existing one for the duration of the test).

The recipe walks through every spec acceptance scenario in order. Each section ends with **expected**; if the observed result differs, log a defect.

---

## Setup A — Fresh recovery flow (US5)

1. Launch the app with no `pos.db` present.
2. The login page must show the first-run admin-creation form.
3. Create admin `admin1` / PIN `111111`.

**Expected**:

- Login screen accepts admin1 immediately afterward.
- `auth:recoveryNeeded` returns `false` from this point on.
- A second user can be created from the Usuarios screen as supervisor or cajero.

---

## Setup B — Three users present

After Setup A:

1. Log in as admin1.
2. Create `super1` / PIN `222222` / role `supervisor`.
3. Create `caja1` / PIN `333333` / role `cajero`.
4. Log out.

---

## Test 1 — US1 / SC-002 — Cashier cannot escalate to admin actions

1. Log in as `caja1`.
2. From the dev console (Cmd-Option-I in dev) issue:

   ```js
   await window.api.users.create({ name: 'evil', role: 'admin', pin: '999999' })
   ```

   **Expected**: rejected. Toast says "No tenés permiso para realizar esta acción". Users list still has 3 users.

3. Issue:

   ```js
   await window.api.backup.restore()
   ```

   **Expected**: rejected. The file picker does not open. `pos.db` is unchanged.

4. Issue:

   ```js
   await window.api.settings.set('business_name', 'Hacked')
   ```

   **Expected**: rejected. `business_name` is unchanged.

5. Issue:

   ```js
   await window.api.users.update(super1Id, { active: 0 })
   ```

   **Expected**: rejected. super1 is still active.

---

## Test 2 — US2 / SC-003 — Cashier cannot perform financial mutations

Pre-condition: have `caja1` open a register at 09:00 (cash apertura).

1. Log out, log in as super1, open a separate register (oh wait — there can only be one open register at a time per [cash.ts:5-6](../../src/main/db/queries/cash.ts#L5-L6)). Skip this step on a single-terminal test; instead simulate by setting up two terminals or by closing caja1's register first.

For the single-terminal flow:

1. Log in as caja1, open a register.
2. Make a sale.
3. Log out, log in as caja1 again (same user).
4. Issue:

   ```js
   await window.api.sales.cancel(saleId, ctxUserId)
   ```

   **Expected**: rejected. Sale stays `completed`. Customer balance unchanged.

5. Issue:

   ```js
   await window.api.cash.close(registerId, 0, 'forced', caja1Id)
   ```

   **Expected**: this **succeeds** because caja1 owns the register. Document the success in the test log. (The cashier-self path of FR-011.)

6. Reopen a session as caja1.
7. Log out, log in as super1.
8. Issue `cash:close` against a register caja1 just opened — **expected**: succeeds (supervisor allowed regardless of owner).

---

## Test 3 — US3 / SC-004 — Cashier cannot see margin

1. Log in as `caja1`.
2. Navigate to a product detail screen.
3. **Expected**: no "Costo última compra" or "Margen" rows visible. The KPI card for last cost is absent. (The handler strips those fields when role=cajero.)
4. Open dev tools and call:

   ```js
   await window.api.reports.profitMargin()
   ```

   **Expected**: rejected. Toast appears.
5. Log in as super1; same call **succeeds** and returns rows with cost and margin.

---

## Test 4 — US4 / SC-005 / SC-006 — Audit & repeated-failure alert

Continuing as caja1:

1. Trigger 6 blocked operations in quick succession (e.g., 6× `users.create`).
2. Wait < 10 minutes.
3. Log in as admin1.
4. Open the dashboard.
5. **Expected**: a banner says "Repeated authorization failures from caja1 (6 in last 10 minutes)" with an "Acknowledge" button.
6. Click "Acknowledge".
7. Reload dashboard.
8. **Expected**: banner gone.
9. Open the new "Authorization audit" page (or query directly):

   ```js
   await window.api.auth.listAuditEntries({ userId: caja1Id, outcome: 'blocked-insufficient-role' })
   ```

   **Expected**: at least 6 rows; each carries operation name, role `cajero`, timestamp.

---

## Test 5 — Edge: deactivated user mid-session

1. Log in as super1.
2. From the Usuarios screen, mark super1 inactive — wait, that's self-deactivation; do this from admin1 instead. Log in as admin1, deactivate super1.
3. The super1 client (separate window not realistic in single-terminal — substitute by simulating via the same window):
   - Log out, log in as super1: **expected**: login fails (already inactive).

To verify the **mid-session** rule, the cleanest path is:

1. Log in as super1.
2. Open dev tools and pause the renderer (e.g., set a breakpoint before the next IPC call).
3. From a second admin client (or by editing the DB directly during the pause):

   ```sql
   UPDATE users SET active = 0 WHERE id = ?super1Id;
   ```

4. Resume; trigger any privileged operation (e.g., `customers:getAll`).
5. **Expected**: rejected with `blocked-inactive` outcome; audit row written.

---

## Test 6 — Edge: role demoted mid-session

Same trick:

1. Log in as super1.
2. Pause the renderer or use a second admin client.
3. From admin1, demote super1 to cajero.
4. Resume; super1 attempts `customers:create`.
5. **Expected**: rejected with `blocked-insufficient-role` outcome (the new role doesn't allow it).

---

## Test 7 — Self-update of own PIN still works

1. Log in as super1.
2. Open Perfil page.
3. Change PIN.
4. **Expected**: succeeds. Audit row records `outcome=allowed`, `operation=users:update`.

But:

5. From dev tools, attempt:

   ```js
   await window.api.users.update(super1Id, { role: 'admin' })
   ```

   **Expected**: rejected by handler-level field check (the rule is `self-or-roles` with admin; super1 is `self` here, but the handler refuses to change `role` from `self`). Audit row records `outcome=allowed` (the rule passed) but the handler returned an application error — the test log should note both.

---

## Test 8 — Recovery flow doesn't leak privilege

1. Stop the app; manually delete all admins from the DB:

   ```sql
   UPDATE users SET active = 0 WHERE role = 'admin';
   ```

2. Restart the app.
3. **Expected**: recovery form appears. The login picker is hidden.
4. Try, in dev tools:

   ```js
   await window.api.backup.restore()
   ```

   **Expected**: rejected. Recovery doesn't grant privilege; it only allows `users:create` for an admin.

5. Create new admin `admin2`.
6. Reload.
7. **Expected**: login picker reappears; `auth:recoveryNeeded` now returns `false`.

---

## Test 9 — Startup self-test

Edit `src/main/auth/matrix.ts` and **remove** an entry (e.g., delete the `customers:getAll` line). Build and launch.

**Expected**: the app refuses to start; an error dialog appears: "Authorization matrix is incomplete: 1 channel(s) missing — customers:getAll." This proves FR-008 fail-closed default and the structural backstop.

Restore the entry to pass the next launch.

---

## Pass criteria

All 9 tests pass per the **Expected** notes. Any "rejected" path also produces an audit row with the matching outcome. Total time: ~30 minutes for a developer who knows the app.
