# Research: Cash Movements History

**Feature**: 003-cash-movements-history
**Date**: 2026-05-11
**Status**: Resolved — 5 decisions, 0 outstanding.

This document records design decisions made during Phase 0 of the planning workflow. Each section follows the format: **Decision** → **Rationale** → **Alternatives considered**.

---

## §1. Table strategy: extend `cash_movements` vs. introduce a new table

**Decision.** Extend the existing `cash_movements` table. Broaden the `type` CHECK constraint from `IN ('income','expense')` to `IN ('income','expense','opening','closing','void')`, and add one nullable column `void_of INTEGER NULL REFERENCES cash_movements(id)`.

**Rationale.** The new page needs a *unified timeline* with one ordering, one paginator, and one set of filters. Splitting opening/closing balances into a separate table would force a UNION ALL at every query site, double the index footprint, and make the void linkage straddle two tables. Extending `cash_movements` keeps the data model coherent with how the rest of the cash module already reads from it (see [getCashRegisterSummary](../../src/main/db/queries/cash.ts#L157-L203), [closeCashRegister](../../src/main/db/queries/cash.ts#L43-L126)) and lets the existing `register_id`/`user_id`/`created_at` columns carry the same meaning for the new row types without renaming anything.

**Alternatives considered.**

- *New `cash_register_balances` table for opening/closing only.* Rejected: produces a UNION ALL on every listing, and the per-row "who created it" attribution is already redundant with `cash_registers.user_id` for openings — duplicating it in a second table opens a consistency hole.
- *New `cash_journal` view that materializes a unified row set.* Rejected: SQLite views in better-sqlite3 are fine for reads but cannot be filtered + paginated with parameterized binding as cleanly as a real table; we would lose `LIMIT/OFFSET` predicate pushdown and have to materialize the view at query time.
- *Keep two queries (movements + register summaries) and merge in the renderer.* Rejected: violates the layered-data-access principle (the renderer would assemble a domain object), and pagination becomes ill-defined when the merge happens after `LIMIT`.

---

## §2. Broadening the `CHECK` constraint on `cash_movements.type`

**Decision.** Use the standard SQLite "recreate-and-swap" pattern: create `cash_movements_new` with the new CHECK, copy all rows over, drop the old table, rename the new one, recreate indexes/foreign-key references. Wrap the entire sequence in a single transaction inside the v7 migration body, guarded by an idempotency check that verifies the new CHECK is already in place (read `sql` from `sqlite_master` and grep for the new tokens).

**Rationale.** SQLite does not support `ALTER TABLE ... ALTER COLUMN` or `DROP CONSTRAINT`. The recreate-and-swap is the canonical, supported path and is exactly what frameworks like Alembic emit for SQLite. The migration is short (≈20 lines of SQL), runs in a transaction, and the idempotency guard makes a second run a no-op. We already use `PRAGMA table_info` checks for column-level idempotency in [migrations v1, v2, v6](../../src/main/db/index.ts) — this extends the same pattern to constraints.

**Alternatives considered.**

- *Drop the CHECK entirely and enforce types in the application layer.* Rejected: the existing CHECK is a useful safety net against typos in the query layer (the same reason every other table in the schema uses CHECK on enum-shaped columns: `users.role`, `sales.payment_method`, `sales.status`, `cash_registers.status`). Removing it would create a silent gap.
- *Use SQLite 3.45+ `ALTER TABLE ... DROP CONSTRAINT`.* Rejected: this is technically supported in modern SQLite but the better-sqlite3 binding shipping with Electron pins to an older library version; we would have to bump the native module, which falls under Constitution Principle I gating.
- *Keep the old CHECK and store opening/closing/void in a sibling column like `subtype`.* Rejected: makes every read site `WHERE type = 'income' AND subtype IS NULL` to distinguish manual from synthetic income rows — a worse shape for both readers and indexes.

---

## §3. Backfill: synthetic opening/closing rows from existing `cash_registers`

**Decision.** Backfill at migration time. For every row in `cash_registers`, insert a synthetic row into `cash_movements` of type `'opening'` (amount = `opening_amount`, `created_at` = the register's `opened_at`, `user_id` = the register's owner), and if the register is closed, also insert a `'closing'` row (amount = `closing_amount`, `created_at` = the register's `closed_at`, `user_id` = the register's owner). Both rows reference the register via `register_id` like any other movement.

**Rationale.** The shop owner's stated motivation (FR-001, SC-001, SC-007) is to reconcile *historical* cash movements — most of the value of the feature is in being able to see what happened *last week*, not what happens *next week*. A migration that only emits synthetic rows for new sessions would make the page nearly empty on day one and lose the audit trail of every session closed before the migration date. The cost is low: the backfill is a single `INSERT ... SELECT` per row type, runs inside the same migration transaction, and the data already exists in `cash_registers` — the backfill is a denormalization for query convenience, not a fact creation.

We also explicitly do **not** broadcast these synthetic rows back into `cash_registers.opening_amount` / `closing_amount` — those columns remain the system of record for the open/close UX. The synthetic rows in `cash_movements` are an additive read-side projection. The void operation is forbidden on opening/closing rows (FR-022) precisely because they are projections of authoritative data living elsewhere; voiding them would create an inconsistency between the two tables.

**Alternatives considered.**

- *No backfill — only sessions opened after v7 get rows.* Rejected: SC-002 ("100% of manual ingreso and egreso entries are retrievable through the new page, including those from already-closed cash register sessions") would fail on day one for opening/closing. Manual ingreso/egreso rows already exist in `cash_movements` and so are unaffected, but openings/closings would not be — producing an incomplete timeline for older sessions.
- *Compute synthetic rows on-read by UNION ALL with `cash_registers`.* Rejected: see §1 — kills paginator predicate pushdown.
- *Run the backfill as a background job after the migration.* Rejected: introduces a transient state where the page is wrong; cash data is small enough (sessions are in the low thousands at the upper end) that the migration completes in well under a second.

---

## §4. Indexing strategy

**Decision.** Add one composite index: `CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created ON cash_movements(register_id, created_at DESC)`. Do not add a per-user index; cashier-scoping is enforced in the handler (the matrix entry is `privileged` with all three roles) and the additional `AND user_id = ?` predicate runs against the small per-register slice that the composite index already produces.

**Rationale.** The dominant query shape is:

```sql
SELECT ... FROM cash_movements
WHERE date(created_at) BETWEEN ? AND ?
  AND (register_id = ? OR ? IS NULL)
  AND (user_id    = ? OR ? IS NULL)
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

The composite `(register_id, created_at)` index serves the most selective branch (filter by session) cleanly. The wildcard "all sessions in date range" case still uses the index for ordering. Adding a separate `(user_id, created_at)` index would help only the cashier-scoping case at the cost of write amplification on every movement insert. Given the table will be populated by hundreds of writes per day and read at most a few times per shift, the trade-off favours fewer indexes. SC-006 (first page < 1s on 100k rows) is comfortably achievable with this single index per measurements on similarly-shaped tables in the codebase ([sales](../../src/main/db/queries/sales.ts#L137-L191)).

**Alternatives considered.**

- *Add `(user_id, created_at)` too.* Deferred. Re-evaluate if SC-006 fails on real data, or if a cashier-heavy listing pattern emerges. Easy to add later without a schema migration since it is purely an index.
- *Full-text index on `description` for the search box.* Rejected for v1: the FTS5 module would add complexity for a feature where users are searching short, mostly-distinct descriptions. A plain `description LIKE ?` over the date-bounded slice is fast enough at the target scale.

---

## §5. Audit log target for the void operation

**Decision.** Reuse `auth_audit`. Every successful `cashMovements:void` call writes one row with `operation = 'cashMovements:void'`, `resolved_user_id` = the admin/supervisor who voided, `outcome = 'allowed'`, and a structured `details` payload encoded into a side table — except `auth_audit` does not have a `details` column today, so the actor + outcome go to `auth_audit` and the per-void detail (original movement id, inverse movement id, optional reason) goes to `action_logs` with `action = 'void_cash_movement'`. The two-row write is wrapped in the same transaction as the inverse-movement insert.

**Rationale.** This matches the precedent set by feature 002's `force_close_register` entry ([cash.ts:116-122](../../src/main/db/queries/cash.ts#L116-L122)), which also uses `action_logs` for human-readable per-event detail while `auth_audit` carries the structured authorization outcome. Splitting concerns this way means the existing AuthAlertsBanner / audit listing still surfaces void attempts (allowed and blocked) without a schema change, and the per-void detail lands in the existing operational log that the admin already reads. FR-033 is satisfied by the combination.

**Alternatives considered.**

- *Add a `void_audit` table.* Rejected: adds a third audit destination without solving anything `action_logs` does not already solve.
- *Write only to `auth_audit`.* Rejected: `auth_audit` is structured around (operation, role, outcome) and lacks a free-text channel for the original→inverse linkage; bolting one on would change the table for every consumer.
- *Write only to `action_logs`.* Rejected: blocked attempts (FR-018, cashier tries to void) need to flow through the same authorization-failure path as every other privileged channel, which is `auth_audit`.

---

## Cross-cutting non-decisions

These came up but did not require a recorded decision:

- **Reuse of the existing pagination contract.** Confirmed already in place at [sales.ts:137](../../src/main/db/queries/sales.ts#L137); the new query simply adopts the same `{ items, total, page, perPage }` shape. No design choice.
- **Filter persistence within the session.** FR-014 says state persists "until the page is reopened from cold start." The renderer hook keeps state in URL search params, which the router already preserves on back/forward navigation — no new mechanism.
- **Excel export filename.** FR-029 fixes the format. No design choice.
- **Spanish labels.** Constitution V.b and the user-language memory both confirm Spanish strings in the renderer with English internals. No design choice.
