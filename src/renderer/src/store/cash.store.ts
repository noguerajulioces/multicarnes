import { create } from 'zustand'
import type { CashRegister } from '@shared/types'

const STORAGE_KEY = 'cash.register'

function readRegister(): CashRegister | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CashRegister) : null
  } catch {
    return null
  }
}

interface CashState {
  register: CashRegister | null
  setRegister: (register: CashRegister | null) => void
}

export const useCashStore = create<CashState>((set) => ({
  register: readRegister(),
  setRegister: (register) => {
    if (register) localStorage.setItem(STORAGE_KEY, JSON.stringify(register))
    else localStorage.removeItem(STORAGE_KEY)
    set({ register })
  }
}))
