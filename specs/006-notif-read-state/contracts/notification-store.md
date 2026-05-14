# Contrato del Store de Notificaciones

**Feature**: 006-notif-read-state · **Branch**: `006-notif-read-state` · **Fecha**: 2026-05-14

Este es el único "contrato" relevante de la feature. NO hay contratos IPC nuevos (se reutilizan `products:lowStock` y `reports:pendingCredits` sin modificar).

---

## Ubicación

- **Archivo**: `src/renderer/src/store/notifications.store.ts`
- **Patrón**: Zustand store por dominio (Principio II de la constitución — no se fusiona con `auth.store`, `cash.store`, etc.).

## Tipos públicos

```ts
export type NotificationCategory = 'low_stock' | 'pending_credits'

export interface NotificationStoreState {
  /** IDs en el conjunto vivo de alertas por categoría (resultado del último refresh exitoso). */
  current: Record<NotificationCategory, Set<number>>

  /** IDs ya vistos por el usuario actual, por categoría. */
  seen: Record<NotificationCategory, Set<number>>

  /** userId cuyo "seen" está cargado en memoria. null si no hay sesión. */
  loadedForUserId: number | null

  /** Está corriendo un refresh en este momento (para evitar refresh en paralelo). */
  refreshing: boolean

  /** Trae los conjuntos vivos desde IPC y reconcilia "seen". */
  refresh: () => Promise<void>

  /** Marca como vistas todas las alertas actualmente en "current" (filtrando por rol). */
  markAllVisibleAsSeen: (role: string) => void

  /** Resetea el estado en memoria (NO borra localStorage). Útil al logout. */
  reset: () => void

  /** Cambia el usuario activo y recarga "seen" desde localStorage. */
  loadForUser: (userId: number | null) => void
}
```

## Selector derivado (función separada, NO en el state)

```ts
/** Cuenta total de alertas no leídas visibles al rol indicado. */
export function selectUnseenCount(state: NotificationStoreState, role: string): number
```

## Acciones — contratos de comportamiento

### `refresh()`

- **Pre**: ninguna.
- **Post**:
  - `current[c]` se reemplaza por el conjunto de IDs obtenidos por cada categoría.
  - Por cada `c`: se ejecuta `seen[c] = seen[c] ∩ current[c]` (reconciliación), y si cambió, se persiste.
  - Si la IPC falla, `current` y `seen` no se modifican.
- **Concurrencia**: si ya hay un `refresh` en curso (`refreshing === true`), retorna inmediatamente sin disparar otro.
- **IPC reutilizadas (sin cambios)**:
  - `window.api.products.lowStock()` → `Product[]` (usa `id` como `entityId`).
  - `window.api.reports.pendingCredits()` → `{ id, name, … }[]` (usa `id` del cliente).
- **No invocada si `loadedForUserId === null`**: si no hay sesión activa, retorna sin hacer nada.

### `markAllVisibleAsSeen(role)`

- **Pre**: existe un `loadedForUserId !== null`.
- **Post**: para cada categoría visible al rol pasado:
  - `seen[c] = seen[c] ∪ current[c]`.
  - Se persiste en `localStorage` clave `notif:seen:<loadedForUserId>:<c>`.
- **Filtrado por rol**:
  - `role === 'cajero'`: solo opera sobre `low_stock`. NO toca `pending_credits` (no lo ve).
  - Otros roles: opera sobre todas las categorías.

### `reset()`

- **Post**: `current = {}`, `seen = {}`, `loadedForUserId = null`. NO toca `localStorage`.

### `loadForUser(userId)`

- **Si `userId === null`**: llama internamente a `reset()`.
- **Si `userId !== loadedForUserId`**:
  - Vacía `current` en memoria.
  - Para cada `NotificationCategory`, lee `localStorage` clave `notif:seen:<userId>:<c>`, parsea JSON a `number[]`, deserializa a `Set<number>`. Si la clave no existe o el JSON es inválido, usa `new Set()`.
  - Setea `loadedForUserId = userId`.
- **Si `userId === loadedForUserId`**: no-op.

## Selector `selectUnseenCount`

- Para cada categoría visible al rol:
  - `unseen_c = |current[c] \ seen[c]|`
- Retorna `Σ_c unseen_c`.
- Cajero: solo cuenta `low_stock`.
- Otros roles: cuenta `low_stock + pending_credits`.

## Integración con `Header.tsx` / `NotificationBell`

Cambios mínimos al componente existente. Sustituir:

```tsx
// Antes (esquemático):
const [lowStockCount, setLowStockCount] = useState(0)
const [pendingCount, setPendingCount] = useState(0)
const total = lowStockCount + (isCajero ? 0 : pendingCount)
```

por:

```tsx
const role = user?.role ?? 'cajero'
const total = useNotificationStore((s) => selectUnseenCount(s, role))
const refresh = useNotificationStore((s) => s.refresh)
const markSeen = useNotificationStore((s) => s.markAllVisibleAsSeen)
```

Y:

- Mantener `useEffect` de refresh inicial + intervalo de 60 s, pero invocando `refresh()` del store en lugar de `Promise.all` local.
- Mantener `useEffect` que llama `refresh()` al abrir; **adicionalmente**, llamar `markSeen(role)` justo después de abrir (`setOpen(true)`).
- Para mostrar el listado en el dropdown se siguen necesitando los conteos crudos *por categoría* (p. ej. "1 producto crítico"). El store expone esos conteos vía selectores cortos:
  - `state.current.low_stock.size`
  - `state.current.pending_credits.size`

## Hook de ciclo de vida del usuario

En el bootstrap del renderer (donde sea que se inicialice el auth) o vía suscripción a `useAuthStore`:

- Al detectar cambio de `user`, invocar `useNotificationStore.getState().loadForUser(user?.id ?? null)`.
- Esto puede vivir en un pequeño `useEffect` dentro de `Header.tsx` (donde ya se accede al `useAuthStore`) — no requiere un hook separado.

## Lo que ESTE contrato NO incluye

- **IPC main**: ninguna firma nueva. Las dos IPC existentes (`products:lowStock`, `reports:pendingCredits`) se invocan tal cual.
- **Preload**: sin cambios.
- **SQLite**: sin cambios (ver `data-model.md`).
- **Migración**: no aplica.
- **Tests automatizados**: no aplica (ver `research.md` D-09 y `quickstart.md`).
