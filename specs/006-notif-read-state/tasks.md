---
description: "Lista de tareas de implementación para la feature 006-notif-read-state"
---

# Tasks: Estado "leído" en notificaciones del header

**Input**: Documentos de diseño en `/specs/006-notif-read-state/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/notification-store.md](./contracts/notification-store.md), [quickstart.md](./quickstart.md)

**Tests**: Esta feature NO incluye tests automatizados (decisión D-09 / `research.md` y consistente con el feature inventory del proyecto). La validación se hace mediante el quickstart manual.

**Organization**: Las tareas se agrupan por historia de usuario (US1, US2, US3) para implementación y verificación incrementales.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correrse en paralelo con otras tareas (archivo diferente, sin dependencias pendientes).
- **[Story]**: Etiqueta de la historia de usuario asociada (US1, US2, US3).
- Cada tarea incluye la ruta exacta del archivo afectado.

## Path Conventions

- Stack confirmado en `plan.md`: aplicación de escritorio Electron con `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`.
- Esta feature toca exclusivamente `src/renderer/src/store/` (archivo NUEVO) y `src/renderer/src/components/Header.tsx` (MODIFICADO). No se introducen carpetas nuevas.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validar el punto de partida antes de tocar código.

- [X] T001 Verificar que la branch `006-notif-read-state` está checkout y correr `npm run typecheck && npm run lint` para confirmar baseline limpio antes de aplicar cambios.
  - Resultado: typecheck 0 errores; lint 0 errores, 31 warnings pre-existentes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Crear el esqueleto del Zustand store de notificaciones. Sin esto, ninguna historia de usuario puede arrancar.

**⚠️ CRITICAL**: No empezar las fases de historias de usuario hasta que esta phase esté completa.

- [X] T002 Crear el archivo nuevo `src/renderer/src/store/notifications.store.ts` con: (a) `import { create } from 'zustand'`; (b) `export type NotificationCategory = 'low_stock' | 'pending_credits'`; (c) `export interface NotificationStoreState` exactamente como se define en [contracts/notification-store.md](./contracts/notification-store.md) (`current`, `seen`, `loadedForUserId`, `refreshing`, `refresh`, `markAllVisibleAsSeen`, `reset`, `loadForUser`); (d) constante `STORAGE_PREFIX = 'notif:seen:'`; (e) helpers internos `storageKey(userId, category)` y `parseStored(raw)` / `serializeSeen(set)`; (f) `export const useNotificationStore = create<NotificationStoreState>(...)` con estado inicial vacío (`current` y `seen` con un `Set<number>` por cada categoría, `loadedForUserId: null`, `refreshing: false`) y acciones como stubs no-op por ahora. Stubs deben tener firmas correctas para que `typecheck` pase.
- [X] T003 En el mismo archivo `src/renderer/src/store/notifications.store.ts`, añadir y exportar la función pura `export function selectUnseenCount(state: NotificationStoreState, role: string): number` que: itera las categorías visibles al `role` (cajero → solo `low_stock`; resto → ambas) y suma `|current[c] \ seen[c]|`. Incluir helper `function categoriesVisibleTo(role: string): NotificationCategory[]` reutilizable por `markAllVisibleAsSeen` y `refresh`.

**Checkpoint**: el store compila, sigue sin lógica funcional. Listo para empezar US1.

---

## Phase 3: User Story 1 - Abrir el dropdown silencia el badge (Priority: P1) 🎯 MVP

**Goal**: Cuando el usuario abre el dropdown del header, todas las alertas actualmente listadas quedan marcadas como leídas para ese usuario en ese dispositivo. El badge muestra solo no-leídas y se queda en cero hasta que ingrese una alerta verdaderamente nueva.

**Independent Test**: Quickstart Tests 1, 5, 6, 8 y 9 (apertura del dropdown, click directo en fila, cambio de usuario, dropdown vacío, persistencia tras cierre de app).

### Implementation for User Story 1

- [X] T004 [US1] En `src/renderer/src/store/notifications.store.ts`, implementar la acción `loadForUser(userId: number | null)`: si `userId === null` → llama internamente a `reset()`; si `userId === loadedForUserId` → no-op; en otro caso → vacía `current` en memoria, para cada categoría lee `localStorage.getItem(storageKey(userId, c))`, parsea JSON dentro de un `try/catch` (si falla, usa `[]`), reconstruye `seen[c] = new Set<number>(parsed)`, fija `loadedForUserId = userId`.
- [X] T005 [US1] En `src/renderer/src/store/notifications.store.ts`, implementar `reset()`: setea `current` y `seen` a Sets vacíos por categoría, `loadedForUserId = null`, `refreshing = false`. NO llama a `localStorage.removeItem`.
- [X] T006 [US1] En `src/renderer/src/store/notifications.store.ts`, implementar `refresh()`: early-return si `loadedForUserId === null` o si `refreshing === true`. Setea `refreshing = true`. Lee el rol vía `useAuthStore.getState().user?.role` (importar el auth store). Llama `await window.api.products.lowStock()`. Si el rol no es `'cajero'`, llama también `await window.api.reports.pendingCredits()`. Mapea los resultados a `new Set<number>(items.map(i => i.id))` por categoría. Setea `current` con los nuevos Sets (las categorías no aplicables al rol se setean a `new Set()`). Captura cualquier excepción del IPC y deja `current` sin tocar; siempre setea `refreshing = false` en `finally`. **No** ejecutar reconciliación en esta tarea — es responsabilidad de US2 (T011).
- [X] T007 [US1] En `src/renderer/src/store/notifications.store.ts`, implementar `markAllVisibleAsSeen(role: string)`: early-return si `loadedForUserId === null`. Para cada categoría en `categoriesVisibleTo(role)`: construye `next = new Set([...seen[c], ...current[c]])`; si `next.size !== seen[c].size` (cambió), persiste `localStorage.setItem(storageKey(loadedForUserId, c), JSON.stringify(Array.from(next)))` y actualiza `seen[c] = next` en el set update de Zustand.
- [X] T008 [US1] En `src/renderer/src/components/Header.tsx`, `NotificationBell`: importar `useNotificationStore`, `selectUnseenCount` y `useAuthStore`. Reemplazar los `useState<number>` (`lowStockCount`, `pendingCount`) y la función local `refresh` por: `const role = user?.role ?? 'cajero'`; `const total = useNotificationStore((s) => selectUnseenCount(s, role))`; `const lowStockCount = useNotificationStore((s) => s.current.low_stock.size)`; `const pendingCount = useNotificationStore((s) => s.current.pending_credits.size)`. Eliminar el cálculo manual `total = lowStockCount + (isCajero ? 0 : pendingCount)` — ahora el `total` viene del selector.
- [X] T009 [US1] En `src/renderer/src/components/Header.tsx`, `NotificationBell`: reemplazar la implementación de los dos `useEffect` de refresh (mount + intervalo de 60 s, y on-open) para invocar `useNotificationStore.getState().refresh()`. En el handler que abre el dropdown (`setOpen(true)`), llamar inmediatamente después `useNotificationStore.getState().markAllVisibleAsSeen(role)`. Mantener el `useEffect` de click-fuera existente sin cambios.
- [X] T010 [US1] En `src/renderer/src/components/Header.tsx`, `NotificationBell`: agregar un `useEffect` que observe `const userId = useAuthStore((s) => s.user?.id ?? null)` (suscripción al store de auth) y llame `useNotificationStore.getState().loadForUser(userId)` cada vez que cambie. Mantener el dependency array correcto (`[userId]`). Verificar que se ejecuta tras login y tras logout.
- [ ] T011 [US1] Ejecutar manualmente los Tests **1, 5, 6, 8 y 9** del [quickstart.md](./quickstart.md). Documentar (en un comentario del PR o nota local) cualquier desvío. No avanzar a US2 hasta que estos cinco tests pasen en un solo intento.
  - ⏸️ **Pendiente — requiere ejecución manual con `npm run dev` por el usuario.**

**Checkpoint**: US1 entrega el MVP — el badge se silencia al abrir el dropdown y persiste entre recargas. El reclamo central del cliente queda resuelto si el código se mergea solo con US1 (US2 mejora la utilidad, US3 sólo verifica).

---

## Phase 4: User Story 2 - Re-detección de alertas nuevas (Priority: P2)

**Goal**: Cuando una entidad nueva ingresa al conjunto de alertas (un nuevo deudor, o un nuevo producto bajo stock), el badge vuelve a encenderse. Una entidad que sale del conjunto y vuelve a entrar también cuenta como nueva.

**Independent Test**: Quickstart Tests 2, 3 y 4 (alerta nueva enciende badge, alerta continua no re-notifica, reentrada cuenta como nueva).

### Implementation for User Story 2

- [X] T012 [US2] En `src/renderer/src/store/notifications.store.ts`, dentro de `refresh()`: después de actualizar `current`, agregar la reconciliación:
  - Implementado dentro de la misma pasada que T006 (un único `refresh()` con la reconciliación incluida) — el bloque está marcado con un comentario `006-notif-read-state` en el archivo. por cada categoría, computar `keptSeen = new Set<number>([...seen[c]].filter((id) => current[c].has(id)))`; si `keptSeen.size !== seen[c].size`, persistir `localStorage.setItem(storageKey(loadedForUserId, c), JSON.stringify(Array.from(keptSeen)))` y actualizar `seen[c] = keptSeen` en el set update. Garantiza el invariante INV-1 (`seen[c] ⊆ current[c]`) de [data-model.md](./data-model.md).
- [ ] T013 [US2] Ejecutar manualmente los Tests **2, 3 y 4** del [quickstart.md](./quickstart.md). Confirmar especialmente Test 4 (reentrada):
  - ⏸️ **Pendiente — requiere ejecución manual con `npm run dev` por el usuario.** cobrar la deuda del cliente, esperar refresh, volver a generar una venta a crédito al mismo cliente, y verificar que el badge vuelve a mostrar `1`.

**Checkpoint**: Con US1 + US2 el sistema de notificaciones recupera su propósito: silencia lo ya leído y avisa de lo realmente nuevo.

---

## Phase 5: User Story 3 - Click directo en fila también descarta (Priority: P3)

**Goal**: Verificar que hacer clic directamente sobre una fila del dropdown (sin cerrar previamente "haciendo click fuera") también deja el badge silenciado.

**Independent Test**: Quickstart Test 5 (click directo en fila).

> **Nota**: Por la decisión D-04 de [research.md](./research.md), el "marcar como leído" ocurre al *abrir* el dropdown (T009), no al cerrarlo. Esto cubre automáticamente la Historia 3 sin código adicional. Esta phase existe sólo para validar empíricamente que el supuesto se cumple.

### Implementation for User Story 3

- [ ] T014 [US3] Ejecutar manualmente el Test **5** del [quickstart.md](./quickstart.md). Si el badge NO queda silenciado tras hacer click directo en una fila → significa que el orden `setOpen(true)` + `markAllVisibleAsSeen` de T009 no se aplicó correctamente; volver a revisar T009 antes de cerrar la phase. Si pasa → US3 queda cubierta sin LOC adicionales.
  - ⏸️ **Pendiente — requiere ejecución manual con `npm run dev` por el usuario.**

**Checkpoint**: las tres historias de usuario están operativas e independientemente verificables.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates del Principio VII (Constitución) y actualización ligera de documentación inventario del repo.

- [X] T015 Correr `npm run typecheck` (incluye `typecheck:node` y `typecheck:web`) en la raíz del proyecto. Debe terminar con 0 errores. Si aparecen errores nuevos, corregirlos en `src/renderer/src/store/notifications.store.ts` o `src/renderer/src/components/Header.tsx` según corresponda.
  - Resultado: 0 errores.
- [X] T016 Correr `npm run lint` en la raíz del proyecto. Debe terminar con 0 errores y sin warnings nuevos respecto del baseline de T001. Corregir los hallazgos en los dos archivos tocados.
  - Resultado: 0 errores, 29 warnings (vs 31 baseline; ningún warning nuevo).
- [ ] T017 Correr `npm run dev`, ejecutar la suite completa de los Tests **1 a 9** de [quickstart.md](./quickstart.md) end-to-end en una sola pasada. Marcar cada test como pasado/fallido. No considerar el trabajo cerrado hasta que los 9 pasen.
  - ⏸️ **Pendiente — requiere ejecución manual con `npm run dev` por el usuario.**
- [X] T018 [P] Actualizar [.specify/memory/functional-spec.md](../../.specify/memory/functional-spec.md) (inventario funcional del codebase) agregando una entrada breve para `src/renderer/src/store/notifications.store.ts` en la sección correspondiente y mencionando la nueva semántica "leído/no leído" del `NotificationBell`. Si la sección de stores ya está estructurada, seguir el formato existente. Esto NO modifica `CLAUDE.md` (ya actualizado por `/speckit-plan`).
  - Resultado: nuevo bullet "Header notification bell" añadido en §16.6 (Cross-cutting utilities).

---

## Iteración post-revisión (2026-05-14): paso a modo inbox

Tras la implementación inicial el cliente pidió que las filas también desaparezcan al ser leídas (no solo el badge). Se actualizó la spec (`Clarifications` + flip de FR-002, FR-012, escenarios y edge cases) y se ajustó el código en consecuencia.

- [X] T019 Renombrar comportamiento: marcar como leído al **cerrar** el dropdown (no al abrirlo). En `src/renderer/src/components/Header.tsx`: el `useEffect` de open sólo refresca; un nuevo efecto con `useRef` detecta la transición open→close y dispara `markAllVisibleAsSeen(role)`.
- [X] T020 Ocultar filas leídas. En `src/renderer/src/components/Header.tsx`: las filas se renderizan solo cuando hay no-leídos en su categoría (`unseenLowStock > 0`, `unseenPending > 0`); los conteos mostrados también son de no-leídos.
- [X] T021 Empty state. En `src/renderer/src/components/Header.tsx`: cuando `totalUnseen === 0`, mostrar "Sin notificaciones pendientes" (texto único, sin subtítulo). Header del dropdown muestra "X nueva(s)" en vez de "X pendiente(s)".
- [X] T022 En `src/renderer/src/store/notifications.store.ts`: agregar y exportar `selectUnseenForCategory(state, category)` helper consumido por las nuevas filas.
- [X] T023 Sincronizar artefactos de diseño: `spec.md` (Clarifications + FR-002 + FR-012 + 3 escenarios de aceptación + 1 edge case), `quickstart.md` (Tests 1, 5, 8, 9 ajustados a inbox), `CLAUDE.md` (descripción inbox).
- [ ] T024 Validación manual post-revisión: correr `quickstart.md` Tests 1, 5, 8 y 9 nuevamente con `npm run dev`.
  - ⏸️ **Pendiente — requiere ejecución manual por el usuario.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sin dependencias.
- **Phase 2 (Foundational)**: depende de Phase 1.
- **Phase 3 (US1)**: depende de Phase 2.
- **Phase 4 (US2)**: depende de Phase 3 (extiende `refresh()` ya implementado en T006).
- **Phase 5 (US3)**: sólo verificación; depende de Phase 3.
- **Phase 6 (Polish)**: depende de las phases de US que se vayan a incluir.

### User Story Dependencies

- **US1 (P1)**: independiente — entrega el MVP por sí solo.
- **US2 (P2)**: extiende US1 (no la reemplaza). US1 puede mergearse sin US2 si se acepta que el badge nunca vuelve a encender; pero recomendado entregar US1 + US2 juntos porque sin US2 el módulo de notificaciones pierde propósito a largo plazo.
- **US3 (P3)**: verificación pura; queda cubierta por US1 sin código adicional.

### Within Each User Story

- US1: T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 (verificación manual). Todas en uno de los dos archivos del scope; no hay paralelización real intra-historia.
- US2: T012 (código) → T013 (verificación manual).
- US3: T014 (verificación manual única).
- Polish: T015, T016, T017 secuenciales; T018 puede correrse en paralelo con T017.

### Parallel Opportunities

Esta feature toca sólo dos archivos (`notifications.store.ts` y `Header.tsx`), por lo cual la paralelización entre tareas de implementación es nula. La única tarea marcada `[P]` es **T018** (actualizar `functional-spec.md`), que toca un archivo distinto y puede solaparse con T017 (la corrida manual del quickstart).

---

## Parallel Example: dentro de la implementación

```bash
# No hay oportunidades de paralelizar implementación: notifications.store.ts y
# Header.tsx se editan secuencialmente. La única paralelización viable es:

# Mientras corre el quickstart manual end-to-end (T017),
# en otra terminal/editor:
Task: "Actualizar functional-spec.md con la nueva store y la semántica leído/no-leído"
```

---

## Implementation Strategy

### MVP First (sólo US1)

1. Phase 1: T001 (baseline limpio).
2. Phase 2: T002, T003 (esqueleto del store).
3. Phase 3: T004–T011 (US1 completa).
4. **STOP y VALIDAR**: ejecutar quickstart Tests 1, 5, 6, 8, 9. Si pasan, esto ya resuelve el reclamo del cliente.
5. Decidir si mergear este MVP por separado o continuar a US2 antes del PR.

### Entrega Incremental Recomendada

1. Setup + Foundational (T001–T003).
2. US1 (T004–T011) → quickstart parcial → opcional commit "feat(notifications): mark as seen on dropdown open".
3. US2 (T012–T013) → quickstart parcial → opcional commit "feat(notifications): re-light badge on entity re-entry".
4. US3 (T014) → verificación → no requiere commit nuevo.
5. Polish (T015–T018) → commit "chore(notifications): typecheck/lint + functional-spec inventory".

### Trabajo en Solitario

Es la modalidad real de este proyecto (single-maintainer, ver Principio VII). Recorrer las phases en orden. La paralelización entre desarrolladores no aplica.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes. Aquí casi todo es secuencial porque se concentran en dos archivos.
- `[Story]` mapea cada tarea a su historia de usuario para trazabilidad.
- No hay tests automatizados — la validación pasa exclusivamente por `quickstart.md`. Si en el futuro se introduce Vitest, este store es fácilmente testeable de forma aislada (su lógica es pura sobre `current`/`seen`).
- Hacer commit después de cada phase (no después de cada T) mantiene el historial legible: 3–4 commits totales (foundational, US1, US2, polish) es una buena granularidad.
- No introducir abstracciones especulativas (Principio VII). Si en T002 surge la tentación de modelar "fuentes de alertas pluggables", rechazarla — basta el switch implícito sobre la union de dos categorías.
- Si durante US1 el `refresh()` falla por temas de autorización IPC (ej. cajero accediendo a un canal restringido), revisar `src/main/auth/matrix.ts:86`: `products:lowStock` está autorizado para cajero/supervisor/admin; `reports:pendingCredits` solo para no-cajero. La lógica de T006 ya respeta esto al saltearse `pendingCredits` cuando el rol es cajero.
