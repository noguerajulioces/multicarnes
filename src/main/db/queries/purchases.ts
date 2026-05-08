import { getDb } from '../index'

export function getAllSuppliers(opts: { search?: string; page?: number; perPage?: number } = {}) {
  const db = getDb()
  const params: unknown[] = []
  let where = 'WHERE active = 1'
  if (opts.search) {
    where += ' AND name LIKE ?'
    params.push(`%${opts.search}%`)
  }
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM suppliers ${where}`).get(...params) as { c: number }
  ).c
  const isPaginated = opts.page !== undefined
  const page = Math.max(1, opts.page ?? 1)
  const perPage = opts.perPage ?? (isPaginated ? 50 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []
  const items = db
    .prepare(`SELECT * FROM suppliers ${where} ORDER BY name ${limitClause}`)
    .all(...params, ...limitParams)
  return { items, total, page, perPage: perPage || total }
}

export function getSupplierById(id: number) {
  return getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
}

export function createSupplier(data: {
  name: string
  phone?: string
  email?: string
  address?: string
}) {
  const result = getDb()
    .prepare('INSERT INTO suppliers (name, phone, email, address) VALUES (?, ?, ?, ?)')
    .run(data.name, data.phone || null, data.email || null, data.address || null)
  return getSupplierById(result.lastInsertRowid as number)
}

export function updateSupplier(
  id: number,
  data: { name?: string; phone?: string; email?: string; address?: string; active?: boolean }
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
  if (data.email !== undefined) {
    fields.push('email = ?')
    params.push(data.email || null)
  }
  if (data.address !== undefined) {
    fields.push('address = ?')
    params.push(data.address || null)
  }
  if (data.active !== undefined) {
    fields.push('active = ?')
    params.push(data.active ? 1 : 0)
  }

  if (fields.length > 0) {
    params.push(id)
    db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }
  return getSupplierById(id)
}

export function getAllPurchaseOrders(
  opts: { status?: string; page?: number; perPage?: number } = {}
) {
  const db = getDb()
  const params: unknown[] = []
  let where = ''
  if (opts.status) {
    where = 'WHERE po.status = ?'
    params.push(opts.status)
  }
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM purchase_orders po ${where}`).get(...params) as {
      c: number
    }
  ).c
  const isPaginated = opts.page !== undefined
  const page = Math.max(1, opts.page ?? 1)
  const perPage = opts.perPage ?? (isPaginated ? 50 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []
  const items = db
    .prepare(
      `
      SELECT po.*, s.name as supplier_name, u.name as user_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.user_id = u.id
      ${where}
      ORDER BY po.created_at DESC
      ${limitClause}
    `
    )
    .all(...params, ...limitParams)
  return { items, total, page, perPage: perPage || total }
}

export function getPurchaseOrderById(id: number) {
  const db = getDb()
  const order = db
    .prepare(
      `
    SELECT po.*, s.name as supplier_name, u.name as user_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.user_id = u.id
    WHERE po.id = ?
  `
    )
    .get(id) as Record<string, unknown> | undefined
  if (!order) return null

  order.items = db
    .prepare(
      `
    SELECT pi.*, p.name as product_name, p.price_type as price_type
    FROM purchase_items pi
    LEFT JOIN products p ON pi.product_id = p.id
    WHERE pi.order_id = ?
  `
    )
    .all(id)
  return order
}

export function createPurchaseOrder(data: {
  supplierId: number | null
  userId: number
  items: { productId: number; quantity: number; unitCost: number; subtotal: number }[]
  total: number
  notes?: string
  receive?: boolean
}) {
  const db = getDb()
  const txn = db.transaction(() => {
    const status = data.receive ? 'received' : 'pending'

    const result = db
      .prepare(
        `
      INSERT INTO purchase_orders (supplier_id, user_id, total, status, notes, received_at)
      VALUES (?, ?, ?, ?, ?, ${data.receive ? "datetime('now','localtime')" : '?'})
    `
      )
      .run(
        data.supplierId,
        data.userId,
        data.total,
        status,
        data.notes || null,
        ...(data.receive ? [] : [null])
      )

    const orderId = result.lastInsertRowid as number
    const insertItem = db.prepare(
      'INSERT INTO purchase_items (order_id, product_id, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?)'
    )
    const readStock = db.prepare('SELECT stock FROM products WHERE id = ?')
    const updateStock = db.prepare(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now','localtime') WHERE id = ?"
    )
    // P5: purchase reception writes a stock_adjustments row so the audit
    // trail is complete (previously bypassed the audit table).
    const insertAdjustment = db.prepare(
      'INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)'
    )

    for (const item of data.items) {
      insertItem.run(orderId, item.productId, item.quantity, item.unitCost, item.subtotal)
      if (data.receive) {
        const before = (readStock.get(item.productId) as { stock: number } | undefined)?.stock ?? 0
        updateStock.run(item.quantity, item.productId)
        insertAdjustment.run(
          item.productId,
          data.userId,
          before,
          before + item.quantity,
          `Recepción compra #${orderId}`
        )
      }
    }
    return getPurchaseOrderById(orderId)
  })
  return txn()
}

export function receivePurchaseOrder(id: number) {
  const db = getDb()
  const txn = db.transaction(() => {
    const items = db.prepare('SELECT * FROM purchase_items WHERE order_id = ?').all(id) as {
      product_id: number
      quantity: number
    }[]
    // The IPC layer does not yet pass the receiving user (will land with the
    // 001-ipc-authorization feature). Conservative fallback: attribute the
    // audit row to the order creator. TODO(001-ipc-authorization): replace
    // with the authenticated caller's userId.
    const order = db.prepare('SELECT user_id FROM purchase_orders WHERE id = ?').get(id) as
      | { user_id: number }
      | undefined
    const auditUserId = order?.user_id ?? 0
    const readStock = db.prepare('SELECT stock FROM products WHERE id = ?')
    const updateStock = db.prepare(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now','localtime') WHERE id = ?"
    )
    const insertAdjustment = db.prepare(
      'INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)'
    )
    for (const item of items) {
      const before = (readStock.get(item.product_id) as { stock: number } | undefined)?.stock ?? 0
      updateStock.run(item.quantity, item.product_id)
      insertAdjustment.run(
        item.product_id,
        auditUserId,
        before,
        before + item.quantity,
        `Recepción compra #${id}`
      )
    }
    db.prepare(
      "UPDATE purchase_orders SET status = 'received', received_at = datetime('now','localtime') WHERE id = ?"
    ).run(id)
    return getPurchaseOrderById(id)
  })
  return txn()
}

export function cancelPurchaseOrder(id: number) {
  getDb().prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(id)
  return getPurchaseOrderById(id)
}
