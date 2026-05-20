import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createSale } from '../../src/main/db/queries/sales'
import { topProducts } from '../../src/main/db/queries/reports'
import { createTestDb, seedUser, seedOpenRegister, type SeededUser } from './_fixtures/db'

function seedProduct(db: Database.Database, name: string): number {
  const info = db
    .prepare(
      "INSERT INTO products (name, price, price_type, stock, min_stock) VALUES (?, 10000, 'unit', 1000, 0)"
    )
    .run(name)
  return info.lastInsertRowid as number
}

type Row = { product_name: string; total_revenue: number; total_revenue_net: number }
// Wide range to avoid any local-vs-UTC date edge near midnight.
const FROM = '2000-01-01'
const TO = '2999-12-31'

describe('topProducts — gross vs net revenue (#7)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let registerId: number
  let pA: number
  let pB: number

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    registerId = seedOpenRegister(db, cajero.id, 0).id
    pA = seedProduct(db, 'A')
    pB = seedProduct(db, 'B')
  })

  test('allocates the sale discount across products; net lines sum to the sale total', () => {
    createSale({
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [
        { productId: pA, quantity: 6, unitPrice: 10_000, subtotal: 60_000 },
        { productId: pB, quantity: 4, unitPrice: 10_000, subtotal: 40_000 }
      ],
      subtotal: 100_000,
      discount: 10_000,
      total: 90_000,
      paymentMethod: 'cash'
    })

    const rows = topProducts(FROM, TO) as Row[]
    const a = rows.find((r) => r.product_name === 'A') as Row
    const b = rows.find((r) => r.product_name === 'B') as Row

    // Gross = line subtotals (unchanged).
    expect(a.total_revenue).toBe(60_000)
    expect(b.total_revenue).toBe(40_000)

    // Net = subtotal * total/subtotal, i.e. 90% here.
    expect(a.total_revenue_net).toBe(54_000)
    expect(b.total_revenue_net).toBe(36_000)

    // The whole point of #7: net per product reconciles with the sale total.
    expect(a.total_revenue_net + b.total_revenue_net).toBe(90_000)
  })

  test('no discount → net equals gross', () => {
    createSale({
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId: pA, quantity: 5, unitPrice: 10_000, subtotal: 50_000 }],
      subtotal: 50_000,
      discount: 0,
      total: 50_000,
      paymentMethod: 'cash'
    })

    const rows = topProducts(FROM, TO) as Row[]
    const a = rows.find((r) => r.product_name === 'A') as Row
    expect(a.total_revenue).toBe(50_000)
    expect(a.total_revenue_net).toBe(50_000)
  })

  test('cancelled sales are excluded from both gross and net', () => {
    createSale({
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId: pA, quantity: 3, unitPrice: 10_000, subtotal: 30_000 }],
      subtotal: 30_000,
      discount: 0,
      total: 30_000,
      paymentMethod: 'cash'
    })
    // A second, cancelled sale must not contribute.
    db.prepare(
      `INSERT INTO sales (register_id, user_id, subtotal, discount, total, payment_method, status)
       VALUES (?, ?, 20000, 0, 20000, 'cash', 'cancelled')`
    ).run(registerId, cajero.id)
    const cancelledId = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }
    db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, 2, 10000, 20000)'
    ).run(cancelledId.id, pA)

    const rows = topProducts(FROM, TO) as Row[]
    const a = rows.find((r) => r.product_name === 'A') as Row
    expect(a.total_revenue).toBe(30_000)
    expect(a.total_revenue_net).toBe(30_000)
  })
})
