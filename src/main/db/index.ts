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
  const cols = db.prepare("PRAGMA table_info(products)").all() as { name: string }[]
  if (!cols.find((c) => c.name === 'image')) {
    db.exec('ALTER TABLE products ADD COLUMN image TEXT')
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
