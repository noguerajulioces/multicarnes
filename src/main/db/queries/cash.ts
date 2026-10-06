import { getDb } from '../index'

export function openCashRegister(userId: number, openingAmount: number) {
  const db = getDb()
  const existing = db.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get()
  if (existing) throw new Error('Ya hay una caja abierta')

  const registerId = db.transaction((): number => {
    const result = db
      .prepare('INSERT INTO cash_registers (user_id, opening_amount) VALUES (?, ?)')
      .run(userId, openingAmount)
    const id = result.lastInsertRowid as number

    // 003-cash-movements-history T010: emit synthetic opening row so the
    // history page sees the session-start balance.
    db.prepare(
      `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
       VALUES (?, ?, 'opening', ?, 'Apertura de caja')`
    ).run(id, userId, openingAmount)

    return id
  })()

  return getCashRegisterById(registerId)
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

// 004-logout-cash-close: per-user lookup for the logout guard. Scoped to a
// specific user id so the logout-guard check cannot leak across users (FR-006).
export function getOpenCashRegisterByUserId(userId: number) {
  return (
    getDb()
      .prepare(
        `
    SELECT cr.*, u.name as user_name
    FROM cash_registers cr
    LEFT JOIN users u ON cr.user_id = u.id
    WHERE cr.user_id = ? AND cr.status = 'open'
    LIMIT 1
  `
      )
      .get(userId) || null
  )
}

// 010-cash-float-close: the most recent close, used by the apertura screen to
// propose "what stayed in the drawer" as the next opening amount. Returns only
// the amounts (no operator data) so it is safe to expose to every role that can
// open a register — cashiers cannot read the full history (cash:getAll).
export function getLastClosedCashRegister() {
  const row = getDb()
    .prepare(
      `
    SELECT id, closed_at, closing_amount, kept_amount
    FROM cash_registers
    WHERE status = 'closed'
    ORDER BY closed_at DESC, id DESC
    LIMIT 1
  `
    )
    .get() as
    | { id: number; closed_at: string; closing_amount: number | null; kept_amount: number | null }
    | undefined
  return row ?? null
}

export function closeCashRegister(
  id: number,
  closingAmount: number,
  notes?: string,
  userId?: number,
  keptAmount?: number | null
) {
  const db = getDb()
  const register = getCashRegisterById(id) as
    | {
        opening_amount: number
        opened_at: string
        user_id: number
        user_name?: string
        status: string
      }
    | undefined
  if (!register) throw new Error('Caja no encontrada')
  // Refuse to re-close an already-closed register: a second close would
  // overwrite the stored closing/expected/difference and emit a duplicate
  // synthetic 'closing' movement.
  if (register.status !== 'open') throw new Error('La caja ya está cerrada.')

  // 010-cash-float-close: the float left in the drawer is optional (older
  // clients / historical semantics → NULL) but, when present, it must be a
  // non-negative integer that never exceeds the counted cash — the derived
  // withdrawal (closing − kept) can't be negative. It does NOT enter the
  // arqueo below: expected and difference are computed exactly as before.
  const kept = keptAmount == null ? null : keptAmount
  if (kept !== null) {
    if (!Number.isInteger(kept) || kept < 0) {
      throw new Error('El fondo que queda en caja debe ser un monto entero no negativo.')
    }
    if (kept > closingAmount) {
      throw new Error('El fondo que queda en caja no puede superar el monto contado.')
    }
  }

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

  // 003-cash-movements-history T012: voided originals contribute zero.
  // A 'void' row itself is not counted as income or expense (it stands in
  // for cancelling its original).
  const movements = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE
        WHEN cm.type = 'income'
          AND NOT EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
        THEN cm.amount ELSE 0 END), 0) as incomes,
      COALESCE(SUM(CASE
        WHEN cm.type = 'expense'
          AND NOT EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
        THEN cm.amount ELSE 0 END), 0) as expenses
    FROM cash_movements cm WHERE cm.register_id = ?
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

  const todayLocal = (db.prepare("SELECT date('now','localtime') as d").get() as { d: string }).d
  const openedDay = register.opened_at.slice(0, 10)
  const wasStale = openedDay < todayLocal

  // 003-cash-movements-history T011: wrap the close UPDATE, the synthetic
  // 'closing' row, and the optional force_close audit log in one transaction
  // so the history and the canonical cash_registers row never disagree.
  db.transaction(() => {
    db.prepare(
      `
      UPDATE cash_registers
      SET closed_at = datetime('now','localtime'), closing_amount = ?, expected_amount = ?,
          difference = ?, notes = ?, kept_amount = ?, status = 'closed'
      WHERE id = ?
    `
    ).run(closingAmount, expectedAmount, difference, notes || null, kept, id)

    // Emit the synthetic 'closing' row. Description mirrors the migration
    // backfill so the read-side label is consistent across legacy + new rows.
    let closingDesc = 'Cierre de caja'
    if (difference > 0) closingDesc = `Cierre de caja (sobrante ${difference})`
    else if (difference < 0) closingDesc = `Cierre de caja (faltante ${Math.abs(difference)})`

    db.prepare(
      `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
       VALUES (?, ?, 'closing', ?, ?)`
    ).run(id, userId ?? register.user_id ?? null, closingAmount, closingDesc)

    if (wasStale && userId) {
      const days = Math.max(
        1,
        Math.round(
          (Date.parse(todayLocal + 'T00:00:00') - Date.parse(openedDay + 'T00:00:00')) / 86_400_000
        )
      )
      db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        userId,
        'force_close_register',
        `Caja #${id} (abierta el ${openedDay}) cerrada con ${days} día${
          days === 1 ? '' : 's'
        } de retraso`
      )
    }
  })()

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

export function getCashMovements(registerId: number): unknown[]
export function getCashMovements(
  registerId: number,
  opts: { page: number; perPage: number }
): { items: unknown[]; total: number; page: number; perPage: number }
export function getCashMovements(
  registerId: number,
  opts?: { page: number; perPage: number }
): unknown[] | { items: unknown[]; total: number; page: number; perPage: number } {
  const db = getDb()
  const baseQuery = `
    SELECT cm.*, u.name as user_name
    FROM cash_movements cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.register_id = ?
    ORDER BY cm.created_at DESC, cm.id DESC
  `

  // Preserve the original contract for callers that still need the complete
  // turn history. CajaPage passes pagination options to avoid loading every row.
  if (!opts) {
    return db.prepare(baseQuery).all(registerId)
  }

  const page = Math.max(1, opts.page)
  const perPage = Math.min(100, Math.max(1, opts.perPage))
  const total = (
    db
      .prepare('SELECT COUNT(*) as c FROM cash_movements WHERE register_id = ?')
      .get(registerId) as {
      c: number
    }
  ).c
  const items = db
    .prepare(
      `${baseQuery}
       LIMIT ? OFFSET ?`
    )
    .all(registerId, perPage, (page - 1) * perPage)

  return { items, total, page, perPage }
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

  // 003-cash-movements-history T012: voided originals contribute zero.
  const movements = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE
        WHEN cm.type = 'income'
          AND NOT EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
        THEN cm.amount ELSE 0 END), 0) as incomes,
      COALESCE(SUM(CASE
        WHEN cm.type = 'expense'
          AND NOT EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
        THEN cm.amount ELSE 0 END), 0) as expenses
    FROM cash_movements cm WHERE cm.register_id = ?
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

  // 006-card-payments: per-processor breakdown of card revenue so the
  // supervisor can reconcile each acquirer's settlement against the POS at
  // register-close time. Combines single-method `card` sales with the card
  // portion of mixed sales — both keyed by the same processor column.
  const cardByProcessor = db
    .prepare(
      `
    SELECT processor, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM (
      SELECT payment_processor AS processor, total AS amount
      FROM sales
      WHERE register_id = ? AND status = 'completed' AND payment_method = 'card'
      UNION ALL
      SELECT sp.processor AS processor, sp.amount AS amount
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.register_id = ? AND s.status = 'completed'
        AND s.payment_method = 'mixed' AND sp.method = 'card'
    ) t
    WHERE processor IS NOT NULL
    GROUP BY processor
    ORDER BY processor
  `
    )
    .all(registerId, registerId)

  // Aggregate non-cash, non-credit revenue: card per-processor, transfer, and
  // the credit portion. Useful for the "Otros medios" panel at close-register.
  const otherMethodsTotals = db
    .prepare(
      `
    SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM (
      -- single-method sales (transfer / credit / card)
      SELECT payment_method AS method, total AS amount
      FROM sales
      WHERE register_id = ? AND status = 'completed'
        AND payment_method IN ('transfer','credit','card')
      UNION ALL
      -- mixed sales: each non-cash line counts in its own bucket
      SELECT sp.method AS method, sp.amount AS amount
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.register_id = ? AND s.status = 'completed'
        AND s.payment_method = 'mixed' AND sp.method IN ('transfer','credit','card')
    ) t
    GROUP BY method
  `
    )
    .all(registerId, registerId)

  return {
    register,
    cashSales: cashSales.total + mixedCash.total,
    ...movements,
    salesByMethod,
    cardByProcessor,
    otherMethodsTotals
  }
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
