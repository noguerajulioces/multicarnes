import { getDb } from '../index'
import bcrypt from 'bcryptjs'

const PIN_LENGTH = 6

function assertValidPin(pin: string): void {
  if (typeof pin !== 'string' || pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    throw new Error(`El PIN debe tener exactamente ${PIN_LENGTH} dígitos numéricos`)
  }
}

export function getAllUsers() {
  return getDb().prepare('SELECT id, name, role, active, created_at FROM users ORDER BY name').all()
}

export function getActiveUsers() {
  return getDb()
    .prepare('SELECT id, name, role, active, created_at FROM users WHERE active = 1 ORDER BY name')
    .all()
}

export function getUserById(id: number) {
  return getDb()
    .prepare('SELECT id, name, role, active, created_at FROM users WHERE id = ?')
    .get(id)
}

export function loginUser(userId: number, pin: string) {
  const user = getDb()
    .prepare('SELECT id, name, role, pin_hash, active FROM users WHERE id = ? AND active = 1')
    .get(userId) as
    | { id: number; name: string; role: string; pin_hash: string; active: number }
    | undefined
  if (!user) return null
  const valid = bcrypt.compareSync(pin, user.pin_hash)
  if (!valid) return null
  return { id: user.id, name: user.name, role: user.role, active: !!user.active }
}

export function createUser(data: { name: string; role: string; pin: string }) {
  assertValidPin(data.pin)
  const pinHash = bcrypt.hashSync(data.pin, 10)
  const result = getDb()
    .prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)')
    .run(data.name, data.role, pinHash)
  return getUserById(result.lastInsertRowid as number)
}

// 002-review-fixes FR-012: re-read the active-admin count and insert the new
// user inside a single transaction. Two simultaneous calls cannot both observe
// "no admins" and both insert as admin — SQLite serialises overlapping write
// transactions on the main process, so the second call sees the first's row.
//
// Replaces the racy pre-check + createUser + refreshRecoveryMode pattern in
// users.ipc.ts (created in feature 001 before this invariant was tightened).
export function createUserAtomicRecoveryCheck(data: { name: string; role: string; pin: string }) {
  assertValidPin(data.pin)
  const pinHash = bcrypt.hashSync(data.pin, 10)
  const db = getDb()
  const txn = db.transaction(() => {
    const row = db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE active = 1 AND role = 'admin'")
      .get() as { c: number }
    const effectiveRole = row.c === 0 ? 'admin' : data.role
    const result = db
      .prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)')
      .run(data.name, effectiveRole, pinHash)
    return getUserById(result.lastInsertRowid as number)
  })
  return txn()
}

export function updateUser(
  id: number,
  data: { name?: string; role?: string; pin?: string; active?: boolean }
) {
  const db = getDb()
  if (data.name !== undefined) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(data.name, id)
  }
  if (data.role !== undefined) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(data.role, id)
  }
  if (data.pin) {
    assertValidPin(data.pin)
    const pinHash = bcrypt.hashSync(data.pin, 10)
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, id)
  }
  if (data.active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(data.active ? 1 : 0, id)
  }
  return getUserById(id)
}
