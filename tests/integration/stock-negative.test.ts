import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createSale } from '../../src/main/db/queries/sales'
import { getCustomerById } from '../../src/main/db/queries/customers'
import { getProductById } from '../../src/main/db/queries/products'
import {
  createTestDb,
  seedUser,
  seedCustomer,
  seedOpenRegister,
  countRows,
  type SeededUser
} from './_fixtures/db'

function seedProduct(
  db: Database.Database,
  opts: { stock?: number; priceType?: string; name?: string } = {}
): number {
  const stock = opts.stock ?? 100
  const priceType = opts.priceType ?? 'unit'
  const name = opts.name ?? 'Lomo'
  const info = db
    .prepare(
      'INSERT INTO products (name, price, price_type, stock, min_stock) VALUES (?, 1, ?, ?, 0)'
    )
    .run(name, priceType, stock)
  return info.lastInsertRowid as number
}

const stockOf = (productId: number): number =>
  (getProductById(productId) as { stock: number }).stock
const balanceOf = (customerId: number): number =>
  (getCustomerById(customerId) as { balance: number }).balance

// ---------------------------------------------------------------------------
// No-negative-stock policy — enforced inside createSale BEFORE any write. A sale
// may bring a product's stock down to exactly zero but never below. Hard block,
// every product / payment method / role, no override. The throw rolls the whole
// transaction back (stock, sale rows and adjustments untouched).
// ---------------------------------------------------------------------------
describe('createSale — no negative stock', () => {
  let db: Database.Database
  let cajero: SeededUser
  let registerId: number

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    registerId = seedOpenRegister(db, cajero.id, 0).id
  })

  // Single-product cash sale of `quantity` at `unitPrice`.
  function cashSale(productId: number, quantity: number, unitPrice = 1000) {
    const subtotal = Math.round(quantity * unitPrice)
    return {
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId, quantity, unitPrice, subtotal }],
      subtotal,
      discount: 0,
      total: subtotal,
      paymentMethod: 'cash'
    }
  }

  test('1 — selling exactly the available stock succeeds and lands at zero', () => {
    const p = seedProduct(db, { stock: 5 })
    createSale(cashSale(p, 5))
    expect(stockOf(p)).toBe(0)
  })

  test('2 — selling one over stock throws and rolls everything back', () => {
    const p = seedProduct(db, { stock: 5 })
    expect(() => createSale(cashSale(p, 6))).toThrow(/Stock insuficiente/)
    expect(stockOf(p)).toBe(5) // untouched
    expect(countRows(db, 'sales')).toBe(0)
    expect(countRows(db, 'sale_items')).toBe(0)
    expect(countRows(db, 'stock_adjustments')).toBe(0)
  })

  test('3 — a product at zero stock cannot be sold at all', () => {
    const p = seedProduct(db, { stock: 0 })
    expect(() => createSale(cashSale(p, 1))).toThrow(/Stock insuficiente/)
    expect(stockOf(p)).toBe(0)
    expect(countRows(db, 'sales')).toBe(0)
  })

  test('4 — selling under stock succeeds and decrements exactly', () => {
    const p = seedProduct(db, { stock: 10 })
    createSale(cashSale(p, 3))
    expect(stockOf(p)).toBe(7)
  })

  test('5 — weight product (kg): exact fractional stock fits, a hair over is blocked', () => {
    const p = seedProduct(db, { stock: 2.5, priceType: 'kg', name: 'Carne molida' })
    // 2.6 > 2.5 → blocked
    expect(() => createSale(cashSale(p, 2.6))).toThrow(/Stock insuficiente/)
    expect(stockOf(p)).toBe(2.5)
    // 2.5 == 2.5 → fits (float tolerance), lands at 0
    createSale(cashSale(p, 2.5))
    expect(stockOf(p)).toBeCloseTo(0, 6)
  })

  test('6 — multiple lines of the SAME product are aggregated against stock', () => {
    const p = seedProduct(db, { stock: 5 })
    const twoLines = (q1: number, q2: number) => {
      const s1 = q1 * 1000
      const s2 = q2 * 1000
      return {
        registerId,
        userId: cajero.id,
        customerId: null,
        items: [
          { productId: p, quantity: q1, unitPrice: 1000, subtotal: s1 },
          { productId: p, quantity: q2, unitPrice: 1000, subtotal: s2 }
        ],
        subtotal: s1 + s2,
        discount: 0,
        total: s1 + s2,
        paymentMethod: 'cash'
      }
    }
    // 3 + 3 = 6 > 5 → blocked (a line-by-line check would have let each 3 pass)
    expect(() => createSale(twoLines(3, 3))).toThrow(/Stock insuficiente/)
    expect(stockOf(p)).toBe(5)
    expect(countRows(db, 'sales')).toBe(0)
    // 3 + 2 = 5 → exactly fits
    createSale(twoLines(3, 2))
    expect(stockOf(p)).toBe(0)
  })

  test('7 — one insufficient product rolls back the whole multi-product sale', () => {
    const a = seedProduct(db, { stock: 10, name: 'A' })
    const b = seedProduct(db, { stock: 1, name: 'B' })
    const sale = {
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [
        { productId: a, quantity: 5, unitPrice: 1000, subtotal: 5000 },
        { productId: b, quantity: 3, unitPrice: 1000, subtotal: 3000 }
      ],
      subtotal: 8000,
      discount: 0,
      total: 8000,
      paymentMethod: 'cash'
    }
    expect(() => createSale(sale)).toThrow(/Stock insuficiente.*"B"/)
    // The sufficient product's stock is NOT decremented — atomic rollback.
    expect(stockOf(a)).toBe(10)
    expect(stockOf(b)).toBe(1)
    expect(countRows(db, 'sales')).toBe(0)
  })

  test('8 — the guard is independent of payment method (credit over stock blocks)', () => {
    const p = seedProduct(db, { stock: 3 })
    const c = seedCustomer(db, { balance: 0 })
    expect(() =>
      createSale({
        registerId,
        userId: cajero.id,
        customerId: c.id,
        items: [{ productId: p, quantity: 5, unitPrice: 1000, subtotal: 5000 }],
        subtotal: 5000,
        discount: 0,
        total: 5000,
        paymentMethod: 'credit'
      })
    ).toThrow(/Stock insuficiente/)
    // Neither the customer's balance nor the stock moved.
    expect(balanceOf(c.id)).toBe(0)
    expect(stockOf(p)).toBe(3)
  })

  test('9 — mixed sale over stock blocks and leaves balance + stock intact', () => {
    const p = seedProduct(db, { stock: 3 })
    const c = seedCustomer(db, { balance: 0 })
    expect(() =>
      createSale({
        registerId,
        userId: cajero.id,
        customerId: c.id,
        items: [{ productId: p, quantity: 5, unitPrice: 1000, subtotal: 5000 }],
        subtotal: 5000,
        discount: 0,
        total: 5000,
        paymentMethod: 'mixed',
        payments: [
          { method: 'cash', amount: 2000 },
          { method: 'credit', amount: 3000 }
        ]
      })
    ).toThrow(/Stock insuficiente/)
    expect(balanceOf(c.id)).toBe(0)
    expect(stockOf(p)).toBe(3)
  })

  test('10 — the error names the product and reports available vs requested', () => {
    const p = seedProduct(db, { stock: 2, name: 'Costilla' })
    expect(() => createSale(cashSale(p, 5))).toThrow(/"Costilla".*Disponible.*2.*solicitado.*5/)
  })

  test('11 — ALL insufficient products are reported in one error (no fix-one-retry loop)', () => {
    const a = seedProduct(db, { stock: 1, name: 'Pechuga' })
    const b = seedProduct(db, { stock: 0, name: 'Muslo' })
    const sale = {
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [
        { productId: a, quantity: 3, unitPrice: 1000, subtotal: 3000 },
        { productId: b, quantity: 2, unitPrice: 1000, subtotal: 2000 }
      ],
      subtotal: 5000,
      discount: 0,
      total: 5000,
      paymentMethod: 'cash'
    }
    // A single throw must name BOTH offending products.
    let message = ''
    try {
      createSale(sale)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/Pechuga/)
    expect(message).toMatch(/Muslo/)
    expect(stockOf(a)).toBe(1)
    expect(stockOf(b)).toBe(0)
    expect(countRows(db, 'sales')).toBe(0)
  })
})
