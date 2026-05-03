import { getDb } from '../index'

export function getAllCustomers(
  opts: { search?: string; isEmployee?: boolean; page?: number; perPage?: number } = {}
) {
  const db = getDb()
  const params: unknown[] = []
  const conditions: string[] = []
  if (opts.search) {
    const term = `%${opts.search}%`
    conditions.push('(name LIKE ? OR phone LIKE ? OR document LIKE ?)')
    params.push(term, term, term)
  }
  if (opts.isEmployee !== undefined) {
    conditions.push('is_employee = ?')
    params.push(opts.isEmployee ? 1 : 0)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM customers ${where}`).get(...params) as { c: number }
  ).c
  const isPaginated = opts.page !== undefined
  const page = Math.max(1, opts.page ?? 1)
  const perPage = opts.perPage ?? (isPaginated ? 50 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []
  const items = db
    .prepare(`SELECT * FROM customers ${where} ORDER BY name ${limitClause}`)
    .all(...params, ...limitParams)
  return { items, total, page, perPage: perPage || total }
}

export function getCustomerById(id: number) {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id)
}

export function createCustomer(data: {
  name: string
  phone?: string
  address?: string
  document?: string
  document_type?: 'CI' | 'RUC' | null
  is_employee?: boolean
}) {
  const result = getDb()
    .prepare(
      'INSERT INTO customers (name, phone, address, document, document_type, is_employee) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      data.name,
      data.phone || null,
      data.address || null,
      data.document || null,
      data.document ? data.document_type || null : null,
      data.is_employee ? 1 : 0
    )
  return getCustomerById(result.lastInsertRowid as number)
}

export function updateCustomer(
  id: number,
  data: {
    name?: string
    phone?: string
    address?: string
    document?: string
    document_type?: 'CI' | 'RUC' | null
    is_employee?: boolean
  }
) {
  const db = getDb()
  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    params.push(data.name)
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?')
    params.push(data.phone || null)
  }
  if (data.address !== undefined) {
    fields.push('address = ?')
    params.push(data.address || null)
  }
  if (data.document !== undefined) {
    fields.push('document = ?')
    params.push(data.document || null)
    fields.push('document_type = ?')
    params.push(data.document ? data.document_type || null : null)
  }
  if (data.is_employee !== undefined) {
    fields.push('is_employee = ?')
    params.push(data.is_employee ? 1 : 0)
  }

  if (fields.length > 0) {
    params.push(id)
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }
  return getCustomerById(id)
}

export function addCustomerPayment(
  customerId: number,
  userId: number,
  amount: number,
  note?: string
) {
  const db = getDb()
  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO customer_payments (customer_id, user_id, amount, note) VALUES (?, ?, ?, ?)'
    ).run(customerId, userId, amount, note || null)
    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(amount, customerId)
    return getCustomerById(customerId)
  })
  return txn()
}

export function getCustomerPayments(customerId: number) {
  return getDb()
    .prepare(
      `
    SELECT cp.*, u.name as user_name
    FROM customer_payments cp
    LEFT JOIN users u ON cp.user_id = u.id
    WHERE cp.customer_id = ?
    ORDER BY cp.created_at DESC
  `
    )
    .all(customerId)
}

export function getCustomerSales(customerId: number) {
  const db = getDb()
  const sales = db
    .prepare(
      `
    SELECT s.*, u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `
    )
    .all(customerId) as Record<string, unknown>[]

  const itemsStmt = db.prepare(`
    SELECT si.*, p.name as product_name, p.price_type
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `)

  for (const sale of sales) {
    sale.items = itemsStmt.all(sale.id)
  }

  return sales
}
