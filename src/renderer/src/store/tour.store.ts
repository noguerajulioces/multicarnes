import { create } from 'zustand'

const STORAGE_PREFIX = 'tour:seen:'

interface TourState {
  seen: Record<string, boolean>
  markSeen: (key: string) => void
  resetSeen: (key: string) => void
  resetAll: () => void
}

export const useTourStore = create<TourState>((set) => ({
  seen: {},
  markSeen: (key) => {
    localStorage.setItem(STORAGE_PREFIX + key, '1')
    set((s) => ({ seen: { ...s.seen, [key]: true } }))
  },
  resetSeen: (key) => {
    localStorage.removeItem(STORAGE_PREFIX + key)
    set((s) => ({ seen: { ...s.seen, [key]: false } }))
  },
  resetAll: () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k)
    }
    set({ seen: {} })
  }
}))

export function hasTourBeenSeen(key: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + key) === '1'
}
