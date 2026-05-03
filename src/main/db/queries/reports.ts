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
  return getDb()
    .prepare(sql)
    .all(...params)
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
  return getDb()
    .prepare(sql)
    .all(...params)
}

export function profitMargin() {
  return getDb()
    .prepare(
      `
    SELECT p.id, p.name as product_name, p.price as sale_price,
      (SELECT pi.unit_cost FROM purchase_items pi
       JOIN purchase_orders po ON pi.order_id = po.id
       WHERE pi.product_id = p.id AND po.status = 'received'
       ORDER BY po.received_at DESC LIMIT 1) as last_cost
    FROM products p
    WHERE p.active = 1
    ORDER BY p.name
  `
    )
    .all()
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
  return getDb()
    .prepare(sql)
    .all(...params)
}

export function cashRegisterReport() {
  return getDb()
    .prepare(
      `
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    WHERE cr.status = 'closed'
    ORDER BY cr.closed_at DESC
  `
    )
    .all()
}

export function pendingCredits() {
  return getDb()
    .prepare(
      `
    SELECT
      c.id,
      c.name,
      c.phone,
      c.is_employee,
      c.balance,
      (SELECT MAX(s.created_at) FROM sales s
        WHERE s.customer_id = c.id
          AND s.status = 'completed'
          AND (s.payment_method = 'credit' OR s.payment_method = 'mixed')
      ) AS last_credit_sale_at,
      (SELECT MAX(cp.created_at) FROM customer_payments cp
        WHERE cp.customer_id = c.id
      ) AS last_payment_at
    FROM customers c
    WHERE c.balance < 0
    ORDER BY c.balance ASC
  `
    )
    .all()
}

export function salesSummary(from: string, to: string) {
  const db = getDb()

  const totals = db
    .prepare(
      `
    SELECT
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total,
      COALESCE(SUM(discount), 0) AS discount,
      COALESCE(SUM(subtotal), 0) AS subtotal
    FROM sales
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'completed'
  `
    )
    .get(from, to)

  const byDay = db
    .prepare(
      `
    SELECT
      date(created_at) AS day,
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total
    FROM sales
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'completed'
    GROUP BY date(created_at)
    ORDER BY day ASC
  `
    )
    .all(from, to)

  const byMethod = db
    .prepare(
      `
    SELECT
      payment_method AS method,
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total
    FROM sales
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'completed'
    GROUP BY payment_method
    ORDER BY total DESC
  `
    )
    .all(from, to)

  const byUser = db
    .prepare(
      `
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      COUNT(*) AS sales_count,
      COALESCE(SUM(s.total), 0) AS total
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE date(s.created_at) >= ? AND date(s.created_at) <= ? AND s.status = 'completed'
    GROUP BY s.user_id
    ORDER BY total DESC
  `
    )
    .all(from, to)

  return { totals, byDay, byMethod, byUser }
}

function periodStats(from: string, to: string) {
  const db = getDb()
  const sales = db
    .prepare(
      `
    SELECT
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total,
      COALESCE(SUM(discount), 0) AS discount
    FROM sales
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'completed'
  `
    )
    .get(from, to) as { sales_count: number; total: number; discount: number }

  const units = db
    .prepare(
      `
    SELECT COALESCE(SUM(si.quantity), 0) AS units
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) >= ? AND date(s.created_at) <= ? AND s.status = 'completed'
  `
    )
    .get(from, to) as { units: number }

  const avgTicket = sales.sales_count > 0 ? Math.round(sales.total / sales.sales_count) : 0
  return {
    sales_count: sales.sales_count,
    total: sales.total,
    discount: sales.discount,
    units: units.units,
    avg_ticket: avgTicket
  }
}

export function salesComparison(from: string, to: string) {
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')
  const dayMs = 24 * 60 * 60 * 1000
  const lengthDays = Math.round((toDate.getTime() - fromDate.getTime()) / dayMs) + 1

  const prevTo = new Date(fromDate.getTime() - dayMs)
  const prevFrom = new Date(prevTo.getTime() - (lengthDays - 1) * dayMs)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const current = periodStats(from, to)
  const previous = periodStats(fmt(prevFrom), fmt(prevTo))

  return {
    current,
    previous,
    period: {
      current_from: from,
      current_to: to,
      previous_from: fmt(prevFrom),
      previous_to: fmt(prevTo),
      length_days: lengthDays
    }
  }
}
