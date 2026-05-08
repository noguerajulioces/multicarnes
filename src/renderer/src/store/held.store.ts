import { create } from 'zustand'
import type { CartItem } from '@shared/types'

const LEGACY_STORAGE_KEY = 'held-tickets'

export interface HeldTicket {
  id: string
  savedAt: string
  label: string
  items: CartItem[]
  discount: number
}

interface HeldState {
  tickets: HeldTicket[]
  loaded: boolean
  loadFromDb: () => Promise<void>
  add: (label: string, items: CartItem[], discount: number) => void
  remove: (id: string) => void
  consume: (id: string) => HeldTicket | null
  clear: () => void
}

interface HeldRowFromDb {
  id: string
  label: string
  payload: string
  discount: number
  created_at: string
}

function rowToTicket(row: HeldRowFromDb): HeldTicket {
  let items: CartItem[] = []
  try {
    items = JSON.parse(row.payload) as CartItem[]
  } catch {
    items = []
  }
  return {
    id: row.id,
    savedAt: row.created_at,
    label: row.label,
    items,
    discount: row.discount
  }
}

function ticketToRow(t: HeldTicket): {
  id: string
  label: string
  payload: string
  discount: number
} {
  return {
    id: t.id,
    label: t.label,
    payload: JSON.stringify(t.items),
    discount: t.discount
  }
}

// One-shot migration of any tickets still living in localStorage from previous
// versions. Idempotent: a second run finds no localStorage entry and no-ops.
async function migrateLegacyLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return
    const legacy = JSON.parse(raw) as HeldTicket[] | null
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return
    }
    for (const t of legacy) {
      await window.api.heldTickets.add(ticketToRow(t))
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* ignore parse / quota errors — leave the legacy key for a manual recovery */
  }
}

export const useHeldStore = create<HeldState>((set, get) => ({
  tickets: [],
  loaded: false,

  loadFromDb: async () => {
    await migrateLegacyLocalStorage()
    const rows = (await window.api.heldTickets.list()) as HeldRowFromDb[]
    set({ tickets: rows.map(rowToTicket), loaded: true })
  },

  add: (label, items, discount) => {
    const ticket: HeldTicket = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      label,
      items,
      discount
    }
    // Optimistic cache update so the UI stays synchronous, then persist.
    set({ tickets: [ticket, ...get().tickets] })
    void window.api.heldTickets.add(ticketToRow(ticket))
  },

  remove: (id) => {
    set({ tickets: get().tickets.filter((t) => t.id !== id) })
    void window.api.heldTickets.remove(id)
  },

  consume: (id) => {
    const ticket = get().tickets.find((t) => t.id === id) ?? null
    if (ticket) {
      set({ tickets: get().tickets.filter((t) => t.id !== id) })
      void window.api.heldTickets.remove(id)
    }
    return ticket
  },

  clear: () => {
    set({ tickets: [] })
    void window.api.heldTickets.clear()
  }
}))
