import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { runMigrationsForTesting, setDbForTesting } from '../../../src/main/db'

export type Role = 'admin' | 'supervisor' | 'cajero'

export interface SeededUser {
  id: number
  name: string
  role: Role
}

export interface SeededCustomer {
  id: number
  name: string
  balance: number
  is_employee: number
}

export interface SeededRegister {
  id: number
  user_id: number
  status: 'open' | 'closed'
  opening_amount: number
}

// In-memory better-sqlite3 instance with the full migration ledger applied.
// The queries layer reads `db` via getDb() — we wire that up via the
// test-only hatch setDbForTesting() so production code paths remain unchanged.
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrationsForTesting(db)
  setDbForTesting(db)
  return db
}

let userCounter = 0
export function seedUser(
  db: Database.Database,
  opts: { role?: Role; name?: string; pin?: string } = {}
): SeededUser {
  userCounter += 1
  const role: Role = opts.role ?? 'cajero'
  const name = opts.name ?? `${role}-${userCounter}`
  const pinHash = bcrypt.hashSync(opts.pin ?? '000000', 4)
  const info = db
    .prepare('INSERT INTO users (name, role, pin_hash, active) VALUES (?, ?, ?, 1)')
    .run(name, role, pinHash)
  return { id: info.lastInsertRowid as number, name, role }
}

let customerCounter = 0
export function seedCustomer(
  db: Database.Database,
  opts: { balance?: number; name?: string; isEmployee?: boolean } = {}
): SeededCustomer {
  customerCounter += 1
  const name = opts.name ?? `Customer-${customerCounter}`
  const balance = opts.balance ?? 0
  const isEmployee = opts.isEmployee ? 1 : 0
  const info = db
    .prepare('INSERT INTO customers (name, balance, is_employee) VALUES (?, ?, ?)')
    .run(name, balance, isEmployee)
  return { id: info.lastInsertRowid as number, name, balance, is_employee: isEmployee }
}

export function seedOpenRegister(
  db: Database.Database,
  userId: number,
  openingAmount = 0
): SeededRegister {
  const info = db
    .prepare("INSERT INTO cash_registers (user_id, opening_amount, status) VALUES (?, ?, 'open')")
    .run(userId, openingAmount)
  const id = info.lastInsertRowid as number
  // Mirror the production path which emits a synthetic opening row.
  db.prepare(
    `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
     VALUES (?, ?, 'opening', ?, 'Apertura de caja')`
  ).run(id, userId, openingAmount)
  return { id, user_id: userId, status: 'open', opening_amount: openingAmount }
}

export function seedClosedRegister(
  db: Database.Database,
  userId: number,
  openingAmount = 0
): SeededRegister {
  const info = db
    .prepare(
      "INSERT INTO cash_registers (user_id, opening_amount, status, closed_at) VALUES (?, ?, 'closed', datetime('now','localtime'))"
    )
    .run(userId, openingAmount)
  return {
    id: info.lastInsertRowid as number,
    user_id: userId,
    status: 'closed',
    opening_amount: openingAmount
  }
}

export function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c
}
