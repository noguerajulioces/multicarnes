import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createSale, cancelSale } from '../../src/main/db/queries/sales'
import { getProductById } from '../../src/main/db/queries/products'
import { getCashRegisterSummary } from '../../src/main/db/queries/cash'
import { createTestDb, seedUser, seedOpenRegister, type SeededUser } from './_fixtures/db'

function seedProduct(db: Database.Database, stock = 10): number {
  const info = db
    .prepare(
      "INSERT INTO products (name, price, price_type, stock, min_stock) VALUES ('Lomo', 1, 'unit', ?, 0)"
    )
    .run(stock)
  return info.lastInsertRowid as number
}

const statusOf = (db: Database.Database, saleId: number): string =>
  (db.prepare('SELECT status FROM sales WHERE id = ?').get(saleId) as { status: string }).status
const stockOf = (id: number): number => (getProductById(id) as { stock: number }).stock
const cashMovTypeCount = (db: Database.Database): number =>
  (
    db
      .prepare("SELECT COUNT(*) AS c FROM cash_movements WHERE type IN ('income','expense')")
      .get() as { c: number }
  ).c

interface Summary {
  register: { opening_amount: number }
  cashSales: number
  incomes: number
  expenses: number
}
// expected = apertura + ventas_efectivo + ingresos − egresos
const expectedOf = (regId: number): number => {
  const s = getCashRegisterSummary(regId) as unknown as Summary
  return s.register.opening_amount + s.cashSales + s.incomes - s.expenses
}

// ---------------------------------------------------------------------------
// 003/#3 — cancelling a CASH sale must keep the cash arqueo consistent:
//   - block when the sale's register is already CLOSED (frozen reconciliation)
//   - on an OPEN register, post a netting income/expense pair so `expected`
//     stays correct AND the refund is auditable in Movimientos de Caja.
// ---------------------------------------------------------------------------
describe('cancelSale — cash reconciliation', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  function cashSale(registerId: number, productId: number, total = 50_000) {
    return createSale({
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId, quantity: 2, unitPrice: total / 2, subtotal: total }],
      subtotal: total,
      discount: 0,
      total,
      paymentMethod: 'cash'
    }) as { id: number }
  }

  test('1 — cancel on OPEN register nets expected back to opening + writes the audit pair', () => {
    const reg = seedOpenRegister(db, cajero.id, 100_000)
    const pid = seedProduct(db, 10)
    const sale = cashSale(reg.id, pid, 50_000)

    // before: opening 100k + cash sale 50k = 150k expected
    expect(expectedOf(reg.id)).toBe(150_000)

    cancelSale(sale.id, cajero.id)

    // after: cash sale drops out; income 50k + expense 50k net 0 -> expected 100k
    const after = getCashRegisterSummary(reg.id) as unknown as Summary
    expect(after.cashSales).toBe(0)
    expect(after.incomes).toBe(50_000)
    expect(after.expenses).toBe(50_000)
    expect(expectedOf(reg.id)).toBe(100_000)

    // exactly one income + one expense, both for the cash portion
    const movs = db
      .prepare(
        "SELECT type, amount FROM cash_movements WHERE register_id = ? AND type IN ('income','expense') ORDER BY type"
      )
      .all(reg.id)
    expect(movs).toEqual([
      { type: 'expense', amount: 50_000 },
      { type: 'income', amount: 50_000 }
    ])

    // stock restored, sale cancelled
    expect(stockOf(pid)).toBe(10)
    expect(statusOf(db, sale.id)).toBe('cancelled')
  })

  test('2 — cancel on a CLOSED register is blocked and rolls everything back', () => {
    const reg = seedOpenRegister(db, cajero.id, 100_000)
    const pid = seedProduct(db, 10)
    const sale = cashSale(reg.id, pid, 50_000) // stock 10 -> 8
    db.prepare("UPDATE cash_registers SET status = 'closed' WHERE id = ?").run(reg.id)

    expect(() => cancelSale(sale.id, cajero.id)).toThrow(/caja ya cerrada/)

    // nothing changed: sale stays completed, stock stays decremented, no pair
    expect(statusOf(db, sale.id)).toBe('completed')
    expect(stockOf(pid)).toBe(8)
    expect(cashMovTypeCount(db)).toBe(0)
  })

  test('3 — cancel a MIXED (cash+card) sale: the pair covers only the cash portion', () => {
    const reg = seedOpenRegister(db, cajero.id, 100_000)
    const pid = seedProduct(db, 10)
    const sale = createSale({
      registerId: reg.id,
      userId: cajero.id,
      customerId: null,
      items: [{ productId: pid, quantity: 2, unitPrice: 25_000, subtotal: 50_000 }],
      subtotal: 50_000,
      discount: 0,
      total: 50_000,
      paymentMethod: 'mixed',
      payments: [
        { method: 'cash', amount: 30_000 },
        { method: 'card', amount: 20_000, processor: 'bancard', reference: '123' }
      ]
    }) as { id: number }

    cancelSale(sale.id, cajero.id)

    const after = getCashRegisterSummary(reg.id) as unknown as Summary
    // only the 30k cash portion is reversed; the 20k card never touched the till
    expect(after.incomes).toBe(30_000)
    expect(after.expenses).toBe(30_000)
    expect(expectedOf(reg.id)).toBe(100_000)
    expect(statusOf(db, sale.id)).toBe('cancelled')
  })

  test('4 — a CARD sale (no cash) can still be cancelled on a closed register', () => {
    const reg = seedOpenRegister(db, cajero.id, 100_000)
    const pid = seedProduct(db, 10)
    const sale = createSale({
      registerId: reg.id,
      userId: cajero.id,
      customerId: null,
      items: [{ productId: pid, quantity: 2, unitPrice: 25_000, subtotal: 50_000 }],
      subtotal: 50_000,
      discount: 0,
      total: 50_000,
      paymentMethod: 'card',
      paymentProcessor: 'bancard',
      paymentReference: '123'
    }) as { id: number }
    db.prepare("UPDATE cash_registers SET status = 'closed' WHERE id = ?").run(reg.id)

    // no cash portion -> not blocked
    expect(() => cancelSale(sale.id, cajero.id)).not.toThrow()
    expect(statusOf(db, sale.id)).toBe('cancelled')
    expect(stockOf(pid)).toBe(10) // restocked
    expect(cashMovTypeCount(db)).toBe(0) // no drawer movement
  })
})
