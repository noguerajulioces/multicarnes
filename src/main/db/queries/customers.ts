import Database from 'better-sqlite3'
import { getDb } from '../index'
import { getOpenCashRegisterByUserId } from './cash'
import { voidMovement } from './cash-movements'

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

interface AddCustomerPaymentArgs {
  customerId: number
  userId: number
  amount: number
  note?: string
  affectsCash: boolean
  callerUserId: number
}

export function addCustomerPayment(args: AddCustomerPaymentArgs) {
  const { customerId, userId, amount, note, affectsCash, callerUserId } = args
  if (amount <= 0) throw new Error('El monto debe ser mayor a cero.')

  const db = getDb()
  const customer = getCustomerById(customerId) as { id: number; name: string } | undefined
  if (!customer) throw new Error('Cliente no encontrado.')

  let registerId: number | null = null
  if (affectsCash) {
    const register = getOpenCashRegisterByUserId(callerUserId) as { id: number } | null
    if (!register) {
      throw new Error('Necesitás una caja abierta para registrar pagos en efectivo.')
    }
    registerId = register.id
  }

  const noteValue = note || null
  const description = `Pago de deuda — ${customer.name}` + (noteValue ? ` (${noteValue})` : '')

  const txn = db.transaction(() => {
    // Insert the cash income first so its id can be linked onto the payment
    // row (#1). The link lets a later edit/delete reverse exactly this income.
    let cashMovementId: number | null = null
    if (affectsCash && registerId !== null) {
      const mv = db
        .prepare(
          `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
           VALUES (?, ?, 'income', ?, ?)`
        )
        .run(registerId, callerUserId, amount, description)
      cashMovementId = mv.lastInsertRowid as number
    }
    db.prepare(
      'INSERT INTO customer_payments (customer_id, user_id, amount, note, affects_cash, cash_movement_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(customerId, userId, amount, noteValue, affectsCash ? 1 : 0, cashMovementId)
    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(amount, customerId)
    db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      callerUserId,
      'add_customer_payment',
      JSON.stringify({
        customer_id: customerId,
        amount,
        affects_cash: affectsCash,
        register_id: registerId,
        cash_movement_id: cashMovementId,
        note: noteValue
      })
    )
    return getCustomerById(customerId)
  })
  return txn()
}

// #1 + #2: a cash-affecting payment's linked income can only be reversed while
// its register is still open. Returns the register id (for re-issuing on edit)
// and whether the income was already voided elsewhere (e.g. the Movimientos
// page). Throws — blocking the operation — when the payment is legacy/unlinked
// or its register has already been closed (arqueado).
function loadEditableCashMovement(
  db: Database.Database,
  cashMovementId: number | null,
  verb: 'editar' | 'eliminar'
): { registerId: number; isVoided: boolean } {
  if (cashMovementId == null) {
    throw new Error(
      `No se puede ${verb} este pago en efectivo: no está vinculado a un movimiento de caja (registrado antes de esta versión). Registrá un ajuste de caja manual.`
    )
  }
  const mv = db
    .prepare(
      `SELECT cm.register_id AS register_id, cr.status AS register_status,
         EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id) AS is_voided
       FROM cash_movements cm
       JOIN cash_registers cr ON cr.id = cm.register_id
       WHERE cm.id = ?`
    )
    .get(cashMovementId) as
    | { register_id: number; register_status: string; is_voided: number }
    | undefined
  if (!mv) throw new Error('El movimiento de caja vinculado no existe.')
  if (mv.register_status !== 'open') {
    throw new Error(
      `No se puede ${verb} un pago en efectivo de una caja ya cerrada (ya fue arqueada). Registrá un ajuste de caja.`
    )
  }
  return { registerId: mv.register_id, isVoided: mv.is_voided === 1 }
}

export function updateCustomerPayment(
  paymentId: number,
  newAmount: number,
  newNote: string | null | undefined,
  userId: number
) {
  if (newAmount <= 0) throw new Error('El monto debe ser mayor a cero.')
  const db = getDb()
  const txn = db.transaction(() => {
    const existing = db
      .prepare(
        'SELECT customer_id, amount, affects_cash, cash_movement_id FROM customer_payments WHERE id = ?'
      )
      .get(paymentId) as
      | {
          customer_id: number
          amount: number
          affects_cash: number
          cash_movement_id: number | null
        }
      | undefined
    if (!existing) throw new Error('Pago no encontrado')

    let cashMovementId = existing.cash_movement_id
    if (existing.affects_cash) {
      // Reverse the old income (append-only void) and re-issue a fresh income
      // for the new amount in the same open register, then re-link the payment.
      const mv = loadEditableCashMovement(db, existing.cash_movement_id, 'editar')
      if (!mv.isVoided) voidMovement(existing.cash_movement_id as number, userId)
      const customer = getCustomerById(existing.customer_id) as { name: string }
      const res = db
        .prepare(
          `INSERT INTO cash_movements (register_id, user_id, type, amount, description)
           VALUES (?, ?, 'income', ?, ?)`
        )
        .run(mv.registerId, userId, newAmount, `Pago de deuda — ${customer.name} (edición)`)
      cashMovementId = res.lastInsertRowid as number
    }

    const delta = newAmount - existing.amount
    db.prepare(
      'UPDATE customer_payments SET amount = ?, note = ?, cash_movement_id = ? WHERE id = ?'
    ).run(newAmount, newNote ?? null, cashMovementId, paymentId)
    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(
      delta,
      existing.customer_id
    )
    return getCustomerById(existing.customer_id)
  })
  return txn()
}

export function deleteCustomerPayment(paymentId: number, userId: number) {
  const db = getDb()
  const txn = db.transaction(() => {
    const existing = db
      .prepare(
        'SELECT customer_id, amount, affects_cash, cash_movement_id FROM customer_payments WHERE id = ?'
      )
      .get(paymentId) as
      | {
          customer_id: number
          amount: number
          affects_cash: number
          cash_movement_id: number | null
        }
      | undefined
    if (!existing) throw new Error('Pago no encontrado')

    if (existing.affects_cash) {
      // Void the linked income so the arqueo drops it (unless it was already
      // voided elsewhere). Blocks if the register is closed / payment legacy.
      const mv = loadEditableCashMovement(db, existing.cash_movement_id, 'eliminar')
      if (!mv.isVoided) voidMovement(existing.cash_movement_id as number, userId)
    }

    db.prepare('DELETE FROM customer_payments WHERE id = ?').run(paymentId)
    db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(
      existing.amount,
      existing.customer_id
    )
    return getCustomerById(existing.customer_id)
  })
  return txn()
}

export function deleteCustomer(id: number): { ok: true } | { ok: false; error: string } {
  const db = getDb()
  const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(id) as
    | { balance: number }
    | undefined
  if (!customer) return { ok: false, error: 'Cliente no encontrado' }
  if (customer.balance !== 0) {
    return {
      ok: false,
      error: 'No se puede eliminar: el cliente tiene saldo pendiente. Saldalo primero.'
    }
  }
  const sales = db.prepare('SELECT COUNT(*) as c FROM sales WHERE customer_id = ?').get(id) as {
    c: number
  }
  if (sales.c > 0) {
    return {
      ok: false,
      error: 'No se puede eliminar: el cliente tiene ventas registradas a su nombre.'
    }
  }
  const payments = db
    .prepare('SELECT COUNT(*) as c FROM customer_payments WHERE customer_id = ?')
    .get(id) as { c: number }
  if (payments.c > 0) {
    return {
      ok: false,
      error: 'No se puede eliminar: el cliente tiene pagos registrados.'
    }
  }
  db.prepare('DELETE FROM customers WHERE id = ?').run(id)
  return { ok: true }
}

interface CustomerPaymentRow {
  id: number
  customer_id: number
  user_id: number
  user_name: string | null
  amount: number
  note: string | null
  affects_cash: number
  created_at: string
}

export function getCustomerPayments(customerId: number) {
  const rows = getDb()
    .prepare(
      `
    SELECT cp.*, u.name as user_name
    FROM customer_payments cp
    LEFT JOIN users u ON cp.user_id = u.id
    WHERE cp.customer_id = ?
    ORDER BY cp.created_at DESC
  `
    )
    .all(customerId) as CustomerPaymentRow[]
  return rows.map((r) => ({
    ...r,
    affects_cash: r.affects_cash === 1
  }))
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
  const paymentsStmt = db.prepare(`
    SELECT * FROM sale_payments WHERE sale_id = ?
  `)

  for (const sale of sales) {
    sale.items = itemsStmt.all(sale.id)
    sale.payments = paymentsStmt.all(sale.id)
  }

  return sales
}
