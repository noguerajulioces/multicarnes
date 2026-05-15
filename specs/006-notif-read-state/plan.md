# Implementation Plan: Estado "leído" en notificaciones del header

**Branch**: `006-notif-read-state` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-notif-read-state/spec.md`

## Summary

El badge numérico del ícono de campana del header debe silenciarse una vez que el usuario abre el dropdown y "ve" las alertas listadas. La detección de novedades se mantiene (re-encender el badge solo cuando entra una entidad nueva al conjunto de alertas: nuevo cliente con saldo deudor o nuevo producto bajo stock).

**Enfoque técnico** (resuelto en [research.md](./research.md)):

- Persistencia local en `localStorage` del renderer, prefijada por `notif:seen:<userId>:<category>`. Sin SQLite, sin migración, sin IPC nuevos.
- Un único Zustand store `useNotificationStore` (`src/renderer/src/store/notifications.store.ts`) encapsula `current` (IDs vivos por categoría), `seen` (IDs ya vistos por el usuario actual) y las acciones `refresh / markAllVisibleAsSeen / loadForUser / reset`.
- `NotificationBell` en `src/renderer/src/components/Header.tsx` se vuelve presentacional: lee `selectUnseenCount(state, role)` y dispara `markAllVisibleAsSeen(role)` al abrir el dropdown.
- Reconciliación automática: tras cada `refresh()` se purgan del `seen` los IDs que ya no están en `current` (lo que permite que la reentrada de una entidad cuente como alerta nueva — FR-006).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, `noImplicitAny`)
**Primary Dependencies**: Electron 39, React 19, Zustand (ya en el stack), Tailwind v4, lucide-react. NO se introduce ninguna dependencia nueva.
**Storage**: `localStorage` del renderer. NO se toca SQLite (better-sqlite3) ni el esquema.
**Testing**: Validación manual end-to-end mediante [quickstart.md](./quickstart.md). El proyecto no mantiene infraestructura de tests automatizados para el renderer (los features 001–005 siguen el mismo enfoque).
**Target Platform**: Aplicación de escritorio Electron desplegada en terminales POS (Windows/macOS).
**Project Type**: Desktop app (Electron main + renderer, ya estructurado).
**Performance Goals**: Conteo del badge derivado en O(n) sobre `n = |current| + |seen|`, típicamente < 50 ítems totales. Refresh sigue cada 60 s (sin cambios). El gesto "abrir dropdown" debe reflejar el badge a cero en < 200 ms.
**Constraints**: Sin nuevos canales IPC. Sin migraciones DB. Sin dependencias nuevas. Sin regresión de navegación en filas del dropdown. Estado de "leído" por-usuario-por-dispositivo (sin sincronización entre PCs).
**Scale/Scope**: Una feature de UI pequeña — 1 store Zustand nuevo + modificaciones puntuales a `Header.tsx`. Delta estimado ~150 LOC.

## Constitution Check

*GATE: Debe pasar antes de Phase 0. Se re-evalúa tras Phase 1.*

| Principio | Estado | Observación |
|---|---|---|
| **I. Locked Technology Stack** | ✅ | Sin dependencias nuevas. Reutiliza Zustand, Tailwind y `lucide-react` (ya aprobados en la baseline v1.1.0). |
| **II. Strict Typing & SRP** | ✅ | `notifications.store.ts` es un store de dominio único (notificaciones del header). No se fusiona en `auth`/`cash`. `NotificationBell` queda más presentacional que antes (lógica trasladada al store). Todo el código nuevo va en TS strict. |
| **III. Layered Data Access** | ✅ | No se agrega SQL. Las lecturas siguen pasando por las repositorios existentes vía IPC ya autorizado (`products:lowStock`, `reports:pendingCredits`). |
| **IV. Main/Renderer Boundary Integrity** | ✅ | Feature 100% renderer-side. No se importa `better-sqlite3`, `node-thermal-printer`, `child_process`, `fs`, etc. desde el renderer. No se agrega un canal IPC nuevo. `nodeIntegration=false` y `contextIsolation=true` se mantienen. |
| **V. Isolated Hardware & Reporting** | ✅ | No aplica — no hay impresión ni reporte. |
| **VI. Schema Evolution / Feature Preservation** | ✅ | Sin migración. Sin cambios al esquema. La navegación existente al hacer clic en una fila del dropdown se preserva (verificado en quickstart Test 5). El dropdown vacío sigue mostrando "Todo en orden" (Test 8). |
| **VII. Simplicity, Approval & Non-Regression** | ✅ | Un store, un componente tocado. Sin abstracción especulativa. Sin nuevos endpoints. La feature acepta el reclamo del cliente con la solución técnica más directa entre las consideradas en research.md. |

**Resultado del gate**: PASS. No se requiere entrada en *Complexity Tracking*.

Re-evaluación post-Phase 1: PASS sin cambios. Los artefactos de diseño (`data-model.md`, `contracts/`, `quickstart.md`) confirman que el plan no toca SQL, IPC, main, hardware ni reportes.

## Project Structure

### Documentation (this feature)

```text
specs/006-notif-read-state/
├── spec.md                        # ya creado por /speckit-specify
├── plan.md                        # ESTE archivo
├── research.md                    # Phase 0: decisiones técnicas
├── data-model.md                  # Phase 1: entidades + transiciones de estado
├── quickstart.md                  # Phase 1: validación manual end-to-end
├── contracts/
│   └── notification-store.md      # Phase 1: contrato del Zustand store
├── checklists/
│   └── requirements.md            # generado por /speckit-specify
└── tasks.md                       # se creará con /speckit-tasks (NO en este comando)
```

### Source Code (repository root)

Se respeta la estructura existente `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`. NO se reorganiza nada (Technology Stack Constraints).

```text
src/renderer/src/
├── store/
│   ├── auth.store.ts                  # (existente, sin cambios) — se LEE para conocer user.id
│   ├── cash.store.ts                  # (existente, sin cambios) — referencia de patrón localStorage
│   ├── tour.store.ts                  # (existente, sin cambios) — referencia de patrón prefijo
│   ├── theme.store.ts                 # (existente, sin cambios)
│   ├── held.store.ts                  # (existente, sin cambios)
│   └── notifications.store.ts         # NUEVO — Zustand store de esta feature
└── components/
    └── Header.tsx                     # MODIFICADO — NotificationBell pasa a usar el store
                                        # (UserAvatar, CashBadge, Clock, breadcrumb se quedan iguales)
```

**Structure Decision**: Desktop app Electron con separación main/renderer ya consolidada (Principio IV). Esta feature solo toca el renderer y no introduce subdirectorios nuevos: el archivo del store entra en `src/renderer/src/store/` y la integración se hace en el componente existente `Header.tsx`.

## Complexity Tracking

> No aplica. Constitution Check pasó sin violaciones.
