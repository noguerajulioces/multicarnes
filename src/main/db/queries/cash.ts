import { getDb } from '../index'

export function openCashRegister(userId: number, openingAmount: number) {
  const db = getDb()
  const existing = db.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get()
  if (existing) throw new Error('Ya hay una caja abierta')

  const result = db
    .prepare('INSERT INTO cash_registers (user_id, opening_amount) VALUES (?, ?)')
    .run(userId, openingAmount)
  return getCashRegisterById(result.lastInsertRowid as number)
}

export function getCashRegisterById(id: number) {
  return getDb()
    .prepare(
      `
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    WHERE cr.id = ?
  `
    )
    .get(id)
}

export function getCurrentCashRegister() {
  return (
    getDb()
      .prepare(
        `
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    WHERE cr.status = 'open'
    LIMIT 1
  `
      )
      .get() || null
  )
}

export function closeCashRegister(id: number, closingAmount: number, notes?: string) {
  const db = getDb()
  const register = getCashRegisterById(id) as { opening_amount: number } | undefined
  if (!register) throw new Error('Caja no encontrada')

  const cashSales = db
    .prepare(
      `
    SELECT COALESCE(SUM(s.total), 0) as total
    FROM sales s
    WHERE s.register_id = ? AND s.payment_method = 'cash' AND s.status = 'completed'
  `
    )
    .get(id) as { total: number }

  const mixedCash = db
    .prepare(
      `
    SELECT COALESCE(SUM(sp.amount), 0) as total
    FROM sale_payments sp
    JOIN sales s ON sp.sale_id = s.id
    WHERE s.register_id = ? AND sp.method = 'cash' AND s.status = 'completed'
    AND s.payment_method = 'mixed'
  `
    )
    .get(id) as { total: number }

  const movements = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as incomes,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM cash_movements WHERE register_id = ?
  `
    )
    .get(id) as { incomes: number; expenses: number }

  const expectedAmount =
    register.opening_amount +
    cashSales.total +
    mixedCash.total +
    movements.incomes -
    movements.expenses
  const difference = closingAmount - expectedAmount

  db.prepare(
    `
    UPDATE cash_registers
    SET closed_at = datetime('now','localtime'), closing_amount = ?, expected_amount = ?,
        difference = ?, notes = ?, status = 'closed'
    WHERE id = ?
  `
  ).run(closingAmount, expectedAmount, difference, notes || null, id)

  return getCashRegisterById(id)
}

export function addCashMovement(
  registerId: number,
  userId: number,
  type: string,
  amount: number,
  description: string
) {
  const result = getDb()
    .prepare(
      'INSERT INTO cash_movements (register_id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)'
    )
    .run(registerId, userId, type, amount, description)
  return getDb().prepare('SELECT * FROM cash_movements WHERE id = ?').get(result.lastInsertRowid)
}

export function getCashMovements(registerId: number) {
  return getDb()
    .prepare(
      `
    SELECT cm.*, u.name as user_name
    FROM cash_movements cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.register_id = ?
    ORDER BY cm.created_at DESC
  `
    )
    .all(registerId)
}

export function getCashRegisterSummary(registerId: number) {
  const db = getDb()
  const register = getCashRegisterById(registerId)

  const cashSales = db
    .prepare(
      `
    SELECT COALESCE(SUM(total), 0) as total
    FROM sales WHERE register_id = ? AND payment_method = 'cash' AND status = 'completed'
  `
    )
    .get(registerId) as { total: number }

  const mixedCash = db
    .prepare(
      `
    SELECT COALESCE(SUM(sp.amount), 0) as total
    FROM sale_payments sp
    JOIN sales s ON sp.sale_id = s.id
    WHERE s.register_id = ? AND sp.method = 'cash' AND s.status = 'completed' AND s.payment_method = 'mixed'
  `
    )
    .get(registerId) as { total: number }

  const movements = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as incomes,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM cash_movements WHERE register_id = ?
  `
    )
    .get(registerId) as { incomes: number; expenses: number }

  const salesByMethod = db
    .prepare(
      `
    SELECT payment_method, COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM sales WHERE register_id = ? AND status = 'completed'
    GROUP BY payment_method
  `
    )
    .all(registerId)

  return { register, cashSales: cashSales.total + mixedCash.total, ...movements, salesByMethod }
}

export function getAllCashRegisters() {
  return getDb()
    .prepare(
      `
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    ORDER BY cr.opened_at DESC
  `
    )
    .all()
}
