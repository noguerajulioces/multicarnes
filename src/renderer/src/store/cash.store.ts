import { create } from 'zustand'
import type { CashRegister } from '@shared/types'

interface CashState {
  register: CashRegister | null
  setRegister: (register: CashRegister | null) => void
}

export const useCashStore = create<CashState>((set) => ({
  register: null,
  setRegister: (register) => set({ register })
}))
