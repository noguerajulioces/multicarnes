import { beforeEach, describe, expect, test } from 'vitest'
import type Database from 'better-sqlite3'
import { getCashMovements } from '../../src/main/db/queries/cash'
import { createTestDb, seedOpenRegister, seedUser } from './_fixtures/db'

describe('getCashMovements pagination', () => {
  let db: Database.Database
  let registerId: number
  let userId: number

  beforeEach(() => {
    db = createTestDb()
    const user = seedUser(db, { role: 'cajero' })
    userId = user.id
    registerId = seedOpenRegister(db, user.id, 100_000).id
    db.prepare(
      "UPDATE cash_movements SET created_at = '2026-06-12 09:00:00' WHERE register_id = ? AND type = 'opening'"
    ).run(registerId)

    const insert = db.prepare(
      `INSERT INTO cash_movements
        (register_id, user_id, type, amount, description, created_at)
       VALUES (?, ?, 'income', ?, ?, '2026-06-12 10:00:00')`
    )
    db.transaction(() => {
      for (let i = 1; i <= 60; i++) {
        insert.run(registerId, userId, i * 1_000, `Movimiento ${i}`)
      }
    })()
  })

  test('returns a stable server-paginated result with the real total', () => {
    const first = getCashMovements(registerId, { page: 1, perPage: 25 })
    const third = getCashMovements(registerId, { page: 3, perPage: 25 })

    expect(first.total).toBe(61)
    expect(first.items).toHaveLength(25)
    expect((first.items[0] as { description: string }).description).toBe('Movimiento 60')
    expect(third.items).toHaveLength(11)
    expect((third.items.at(-1) as { description: string }).description).toBe('Apertura de caja')
  })

  test('keeps the legacy unpaginated call compatible', () => {
    expect(getCashMovements(registerId)).toHaveLength(61)
  })
})
