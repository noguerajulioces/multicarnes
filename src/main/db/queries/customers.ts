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
  credit_limit_enabled?: boolean
  credit_limit_amount?: number | null
}) {
  const result = getDb()
    .prepare(
      'INSERT INTO customers (name, phone, address, document, document_type, is_employee, credit_limit_enabled, credit_limit_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      data.name,
      data.phone || null,
      data.address || null,
      data.document || null,
      data.document ? data.document_type || null : null,
      data.is_employee ? 1 : 0,
      data.credit_limit_enabled ? 1 : 0,
      // Store NULL when the limit is off so a disabled limit never carries a
      // stale amount the sale-time check could misread.
      data.credit_limit_enabled ? (data.credit_limit_amount ?? null) : null
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
    credit_limit_enabled?: boolean
    credit_limit_amount?: number | null
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
  if (data.credit_limit_enabled !== undefined) {
    fields.push('credit_limit_enabled = ?')
    params.push(data.credit_limit_enabled ? 1 : 0)
    // Write the amount together with the toggle: clear it to NULL when the
    // limit is disabled so a later re-enable starts clean and the sale-time
    // check can treat enabled===1 as "amount is meaningful".
    fields.push('credit_limit_amount = ?')
    params.push(data.credit_limit_enabled ? (data.credit_limit_amount ?? null) : null)
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
    // Insert the cash income first so its id can be linked onto the payment row.
    // The link lets voidMovement (Movimientos de Caja) reverse exactly this
    // payment on the customer side when the income is annulled.
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

// Anular (append-only) a customer payment from the Cliente detail. Mirrors the
// "Anular" flow in Movimientos de Caja and is the single way to undo a payment:
//   - cash payment linked to an income → delegate to voidMovement, which voids
//     that income AND (via cash_movement_id) restores the debt + appends the
//     annulment row to the customer history. One source of truth, caja stays
//     in sync.
//   - non-cash payment (or a legacy cash one with no link) → there is no caja to
//     touch: restore the debt and append the annulment row directly.
// The original payment row is always kept; an annulment row (void_of → original)
// is what marks it undone.
export function voidCustomerPayment(paymentId: number, actorUserId: number) {
  const db = getDb()
  const payment = db
    .prepare(
      'SELECT id, customer_id, amount, note, affects_cash, cash_movement_id, void_of FROM customer_payments WHERE id = ?'
    )
    .get(paymentId) as
    | {
        id: number
        customer_id: number
        amount: number
        note: string | null
        affects_cash: number
        cash_movement_id: number | null
        void_of: number | null
      }
    | undefined
  if (!payment) throw new Error('Pago no encontrado.')
  if (payment.void_of != null) throw new Error('No se puede anular una anulación.')
  const alreadyVoided = db
    .prepare('SELECT 1 FROM customer_payments WHERE void_of = ?')
    .get(paymentId) as { 1: number } | undefined
  if (alreadyVoided) throw new Error('Este pago ya fue anulado.')

  if (payment.affects_cash === 1 && payment.cash_movement_id != null) {
    // voidMovement does the whole job: cash void row + debt restore + annulment
    // row on the customer history (it finds this payment via cash_movement_id).
    voidMovement(payment.cash_movement_id, actorUserId)
    return getCustomerById(payment.customer_id)
  }

  const txn = db.transaction(() => {
    db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(
      payment.amount,
      payment.customer_id
    )
    const voidNote = payment.note ? `[ANULACIÓN] ${payment.note}` : '[ANULACIÓN] Pago anulado'
    db.prepare(
      `INSERT INTO customer_payments
         (customer_id, user_id, amount, note, affects_cash, cash_movement_id, void_of)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`
    ).run(
      payment.customer_id,
      actorUserId,
      payment.amount,
      voidNote,
      payment.affects_cash,
      payment.id
    )
    db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      actorUserId,
      'void_customer_payment',
      JSON.stringify({
        payment_id: payment.id,
        customer_id: payment.customer_id,
        amount: payment.amount,
        affects_cash: payment.affects_cash === 1
      })
    )
    return getCustomerById(payment.customer_id)
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
  void_of: number | null
  is_voided: number
  created_at: string
}

export function getCustomerPayments(customerId: number) {
  const rows = getDb()
    .prepare(
      `
    SELECT cp.*, u.name as user_name,
      EXISTS (SELECT 1 FROM customer_payments v WHERE v.void_of = cp.id) AS is_voided
    FROM customer_payments cp
    LEFT JOIN users u ON cp.user_id = u.id
    WHERE cp.customer_id = ?
    ORDER BY cp.created_at DESC, cp.id DESC
  `
    )
    .all(customerId) as CustomerPaymentRow[]
  return rows.map((r) => ({
    ...r,
    affects_cash: r.affects_cash === 1,
    is_voided: r.is_voided === 1
  }))
}

export function getCustomerSales(
  customerId: number,
  opts: { page?: number; perPage?: number } = {}
) {
  const db = getDb()

  const total = (
    db.prepare('SELECT COUNT(*) as c FROM sales WHERE customer_id = ?').get(customerId) as {
      c: number
    }
  ).c

  // Paginate the outer query so a long-standing customer's full purchase history
  // isn't loaded in one shot. When no page is requested we return everything
  // (backward-compatible), but callers should paginate.
  const isPaginated = opts.page !== undefined
  const page = Math.max(1, opts.page ?? 1)
  const perPage = opts.perPage ?? (isPaginated ? 25 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []

  const sales = db
    .prepare(
      `
    SELECT s.*, u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
    ${limitClause}
  `
    )
    .all(customerId, ...limitParams) as Record<string, unknown>[]

  // Batch the line items / payments for the whole page in two set-based queries
  // (WHERE sale_id IN (...)) instead of two queries per sale — the old N+1 that
  // grew with the customer's lifetime purchase count.
  if (sales.length > 0) {
    const ids = sales.map((s) => s.id as number)
    const placeholders = ids.map(() => '?').join(',')

    const itemRows = db
      .prepare(
        `
      SELECT si.*, p.name as product_name, p.price_type
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id IN (${placeholders})
    `
      )
      .all(...ids) as Array<Record<string, unknown>>

    const paymentRows = db
      .prepare(`SELECT * FROM sale_payments WHERE sale_id IN (${placeholders})`)
      .all(...ids) as Array<Record<string, unknown>>

    const groupBySale = (
      rows: Array<Record<string, unknown>>
    ): Map<number, Record<string, unknown>[]> => {
      const map = new Map<number, Record<string, unknown>[]>()
      for (const row of rows) {
        const sid = row.sale_id as number
        const arr = map.get(sid)
        if (arr) arr.push(row)
        else map.set(sid, [row])
      }
      return map
    }
    const itemsBySale = groupBySale(itemRows)
    const paymentsBySale = groupBySale(paymentRows)

    for (const sale of sales) {
      const sid = sale.id as number
      sale.items = itemsBySale.get(sid) ?? []
      sale.payments = paymentsBySale.get(sid) ?? []
    }
  }

  return { items: sales, total, page, perPage }
}
