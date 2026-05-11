# Feature Specification: Round-2 Code Review Fixes

**Feature Branch**: `002-review-fixes`
**Created**: 2026-05-10
**Status**: Draft
**Input**: User description: "Round-2 review fixes — user_id=0 in purchase reception, held tickets not cleared on logout, mixed-credit cancellation UX"

## Background

A code review of the round-2 cleanups surfaced three correctness defects that are not visible to end users today but degrade audit accuracy, leak data across user sessions, and silently lose customer credit when sales are cancelled. None of them are theoretical: each can be reproduced in the current build by simply switching users, receiving a purchase, or cancelling a specific class of sale. This feature closes those three gaps so that the round-2 work can be released without known correctness debt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A cashier's held tickets stay private to that cashier (Priority: P1)

A cashier puts a customer's in-progress sale on hold (the customer stepped away, a return is being looked up, the manager is being called). When that cashier logs out and a different cashier logs in on the same terminal, the second cashier does not see the first cashier's held tickets, cannot accidentally finalize a sale that does not belong to them, and cannot read the first cashier's customer or product selection. When the first cashier logs back in, their held tickets are still there.

**Why this priority**: Held tickets are now persisted in the shared database (a P9 cleanup that moved them out of per-user localStorage). The persistence change was correct, but the multi-user scoping was not added. The current state allows any logged-in cashier on the terminal to see and finalize tickets created by any other cashier, which is both a privacy issue and a real risk of a sale being charged to the wrong customer or attributed to the wrong cashier in end-of-day reports.

**Independent Test**: Cashier A logs in, creates two held tickets (one with a customer, one without), and logs out. Cashier B logs in and opens the held-tickets panel. Cashier B sees no held tickets. Cashier B creates one held ticket and logs out. Cashier A logs in: cashier A sees only their original two tickets, not cashier B's.

**Acceptance Scenarios**:

1. **Given** cashier A has two held tickets and is logged out, **When** cashier B logs in, **Then** the held-tickets panel shows zero tickets.
2. **Given** cashier B has held tickets and is logged out, **When** cashier A logs in, **Then** cashier A sees their own held tickets and none of cashier B's.
3. **Given** cashier A has held tickets and logs out, **When** the same cashier A logs back in later, **Then** all of cashier A's held tickets are still available.
4. **Given** an administrator is logged in, **When** the administrator opens the held-tickets panel, **Then** the administrator sees only their own held tickets (the administrator is not a privileged observer of other users' tickets).
5. **Given** cashier A is logged in and has held tickets, **When** cashier A logs out, **Then** the held tickets are retained in the database (not deleted) but are no longer visible to other users.

---

### User Story 2 — Purchase reception attributes the audit row to the receiving user (Priority: P1)

When a purchase order is created by one user (typically an administrator who placed the order with the supplier) and later received by a different user (typically a supervisor or admin on the floor who checks the goods in), the stock-adjustment audit row that records the increase in inventory is attributed to the user who **received** the goods, not to the user who created the order. The audit row is always attributed to a real, currently-active user; it is never attributed to user id `0`, the deactivated user who placed the order, or a "system" placeholder.

**Why this priority**: The stock-adjustment audit log is the only ledger that explains *why* inventory changed and *who* is accountable for the change. If a discrepancy is found later (the count is wrong, an item was substituted, the wrong quantity was received), the merchant relies on this attribution to investigate. Today the audit row is attributed to whoever created the purchase order, which can be days or weeks earlier, sometimes a user who has since been deactivated, and in the corner case where the order record is unreadable, to the literal user id `0` — which violates the foreign key to the users table and breaks the transaction outright.

**Independent Test**: Administrator A creates a purchase order with three items. Supervisor B receives the same order. After reception, the three new rows in the stock-adjustments table all reference supervisor B's user id, not administrator A's, and not `0`.

**Acceptance Scenarios**:

1. **Given** administrator A created a purchase order and supervisor B is now receiving it, **When** supervisor B confirms reception, **Then** every stock-adjustment row created by the reception references supervisor B's user id.
2. **Given** the user who originally created a purchase order has since been deactivated and a different active user is now receiving the order, **When** reception is confirmed, **Then** the stock-adjustment rows reference the receiving user, the reception succeeds, and the deactivated user is not referenced anywhere in the new audit rows.
3. **Given** the user receiving a purchase order is not authorized to receive purchases, **When** the reception is attempted, **Then** the reception is rejected by the authorization layer (per feature 001) before any database mutation occurs and no stock-adjustment rows are written.
4. **Given** reception is confirmed by a valid user, **When** the database transaction completes, **Then** the order status moves to `received`, the product stock totals increase by the received quantities, and the audit rows are present — all in the same atomic transaction.

---

### User Story 3 — Cancelling a mixed-payment sale handles the credit portion explicitly (Priority: P2)

When a sale was paid partly in cash (or another tender) and partly on customer credit, and that sale is later cancelled, the credit portion that was charged to the customer's running balance is not silently lost. The cashier or supervisor performing the cancellation is shown what the credit portion was, given a clear path to either refund the credit to the customer's balance or leave the balance as-is, and an audit row records which choice was made and by whom.

**Why this priority**: This affects money owed by or to customers, but only fires when a mixed-payment sale is cancelled — which is a small fraction of cancellations. The bug is real (the credit portion is silently retained in the customer's balance with no offsetting entry, leaving the customer's ledger out of sync with what actually happened), but the volume is low and a careful supervisor can already work around it manually by editing the customer's balance. P2 reflects "fix soon, not blocking release".

**Independent Test**: A sale is created with $50 cash and $50 on credit. The customer's balance afterward is $50 owed. The sale is cancelled. The cancellation flow surfaces the $50 credit portion explicitly. After the cancellation choice is made, the customer's balance and an audit row reflect that choice consistently.

**Acceptance Scenarios**:

1. **Given** a sale paid partly in cash and partly on credit exists, **When** an authorized user opens the cancellation flow, **Then** the user sees the cash portion, the credit portion, and a clear question about whether to refund the credit portion to the customer's balance.
2. **Given** the user chooses to refund the credit portion, **When** the cancellation is confirmed, **Then** the customer's balance decreases by the credit portion, an audit row records the refund, and the sale status moves to `cancelled`.
3. **Given** the user chooses NOT to refund the credit portion (the customer has already absorbed the loss, or the credit will be settled outside the system), **When** the cancellation is confirmed, **Then** the customer's balance does not change, an audit row records "credit portion intentionally not refunded by {user}", and the sale status moves to `cancelled`.
4. **Given** a sale paid entirely in cash (no credit portion) is cancelled, **When** the cancellation flow runs, **Then** no credit-portion question is shown (the flow is unchanged from today for non-mixed sales).
5. **Given** a sale paid entirely on credit is cancelled, **When** the cancellation flow runs, **Then** the credit portion is refunded automatically as it is today (no behavior change for pure-credit sales).

---

### Edge Cases

- **Held tickets created before this feature ships**: any held tickets already in the database have no user attribution (the schema and the IPC layer did not capture the owner). On first load after upgrade, those legacy tickets are not visible to any user; they are preserved in the database for one release cycle so a supervisor can audit them manually if needed, then removed by a follow-up migration. They are never silently reassigned to whoever happens to log in next.
- **Held ticket created by a user who is later deactivated**: the ticket remains in the database but is not visible to anyone in the held-tickets panel; a supervisor can see and reassign it from a dedicated administration view if the team needs to recover the customer's selection (this administration view is out of scope for this feature).
- **Purchase order received in two passes (partial reception)**: if partial reception is added in a future feature, each pass attributes its own stock-adjustment rows to the user who confirmed that pass. This feature only covers single-pass reception, matching the current implementation.
- **Mixed-payment cancellation when the customer has been deactivated**: the cancellation flow still surfaces the credit-portion question; if the user chooses to refund, the refund is recorded against the deactivated customer's balance the same way any other credit adjustment to a deactivated customer would be (the deactivation does not block the refund).
- **Recovery mode triggered while a held ticket exists**: held tickets owned by deleted/missing users do not block recovery mode; recovery mode operates only on the users table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each held ticket MUST record the user id of the cashier who created it at the moment the ticket is held.
- **FR-002**: The held-tickets list returned to a logged-in user MUST contain only tickets owned by that same user.
- **FR-003**: Finalising or deleting a held ticket MUST be rejected if the requesting user is not the owner of the ticket. The rejection MUST raise an error visible to the caller (not a silent no-op) and MUST persist an `action_logs` row capturing the attempt (acting user, target ticket id). Recording into feature 001's `auth_audit` table is out of scope; `action_logs` is the business audit log already used by `cancelSale` and is sufficient for the merchant-investigation use case.
- **FR-004**: Logging out MUST NOT delete the logged-out user's held tickets; their persistence is unaffected by session changes.
- **FR-005**: A user logging in MUST see only their own held tickets, regardless of which user was logged in last on the same terminal.
- **FR-006**: Receiving a purchase order MUST attribute every stock-adjustment row produced by the reception to the user who confirmed the reception, not to the user who created the order.
- **FR-007**: The system MUST reject any attempt to write a stock-adjustment row with no user attribution (a null or `0` user id is not acceptable); the operation MUST fail before any database mutation rather than silently using a placeholder user.
- **FR-008**: Cancelling a sale whose payment method involved both cash (or any non-credit tender) and customer credit MUST prompt the cancelling user to choose whether to refund the credit portion to the customer's balance before the cancellation is committed.
- **FR-009**: The choice made in FR-008 MUST be recorded in an audit row that captures the sale id, the credit portion amount, the cancelling user, and whether the refund was applied.
- **FR-010**: Cancellation of sales paid entirely in cash, entirely on credit, or by any other single-tender method MUST behave exactly as it does today (no UX or balance change).
- **FR-011**: Cancellation of any purchase order MUST run inside a single database transaction so that the status change and any related audit rows commit or roll back together. *(Addresses the medium-severity inconsistency surfaced by the review: `cancelPurchaseOrder` currently runs outside a transaction.)*
- **FR-012**: When the user creation flow runs in recovery mode (zero active administrators), the check for "are we in recovery mode" and the creation of the new administrator MUST happen inside a single atomic operation so that two simultaneous recovery-mode creations cannot both succeed. *(Addresses the medium-severity race surfaced by the review on `users.ipc.ts:42`.)*

### Key Entities *(include if feature involves data)*

- **Held ticket**: A snapshot of an in-progress sale (selected products, quantities, optional customer) that a cashier set aside to resume later. Now scoped to a single owning user.
- **Stock-adjustment row**: An audit-grade record that documents a change in product stock, including the user who caused the change and a human-readable reason. Required to always reference a real, identifiable user.
- **Mixed-payment sale cancellation record**: An audit row that documents how a mixed-payment cancellation handled the credit portion (refunded or intentionally retained), including the cancelling user and the amount in question.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero held tickets are visible across user sessions in a two-cashier handover test (cashier A creates tickets, cashier B logs in, cashier B sees zero of cashier A's tickets).
- **SC-002**: One hundred percent of stock-adjustment rows produced by a purchase reception reference the user who performed the reception, verified across at least one reception cycle per receiving role (admin and supervisor) plus the deactivated-creator edge case — three receptions minimum.
- **SC-003**: Zero stock-adjustment rows are persisted with user id `0` or any other non-existent user reference, verified by a database query at any point after this feature ships.
- **SC-004**: All distinct mixed-payment cancellation branches (refund applied, refund declined, deactivated customer) result in the customer's balance and the audit log being consistent with the explicit choice made by the cancelling user.
- **SC-005**: Two simultaneous attempts to create the first administrator in recovery mode result in exactly one administrator being created (not two), verified by a logic-level concurrency test.

## Assumptions

- The user attribution required by FR-001 and FR-006 is read from the authenticated session established by feature 001 (Server-side Authorization for Privileged Operations); this feature does not introduce a new identity mechanism.
- Held tickets created by users who do not exist in the current `users` table (e.g. a user that was hard-deleted in a development snapshot) are treated as orphaned and not shown to any cashier; the merchant accepts that those tickets are recoverable only by direct database inspection if at all.
- A "mixed payment" sale is any sale whose payment record involves more than one tender where at least one tender is `credit`. The exact list of non-credit tenders (cash, card, transfer, voucher) follows the current implementation and is not redefined here.
- The audit row format for the new credit-portion-cancellation entry follows the same schema as other financial audit rows already produced by the cancellation flow, with one additional field indicating whether the refund was applied; no new audit table is introduced.
- This feature does not introduce a held-tickets administration view for supervisors; orphaned or other-user tickets are out of scope and will be addressed (if needed) by a separate feature.
- The recovery-mode atomicity in FR-012 is bounded to the in-process renderer/main pair on a single terminal; the application is single-instance per machine and does not need to coordinate across multiple Electron processes.
