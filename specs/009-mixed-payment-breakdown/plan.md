# Implementation Plan: 009 — Visibilidad y desglose de ventas mixtas

**Branch**: `009-mixed-payment-breakdown` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-mixed-payment-breakdown/spec.md`
**Análisis base**: [flows.md](flows.md) · **Investigación de diseño**: [research.md](research.md)

## Summary

Hacer visible el desglose de las ventas mixtas en toda la app para que el dueño
pueda verificar la deuda generada y conciliar por método de pago. Hoy una venta
mixta se guarda como `sales.payment_method='mixed'` (etiqueta monolítica) con su
desglose real en filas `sale_payments`, pero los reportes/listados agregan por la
etiqueta sin explotar `sale_payments`, dejando la porción fiada/efectivo/etc.
invisible. El dinero ya está bien calculado; es un problema de **capa de lectura**.

**Enfoque técnico** (validado contra el código real): reescribir las agregaciones
de lectura para distribuir las porciones de las mixtas a sus métodos reales,
**reusando el patrón `UNION ALL` que ya existe tres veces** en el código
(`byCardProcessor` en reports.ts, `otherMethodsTotals` y `mixedCash` en cash.ts).
El bucket de efectivo del Resumen pasa a calcularse con la **misma fórmula que la
Caja**, cerrando la discrepancia "la app no cuadra". Una única validación de
write-path (FR-013) garantiza que no exista fiado sin cliente. **Cero canales IPC
nuevos, cero dependencias nuevas, cero migración** (el desglose ya vive en
`sale_payments` para toda mixta histórica).

## Technical Context

**Language/Version**: TypeScript 5.9 en modo estricto (`noImplicitAny`)
**Primary Dependencies**: Electron 39, React 19, better-sqlite3, Zustand,
Tailwind v4, `xlsx` + `jsPDF` (todas ya en `package.json`; no se agrega ninguna)
**Storage**: SQLite vía better-sqlite3, esquema en v16. **Sin migración** para
esta feature (lectura sobre `sale_payments` existente; FR-011/SC-007)
**Testing**: sin suite automatizada (constitución §VII). Verificación = `npm run
typecheck:node` + `typecheck:web` + `lint` + quickstart manual contra DB fresca y
existente (ver [quickstart.md](quickstart.md))
**Target Platform**: desktop POS (Electron) sobre Windows del comercio
**Project Type**: aplicación desktop con procesos `main` / `preload` / `renderer`
/ `shared`
**Performance Goals**: lecturas puntuales sobre un dataset chico (una
carnicería); el `UNION ALL` + JOIN a `sale_payments` tiene el mismo costo que el
`byCardProcessor` ya en producción. No se requiere índice nuevo
**Constraints**: offline-capable; repository pattern (todo SQL en
`src/main/db/queries/*`); boundary main/renderer vía preload tipado; sin deps
nuevas; sin migración; no romper la conciliación de efectivo de Caja ni la de
tarjeta por procesador (ya correctas)
**Scale/Scope**: 4 superficies (Resumen por método, CxC + ficha, listado +
export, guard de servidor); ~4 archivos de `main` y ~3 de `renderer`; un solo
mantenedor

## Constitution Check

*GATE: Debe pasar antes de Phase 0. Re-evaluado tras Phase 1 — sin cambios.*

| Principio | Estado | Justificación |
|---|---|---|
| I. Stack bloqueado | ✅ PASS | Cero dependencias nuevas. `xlsx`/`jsPDF` ya aprobados para el export del listado |
| II. Tipado estricto y componentes SRP | ✅ PASS | Tipos aditivos en `preload/index.d.ts` y `shared/types.ts`; la lógica de presentación (`creditDue`, badges) queda en el render, el SQL en el repo |
| III. Acceso a datos por capas (repo) | ✅ PASS | Todo el SQL nuevo/modificado vive en `src/main/db/queries/reports.ts` y `sales.ts`. Renderer/IPC/preload/stores no tocan better-sqlite3 |
| IV. Integridad boundary main/renderer | ✅ PASS | Todo dato nuevo (`mixedCount`, columnas CxC, `Sale.payments` en el listado) cruza por preload con tipo; sin canal IPC nuevo, `contextIsolation` intacto |
| V. Servicios de hardware y reportes aislados | ✅ PASS | El export reusa `src/renderer/src/lib/export.ts` (formatter permitido en renderer §V.b; entrada 100% de la DB local, sin input no confiable). No toca impresión |
| VI. Evolución de esquema y preservación de features | ✅ PASS | Sin cambio de esquema, sin migración. No se modifican features que ya andan: `byCardProcessor`, `cashSales+mixedCash`, `otherMethodsTotals` quedan intactos. Los cambios responden a defectos documentados (FR/flows.md), no a drive-by edits |
| VII. Simplicidad, aprobación y no-regresión | ✅ PASS | Se reusa el patrón `UNION ALL` ya presente; no se introduce abstracción compartida prematura (los tres usos tienen scopes distintos). FR-013 reusa el patrón throw-en-transacción existente |

**Resultado**: PASS sin violaciones. Sección *Complexity Tracking* vacía.

## Project Structure

### Documentation (this feature)

```text
specs/009-mixed-payment-breakdown/
├── spec.md              # Qué y por qué (negocio)
├── flows.md             # Análisis exhaustivo previo (8 subsistemas, 37 escenarios)
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones de diseño consolidadas
├── data-model.md        # Phase 1: entidades / shapes (sin cambio de esquema)
├── contracts/
│   └── ipc-contracts.md # Phase 1: canales IPC + tipos TS (todos retrocompatibles)
├── quickstart.md        # Phase 1: plan de verificación manual + reconciliación
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (16/16)
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── db/queries/
│   │   ├── reports.ts          # US1: reescribir byMethod (UNION ALL) + mixedCount;
│   │   │                       #      US2: pendingCredits + 2 columnas de origen
│   │   └── sales.ts            # US3: getAllSales (batch payments + filtro creditOnly);
│   │                           #      FR-013: guard credit⇒cliente en createSale
│   └── ipc/
│       ├── reports.ipc.ts      # Sin cambios (shape extendido viaja por el mismo return)
│       └── sales.ipc.ts        # Sin cambios (opts/payload pasan tal cual)
├── preload/
│   └── index.d.ts              # Tipos aditivos: SalesSummaryResult.mixedCount,
│                               #   PendingCreditRow.*_generated, opts.creditOnly
├── shared/
│   └── types.ts                # Sale.credit_portion?: number (Sale.payments ya existe)
└── renderer/src/
    ├── modules/reportes/ReportesPage.tsx       # US1 leyenda mixedCount; US2 columna CxC
    ├── modules/clientes/ClienteFichaPage.tsx   # US2: "Fiado en esta venta" en credit puro y mixta
    ├── modules/ventas-listado/VentasListadoPage.tsx  # US3: desglose por fila, filtro, export
    └── lib/export.ts                           # Sin cambios (genérico sobre columnas)
```

**Structure Decision**: aplicación Electron existente con separación
`main/preload/renderer/shared`. La feature no introduce carpetas nuevas; toca
archivos existentes en las cuatro capas, respetando que el SQL viva sólo en
`src/main/db/queries/`.

## Complexity Tracking

> Sin violaciones de la constitución — sección vacía intencionalmente.
