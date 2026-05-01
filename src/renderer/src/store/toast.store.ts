import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (type: ToastType, message: string, duration?: number) => string
  remove: (id: string) => void
  clear: () => void
}

let counter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message, duration = 4000) => {
    const id = `${Date.now()}-${++counter}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    if (duration > 0) {
      setTimeout(() => get().remove(id), duration)
    }
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}))
