import { getDb } from '../index'

type Processor = 'bancard' | 'dinelco' | 'upay'

interface CreateSaleData {
  registerId: number
  userId: number
  customerId?: number | null
  items: { productId: number; quantity: number; unitPrice: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  paymentProcessor?: Processor | null
  paymentReference?: string | null
  payments?: {
    method: string
    amount: number
    processor?: Processor | null
    reference?: string | null
  }[]
  notes?: string
}

const PROCESSORS: ReadonlySet<string> = new Set(['bancard', 'dinelco', 'upay'])

function normalizeReference(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function validatePaymentDetails(
  method: string,
  processor: string | null | undefined,
  reference: string | null
): void {
  if (method === 'card') {
    if (!processor || !PROCESSORS.has(processor)) {
      throw new Error('Pago con tarjeta requiere un procesador válido (Bancard, Dinelco o Upay).')
    }
    if (!reference) {
      throw new Error('Pago con tarjeta requiere el N° de comprobante.')
    }
  } else if (method === 'transfer') {
    if (!reference) {
      throw new Error('Pago por transferencia requiere el N° de comprobante.')
    }
  }
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

    // The repository is the source of truth for money. Re-validate the
    // renderer-supplied amounts so a cart bug or a tampered renderer can't
    // persist a sale whose totals don't add up. Mirrors the cart's own
    // clamped formula (total = max(0, subtotal - discount)).
    const itemsSubtotal = data.items.reduce((sum, it) => sum + it.subtotal, 0)
    if (itemsSubtotal !== data.subtotal) {
      throw new Error('Subtotal inconsistente con los ítems de la venta.')
    }
    if (data.total !== Math.max(0, data.subtotal - data.discount)) {
      throw new Error('El total no coincide con subtotal menos descuento.')
    }
    if (data.paymentMethod === 'mixed') {
      const paid = (data.payments ?? []).reduce((sum, p) => sum + p.amount, 0)
      if (paid !== data.total) {
        throw new Error('La suma de los pagos no coincide con el total de la venta.')
      }
    }

    // 006-card-payments: validate processor/reference per method. For mixed
    // sales the top-level fields stay NULL — each sale_payments row carries
    // its own processor/reference.
    const topReference = normalizeReference(data.paymentReference)
    const topProcessor = data.paymentMethod === 'card' ? (data.paymentProcessor ?? null) : null
    if (data.paymentMethod !== 'mixed') {
      validatePaymentDetails(data.paymentMethod, topProcessor, topReference)
    }

    // Credit (fiado) portion of this sale, computed up front so it can gate both
    // the "requires a customer" guard and the per-customer credit-limit check.
    let creditAmount = 0
    if (data.paymentMethod === 'credit') {
      creditAmount = data.total
    } else if (data.paymentMethod === 'mixed' && data.payments) {
      creditAmount = data.payments
        .filter((p) => p.method === 'credit')
        .reduce((sum, p) => sum + p.amount, 0)
    }

    // A credit portion with no customer would create an uncollectable receivable:
    // stock leaves inventory (the loop below decrements it) but no balance is ever
    // debited (the balance updates further down are both gated on data.customerId),
    // so the debt silently vanishes. The renderer blocks this in CobroModal, but
    // the repository is the source of truth for money, so re-enforce it here — the
    // throw rolls the whole db.transaction() back (no sale, no stock change).
    if (creditAmount > 0 && !data.customerId) {
      throw new Error('Una venta a crédito (fiado) requiere un cliente asociado.')
    }

    // Per-customer credit limit (límite de fiado). Authoritative hard block,
    // computed before any write so a throw rolls the whole sale back (stock
    // untouched). The renderer mirrors this check for UX, but this is the
    // source of truth. Basis = total outstanding debt: current debt + this
    // sale's credit portion must not exceed the customer's enabled limit.
    if (data.customerId && creditAmount > 0) {
      const cust = db
        .prepare(
          'SELECT balance, credit_limit_enabled, credit_limit_amount FROM customers WHERE id = ?'
        )
        .get(data.customerId) as
        | { balance: number; credit_limit_enabled: number; credit_limit_amount: number | null }
        | undefined
      if (cust && cust.credit_limit_enabled === 1 && cust.credit_limit_amount != null) {
        // balance<0 means the customer owes; a positive ("a favor") balance
        // is not debt, so it caps at 0 and does not enlarge the limit.
        const currentDebt = Math.max(0, -cust.balance)
        const newOutstanding = currentDebt + creditAmount
        if (newOutstanding > cust.credit_limit_amount) {
          const available = Math.max(0, cust.credit_limit_amount - currentDebt)
          throw new Error(
            `Límite de fiado superado. Límite: ${formatGs(cust.credit_limit_amount)}, ` +
              `deuda actual: ${formatGs(currentDebt)}, disponible: ${formatGs(available)}. ` +
              `Esta venta a crédito de ${formatGs(creditAmount)} no se puede registrar.`
          )
        }
      }
    }

    const result = db
      .prepare(
        `
      INSERT INTO sales (
        register_id, customer_id, user_id, subtotal, discount, total,
        payment_method, payment_processor, payment_reference, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        topProcessor,
        topReference,
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
        'INSERT INTO sale_payments (sale_id, method, amount, processor, reference) VALUES (?, ?, ?, ?, ?)'
      )
      for (const p of data.payments) {
        const lineRef = normalizeReference(p.reference)
        const lineProc = p.method === 'card' ? (p.processor ?? null) : null
        validatePaymentDetails(p.method, lineProc, lineRef)
        insertPayment.run(saleId, p.method, p.amount, lineProc, lineRef)
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
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name
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
    SELECT si.*, p.name as product_name, p.price as normal_price
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `
    )
    .all(id)

  sale.payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id)
  return sale
}

export function getAllSales(
  opts: {
    from?: string
    to?: string
    paymentMethod?: string
    userId?: number
    page?: number
    perPage?: number
  } = {}
) {
  const db = getDb()
  const params: unknown[] = []
  const conditions: string[] = []
  if (opts.from) {
    // Raw half-open range (>= from, < to+1day) so idx_sales_created is usable;
    // wrapping the column in date() would force a full scan. created_at is stored
    // as 'YYYY-MM-DD HH:MM:SS' so lexical comparison against a date string is correct.
    conditions.push('s.created_at >= ?')
    params.push(opts.from)
  }
  if (opts.to) {
    conditions.push("s.created_at < date(?, '+1 day')")
    params.push(opts.to)
  }
  if (opts.paymentMethod) {
    conditions.push('s.payment_method = ?')
    params.push(opts.paymentMethod)
  }
  if (opts.userId !== undefined) {
    conditions.push('s.user_id = ?')
    params.push(opts.userId)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM sales s ${where}`).get(...params) as { c: number }
  ).c

  const isPaginated = opts.page !== undefined
  const page = Math.max(1, opts.page ?? 1)
  const perPage = opts.perPage ?? (isPaginated ? 50 : total)
  const limitClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
  const limitParams = isPaginated ? [perPage, (page - 1) * perPage] : []

  const items = db
    .prepare(
      `SELECT s.*, c.name as customer_name, u.name as user_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       ${limitClause}`
    )
    .all(...params, ...limitParams)

  return { items, total, page, perPage }
}

export function getRecentSales(limit: number = 50) {
  return getDb()
    .prepare(
      `
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name
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
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.register_id = ?
    ORDER BY s.created_at DESC
  `
    )
    .all(registerId)
}

export function cancelSale(id: number, userId: number, options?: { refundMixedCredit?: boolean }) {
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

    let detailsText = `Venta #${id} anulada`

    if (sale.payment_method === 'credit' && sale.customer_id) {
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(
        sale.total,
        sale.customer_id
      )
    } else if (sale.payment_method === 'mixed' && sale.customer_id) {
      // 002-review-fixes US3: cancelling a mixed-payment sale surfaces an
      // explicit choice. The caller decides whether to refund the credit
      // portion (charged to the customer's balance at sale time); either
      // outcome is recorded in action_logs.details so a future audit can
      // trace what happened (FR-008/FR-009).
      const creditRow = db
        .prepare(
          "SELECT COALESCE(SUM(amount), 0) AS credit FROM sale_payments WHERE sale_id = ? AND method = 'credit'"
        )
        .get(id) as { credit: number }
      const creditPortion = creditRow.credit
      if (creditPortion > 0) {
        if (options?.refundMixedCredit) {
          db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(
            creditPortion,
            sale.customer_id
          )
          detailsText = `Venta #${id} anulada — porción crédito ${formatGs(creditPortion)} (devolución aplicada)`
        } else {
          detailsText = `Venta #${id} anulada — porción crédito ${formatGs(creditPortion)} (devolución NO aplicada por decisión del cajero)`
        }
      }
    }

    db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(id)
    db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
      userId,
      'cancel_sale',
      detailsText
    )

    return getSaleById(id)
  })
  return txn()
}

// Format a Guarani amount the same way the renderer does for ticket / audit
// strings, so the audit row reads naturally to a Spanish-speaking merchant.
// e.g. 50000 → "Gs. 50.000".
function formatGs(value: number): string {
  return `Gs. ${Math.round(value).toLocaleString('es-PY')}`
}

export function getDaySalesTotal() {
  const result = getDb()
    .prepare(
      `
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM sales
    WHERE created_at >= date('now','localtime')
      AND created_at < date('now','localtime','+1 day')
      AND status = 'completed'
  `
    )
    .get() as { total: number; count: number }
  return result
}

// 007-receipt-share: append-only audit row when the renderer shares a sale
// receipt through one of the alternative channels (WhatsApp / PDF / PNG).
// Cross-user calls are allowed by design — a supervisor often re-sends a past
// receipt for a different cashier when a customer comes back asking for it.
const VALID_SHARE_CHANNELS: ReadonlySet<string> = new Set(['whatsapp', 'pdf', 'image'])

export function logSaleShare(
  userId: number,
  saleId: number,
  channel: string,
  target: string | null
):
  | { ok: true; logId: number }
  | { ok: false; error: 'sale_not_found' | 'invalid_channel' | 'invalid_target' } {
  if (!VALID_SHARE_CHANNELS.has(channel)) {
    return { ok: false, error: 'invalid_channel' }
  }
  let normalizedTarget: string | null = null
  if (channel === 'whatsapp') {
    if (target == null || !/^\d{9,15}$/.test(target)) {
      return { ok: false, error: 'invalid_target' }
    }
    normalizedTarget = target
  }

  const db = getDb()
  const exists = db.prepare('SELECT 1 FROM sales WHERE id = ?').get(saleId)
  if (!exists) return { ok: false, error: 'sale_not_found' }

  const details = JSON.stringify({ saleId, channel, target: normalizedTarget })
  const result = db
    .prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(userId, 'sale.share', details)
  return { ok: true, logId: Number(result.lastInsertRowid) }
}
