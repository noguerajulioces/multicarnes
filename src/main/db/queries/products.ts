import { getDb } from '../index'

// 005-promotional-pricing: per-product promo. See specs/005-promotional-pricing
// for the full contract. Validation, persistence and audit-log writes happen
// here so the renderer never bypasses them via direct IPC abuse.
type PromoType = 'fixed' | 'percent'

interface PromoFields {
  promo_enabled?: boolean
  promo_type?: PromoType | null
  promo_value?: number | null
  promo_from?: string | null
  promo_to?: string | null
}

interface ResolvedPromo {
  enabled: boolean
  type: PromoType | null
  value: number | null
  from: string | null
  to: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function resolvePromo(input: PromoFields, fallback?: ResolvedPromo): ResolvedPromo {
  return {
    enabled:
      input.promo_enabled !== undefined ? !!input.promo_enabled : (fallback?.enabled ?? false),
    type: input.promo_type !== undefined ? input.promo_type : (fallback?.type ?? null),
    value: input.promo_value !== undefined ? input.promo_value : (fallback?.value ?? null),
    from: input.promo_from !== undefined ? input.promo_from : (fallback?.from ?? null),
    to: input.promo_to !== undefined ? input.promo_to : (fallback?.to ?? null)
  }
}

function validatePromo(promo: ResolvedPromo, price: number): void {
  if (!promo.enabled) return
  if (promo.type !== 'fixed' && promo.type !== 'percent') throw new Error('PROMO_INCOMPLETE')
  if (promo.value == null) throw new Error('PROMO_INCOMPLETE')
  if (promo.type === 'fixed') {
    if (!Number.isFinite(promo.value) || promo.value <= 0)
      throw new Error('PROMO_FIXED_NOT_POSITIVE')
    if (promo.value >= price) throw new Error('PROMO_FIXED_NOT_LESS_THAN_PRICE')
  } else {
    if (!Number.isInteger(promo.value) || promo.value < 1 || promo.value > 99)
      throw new Error('PROMO_PERCENT_OUT_OF_RANGE')
  }
  if (promo.from != null && !DATE_RE.test(promo.from)) throw new Error('PROMO_DATE_FORMAT')
  if (promo.to != null && !DATE_RE.test(promo.to)) throw new Error('PROMO_DATE_FORMAT')
  if (promo.from && promo.to && promo.from > promo.to) throw new Error('PROMO_DATE_RANGE')
}

function promoSnapshot(p: ResolvedPromo): {
  type: PromoType | null
  value: number | null
  from: string | null
  to: string | null
} {
  return { type: p.type, value: p.value, from: p.from, to: p.to }
}

function promoFieldsChanged(a: ResolvedPromo, b: ResolvedPromo): boolean {
  return a.type !== b.type || a.value !== b.value || a.from !== b.from || a.to !== b.to
}

export function getAllProducts(filters?: {
  categoryId?: number
  active?: boolean
  lowStock?: boolean
  search?: string
  page?: number
  perPage?: number
}) {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.categoryId) {
    conditions.push('p.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters?.active !== undefined) {
    conditions.push('p.active = ?')
    params.push(filters.active ? 1 : 0)
  }
  if (filters?.lowStock) conditions.push('p.stock <= p.min_stock')
  if (filters?.search) {
    conditions.push('(p.name LIKE ? OR p.barcode LIKE ?)')
    const term = `%${filters.search}%`
    params.push(term, term)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM products p ${where}`).get(...params) as { c: number }
  ).c
  const isPaginated = filters?.page !== undefined
  const page = Math.max(1, filters?.page ?? 1)
  const perPage = filters?.perPage ?? (isPaginated ? 50 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []
  const items = db
    .prepare(
      `
      SELECT p.*, c.name as category_name,
        CASE WHEN p.stock <= p.min_stock THEN 1 ELSE 0 END as low_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.name
      ${limitClause}
    `
    )
    .all(...params, ...limitParams)
  return { items, total, page, perPage: perPage || total }
}

export function getProductById(id: number) {
  return getDb()
    .prepare(
      `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `
    )
    .get(id)
}

export function getProductByBarcode(barcode: string) {
  return getDb()
    .prepare(
      `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ? AND p.active = 1
    `
    )
    .get(barcode)
}

export function createProduct(
  data: {
    name: string
    category_id?: number | null
    barcode?: string | null
    price: number
    price_type: string
    stock: number
    min_stock: number
    active?: boolean
  } & PromoFields,
  userId?: number | null
) {
  const promo = resolvePromo(data)
  validatePromo(promo, data.price)

  const db = getDb()
  let createdId = 0
  const txn = db.transaction(() => {
    const result = db
      .prepare(
        `
      INSERT INTO products (name, category_id, barcode, price, price_type, stock, min_stock, active,
                            promo_enabled, promo_type, promo_value, promo_from, promo_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        data.name,
        data.category_id ?? null,
        data.barcode ?? null,
        data.price,
        data.price_type,
        data.stock,
        data.min_stock,
        data.active !== false ? 1 : 0,
        promo.enabled ? 1 : 0,
        promo.type,
        promo.value,
        promo.from,
        promo.to
      )
    createdId = result.lastInsertRowid as number
    if (promo.enabled) {
      db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        userId ?? null,
        'promo_enable',
        JSON.stringify({ product_id: createdId, ...promoSnapshot(promo) })
      )
    }
  })
  txn()
  return getProductById(createdId)
}

export function updateProduct(
  id: number,
  data: {
    name?: string
    category_id?: number | null
    barcode?: string | null
    price?: number
    price_type?: string
    stock?: number
    min_stock?: number
    image?: string | null
    active?: boolean
  } & PromoFields,
  userId?: number | null
) {
  const db = getDb()

  const existing = db
    .prepare(
      'SELECT price, promo_enabled, promo_type, promo_value, promo_from, promo_to FROM products WHERE id = ?'
    )
    .get(id) as
    | {
        price: number
        promo_enabled: number
        promo_type: PromoType | null
        promo_value: number | null
        promo_from: string | null
        promo_to: string | null
      }
    | undefined
  if (!existing) return getProductById(id)

  const existingPromo: ResolvedPromo = {
    enabled: existing.promo_enabled === 1,
    type: existing.promo_type,
    value: existing.promo_value,
    from: existing.promo_from,
    to: existing.promo_to
  }
  const nextPromo = resolvePromo(data, existingPromo)
  const effectivePrice = data.price ?? existing.price

  validatePromo(nextPromo, effectivePrice)

  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    params.push(data.name)
  }
  if (data.category_id !== undefined) {
    fields.push('category_id = ?')
    params.push(data.category_id)
  }
  if (data.barcode !== undefined) {
    fields.push('barcode = ?')
    params.push(data.barcode || null)
  }
  if (data.price !== undefined) {
    fields.push('price = ?')
    params.push(data.price)
  }
  if (data.price_type !== undefined) {
    fields.push('price_type = ?')
    params.push(data.price_type)
  }
  if (data.stock !== undefined) {
    fields.push('stock = ?')
    params.push(data.stock)
  }
  if (data.min_stock !== undefined) {
    fields.push('min_stock = ?')
    params.push(data.min_stock)
  }
  if (data.image !== undefined) {
    fields.push('image = ?')
    params.push(data.image)
  }
  if (data.active !== undefined) {
    fields.push('active = ?')
    params.push(data.active ? 1 : 0)
  }
  // Promo column writes — only when explicitly provided in `data`.
  if (data.promo_enabled !== undefined) {
    fields.push('promo_enabled = ?')
    params.push(nextPromo.enabled ? 1 : 0)
  }
  if (data.promo_type !== undefined) {
    fields.push('promo_type = ?')
    params.push(nextPromo.type)
  }
  if (data.promo_value !== undefined) {
    fields.push('promo_value = ?')
    params.push(nextPromo.value)
  }
  if (data.promo_from !== undefined) {
    fields.push('promo_from = ?')
    params.push(nextPromo.from)
  }
  if (data.promo_to !== undefined) {
    fields.push('promo_to = ?')
    params.push(nextPromo.to)
  }

  const anyPromoFieldProvided =
    data.promo_enabled !== undefined ||
    data.promo_type !== undefined ||
    data.promo_value !== undefined ||
    data.promo_from !== undefined ||
    data.promo_to !== undefined

  let auditAction: 'promo_enable' | 'promo_update' | 'promo_disable' | null = null
  let auditDetails: object | null = null
  if (anyPromoFieldProvided) {
    if (!existingPromo.enabled && nextPromo.enabled) {
      auditAction = 'promo_enable'
      auditDetails = { product_id: id, ...promoSnapshot(nextPromo) }
    } else if (existingPromo.enabled && !nextPromo.enabled) {
      auditAction = 'promo_disable'
      auditDetails = { product_id: id, previous: promoSnapshot(existingPromo) }
    } else if (
      existingPromo.enabled &&
      nextPromo.enabled &&
      promoFieldsChanged(existingPromo, nextPromo)
    ) {
      auditAction = 'promo_update'
      auditDetails = {
        product_id: id,
        before: promoSnapshot(existingPromo),
        after: promoSnapshot(nextPromo)
      }
    }
  }

  if (fields.length === 0 && !auditAction) return getProductById(id)

  const txn = db.transaction(() => {
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now','localtime')")
      params.push(id)
      db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    }
    if (auditAction) {
      db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        userId ?? null,
        auditAction,
        JSON.stringify(auditDetails)
      )
    }
  })
  txn()
  return getProductById(id)
}

export function adjustStock(id: number, newStock: number, reason: string, userId: number) {
  const db = getDb()
  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(id) as { stock: number }
  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, product.stock, newStock, reason)
    db.prepare(
      "UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(newStock, id)
  })
  txn()
  return getProductById(id)
}

export function getAllCategories() {
  return getDb().prepare('SELECT * FROM categories ORDER BY name').all()
}

export function createCategory(name: string) {
  const result = getDb().prepare('INSERT INTO categories (name) VALUES (?)').run(name)
  return { id: result.lastInsertRowid as number, name }
}

export function getStockMovements(productId: number, limit = 50) {
  return getDb()
    .prepare(
      `
      SELECT sa.id, sa.user_id, u.name as user_name,
             sa.quantity_before, sa.quantity_after,
             (sa.quantity_after - sa.quantity_before) as delta,
             sa.reason, sa.created_at
      FROM stock_adjustments sa
      LEFT JOIN users u ON u.id = sa.user_id
      WHERE sa.product_id = ?
      ORDER BY sa.created_at DESC, sa.id DESC
      LIMIT ?
    `
    )
    .all(productId, limit)
}

export function getRecentSalesForProduct(productId: number, limit = 20) {
  return getDb()
    .prepare(
      `
      SELECT s.id as sale_id, s.created_at, si.quantity, si.unit_price, si.subtotal,
             s.user_id, u.name as user_name,
             c.name as customer_name
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE si.product_id = ? AND s.status = 'completed'
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ?
    `
    )
    .all(productId, limit)
}

export function getProductSalesStats(productId: number) {
  const db = getDb()
  const r7 = db
    .prepare(
      `
    SELECT COALESCE(SUM(si.quantity), 0) as units, COALESCE(SUM(si.subtotal), 0) as total
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ? AND s.status = 'completed'
      AND s.created_at >= datetime('now','localtime','-7 days')
  `
    )
    .get(productId) as { units: number; total: number }
  const r30 = db
    .prepare(
      `
    SELECT COALESCE(SUM(si.quantity), 0) as units, COALESCE(SUM(si.subtotal), 0) as total
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ? AND s.status = 'completed'
      AND s.created_at >= datetime('now','localtime','-30 days')
  `
    )
    .get(productId) as { units: number; total: number }
  const last = db
    .prepare(
      `
    SELECT MAX(s.created_at) as last_sale_at
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ? AND s.status = 'completed'
  `
    )
    .get(productId) as { last_sale_at: string | null }
  return {
    units_7d: r7.units,
    total_7d: r7.total,
    units_30d: r30.units,
    total_30d: r30.total,
    last_sale_at: last.last_sale_at
  }
}

export function getLastPurchaseForProduct(productId: number) {
  return (
    getDb()
      .prepare(
        `
    SELECT po.id as order_id, po.created_at, pi.unit_cost, pi.quantity, sup.name as supplier_name
    FROM purchase_items pi
    JOIN purchase_orders po ON po.id = pi.order_id
    LEFT JOIN suppliers sup ON sup.id = po.supplier_id
    WHERE pi.product_id = ? AND po.status != 'cancelled'
    ORDER BY po.created_at DESC, po.id DESC
    LIMIT 1
  `
      )
      .get(productId) || null
  )
}

export function getLowStockProducts() {
  return getDb()
    .prepare(
      `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1 AND p.stock <= p.min_stock
      ORDER BY p.stock ASC
    `
    )
    .all()
}
