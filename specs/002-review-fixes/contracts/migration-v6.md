# Migration v6 — `held_tickets.user_id`

**Feature**: 002-review-fixes
**File**: [src/main/db/index.ts](../../../src/main/db/index.ts) (append a new entry to the `MIGRATIONS` array)
**Companion edit**: [src/main/db/schema.ts](../../../src/main/db/schema.ts) (update `CREATE TABLE held_tickets` so fresh databases include the column directly).

---

## DDL

```ts
{
  version: 6,
  name: 'add_held_tickets_user_id',
  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(held_tickets)').all() as { name: string }[]
    if (!cols.find((c) => c.name === 'user_id')) {
      // NULL is intentional: legacy rows have no owner attribution and remain
      // invisible to any cashier (FR-005, spec edge case). Future cleanup
      // migrations may reassign or delete NULL rows once the merchant has
      // had a release cycle to recover anything manually.
      db.exec('ALTER TABLE held_tickets ADD COLUMN user_id INTEGER NULL REFERENCES users(id)')
    }
  }
}
```

## Schema-file edit (fresh installs)

In [src/main/db/schema.ts](../../../src/main/db/schema.ts), the `CREATE TABLE held_tickets` block becomes:

```sql
CREATE TABLE IF NOT EXISTS held_tickets (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  payload    TEXT NOT NULL,
  discount   INTEGER NOT NULL DEFAULT 0,
  user_id    INTEGER NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

This means a fresh install creates the table with `user_id` already present; the migration becomes a no-op on fresh installs (the `if (!cols.find(...))` check returns false because the column exists).

## Idempotency contract

- **Fresh DB**: `createTables()` runs first and creates `held_tickets` with `user_id`. Migration v6 runs and finds the column already exists; no-op.
- **Existing DB (round-1 vintage, before any auth)**: `createTables()` is `IF NOT EXISTS` so it does not recreate. Migration v6 runs and adds the column. Existing rows have `user_id IS NULL`.
- **Existing DB that already ran migration v6**: idempotency check skips the ALTER. No-op.
- **Re-run of migration v6 within the same process** (shouldn't happen, but harmless): the `schema_migrations` ledger guarantees v6 runs at most once per process startup.

## Rollback contract

There is no automatic rollback. If a customer DB needs to revert to a pre-v6 schema, the manual procedure is:
1. Stop the application.
2. Restore the pre-migration backup that `runMigrations()` already produces at [src/main/db/index.ts:173](../../../src/main/db/index.ts) (`[migrations] pre-migrate backup`).
3. Re-install the previous app version.

This is documented for completeness; the migration is purely additive (a nullable column with no NOT NULL or default that could conflict with existing data), so rolling back should not be needed in practice.

## Data preservation

- Every existing `held_tickets` row is preserved verbatim.
- No row is updated, deleted, or moved by the migration.
- Existing application logic (`listHeldTickets`, `addHeldTicket`) is updated in the same release so that legacy rows (where `user_id IS NULL`) are excluded from the cashier-facing list and any new row is written with the authenticated user's id.
- The schema_migrations ledger receives a new row `(version=6, name='add_held_tickets_user_id', applied_at=<timestamp>)`.

## Verification

After the migration runs on a populated DB, the following checks must pass (covered in [quickstart.md](../quickstart.md) §2):

```sql
-- Column exists, nullable, FK to users
PRAGMA table_info(held_tickets);
-- Expected row: cid=4 name=user_id type=INTEGER notnull=0 dflt_value=NULL pk=0

-- Ledger recorded
SELECT version, name FROM schema_migrations WHERE version = 6;
-- Expected: 6 | add_held_tickets_user_id

-- Legacy rows preserved with NULL user_id
SELECT COUNT(*) FROM held_tickets WHERE user_id IS NULL;
-- Expected: count == pre-migration row count
```
