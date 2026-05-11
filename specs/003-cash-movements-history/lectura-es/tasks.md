---
description: "Lista de tareas para la feature 003-cash-movements-history (traducción de lectura)"
---

# Tareas: Historial de Movimientos de Caja

**Entrada**: Documentos de diseño en `/specs/003-cash-movements-history/`
**Prerrequisitos**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

> Esta es la versión en español, **solo para lectura**. La versión canónica vive en [`../tasks.md`](../tasks.md).

**Tests**: No se pidieron como fase de tests separada. El proyecto no tiene runner de tests (según plan §Contexto técnico); la verificación manual del quickstart cubre los chequeos de comportamiento, y el smoke test existente a nivel lógica ([scripts/auth-smoke.ts](../../../scripts/auth-smoke.ts)) se extiende en la Fase 7 para asegurar los invariantes de autorización y append-only que son difíciles de cazar a mano.

**Organización**: Agrupado por user story para permitir implementación y testing independientes. Las tareas foundational (Fase 2) desbloquean todas las historias; cada fase de historia entrega un incremento completo y testeable.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: A qué user story pertenece la tarea (US1 / US2 / US3 / US4)
- Las rutas de archivos en cada tarea son concretas y absolutas al repo

## Convenciones de path

- **Proceso main**: `src/main/`
- **Puente preload**: `src/preload/`
- **Renderer**: `src/renderer/src/`
- **Tipos compartidos**: `src/shared/`
- Layout por proceso preservado por Principio IV de la Constitución.

---

## Fase 1: Setup (Infraestructura compartida)

**Propósito**: Mínimo — sin dependencias nuevas, sin folders nuevos de nivel superior. El único setup es crear el folder de módulo del renderer para que las tareas siguientes puedan aterrizar archivos ahí.

- [ ] T001 [P] Crear el folder `src/renderer/src/modules/movimientos-caja/` (vacío; los archivos se agregan en Fase 3)
- [ ] T002 [P] Agregar un export placeholder en `src/main/db/queries/cash-movements.ts` (vacío `export {}`) para que los imports siguientes compilen antes de que aterrice la lógica

---

## Fase 2: Foundational (Prerequisitos bloqueantes)

**Propósito**: Schema + capa de datos + scaffold de autorización + tipos compartidos. Toda user story depende de que la migración haya corrido, que el módulo de query nuevo compile, y que los canales IPC existan.

**⚠️ CRÍTICO**: Ninguna user story puede empezar hasta completar esta fase.

### Schema & migración

- [ ] T003 Actualizar `src/main/db/schema.ts` para que una instalación nueva cree `cash_movements` con el CHECK ampliado (`type IN ('income','expense','opening','closing','void')`) y la columna `void_of INTEGER NULL REFERENCES cash_movements(id)`. Referencia: [data-model.md §Schema final](data-model.md#schema-final-post-v7).
- [ ] T004 Appendear la migración `version: 7, name: 'cash_movements_broaden_and_void'` al array `MIGRATIONS` en `src/main/db/index.ts`. Implementación copiada de [contracts/migration-v7.md §"Entrada de Migrations"](contracts/migration-v7.md#entrada-de-migrations-a-appendear-en-srcmaindbindexts). Idempotencia guardada por `PRAGMA table_info(cash_movements)` y el chequeo de tokens en `sqlite_master.sql`.
- [ ] T005 Agregar el índice compuesto en el mismo cuerpo de migración: `CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created ON cash_movements(register_id, created_at DESC)`.
- [ ] T006 [P] Bootear la app de dev contra una DB fresca y contra una copia poblada de `pos.db` para confirmar que la migración v7 aterriza idempotente y el backfill produce exactamente una fila `opening` por caja y una `closing` por caja cerrada. Usar las queries SQL de [contracts/migration-v7.md §Verificación](contracts/migration-v7.md#verificación-manual-quickstart-2).

### Tipos compartidos

- [ ] T007 [P] Agregar `CashMovementType`, `CashMovementRow`, `CashMovementListOpts`, `CashMovementListResult` a `src/shared/types.ts`. Formas exactas en [data-model.md §Aliases de tipos](data-model.md#aliases-de-tipos).

### Módulo de query (main)

- [ ] T008 Implementar `listMovements(opts, ctx)` en `src/main/db/queries/cash-movements.ts`. Construir el WHERE desde `opts` según [data-model.md §Formas de query](data-model.md#formas-de-query); aplicar el override del cajero-a-sí-mismo antes de componer SQL (`effectiveUserId = ctx.callerRole === 'cajero' ? ctx.callerUserId : opts.userId`); clampear `perPage` a `[10, 100]`; retornar `{ items, total, page, perPage }`. Los throws son strings legibles por el usuario: `'perPage debe estar entre 10 y 100.'`, `'El rango de fechas es inválido.'`, `'Tipo de movimiento inválido.'`.
- [ ] T009 Implementar `voidMovement(originalId, actorUserId)` en `src/main/db/queries/cash-movements.ts`. Validar según [data-model.md §voidMovement](data-model.md#voidmovementoriginalid-actoruserid) (no encontrado / apertura|cierre / ya-anulación / ya-anulado), insertar fila inversa + `auth_audit` + `action_logs` dentro de un único `db.transaction(...)`, retornar la nueva fila inversa con forma `CashMovementRow`.
- [ ] T010 Modificar `openCashRegister` en `src/main/db/queries/cash.ts` para insertar una fila sintética `'opening'` en `cash_movements` inmediatamente después del `INSERT INTO cash_registers`, dentro de la misma transacción. Referencia: [data-model.md §Emisión sintética ongoing](data-model.md#emisión-sintética-ongoing).
- [ ] T011 Modificar `closeCashRegister` en `src/main/db/queries/cash.ts` para insertar una fila sintética `'closing'` en `cash_movements` después del `UPDATE cash_registers SET status='closed'`, dentro de la misma transacción. El formato de descripción coincide con el backfill de la migración (`'Cierre de caja'` + sufijo opcional `(sobrante|faltante N)`).
- [ ] T012 Modificar `getCashRegisterSummary` en `src/main/db/queries/cash.ts` para que la subquery `movements` tenga en cuenta las filas `type='void'` restándolas del total de ingresos/egresos según el original que reversan. Preserva los totales históricos de sesión (escenario 3 de aceptación de US3). Referencia: [data-model.md §"Efecto sobre los totales de cash_registers"](data-model.md#formas-de-query).

### Matriz de autorización

- [ ] T013 [P] Agregar dos entradas nuevas a `AUTH_MATRIX` en `src/main/auth/matrix.ts`:
  - `'cashMovements:list': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }`
  - `'cashMovements:void': { kind: 'privileged', roles: ['admin', 'supervisor'] }`

### Handler IPC + registración

- [ ] T014 Crear `src/main/ipc/cash-movements.ipc.ts` exportando `registerCashMovementsIpc()` que registre los dos canales vía `registerAuthorized` según [contracts/ipc-channels.md §"Esqueleto del handler"](contracts/ipc-channels.md#canal-cashmovementslist). El handler `:list` pasa `{ callerUserId: ctx.userId, callerRole: ctx.role }` a `listMovements`; el handler `:void` pasa `ctx.userId` a `voidMovement`.
- [ ] T015 Cablear `registerCashMovementsIpc()` en `src/main/index.ts`: agregar el import junto al import existente `registerCashIpc` (línea ~11) y la llamada junto a `registerCashIpc()` (alrededor de la línea ~194).

### Puente preload

- [ ] T016 [P] Agregar un objeto `cashMovements` al `api` expuesto vía `contextBridge` en `src/preload/index.ts`, con `list(opts)` y `void(originalId)` invocando los canales IPC correspondientes. Forma exacta en [contracts/ipc-channels.md §"Binding en preload"](contracts/ipc-channels.md#canal-cashmovementslist).
- [ ] T017 [P] Agregar el tipado correspondiente `cashMovements` a la interface `Api` en `src/preload/index.d.ts`. Usar los tipos compartidos de `src/shared/types.ts` (re-exportados a través de los tipos del renderer como ya se hace para otros dominios).

**Checkpoint**: Foundation lista — `cashMovements:list` y `cashMovements:void` existen y son llamables desde DevTools como `window.api.cashMovements.list({})` / `window.api.cashMovements.void(<id>)`. Puede empezar la Fase 3.

---

## Fase 3: User Story 1 - Historial auditable de movimientos manuales (Prioridad: P1) 🎯 MVP

**Objetivo**: Un admin o supervisor puede abrir "Movimientos de Caja", navegar cada ingreso/egreso manual (más las aperturas/cierres sintéticos) a través de todas las cajas, filtrar por rango de fechas / tipo / cajero / caja / descripción, paginar del lado servidor, y exportar el resultado filtrado a Excel.

**Prueba independiente**: Loguearse como admin. Hacer click en la entrada nueva del sidebar "Movimientos de Caja". Confirmar que la página lista movimientos de sesiones actuales y pasadas, con todos los controles de filtro presentes y la paginación mostrando `Total: N`. Aplicar rango de fechas y filtro por tipo; confirmar que la lista se acota y la paginación vuelve a la página 1. Click en Exportar; confirmar que el .xlsx contiene cada fila filtrada de todas las páginas.

**Nota de scope**: Esta fase restringe la entrada del sidebar a admin/supervisor intencionalmente para que US1 entregue de forma independiente. US2 (Fase 4) abre la visibilidad a cajeros con scoping del lado servidor.

### Módulo del renderer (archivos nuevos)

- [ ] T018 [P] [US1] Crear `src/renderer/src/modules/movimientos-caja/useMovimientosQuery.ts` — hook custom que mantiene el estado de filtros (rango de fechas, tipos, userId, registerId, búsqueda, página, perPage), lee/escribe URL search params para persistencia en sesión (FR-014), y expone una tripleta `data`/`isLoading`/`error`/`refetch` llamando a `window.api.cashMovements.list(opts)`.
- [ ] T019 [P] [US1] Crear `src/renderer/src/modules/movimientos-caja/MovimientosFilters.tsx` — barra de filtros presentacional con date pickers (defaulteando a `todayStr()` de [utils.ts:28](../../../src/renderer/src/lib/utils.ts#L28)), multi-select de tipo, dropdown de cajero (poblado desde `users.getAll` — solo admin; para US1 el filtro de cajero está siempre habilitado porque la página es solo admin/supervisor), dropdown de caja (poblado desde `cash.getAll`), input de búsqueda de descripción, selector de tamaño de página. Emite un `onChange(opts)` con el estado completo del filtro.
- [ ] T020 [P] [US1] Crear `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx` — tabla presentacional con columnas: fecha+hora (usar `formatDateTime` de [utils.ts:13](../../../src/renderer/src/lib/utils.ts#L13)), tipo (con ícono + badge de color), descripción, monto (usar `formatGs` de [utils.ts:4](../../../src/renderer/src/lib/utils.ts#L4); negativo para egreso/anulación), cajero, id de caja, flag de anulación, acciones. Para US1, la columna de acciones no muestra nada; las filas anuladas igual se renderizan con el strike-through + badge según FR-024 (US3 agrega después el botón "Anular").
- [ ] T021 [US1] Crear `src/renderer/src/modules/movimientos-caja/MovimientosCajaPage.tsx` — componente de nivel página que compone `MovimientosFilters` + `MovimientosTable` + un control de paginación idéntico en forma a [VentasListadoPage.tsx](../../../src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx) (Anterior / Siguiente + cantidad de páginas + label `Total: N` + selector de tamaño de página). Cablea `useMovimientosQuery` a ambos hijos. Agrega un botón "Exportar a Excel" en el header.

### Exportación a Excel

- [ ] T022 [US1] En `MovimientosCajaPage.tsx`, implementar el botón "Exportar a Excel". Al click: fetchear el resultado filtrado completo llamando a `cashMovements.list({ ...filters, page: 1, perPage: <total o loop por chunks> })`; si `total > 10000`, mostrar un prompt de confirmación ofreciendo estrechar el rango de fechas antes de proceder (FR-030); si no, pasar las filas + un column spec a `exportToExcel()` de [src/renderer/src/lib/export.ts](../../../src/renderer/src/lib/export.ts) con nombre `movimientos-caja_<desde>_<hasta>` (FR-029). Columnas según FR-028.

### Routing y sidebar

- [ ] T023 [US1] Registrar la ruta `/movimientos-caja` en `src/renderer/src/router.tsx`, lazy-loading `MovimientosCajaPage`. Ubicar bajo el mismo layout autenticado que `/ventas-listado`.
- [ ] T024 [US1] Agregar la entrada de sidebar "Movimientos de Caja" a `src/renderer/src/components/Sidebar.tsx`, visible **solo** para `role === 'admin' || role === 'supervisor'` por ahora. Usar el patrón existente de role-gating en el mismo archivo. (La Fase 4 lo abre a cajeros.)

**Checkpoint**: User Story 1 completa. Un admin puede abrir la página, filtrar, paginar y exportar. Verificar contra [quickstart.md §1, §3, §6](quickstart.md). El rol cajero todavía no ve la entrada del sidebar; eso aterriza en Fase 4.

---

## Fase 4: User Story 2 - El cajero ve solo sus propios movimientos (Prioridad: P2)

**Objetivo**: Un cajero ve la entrada "Movimientos de Caja" en el sidebar. Al abrirla, la página muestra solo sus propios movimientos, el filtro de cajero está bloqueado en su identidad, y no se exponen acciones de anular.

**Prueba independiente**: Loguearse como cajero. Confirmar que aparece la entrada de sidebar. Abrir la página; confirmar que las filas están acotadas a este usuario. Inspeccionar DevTools: `window.api.cashMovements.list({ userId: <id de otro cajero> })` — confirmar que los items retornados siguen acotados al llamador, no al `userId` falsificado. Confirmar que ningún botón "Anular" se renderiza.

**Nota de implementación**: La lógica de scoping del lado servidor ya vive en `listMovements` desde la Fase 2 (T008). Esta fase solo abre la superficie a cajeros y bloquea la UI en consecuencia.

- [ ] T025 [US2] Actualizar `src/renderer/src/components/Sidebar.tsx` para que la entrada "Movimientos de Caja" sea visible para `role === 'cajero'` también, además de admin/supervisor.
- [ ] T026 [US2] En `src/renderer/src/modules/movimientos-caja/MovimientosFilters.tsx`, cuando el rol del llamador desde el auth store es `cajero`, deshabilitar el dropdown de cajero y pre-seleccionar el id del propio llamador. El dropdown igual debería mostrar el nombre del llamador (solo lectura).
- [ ] T027 [US2] En `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, gatear el header y las celdas de la columna de acciones detrás de `role !== 'cajero'`. Para US2 la celda de acción está vacía para todos los roles (la Fase 5 agrega el botón de anular para admin/supervisor); para cajeros la columna en sí está oculta para que el layout no muestre una columna vacía.

**Checkpoint**: User Story 2 completa. Verificar contra [quickstart.md §1.4–§1.7](quickstart.md).

---

## Fase 5: User Story 3 - Anular un movimiento mal registrado (Prioridad: P2)

**Objetivo**: Un admin o supervisor puede anular un ingreso/egreso manual desde la lista. El original sobrevive con un badge "Anulado"; aparece una nueva fila inversa en la lista; el original no puede anularse dos veces; el rol cajero no puede anular.

**Prueba independiente**: Como admin, click "Anular" en un egreso manual. Confirmar: el original queda tachado con badge; aparece una nueva fila void con prefijo `[ANULACIÓN]`; el botón del original desaparece. Repetir el click vía DevTools → confirmar error. Intentar anular una fila `opening` vía DevTools → confirmar error. Intentar anular la inversa → confirmar error. Chequear `auth_audit` + `action_logs` tienen las filas esperadas.

**Prerequisito**: La query (`voidMovement`, T009) y el canal IPC (`cashMovements:void`, T014) de la Fase 2 ya existen.

### Ruta de anulación en el renderer

- [ ] T028 [US3] Agregar un botón "Anular" a la celda de acciones en `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, renderizado solo cuando `role !== 'cajero'` AND `row.type IN ('income', 'expense')` AND `row.isVoided === false`. Patrón de llamada: emitir un evento tipado a la página para que la página llame al IPC y haga refetch.
- [ ] T029 [US3] En `MovimientosCajaPage.tsx`, cablear el handler de anulación: abrir un prompt de confirmación usando el helper [`confirm()`](../../../src/renderer/src/lib/confirm.ts) existente, al confirmar llamar a `window.api.cashMovements.void(originalId)`, en éxito refetchear la página actual de filtros para que el original flippee a anulado y aparezca la inversa. En error, rutear a través de [`handleApiError`](../../../src/renderer/src/lib/api-error.ts#L52) para que el toast en español surface el mensaje (FR-025, FR-022, FR-023).
- [ ] T030 [US3] En `MovimientosTable.tsx`, renderizar los estados visuales que pide el spec: los originales anulados muestran el monto tachado y un badge "Anulado" con un ícono link al id de la fila inversa; las filas de `type='void'` muestran una leyenda "Anulación de #<originalId>" bajo la descripción con un link al original (FR-024, FR-032). El click handler del link scrollea/destaca la fila objetivo dentro de la misma página (sin navegar afuera).

**Checkpoint**: User Story 3 completa. Verificar contra [quickstart.md §4](quickstart.md).

---

## Fase 6: User Story 4 - Rastrear un movimiento hasta su caja (Prioridad: P3)

**Objetivo**: Hacer click en el id de la caja en cualquier fila abre el detalle de cierre correspondiente en Reportes (sesiones cerradas) o la página de caja abierta (sesiones abiertas).

**Prueba independiente**: Click en un id de caja de una fila de sesión cerrada; confirmar que el navegador va a Reportes → Cierres Caja con esa sesión destacada. Click en un id de caja de la sesión actualmente abierta; confirmar que navega a CajaPage.

- [ ] T031 [US4] En `src/renderer/src/modules/movimientos-caja/MovimientosTable.tsx`, renderizar el id de caja como un `<Link>` (React Router) cuyo target se computa desde `row.registerStatus`:
  - `'closed'` → `/reportes?tab=cierres&registerId=<id>`
  - `'open'`   → `/caja`
- [ ] T032 [US4] En `src/renderer/src/modules/reportes/ReportesPage.tsx`, leer los search params `tab` y `registerId` al montar para que el deep-link desde la página de movimientos aterrice directo en la tab correcta con la fila correspondiente expandida. Si el `registerId` falta o no está en el resultado actual de "Cierres Caja", fallback a la vista por defecto de la tab. Ruta de referencia: [ReportesPage.tsx:150-161](../../../src/renderer/src/modules/reportes/ReportesPage.tsx#L150-L161) (lógica de tab existente).

**Checkpoint**: User Story 4 completa. Verificar contra [quickstart.md §5](quickstart.md).

---

## Fase 7: Polish & Concerns transversales

**Propósito**: Asegurar invariantes difíciles de cazar a mano, completar la superficie de documentación y correr la pasada manual completa de verificación.

- [ ] T033 [P] Extender `scripts/auth-smoke.ts` con una sección nueva "cash movements void invariants" que ejercite: (a) el scoping del cajero no se puede bypasear pasando el id de otro usuario en `opts.userId`; (b) una anulación → exactamente una inversa, original preservado; (c) segunda anulación sobre el mismo original es rechazada; (d) anular una fila `opening` es rechazado; (e) anular una fila `void` es rechazado. Referencia: [quickstart.md §8](quickstart.md#8-extensión-del-smoke-test).
- [ ] T034 [P] Actualizar [`docs/MANUAL.md`](../../../docs/MANUAL.md) con una sección nueva "Movimientos de Caja" en español (según la memoria de docs-language: los manuales de usuario final son en español). Cubrir: dónde encontrarlo, qué hacen los filtros, cómo exportar, qué hace "Anular", y la regla de que aperturas/cierres no se anulan desde acá.
- [ ] T035 [P] Actualizar CLAUDE.md cuando aterrice la feature (sin acción ahora — los marcadores SPECKIT ya apuntan a 003-cash-movements-history según [CLAUDE.md](../../../CLAUDE.md); después del merge, demote a "landed" y promote la próxima feature). Esta tarea es el recordatorio operativo, no un cambio de código.
- [ ] T036 Correr la pasada manual completa de verificación según [quickstart.md](quickstart.md) §1 hasta §7 contra una DB de dev poblada. Capturar cualquier desviación del spec como edits al spec (preferido, antes de cerrar) o tickets de follow-up.
- [ ] T037 Gate de tipos & lint: `npm run typecheck` y `npm run lint` pasan con cero errores y cero warnings net-new (Constitución §"Development Workflow & Quality Gates").
- [ ] T038 Smoke manual contra el flujo existente de CajaPage en caja abierta: abrir una caja nueva, agregar un ingreso, agregar un egreso, cerrar la caja. Recargar "Movimientos de Caja" entre cada paso y confirmar que las filas sintéticas de apertura/cierre aparecen con la atribución correcta. Atrapa regresiones en T010–T011.

---

## Dependencias & Orden de ejecución

### Dependencias de fases

- **Setup (Fase 1)**: T001 / T002 son triviales — los dos pueden correr inmediatamente y en paralelo.
- **Foundational (Fase 2)**: depende de Setup. **BLOQUEA todas las user stories.** Dentro de la Fase 2:
  - T003 → T004 (cambio de schema en fresh-install antes de que la migración corra contra DBs frescas)
  - T004 → T005 (el índice vive en el mismo cuerpo de migración)
  - T004 / T005 → T006 (verificar que la migración efectivamente corrió)
  - T007 (tipos compartidos) es independiente y paralelizable.
  - T008 / T009 dependen de T007 (necesitan los tipos compartidos).
  - T010 / T011 dependen de T004 (el CHECK ampliado tiene que aceptar 'opening' / 'closing' cuando se emiten las filas sintéticas).
  - T012 depende de T004.
  - T013 es paralelizable.
  - T014 depende de T008 + T009 + T013.
  - T015 depende de T014.
  - T016 / T017 dependen de T007 (tipos) y T014 (canal existe).
- **User Story 1 (Fase 3)**: depende de la Fase 2 completa.
- **User Story 2 (Fase 4)**: depende de la Fase 3 (extiende `Sidebar.tsx`, `MovimientosFilters.tsx`, `MovimientosTable.tsx`).
- **User Story 3 (Fase 5)**: depende de la Fase 3 (extiende `MovimientosTable.tsx`, `MovimientosCajaPage.tsx`). Independiente de la Fase 4.
- **User Story 4 (Fase 6)**: depende de la Fase 3 (extiende `MovimientosTable.tsx`). Independiente de Fase 4 y Fase 5.
- **Polish (Fase 7)**: depende de que todas las user stories deseadas estén completas.

### Árbol de dependencias entre historias

```text
Fase 1 ──> Fase 2 ──> US1 (P1, MVP)
                       ├──> US2 (P2)
                       ├──> US3 (P2)
                       └──> US4 (P3)
                             ↓
                          Fase 7 (Polish)
```

US2, US3, US4 dependen todas de US1 (extienden archivos del renderer que US1 crea). Son independientes entre sí y se pueden atacar en cualquier orden después de que aterrice US1.

### Oportunidades de paralelo

- **Fase 1**: T001, T002 en paralelo.
- **Fase 2**: T007 || T013 en paralelo antes de T008. T006 en paralelo con T010 / T011. T016 / T017 en paralelo después de T014.
- **Fase 3**: T018 / T019 / T020 en paralelo (archivos distintos).
- **Fase 4** (US2): T025 / T026 / T027 tocan archivos distintos — todas paralelizables.
- **Fase 7** (Polish): T033 / T034 / T035 paralelas.

---

## Ejemplo de paralelización: fan-out de Fase 3

```bash
# Tres archivos presentacionales, tres paths distintos, tres ediciones concurrentes:
Task: "T018 — useMovimientosQuery.ts (hook)"
Task: "T019 — MovimientosFilters.tsx (barra de filtros)"
Task: "T020 — MovimientosTable.tsx (tabla)"

# Después secuencial:
Task: "T021 — MovimientosCajaPage.tsx compone los tres de arriba"
Task: "T022 — botón de exportar Excel"
Task: "T023 + T024 — router + entrada de sidebar"
```

---

## Estrategia de implementación

### MVP primero (solo US1)

1. Completar Fase 1 (T001, T002).
2. Completar Fase 2 (T003 → T017). **Gate duro** antes de cualquier trabajo de UI.
3. Completar Fase 3 (T018 → T024).
4. **PARAR y VALIDAR**: correr quickstart §1 (vista solo admin), §3 (filtros/paginación), §6 (export), §7 (emisión sintética).
5. Shippear a un build de dev si verde. Admin/supervisor tienen un historial funcional y exportable.

### Entrega incremental

- Después del MVP: agregar US2 (scoping cajero) → correr quickstart §1.4–§1.7 → ship.
- Después de US2: agregar US3 (ruta de anulación) → correr quickstart §4 → ship.
- Después de US3: agregar US4 (nav cross-módulo) → correr quickstart §5 → ship.
- Finalmente Fase 7 (Polish): extender smoke test, actualizar manual español, correr pasada completa de quickstart, gates de tipos/lint, regresión manual de CajaPage.

### Cadencia single-developer

El grafo de dependencias es denso dentro de la Fase 2 pero paralelizable a nivel hoja. Para un solo dev, el orden realista es:

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 →
T013 → T014 → T015 → T016 → T017 →
T018 → T019 → T020 → T021 → T022 → T023 → T024 →
T025 → T026 → T027 →
T028 → T029 → T030 →
T031 → T032 →
T033 → T034 → T036 → T037 → T038 → (T035 es operativo, post-merge)
```

Un límite razonable de sesión es "completar una fase, después correr la sección de quickstart correspondiente antes de avanzar".

---

## Notas

- **Tests no pedidos.** El proyecto no tiene runner de tests; la extensión del script de smoke en T033 es el análogo más cercano y asegura los invariantes más fáciles de romper (scoping cajero, unicidad de anulación).
- **Sin dependencias nuevas.** Todo el trabajo ocurre contra el stack existente — `better-sqlite3`, React, Zustand, `xlsx`, el guard de auth existente, el puente IPC existente.
- **Append-only es estructural.** Cada estado "anulado" se deriva de la existencia de una fila inversa; el original nunca se muta. Esto hace imposible producir un outcome corrupto-por-mal-uso (ej.: un void sin original pareado) a través del path normal.
- **La página no crea movimientos.** La creación sigue en [CajaPage.tsx](../../../src/renderer/src/modules/caja/CajaPage.tsx) para la caja abierta. Esta página es solo lectura + anular + exportar.
- **La visibilidad del sidebar escala con las historias**: solo admin/supervisor después de US1; cajero después de US2. Mantiene cada fase shippable.
