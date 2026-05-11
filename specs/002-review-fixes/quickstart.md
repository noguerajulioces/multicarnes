# Quickstart — Round-2 Review Fixes

**Feature**: 002-review-fixes
**Audience**: QA / developer verifying the feature end-to-end before release.
**Time required**: ~20 minutes for the full pass, ~5 minutes if focused on a single user story.

> All checks below assume a packaged build (or `npm run dev` with the database from a real terminal copied in). A fresh empty DB does not exercise the migration path — see §2 specifically.

---

## 1. Held-tickets per-cashier isolation (US1)

**Setup**: at least two users with the `cashier` role exist in the `users` table (or one cashier and one admin — the test works the same either way).

**Steps**:

1. Log in as **Cashier A**.
2. Open the sales screen. Add two products to the cart. Click **Hold ticket**. Add a label like "Cliente Juan". The ticket appears in the held-tickets panel.
3. Add a different product. Hold again with label "Reposición". You now see two held tickets in the panel.
4. Log out.
5. Log in as **Cashier B**. Open the held-tickets panel.
   **Expected**: the panel shows **zero** tickets. Neither of Cashier A's tickets is visible.
6. As Cashier B, hold one ticket labelled "Cliente B".
7. Log out.
8. Log in as **Cashier A** again. Open the held-tickets panel.
   **Expected**: Cashier A sees **only** their original two tickets ("Cliente Juan" and "Reposición"). Cashier B's "Cliente B" is not visible.
9. As Cashier A, finalise "Cliente Juan" as a normal sale.
10. **Expected**: the sale's `user_id` and the cash-movement attribution are Cashier A's id (verified via the dashboard's today-sales-by-user breakdown, or by a DB query: `SELECT user_id FROM sales WHERE id = <new sale id>`).

**Failure modes to watch for**:
- Cashier B sees Cashier A's tickets → US1 broken (the SELECT filter is wrong).
- Cashier B can finalise Cashier A's ticket via the API → US1.AC3 broken (`removeHeldTicket` not enforcing `AND user_id = ?`).
- Logging out wipes the ticket from the DB → US1.AC5 broken (logout flow is deleting instead of just clearing the UI).

**Cross-user removal attempt (FR-003 audit)**:

A. While Cashier B is logged in (after step 5 above), note the id of one of Cashier A's held tickets (look up from the DB or from Cashier A's prior screenshot). Then from the renderer dev-tools console run:
```js
await window.api.heldTickets.remove('<one of cashier A’s ticket ids>')
```
**Expected**: the call rejects with an error visible to the renderer (toast or rejection in the promise chain). The targeted ticket still exists in the DB.

B. Confirm the rejection is auditable:
```sql
SELECT user_id, action, details, created_at
FROM action_logs
WHERE action = 'held_ticket_remove_denied'
ORDER BY id DESC LIMIT 5;
```
**Expected**: a row exists with `user_id = <Cashier B's id>` and `details` containing the targeted ticket id.

---

## 2. Migration v6 on a populated database

**Setup**: a copy of a real terminal's `pos.db` from a pre-002 build, with at least one row in `held_tickets`.

**Steps**:

1. Note the existing row count: `SELECT COUNT(*) FROM held_tickets;` → call it `N`.
2. Start the new build pointing at this DB.
3. Confirm the migration ran exactly once:
   ```sql
   SELECT version, name FROM schema_migrations WHERE version = 6;
   ```
   **Expected**: one row, `6 | add_held_tickets_user_id`.
4. Confirm the column exists and is nullable:
   ```sql
   PRAGMA table_info(held_tickets);
   ```
   **Expected**: a row `cid=4 name=user_id type=INTEGER notnull=0`.
5. Confirm legacy rows are preserved with NULL ownership:
   ```sql
   SELECT COUNT(*) FROM held_tickets WHERE user_id IS NULL;
   ```
   **Expected**: count == `N`.
6. Log in as any user. Open the held-tickets panel.
   **Expected**: zero tickets visible (the legacy rows are not attributed to anyone, so no user sees them).
7. Stop the app, restart, log in again.
   **Expected**: migration does not re-run (`SELECT version FROM schema_migrations WHERE version = 6` still returns exactly one row).
8. The same row count from step 1 is still present in `held_tickets` (no legacy data was deleted).

**Failure modes to watch for**:
- Migration re-runs and creates a duplicate ledger row → idempotency check is wrong.
- Legacy rows assigned to a real user → the migration is silently reassigning ownership (forbidden by spec edge case).
- Legacy rows visible to one user → the filter is missing the `WHERE user_id = ?` and the legacy rows happen to match.

---

## 3. Purchase reception audit attribution (US2)

**Setup**: at least one admin (User A) and one supervisor (User B). Both users active.

**Steps**:

1. Log in as **Admin A**. Create a purchase order with two line items (e.g. 10 kg sirloin, 5 kg ribeye). Save in `draft` status. Note the order id `O`.
2. Log out.
3. Log in as **Supervisor B**. Open the purchase order list, locate order `O`, and confirm reception.
4. After reception completes, run:
   ```sql
   SELECT product_id, user_id, reason
   FROM stock_adjustments
   WHERE reason = 'Recepción compra #' || <O>
   ORDER BY id DESC
   LIMIT 5;
   ```
   **Expected**: every row's `user_id` is **Supervisor B's** id, **not** Admin A's, and never `0`.
5. Verify the product stocks increased by the received quantities.
6. Verify the order is now in `received` status.

**Edge case — deactivated creator**:
1. Repeat steps 1–2 above, then deactivate Admin A (from the users administration screen, while logged in as a different admin).
2. Reactivate Supervisor B if needed and have them confirm reception.
3. Repeat step 4.
   **Expected**: same outcome — Supervisor B's id, never Admin A's (deactivated), never `0`.

**Failure modes to watch for**:
- `stock_adjustments.user_id` = order creator's id → US2 broken (the `auditUserId = order?.user_id ?? 0` fallback is still in place).
- `stock_adjustments.user_id` = `0` → US2 broken and a foreign key violation should have stopped the transaction (suggests the FK is missing or relaxed).

---

## 4. Mixed-payment cancellation (US3)

**Setup**: an active customer with a non-zero (or zero) balance. A supervisor or admin role available for the cancellation step (cashiers cannot cancel sales per feature 001 §US2).

**Steps**:

1. Log in as **Cashier A**. Create a sale for the customer with total $100,000: $50,000 cash + $50,000 on credit. Confirm the sale. Verify the customer's balance increased by $50,000.
2. Log out, log in as **Supervisor B**.
3. Open the sales list, find the sale, open the detail view, click **Cancel**.
   **Expected**: a modal opens showing the cash portion ($50,000), the credit portion ($50,000), and asks "¿Devolver la porción de crédito al saldo del cliente?" with two clear options.

**Path A — refund chosen**:
4a. Click **Devolver crédito**.
5a. **Expected**: the sale moves to `cancelled`. The customer's balance decreases by $50,000 (back to its pre-sale value). The `action_logs` table has a row matching `Venta #<id> anulada — porción crédito $50.000 (devolución aplicada)`.

**Path B — refund declined**:
4b. (Repeat steps 1–3 with a new sale.) Click **No devolver**.
5b. **Expected**: the sale moves to `cancelled`. The customer's balance is **unchanged** (still reflects the $50,000 added by the original sale). The `action_logs` row matches `Venta #<id> anulada — porción crédito $50.000 (devolución NO aplicada por decisión del cajero)`.

**Edge case — deactivated customer**:
4c. (Repeat steps 1–3 with a new sale.) Before opening the cancel modal, deactivate the customer from the customers admin screen. Re-open the cancel flow on the same sale.
5c. **Expected**: the modal still opens with both portions shown. Choosing "Devolver crédito" updates the deactivated customer's balance the same way any other balance adjustment to a deactivated customer would; the cancellation completes without an error. Choosing "No devolver" completes the cancellation without touching the balance.

**Regression check — non-mixed sales unchanged**:
6. Create a sale paid entirely in cash. Cancel it.
   **Expected**: no modal appears. The cancel succeeds immediately. The customer balance is unchanged.
7. Create a sale paid entirely on credit (existing customer balance flow). Cancel it.
   **Expected**: no modal appears. The cancel succeeds immediately. The customer balance is reduced by the sale total (existing behaviour).

**Failure modes to watch for**:
- Modal appears on cash-only or pure-credit cancellations → flow detection is wrong.
- Path B silently leaves the credit in the customer's balance without an `action_logs` row → FR-009 broken.
- Path A applies the refund but writes no audit row → FR-009 broken in the other direction.

---

## 5. Recovery-mode atomicity (FR-012)

**Setup**: not testable by hand reliably. Covered by the logic-level smoke test extension. See [scripts/auth-smoke.ts](../../scripts/auth-smoke.ts).

**Logic-level test to add**:

```
1. Seed an empty users table.
2. In two concurrent promises, both call createUserAtomicRecoveryCheck()
   with payload { name: 'A', role: 'cashier' } and { name: 'B', role: 'cashier' }.
3. Await both.
4. Read SELECT role, name FROM users.
5. Assert: exactly one user has role 'admin' (the one whose transaction ran first).
6. Assert: the other user has role 'cashier' (recovery mode closed after the first insert).
```

A single-threaded harness in Node does not exercise the SQLite serialisation, so the test is asserting on the recovery-mode logic, not on the locking primitive itself. The locking primitive is exercised in production by SQLite's WAL-mode write serialisation.

**Failure modes to watch for**:
- Both users get `role: 'admin'` → the recovery check is still outside the transaction.
- Neither user gets `role: 'admin'` → the recovery check misfires (should be impossible if seed is empty).

---

## 6. Purchase-order cancellation transaction wrapping (FR-011)

**Setup**: a purchase order in `draft` status.

**Steps**:

1. Cancel the purchase order from the UI.
2. Verify the status moves to `cancelled`.
3. There is no observable behaviour change; this fix is structural. Confirm via code review that the `cancelPurchaseOrder` function in `src/main/db/queries/purchases.ts` is wrapped in `db.transaction(() => { ... })`.

This step exists in the quickstart so the reviewer remembers to look; it does not require any user-facing action.

---

## Summary checklist

- [ ] §1 — Held tickets isolated per cashier across two-user handover.
- [ ] §2 — Migration v6 applied exactly once on a populated DB, legacy rows preserved.
- [ ] §3 — Purchase reception audit attribution is the receiver, never the creator, never 0.
- [ ] §4 Path A — Mixed cancellation refunds credit when chosen.
- [ ] §4 Path B — Mixed cancellation does NOT refund and writes audit row when declined.
- [ ] §4 Regression — Non-mixed cancellations behave exactly as before.
- [ ] §5 — Recovery-mode atomicity test added and passing.
- [ ] §6 — `cancelPurchaseOrder` wrapped in `db.transaction()`.
