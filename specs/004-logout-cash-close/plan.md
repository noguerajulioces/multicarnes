# Implementation Plan: Logout Requires Cash Register Close

**Branch**: `004-logout-cash-close` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [/specs/004-logout-cash-close/spec.md](spec.md)

## Summary

Block any logout attempt while the signed-in user owns an open cash register, and offer a one-click shortcut into the existing close-register flow with that register preselected.

Technical approach: a new per-user IPC query (`cash:getMyOpenRegister`) scoped to the authenticated session, a renderer-side `requestLogout` orchestrator that gates the existing `auth.store.logout()` behind that query, a shared `LogoutBlockedModal` for the user-facing notice, and wiring of the three existing logout call sites ([Header.tsx:93](../../src/renderer/src/components/Header.tsx#L93), [Sidebar.tsx:218](../../src/renderer/src/components/Sidebar.tsx#L218), [Sidebar.tsx:244](../../src/renderer/src/components/Sidebar.tsx#L244)) to the orchestrator. No schema change. No new dependencies. Reuses [CierreCajaPage.tsx](../../src/renderer/src/modules/caja/CierreCajaPage.tsx) verbatim — the orchestrator just hydrates [useCashStore](../../src/renderer/src/store/cash.store.ts) with the user's open register before navigating to `/caja/cierre`.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 20 (Electron 39 main), React 19 (renderer)
**Primary Dependencies**: Electron 39, React 19, Zustand, React Router DOM, better-sqlite3 (all already in stack — no additions)
**Storage**: existing SQLite `cash_registers` table (no migration; query reads `user_id` + `status` columns that already exist — see [src/main/db/schema.ts:56-67](../../src/main/db/schema.ts#L56-L67))
**Testing**: manual quickstart only (project has no automated test suite for renderer/IPC paths, matches feature 001/002/003 convention)
**Target Platform**: Electron desktop (macOS + Windows POS terminals)
**Project Type**: desktop-app (main + preload + renderer processes, existing layout)
**Performance Goals**: added logout latency ≤ 200 ms for the no-open-register common case (SC-004). The new query is a single indexed lookup on `cash_registers(user_id, status)`; well under budget.
**Constraints**: must not change the existing close-register flow (FR-011); must not auto-close any register (FR-012); must default to blocking on IPC/data error (FR-008).
**Scale/Scope**: 3 logout call sites, 1 new query, 1 new IPC handler, 1 new preload binding, 1 new hook, 1 new modal component. ~150 LOC net.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Locked Tech Stack | ✅ Pass | Zero new runtime or dev dependencies. Uses Electron IPC, Zustand, React Router, better-sqlite3 already in `package.json`. |
| II. Strict Typing & SRP | ✅ Pass | New hook is one responsibility (gate logout). Modal is presentational. Query function is typed; no `any`. No new Zustand store — extends the existing `cash.store.ts` only via its existing `setRegister` method. |
| III. Layered Data Access | ✅ Pass | New `getOpenCashRegisterByUserId(userId)` lives in [src/main/db/queries/cash.ts](../../src/main/db/queries/cash.ts) alongside the existing register queries. Renderer never touches the DB. |
| IV. Main/Renderer Boundary | ✅ Pass | One new IPC channel (`cash:getMyOpenRegister`) registered via `registerAuthorized`, with matching preload binding (`window.api.cash.getMyOpenRegister`) and renderer type. `nodeIntegration` stays off; `contextIsolation` stays on. |
| V. Isolated Hardware & Reports | ➖ N/A | No printer, no xlsx/PDF output in this feature. |
| VI. Schema Evolution | ✅ Pass | **No schema change.** The query reads `cash_registers.user_id` and `cash_registers.status`, both present since v1. No migration file, no backfill. |
| VII. Simplicity & Non-Regression | ✅ Pass | Smallest viable design: 1 query, 1 handler, 1 hook, 1 modal, 3 wire-up edits. Does not modify the close-register flow (FR-011); reuses it via deep-link. |

**Result**: no violations. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-logout-cash-close/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Feature spec
├── research.md          # Phase 0 — decisions + rationale
├── data-model.md        # Phase 1 — entities & query shape
├── quickstart.md        # Phase 1 — manual QA steps
├── contracts/
│   └── ipc-cash-get-my-open-register.md   # IPC contract for the new channel
└── tasks.md             # /speckit-tasks output (not created here)
```

### Source Code (repository root)

This feature is additive and touches files in three of the existing process trees. No new top-level directories.

```text
src/
├── main/
│   ├── db/
│   │   └── queries/
│   │       └── cash.ts                      # ADD: getOpenCashRegisterByUserId(userId)
│   └── ipc/
│       └── cash.ipc.ts                      # ADD: registerAuthorized('cash:getMyOpenRegister', ...)
│
├── preload/
│   └── index.ts                             # ADD: cash.getMyOpenRegister bridge
│
├── renderer/
│   └── src/
│       ├── hooks/
│       │   └── use-logout-guard.ts          # NEW: requestLogout() orchestrator
│       ├── components/
│       │   ├── LogoutBlockedModal.tsx       # NEW: blocked-logout notice + shortcut
│       │   ├── Header.tsx                   # EDIT: route handleLogout through requestLogout
│       │   └── Sidebar.tsx                  # EDIT: route both logout buttons through requestLogout
│       └── modules/
│           └── caja/
│               └── CierreCajaPage.tsx       # UNCHANGED (reused via deep-link)
│
└── shared/
    └── types.ts                             # ADD (if needed): IPC payload type for the new channel

src/main/auth/matrix.ts                      # ADD: rule for 'cash:getMyOpenRegister' (all 3 roles allowed)
```

**Structure Decision**: keep existing layout. The new code slots into the established `main/db/queries`, `main/ipc`, `preload`, and `renderer/src/{components,hooks}` locations. No reorganization. Hooks directory already exists per feature 003 convention; if it does not, create it under `src/renderer/src/hooks/`.

## Complexity Tracking

No constitution violations to justify. Section intentionally empty.
