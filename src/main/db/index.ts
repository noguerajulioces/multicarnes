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
  }
]

// Recurring maintenance that runs every boot (not a one-shot migration).
// Currently: 90-day retention on auth_audit (FR-019).
function runMaintenance(db: Database.Database): void {
  try {
    db.exec("DELETE FROM auth_audit WHERE created_at < datetime('now','-90 days')")
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
    const txn = db.transaction(() => {
      migration.up(db)
      recordApplied.run(migration.version, migration.name)
    })
    txn()
  }
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
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
