# Phase 1 — Data Model

**Feature**: 002-review-fixes
**Companion docs**: [research.md](research.md), [contracts/migration-v6.md](contracts/migration-v6.md), [contracts/ipc-changes.md](contracts/ipc-changes.md)

---

## Schema diff

### `held_tickets` — add nullable `user_id`

```sql
-- After migration v6
CREATE TABLE held_tickets (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  payload    TEXT NOT NULL,
  discount   INTEGER NOT NULL DEFAULT 0,
  user_id    INTEGER NULL REFERENCES users(id),   -- NEW
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

**Nullability**: `user_id` is NULL for any row that existed before migration v6 ran. Per FR-005 and the spec's edge-case section, NULL rows are not visible to any cashier; they are preserved in the database for one release cycle and may be reassigned or deleted by a follow-up migration.

**Fresh installs**: The `CREATE TABLE` in [src/main/db/schema.ts](../../src/main/db/schema.ts) is updated in the same edit so a brand-new database has the column from the start. The migration is then a no-op on fresh installs (the column already exists).

**No new index**: per [research.md](research.md) §6.

### `users`, `sales`, `purchase_orders`, `stock_adjustments`, `action_logs`

**No schema changes.** All other US/FR are wired through code, not schema:
- US2 (FR-006/007) changes which user id is passed *into* the existing `stock_adjustments.user_id` column.
- US3 (FR-008/009) writes a different `details` string into the existing `action_logs` row produced by `cancelSale`, and exercises the existing `customers.balance` update path.
- FR-011 (cancelPurchaseOrder transaction) is purely a code change.
- FR-012 (recovery-mode atomicity) is purely a code change.

---

## Repository query shapes

### `held-tickets.ts` (all signatures gain a `userId` parameter)

```ts
listHeldTickets(userId: number): HeldTicketRow[]
  // SELECT * FROM held_tickets WHERE user_id = ? ORDER BY created_at DESC

addHeldTicket(data: { id, label, payload, discount, userId }): HeldTicketRow
  // INSERT OR REPLACE INTO held_tickets (id, label, payload, discount, user_id)
  // VALUES (?, ?, ?, ?, ?)

removeHeldTicket(id: string, userId: number): void
  // Single transaction:
  //   1. const result = DELETE FROM held_tickets WHERE id = ? AND user_id = ?
  //   2. If result.changes === 0:
  //        - INSERT INTO action_logs (user_id, action, details)
  //          VALUES (userId, 'held_ticket_remove_denied',
  //                  'Held ticket {id} not found or not owned by user {userId}')
  //        - throw new Error('Held ticket not found or access denied')
  //          (the IPC handler lets this surface as a 5xx-equivalent to the renderer)
  // The guard from feature 001 only enforces ROLE membership for this channel.
  // OWNERSHIP is enforced here at the repository, and the FR-003 audit row is
  // written when the DELETE affects zero rows — covering both "ticket doesn't
  // exist" and "ticket belongs to someone else".

clearHeldTickets(userId: number): void
  // DELETE FROM held_tickets WHERE user_id = ?
  //   (used only by a developer-only utility today; no IPC channel exposes it)
```

### `purchases.ts` (signature change on `receivePurchaseOrder` and `cancelPurchaseOrder`)

```ts
receivePurchaseOrder(id: number, userId: number): PurchaseOrder
  // SELECT EXISTS(SELECT 1 FROM users WHERE id = ? AND active = 1) → must be 1
  //   (defense-in-depth; the auth guard already validates this)
  // Then the existing transaction body, with `auditUserId = userId` (not order.user_id, never 0)

cancelPurchaseOrder(id: number): PurchaseOrder
  // Now wrapped in db.transaction(() => { ... }) for consistency with the other
  // mutations in this file. No behaviour change beyond atomicity.
```

### `sales.ts` (signature change on `cancelSale`)

```ts
cancelSale(
  id: number,
  userId: number,
  options?: { refundMixedCredit?: boolean }
): Sale | null

  // Existing behaviour preserved for non-mixed payment methods.
  // For payment_method === 'mixed':
  //   - Compute creditPortion from sale_payments WHERE method = 'credit'
  //   - If options.refundMixedCredit === true:
  //       UPDATE customers SET balance = balance + creditPortion WHERE id = sale.customer_id
  //       action_logs.details = "Venta #N anulada — porción crédito $X (devolución aplicada)"
  //   - Else:
  //       no customer balance change
  //       action_logs.details = "Venta #N anulada — porción crédito $X (devolución NO aplicada por decisión del cajero)"
  //   Either path is recorded; the audit row is never silent.
```

### `users.ts` (new function for FR-012, next to existing `createUser`)

```ts
createUserAtomicRecoveryCheck(payload: NewUser): User
  // Single transaction:
  //   1. SELECT COUNT(*) FROM users WHERE active = 1 AND role = 'admin' AS adminCount
  //   2. effectiveRole = adminCount === 0 ? 'admin' : payload.role
  //   3. INSERT INTO users (..., role) VALUES (..., effectiveRole)
  //   4. (commit)
  // After the transaction returns, the caller (users.ipc.ts) invokes refreshRecoveryMode()
  // exactly once to update the in-memory flag from the post-insert state.
```

This replaces the current two-step pattern in `users.ipc.ts:42–45`:
```ts
// Before (racy):
const payload = isRecoveryMode() ? { ...data, role: 'admin' } : data
const created = usersQuery.createUser(payload)
refreshRecoveryMode()
```
```ts
// After (atomic):
const created = usersQuery.createUserAtomicRecoveryCheck(data)
refreshRecoveryMode()
```

---

## Entity-level invariants

| Invariant | Where it's enforced |
|---|---|
| **A held ticket is always owned by the user who created it** | `addHeldTicket` requires `userId`; the IPC handler reads `userId` from the auth session and never accepts it from the renderer. |
| **A held ticket is never visible to a non-owner** | `listHeldTickets` filters by `WHERE user_id = ?`. `removeHeldTicket` runs `DELETE … AND user_id = ?` and, when `changes === 0`, writes an `action_logs` row and throws — the rejection is never silent (FR-003). |
| **`stock_adjustments.user_id` is always a real, currently-active user** | `receivePurchaseOrder` validates `userId` against the users table at the top of the transaction; the IPC layer has already enforced this via the auth guard, but the repository layer enforces it again so a future caller cannot bypass it. |
| **Mixed-payment cancellation is never silent** | `cancelSale` writes an `action_logs` row with the explicit refund decision encoded in `details` whenever the original sale's payment method is `mixed`. |
| **At most one administrator is created in a recovery-mode race** | `createUserAtomicRecoveryCheck` does the count-and-insert in a single SQLite transaction; SQLite serialises overlapping write transactions on the main process. |
| **Purchase-order cancellation is atomic with any future side effects** | `cancelPurchaseOrder` wraps its UPDATE in `db.transaction()` — today this is symbolic (one UPDATE), but it pre-empts the next maintainer adding an audit row outside the transaction by mistake. |

---

## State transitions touched

- **Held ticket**: `created (by user X)` → `removed (by user X)` or `finalised (becomes a sale)`. No new states. The only change is the owner attribution at the `created` transition.
- **Purchase order**: existing `draft → received` and `draft → cancelled` transitions unchanged. The audit row written *at* the `received` transition now references the correct user.
- **Sale (mixed-payment)**: existing `completed → cancelled` transition is unchanged in mechanics; the side-effect on `customers.balance` becomes conditional on the user's explicit choice, and the `action_logs` row always reflects that choice.
- **Recovery mode**: no state transition change; the underlying check is wrapped in a transaction.
