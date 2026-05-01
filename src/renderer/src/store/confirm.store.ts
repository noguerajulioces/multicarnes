import { create } from 'zustand'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface ConfirmState {
  request: ConfirmRequest | null
  open: (request: ConfirmRequest) => void
  close: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (request) => set({ request }),
  close: (ok) => {
    const r = get().request
    if (r) {
      r.resolve(ok)
      set({ request: null })
    }
  }
}))
