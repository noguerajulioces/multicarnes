// 003-cash-movements-history
//
// Query module for the unified cash-movements timeline used by the
// "Movimientos de Caja" page. Owns:
//   - listMovements: paginated, filtered, role-scoped listing
//   - voidMovement: append-only inverse insertion + audit logging
//
// Cashier-self scoping is enforced inside listMovements, not in the IPC
// handler, so any caller (including the smoke test) cannot bypass it.

import { getDb } from '../index'
import type {
  CashMovementListOpts,
  CashMovementListResult,
  CashMovementRow,
  CashMovementType,
  Role
} from '../../../shared/types'

export interface CashMovementListCtx {
  callerUserId: number
  callerRole: Role
}

const VALID_TYPES: readonly CashMovementType[] = [
  'income',
  'expense',
  'opening',
  'closing',
  'void'
] as const

const PER_PAGE_MIN = 10
const PER_PAGE_MAX = 100
const PER_PAGE_DEFAULT = 25

interface CashMovementRawRow {
  id: number
  register_id: number
  user_id: number
  user_name: string | null
  type: CashMovementType
  amount: number
  description: string
  created_at: string
  void_of: number | null
  is_voided: number
  voided_by: number | null
  register_status: 'open' | 'closed'
}

function mapRow(row: CashMovementRawRow): CashMovementRow {
  return {
    id: row.id,
    registerId: row.register_id,
    userId: row.user_id,
    userName: row.user_name ?? '',
    type: row.type,
    amount: row.amount,
    description: row.description,
    createdAt: row.created_at,
    isVoided: row.is_voided === 1,
    voidedBy: row.voided_by,
    voidOf: row.void_of,
    registerStatus: row.register_status
  }
}

export function listMovements(
  opts: CashMovementListOpts,
  ctx: CashMovementListCtx
): CashMovementListResult {
  // Validate types early — fail fast before composing SQL.
  if (opts.types) {
    for (const t of opts.types) {
      if (!VALID_TYPES.includes(t)) throw new Error('Tipo de movimiento inválido.')
    }
  }

  if (opts.from && opts.to && opts.from > opts.to) {
    throw new Error('El rango de fechas es inválido.')
  }

  const rawPerPage = opts.perPage ?? PER_PAGE_DEFAULT
  if (rawPerPage < PER_PAGE_MIN || rawPerPage > PER_PAGE_MAX) {
    throw new Error('perPage debe estar entre 10 y 100.')
  }
  const perPage = rawPerPage
  const page = Math.max(1, opts.page ?? 1)

  // Cashier-self override (FR-015, FR-017): force user_id to the caller.
  const effectiveUserId =
    ctx.callerRole === 'cajero' ? ctx.callerUserId : (opts.userId ?? undefined)

  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.from) {
    conditions.push('date(cm.created_at) >= date(?)')
    params.push(opts.from)
  }
  if (opts.to) {
    conditions.push('date(cm.created_at) <= date(?)')
    params.push(opts.to)
  }
  if (opts.types && opts.types.length > 0) {
    const placeholders = opts.types.map(() => '?').join(',')
    conditions.push(`cm.type IN (${placeholders})`)
    params.push(...opts.types)
  }
  if (effectiveUserId !== undefined) {
    conditions.push('cm.user_id = ?')
    params.push(effectiveUserId)
  }
  if (opts.registerId !== undefined) {
    conditions.push('cm.register_id = ?')
    params.push(opts.registerId)
  }
  if (opts.search && opts.search.trim() !== '') {
    conditions.push('LOWER(cm.description) LIKE ?')
    params.push(`%${opts.search.trim().toLowerCase()}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const db = getDb()

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM cash_movements cm ${where}`).get(...params) as {
      c: number
    }
  ).c

  const rows = db
    .prepare(
      `SELECT
         cm.id, cm.register_id, cm.user_id, u.name AS user_name,
         cm.type, cm.amount, cm.description, cm.created_at,
         cm.void_of,
         CASE
           WHEN EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
           THEN 1 ELSE 0
         END AS is_voided,
         (SELECT v.id FROM cash_movements v WHERE v.void_of = cm.id LIMIT 1) AS voided_by,
         cr.status AS register_status
       FROM cash_movements cm
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN cash_registers cr ON cm.register_id = cr.id
       ${where}
       ORDER BY cm.created_at DESC, cm.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, (page - 1) * perPage) as CashMovementRawRow[]

  return {
    items: rows.map(mapRow),
    total,
    page,
    perPage
  }
}

export function getMovementById(id: number): CashMovementRow | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
         cm.id, cm.register_id, cm.user_id, u.name AS user_name,
         cm.type, cm.amount, cm.description, cm.created_at,
         cm.void_of,
         CASE
           WHEN EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)
           THEN 1 ELSE 0
         END AS is_voided,
         (SELECT v.id FROM cash_movements v WHERE v.void_of = cm.id LIMIT 1) AS voided_by,
         cr.status AS register_status
       FROM cash_movements cm
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN cash_registers cr ON cm.register_id = cr.id
       WHERE cm.id = ?`
    )
    .get(id) as CashMovementRawRow | undefined
  return row ? mapRow(row) : null
}

interface OriginalRow {
  id: number
  register_id: number
  user_id: number
  type: CashMovementType
  amount: number
  description: string
}

export function voidMovement(originalId: number, actorUserId: number): CashMovementRow {
  const db = getDb()

  // Step 1: load original.
  const original = db
    .prepare(
      'SELECT id, register_id, user_id, type, amount, description FROM cash_movements WHERE id = ?'
    )
    .get(originalId) as OriginalRow | undefined
  if (!original) throw new Error('Movimiento no encontrado.')

  // Step 2: only manual income/expense are voidable from this page.
  if (original.type === 'opening' || original.type === 'closing') {
    throw new Error(
      'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'
    )
  }

  // Step 3: a void row is itself not voidable.
  if (original.type === 'void') {
    throw new Error('No se puede anular una anulación.')
  }

  // Step 4: enforce one void per original.
  const existingInverse = db
    .prepare('SELECT id FROM cash_movements WHERE void_of = ?')
    .get(originalId) as { id: number } | undefined
  if (existingInverse) throw new Error('Este movimiento ya fue anulado.')

  // Resolve actor role for the action_logs detail (audit fidelity).
  const actor = db.prepare('SELECT role FROM users WHERE id = ?').get(actorUserId) as
    | { role: Role }
    | undefined

  // Step 5: insert inverse + action_logs entry inside one transaction.
  // (auth_audit is written by registerAuthorized's guard; here we record the
  //  per-event human-readable detail.)
  // If this income originated from a cash debt payment (customer_payments links
  // back via cash_movement_id), reverse that payment too: restore the customer's
  // debt and append an annulment row to its payment history (void_of → the
  // original), so the customer detail shows "pago → anulación" just like the cash
  // timeline. The original payment row is kept for the audit trail. Legacy
  // payments (made before the link existed) stay NULL and are not reversed.
  const inverseId = db.transaction((): number => {
    const result = db
      .prepare(
        `INSERT INTO cash_movements
           (register_id, user_id, type, amount, description, void_of)
         VALUES (?, ?, 'void', ?, ?, ?)`
      )
      .run(
        original.register_id,
        actorUserId,
        original.amount,
        `[ANULACIÓN] ${original.description}`,
        original.id
      )
    const newId = result.lastInsertRowid as number

    const linkedPayment = db
      .prepare(
        'SELECT id, customer_id, amount, note, affects_cash FROM customer_payments WHERE cash_movement_id = ? AND void_of IS NULL'
      )
      .get(original.id) as
      | {
          id: number
          customer_id: number
          amount: number
          note: string | null
          affects_cash: number
        }
      | undefined
    if (linkedPayment) {
      db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(
        linkedPayment.amount,
        linkedPayment.customer_id
      )
      const voidNote = linkedPayment.note
        ? `[ANULACIÓN] ${linkedPayment.note}`
        : '[ANULACIÓN] Pago anulado desde Movimientos de Caja'
      db.prepare(
        `INSERT INTO customer_payments
           (customer_id, user_id, amount, note, affects_cash, cash_movement_id, void_of)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`
      ).run(
        linkedPayment.customer_id,
        actorUserId,
        linkedPayment.amount,
        voidNote,
        linkedPayment.affects_cash,
        linkedPayment.id
      )
    }

    db.prepare(`INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)`).run(
      actorUserId,
      'void_cash_movement',
      JSON.stringify({
        original_id: original.id,
        inverse_id: newId,
        original_type: original.type,
        amount: original.amount,
        actor_role: actor?.role ?? null,
        reversed_customer_payment_id: linkedPayment?.id ?? null,
        reversed_customer_id: linkedPayment?.customer_id ?? null
      })
    )

    return newId
  })()

  const inverse = getMovementById(inverseId)
  if (!inverse) throw new Error('No se pudo recuperar la anulación recién creada.')
  return inverse
}
