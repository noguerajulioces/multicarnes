import { getDb } from '../index'

export function salesByPeriod(from: string, to: string, method?: string, userId?: number) {
  let sql = `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE date(s.created_at) >= ? AND date(s.created_at) <= ? AND s.status = 'completed'
  `
  const params: unknown[] = [from, to]

  if (method) {
    sql += ' AND s.payment_method = ?'
    params.push(method)
  }
  if (userId) {
    sql += ' AND s.user_id = ?'
    params.push(userId)
  }
  sql += ' ORDER BY s.created_at DESC'
  return getDb().prepare(sql).all(...params)
}

export function topProducts(from: string, to: string, categoryId?: number) {
  let sql = `
    SELECT p.name as product_name, c.name as category_name,
      SUM(si.quantity) as total_quantity, SUM(si.subtotal) as total_revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) >= ? AND date(s.created_at) <= ? AND s.status = 'completed'
  `
  const params: unknown[] = [from, to]
  if (categoryId) {
    sql += ' AND p.category_id = ?'
    params.push(categoryId)
  }
  sql += ' GROUP BY si.product_id ORDER BY total_quantity DESC'
  return getDb().prepare(sql).all(...params)
}

export function profitMargin() {
  return getDb().prepare(`
    SELECT p.id, p.name as product_name, p.price as sale_price,
      (SELECT pi.unit_cost FROM purchase_items pi
       JOIN purchase_orders po ON pi.order_id = po.id
       WHERE pi.product_id = p.id AND po.status = 'received'
       ORDER BY po.received_at DESC LIMIT 1) as last_cost
    FROM products p
    WHERE p.active = 1
    ORDER BY p.name
  `).all()
}

export function stockMovements(from: string, to: string, productId?: number) {
  let sql = `
    SELECT sa.*, p.name as product_name, u.name as user_name
    FROM stock_adjustments sa
    LEFT JOIN products p ON sa.product_id = p.id
    LEFT JOIN users u ON sa.user_id = u.id
    WHERE date(sa.created_at) >= ? AND date(sa.created_at) <= ?
  `
  const params: unknown[] = [from, to]
  if (productId) {
    sql += ' AND sa.product_id = ?'
    params.push(productId)
  }
  sql += ' ORDER BY sa.created_at DESC'
  return getDb().prepare(sql).all(...params)
}

export function cashRegisterReport() {
  return getDb().prepare(`
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    WHERE cr.status = 'closed'
    ORDER BY cr.closed_at DESC
  `).all()
}
