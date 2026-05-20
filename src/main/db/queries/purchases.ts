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

// Cash model (decision #9): purchase orders never touch cash_registers /
// cash_movements. The shop pays suppliers outside the POS till (on account or
// separate cash), so creating/receiving a purchase only affects stock + cost
// history — never the drawer arqueo. If suppliers ever get paid from the till,
// this is the place to emit a cash 'expense' movement.
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

export function receivePurchaseOrder(id: number, userId: number) {
  const db = getDb()
  const txn = db.transaction(() => {
    // Defense-in-depth: the auth guard already validated the caller, but the
    // repository refuses to write stock_adjustments rows attributed to a
    // missing or inactive user (002-review-fixes FR-007).
    const userOk = db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(userId) as
      | { 1: number }
      | undefined
    if (!userOk) {
      throw new Error('receivePurchaseOrder: userId must reference an active user')
    }

    // Only a pending order can be received. Without this guard a second
    // 'receive' (double-click, stale page, second window) would add the stock
    // again and write a duplicate stock_adjustments row.
    const order = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id) as
      | { status: string }
      | undefined
    if (!order) throw new Error('Orden de compra no encontrada')
    if (order.status !== 'pending') {
      throw new Error('Solo se pueden recibir órdenes pendientes.')
    }

    const items = db.prepare('SELECT * FROM purchase_items WHERE order_id = ?').all(id) as {
      product_id: number
      quantity: number
    }[]
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
        userId,
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
  const db = getDb()
  const txn = db.transaction(() => {
    // Only a pending order can be cancelled (decision #3b). A received order
    // already added its stock; reversing it here could drive stock negative if
    // some was already sold, so undoing a reception is left to a manual stock
    // adjustment rather than a silent cancel.
    const order = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id) as
      | { status: string }
      | undefined
    if (!order) throw new Error('Orden de compra no encontrada')
    if (order.status !== 'pending') {
      throw new Error('Solo se pueden cancelar órdenes pendientes.')
    }
    db.prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(id)
    return getPurchaseOrderById(id)
  })
  return txn()
}
