# Migration v7: cash_movements broadening + void linkage + synthetic backfill

**Feature**: 003-cash-movements-history
**Date**: 2026-05-11
**Version**: 7
**Idempotent**: yes (re-runnable, no-op on second invocation)
**Destructive**: no (no column dropped, no data lost — original `cash_movements` rows preserved bit-for-bit)
**Backup safeguard**: yes — runs through `preMigrateBackup(dbPath, 7)` like every prior migration, per [src/main/db/index.ts:157](../../../src/main/db/index.ts#L157)

## What it does

1. **Broadens** `cash_movements.type` CHECK from `IN ('income','expense')` to `IN ('income','expense','opening','closing','void')`.
2. **Adds** the `void_of INTEGER NULL REFERENCES cash_movements(id)` column.
3. **Creates** index `idx_cash_movements_register_created` on `(register_id, created_at DESC)`.
4. **Backfills** synthetic `'opening'` rows for every existing `cash_registers` row.
5. **Backfills** synthetic `'closing'` rows for every closed `cash_registers` row.

All five steps run inside a single SQLite transaction. Partial failure leaves the database at v6.

## Idempotency

The migration body opens with:

```ts
const cols = db.prepare('PRAGMA table_info(cash_movements)').all() as { name: string }[]
const hasVoidOf = !!cols.find((c) => c.name === 'void_of')

const tableSql = (db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements'")
  .get() as { sql: string }).sql
const hasBroadenedCheck = tableSql.includes("'opening'") && tableSql.includes("'void'")

if (hasVoidOf && hasBroadenedCheck) {
  // Already applied — skip schema changes. Still verify backfill idempotency below.
}
```

The synthetic-row inserts use `NOT EXISTS` guards (see "Step 4 / 5" below) so a re-run on a partially-backfilled DB skips rows that already exist.

## SQL — full body

```sql
BEGIN TRANSACTION;

-- Step 1+2: recreate-and-swap to broaden CHECK and add void_of.
-- SQLite cannot ALTER a CHECK or drop one, so we copy through a new table.
CREATE TABLE cash_movements_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  void_of     INTEGER NULL REFERENCES cash_movements(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO cash_movements_new
  (id, register_id, user_id, type, amount, description, void_of, created_at)
SELECT
  id, register_id, user_id, type, amount, description, NULL, created_at
FROM cash_movements;

DROP TABLE cash_movements;
ALTER TABLE cash_movements_new RENAME TO cash_movements;

-- Step 3: index for the paginated timeline query.
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);

-- Step 4: synthetic opening rows for every existing register.
-- Skip registers that already have an opening row (defensive, in case the
-- migration is re-run after manual cleanup or a partial prior attempt).
INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
SELECT
  cr.id,
  cr.user_id,
  'opening',
  cr.opening_amount,
  'Apertura de caja',
  cr.opened_at
FROM cash_registers cr
WHERE NOT EXISTS (
  SELECT 1 FROM cash_movements cm
  WHERE cm.register_id = cr.id AND cm.type = 'opening'
);

-- Step 5: synthetic closing rows for every CLOSED register.
INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
SELECT
  cr.id,
  cr.user_id,
  'closing',
  cr.closing_amount,
  CASE
    WHEN cr.difference = 0 OR cr.difference IS NULL THEN 'Cierre de caja'
    WHEN cr.difference > 0 THEN 'Cierre de caja (sobrante ' || cr.difference || ')'
    ELSE 'Cierre de caja (faltante ' || ABS(cr.difference) || ')'
  END,
  cr.closed_at
FROM cash_registers cr
WHERE cr.status = 'closed'
  AND cr.closing_amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cash_movements cm
    WHERE cm.register_id = cr.id AND cm.type = 'closing'
  );

COMMIT;
```

## Migrations entry (to be appended to `src/main/db/index.ts`)

```ts
{
  version: 7,
  name: 'cash_movements_broaden_and_void',
  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(cash_movements)').all() as { name: string }[]
    const hasVoidOf = !!cols.find((c) => c.name === 'void_of')

    const tableSql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements'")
        .get() as { sql: string }
    ).sql
    const hasBroadenedCheck = tableSql.includes("'opening'") && tableSql.includes("'void'")

    if (!(hasVoidOf && hasBroadenedCheck)) {
      // Schema portion. Recreate-and-swap.
      db.exec(`
        CREATE TABLE cash_movements_new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          register_id INTEGER NOT NULL REFERENCES cash_registers(id),
          user_id     INTEGER NOT NULL REFERENCES users(id),
          type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
          amount      INTEGER NOT NULL,
          description TEXT NOT NULL,
          void_of     INTEGER NULL REFERENCES cash_movements(id),
          created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        INSERT INTO cash_movements_new
          (id, register_id, user_id, type, amount, description, void_of, created_at)
        SELECT id, register_id, user_id, type, amount, description, NULL, created_at
        FROM cash_movements;
        DROP TABLE cash_movements;
        ALTER TABLE cash_movements_new RENAME TO cash_movements;
      `)
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
        ON cash_movements(register_id, created_at DESC);
    `)

    // Backfill — guarded by NOT EXISTS so it's safe on re-run.
    db.exec(`
      INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
      SELECT cr.id, cr.user_id, 'opening', cr.opening_amount, 'Apertura de caja', cr.opened_at
      FROM cash_registers cr
      WHERE NOT EXISTS (
        SELECT 1 FROM cash_movements cm
        WHERE cm.register_id = cr.id AND cm.type = 'opening'
      );

      INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
      SELECT
        cr.id, cr.user_id, 'closing', cr.closing_amount,
        CASE
          WHEN cr.difference = 0 OR cr.difference IS NULL THEN 'Cierre de caja'
          WHEN cr.difference > 0 THEN 'Cierre de caja (sobrante ' || cr.difference || ')'
          ELSE 'Cierre de caja (faltante ' || ABS(cr.difference) || ')'
        END,
        cr.closed_at
      FROM cash_registers cr
      WHERE cr.status = 'closed'
        AND cr.closing_amount IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM cash_movements cm
          WHERE cm.register_id = cr.id AND cm.type = 'closing'
        );
    `)
  }
}
```

The transaction wrapping is handled by the existing migration runner ([src/main/db/index.ts](../../../src/main/db/index.ts)), which runs each migration body inside `db.transaction(...)`. The recreate-and-swap is therefore atomic.

## Rollback

Schema rollback to v6 is **not** supported by the migration framework (migrations are forward-only). Operational rollback path if a real production bug is discovered:

1. Restore the pre-migration backup snapshot created by `preMigrateBackup(dbPath, 7)`.
2. The application loads against the v6 schema and skips the new sidebar entry / new IPC channels until the next deploy.

A failed migration during the transaction rolls back automatically; the database is left at v6 and the next app start retries.

## Verification (manual, quickstart §2)

After running the migration against a real existing database:

```sql
-- 1. Schema is at v7.
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
-- → 7

-- 2. CHECK is broadened.
SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements';
-- → ... CHECK(type IN ('income','expense','opening','closing','void')) ...

-- 3. void_of exists.
PRAGMA table_info(cash_movements);
-- → ... void_of | INTEGER | 0 | NULL | 0

-- 4. Backfill consistency: every existing register has exactly one opening row.
SELECT cr.id, COUNT(cm.id) AS opens
FROM cash_registers cr
LEFT JOIN cash_movements cm
  ON cm.register_id = cr.id AND cm.type = 'opening'
GROUP BY cr.id
HAVING opens <> 1;
-- → 0 rows

-- 5. Backfill consistency: every closed register has exactly one closing row.
SELECT cr.id, COUNT(cm.id) AS closes
FROM cash_registers cr
LEFT JOIN cash_movements cm
  ON cm.register_id = cr.id AND cm.type = 'closing'
WHERE cr.status = 'closed' AND cr.closing_amount IS NOT NULL
GROUP BY cr.id
HAVING closes <> 1;
-- → 0 rows

-- 6. No income/expense rows were dropped or duplicated.
-- Compare against a pre-migration row count snapshot.
SELECT COUNT(*) FROM cash_movements WHERE type IN ('income','expense');
```
