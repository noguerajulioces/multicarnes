import { getDb } from '../index'
import type {
  AuthAuditEntry,
  AuthAuditFilters,
  AuthOutcome,
  AuthAlert,
  Role
} from '../../../shared/auth-types'

interface AuditInsertInput {
  operation: string
  claimedUserId: number | null
  resolvedUserId: number | null
  resolvedRole: Role | null
  outcome: AuthOutcome
  senderId: number | null
}

interface AuditRow {
  id: number
  operation: string
  claimed_user_id: number | null
  resolved_user_id: number | null
  resolved_role: Role | null
  outcome: AuthOutcome
  sender_id: number | null
  created_at: string
  user_name: string | null
}

function rowToEntry(r: AuditRow): AuthAuditEntry {
  return {
    id: r.id,
    operation: r.operation,
    claimedUserId: r.claimed_user_id,
    resolvedUserId: r.resolved_user_id,
    resolvedRole: r.resolved_role,
    outcome: r.outcome,
    senderId: r.sender_id,
    createdAt: r.created_at,
    userName: r.user_name
  }
}

export function insertAudit(entry: AuditInsertInput): void {
  getDb()
    .prepare(
      'INSERT INTO auth_audit (operation, claimed_user_id, resolved_user_id, resolved_role, outcome, sender_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      entry.operation,
      entry.claimedUserId,
      entry.resolvedUserId,
      entry.resolvedRole,
      entry.outcome,
      entry.senderId
    )
}

export function listAudit(filters: AuthAuditFilters = {}): {
  entries: AuthAuditEntry[]
  total: number
} {
  const params = {
    userId: filters.userId ?? null,
    operation: filters.operation ?? null,
    outcome: filters.outcome ?? null,
    from: filters.from ?? null,
    to: filters.to ?? null,
    limit: Math.min(Math.max(filters.limit ?? 50, 1), 1000),
    offset: Math.max(filters.offset ?? 0, 0)
  }

  const totalRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM auth_audit a
       WHERE (:userId IS NULL OR a.claimed_user_id = :userId)
         AND (:operation IS NULL OR a.operation = :operation)
         AND (:outcome IS NULL OR a.outcome = :outcome)
         AND (:from IS NULL OR a.created_at >= :from)
         AND (:to IS NULL OR a.created_at <= :to)`
    )
    .get({
      userId: params.userId,
      operation: params.operation,
      outcome: params.outcome,
      from: params.from,
      to: params.to
    }) as { c: number }

  const rows = getDb()
    .prepare(
      `SELECT a.id, a.operation, a.claimed_user_id, a.resolved_user_id,
              a.resolved_role, a.outcome, a.sender_id, a.created_at,
              u.name AS user_name
       FROM auth_audit a
       LEFT JOIN users u ON u.id = a.claimed_user_id
       WHERE (:userId IS NULL OR a.claimed_user_id = :userId)
         AND (:operation IS NULL OR a.operation = :operation)
         AND (:outcome IS NULL OR a.outcome = :outcome)
         AND (:from IS NULL OR a.created_at >= :from)
         AND (:to IS NULL OR a.created_at <= :to)
       ORDER BY a.created_at DESC
       LIMIT :limit OFFSET :offset`
    )
    .all(params) as AuditRow[]

  return { entries: rows.map(rowToEntry), total: totalRow.c }
}

interface AlertWindowRow {
  user_id: number
  user_name: string
  window_start: string
  failure_count: number
  alert_id: number | null
  acknowledged_at: string | null
}

// Both created_at and the filter use 'localtime' to match the table's
// CREATE DEFAULT (datetime('now','localtime')) — otherwise rows stored
// in local time are compared against a UTC threshold and recent inserts
// look stale, suppressing alerts that should fire.
const ALERT_WINDOW_QUERY = `
  WITH windows AS (
    SELECT
      claimed_user_id      AS user_id,
      MIN(created_at)      AS window_start,
      COUNT(*)             AS failure_count
    FROM auth_audit
    WHERE created_at >= datetime('now','localtime','-10 minutes')
      AND outcome LIKE 'blocked-%'
      AND claimed_user_id IS NOT NULL
    GROUP BY claimed_user_id
    HAVING COUNT(*) >= 5
  )
  SELECT
    w.user_id,
    u.name           AS user_name,
    w.window_start,
    w.failure_count,
    a.id             AS alert_id,
    a.acknowledged_at
  FROM windows w
  JOIN users u ON u.id = w.user_id
  LEFT JOIN auth_alert_acks a
    ON a.user_id = w.user_id AND a.window_start = w.window_start
`

export function detectAndPersistAlertWindows(): AuthAlert[] {
  const db = getDb()
  const rows = db.prepare(ALERT_WINDOW_QUERY).all() as AlertWindowRow[]

  const insertAck = db.prepare(
    'INSERT OR IGNORE INTO auth_alert_acks (user_id, window_start) VALUES (?, ?)'
  )
  const findAck = db.prepare(
    'SELECT id FROM auth_alert_acks WHERE user_id = ? AND window_start = ?'
  )

  const alerts: AuthAlert[] = []
  for (const r of rows) {
    if (r.acknowledged_at) continue
    let alertId = r.alert_id
    if (alertId == null) {
      insertAck.run(r.user_id, r.window_start)
      const found = findAck.get(r.user_id, r.window_start) as { id: number } | undefined
      if (!found) continue
      alertId = found.id
    }
    alerts.push({
      id: alertId,
      userId: r.user_id,
      userName: r.user_name,
      windowStart: r.window_start,
      failureCount: r.failure_count,
      acknowledgedAt: null
    })
  }
  return alerts
}

export function acknowledgeAlert(alertId: number, ackByUserId: number): void {
  getDb()
    .prepare(
      "UPDATE auth_alert_acks SET acknowledged_at = datetime('now','localtime'), acknowledged_by = ? WHERE id = ? AND acknowledged_at IS NULL"
    )
    .run(ackByUserId, alertId)
}
