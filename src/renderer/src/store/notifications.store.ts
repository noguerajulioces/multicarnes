import { create } from 'zustand'
import type { Customer, Product, Role } from '@shared/types'
import { useAuthStore } from './auth.store'

export type NotificationCategory = 'low_stock' | 'pending_credits'

const ALL_CATEGORIES: readonly NotificationCategory[] = ['low_stock', 'pending_credits']

const STORAGE_PREFIX = 'notif:seen:'

function storageKey(userId: number, category: NotificationCategory): string {
  return `${STORAGE_PREFIX}${userId}:${category}`
}

function parseStored(raw: string | null): Set<number> {
  if (!raw) return new Set()
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))
  } catch {
    return new Set()
  }
}

function serializeSeen(set: Set<number>): string {
  return JSON.stringify(Array.from(set))
}

function emptyCategoryMap(): Record<NotificationCategory, Set<number>> {
  return {
    low_stock: new Set(),
    pending_credits: new Set()
  }
}

// 006-notif-read-state: el cajero no ve "Cobros pendientes" (regla preexistente
// en Header.tsx + matrix.ts). Mantenemos esa visibilidad en una sola fuente.
function categoriesVisibleTo(role: string): NotificationCategory[] {
  if (role === 'cajero') return ['low_stock']
  return ['low_stock', 'pending_credits']
}

export interface NotificationStoreState {
  current: Record<NotificationCategory, Set<number>>
  seen: Record<NotificationCategory, Set<number>>
  loadedForUserId: number | null
  refreshing: boolean
  refresh: () => Promise<void>
  markAllVisibleAsSeen: (role: string) => void
  reset: () => void
  loadForUser: (userId: number | null) => void
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  current: emptyCategoryMap(),
  seen: emptyCategoryMap(),
  loadedForUserId: null,
  refreshing: false,

  loadForUser: (userId) => {
    if (userId === null) {
      get().reset()
      return
    }
    if (userId === get().loadedForUserId) return
    const nextSeen = emptyCategoryMap()
    for (const c of ALL_CATEGORIES) {
      nextSeen[c] = parseStored(localStorage.getItem(storageKey(userId, c)))
    }
    set({
      seen: nextSeen,
      current: emptyCategoryMap(),
      loadedForUserId: userId
    })
  },

  reset: () => {
    set({
      current: emptyCategoryMap(),
      seen: emptyCategoryMap(),
      loadedForUserId: null,
      refreshing: false
    })
  },

  refresh: async () => {
    const { loadedForUserId, refreshing } = get()
    if (loadedForUserId === null || refreshing) return
    set({ refreshing: true })
    try {
      const role: Role = useAuthStore.getState().user?.role ?? 'cajero'
      const visible = categoriesVisibleTo(role)

      const nextCurrent = emptyCategoryMap()
      const lowStockTask = window.api.products.lowStock()
      const pendingTask = visible.includes('pending_credits')
        ? window.api.reports.pendingCredits()
        : Promise.resolve([] as Customer[])
      const [lowStock, pending] = await Promise.all([lowStockTask, pendingTask])
      nextCurrent.low_stock = new Set((lowStock as Product[]).map((p) => p.id))
      nextCurrent.pending_credits = new Set((pending as Customer[]).map((c) => c.id))

      // Reconciliación (US2): "seen" no puede contener ids que ya no están en
      // "current"; al salir y reentrar una entidad cuenta como nueva alerta
      // (FR-006, FR-010).
      const prevSeen = get().seen
      const nextSeen = { ...prevSeen }
      let seenChanged = false
      for (const c of ALL_CATEGORIES) {
        const keptArr: number[] = []
        for (const id of prevSeen[c]) {
          if (nextCurrent[c].has(id)) keptArr.push(id)
        }
        if (keptArr.length !== prevSeen[c].size) {
          nextSeen[c] = new Set(keptArr)
          localStorage.setItem(storageKey(loadedForUserId, c), serializeSeen(nextSeen[c]))
          seenChanged = true
        }
      }
      set(seenChanged ? { current: nextCurrent, seen: nextSeen } : { current: nextCurrent })
    } catch {
      // Si el IPC falla (sin permiso, sin DB, etc.), preservamos el último
      // estado conocido y reintentamos en el próximo tick.
    } finally {
      set({ refreshing: false })
    }
  },

  markAllVisibleAsSeen: (role) => {
    const { loadedForUserId, seen, current } = get()
    if (loadedForUserId === null) return
    const next = { ...seen }
    let changed = false
    for (const c of categoriesVisibleTo(role)) {
      if (current[c].size === 0) continue
      const merged = new Set(seen[c])
      const sizeBefore = merged.size
      for (const id of current[c]) merged.add(id)
      if (merged.size !== sizeBefore) {
        next[c] = merged
        localStorage.setItem(storageKey(loadedForUserId, c), serializeSeen(merged))
        changed = true
      }
    }
    if (changed) set({ seen: next })
  }
}))

export function selectUnseenCount(state: NotificationStoreState, role: string): number {
  let total = 0
  for (const c of categoriesVisibleTo(role)) {
    for (const id of state.current[c]) {
      if (!state.seen[c].has(id)) total++
    }
  }
  return total
}

export function selectUnseenForCategory(
  state: NotificationStoreState,
  category: NotificationCategory
): number {
  let count = 0
  for (const id of state.current[category]) {
    if (!state.seen[category].has(id)) count++
  }
  return count
}
