import { create } from 'zustand'
import type { CartItem } from '@shared/types'

const STORAGE_KEY = 'held-tickets'

export interface HeldTicket {
  id: string
  savedAt: string
  label: string
  items: CartItem[]
  discount: number
}

interface HeldState {
  tickets: HeldTicket[]
  add: (label: string, items: CartItem[], discount: number) => void
  remove: (id: string) => void
  consume: (id: string) => HeldTicket | null
  clear: () => void
}

function read(): HeldTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HeldTicket[]) : []
  } catch {
    return []
  }
}

function persist(tickets: HeldTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  } catch {
    /* ignore quota errors */
  }
}

export const useHeldStore = create<HeldState>((set, get) => ({
  tickets: read(),

  add: (label, items, discount) => {
    const ticket: HeldTicket = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      label,
      items,
      discount
    }
    const next = [ticket, ...get().tickets]
    persist(next)
    set({ tickets: next })
  },

  remove: (id) => {
    const next = get().tickets.filter((t) => t.id !== id)
    persist(next)
    set({ tickets: next })
  },

  consume: (id) => {
    const ticket = get().tickets.find((t) => t.id === id) ?? null
    if (ticket) {
      const next = get().tickets.filter((t) => t.id !== id)
      persist(next)
      set({ tickets: next })
    }
    return ticket
  },

  clear: () => {
    persist([])
    set({ tickets: [] })
  }
}))
