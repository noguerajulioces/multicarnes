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

// ---------------------------------------------------------------------------
// Recovering a product that is ALREADY at negative stock. A sale can oversell
// (createSale has no floor — intentional for a butcher that weighs while the
// contable stock lags), leaving products.stock below 0. The adjustment looks
// only at the RESULTING stock, never at the starting point: adding enough to
// reach >= 0 is always allowed, while an adjustment that would LEAVE it negative
// is still rejected (the merchant should do a "Reemplazar" / recuento físico).
// ---------------------------------------------------------------------------
describe('adjustStock — recovering from negative stock (oversell)', () => {
  let db: Database.Database
  let admin: SeededUser

  beforeEach(() => {
    db = createTestDb()
    admin = seedUser(db, { role: 'admin' })
  })

  test('1 — starting at -5, "Sumar 10" (resulting 5) is accepted and audited -5 → 5', () => {
    const id = seedProduct(db, -5)
    // The modal computes applyStockAdjust('add', -5, 10) = 5 and sends the
    // absolute result; the backend only ever sees newStock = 5.
    adjustStock(id, 5, 'reposición tras sobreventa', admin.id)
    expect(stockOf(id)).toBe(5)
    const row = db
      .prepare('SELECT quantity_before, quantity_after FROM stock_adjustments WHERE product_id = ?')
      .get(id) as { quantity_before: number; quantity_after: number }
    expect(row.quantity_before).toBe(-5)
    expect(row.quantity_after).toBe(5)
  })

  test('2 — starting at -5, bringing it exactly to 0 is accepted', () => {
    const id = seedProduct(db, -5)
    adjustStock(id, 0, 'recuento físico', admin.id)
    expect(stockOf(id)).toBe(0)
    expect(auditCount(db)).toBe(1)
  })

  test('3 — starting at -5, an adjustment that stays negative (e.g. -2) is rejected', () => {
    const id = seedProduct(db, -5)
    // "Sumar 3" from -5 resolves to -2 — still negative, so blocked; the -5 stands.
    expect(() => adjustStock(id, -2, 'reposición parcial', admin.id)).toThrow(
      /no puede quedar negativo/
    )
    expect(stockOf(id)).toBe(-5)
    expect(auditCount(db)).toBe(0)
  })
})
