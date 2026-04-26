import { getDb } from '../index'

export function getAllCustomers(search?: string) {
  const db = getDb()
  if (search) {
    return db.prepare('SELECT * FROM customers WHERE name LIKE ? ORDER BY name')
      .all(`%${search}%`)
  }
  return db.prepare('SELECT * FROM customers ORDER BY name').all()
}

export function getCustomerById(id: number) {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id)
}

export function createCustomer(data: { name: string; phone?: string; address?: string; is_employee?: boolean }) {
  const result = getDb()
    .prepare('INSERT INTO customers (name, phone, address, is_employee) VALUES (?, ?, ?, ?)')
    .run(data.name, data.phone || null, data.address || null, data.is_employee ? 1 : 0)
  return getCustomerById(result.lastInsertRowid as number)
}

export function updateCustomer(id: number, data: { name?: string; phone?: string; address?: string; is_employee?: boolean }) {
  const db = getDb()
  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone || null) }
  if (data.address !== undefined) { fields.push('address = ?'); params.push(data.address || null) }
  if (data.is_employee !== undefined) { fields.push('is_employee = ?'); params.push(data.is_employee ? 1 : 0) }

  if (fields.length > 0) {
    params.push(id)
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }
  return getCustomerById(id)
}

export function addCustomerPayment(customerId: number, userId: number, amount: number, note?: string) {
  const db = getDb()
  const txn = db.transaction(() => {
    db.prepare('INSERT INTO customer_payments (customer_id, user_id, amount, note) VALUES (?, ?, ?, ?)')
      .run(customerId, userId, amount, note || null)
    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?')
      .run(amount, customerId)
    return getCustomerById(customerId)
  })
  return txn()
}

export function getCustomerPayments(customerId: number) {
  return getDb().prepare(`
    SELECT cp.*, u.name as user_name
    FROM customer_payments cp
    LEFT JOIN users u ON cp.user_id = u.id
    WHERE cp.customer_id = ?
    ORDER BY cp.created_at DESC
  `).all(customerId)
}

export function getCustomerSales(customerId: number) {
  return getDb().prepare(`
    SELECT s.*, u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `).all(customerId)
}
