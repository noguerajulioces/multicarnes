import { create } from 'zustand'

type TourKey = 'ventas' | 'dashboard'

const STORAGE_PREFIX = 'tour:seen:'

function readSeen(key: TourKey): boolean {
  return localStorage.getItem(STORAGE_PREFIX + key) === '1'
}

interface TourState {
  seen: Record<TourKey, boolean>
  markSeen: (key: TourKey) => void
  resetSeen: (key: TourKey) => void
}

export const useTourStore = create<TourState>((set) => ({
  seen: {
    ventas: readSeen('ventas'),
    dashboard: readSeen('dashboard')
  },
  markSeen: (key) => {
    localStorage.setItem(STORAGE_PREFIX + key, '1')
    set((s) => ({ seen: { ...s.seen, [key]: true } }))
  },
  resetSeen: (key) => {
    localStorage.removeItem(STORAGE_PREFIX + key)
    set((s) => ({ seen: { ...s.seen, [key]: false } }))
  }
}))
