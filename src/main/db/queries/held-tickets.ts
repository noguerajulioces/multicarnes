import { getDb } from '../index'

export interface HeldTicketRow {
  id: string
  label: string
  payload: string
  discount: number
  user_id: number | null
  created_at: string
}

export function listHeldTickets(userId: number): HeldTicketRow[] {
  return getDb()
    .prepare('SELECT * FROM held_tickets WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as HeldTicketRow[]
}

export function addHeldTicket(data: {
  id: string
  label: string
  payload: string
  discount: number
  userId: number
}): HeldTicketRow {
  const db = getDb()
  db.prepare(
    'INSERT OR REPLACE INTO held_tickets (id, label, payload, discount, user_id) VALUES (?, ?, ?, ?, ?)'
  ).run(data.id, data.label, data.payload, data.discount, data.userId)
  return db.prepare('SELECT * FROM held_tickets WHERE id = ?').get(data.id) as HeldTicketRow
}

export function removeHeldTicket(id: string, userId: number): void {
  const db = getDb()
  const txn = db.transaction(() => {
    const result = db
      .prepare('DELETE FROM held_tickets WHERE id = ? AND user_id = ?')
      .run(id, userId)
    if (result.changes === 0) {
      db.prepare('INSERT INTO action_logs (user_id, action, details) VALUES (?, ?, ?)').run(
        userId,
        'held_ticket_remove_denied',
        `Held ticket ${id} not found or not owned by user ${userId}`
      )
      throw new Error('Held ticket not found or access denied')
    }
  })
  txn()
}

export function clearHeldTickets(userId: number): void {
  getDb().prepare('DELETE FROM held_tickets WHERE user_id = ?').run(userId)
}
