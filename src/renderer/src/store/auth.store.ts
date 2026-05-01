import { create } from 'zustand'
import type { User } from '@shared/types'

const STORAGE_KEY = 'auth.user'

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readUser(),
  setUser: (user) => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
    set({ user })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null })
  }
}))
