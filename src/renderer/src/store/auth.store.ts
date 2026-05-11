import { create } from 'zustand'
import type { User } from '@shared/types'
import { useHeldStore } from './held.store'

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
    // Reset domain stores that cache per-user data so a different user logging
    // in on the same terminal does not see the previous user's data while the
    // app fetches fresh data from the server (002-review-fixes FR-005).
    useHeldStore.getState().reset()
    set({ user })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    useHeldStore.getState().reset()
    set({ user: null })
  }
}))
