# Plan de Implementación: Historial de Movimientos de Caja

**Rama**: `003-cash-movements-history` (directorio del spec; rama git de trabajo a definir)
**Fecha**: 2026-05-11
**Spec**: [spec.md](spec.md)
**Entrada**: Especificación en `/specs/003-cash-movements-history/spec.md`

## Resumen

Una nueva página de nivel superior **"Movimientos de Caja"** que lista los movimientos de la caja *a lo largo del tiempo*, acotada a entradas que no son de venta (ingreso manual, egreso manual, apertura/cierre de caja, y los inversos de anulación). Hoy el renderer solo puede ver movimientos de la caja abierta a través de [CajaPage.tsx](../../../src/renderer/src/modules/caja/CajaPage.tsx); una vez que la caja se cierra, el detalle individual queda inalcanzable desde la UI.

La implementación entra en tres rebanadas aditivas:

1. **Migración v7 del schema** — agrega `cash_movements.void_of` (FK nullable a `cash_movements.id`) y extiende el CHECK existente de `type` para permitir `'opening'`, `'closing'`, `'void'`. Dos statements de backfill convierten los balances de apertura/cierre que hoy viven en `cash_registers` en filas sintéticas `'opening'` / `'closing'` en `cash_movements`, para que la nueva página muestre un timeline unificado sin tocar la UX del cierre de caja. (Ver [contracts/migration-v7.md](contracts/migration-v7.md).)
2. **Query del lado del servidor + cuatro canales IPC nuevos** — `cashMovements:list` (paginado, filtrado, con scope por rol), `cashMovements:void` (solo admin/supervisor, inversa append-only), y el `cash:addMovement` existente se extiende internamente para emitir filas `opening`/`closing` automáticamente cuando se llama desde `openCashRegister` / `closeCashRegister`. Las reglas de autorización usan las mismas formas que la feature 001 (`privileged` / `self-or-roles`) con el scoping de cajero-a-sí-mismo aplicado en el handler (imitando el patrón de `cash:close` en [cash.ipc.ts:21-38](../../../src/main/ipc/cash.ipc.ts#L21-L38)).
3. **Página renderer + entrada de sidebar** — `MovimientosCajaPage.tsx` modelada según [VentasListadoPage.tsx](../../../src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx), reusando el contrato de paginación server-side, el filtro por rol existente en [Sidebar.tsx](../../../src/renderer/src/components/Sidebar.tsx), y la utility [exportToExcel()](../../../src/renderer/src/lib/export.ts#L20) existente.

Sin dependencias nuevas, sin directorios nuevos de nivel superior, sin cambios en el borde main/renderer más allá de una superficie IPC aditiva.

## Contexto técnico

**Lenguaje/Versión**: TypeScript 5.9 (compilador del proyecto).
**Dependencias principales**: Electron 39 (IPC main), better-sqlite3 12 (acceso síncrono a DB en main), React 19 + Zustand (state del renderer — sin cambios), `xlsx` (ya en el baseline aprobado; exportación Excel del lado renderer — aplica Constitución V.b, todos los datos son internos). **Cero dependencias nuevas de runtime o build.**
**Almacenamiento**: SQLite (`pos.db` existente). Agrega una columna nullable (`cash_movements.void_of`), amplía un CHECK constraint sobre `cash_movements.type` (vía el "create-new-table, copy, swap" estándar de SQLite porque CHECK no se puede ALTER in place — ver research.md §2), e inserta filas sintéticas de apertura/cierre desde la data existente en `cash_registers`. Un índice nuevo parcial en `cash_movements(register_id, created_at)` para la query de timeline filtrado.
**Testing**: Misma postura que 001 / 002 — sin test runner. La nueva ruta de query se ejercita con una extensión de [scripts/auth-smoke.ts](../../../scripts/auth-smoke.ts) cubriendo FR-015 / FR-017 (el scoping por rol no se puede bypasear manipulando parámetros) y FR-019 / FR-021 (la anulación produce exactamente una inversa, el original sobrevive). El resto lo cubre quickstart manual ([quickstart.md](quickstart.md)).
**Plataforma objetivo**: Aplicación de escritorio Electron en macOS / Windows / Linux (electron-builder configurado por plataforma).
**Tipo de proyecto**: Aplicación de escritorio (Electron + React renderer + SQLite). Estructura existente preservada (`src/main`, `src/preload`, `src/renderer`, `src/shared`).
**Objetivos de performance**: Primera página de resultados filtrados en <1s en datasets de hasta 100k filas (SC-006); exportación de hasta 5k filas en <10s (SC-005). Ambos alcanzables con el acceso síncrono existente de better-sqlite3 + un índice compuesto — ver research.md §4.
**Restricciones**: Las bases pobladas existentes deben sobrevivir la migración. Las cajas cerradas que ya tienen balances no-cero de apertura/cierre deben producir una fila sintética cada una para que la página sea útil desde el día uno, no solo para sesiones abiertas después de la migración. La migración corre al arranque, idempotente, y **atómica** (una sola transacción): un fallo parcial deja el schema en v6 y la página deshabilitada.
**Escala/Alcance**: Una migración de schema nueva, un archivo de query nuevo, un archivo IPC nuevo, una entrada de preload nueva, una página de renderer nueva, una entrada de sidebar nueva, más ediciones menores en cinco archivos existentes (schema.ts, matrix.ts, cash.ipc.ts para encadenar los inserts de apertura/cierre, sidebar para registrar la entrada, router.tsx). Una entrada nueva en la matriz de auth por cada canal nuevo.

## Constitution Check

> Gate: debe pasar antes de Fase 0. Se reevalúa después de Fase 1.

| Principio | Estado | Notas |
|---|---|---|
| **I. Stack tecnológico bloqueado** | ✅ PASA | Cero dependencias nuevas de runtime o build. Usa `better-sqlite3`, Zustand, React, puente IPC, `xlsx` existentes (ya en el baseline v1.1.0). |
| **II. Tipado estricto & componentes SRP** | ✅ PASA | La página nueva del renderer es un solo componente de nivel página que delega el renderizado de filas, la barra de filtros y los controles de paginación a hijos presentacionales chicos — misma forma que `VentasListadoPage`. Sin store global nuevo; el estado de filtros vive en URL search params + un pequeño hook local. |
| **III. Capa de acceso a datos** | ✅ PASA | Todo el SQL queda dentro de `src/main/db/queries/cash-movements.ts` (archivo nuevo). El `cash.ts` existente mantiene su API actual; el archivo nuevo posee la query del timeline, la ruta de anulación y las inserciones sintéticas emitidas desde `openCashRegister` / `closeCashRegister`. Ninguna llamada cruda a `better-sqlite3` se filtra a los handlers IPC ni al renderer. |
| **IV. Borde Main/Renderer** | ✅ PASA — ADITIVO | Dos canales IPC nuevos (`cashMovements:list`, `cashMovements:void`) y una adición tipada al preload. Ningún canal existente cambia de firma. `nodeIntegration` sigue deshabilitado; `contextIsolation` sigue habilitado. |
| **V. Hardware & reportes aislados** | ✅ PASA | Sin impresora térmica. La exportación Excel reusa [exportToExcel()](../../../src/renderer/src/lib/export.ts#L20), que vive en el renderer según Constitución V.b. Todas las filas de input vienen del fetch paginado del propio renderer (datos internos confiables); el gate V.b ("no untrusted input crosses the formatter boundary") se sostiene — el renderer arma diccionarios de filas planas antes de pasarlos a xlsx. |
| **VI. Evolución del schema vía migraciones** | ✅ PASA | Una migración aditiva (v7) que cubre: una columna FK nullable, un CHECK ampliado, y un backfill único de filas sintéticas de apertura/cierre desde `cash_registers`. El ensanche del CHECK usa el patrón estándar de SQLite "recrear-y-swappear" documentado en [contracts/migration-v7.md](contracts/migration-v7.md). La migración es idempotente (chequeo de PRAGMA), envuelta en una transacción, y se prueba contra una DB fresca y una poblada en [quickstart.md](quickstart.md) §2. |
| **VII. Simplicidad, aprobación, no-regresión** | ✅ PASA | Reusa la forma de paginación server-side establecida por la feature 001/002 (`{ items, total, page, perPage }`) en [sales.ts:137-191](../../../src/main/db/queries/sales.ts#L137-L191), así que no se introduce abstracción nueva. El flujo de caja abierta en CajaPage no cambia: las filas sintéticas de apertura/cierre se emiten desde las rutas existentes `openCashRegister` / `closeCashRegister`, detrás de la capa de datos, así que no entran cambios de UI de regalo. Fuera de scope: edit in-place (reemplazado por anulación), creación desde esta página (sigue en CajaPage), y filas de ventas-en-efectivo en el listado. |

**Resultado del gate: PASA.** Ninguna violación de principio requiere justificación en Complexity Tracking.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/003-cash-movements-history/
├── plan.md                       # Este archivo
├── research.md                   # Fase 0 — decisiones & alternativas
├── data-model.md                 # Fase 1 — diff de schema, formas de query
├── quickstart.md                 # Fase 1 — receta de verificación manual
├── contracts/
│   ├── ipc-channels.md           # NUEVO: cashMovements:list, cashMovements:void
│   └── migration-v7.md           # La migración de cash_movements
├── checklists/
│   └── requirements.md           # Creado por /speckit-specify
└── tasks.md                      # Fase 2 (próximo: /speckit-tasks)
```

### Código fuente (raíz del repo)

```text
src/
├── main/
│   ├── db/
│   │   ├── index.ts                          # MODIFICADO — agregar migración v7
│   │   ├── schema.ts                         # MODIFICADO — CHECK type ampliado, columna void_of en instalaciones nuevas
│   │   └── queries/
│   │       ├── cash.ts                       # MODIFICADO — openCashRegister/closeCashRegister emiten filas sintéticas apertura/cierre
│   │       └── cash-movements.ts             # NUEVO — listMovements(opts), voidMovement(id, actorId)
│   ├── auth/
│   │   └── matrix.ts                         # MODIFICADO — 2 entradas nuevas
│   └── ipc/
│       └── cash-movements.ipc.ts             # NUEVO — cashMovements:list, cashMovements:void
├── preload/
│   ├── index.ts                              # MODIFICADO — puente tipado cashMovements
│   └── index.d.ts                            # MODIFICADO — tipos correspondientes
├── shared/
│   └── types.ts                              # MODIFICADO — CashMovementRow, CashMovementListResult, CashMovementType
└── renderer/
    └── src/
        ├── components/
        │   └── Sidebar.tsx                   # MODIFICADO — entrada de sidebar, gated por rol
        ├── router.tsx                        # MODIFICADO — ruta /movimientos-caja
        └── modules/
            └── movimientos-caja/             # NUEVO
                ├── MovimientosCajaPage.tsx       # nivel-página, tabla paginada + filtros + export
                ├── MovimientosFilters.tsx       # presentacional: rango fechas, tipos multi, cajero, caja, búsqueda
                ├── MovimientosTable.tsx         # presentacional: filas con ícono de tipo, badge de anulación, link a cierre
                └── useMovimientosQuery.ts       # hook custom: estado de filtros + fetch IPC
```

**Decisión de estructura**: Layout existente por proceso preservado. Agrega un folder de feature nuevo bajo `renderer/src/modules/`, un archivo de query nuevo bajo `main/db/queries/`, un archivo IPC nuevo. Sin infra compartida nueva, sin reorganización de folders existentes. La convención de nombres sigue el precedente del feature [ventas-listado/](../../../src/renderer/src/modules/ventas-listado/) (folder kebab-case en español, nombres de archivo en inglés adentro).

## Fase 0 — Investigación

Ver [research.md](research.md). 5 decisiones resueltas:

1. Agregar una tabla nueva o extender `cash_movements` para apertura/cierre/anulación.
2. Cómo ampliar el constraint `CHECK(type IN ...)` en `cash_movements` sin perder datos.
3. Si las filas sintéticas de apertura/cierre deben hacer backfill desde `cash_registers` existentes o solo crearse para sesiones abiertas post-v7.
4. Estrategia de indexación para la query de timeline (rango fechas + filtro de caja + scoping por cajero).
5. Si la operación de anular reusa la infra de auditoría (`auth_audit`) o escribe su propia entrada en `action_logs`.

No quedan markers `NEEDS CLARIFICATION`.

## Fase 1 — Diseño

- [data-model.md](data-model.md) — diff a nivel columna de `cash_movements`, la forma de las filas sintéticas, el linkage de anulación, y las formas esperadas de query para `listMovements` y `voidMovement`.
- [contracts/ipc-channels.md](contracts/ipc-channels.md) — firmas exactas y formas de payload para los dos canales IPC nuevos.
- [contracts/migration-v7.md](contracts/migration-v7.md) — el DDL, el recrear-y-swappear para ampliar el CHECK, el SQL del backfill sintético, el chequeo de idempotencia, y el contrato de rollback.
- [quickstart.md](quickstart.md) — seis chequeos manuales que en conjunto ejercitan FR-001 hasta FR-033.

Reevaluación del Constitution Check post-diseño: sigue ✅ PASA, sin violaciones.
