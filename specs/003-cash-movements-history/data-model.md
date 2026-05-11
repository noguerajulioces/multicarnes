# Data Model: Cash Movements History

**Feature**: 003-cash-movements-history
**Date**: 2026-05-11

This document captures the column-level schema diff applied by migration v7, the shape of synthetic backfill rows, the void linkage, and the expected query shapes for `listMovements` and `voidMovement`.

## Existing `cash_movements` table

For reference, the v6 schema is ([src/main/db/schema.ts:69-77](../../src/main/db/schema.ts#L69-L77)):

```sql
CREATE TABLE cash_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

`amount` is stored as integer guaraníes (no decimals — same convention as `sales.total`, `cash_registers.opening_amount`, etc.). `created_at` is a localtime string (consistent with the rest of the schema; see Constitution-aligned convention).

## Schema diff (v7)

Two changes:

### Diff 1 — Broaden the `type` CHECK constraint

**From:** `CHECK(type IN ('income','expense'))`
**To:** `CHECK(type IN ('income','expense','opening','closing','void'))`

Implemented via the recreate-and-swap pattern documented in [contracts/migration-v7.md](contracts/migration-v7.md). Existing rows are preserved bit-for-bit (only the constraint changes).

### Diff 2 — Add `void_of` nullable FK

```sql
ALTER TABLE cash_movements ADD COLUMN void_of INTEGER NULL REFERENCES cash_movements(id);
```

- `void_of` is `NULL` for every regular row (manual income, manual expense, opening, closing).
- `void_of` is set exactly once, at insert time, when the row is of type `'void'`. It points to the original `cash_movements.id` being cancelled.
- Originals are never updated. The "is this row voided?" flag is computed at read time as `EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = m.id)`. This keeps the table strictly append-only and avoids a denormalized boolean that could drift out of sync.

### Diff 3 — Composite index

```sql
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);
```

Justification in [research.md §4](research.md#4-indexing-strategy).

## Final schema (post-v7)

```sql
CREATE TABLE cash_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  void_of     INTEGER NULL REFERENCES cash_movements(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);
```

`src/main/db/schema.ts` is updated so a fresh install lands on the v7 shape directly without going through the migration (matches the precedent set by [held_tickets.user_id](../../src/main/db/schema.ts#L172) for feature 002).

## Synthetic opening/closing rows

The v7 migration backfills synthetic rows from `cash_registers` so the page is useful for historical sessions on day one.

### Opening row (one per `cash_registers` row)

| Column         | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| `register_id`  | `cash_registers.id`                                                   |
| `user_id`      | `cash_registers.user_id` (the cashier who opened the session)         |
| `type`         | `'opening'`                                                           |
| `amount`       | `cash_registers.opening_amount` (always positive)                     |
| `description`  | `'Apertura de caja'`                                                  |
| `void_of`      | `NULL`                                                                |
| `created_at`   | `cash_registers.opened_at` (preserves the original timestamp)         |

### Closing row (one per *closed* `cash_registers` row only)

| Column         | Value                                                                                          |
|----------------|------------------------------------------------------------------------------------------------|
| `register_id`  | `cash_registers.id`                                                                            |
| `user_id`      | `cash_registers.user_id`                                                                       |
| `type`         | `'closing'`                                                                                    |
| `amount`       | `cash_registers.closing_amount` (counted cash at close)                                        |
| `description`  | `'Cierre de caja'` + optional difference note if `cash_registers.difference <> 0`               |
| `void_of`      | `NULL`                                                                                         |
| `created_at`   | `cash_registers.closed_at`                                                                     |

The synthetic rows are inserted only when no row of that type already exists for the register (idempotency guard on re-run — see migration contract).

## Ongoing synthetic emission

After v7, the `cash` query module emits synthetic rows directly from the operational flow:

- [`openCashRegister(userId, openingAmount)`](../../src/main/db/queries/cash.ts#L3-L12) — after inserting the `cash_registers` row, inserts a corresponding `'opening'` row in `cash_movements` in the same transaction.
- [`closeCashRegister(id, closingAmount, ...)`](../../src/main/db/queries/cash.ts#L43-L126) — after the `UPDATE cash_registers SET status='closed'`, inserts a `'closing'` row in `cash_movements` in the same transaction.

Both functions are already in the query layer (Principle III), so the change is invisible to callers. No new public function signatures.

## Query shapes

### `listMovements(opts, ctx)`

Located in the new file `src/main/db/queries/cash-movements.ts`.

**Input shape:**

```ts
interface ListOpts {
  from?: string        // ISO date 'YYYY-MM-DD', inclusive
  to?: string          // ISO date 'YYYY-MM-DD', inclusive
  types?: CashMovementType[]  // subset of ['income','expense','opening','closing','void']
  userId?: number      // cashier filter (honored when ctx.role is admin/supervisor)
  registerId?: number  // session filter
  search?: string      // case-insensitive substring on description
  page?: number        // 1-indexed; default 1
  perPage?: number     // default 25, max 100
}
interface ListCtx {
  callerUserId: number
  callerRole: 'admin' | 'supervisor' | 'cajero'
}
```

**Authorization scoping inside the query (FR-015, FR-017):**

```ts
// When the caller is a cajero, force user_id = callerUserId regardless of opts.userId.
const effectiveUserId = ctx.callerRole === 'cajero' ? ctx.callerUserId : opts.userId
```

This logic lives in the query function, not the IPC handler, so any future caller (including tests) cannot bypass it by skipping the handler.

**Return shape:**

```ts
interface CashMovementRow {
  id: number
  registerId: number
  userId: number
  userName: string          // joined from users
  type: CashMovementType
  amount: number            // integer Gs.; sign follows row meaning
  description: string
  createdAt: string
  isVoided: boolean         // computed: EXISTS inverse with void_of = id
  voidedBy: number | null   // id of the inverse if voided; else null
  voidOf: number | null     // for rows of type='void': id of the original
  registerStatus: 'open' | 'closed'  // joined from cash_registers, used for nav target
}

interface CashMovementListResult {
  items: CashMovementRow[]
  total: number
  page: number
  perPage: number
}
```

The shape is intentionally identical to `getAllSales` so the renderer pagination control built for ventas-listado is reusable.

**SQL skeleton:**

```sql
SELECT
  cm.id, cm.register_id, cm.user_id, u.name AS user_name,
  cm.type, cm.amount, cm.description, cm.created_at,
  cm.void_of,
  EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id) AS is_voided,
  (SELECT v.id FROM cash_movements v WHERE v.void_of = cm.id LIMIT 1) AS voided_by,
  cr.status AS register_status
FROM cash_movements cm
LEFT JOIN users u ON cm.user_id = u.id
LEFT JOIN cash_registers cr ON cm.register_id = cr.id
WHERE 1=1
  /* conditional clauses for from/to/types/userId/registerId/search */
ORDER BY cm.created_at DESC
LIMIT ? OFFSET ?;
```

The COUNT query mirrors the same WHERE clause without `ORDER BY` / `LIMIT`.

### `voidMovement(originalId, actorUserId)`

Located in the new file `src/main/db/queries/cash-movements.ts`.

**Validations (in order):**

1. Load the original row. If not found → throw `'Movimiento no encontrado.'`.
2. If `original.type IN ('opening','closing')` → throw `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'` (FR-022).
3. If `original.type = 'void'` → throw `'No se puede anular una anulación.'` (FR-023).
4. If an inverse already exists (`SELECT 1 FROM cash_movements WHERE void_of = ?`) → throw `'Este movimiento ya fue anulado.'` (FR-025).
5. Inside a single transaction:
   - Insert a row with `type = 'void'`, `void_of = originalId`, `amount = original.amount`, `description = '[ANULACIÓN] ' || original.description`, `register_id = original.register_id`, `user_id = actorUserId`, `created_at` defaults to `datetime('now','localtime')`.
   - Insert into `auth_audit` (`operation='cashMovements:void'`, `resolved_user_id=actorUserId`, `resolved_role`, `outcome='allowed'`).
   - Insert into `action_logs` (`user_id=actorUserId`, `action='void_cash_movement'`, `details=JSON_STRING({ original_id, inverse_id })`).
6. Return the newly inserted row in the same shape as `CashMovementRow`.

**Atomicity.** Steps 5.1–5.3 share one `db.transaction(...)` call; partial state (inverse without audit, audit without inverse) cannot exist.

**Effect on `cash_registers` totals.** None directly. The void affects the cash-register summary indirectly through the same code path that consumers already use ([getCashRegisterSummary](../../src/main/db/queries/cash.ts#L157-L203)): the summary sums `income - expense` from `cash_movements`. A void of an income produces a row with `type='void'` which is *not* counted by the existing summary query. To keep historic totals invariant for already-closed sessions (FR-022, US3 acceptance scenario 3), the summary's sum is updated to include void rows with the opposite sign of their voided original — that adjustment is part of the work captured in this feature's tasks.

## Type aliases

Added to `src/shared/types.ts`:

```ts
export type CashMovementType = 'income' | 'expense' | 'opening' | 'closing' | 'void'

export interface CashMovementRow { /* shape above */ }
export interface CashMovementListResult { /* shape above */ }
export interface CashMovementListOpts { /* shape above */ }
```

These are imported by both the renderer (for filter UI typing and table props) and the main process (for the query function and IPC handler).

## Validation rules (referenced by FRs)

| Rule | Source | Enforcement point |
|---|---|---|
| `amount > 0` | existing (no zero or negative movements) | `addCashMovement` (existing); void path inherits via `original.amount` |
| `description` non-empty | existing | `addCashMovement` (existing) |
| Only manual `income`/`expense` are voidable | FR-022, FR-023 | `voidMovement` step 2 + 3 |
| A movement is voided at most once | FR-025 | `voidMovement` step 4; protected by the absence of any unique constraint on `void_of` does **not** guarantee uniqueness — the runtime check is the source of truth, the transaction prevents the race, and the production load (manual void clicks) makes concurrent inserts on the same `void_of` not a realistic race outside the test suite. |
| Cashier sees own rows only | FR-015, FR-017 | `listMovements` query parameter override |
| Void requires admin/supervisor | FR-018 | Matrix entry `cashMovements:void` (`privileged`, roles=admin/supervisor) |

## State transitions

A `cash_movements` row has two effective states from a business-logic perspective:

```
CREATED ──(admin voids)──> VOIDED
   │
   └──(never)──> DELETED   ← prohibited (Principle VI, FR-021)
```

The transition is one-way; once voided, the row stays voided. A second void attempt on the same original is rejected. The "voided" condition is computed from the existence of an inverse row, so the transition is fully expressed by inserting that inverse — no UPDATE on the original.

## Out-of-scope schema concerns

- **Closing of an open register that already has a void on it.** Closing logic is unchanged; the void affects the cash-summary read path, not the closing computation.
- **Customer credit reconciliation when an income that paid down a credit gets voided.** Outside this feature; the customer credit module is unaffected because voiding a manual cash movement is independent from `customer_payments`.
- **Migrating already-voided-via-database-hack movements** (e.g., someone deleted a row in the past). Such rows simply won't appear; the page reports current state.
