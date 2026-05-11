# Phase 0 — Research

**Feature**: 002-review-fixes
**Purpose**: Resolve every design decision implied by the spec before Phase 1 writes contracts. No `NEEDS CLARIFICATION` markers remain after this document.

---

## 1. Legacy held tickets at migration time

**Decision**: Add `held_tickets.user_id` as a **nullable** column. Migration v6 backfills no value for existing rows. The repository's `listHeldTickets(userId)` filters with `WHERE user_id = ?`, which excludes the legacy `NULL` rows from every cashier's view. A follow-up cleanup migration (out of scope for this feature) can delete or reassign them once the merchant has had a release cycle to recover anything manually.

**Rationale**: Spec edge case explicitly forbids reassigning legacy tickets to whoever logs in next. A nullable column satisfies that and avoids inventing a sentinel user id (`0`, `-1`) that would either need a real row or special-cased everywhere. The "not visible to anyone" outcome falls out of the WHERE clause for free.

**Alternatives considered**:
- *Migration deletes legacy rows*: cleaner schema but irreversible if the merchant had work in flight; rejected for safety.
- *Migration assigns legacy rows to `users.id = 1` (typical bootstrap admin)*: violates spec edge case (silent reassignment to whoever happens to be admin); rejected.
- *Sentinel user id `0` with a synthetic users row*: pollutes the `users` table for legacy data; rejected.

---

## 2. Scope by `user_id` only — supervisors do not get cross-user visibility

**Decision**: Visibility is by `user_id` exact match. No role-based bypass. Even an administrator sees only their own held tickets.

**Rationale**: Held tickets are an in-progress sale, not a finalised artifact. Letting a supervisor finalise another cashier's in-progress sale would create an attribution problem (whose register, whose end-of-day total?). If the merchant later needs a recovery flow for orphaned tickets, that becomes its own feature with explicit attribution rules.

**Alternatives considered**:
- *Admin/supervisor sees everyone's held tickets*: convenient but causes the attribution problem above; merchant did not ask for it; rejected.
- *Supervisor can "claim" another user's held ticket via an explicit action*: out of scope per spec ("administration view... out of scope for this feature").

---

## 3. Mixed-payment cancellation audit row shape

**Decision**: The existing `action_logs` insert in `cancelSale` is extended. When the cancelled sale is mixed-payment, the `details` text encodes both the credit-portion amount and whether the refund was applied (e.g. `Venta #42 anulada — porción crédito $50,000 (devolución aplicada)` or `... (devolución NO aplicada por decisión del cajero)`). The `customers.balance` change (if any) is recorded the same way other refunds-to-balance are recorded today, by the same UPDATE pattern used for pure-credit cancellation.

**Canonical source for the credit portion**: the `sale_payments` table. The cancel path reads it with:
```sql
SELECT COALESCE(SUM(amount), 0) AS credit_portion
FROM sale_payments
WHERE sale_id = ? AND method = 'credit'
```
This mirrors the filter used by the existing sale-creation path (`createSale` line ~91, where `data.payments.filter(p => p.method === 'credit')` is summed before the customer's balance is bumped). Both `cancelSale` (server) and `VentaDetallePage` (renderer, for the modal's "porción crédito" display) read the same query so the displayed amount and the refunded amount are guaranteed to match.

**Rationale**: The spec assumption is explicit — "no new audit table is introduced". Reusing `action_logs.details` for the human-readable explanation and the existing customer-balance UPDATE for the money side keeps the change additive and avoids inventing a new shape that the rest of the system doesn't know how to render in reports.

**Alternatives considered**:
- *New `mixed_cancellation_audit` table*: violates the spec's no-new-table assumption; rejected.
- *Encode the decision in `sales.metadata`*: there is no `metadata` column on `sales`; adding one is a wider schema change than the spec authorises; rejected.

---

## 4. `cancelSale` backwards compatibility

**Decision**: `cancelSale(id, userId)` becomes `cancelSale(id, userId, options?: { refundMixedCredit?: boolean })`. The new parameter is optional, defaults to `false` (no refund). Existing call sites that already pass `(id, userId)` do not need to change; the only call site that needs the third parameter is the renderer's cancellation flow once the modal is added.

**Rationale**: Optional third parameter keeps the change additive on the function shape. The renderer modal is the only place that can answer the refund question, so only that path threads the value through.

**Alternatives considered**:
- *Two separate functions (`cancelSale` and `cancelMixedSale`)*: makes the IPC handler decide which one to call based on payment method — duplicates the dispatch logic and risks the two paths drifting; rejected.
- *Required parameter always passed from the renderer*: forces every existing call site to know about a flag that's only meaningful for mixed payments; rejected.

---

## 5. Recovery-mode atomicity (FR-012)

**Decision**: Move the recovery-mode decision *inside* the same `db.transaction()` that creates the user. The new repository function `createUserAtomicRecoveryCheck(payload)` re-reads the active admin count from the users table inside the transaction. If the count is zero, the new user is forced to role `admin` regardless of the requested role. After the insert, the count is re-read and `refreshRecoveryMode()` runs based on the post-insert state. The `users.ipc.ts` handler stops doing the pre-check entirely and calls this atomic function.

**Rationale**: SQLite's default isolation (DEFERRED transactions in WAL mode) is sufficient for this case because there is exactly one writer process (the main process). The transaction guarantees the count-and-insert is serialised with any concurrent count-and-insert call. The race the review identified can only fire if two IPC calls overlap before either has committed — the transaction wrapper closes that window.

**Alternatives considered**:
- *Use `BEGIN EXCLUSIVE`*: stronger than needed; would also serialise unrelated reads; rejected.
- *Use a process-level mutex around the recovery flow*: leaks state out of the DB; the DB already has the right serialisation primitive; rejected.
- *Fix it in `recovery.ts` instead of `auth.ts`*: the race is on the create path, not the read path; moving the check inside the create transaction is the correct location; rejected as misplaced.

---

## 6. Partial index on `held_tickets(user_id)`

**Decision**: No index. `WHERE user_id = ?` over a table of at most a few dozen rows is a sequential scan whether indexed or not, and SQLite query planner picks the right access path automatically.

**Rationale**: Premature optimisation per Principle VII. Held tickets are short-lived (cashier finalises or discards within minutes to hours). If the table ever grows past a few hundred rows we have bigger problems (held tickets are leaking) and the diagnostic is to look at the application, not to add an index.

**Alternatives considered**:
- *Partial index on `(user_id) WHERE user_id IS NOT NULL`*: small benefit, more schema to maintain; rejected.
- *Full index on `(user_id)`*: same; rejected.

---

## Open questions

None. Phase 1 can proceed.
