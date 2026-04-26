import { getDb } from '../index'

export function getAllProducts(filters?: { categoryId?: number; active?: boolean; lowStock?: boolean; search?: string }) {
  const db = getDb()
  let sql = `
    SELECT p.*, c.name as category_name,
      CASE WHEN p.stock <= p.min_stock THEN 1 ELSE 0 END as low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `
  const params: unknown[] = []

  if (filters?.categoryId) {
    sql += ' AND p.category_id = ?'
    params.push(filters.categoryId)
  }
  if (filters?.active !== undefined) {
    sql += ' AND p.active = ?'
    params.push(filters.active ? 1 : 0)
  }
  if (filters?.lowStock) {
    sql += ' AND p.stock <= p.min_stock'
  }
  if (filters?.search) {
    sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)'
    const term = `%${filters.search}%`
    params.push(term, term)
  }
  sql += ' ORDER BY p.name'
  return db.prepare(sql).all(...params)
}

export function getProductById(id: number) {
  return getDb()
    .prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `)
    .get(id)
}

export function getProductByBarcode(barcode: string) {
  return getDb()
    .prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ? AND p.active = 1
    `)
    .get(barcode)
}

export function createProduct(data: {
  name: string; category_id?: number; barcode?: string; price: number;
  price_type: string; stock: number; min_stock: number; active?: boolean
}) {
  const result = getDb()
    .prepare(`
      INSERT INTO products (name, category_id, barcode, price, price_type, stock, min_stock, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(data.name, data.category_id || null, data.barcode || null, data.price, data.price_type, data.stock, data.min_stock, data.active !== false ? 1 : 0)
  return getProductById(result.lastInsertRowid as number)
}

export function updateProduct(id: number, data: {
  name?: string; category_id?: number | null; barcode?: string | null; price?: number;
  price_type?: string; stock?: number; min_stock?: number; active?: boolean
}) {
  const db = getDb()
  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.category_id !== undefined) { fields.push('category_id = ?'); params.push(data.category_id) }
  if (data.barcode !== undefined) { fields.push('barcode = ?'); params.push(data.barcode || null) }
  if (data.price !== undefined) { fields.push('price = ?'); params.push(data.price) }
  if (data.price_type !== undefined) { fields.push('price_type = ?'); params.push(data.price_type) }
  if (data.stock !== undefined) { fields.push('stock = ?'); params.push(data.stock) }
  if (data.min_stock !== undefined) { fields.push('min_stock = ?'); params.push(data.min_stock) }
  if (data.active !== undefined) { fields.push('active = ?'); params.push(data.active ? 1 : 0) }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now','localtime')")
    params.push(id)
    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }
  return getProductById(id)
}

export function adjustStock(id: number, newStock: number, reason: string, userId: number) {
  const db = getDb()
  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(id) as { stock: number }
  const txn = db.transaction(() => {
    db.prepare('INSERT INTO stock_adjustments (product_id, user_id, quantity_before, quantity_after, reason) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, product.stock, newStock, reason)
    db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(newStock, id)
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

export function getLowStockProducts() {
  return getDb()
    .prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1 AND p.stock <= p.min_stock
      ORDER BY p.stock ASC
    `)
    .all()
}
