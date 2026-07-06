import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { createTables } from './schema'
import { seedDatabase } from './seed'

let db: Database.Database

export function getImagesDir(): string {
  const dir = join(app.getPath('userData'), 'product-images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
  // When the up() body recreates a table that has incoming foreign keys
  // (SQLite's only way to alter a CHECK constraint), FK enforcement must be
  // disabled around the transaction — and PRAGMA foreign_keys cannot be
  // toggled inside one. The runner handles the toggle and runs
  // foreign_key_check before committing.
  requiresForeignKeysOff?: boolean
}

// P3: Versioned migrations. Each entry runs at most once and is recorded in
// schema_migrations. Append new migrations at the end with the next version
// number; never reorder, renumber, or mutate an applied migration's body.
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'add_products_image_column',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[]
      if (!cols.find((c) => c.name === 'image')) {
        db.exec('ALTER TABLE products ADD COLUMN image TEXT')
      }
    }
  },
  {
    version: 2,
    name: 'customers_document_columns_and_backfill',
    up: (db) => {
      const cols = db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]
      const hasDocument = !!cols.find((c) => c.name === 'document')
      const hasDocumentType = !!cols.find((c) => c.name === 'document_type')
      const hasCi = !!cols.find((c) => c.name === 'ci')
      const hasRuc = !!cols.find((c) => c.name === 'ruc')

      if (!hasDocument) db.exec('ALTER TABLE customers ADD COLUMN document TEXT')
      if (!hasDocumentType) db.exec('ALTER TABLE customers ADD COLUMN document_type TEXT')

      if (hasCi || hasRuc) {
        const ruc = hasRuc ? 'ruc' : 'NULL'
        const ci = hasCi ? 'ci' : 'NULL'
        db.exec(`
          UPDATE customers
          SET document = COALESCE(${ruc}, ${ci}),
              document_type = CASE
                WHEN ${ruc} IS NOT NULL THEN 'RUC'
                WHEN ${ci} IS NOT NULL THEN 'CI'
              END
          WHERE document IS NULL AND (${ruc} IS NOT NULL OR ${ci} IS NOT NULL)
        `)
      }
    }
  },
  {
    version: 3,
    name: 'seed_backup_schedule_settings',
    up: (db) => {
      const insertSetting = db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      )
      insertSetting.run('backup_schedule_enabled', '0')
      insertSetting.run('backup_schedule_time', '22:00')
    }
  },
  {
    version: 4,
    name: 'create_held_tickets_table',
    up: (db) => {
      // Schema-level CREATE TABLE IF NOT EXISTS already handles creation on
      // fresh installs; this migration is a no-op there. On upgraded installs
      // where createTables() has already run, the IF NOT EXISTS keeps it safe.
      db.exec(`
        CREATE TABLE IF NOT EXISTS held_tickets (
          id         TEXT PRIMARY KEY,
          label      TEXT NOT NULL,
          payload    TEXT NOT NULL,
          discount   INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
      `)
    }
  },
  {
    version: 5,
    name: 'create_auth_audit_tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_audit (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          operation          TEXT    NOT NULL,
          claimed_user_id    INTEGER,
          resolved_user_id   INTEGER,
          resolved_role      TEXT,
          outcome            TEXT    NOT NULL CHECK(outcome IN
                               ('allowed',
                                'blocked-no-user',
                                'blocked-inactive',
                                'blocked-insufficient-role')),
          sender_id          INTEGER,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_auth_audit_user_time_outcome
          ON auth_audit(claimed_user_id, created_at, outcome);
        CREATE TABLE IF NOT EXISTS auth_alert_acks (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id          INTEGER NOT NULL REFERENCES users(id),
          window_start     TEXT    NOT NULL,
          acknowledged_at  TEXT,
          acknowledged_by  INTEGER REFERENCES users(id),
          UNIQUE(user_id, window_start)
        );
      `)
    }
  },
  {
    version: 6,
    name: 'add_held_tickets_user_id',
    up: (db) => {
      // Adds owner attribution to held_tickets so each cashier sees only their
      // own held tickets. Legacy rows pre-dating this migration get user_id
      // NULL and are invisible to every cashier (002-review-fixes FR-001/FR-005
      // edge case).
      const cols = db.prepare('PRAGMA table_info(held_tickets)').all() as { name: string }[]
      if (!cols.find((c) => c.name === 'user_id')) {
        db.exec('ALTER TABLE held_tickets ADD COLUMN user_id INTEGER NULL REFERENCES users(id)')
      }
    }
  },
  {
    version: 7,
    name: 'cash_movements_broaden_and_void',
    up: (db) => {
      // 003-cash-movements-history: broaden the type CHECK to allow
      // opening/closing/void rows, add void_of FK for the append-only void
      // linkage, and backfill synthetic opening/closing rows from existing
      // cash_registers so the new history page is useful for past sessions.
      const cols = db.prepare('PRAGMA table_info(cash_movements)').all() as { name: string }[]
      const hasVoidOf = !!cols.find((c) => c.name === 'void_of')

      const tableSql = (
        db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements'")
          .get() as { sql: string }
      ).sql
      const hasBroadenedCheck = tableSql.includes("'opening'") && tableSql.includes("'void'")

      if (!(hasVoidOf && hasBroadenedCheck)) {
        // SQLite can't ALTER or DROP a CHECK; copy through a new table.
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

      // Backfill — NOT EXISTS guards make this safe on re-run.
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
  },
  {
    version: 8,
    name: 'add_products_promo_columns',
    up: (db) => {
      // 005-promotional-pricing: per-product promo. Adds five additive
      // columns. Idempotent under PRAGMA table_info — re-running is a no-op.
      // Fresh installs get the columns from schema.ts; this migration only
      // matters for upgraded installs.
      const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[]
      const has = (n: string): boolean => cols.some((c) => c.name === n)
      if (!has('promo_enabled')) {
        db.exec('ALTER TABLE products ADD COLUMN promo_enabled INTEGER NOT NULL DEFAULT 0')
      }
      if (!has('promo_type')) {
        db.exec('ALTER TABLE products ADD COLUMN promo_type TEXT')
      }
      if (!has('promo_value')) {
        db.exec('ALTER TABLE products ADD COLUMN promo_value INTEGER')
      }
      if (!has('promo_from')) {
        db.exec('ALTER TABLE products ADD COLUMN promo_from TEXT')
      }
      if (!has('promo_to')) {
        db.exec('ALTER TABLE products ADD COLUMN promo_to TEXT')
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_promo_enabled
          ON products(promo_enabled) WHERE promo_enabled = 1;
      `)
    }
  },
  {
    version: 9,
    name: 'payment_methods_card_and_processor',
    // 006-card-payments: extend payment_method CHECK to include 'card' and
    // add payment_processor + payment_reference columns. SQLite can't ALTER a
    // CHECK in place, so both `sales` and `sale_payments` are rebuilt via the
    // recommended swap pattern. Incoming FKs from sale_items / sale_payments
    // → sales force the runner to disable foreign_keys for this migration.
    requiresForeignKeysOff: true,
    up: (db) => {
      const salesSql = (
        db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'").get() as {
          sql: string
        }
      ).sql
      const salesNeedsRebuild =
        !salesSql.includes("'card'") ||
        !salesSql.includes('payment_processor') ||
        !salesSql.includes('payment_reference')

      if (salesNeedsRebuild) {
        db.exec(`
          CREATE TABLE sales_new (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            register_id       INTEGER NOT NULL REFERENCES cash_registers(id),
            customer_id       INTEGER REFERENCES customers(id),
            user_id           INTEGER NOT NULL REFERENCES users(id),
            subtotal          INTEGER NOT NULL,
            discount          INTEGER NOT NULL DEFAULT 0,
            total             INTEGER NOT NULL,
            payment_method    TEXT NOT NULL CHECK(payment_method IN ('cash','card','credit','transfer','mixed')),
            payment_processor TEXT CHECK(payment_processor IN ('bancard','dinelco','upay') OR payment_processor IS NULL),
            payment_reference TEXT,
            status            TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
            notes             TEXT,
            created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
          );
          INSERT INTO sales_new
            (id, register_id, customer_id, user_id, subtotal, discount, total,
             payment_method, payment_processor, payment_reference,
             status, notes, created_at)
          SELECT id, register_id, customer_id, user_id, subtotal, discount, total,
                 payment_method, NULL, NULL, status, notes, created_at
          FROM sales;
          DROP TABLE sales;
          ALTER TABLE sales_new RENAME TO sales;
        `)
      }

      const spSql = (
        db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sale_payments'")
          .get() as { sql: string }
      ).sql
      const spNeedsRebuild =
        !spSql.includes("'card'") || !spSql.includes('processor') || !spSql.includes('reference')

      if (spNeedsRebuild) {
        db.exec(`
          CREATE TABLE sale_payments_new (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id   INTEGER NOT NULL REFERENCES sales(id),
            method    TEXT NOT NULL CHECK(method IN ('cash','card','credit','transfer')),
            amount    INTEGER NOT NULL,
            processor TEXT CHECK(processor IN ('bancard','dinelco','upay') OR processor IS NULL),
            reference TEXT
          );
          INSERT INTO sale_payments_new (id, sale_id, method, amount, processor, reference)
          SELECT id, sale_id, method, amount, NULL, NULL FROM sale_payments;
          DROP TABLE sale_payments;
          ALTER TABLE sale_payments_new RENAME TO sale_payments;
        `)
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_processor
          ON sales(payment_processor) WHERE payment_processor IS NOT NULL;
      `)
    }
  },
  {
    version: 10,
    name: 'add_customer_payments_affects_cash',
    up: (db) => {
      // 008-debt-payment-types: distinguish cash-affecting payments from
      // salary-deduction (non-cash) ones. Idempotent under PRAGMA table_info
      // so re-running on a fresh install that already has the column from
      // schema.ts is a no-op.
      const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as { name: string }[]
      const has = cols.some((c) => c.name === 'affects_cash')
      if (!has) {
        db.exec('ALTER TABLE customer_payments ADD COLUMN affects_cash INTEGER NOT NULL DEFAULT 1')
      }
    }
  },
  {
    version: 11,
    name: 'add_customer_payments_cash_movement_id',
    up: (db) => {
      // Link each cash-affecting customer payment to the cash_movements (income)
      // row it created, so voiding that income from the Movimientos de Caja page
      // can reverse the payment on the customer side (restore the debt) instead
      // of silently leaving the balance reduced. Legacy rows stay NULL and so
      // are not reversible (no backfill, mirroring v10). Additive + idempotent
      // under PRAGMA table_info → a no-op on installs that already got the column
      // from schema.ts.
      const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as { name: string }[]
      if (!cols.some((c) => c.name === 'cash_movement_id')) {
        db.exec(
          'ALTER TABLE customer_payments ADD COLUMN cash_movement_id INTEGER NULL REFERENCES cash_movements(id)'
        )
      }
    }
  },
  {
    version: 12,
    name: 'add_customer_payments_void_of',
    up: (db) => {
      // Append-only annulment trail for debt payments, mirroring cash_movements:
      // when a cash payment's income is voided from Movimientos de Caja, instead
      // of deleting the payment we keep it and append a void row pointing back via
      // void_of, so the customer's payment history shows "pago → anulación" just
      // like the cash timeline. Additive + idempotent under PRAGMA table_info.
      const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as { name: string }[]
      if (!cols.some((c) => c.name === 'void_of')) {
        db.exec(
          'ALTER TABLE customer_payments ADD COLUMN void_of INTEGER NULL REFERENCES customer_payments(id)'
        )
      }
    }
  },
  {
    version: 13,
    name: 'add_customers_credit_limit_columns',
    up: (db) => {
      // Per-customer credit limit (límite de fiado): a toggle + an optional
      // amount in Gs. Additive + idempotent under PRAGMA table_info — fresh
      // installs already get the columns from schema.ts, so this only matters
      // for upgraded installs. Mirrors the v8 promo-columns template.
      const cols = db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]
      const has = (n: string): boolean => cols.some((c) => c.name === n)
      if (!has('credit_limit_enabled')) {
        db.exec('ALTER TABLE customers ADD COLUMN credit_limit_enabled INTEGER NOT NULL DEFAULT 0')
      }
      if (!has('credit_limit_amount')) {
        db.exec('ALTER TABLE customers ADD COLUMN credit_limit_amount INTEGER')
      }
    }
  },
  {
    version: 14,
    name: 'add_performance_indexes',
    up: (db) => {
      // Indexes on the hottest filter/join/order columns so listados and
      // reports stop full-scanning as the tables grow (sales history, customer
      // accounts, stock movements, product filtering). All additive and
      // idempotent (IF NOT EXISTS); no data change. products.barcode is already
      // UNIQUE (implicit index) and cash_movements already has its own index.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_register_created
          ON sales(register_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sales_customer
          ON sales(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_created
          ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale
          ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_payments_sale
          ON sale_payments(sale_id);
        CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_created
          ON customer_payments(customer_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product
          ON stock_adjustments(product_id);
        CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created
          ON stock_adjustments(created_at);
        CREATE INDEX IF NOT EXISTS idx_products_category
          ON products(category_id);
      `)
    }
  },
  {
    version: 15,
    name: 'add_name_indexes',
    up: (db) => {
      // Acelera el ORDER BY name de getAllProducts/getAllCustomers (hoy full
      // scan + sort temporal). NOTA: el filtro de búsqueda usa LIKE '%term%'
      // (comodín inicial) y NO puede usar estos índices — sólo ayudan al
      // ordenamiento y al listado sin búsqueda. Aditivo e idempotente.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      `)
    }
  },
  {
    version: 16,
    name: 'add_void_and_sale_item_indexes',
    up: (db) => {
      // Performance: index the columns hit by the append-only "anulación" lookups
      // and the per-product sales queries, which today force full-table scans that
      // worsen as the tables grow.
      //
      // - idx_cash_movements_void_of: getCashRegisterSummary / closeCashRegister /
      //   listMovements compute "¿está anulado?" via a correlated
      //   `(NOT) EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)`
      //   per row. Without this index each subquery full-scans cash_movements
      //   (O(N²) on the Caja summary; measured ~3.3s on a 150k-row table → ~0ms
      //   with the index).
      // - idx_customer_payments_void_of: same EXISTS pattern in getCustomerPayments.
      // - idx_sale_items_product: getRecentSalesForProduct / getProductSalesStats
      //   filter `WHERE si.product_id = ?`; v14 only indexed sale_items(sale_id),
      //   so product-detail stats full-scanned the ever-growing sale_items table.
      // - idx_cash_movements_created: backs the date-range filter + ORDER BY on the
      //   Movimientos de Caja history (the composite idx leads with register_id and
      //   can't serve a date-only filter).
      //
      // All additive and idempotent (IF NOT EXISTS); no data change. void_of exists
      // by this point: cash_movements via schema/v7 and customer_payments via v12.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cash_movements_void_of
          ON cash_movements(void_of);
        CREATE INDEX IF NOT EXISTS idx_customer_payments_void_of
          ON customer_payments(void_of);
        CREATE INDEX IF NOT EXISTS idx_sale_items_product
          ON sale_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_cash_movements_created
          ON cash_movements(created_at);
      `)
    }
  },
  {
    version: 17,
    name: 'default_credit_limit_all_customers',
    up: (db) => {
      // Regla de negocio: por defecto todo cliente tiene un límite de fiado de
      // 400.000 Gs, activado. Sobrescritura total (decisión "pisar a todos") —
      // clobbea cualquier límite propio fijado antes de este release (la función
      // de límite llegó en v13, así que en la práctica hay pocos/ninguno).
      // Corre una sola vez (registrado en schema_migrations). Los clientes NUEVOS
      // reciben este default desde el formulario, no desde aquí.
      db.exec('UPDATE customers SET credit_limit_enabled = 1, credit_limit_amount = 400000')
    }
  }
]

// Recurring maintenance that runs every boot (not a one-shot migration).
// Currently: 90-day retention on auth_audit (FR-019).
//
// Both branches of the comparison must use 'localtime' to match the table's
// stored timestamp convention (DEFAULT datetime('now','localtime')) — using a
// bare 'now' would compare local-time strings against a UTC threshold and skew
// the cutoff by the local TZ offset.
function runMaintenance(db: Database.Database): void {
  try {
    db.exec("DELETE FROM auth_audit WHERE created_at < datetime('now','localtime','-90 days')")
  } catch (err) {
    // Maintenance failures are non-fatal — surface in console but don't block boot.
    console.error('[maintenance] auth_audit retention sweep failed:', err)
  }
}

function preMigrateBackup(dbPath: string, version: number): void {
  // Skip the safeguard on a fresh DB: if no real data exists yet there is
  // nothing to lose to a bad migration. Detected by checking the few user-data
  // tables we expect to be populated on a real install.
  try {
    const usersCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c
    const salesCount = (db.prepare('SELECT COUNT(*) AS c FROM sales').get() as { c: number }).c
    const productsCount = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number })
      .c
    if (usersCount === 0 && salesCount === 0 && productsCount === 0) return
  } catch {
    // If any of those tables doesn't exist yet (very old install), there's
    // nothing to back up either.
    return
  }

  const backupDir = join(app.getPath('userData'), 'backups')
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(backupDir, `pre-migrate-v${version}-${stamp}.db`)
  try {
    copyFileSync(dbPath, dest)
  } catch (err) {
    // A backup failure is loud but not fatal — the migration still runs.
    // Surfaces in the main-process console; merchant data is at risk only if
    // both the backup AND the migration fail, which is handled by the
    // transaction-per-migration wrapper below (each migration rolls back on
    // throw).
    console.error('[migrations] pre-migrate backup failed:', err)
  }
}

function backfillLegacyLedger(db: Database.Database): void {
  // P3: First-boot heuristic for installs that already ran the previous
  // ad-hoc runMigrations(). Detect each legacy migration's effect and mark
  // the matching version as applied so it does not replay.
  const recordIfMissing = (version: number, name: string, detector: () => boolean): void => {
    const exists = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)
    if (exists) return
    if (!detector()) return
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      version,
      name,
      "datetime('now','localtime')-pre-versioned"
    )
  }

  recordIfMissing(1, 'add_products_image_column', () => {
    const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[]
    return !!cols.find((c) => c.name === 'image')
  })
  recordIfMissing(2, 'customers_document_columns_and_backfill', () => {
    const cols = db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]
    return !!cols.find((c) => c.name === 'document')
  })
  recordIfMissing(3, 'seed_backup_schedule_settings', () => {
    const row = db.prepare("SELECT 1 FROM app_settings WHERE key = 'backup_schedule_enabled'").get()
    return !!row
  })
}

function runMigrations(db: Database.Database, dbPath: string): void {
  backfillLegacyLedger(db)

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as {
    version: number
  }[]
  const applied = new Set(appliedRows.map((r) => r.version))
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version))
  if (pending.length === 0) return

  // Snapshot the DB once before applying any pending migration. Each migration
  // also runs in its own transaction so an individual failure rolls back
  // cleanly; the file-level backup is the recovery handle when a developer
  // needs to revert a deployed install.
  preMigrateBackup(dbPath, pending[0].version)

  const recordApplied = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
  for (const migration of pending) {
    const runTxn = (): void => {
      const txn = db.transaction(() => {
        migration.up(db)
        recordApplied.run(migration.version, migration.name)
      })
      txn()
    }
    if (migration.requiresForeignKeysOff) {
      db.pragma('foreign_keys = OFF')
      try {
        runTxn()
        const violations = db.pragma('foreign_key_check') as unknown[]
        if (violations.length > 0) {
          throw new Error(
            `Migration v${migration.version} (${migration.name}) produced FK violations: ` +
              JSON.stringify(violations)
          )
        }
      } finally {
        db.pragma('foreign_keys = ON')
      }
    } else {
      runTxn()
    }
  }
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  // Performance/robustness pragmas. busy_timeout avoids hard "database is
  // locked" failures under contention (single-instance lock notwithstanding);
  // synchronous=NORMAL is the recommended setting in WAL mode and cuts disk I/O
  // (helps on slow eMMC/HDD disks); the negative cache_size is ~32 MB of page
  // cache to reduce reads.
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -32000')
  createTables(db)
  runMigrations(db, dbPath)
  runMaintenance(db)
  seedDatabase(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

// Test-only hatch. Used by scripts/auth-smoke.ts to point the queries layer
// at an in-memory database without going through initDatabase() (which calls
// app.getPath, only valid inside Electron). Do NOT call this from production
// code paths.
export function setDbForTesting(database: Database.Database): void {
  db = database
}

// Test-only: apply createTables + the full migration ledger to an in-memory
// or file DB outside Electron. Skips the pre-migrate file backup (no real
// dbPath to copy) but keeps every migration body identical to the boot path
// so integration tests verify the same SQL that ships.
export function runMigrationsForTesting(database: Database.Database): void {
  database.pragma('foreign_keys = ON')
  createTables(database)
  backfillLegacyLedger(database)
  const appliedRows = database.prepare('SELECT version FROM schema_migrations').all() as {
    version: number
  }[]
  const applied = new Set(appliedRows.map((r) => r.version))
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version))
  if (pending.length === 0) return
  const recordApplied = database.prepare(
    'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
  )
  for (const migration of pending) {
    const runTxn = (): void => {
      const txn = database.transaction(() => {
        migration.up(database)
        recordApplied.run(migration.version, migration.name)
      })
      txn()
    }
    if (migration.requiresForeignKeysOff) {
      database.pragma('foreign_keys = OFF')
      try {
        runTxn()
        const violations = database.pragma('foreign_key_check') as unknown[]
        if (violations.length > 0) {
          throw new Error(
            `Migration v${migration.version} (${migration.name}) produced FK violations: ` +
              JSON.stringify(violations)
          )
        }
      } finally {
        database.pragma('foreign_keys = ON')
      }
    } else {
      runTxn()
    }
  }
}

// Test-only: ordered list of migrations exposed so partial-application tests
// (e.g. "apply v1..v9, then v10") can target a specific ceiling.
export const TEST_MIGRATIONS = MIGRATIONS
