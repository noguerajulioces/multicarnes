# Modelo de Datos (Phase 1): Estado "leído" en notificaciones del header

**Feature**: 006-notif-read-state · **Branch**: `006-notif-read-state` · **Fecha**: 2026-05-14

Esta feature **NO** introduce nuevas tablas en SQLite, NO modifica el esquema existente, y NO agrega canales IPC. Todo el modelo vive en el renderer (Zustand + `localStorage`).

---

## Entidades

### 1. `NotificationCategory` (tipo cerrado)

Identificador de la categoría a la que pertenece una alerta. Valores actuales:

| Valor | Origen actual | Mostrado en dropdown como |
|---|---|---|
| `low_stock` | `window.api.products.lowStock()` → `products` con `stock <= min_stock` | "Stock bajo" |
| `pending_credits` | `window.api.reports.pendingCredits()` → `customers` con `balance < 0` (no visible para cajero) | "Cobros pendientes" |

Reglas:
- Se modela como union de strings literales: `type NotificationCategory = 'low_stock' | 'pending_credits'`.
- Añadir una categoría futura (FR-011) requiere extender este tipo y registrar su fuente IPC en el store.

### 2. `NotificationItem`

Una alerta puntual derivada del estado vivo. Estructura:

```ts
interface NotificationItem {
  category: NotificationCategory
  entityId: number   // products.id para low_stock; customers.id para pending_credits
}
```

Reglas:
- La identidad estable de una alerta es la dupla `(category, entityId)`.
- Atributos secundarios (nombre del producto, balance del cliente, etc.) se obtienen de las IPC existentes y se muestran en el dropdown, pero NO forman parte de la identidad de la alerta.

### 3. `SeenSet` (estado persistido en `localStorage`)

Por cada combinación (usuario, categoría), el renderer mantiene el conjunto de `entityId` ya expuestos al usuario.

- **Clave de almacenamiento**: `notif:seen:<userId>:<category>`
- **Formato del valor**: cadena JSON que contiene un arreglo de números (los `entityId`).
- **Ejemplo**:
  - Clave: `notif:seen:7:pending_credits`
  - Valor: `"[12,47,103]"`

Reglas:
- El conjunto se mantiene ordenado-deduplicado en memoria como `Set<number>`; al serializar se convierte a `Array.from(set)`.
- Si la clave no existe en `localStorage`, equivale a un conjunto vacío (todas las alertas son "nuevas").
- El conjunto se purga selectivamente: cuando una entidad sale del conjunto vivo en la fuente IPC, su `entityId` se remueve del `SeenSet` (Decisión D-03 / FR-010).

### 4. `NotificationState` (estado en memoria del store Zustand)

```ts
type EntityIdSet = Set<number>

interface NotificationState {
  // current[c] = IDs en el conjunto vivo de alertas en la última llamada a refresh().
  current: Record<NotificationCategory, EntityIdSet>

  // seen[c] = IDs ya marcados como vistos por el usuario actual.
  seen: Record<NotificationCategory, EntityIdSet>

  // Metadatos opcionales por categoría — datos auxiliares para renderizar la fila
  // del dropdown (p. ej. "1 cliente con saldo deudor"). El conteo lo deriva el store.
  meta: Record<NotificationCategory, { totalCurrent: number }>

  // userId activo cuya partición está cargada en seen. null si no hay sesión.
  loadedForUserId: number | null

  // Acciones
  refresh: () => Promise<void>
  markAllVisibleAsSeen: () => void
  reset: () => void
}
```

Reglas:
- El conteo del badge se deriva con un selector:
  `unseenCount(state) = Σ_c |current[c] \ seen[c]|` para todas las categorías visibles al rol actual.
- El badge nunca se calcula como `current.size - seen.size` global; se hace por categoría y se suma, porque las categorías son independientes y los IDs pueden colisionar entre tipos (producto 5 y cliente 5).

## Transiciones de estado

| Evento | Operación sobre `current` | Operación sobre `seen` | Persistencia |
|---|---|---|---|
| `refresh()` se ejecuta exitosamente | Reemplaza `current[c]` con el conjunto IDs recién obtenidos por categoría. | Para cada categoría: elimina de `seen[c]` los IDs que ya NO están en `current[c]` (reconciliación / FR-010). | Persistir cada `seen[c]` actualizado tras la reconciliación. |
| `refresh()` falla (excepción IPC) | No modifica `current` ni `seen`. Se mantiene el último estado conocido. | — | — |
| Usuario abre el dropdown (`markAllVisibleAsSeen`) | — | Para cada categoría visible al rol actual: `seen[c] = seen[c] ∪ current[c]`. | Persistir cada `seen[c]` modificado. |
| Cambio de `user.id` (login a otra cuenta) | `current` se vacía (se volverá a poblar en el próximo `refresh()`). | `seen` se vacía en memoria y se vuelve a cargar desde `localStorage` con el prefijo del nuevo `userId`. | Lectura desde `localStorage`. No se borra el set del usuario anterior. |
| Logout (`user` pasa a `null`) | `current` y `seen` se vacían en memoria. | — | `localStorage` queda intacto para que el próximo login del mismo usuario recupere su estado. |
| `reset()` (llamado explícitamente) | Limpia memoria. | Limpia memoria; OPCIONAL limpiar `localStorage` para el usuario actual sólo si se invoca con flag explícito (no se requiere en esta feature). | — |

## Validaciones e invariantes

- **INV-1**: `seen[c] ⊆ current[c]` después de cada `refresh()` (gracias a la reconciliación).
- **INV-2**: Para cada `entityId ∈ seen[c]`, la categoría `c` ha sido visible al usuario actual al menos una vez (porque solo `markAllVisibleAsSeen` lo añade y excluye categorías no visibles al rol).
- **INV-3**: La clave `notif:seen:<userId>:<category>` en `localStorage` siempre contiene un JSON parseable a `number[]`; si la deserialización falla, el código trata el valor como conjunto vacío y sobreescribe en el próximo write (defensa contra valores corruptos).

## Sin cambios al esquema SQLite

- Esquema existente intacto.
- No se crea tabla nueva.
- No se modifica `getLowStockProducts()` ni `pendingCredits()` ni sus rules de autorización.
- No se crea migration v9.
- No se toca `action_logs`.

Esta sección está incluida explícitamente para satisfacer el Principio VI (Schema Evolution) sin requerir ninguna acción.
