import { getDb } from '../index'

interface CreateSaleData {
  registerId: number
  userId: number
  customerId?: number | null
  items: { productId: number; quantity: number; unitPrice: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  payments?: { method: string; amount: number }[]
  notes?: string
}

export function createSale(data: CreateSaleData) {
  const db = getDb()
  const txn = db.transaction(() => {
    // P2: server-side guarantee that the target register is open. The renderer
    // already gates the POS UI on an open session, but a stale localStorage
    // cache or a tampered renderer could otherwise post sales onto a closed
    // register and corrupt the cash-session reconciliation report.
    const register = db
      .prepare('SELECT status FROM cash_registers WHERE id = ?')
      .get(data.registerId) as { status: string } | undefined
    if (!register || register.status !== 'open') {
      throw new Error('La caja indicada no está abierta. Abrí una nueva caja antes de continuar.')
    }

    const result = db
      .prepare(
        `
      INSERT INTO sales (register_id, customer_id, user_id, subtotal, discount, total, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        data.registerId,
        data.customerId || null,
        data.userId,
        data.subtotal,
        data.discount,
        data.total,
        data.paymentMethod,
        data.notes || null
      )
    const saleId = result.lastInsertRowid as number

    const insertItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)'
    )
    const readStock = db.prepare('SELECT stock FROM products WHERE id = ?')
    const updateStock = db.prepare(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now','localtime') WHERE id = ?"
    )
    // P5: every sale-driven decrement writes a stock_adjustments row so the
    // Mov. Stock report reflects the full audit trail (sales used to bypass
    // the audit table).
    const insertAdjustment = db.prepare(
      'INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)'
    )
    for (const item of data.items) {
      insertItem.run(saleId, item.productId, item.quantity, item.unitPrice, item.subtotal)
      const before = (readStock.get(item.productId) as { stock: number } | undefined)?.stock ?? 0
      updateStock.run(item.quantity, item.productId)
      insertAdjustment.run(
        item.productId,
        data.userId,
        before,
        before - item.quantity,
        `Venta #${saleId}`
      )
    }

    if (data.payments && data.payments.length > 0) {
      const insertPayment = db.prepare(
        'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)'
      )
      for (const p of data.payments) {
        insertPayment.run(saleId, p.method, p.amount)
      }
    }

    if (data.paymentMethod === 'credit' && data.customerId) {
      db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(
        data.total,
        data.customerId
      )
    }
    if (data.paymentMethod === 'mixed' && data.customerId && data.payments) {
      const creditAmount = data.payments
        .filter((p) => p.method === 'credit')
        .reduce((sum, p) => sum + p.amount, 0)
      if (creditAmount > 0) {
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(
          creditAmount,
          data.customerId
        )
      }
    }

    return getSaleById(saleId)
  })
  return txn()
}

export function getSaleById(id: number) {
  const db = getDb()
  const sale = db
    .prepare(
      `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `
    )
    .get(id) as Record<string, unknown> | undefined
  if (!sale) return null

  sale.items = db
    .prepare(
      `
    SELECT si.*, p.name as product_name
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `
    )
    .all(id)

  sale.payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id)
  return sale
}

export function getRecentSales(limit: number = 50) {
  return getDb()
    .prepare(
      `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT ?
  `
    )
    .all(limit)
}

export function getSalesByRegister(registerId: number) {
  return getDb()
    .prepare(
      `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.register_id = ?
    ORDER BY s.created_at DESC
  `
    )
    .all(registerId)
}

export function cancelSale(id: number, userId: number) {
  const db = getDb()
  const txn = db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Record<string, unknown>
    if (!sale || sale.status === 'cancelled') return null

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as {
      product_id: number
      quantity: number
    }[]
    const readStock = db.prepare('SELECT stock FROM products WHERE id = ?')
    const restock = db.prepare(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now','localtime') WHERE id = ?"
    )
    // P5: cancellation restock writes its own stock_adjustments row so the
    // restore is auditable alongside the original sale's adjustment.
    const insertAdjustment = db.prepare(
      'INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)'
    )
    for (const item of items) {
      const before = (readStock.get(item.product_id) as { stock: number } | undefined)?.stock ?? 0
      restock.run(item.quantity, item.product_id)
      insertAdjustment.run(
        item.product_id,
        userId,
        before,
        before + item.quantity,
        `Anulación venta #${id}`
      )
    }

    if (sale.payment_method === 'credit' && sale.customer_id) {
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(
        sale.total,
        sale.customer_id
      )
    }
    // TODO(P6 follow-up): when payment_method === 'mixed' and the sale
    // included a credit portion, that portion is NOT refunded to the customer
    // balance. Documented in functional-spec.md §7.11. Conservative behaviour
    // preserved; merchants can correct manually via a customer payment.

    db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(id)
    db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      userId,
      'cancel_sale',
      `Venta #${id} anulada`
    )

    return getSaleById(id)
  })
  return txn()
}

export function getDaySalesTotal() {
  const result = getDb()
    .prepare(
      `
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM sales
    WHERE date(created_at) = date('now','localtime') AND status = 'completed'
  `
    )
    .get() as { total: number; count: number }
  return result
}

export function getDayCashSalesTotal(registerId: number) {
  const result = getDb()
    .prepare(
      `
    SELECT COALESCE(SUM(sp.amount), 0) as total
    FROM sale_payments sp
    JOIN sales s ON sp.sale_id = s.id
    WHERE s.register_id = ? AND sp.method = 'cash' AND s.status = 'completed'
  `
    )
    .get(registerId) as { total: number }

  const directCash = getDb()
    .prepare(
      `
    SELECT COALESCE(SUM(total), 0) as total
    FROM sales
    WHERE register_id = ? AND payment_method = 'cash' AND status = 'completed'
  `
    )
    .get(registerId) as { total: number }

  return result.total + directCash.total
}
