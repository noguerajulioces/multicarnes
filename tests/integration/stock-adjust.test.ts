import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { adjustStock, getProductById } from '../../src/main/db/queries/products'
import { createTestDb, seedUser, type SeededUser } from './_fixtures/db'

function seedProduct(db: Database.Database, stock = 10): number {
  const info = db
    .prepare(
      "INSERT INTO products (name, price, price_type, stock, min_stock) VALUES ('Lomo', 1000, 'kg', ?, 0)"
    )
    .run(stock)
  return info.lastInsertRowid as number
}

const stockOf = (id: number): number => (getProductById(id) as { stock: number }).stock
const auditCount = (db: Database.Database): number =>
  (db.prepare('SELECT COUNT(*) as c FROM stock_adjustments').get() as { c: number }).c

// ---------------------------------------------------------------------------
// adjustStock re-validates the resulting absolute stock server-side. The two
// "Ajustar stock" modals block a negative/invalid value, but the IPC is
// reachable directly, so the repository must enforce the same invariant (valid
// finite number, >= 0) — otherwise products.stock and the stock_adjustments
// audit row get corrupted.
// ---------------------------------------------------------------------------
describe('adjustStock — server-side validation', () => {
  let db: Database.Database
  let admin: SeededUser
  let productId: number

  beforeEach(() => {
    db = createTestDb()
    admin = seedUser(db, { role: 'admin' })
    productId = seedProduct(db, 10)
  })

  test('1 — a valid adjustment persists the new stock and writes one audit row', () => {
    adjustStock(productId, 5, 'recuento físico', admin.id)
    expect(stockOf(productId)).toBe(5)
    expect(auditCount(db)).toBe(1)
    const row = db
      .prepare('SELECT quantity_before, quantity_after FROM stock_adjustments WHERE product_id = ?')
      .get(productId) as { quantity_before: number; quantity_after: number }
    expect(row.quantity_before).toBe(10)
    expect(row.quantity_after).toBe(5)
  })

  test('2 — adjusting to exactly 0 is allowed (boundary)', () => {
    adjustStock(productId, 0, 'merma total', admin.id)
    expect(stockOf(productId)).toBe(0)
    expect(auditCount(db)).toBe(1)
  })

  test('3 — a negative resulting stock throws and writes nothing', () => {
    expect(() => adjustStock(productId, -999, 'x', admin.id)).toThrow(/no puede quedar negativo/)
    expect(stockOf(productId)).toBe(10)
    expect(auditCount(db)).toBe(0)
  })

  test('4 — NaN throws and writes nothing (no longer relies on the DB NOT NULL accident)', () => {
    expect(() => adjustStock(productId, NaN, 'x', admin.id)).toThrow(/número válido/)
    expect(stockOf(productId)).toBe(10)
    expect(auditCount(db)).toBe(0)
  })

  test('5 — Infinity throws and writes nothing', () => {
    expect(() => adjustStock(productId, Infinity, 'x', admin.id)).toThrow(/número válido/)
    expect(stockOf(productId)).toBe(10)
    expect(auditCount(db)).toBe(0)
  })

  test('6 — an unknown product id throws instead of crashing on undefined.stock', () => {
    expect(() => adjustStock(999_999, 5, 'x', admin.id)).toThrow(/Producto no encontrado/)
    expect(auditCount(db)).toBe(0)
  })

  test('7 — a fractional (kg) resulting stock is accepted', () => {
    adjustStock(productId, 7.5, 'recuento', admin.id)
    expect(stockOf(productId)).toBe(7.5)
    expect(auditCount(db)).toBe(1)
  })
})
