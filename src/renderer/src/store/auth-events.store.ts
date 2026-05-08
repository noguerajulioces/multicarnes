// Domain-scoped store for authorization-event surfacing on the dashboard.
// Holds the list of open alerts plus a loading flag. Stays separate from
// auth.store.ts (login session) to keep stores single-responsibility per
// Constitution Principle II.

import { create } from 'zustand'
import type { AuthAlert } from '@shared/auth-types'

interface AuthEventsState {
  alerts: AuthAlert[]
  loading: boolean
  loadedAt: number | null
  fetchAlerts: () => Promise<void>
  acknowledge: (alertId: number) => Promise<void>
}

export const useAuthEventsStore = create<AuthEventsState>((set) => ({
  alerts: [],
  loading: false,
  loadedAt: null,

  fetchAlerts: async () => {
    set({ loading: true })
    try {
      const alerts = await window.api.auth.listAlerts()
      set({ alerts, loading: false, loadedAt: Date.now() })
    } catch {
      // Auth failures here mean the caller is not admin — silently keep the
      // empty list so non-admin pages don't show an error toast.
      set({ alerts: [], loading: false, loadedAt: Date.now() })
    }
  },

  acknowledge: async (alertId: number) => {
    try {
      await window.api.auth.acknowledgeAlert(alertId)
    } catch {
      /* surface via the page that called this — store stays optimistic */
    }
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== alertId) }))
  }
}))
