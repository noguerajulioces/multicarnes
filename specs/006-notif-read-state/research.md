# Investigación (Phase 0): Estado "leído" en notificaciones del header

**Feature**: 006-notif-read-state · **Branch**: `006-notif-read-state` · **Fecha**: 2026-05-14

Este documento resuelve los puntos de decisión técnica que quedaron implícitos en la spec. No hay marcadores `[NEEDS CLARIFICATION]` abiertos.

---

## D-01 — Mecanismo de persistencia del estado de "leído"

- **Decisión**: Persistir el estado en `localStorage` del proceso renderer, NO en SQLite, NO en un canal IPC nuevo.
- **Justificación**:
  - La spec acepta explícitamente persistencia por-dispositivo (no se requiere sincronización entre PCs).
  - Sigue exactamente el patrón ya existente para datos UI con scope local: `auth.store.ts`, `cash.store.ts`, `theme.store.ts`, `tour.store.ts`, `Sidebar.tsx` (colapsado) — todos usan `localStorage` con un prefijo por dominio.
  - Cumple los Principios IV (no cruzar el límite main/renderer sin necesidad) y VII (simplicidad) de la constitución.
  - Evita una migración SQLite, un canal IPC nuevo y un round-trip por cada apertura del dropdown.
- **Alternativas consideradas**:
  - **Tabla SQLite `notification_reads`**: rechazada. Aporta sincronización entre dispositivos (no requerida) a costa de migración v9, canal IPC nuevo (`notifications:markSeen`, `notifications:listSeen`), y round-trip de read/write por cada interacción con la campana. Mata el principio de simplicidad para un valor que la spec no pide.
  - **Cookies / IndexedDB**: rechazadas. No hay precedente en el repo y `localStorage` ya cubre el caso (volumen < 1 KB por usuario realista).

## D-02 — Esquema de claves en localStorage

- **Decisión**: Una sola clave por (usuario, categoría):
  - Formato: `notif:seen:<userId>:<category>`
  - Valor: JSON serializado de un arreglo de IDs (números), ej. `"[12, 47, 103]"`.
  - Categorías permitidas (cerradas): `low_stock`, `pending_credits`.
- **Justificación**:
  - Una clave por categoría es bastante densa para que reconciliar (leer-modificar-escribir) sea O(n) sobre un conjunto típicamente pequeño (< 50 ítems).
  - Particionar por `userId` cumple FR-008 (estado por-usuario) sin un mega-mapa que requiera "compactación".
  - Categoría como prefijo simplifica añadir categorías futuras (FR-011) sin tocar la firma del store.
- **Alternativas consideradas**:
  - **Una clave por ítem** (`notif:seen:<userId>:<category>:<id> = "1"`): rechazada. Genera muchas entradas que requieren iterar `localStorage.key(i)` para listarlas (patrón usado en `tour.store.ts` para `resetAll`, costoso si crece). El arreglo JSON es más ergonómico para la operación dominante (chequear si un id está marcado).
  - **Un sólo blob global** (`notif:seen = { userA: { low_stock: [...] } }`): rechazada. Acopla escrituras de usuarios distintos y obliga a leer todo en cada operación.

## D-03 — Modelo de "alerta nueva" vs. "alerta ya leída"

- **Decisión**: Identidad de una alerta = (categoría, ID de la entidad subyacente). Re-entrada al conjunto se considera nueva (FR-006).
- **Justificación**:
  - Las dos categorías actuales tienen ID estable: `products.id` para Stock bajo (devuelto por `getLowStockProducts()` en [src/main/db/queries/products.ts:486](src/main/db/queries/products.ts#L486)) y `customers.id` para Cobros pendientes (devuelto por `pendingCredits()` en [src/main/db/queries/reports.ts:99](src/main/db/queries/reports.ts#L99)).
  - Conservar el ID es lo único necesario; ignoramos atributos secundarios (monto, nivel exacto de stock) — esto satisface FR-007 (no re-notificar si la entidad permanece en el conjunto aunque cambien sus atributos).
- **Implementación de "entidad salió del conjunto"**:
  - En cada `refresh()` del store, después de obtener el conjunto actual de IDs, se ejecuta una *reconciliación*: por cada ID en el `seen` que ya no está en el `current`, se remueve del `seen` (y se persiste). Esto cumple FR-010 (liberar marcas obsoletas) y prepara FR-006 (la próxima reentrada vuelve a contar como nueva).

## D-04 — Punto de "marcar como leído"

- **Decisión**: Marcar como leído en el momento en que el dropdown se *abre* (no al cerrarlo).
- **Justificación**:
  - Coincide con el comportamiento esperable: en cuanto el usuario ve la lista, las alertas ya están "vistas". Cerrar sin actuar no debe revertir esa lectura.
  - Resuelve trivialmente la Historia 3 (click directo en una fila) porque al abrir el dropdown el ítem ya quedó marcado, sin código extra en el handler de click.
- **Alternativa considerada**:
  - **Marcar al cerrar**: complica la Historia 3, requiere distinguir cierre por click-en-fila vs. click-fuera vs. tecla ESC, y abre la ventana a "el usuario abre, lee, recarga la app sin cerrar el dropdown manualmente". Rechazada.

## D-05 — Integración con `Header.tsx` / `NotificationBell`

- **Decisión**: Inyectar la lógica de "no leído" a través de un nuevo Zustand store `useNotificationStore`, manteniendo el componente `NotificationBell` tan presentacional como sea posible (Principio II de la constitución).
- **Justificación**:
  - El componente ya hace `setLowStockCount`/`setPendingCount` localmente; reemplazamos esos `useState` por selectores del store.
  - El store toma la responsabilidad de orquestar `refresh()` (que sigue invocando las IPC existentes `window.api.products.lowStock()` y `window.api.reports.pendingCredits()`), `markSeenAll()` y `reconcile()`.
  - Se respeta el límite renderer/main porque el store sigue hablando con main sólo a través de las funciones ya expuestas en `preload`.
- **Alternativa considerada**:
  - **Toda la lógica dentro del componente**: rechazada por Principio II (separar orquestación de presentación) y porque dificulta probarlo / razonarlo.

## D-06 — Carga inicial y cambio de usuario en el mismo dispositivo

- **Decisión**: El store observa el `useAuthStore` para detectar cambios de `user.id`. En cada cambio:
  - Si `user` es `null` → vacía `seen` y `current` en memoria, NO toca `localStorage`.
  - Si `user.id` cambia a un valor nuevo → recarga `seen` desde `localStorage` con el prefijo del nuevo usuario y deja `current` vacío hasta el próximo `refresh()`.
- **Justificación**:
  - Cumple el caso borde "cambio de usuario en el mismo dispositivo" (cada usuario tiene su propio estado, no se contamina entre cuentas).
  - No persistir borrado en logout cumple FR-009: el estado sobrevive a logout/login del mismo usuario.

## D-07 — Cajero vs. roles privilegiados

- **Decisión**: El store gestiona ambas categorías por defecto, pero al construir el conteo de no leídas y la lista a mostrar, respeta la regla actual: si `user.role === 'cajero'`, omite `pending_credits`.
- **Justificación**:
  - Mantiene la lógica de visibilidad existente en `NotificationBell` sin filtrar dos veces; una sola fuente de verdad.
  - No persiste estado "leído" en `pending_credits` para usuarios cajeros porque nunca lo ven; evita basura en `localStorage`.

## D-08 — Frecuencia de actualización

- **Decisión**: Mantener el intervalo de 60 s del refresh actual. El store ejecuta `refresh()` cada 60 s y al abrir el dropdown (igual que hoy).
- **Justificación**:
  - SC-003 exige re-detección dentro de "≤ 60 segundos", lo cual ya se cumple sin cambios.
  - Reducir el intervalo aumentaría carga sin valor demostrado.

## D-09 — Tests

- **Decisión**: Validación manual mediante quickstart (`quickstart.md`), sin tests automatizados.
- **Justificación**:
  - La constitución (sección "Development Workflow & Quality Gates") no exige tests automatizados; los features previos (001–005) usan el mismo enfoque de validación manual + revisión.
  - El refactor es pequeño (~150 LOC), la lógica del store es pura y fácil de razonar; el costo de set-up de Vitest/Jest no se justifica para este alcance.
- **Si se quisiera escalar más adelante**: el store es testeable en aislamiento (pure functions sobre `seen`/`current`); se podría agregar Vitest cuando exista la infraestructura general — fuera de scope de esta feature.

## D-10 — Migración / rollout

- **Decisión**: Sin migración. La primera vez que el código nuevo corre, `localStorage` no tiene la clave `notif:seen:<userId>:<category>`, se interpreta como conjunto vacío, y todas las alertas existentes se muestran como no leídas. El usuario abre el dropdown una vez y queda silenciado. No requiere backfill.
- **Justificación**:
  - Comportamiento aceptable y predecible: el "primer encuentro" reproduce exactamente el comportamiento actual y luego ya queda corregido.
