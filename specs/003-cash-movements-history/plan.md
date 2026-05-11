# Implementation Plan: Cash Movements History

**Branch**: `003-cash-movements-history` (spec dir; working git branch TBD)
**Date**: 2026-05-11
**Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-cash-movements-history/spec.md`

## Summary

A new top-level page **"Movimientos de Caja"** that lists cash-register movements *across time*, scoped to non-sale entries (manual income, manual expense, register opening/closing, and void inverses). Today the renderer can only see movements for the currently open register through [CajaPage.tsx](../../src/renderer/src/modules/caja/CajaPage.tsx); once a session is closed, individual movement detail is unreachable from the UI.

The implementation lands in three additive slices:

1. **Schema migration v7** — adds `cash_movements.void_of` (nullable FK to `cash_movements.id`) and extends the existing `type` CHECK to allow `'opening'`, `'closing'`, `'void'`. Two backfill statements convert legacy session open/close balances stored on `cash_registers` into synthetic `'opening'` / `'closing'` rows in `cash_movements` so the new page shows a unified timeline without touching the cash-close UX. (See [contracts/migration-v7.md](contracts/migration-v7.md).)
2. **Server-side query + four new IPC channels** — `cashMovements:list` (paginated, filtered, role-scoped), `cashMovements:void` (admin/supervisor only, append-only inverse), plus the existing `cash:addMovement` is extended internally to also emit `opening`/`closing` rows automatically when called from `openCashRegister` / `closeCashRegister`. Authorization rules use the same shapes as feature 001 (`privileged` / `self-or-roles`) with cashier-self scoping enforced in the handler (mirroring `cash:close`'s pattern at [cash.ipc.ts:21-38](../../src/main/ipc/cash.ipc.ts#L21-L38)).
3. **Renderer page + sidebar entry** — `MovimientosCajaPage.tsx` modelled after [VentasListadoPage.tsx](../../src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx), reusing the server-side pagination contract, the existing role-aware [Sidebar.tsx](../../src/renderer/src/components/Sidebar.tsx) filter, and the existing [exportToExcel()](../../src/renderer/src/lib/export.ts#L20) utility.

No new dependencies, no new top-level directories, no main/renderer boundary changes beyond an additive IPC surface.

## Technical Context

**Language/Version**: TypeScript 5.9 (existing project compiler).
**Primary Dependencies**: Electron 39 (main process IPC), better-sqlite3 12 (sync DB access on main), React 19 + Zustand (renderer state — unchanged), `xlsx` (already in the approved baseline; renderer-side Excel export — Constitution V.b applies, all data is internal). **No new runtime or build dependencies.**
**Storage**: SQLite (existing `pos.db`). Adds one nullable column (`cash_movements.void_of`), broadens one CHECK constraint on `cash_movements.type` (via the standard SQLite "create-new-table, copy, swap" rename dance because CHECK cannot be ALTER'd in place — see research.md §2), and inserts synthetic opening/closing rows from existing `cash_registers` data. One new partial index on `cash_movements(register_id, created_at)` for the filtered timeline query.
**Testing**: Same posture as 001 / 002 — no test runner. The new query path is exercised by an extension of [scripts/auth-smoke.ts](../../scripts/auth-smoke.ts) covering FR-015 / FR-017 (cashier role-scoping cannot be bypassed by parameter manipulation) and FR-019 / FR-021 (void produces exactly one inverse, original survives). Manual quickstart ([quickstart.md](quickstart.md)) covers the rest.
**Target Platform**: Electron desktop app on macOS / Windows / Linux (electron-builder configured per platform).
**Project Type**: Desktop application (Electron + React renderer + SQLite). Existing structure preserved (`src/main`, `src/preload`, `src/renderer`, `src/shared`).
**Performance Goals**: First page of filtered results in <1s on datasets up to 100k rows (SC-006); export of up to 5k rows in <10s (SC-005). Both achievable with the existing better-sqlite3 sync access + one composite index — see research.md §4.
**Constraints**: Existing populated databases must survive the migration. Closed register sessions that already have non-zero opening/closing balances must produce one synthetic row each so the page is useful immediately, not only for sessions opened after the migration. Migration runs at app start, idempotent, and **atomic** (a single transaction): partial failure leaves the schema at v6 and the page disabled.
**Scale/Scope**: One new schema migration, one new query module file, one new IPC file, one new preload entry, one new renderer page, one new sidebar entry, plus minor edits in five existing files (schema.ts, matrix.ts, cash.ipc.ts to chain opening/closing inserts, sidebar to register the entry, router.tsx). One new auth-matrix entry per new channel.

## Constitution Check

> Gate: must pass before Phase 0. Re-checked after Phase 1.

| Principle | Status | Notes |
|---|---|---|
| **I. Locked Technology Stack** | ✅ PASS | No new runtime or build dependencies. Uses existing `better-sqlite3`, Zustand, React, IPC bridge, `xlsx` (already in the v1.1.0 baseline). |
| **II. Strict Typing & SRP Components** | ✅ PASS | New renderer page is a single page-level component delegating row rendering, filter bar, and pagination controls to small presentational children — same shape as `VentasListadoPage`. No new global store; filter state lives in URL search params + a small local hook. |
| **III. Layered Data Access** | ✅ PASS | All SQL stays inside `src/main/db/queries/cash-movements.ts` (new file). The existing `cash.ts` keeps its current API; the new file owns the timeline query, the void path, and the synthetic-row insertions emitted from `openCashRegister` / `closeCashRegister`. No raw `better-sqlite3` calls leak into IPC handlers or renderer code. |
| **IV. Main/Renderer Boundary** | ✅ PASS — ADDITIVE | Two new IPC channels (`cashMovements:list`, `cashMovements:void`) and a typed preload addition. No existing channel signature changes. `nodeIntegration` stays disabled; `contextIsolation` stays enabled. |
| **V. Isolated Hardware & Reporting** | ✅ PASS | No thermal printer. Excel export reuses [exportToExcel()](../../src/renderer/src/lib/export.ts#L20), which is renderer-side per Constitution V.b. All input rows come from the renderer's own paginated fetch (trusted internal data); the V.b gate ("no untrusted input crosses the formatter boundary") holds — the renderer assembles plain row dicts before passing them to xlsx. |
| **VI. Schema Evolution via Migrations** | ✅ PASS | One additive migration (v7) covering: a nullable FK column, a broadened CHECK, and a one-time backfill of synthetic opening/closing rows from `cash_registers`. The CHECK broadening uses the standard SQLite recreate-and-swap pattern documented in [contracts/migration-v7.md](contracts/migration-v7.md). The migration is idempotent (PRAGMA check), wrapped in a transaction, and tested against both a fresh DB and a populated one in [quickstart.md](quickstart.md) §2. |
| **VII. Simplicity, Approval & Non-Regression** | ✅ PASS | Reuses the server-side pagination shape established by feature 001/002 (`{ items, total, page, perPage }`) at [sales.ts:137-191](../../src/main/db/queries/sales.ts#L137-L191) so no new abstraction is introduced. The CajaPage open-register flow is unchanged: synthetic opening/closing rows are emitted from the existing `openCashRegister` / `closeCashRegister` paths, behind the data layer, so no UI changes ride along. Excluded from scope: in-place edit (replaced by void), creation from this page (stays in CajaPage), and sales-cash rows in the listing. |

**Gate result: PASS.** No principle violation requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-cash-movements-history/
├── plan.md                       # This file
├── research.md                   # Phase 0 — decisions & alternatives
├── data-model.md                 # Phase 1 — schema diff, query shapes
├── quickstart.md                 # Phase 1 — manual verification recipe
├── contracts/
│   ├── ipc-channels.md           # NEW: cashMovements:list, cashMovements:void
│   └── migration-v7.md           # The cash_movements migration
├── checklists/
│   └── requirements.md           # Created by /speckit-specify
└── tasks.md                      # Phase 2 (next: /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── db/
│   │   ├── index.ts                          # MODIFIED — add migration v7
│   │   ├── schema.ts                         # MODIFIED — broadened type CHECK, void_of column on fresh installs
│   │   └── queries/
│   │       ├── cash.ts                       # MODIFIED — openCashRegister/closeCashRegister emit synthetic opening/closing rows
│   │       └── cash-movements.ts             # NEW — listMovements(opts), voidMovement(id, actorId)
│   ├── auth/
│   │   └── matrix.ts                         # MODIFIED — 2 new entries
│   └── ipc/
│       └── cash-movements.ipc.ts             # NEW — cashMovements:list, cashMovements:void
├── preload/
│   ├── index.ts                              # MODIFIED — typed cashMovements bridge
│   └── index.d.ts                            # MODIFIED — matching types
├── shared/
│   └── types.ts                              # MODIFIED — CashMovementRow, CashMovementListResult, CashMovementType
└── renderer/
    └── src/
        ├── components/
        │   └── Sidebar.tsx                   # MODIFIED — sidebar entry, role-gated
        ├── router.tsx                        # MODIFIED — /movimientos-caja route
        └── modules/
            └── movimientos-caja/             # NEW
                ├── MovimientosCajaPage.tsx       # page-level, paginated table + filters + export
                ├── MovimientosFilters.tsx       # presentational: date range, type multiselect, cashier, register, search
                ├── MovimientosTable.tsx         # presentational: rows with type icon, void badge, link to cierre
                └── useMovimientosQuery.ts       # custom hook: filter state + IPC fetch
```

**Structure Decision**: Existing per-process layout preserved. Adds one new feature folder under `renderer/src/modules/`, one new query file under `main/db/queries/`, one new IPC file. No new shared infrastructure, no reorganization of existing folders. Naming follows the precedent set by the existing [ventas-listado/](../../src/renderer/src/modules/ventas-listado/) feature (kebab-case Spanish folder name, English file names internal to it).

## Phase 0 — Research

See [research.md](research.md). Five decisions resolved:

1. Whether to add a new table or extend `cash_movements` for opening/closing/void rows.
2. How to broaden the `CHECK(type IN ...)` constraint on `cash_movements` without losing existing data.
3. Whether synthetic opening/closing rows should be backfilled from existing `cash_registers` or only created for sessions opened after v7.
4. Indexing strategy for the timeline query (date range + register filter + cashier scoping).
5. Whether the void operation reuses the audit infrastructure (`auth_audit`) or writes its own `action_logs` entry.

No `NEEDS CLARIFICATION` markers remain.

## Phase 1 — Design

- [data-model.md](data-model.md) — `cash_movements` column-level diff, the synthetic-row shape, the void linkage, and the expected query shapes for `listMovements` and `voidMovement`.
- [contracts/ipc-channels.md](contracts/ipc-channels.md) — exact signatures and payload shapes for the two new IPC channels.
- [contracts/migration-v7.md](contracts/migration-v7.md) — the DDL, the CHECK-broadening recreate-and-swap, the synthetic-row backfill SQL, the idempotency check, and the rollback contract.
- [quickstart.md](quickstart.md) — six hand-run checks that together exercise FR-001 through FR-033.

Re-evaluated Constitution Check after design: still ✅ PASS, no violations.
