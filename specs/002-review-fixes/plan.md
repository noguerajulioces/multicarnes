# Implementation Plan: Round-2 Code Review Fixes

**Branch**: `002-review-fixes` (spec dir; working git branch is `fix/qa-feedback-round-2`)
**Date**: 2026-05-10
**Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-review-fixes/spec.md`

## Summary

Three correctness defects surfaced by the round-2 code review need to land before the auth feature (001) can be considered shippable. (1) Held tickets are now persisted in SQLite but not scoped by owning user, so any cashier sees any other cashier's held tickets. (2) Purchase reception writes its stock-adjustment audit row attributed to the order *creator* with a fallback to `user_id = 0`, instead of to the user who actually received the goods. (3) Cancelling a sale paid partly in cash and partly on credit silently leaves the credit portion in the customer's balance with no audit trail. This plan resolves all three with a single additive schema migration (`held_tickets.user_id`), targeted signature changes in two repository functions (`receivePurchaseOrder`, `cancelSale`), and one new renderer modal (the mixed-payment cancellation prompt). Two medium-severity correctness items from the same review — `cancelPurchaseOrder` running outside a transaction, and the recovery-mode race in user creation — ride along as small same-file fixes.

## Technical Context

**Language/Version**: TypeScript 5.9 (existing project compiler)
**Primary Dependencies**: Electron 39 (main process IPC), better-sqlite3 12 (sync DB access on main), React 19 + Zustand (renderer state — unchanged), bcryptjs (unchanged). **No new runtime dependencies.**
**Storage**: SQLite (existing `pos.db`). Adds one column (`held_tickets.user_id INTEGER NULL`) via migration v6. No new tables. No new indexes (the table is small and always filtered with the user from the authenticated session — see research.md §3).
**Testing**: Same posture as 001 — no test runner; manual quickstart ([quickstart.md](quickstart.md)) plus extension of [scripts/auth-smoke.ts](../../scripts/auth-smoke.ts) for the recovery-mode atomicity invariant (FR-012) since it's a concurrency case that's hard to catch by hand.
**Target Platform**: Electron desktop app on macOS / Windows / Linux (electron-builder configured per platform).
**Project Type**: Desktop application (Electron + React renderer + SQLite). Existing structure preserved (`src/main`, `src/preload`, `src/renderer`, `src/shared`).
**Performance Goals**: No new performance budgets — every change is on a path that already runs in milliseconds.
**Constraints**: Existing populated databases must survive the migration. The migration adds a nullable column and leaves legacy held tickets reachable only by future cleanup (per spec). Existing IPC signatures change only where necessary; the preload bridge is updated in lockstep so no renderer can call a stale signature.
**Scale/Scope**: Five files changed in the main process, three in the renderer, one schema migration, one new renderer modal. Held-tickets table is typically under a few dozen rows per terminal; purchase orders in the hundreds; sales in the thousands but the mixed-payment-cancel path is hit only when the cashier cancels a specific class of sale.

## Constitution Check

> Gate: must pass before Phase 0. Re-checked after Phase 1.

| Principle | Status | Notes |
|---|---|---|
| **I. Locked Technology Stack** | ✅ PASS | No new runtime or build dependencies. Uses existing `better-sqlite3`, Zustand, React, IPC bridge. |
| **II. Strict Typing & SRP Components** | ✅ PASS | New code touches existing modules; the only new file is a renderer modal component (`MixedCancellationModal.tsx`) that is pure presentation — it takes data in and emits a typed decision out. No new store or cross-cutting concern. |
| **III. Layered Data Access** | ✅ PASS | All SQL changes stay inside `src/main/db/queries/{held-tickets,purchases,sales,auth}.ts`. No raw `better-sqlite3` calls leak into IPC handlers or renderer code. |
| **IV. Main/Renderer Boundary** | ✅ PASS — REINFORCED | The held-tickets fix actually *tightens* the boundary: the renderer no longer supplies a "current user" anywhere; the main process derives it from the session map established by feature 001. Two existing IPC signatures change (`heldTickets.list/add/remove`, `purchases.receive`, `sales.cancel`), each in lockstep with a preload typing update. |
| **V. Isolated Hardware & Reporting** | ✅ N/A | Feature does not touch the thermal printer or any report formatter. |
| **VI. Schema Evolution via Migrations** | ✅ PASS | One additive migration (`held_tickets.user_id INTEGER NULL` + a partial-index helper). Existing data preserved with `user_id = NULL` and not shown to any cashier per FR-005 — documented in [research.md](research.md) §1 and the Edge Cases section of the spec. The migration is idempotent (uses `PRAGMA table_info` to detect column presence) and tested against both a fresh DB and a populated one in [quickstart.md](quickstart.md) §2. |
| **VII. Simplicity, Approval & Non-Regression** | ✅ PASS | Each fix is the minimal change that makes the corresponding invariant hold. No new abstraction is introduced. The two medium-severity items (FR-011, FR-012) are folded into the same files as the corresponding US so the blast radius stays in five main-process files and two renderer files. |

**Gate result: PASS.** No principle violation requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-review-fixes/
├── plan.md                  # This file
├── research.md              # Phase 0 — decisions & alternatives
├── data-model.md            # Phase 1 — schema diff, query patterns
├── quickstart.md            # Phase 1 — manual verification recipe
├── contracts/
│   ├── ipc-changes.md       # Updated IPC channel signatures
│   └── migration-v6.md      # The held_tickets.user_id migration
├── checklists/
│   └── requirements.md      # (already created in /speckit-specify)
└── tasks.md                 # Phase 2 (next: /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── db/
│   │   ├── index.ts                       # MODIFIED — add migration v6
│   │   ├── schema.ts                      # MODIFIED — held_tickets.user_id on fresh installs
│   │   └── queries/
│   │       ├── held-tickets.ts            # MODIFIED — list/add scoped by user_id
│   │       ├── purchases.ts               # MODIFIED — receivePurchaseOrder(id, userId);
│   │       │                              #            cancelPurchaseOrder wrapped in tx (FR-011)
│   │       ├── sales.ts                   # MODIFIED — cancelSale(id, userId, refundMixedCredit)
│   │       └── users.ts                   # MODIFIED — add createUserAtomicRecoveryCheck (FR-012)
│   └── ipc/
│       ├── held-tickets.ipc.ts            # MODIFIED — pass resolved userId from session
│       ├── purchases.ipc.ts               # MODIFIED — pass resolved userId to receive
│       ├── sales.ipc.ts                   # MODIFIED — pass refundMixedCredit through
│       └── users.ipc.ts                   # MODIFIED — call atomic createUser path (FR-012)
├── preload/
│   ├── index.ts                           # MODIFIED — sales.cancel + heldTickets surface
│   └── index.d.ts                         # MODIFIED — matching types
└── renderer/
    └── src/
        ├── store/
        │   └── held.store.ts              # MODIFIED — drop client-side filtering; refetch on login
        └── modules/
            └── ventas-listado/
                ├── VentaDetallePage.tsx   # MODIFIED — open MixedCancellationModal on mixed sales
                └── MixedCancellationModal.tsx  # NEW — presentational modal for US3
```

**Structure Decision**: Existing per-process layout preserved. The feature lands as edits to ten existing files plus one new renderer modal — no new directories, no new top-level modules. The held-tickets fix is the only one that touches both processes; the other two fixes are entirely main-side (a function-signature change and a transaction wrapper). The renderer-side modal is a leaf component with no store coupling.

## Phase 0 — Research

See [research.md](research.md). Six decisions resolved:

1. How to handle legacy held tickets at migration time.
2. Whether to scope visibility by `user_id` or by `role` (per-cashier vs. shared-with-supervisors).
3. Where the "refund the credit?" decision is captured in the audit trail.
4. Whether `cancelSale` keeps backwards compatibility on its existing call sites.
5. How to make the recovery-mode + createUser pair atomic without rewriting the recovery module.
6. Whether to add a partial index on `held_tickets(user_id)`.

No `NEEDS CLARIFICATION` markers remain.

## Phase 1 — Design

- [data-model.md](data-model.md) — column-level diff for `held_tickets`, expected query shapes for each repository function, and the new mixed-cancellation audit row format.
- [contracts/ipc-changes.md](contracts/ipc-changes.md) — exact before/after for the four IPC channels whose signatures change.
- [contracts/migration-v6.md](contracts/migration-v6.md) — the DDL, the idempotency check, and the rollback contract.
- [quickstart.md](quickstart.md) — five hand-run checks that together exercise FR-001 through FR-012.

Re-evaluated Constitution Check after design: still ✅ PASS, no violations.
