import { create } from 'zustand'

const STORAGE_KEY = 'tour:ventas:seen'

interface TourState {
  ventasSeen: boolean
  markVentasSeen: () => void
  resetVentasSeen: () => void
}

function readSeen(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export const useTourStore = create<TourState>((set) => ({
  ventasSeen: readSeen(),
  markVentasSeen: () => {
    localStorage.setItem(STORAGE_KEY, '1')
    set({ ventasSeen: true })
  },
  resetVentasSeen: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ ventasSeen: false })
  }
}))
