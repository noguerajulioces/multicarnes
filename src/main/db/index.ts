import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { createTables } from './schema'
import { seedDatabase } from './seed'

let db: Database.Database

export function getImagesDir(): string {
  const dir = join(app.getPath('userData'), 'product-images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function runMigrations(db: Database.Database): void {
  // Add image column if it doesn't exist
  const productsCols = db.prepare("PRAGMA table_info(products)").all() as { name: string }[]
  if (!productsCols.find((c) => c.name === 'image')) {
    db.exec('ALTER TABLE products ADD COLUMN image TEXT')
  }

  // Add document/document_type columns to customers if they don't exist
  const customersCols = db.prepare("PRAGMA table_info(customers)").all() as { name: string }[]
  const hasDocument = !!customersCols.find((c) => c.name === 'document')
  const hasDocumentType = !!customersCols.find((c) => c.name === 'document_type')
  const hasCi = !!customersCols.find((c) => c.name === 'ci')
  const hasRuc = !!customersCols.find((c) => c.name === 'ruc')

  if (!hasDocument) db.exec('ALTER TABLE customers ADD COLUMN document TEXT')
  if (!hasDocumentType) db.exec('ALTER TABLE customers ADD COLUMN document_type TEXT')

  // Backfill document/document_type from legacy ci/ruc columns if present
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

  // Add schedule backup settings if missing
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  insertSetting.run('backup_schedule_enabled', '0')
  insertSetting.run('backup_schedule_time', '22:00')
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables(db)
  runMigrations(db)
  seedDatabase(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
