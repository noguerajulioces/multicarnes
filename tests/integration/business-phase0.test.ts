import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createSale } from '../../src/main/db/queries/sales'
import { closeCashRegister } from '../../src/main/db/queries/cash'
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder
} from '../../src/main/db/queries/purchases'
import { getProductById } from '../../src/main/db/queries/products'
import { createTestDb, seedUser, seedOpenRegister, type SeededUser } from './_fixtures/db'

function seedProduct(db: Database.Database, opts: { price?: number; stock?: number } = {}): number {
  const info = db
    .prepare(
      "INSERT INTO products (name, price, price_type, stock, min_stock) VALUES ('Lomo', ?, 'unit', ?, 0)"
    )
    .run(opts.price ?? 10_000, opts.stock ?? 100)
  return info.lastInsertRowid as number
}

// ---------------------------------------------------------------------------
// #4a — createSale must reject renderer-supplied amounts that don't add up.
// ---------------------------------------------------------------------------
describe('createSale — financial invariants (#4a)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let registerId: number
  let productId: number

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    registerId = seedOpenRegister(db, cajero.id, 0).id
    productId = seedProduct(db, { price: 10_000, stock: 100 })
  })

  function base() {
    return {
      registerId,
      userId: cajero.id,
      customerId: null,
      items: [{ productId, quantity: 2, unitPrice: 10_000, subtotal: 20_000 }],
      subtotal: 20_000,
      discount: 0,
      total: 20_000,
      paymentMethod: 'cash'
    }
  }

  test('accepts a consistent cash sale and decrements stock once', () => {
    const sale = createSale(base()) as { total: number }
    expect(sale.total).toBe(20_000)
    expect((getProductById(productId) as { stock: number }).stock).toBe(98)
  })

  test('rejects when the items do not sum to the subtotal', () => {
    expect(() => createSale({ ...base(), subtotal: 19_000, total: 19_000 })).toThrow(
      /Subtotal inconsistente/
    )
    // rolled back: stock untouched
    expect((getProductById(productId) as { stock: number }).stock).toBe(100)
  })

  test('rejects when total != subtotal - discount', () => {
    // discount 5.000 but total still 20.000 (should be 15.000)
    expect(() => createSale({ ...base(), discount: 5_000 })).toThrow(/El total no coincide/)
    expect((getProductById(productId) as { stock: number }).stock).toBe(100)
  })

  test('rejects a mixed sale whose payments do not sum to the total', () => {
    expect(() =>
      createSale({
        ...base(),
        paymentMethod: 'mixed',
        payments: [
          { method: 'cash', amount: 10_000 },
          { method: 'transfer', amount: 5_000, reference: 'TR-1' }
        ]
      })
    ).toThrow(/suma de los pagos/)
    expect((getProductById(productId) as { stock: number }).stock).toBe(100)
  })

  test('accepts a mixed sale whose payments sum to the total', () => {
    const sale = createSale({
      ...base(),
      paymentMethod: 'mixed',
      payments: [
        { method: 'cash', amount: 15_000 },
        { method: 'transfer', amount: 5_000, reference: 'TR-1' }
      ]
    }) as { total: number }
    expect(sale.total).toBe(20_000)
  })
})

// ---------------------------------------------------------------------------
// #11 — closeCashRegister must refuse to re-close a closed register.
// ---------------------------------------------------------------------------
describe('closeCashRegister — double-close guard (#11)', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('closes an open register once, then rejects a second close', () => {
    const registerId = seedOpenRegister(db, cajero.id, 50_000).id

    const closed = closeCashRegister(registerId, 50_000, undefined, cajero.id) as { status: string }
    expect(closed.status).toBe('closed')

    expect(() => closeCashRegister(registerId, 50_000, undefined, cajero.id)).toThrow(
      /ya está cerrada/
    )
    // still exactly one synthetic 'closing' movement
    const closings = db
      .prepare(
        "SELECT COUNT(*) as c FROM cash_movements WHERE register_id = ? AND type = 'closing'"
      )
      .get(registerId) as { c: number }
    expect(closings.c).toBe(1)
  })

  test('rejects closing a non-existent register', () => {
    expect(() => closeCashRegister(9999, 0, undefined, cajero.id)).toThrow(/no encontrada/)
  })
})

// ---------------------------------------------------------------------------
// #3a — receivePurchaseOrder must refuse a non-pending order (no double stock).
// ---------------------------------------------------------------------------
describe('receivePurchaseOrder — pending-only guard (#3a)', () => {
  let db: Database.Database
  let supervisor: SeededUser
  let productId: number

  beforeEach(() => {
    db = createTestDb()
    supervisor = seedUser(db, { role: 'supervisor' })
    productId = seedProduct(db, { stock: 100 })
  })

  test('receives a pending order once, then rejects a second receive', () => {
    const order = createPurchaseOrder({
      supplierId: null,
      userId: supervisor.id,
      items: [{ productId, quantity: 10, unitCost: 5_000, subtotal: 50_000 }],
      total: 50_000,
      receive: false
    }) as { id: number; status: string }
    expect(order.status).toBe('pending')

    const received = receivePurchaseOrder(order.id, supervisor.id) as { status: string }
    expect(received.status).toBe('received')
    expect((getProductById(productId) as { stock: number }).stock).toBe(110)

    expect(() => receivePurchaseOrder(order.id, supervisor.id)).toThrow(/órdenes pendientes/)
    // stock not added a second time
    expect((getProductById(productId) as { stock: number }).stock).toBe(110)
  })

  test('cancels a pending order, but rejects cancelling a received one (#3b)', () => {
    const pending = createPurchaseOrder({
      supplierId: null,
      userId: supervisor.id,
      items: [{ productId, quantity: 5, unitCost: 5_000, subtotal: 25_000 }],
      total: 25_000,
      receive: false
    }) as { id: number }
    const cancelled = cancelPurchaseOrder(pending.id) as { status: string }
    expect(cancelled.status).toBe('cancelled')

    const received = createPurchaseOrder({
      supplierId: null,
      userId: supervisor.id,
      items: [{ productId, quantity: 5, unitCost: 5_000, subtotal: 25_000 }],
      total: 25_000,
      receive: true
    }) as { id: number; status: string }
    expect(received.status).toBe('received')
    expect(() => cancelPurchaseOrder(received.id)).toThrow(/órdenes pendientes/)
  })
})
