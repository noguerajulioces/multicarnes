import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerSales,
  addCustomerPayment
} from '../../src/main/db/queries/customers'
import {
  createTestDb,
  seedUser,
  seedCustomer,
  seedOpenRegister,
  type SeededUser
} from './_fixtures/db'

interface CustomerRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  document: string | null
  document_type: 'CI' | 'RUC' | null
  is_employee: number
  balance: number
}

interface PaginatedResult {
  items: CustomerRow[]
  total: number
  page: number
  perPage: number
}

describe('getAllCustomers', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
    seedCustomer(db, { name: 'Alice', balance: 0, isEmployee: true })
    seedCustomer(db, { name: 'Bob', balance: -100, isEmployee: false })
    seedCustomer(db, { name: 'Carol', balance: 50, isEmployee: false })
  })

  test('returns all customers ordered by name when called without options', () => {
    const result = getAllCustomers() as PaginatedResult
    expect(result.items.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Carol'])
    expect(result.total).toBe(3)
  })

  test('search filter matches the name column (LIKE %term%)', () => {
    const result = getAllCustomers({ search: 'ob' }) as PaginatedResult
    expect(result.items.map((c) => c.name)).toEqual(['Bob'])
  })

  test('search filter also matches phone and document', () => {
    db.prepare('UPDATE customers SET phone = ? WHERE name = ?').run('555-1234', 'Alice')
    db.prepare('UPDATE customers SET document = ? WHERE name = ?').run('CI-99', 'Carol')

    expect(
      (getAllCustomers({ search: '555' }) as PaginatedResult).items.map((c) => c.name)
    ).toEqual(['Alice'])
    expect((getAllCustomers({ search: '99' }) as PaginatedResult).items.map((c) => c.name)).toEqual(
      ['Carol']
    )
  })

  test('isEmployee=true returns only employees', () => {
    const result = getAllCustomers({ isEmployee: true }) as PaginatedResult
    expect(result.items.map((c) => c.name)).toEqual(['Alice'])
  })

  test('isEmployee=false returns only non-employees', () => {
    const result = getAllCustomers({ isEmployee: false }) as PaginatedResult
    expect(result.items.map((c) => c.name).sort()).toEqual(['Bob', 'Carol'])
  })

  test('page+perPage paginates by name order', () => {
    const page1 = getAllCustomers({ page: 1, perPage: 2 }) as PaginatedResult
    expect(page1.items.map((c) => c.name)).toEqual(['Alice', 'Bob'])
    expect(page1.total).toBe(3)
    expect(page1.perPage).toBe(2)

    const page2 = getAllCustomers({ page: 2, perPage: 2 }) as PaginatedResult
    expect(page2.items.map((c) => c.name)).toEqual(['Carol'])
  })

  test('page=0 is clamped to 1 (no offset underflow)', () => {
    const result = getAllCustomers({ page: 0, perPage: 1 }) as PaginatedResult
    expect(result.page).toBe(1)
    expect(result.items.map((c) => c.name)).toEqual(['Alice'])
  })
})

describe('createCustomer', () => {
  beforeEach(() => {
    createTestDb()
  })

  test('creates a minimal customer with just a name', () => {
    const created = createCustomer({ name: 'Solo Nombre' }) as CustomerRow
    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('Solo Nombre')
    expect(created.phone).toBeNull()
    expect(created.address).toBeNull()
    expect(created.document).toBeNull()
    expect(created.document_type).toBeNull()
    expect(created.is_employee).toBe(0)
    expect(created.balance).toBe(0)
  })

  test('persists phone, address, document, document_type, is_employee', () => {
    const created = createCustomer({
      name: 'Full',
      phone: '0980-111-222',
      address: 'Av. Costanera 100',
      document: 'CI-1234',
      document_type: 'CI',
      is_employee: true
    }) as CustomerRow
    expect(created.phone).toBe('0980-111-222')
    expect(created.address).toBe('Av. Costanera 100')
    expect(created.document).toBe('CI-1234')
    expect(created.document_type).toBe('CI')
    expect(created.is_employee).toBe(1)
  })

  test('document_type is nulled when document is empty (cannot have a type without a number)', () => {
    const created = createCustomer({ name: 'NoDoc', document_type: 'RUC' }) as CustomerRow
    expect(created.document).toBeNull()
    expect(created.document_type).toBeNull()
  })
})

describe('updateCustomer', () => {
  let db: Database.Database
  let alice: ReturnType<typeof seedCustomer>

  beforeEach(() => {
    db = createTestDb()
    alice = seedCustomer(db, { name: 'Alice' })
  })

  test('updates only the provided fields, leaves others untouched', () => {
    const result = updateCustomer(alice.id, { name: 'Alice Renamed' }) as CustomerRow
    expect(result.name).toBe('Alice Renamed')
    expect(result.is_employee).toBe(0)
  })

  test('empty phone string clears the column to NULL (not "")', () => {
    db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run('555-old', alice.id)
    const result = updateCustomer(alice.id, { phone: '' }) as CustomerRow
    expect(result.phone).toBeNull()
  })

  test('setting document clears document_type when document is empty', () => {
    db.prepare('UPDATE customers SET document = ?, document_type = ? WHERE id = ?').run(
      'CI-old',
      'CI',
      alice.id
    )
    const result = updateCustomer(alice.id, { document: '', document_type: 'CI' }) as CustomerRow
    expect(result.document).toBeNull()
    expect(result.document_type).toBeNull()
  })

  test('is_employee flag updates accordingly', () => {
    const a = updateCustomer(alice.id, { is_employee: true }) as CustomerRow
    expect(a.is_employee).toBe(1)
    const b = updateCustomer(alice.id, { is_employee: false }) as CustomerRow
    expect(b.is_employee).toBe(0)
  })

  test('calling update with no fields is a no-op (does not throw)', () => {
    expect(() => updateCustomer(alice.id, {})).not.toThrow()
  })
})

describe('deleteCustomer', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('deletes a customer with zero balance and no sales/payments', () => {
    const c = seedCustomer(db, { balance: 0 })
    const result = deleteCustomer(c.id)
    expect(result).toEqual({ ok: true })
    expect(getCustomerById(c.id)).toBeUndefined()
  })

  test('returns ok:false with explanatory error when the customer does not exist', () => {
    const result = deleteCustomer(99_999)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no encontrado/i)
  })

  test('rejects deletion when the customer has a non-zero balance', () => {
    const c = seedCustomer(db, { balance: -1 })
    const result = deleteCustomer(c.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/saldo pendiente/i)
  })

  test('rejects deletion when the customer has a recorded sale', () => {
    const c = seedCustomer(db, { balance: 0 })
    const register = seedOpenRegister(db, cajero.id, 0)
    db.prepare(
      `INSERT INTO sales (register_id, customer_id, user_id, subtotal, discount, total, payment_method)
       VALUES (?, ?, ?, 1000, 0, 1000, 'cash')`
    ).run(register.id, c.id, cajero.id)
    const result = deleteCustomer(c.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/ventas registradas/i)
  })

  test('rejects deletion when the customer has a recorded payment (even after balance was zeroed manually)', () => {
    const c = seedCustomer(db, { balance: -10_000 })
    seedOpenRegister(db, cajero.id, 0)
    addCustomerPayment({
      customerId: c.id,
      userId: cajero.id,
      amount: 10_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    // After the payment, balance is 0 but the customer_payments row still exists.
    const result = deleteCustomer(c.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/pagos registrados/i)
  })
})

describe('getCustomerSales', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('returns each sale with its items and payments populated', () => {
    const customer = seedCustomer(db, { balance: 0 })
    const register = seedOpenRegister(db, cajero.id, 0)
    // Insert a product so sale_items has a valid product_id FK.
    const prod = db.prepare('INSERT INTO products (name, price) VALUES (?, ?)').run('Bife', 50_000)
    const productId = prod.lastInsertRowid as number
    const sale = db
      .prepare(
        `INSERT INTO sales (register_id, customer_id, user_id, subtotal, discount, total, payment_method)
         VALUES (?, ?, ?, 50000, 0, 50000, 'mixed')`
      )
      .run(register.id, customer.id, cajero.id)
    const saleId = sale.lastInsertRowid as number
    db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
       VALUES (?, ?, 1, 50000, 50000)`
    ).run(saleId, productId)
    db.prepare(
      `INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, 'cash', 20000),
                                                                   (?, 'credit', 30000)`
    ).run(saleId, saleId)

    const sales = getCustomerSales(customer.id).items as Array<{
      id: number
      items: Array<{ product_name: string; subtotal: number }>
      payments: Array<{ method: string; amount: number }>
    }>
    expect(sales.length).toBe(1)
    expect(sales[0].items).toHaveLength(1)
    expect(sales[0].items[0].product_name).toBe('Bife')
    expect(sales[0].payments.map((p) => p.method).sort()).toEqual(['cash', 'credit'])
  })

  test('a customer with no sales returns an empty array', () => {
    const c = seedCustomer(db)
    expect(getCustomerSales(c.id).items).toEqual([])
  })
})
