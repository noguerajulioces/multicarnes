import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createTables } from './schema'
import { seedDatabase } from './seed'

let db: Database.Database

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables(db)
  seedDatabase(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
