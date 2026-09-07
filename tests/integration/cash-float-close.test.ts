import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import {
  closeCashRegister,
  getCashRegisterById,
  getLastClosedCashRegister
} from '../../src/main/db/queries/cash'
import {
  createTestDb,
  seedUser,
  seedOpenRegister,
  seedClosedRegister,
  type SeededUser
} from './_fixtures/db'

type ClosedRegister = {
  status: string
  closing_amount: number
  expected_amount: number
  difference: number
  kept_amount: number | null
}

// ---------------------------------------------------------------------------
// 010-cash-float-close — the float left in the drawer at close (kept_amount).
// The arqueo (expected/difference) must be untouched; the withdrawal is derived
// (closing − kept) and never stored nor emitted as a cash movement.
// ---------------------------------------------------------------------------
describe('closeCashRegister — kept_amount (010)', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('cash_registers exposes kept_amount after the migration ledger', () => {
    const cols = (db.prepare('PRAGMA table_info(cash_registers)').all() as { name: string }[]).map(
      (c) => c.name
    )
    expect(cols).toContain('kept_amount')
  })

  test('persists the float and leaves expected/difference exactly as before', () => {
    const reg = seedOpenRegister(db, cajero.id, 600_000)
    db.prepare(
      `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
       VALUES (?, ?, 'income', 590000, 'Cobro del día')`
    ).run(reg.id, cajero.id)

    const closed = closeCashRegister(
      reg.id,
      1_190_000,
      undefined,
      cajero.id,
      620_000
    ) as ClosedRegister

    expect(closed.status).toBe('closed')
    expect(closed.expected_amount).toBe(1_190_000) // 600k apertura + 590k ingreso
    expect(closed.difference).toBe(0) // el fondo NO entra al arqueo
    expect(closed.closing_amount).toBe(1_190_000) // contado total, no el retiro
    expect(closed.kept_amount).toBe(620_000)
  })

  test('kept_amount stays NULL when the caller does not send it (historical semantics)', () => {
    const reg = seedOpenRegister(db, cajero.id, 0)
    const closed = closeCashRegister(reg.id, 50_000, undefined, cajero.id) as ClosedRegister
    expect(closed.kept_amount).toBeNull()

    const reg2 = seedOpenRegister(db, cajero.id, 0)
    const closed2 = closeCashRegister(reg2.id, 50_000, undefined, cajero.id, null) as ClosedRegister
    expect(closed2.kept_amount).toBeNull()
  })

  test('accepts kept = 0 (withdraw everything) and kept = counted (withdraw nothing)', () => {
    const a = seedOpenRegister(db, cajero.id, 0)
    expect(
      (closeCashRegister(a.id, 50_000, undefined, cajero.id, 0) as ClosedRegister).kept_amount
    ).toBe(0)

    const b = seedOpenRegister(db, cajero.id, 0)
    expect(
      (closeCashRegister(b.id, 50_000, undefined, cajero.id, 50_000) as ClosedRegister).kept_amount
    ).toBe(50_000)
  })

  test('rejects a float larger than the counted cash and leaves the register open', () => {
    const reg = seedOpenRegister(db, cajero.id, 0)
    expect(() => closeCashRegister(reg.id, 400_000, undefined, cajero.id, 600_000)).toThrow(
      /no puede superar el monto contado/
    )
    expect((getCashRegisterById(reg.id) as { status: string }).status).toBe('open')
    expect(
      db.prepare("SELECT COUNT(*) AS c FROM cash_movements WHERE type = 'closing'").get()
    ).toEqual({
      c: 0
    })
  })

  test('rejects negative or non-integer floats', () => {
    const reg = seedOpenRegister(db, cajero.id, 0)
    expect(() => closeCashRegister(reg.id, 400_000, undefined, cajero.id, -1)).toThrow(
      /entero no negativo/
    )
    expect(() => closeCashRegister(reg.id, 400_000, undefined, cajero.id, 10.5)).toThrow(
      /entero no negativo/
    )
  })

  test('the synthetic closing movement still carries the full counted cash (withdrawal is not a movement)', () => {
    const reg = seedOpenRegister(db, cajero.id, 600_000)
    closeCashRegister(reg.id, 1_190_000, undefined, cajero.id, 600_000)
    const rows = db
      .prepare('SELECT type, amount FROM cash_movements WHERE register_id = ? ORDER BY id')
      .all(reg.id) as { type: string; amount: number }[]
    expect(rows.map((r) => r.type)).toEqual(['opening', 'closing'])
    expect(rows[1].amount).toBe(1_190_000)
  })
})

describe('getLastClosedCashRegister (010)', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('returns null when nothing was ever closed', () => {
    expect(getLastClosedCashRegister()).toBeNull()
    seedOpenRegister(db, cajero.id, 100_000) // an OPEN register does not count
    expect(getLastClosedCashRegister()).toBeNull()
  })

  test('returns the most recent close with its float, exposing amounts only', () => {
    const first = seedOpenRegister(db, cajero.id, 0)
    closeCashRegister(first.id, 500_000, undefined, cajero.id, 500_000)
    const second = seedOpenRegister(db, cajero.id, 500_000)
    closeCashRegister(second.id, 900_000, undefined, cajero.id, 620_000)

    const last = getLastClosedCashRegister()
    expect(last).not.toBeNull()
    expect(last!.id).toBe(second.id)
    expect(last!.kept_amount).toBe(620_000)
    expect(last!.closing_amount).toBe(900_000)
    // No operator data leaks through this read-only channel (cajero can call it).
    expect(Object.keys(last!).sort()).toEqual(['closed_at', 'closing_amount', 'id', 'kept_amount'])
  })

  test('same-second closes are disambiguated by id: the latest close wins', () => {
    const first = seedOpenRegister(db, cajero.id, 0)
    closeCashRegister(first.id, 100_000, undefined, cajero.id, 100_000)
    const second = seedOpenRegister(db, cajero.id, 0)
    closeCashRegister(second.id, 200_000, undefined, cajero.id, 50_000)
    // closed_at has second resolution, so two real closes can tie exactly.
    db.prepare(
      "UPDATE cash_registers SET closed_at = '2026-09-07 10:00:00' WHERE id IN (?, ?)"
    ).run(first.id, second.id)

    const last = getLastClosedCashRegister()
    expect(last!.id).toBe(second.id)
    expect(last!.kept_amount).toBe(50_000)
  })

  test('a pre-feature close (kept_amount NULL) is reported as null, never as 0', () => {
    seedClosedRegister(db, cajero.id, 100_000)
    const last = getLastClosedCashRegister()
    expect(last).not.toBeNull()
    expect(last!.kept_amount).toBeNull()
  })
})
