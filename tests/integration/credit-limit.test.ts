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
  type SeededUser
} from './_fixtures/db'

function seedProduct(db: Database.Database, stock = 100): number {
  const info = db
    .prepare(
      "INSERT INTO products (name, price, price_type, stock, min_stock) VALUES ('Lomo', 1, 'unit', ?, 0)"
    )
    .run(stock)
  return info.lastInsertRowid as number
}

// Turn on a customer's límite de fiado. Pass amount=null to exercise the
// defensive "enabled but no amount" path.
function setLimit(
  db: Database.Database,
  customerId: number,
  amount: number | null,
  enabled = true
): void {
  db.prepare(
    'UPDATE customers SET credit_limit_enabled = ?, credit_limit_amount = ? WHERE id = ?'
  ).run(enabled ? 1 : 0, amount, customerId)
}

function balanceOf(customerId: number): number {
  return (getCustomerById(customerId) as { balance: number }).balance
}

// ---------------------------------------------------------------------------
// Per-customer credit limit (008-feature: límite de fiado) — enforced inside
// createSale on the total outstanding debt. Hard block, no override.
// ---------------------------------------------------------------------------
describe('createSale — credit limit (límite de fiado)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let registerId: number
  let productId: number

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    registerId = seedOpenRegister(db, cajero.id, 0).id
    productId = seedProduct(db, 100)
  })

  // A single-item credit sale for `amount` Gs to `customerId`.
  function creditSale(customerId: number, amount: number) {
    return {
      registerId,
      userId: cajero.id,
      customerId,
      items: [{ productId, quantity: 1, unitPrice: amount, subtotal: amount }],
      subtotal: amount,
      discount: 0,
      total: amount,
      paymentMethod: 'credit'
    }
  }

  // A mixed sale: `cashAmt` cash + `creditAmt` on credit.
  function mixedSale(customerId: number, cashAmt: number, creditAmt: number) {
    const total = cashAmt + creditAmt
    return {
      registerId,
      userId: cajero.id,
      customerId,
      items: [{ productId, quantity: 1, unitPrice: total, subtotal: total }],
      subtotal: total,
      discount: 0,
      total,
      paymentMethod: 'mixed',
      payments: [
        { method: 'cash', amount: cashAmt },
        { method: 'credit', amount: creditAmt }
      ]
    }
  }

  test('1 — credit sale within the limit succeeds and lowers the balance', () => {
    const c = seedCustomer(db, { balance: 0 })
    setLimit(db, c.id, 100_000)
    createSale(creditSale(c.id, 50_000))
    expect(balanceOf(c.id)).toBe(-50_000)
  })

  test('2 — credit sale exceeding the limit throws and rolls everything back', () => {
    const c = seedCustomer(db, { balance: 0 })
    setLimit(db, c.id, 50_000)
    expect(() => createSale(creditSale(c.id, 60_000))).toThrow(/Límite de fiado superado/)
    // rolled back: balance and stock untouched
    expect(balanceOf(c.id)).toBe(0)
    expect((getProductById(productId) as { stock: number }).stock).toBe(100)
  })

  test('3 — existing debt + new credit that pushes over the limit throws', () => {
    const c = seedCustomer(db, { balance: -40_000 })
    setLimit(db, c.id, 50_000)
    // currentDebt 40k + 20k = 60k > 50k
    expect(() => createSale(creditSale(c.id, 20_000))).toThrow(/Límite de fiado superado/)
    expect(balanceOf(c.id)).toBe(-40_000)
  })

  test('4 — existing debt + new credit that stays within the limit succeeds', () => {
    const c = seedCustomer(db, { balance: -40_000 })
    setLimit(db, c.id, 100_000)
    createSale(creditSale(c.id, 20_000))
    expect(balanceOf(c.id)).toBe(-60_000)
  })

  test('5 — a disabled limit never blocks', () => {
    const c = seedCustomer(db, { balance: 0 })
    // credit_limit_enabled stays 0 (default) — no setLimit call
    createSale(creditSale(c.id, 999_000))
    expect(balanceOf(c.id)).toBe(-999_000)
  })

  test('6 — enabled limit with a NULL amount never blocks (defensive)', () => {
    const c = seedCustomer(db, { balance: 0 })
    setLimit(db, c.id, null, true)
    createSale(creditSale(c.id, 80_000))
    expect(balanceOf(c.id)).toBe(-80_000)
  })

  test('7 — mixed sale: only the credit portion counts toward the limit', () => {
    const ok = seedCustomer(db, { balance: 0 })
    setLimit(db, ok.id, 50_000)
    // cash 30k + credit 40k: total 70k but credit portion 40k <= 50k → OK
    createSale(mixedSale(ok.id, 30_000, 40_000))
    expect(balanceOf(ok.id)).toBe(-40_000)

    const blocked = seedCustomer(db, { balance: 0 })
    setLimit(db, blocked.id, 50_000)
    // credit portion 60k > 50k → blocked
    expect(() => createSale(mixedSale(blocked.id, 10_000, 60_000))).toThrow(
      /Límite de fiado superado/
    )
    expect(balanceOf(blocked.id)).toBe(0)
  })

  test('8 — a customer "a favor" (positive balance) gets the full limit, not more', () => {
    const c = seedCustomer(db, { balance: 30_000 })
    setLimit(db, c.id, 50_000)
    // currentDebt = 0 (positive balance is not debt) → 50k credit fits exactly
    createSale(creditSale(c.id, 50_000))
    expect(balanceOf(c.id)).toBe(-20_000)

    const c2 = seedCustomer(db, { balance: 30_000 })
    setLimit(db, c2.id, 50_000)
    expect(() => createSale(creditSale(c2.id, 60_000))).toThrow(/Límite de fiado superado/)
    expect(balanceOf(c2.id)).toBe(30_000)
  })

  test('9 — a cash sale (no credit portion) is never blocked', () => {
    const c = seedCustomer(db, { balance: 0 })
    setLimit(db, c.id, 10_000)
    const sale = createSale({
      registerId,
      userId: cajero.id,
      customerId: c.id,
      items: [{ productId, quantity: 1, unitPrice: 999_000, subtotal: 999_000 }],
      subtotal: 999_000,
      discount: 0,
      total: 999_000,
      paymentMethod: 'cash'
    }) as { total: number }
    expect(sale.total).toBe(999_000)
    // cash sale does not touch the balance
    expect(balanceOf(c.id)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// A credit (fiado) portion requires an associated customer. Without it, stock
// would leave inventory while no balance is ever debited — an uncollectable
// receivable. The renderer blocks it (CobroModal); createSale re-enforces it as
// the source of truth, rolling the whole transaction back on violation.
// ---------------------------------------------------------------------------
describe('createSale — credit portion requires a customer', () => {
  let db: Database.Database
  let cajero: SeededUser
  let registerId: number
  let productId: number

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    registerId = seedOpenRegister(db, cajero.id, 0).id
    productId = seedProduct(db, 100)
  })

  const stockOf = (): number => (getProductById(productId) as { stock: number }).stock

  test('1 — pure credit sale with no customer throws and rolls stock back', () => {
    expect(() =>
      createSale({
        registerId,
        userId: cajero.id,
        customerId: null,
        items: [{ productId, quantity: 1, unitPrice: 100_000, subtotal: 100_000 }],
        subtotal: 100_000,
        discount: 0,
        total: 100_000,
        paymentMethod: 'credit'
      })
    ).toThrow(/requiere un cliente/)
    // No sale row, no stock decrement.
    expect(stockOf()).toBe(100)
    expect((db.prepare('SELECT COUNT(*) as c FROM sales').get() as { c: number }).c).toBe(0)
  })

  test('2 — mixed sale with a credit line and no customer throws and rolls stock back', () => {
    expect(() =>
      createSale({
        registerId,
        userId: cajero.id,
        customerId: null,
        items: [{ productId, quantity: 1, unitPrice: 100_000, subtotal: 100_000 }],
        subtotal: 100_000,
        discount: 0,
        total: 100_000,
        paymentMethod: 'mixed',
        payments: [
          { method: 'cash', amount: 40_000 },
          { method: 'credit', amount: 60_000 }
        ]
      })
    ).toThrow(/requiere un cliente/)
    expect(stockOf()).toBe(100)
    expect((db.prepare('SELECT COUNT(*) as c FROM sales').get() as { c: number }).c).toBe(0)
  })

  test('3 — mixed sale WITHOUT a credit line is still allowed with no customer', () => {
    const sale = createSale({
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId, quantity: 1, unitPrice: 100_000, subtotal: 100_000 }],
      subtotal: 100_000,
      discount: 0,
      total: 100_000,
      paymentMethod: 'mixed',
      payments: [
        { method: 'cash', amount: 50_000 },
        { method: 'cash', amount: 50_000 }
      ]
    }) as { total: number }
    expect(sale.total).toBe(100_000)
    expect(stockOf()).toBe(99)
  })
})

// ---------------------------------------------------------------------------
// Migration v13 — additive credit-limit columns on customers.
// ---------------------------------------------------------------------------
describe('migration v13 — credit_limit columns', () => {
  test('M1 — fresh ledger ends with credit_limit_enabled (NOT NULL DEFAULT 0) and credit_limit_amount', () => {
    const db = createTestDb()
    const cols = db.prepare('PRAGMA table_info(customers)').all() as {
      name: string
      dflt_value: string | null
      notnull: number
    }[]
    const enabled = cols.find((c) => c.name === 'credit_limit_enabled')
    expect(enabled).toBeDefined()
    expect(enabled?.notnull).toBe(1)
    expect(enabled?.dflt_value).toBe('0')
    expect(cols.find((c) => c.name === 'credit_limit_amount')).toBeDefined()

    // A customer inserted without the columns defaults to enabled=0, amount=NULL.
    const c = db.prepare("INSERT INTO customers (name) VALUES ('c')").run()
    const row = db
      .prepare('SELECT credit_limit_enabled, credit_limit_amount FROM customers WHERE id = ?')
      .get(c.lastInsertRowid as number) as {
      credit_limit_enabled: number
      credit_limit_amount: number | null
    }
    expect(row.credit_limit_enabled).toBe(0)
    expect(row.credit_limit_amount).toBeNull()
  })

  test('M2 — re-running the migration runner is idempotent (no duplicate column, no error)', async () => {
    const db = createTestDb()
    const { runMigrationsForTesting } = await import('../../src/main/db')
    expect(() => runMigrationsForTesting(db)).not.toThrow()
    const cols = db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]
    expect(cols.filter((c) => c.name === 'credit_limit_enabled').length).toBe(1)
    expect(cols.filter((c) => c.name === 'credit_limit_amount').length).toBe(1)
  })
})
