# Implementation Plan: Server-side Authorization for Privileged Operations

**Branch**: `001-ipc-authorization` (spec dir; working git branch is `fix/qa-feedback-round-1`)
**Date**: 2026-05-08
**Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ipc-authorization/spec.md`

## Summary

Wrap every IPC handler in the main process with an authorization guard that resolves the caller's identity from a main-process session map (keyed by Electron's `webContents.id`, which the renderer cannot forge), re-reads the caller's role from the `users` table on every call, and matches the request against a single canonical authorization matrix. Persist every decision to a new `auth_audit` table; surface a "repeated authorization failures" alert on the dashboard when a user exceeds the configured threshold. Provide a recovery path that detects an empty admin set and lets the operator create the first admin without authentication. Roll out via a `registerAuthorized()` helper so each existing IPC file changes by ~1 line per handler — no handler bodies are rewritten.

## Technical Context

**Language/Version**: TypeScript 5.9 (existing project compiler)
**Primary Dependencies**: Electron 39 (main process IPC + `webContents`), better-sqlite3 12 (sync DB access on the main side), bcryptjs (existing PIN auth — unchanged), Zustand (renderer state — unchanged). **No new runtime dependencies.**
**Storage**: SQLite (existing `pos.db`). Adds two tables: `auth_audit` and `auth_alert_acks`. Adds index `idx_auth_audit_user_time_outcome` on `auth_audit(claimed_user_id, created_at, outcome)`.
**Testing**: No test infrastructure exists in the repo today (gap analysis P4). For this feature, validation is via a hand-run quickstart script ([quickstart.md](quickstart.md)) plus a single internal self-test that runs at app start: every channel registered with `ipcMain.handle` must have a matrix entry — startup throws if not. **Non-blocking gap**: a future feature should add a real test runner, scoped out of this plan per Principle VII.
**Target Platform**: Electron desktop app on macOS / Windows / Linux (electron-builder configured per platform).
**Project Type**: Desktop application (Electron + React renderer + SQLite). Existing structure preserved (`src/main`, `src/preload`, `src/renderer`, `src/shared`).
**Performance Goals**: ≤100 ms p95 per authorization decision (FR-023, SC-008). Expected typical: <2 ms (one indexed lookup + one INSERT in WAL mode on local disk).
**Constraints**: Single-terminal, offline, no network. No external auth provider. Backwards-compatible with existing `users` table and login flow. The migration path must be safe for an existing populated database.
**Scale/Scope**: ~85 IPC channels (81 existing + 4 new `auth:*` channels), 3 roles, ~1 alert active at any one time per terminal. Audit volume: ~500–2000 entries/day under typical use.

## Constitution Check

> Gate: must pass before Phase 0. Re-checked after Phase 1.

| Principle | Status | Notes |
|---|---|---|
| **I. Locked Technology Stack** | ✅ PASS | No new runtime dependencies. Uses existing `better-sqlite3`, `bcryptjs`, Zustand, IPC bridge. |
| **II. Strict Typing & SRP Components** | ✅ PASS (with discipline) | New code lives in `src/main/auth/` as small, single-responsibility modules: `matrix.ts`, `session.ts`, `guard.ts`, `audit.ts`, `alerts.ts`. New renderer state goes in a domain-scoped `auth-events.store.ts` (alert acknowledgment), not in any existing store. |
| **III. Layered Data Access** | ✅ PASS | New `src/main/db/queries/auth.ts` repository for `auth_audit` and `auth_alert_acks`. Guard layer never touches `better-sqlite3` directly. |
| **IV. Main/Renderer Boundary** | ✅ PASS — REINFORCED | This feature is the strongest enforcement of Principle IV the codebase has had. Identity is established from `event.sender.id` server-side; the renderer cannot supply or forge a user id for authorization purposes. |
| **V. Isolated Hardware & Reporting** | ✅ N/A | Feature does not touch printer or reporting services. |
| **VI. Schema Evolution via Migrations** | ⚠ PASS (with care) | Two new tables added via the existing ad-hoc `runMigrations()` style in [src/main/db/index.ts](../../src/main/db/index.ts). Adopting a versioned migration system is **out of scope** here (gap analysis P3); this feature stays consistent with the project's current convention to keep blast radius small. The migration is additive (new tables only); it does not modify existing tables. Re-running on already-migrated DBs is a no-op. |
| **VII. Simplicity, Approval & Non-Regression** | ✅ PASS | Rollout uses a single helper (`registerAuthorized`) that replaces ~1 line in each existing IPC file. No handler bodies are rewritten. The blast radius is limited to: 10 IPC files (one-line edits each), one new directory `src/main/auth/`, one migration, one renderer-side bridge update. |

**Gate result: PASS.** No principle violation requires justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-ipc-authorization/
├── plan.md                  # This file
├── research.md              # Phase 0 — decisions & alternatives
├── data-model.md            # Phase 1 — entities, schemas, state
├── quickstart.md            # Phase 1 — manual verification recipe
├── contracts/
│   ├── auth-matrix.md       # The full authorization matrix (operation → rule)
│   ├── ipc-channels.md      # New & modified IPC channel signatures
│   └── audit-schema.md      # auth_audit and auth_alert_acks DDL
├── checklists/
│   └── requirements.md      # (already created in /speckit-specify)
└── tasks.md                 # Phase 2 (next: /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── auth/                          # NEW — feature lives here
│   │   ├── matrix.ts                  # Authorization matrix (single source of truth)
│   │   ├── session.ts                 # Sender-id keyed session map
│   │   ├── guard.ts                   # registerAuthorized() helper
│   │   ├── audit.ts                   # Persists decisions; rate-limit detection
│   │   ├── alerts.ts                  # Repeated-failure alert lifecycle
│   │   └── self-test.ts               # Startup check: every channel covered
│   ├── db/
│   │   ├── index.ts                   # MODIFIED — runMigrations adds 2 tables
│   │   ├── schema.ts                  # MODIFIED — declares auth_audit, auth_alert_acks
│   │   └── queries/
│   │       └── auth.ts                # NEW — repository for new tables
│   ├── ipc/
│   │   ├── auth.ipc.ts                # NEW — auth:* channels (matrix view, audit list, alerts)
│   │   ├── *.ipc.ts                   # MODIFIED — each register*Ipc() switches to registerAuthorized
│   │   └── ...
│   └── index.ts                       # MODIFIED — runs auth.self-test after handler registration
├── preload/
│   └── index.ts                       # MODIFIED — exposes window.api.auth.*
├── renderer/
│   └── src/
│       ├── store/
│       │   └── auth-events.store.ts   # NEW — alert state, acknowledged set
│       ├── lib/
│       │   └── api-error.ts           # NEW — central handler for "blocked-*" responses
│       └── components/
│           └── AuthAlertsBanner.tsx   # NEW — renders on dashboard for admins
└── shared/
    └── auth-types.ts                  # NEW — shared types (Role, AuthOutcome, etc.)
```

**Structure Decision**: Existing per-process layout is preserved. New code is concentrated in `src/main/auth/` (back-office, the single place authorization is enforced) plus a thin renderer layer for surfacing alerts and uniform error handling. No directory rename. No file in `src/renderer/src/modules/` changes structurally.

## Phase 0 — Research

See [research.md](research.md). Eleven decisions resolved (identity binding, matrix location, handler-wrapping strategy, audit table design, alert pull-vs-push, recovery detection, pre-login surface, testing posture, performance, migration shape, hybrid `self-or-roles` rule). No `NEEDS CLARIFICATION` markers remain.

## Phase 1 — Design & Contracts

- **Data model** → [data-model.md](data-model.md): entities (`AuthSession` in-memory, `AuthDecision` transient, `AuthAuditEntry` persisted, `AuthMatrixEntry` compile-time, `AuthAlertAck` persisted), validation rules, state transitions, full DDL.
- **Contracts**:
  - [contracts/auth-matrix.md](contracts/auth-matrix.md) — every IPC channel mapped to a rule (`public` / `self-only` / `self-or-roles` / `privileged`).
  - [contracts/ipc-channels.md](contracts/ipc-channels.md) — new `auth:*` channels and modified `users:login` / `users:update` signatures.
  - [contracts/audit-schema.md](contracts/audit-schema.md) — `auth_audit` and `auth_alert_acks` DDL with indexes and rationale.
- **Quickstart** → [quickstart.md](quickstart.md): manual verification recipe for each spec acceptance scenario, runnable by QA without touching code.
- **Agent context** → `CLAUDE.md` updated to reference this plan between the `<!-- SPECKIT START -->` markers.

### Post-Phase-1 Constitution Re-check

| Principle | Status | Notes |
|---|---|---|
| I. Locked Technology Stack | ✅ Re-confirmed | No new deps added in Phase 1 design. |
| II. Strict Typing & SRP | ✅ | Five files under `src/main/auth/`, each with one job. Renderer adds one store + one component + one helper. |
| III. Layered Data Access | ✅ | All `auth_*` reads/writes go through `src/main/db/queries/auth.ts`. |
| IV. Main/Renderer Boundary | ✅ | Identity from `event.sender.id`, never from caller payload. Preload surface tightly typed. |
| V. Isolated Hardware & Reporting | ✅ N/A | Untouched. |
| VI. Schema Evolution | ✅ | Migration is additive (new tables only). No existing schema modified. |
| VII. Simplicity & Non-Regression | ✅ | All 81 existing handlers continue to work; the only change at the call site is wrapping the registration in `registerAuthorized(...)`. |

**Gate result: PASS post-design.** No items added to Complexity Tracking.

## Complexity Tracking

> Empty — Constitution gates pass without justified violations.

## Out of Plan Scope

Carried to other features:

- **Versioned migration system** (gap analysis P3): keeps the existing `runMigrations` pattern; doesn't introduce `schema_migrations` table here. Recommend a separate spec.
- **Real test infrastructure** (gap analysis P4): this plan ships with a hand-run quickstart and a startup self-test only. A real Vitest/Mocha setup is a separate spec.
- **Inactivity timeout / re-auth on idle**: spec §Out of Scope; handled by a future spec if needed.
- **Audit log encryption / tamper-evidence**: spec §Out of Scope.
- **Cancel-sale semantics** (gap analysis P6 / spec gap): orthogonal feature; this plan only requires that `sales:cancel` be admin-or-supervisor — what it does internally is unchanged.
