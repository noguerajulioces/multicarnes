import { getDb } from '../index'

export interface HeldTicketRow {
  id: string
  label: string
  payload: string
  discount: number
  created_at: string
}

export function listHeldTickets(): HeldTicketRow[] {
  return getDb()
    .prepare('SELECT * FROM held_tickets ORDER BY created_at DESC')
    .all() as HeldTicketRow[]
}

export function addHeldTicket(data: {
  id: string
  label: string
  payload: string
  discount: number
}): HeldTicketRow {
  const db = getDb()
  db.prepare(
    'INSERT OR REPLACE INTO held_tickets (id, label, payload, discount) VALUES (?, ?, ?, ?)'
  ).run(data.id, data.label, data.payload, data.discount)
  return db.prepare('SELECT * FROM held_tickets WHERE id = ?').get(data.id) as HeldTicketRow
}

export function removeHeldTicket(id: string): void {
  getDb().prepare('DELETE FROM held_tickets WHERE id = ?').run(id)
}

export function clearHeldTickets(): void {
  getDb().prepare('DELETE FROM held_tickets').run()
}
