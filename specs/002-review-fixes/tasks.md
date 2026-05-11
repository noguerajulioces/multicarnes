---
description: "Task list for 002-review-fixes (round-2 code review correctness fixes)"
---

# Tasks: Round-2 Code Review Fixes

**Input**: Design documents from `/specs/002-review-fixes/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Same posture as feature 001 — no new test runner is introduced. Validation is via manual quickstart runs (one verification task per user-story phase) plus a logic-level extension to [scripts/auth-smoke.ts](../../scripts/auth-smoke.ts) for FR-012, which is hard to exercise by hand.

**Organization**: Tasks are grouped by user story (US1, US2, US3) so each story is an independently demoable increment. FR-011 (transaction wrapping) and FR-012 (recovery-mode atomicity) have no user-facing UX and live in the polish phase. Phases 1 and 2 are intentionally empty — this feature reuses the directories, IPC bridge, and auth guard that feature 001 already put in place.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task.
- **[Story]**: Maps the task to a user story (US1, US2, US3).
- File paths are exact; every task names the file it touches.

## Path Conventions

Same as feature 001 (Electron desktop app):

- Main process: `src/main/**`
- Preload bridge: `src/preload/**`
- Renderer: `src/renderer/src/**`
- Database: SQLite file at `app.getPath('userData')/pos.db`; schema in `src/main/db/schema.ts`; migrations in `src/main/db/index.ts`; queries in `src/main/db/queries/**`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: None required. The codebase already has every directory, shared type, and infrastructure piece this feature needs (the auth guard, the session map, the migrations framework, the preload bridge — all delivered by feature 001).

*No tasks in this phase.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required. Each user story below is independently testable and does not share state with the others. Migration v6 (which the held-tickets story needs) is scoped to US1's phase, not here, because US2 and US3 do not depend on it.

*No tasks in this phase.*

**Checkpoint**: User-story work can begin immediately on a fresh branch — there is nothing to unblock.

---

## Phase 3: User Story 1 — Held tickets per-cashier privacy (Priority: P1) 🎯 MVP

**Goal**: A cashier sees only their own held tickets. Logging out a different cashier in does not leak the prior cashier's in-progress work. Migration v6 adds `held_tickets.user_id` as a nullable column so legacy rows survive but become invisible to every user.

**Independent Test**: Run [quickstart.md](quickstart.md) §1 (two-cashier handover) and §2 (migration on a populated DB). Cashier B must see zero of cashier A's tickets after a logout/login cycle; legacy rows must remain in the database with `user_id IS NULL`.

### Implementation for User Story 1

- [X] T001 [P] [US1] Update `CREATE TABLE held_tickets` in [src/main/db/schema.ts](../../src/main/db/schema.ts) to include `user_id INTEGER NULL REFERENCES users(id)` between the `discount` and `created_at` columns. Fresh installs created via `createTables()` get the column natively.
- [X] T002 [US1] Append migration `version: 6, name: 'add_held_tickets_user_id'` to the `MIGRATIONS[]` array in [src/main/db/index.ts](../../src/main/db/index.ts). Migration body uses `PRAGMA table_info(held_tickets)` to detect existing `user_id` column and runs `ALTER TABLE held_tickets ADD COLUMN user_id INTEGER NULL REFERENCES users(id)` only when absent. See [contracts/migration-v6.md](contracts/migration-v6.md) for the exact body.
- [X] T003 [US1] Update [src/main/db/queries/held-tickets.ts](../../src/main/db/queries/held-tickets.ts) — all four functions take `userId` as a parameter:
  - `listHeldTickets(userId)` → `SELECT * FROM held_tickets WHERE user_id = ? ORDER BY created_at DESC`
  - `addHeldTicket({ ...data, userId })` → INSERT now includes `user_id`
  - `removeHeldTicket(id, userId)` → wrap in `db.transaction()`:
    1. `const result = db.prepare('DELETE FROM held_tickets WHERE id = ? AND user_id = ?').run(id, userId)`
    2. If `result.changes === 0`: INSERT a row into `action_logs` (`user_id=userId, action='held_ticket_remove_denied', details='Held ticket {id} not found or not owned by user {userId}'`) and `throw new Error('Held ticket not found or access denied')`. Satisfies FR-003.
  - `clearHeldTickets(userId)` → DELETE adds `WHERE user_id = ?`
  - Update the exported `HeldTicketRow` interface to include `user_id: number | null`.
- [X] T004 [US1] Update [src/main/ipc/held-tickets.ipc.ts](../../src/main/ipc/held-tickets.ipc.ts) handlers to read the resolved `ctx.userId` from the auth guard and pass it to every query function. No new IPC channel is added; no preload change is needed.
- [X] T005 [P] [US1] Update [src/renderer/src/store/held.store.ts](../../src/renderer/src/store/held.store.ts) so it refetches held tickets via `window.api.heldTickets.list()` on auth-state change (login/logout). Drop any client-side filtering (the server already filters); the store should never hold tickets belonging to a non-current user. If the store currently caches across logout, clear the in-memory state on logout.
- [ ] T006 [US1] Run [quickstart.md](quickstart.md) §1 manually. All five steps must pass: cashier B sees zero, cashier B's ticket is invisible to cashier A, cashier A still sees their original tickets after re-login, sales finalised by cashier A attribute to cashier A.
- [ ] T007 [US1] Run [quickstart.md](quickstart.md) §2 manually against a copy of a real terminal's `pos.db`. The migration must run exactly once, legacy row count must be preserved, no user should see legacy rows.

**Checkpoint**: User Story 1 (MVP) is complete and demoable. The privacy gap surfaced by the round-2 review is closed.

---

## Phase 4: User Story 2 — Purchase reception audit attribution (Priority: P1)

**Goal**: The `stock_adjustments` row written when a purchase order is received is attributed to the user who confirmed reception, never to the order creator, never to `user_id = 0`. The function rejects calls with an unknown/inactive user before any DB mutation.

**Independent Test**: Run [quickstart.md](quickstart.md) §3 (admin A creates → supervisor B receives → audit query returns B's id). Repeat with A deactivated mid-flow; B's id still appears, `0` never does.

### Implementation for User Story 2

- [X] T008 [US2] Change `receivePurchaseOrder(id)` to `receivePurchaseOrder(id, userId)` in [src/main/db/queries/purchases.ts](../../src/main/db/queries/purchases.ts). At the top of the transaction body, validate `userId` against the users table:
  ```ts
  const exists = db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(userId)
  if (!exists) throw new Error('receivePurchaseOrder: userId must reference an active user')
  ```
  Replace the existing `const auditUserId = order?.user_id ?? 0` with `const auditUserId = userId`. Delete the order-creator-lookup that produced the stale attribution. The comment above that block ("TODO 001-ipc-authorization") can be removed in the same edit.
- [X] T009 [US2] Update [src/main/ipc/purchases.ipc.ts](../../src/main/ipc/purchases.ipc.ts) `purchases:receive` handler to pass `ctx.userId` (the resolved session user) to `receivePurchaseOrder(id, ctx.userId)`. No preload change is needed — the renderer signature stays `receive(id)`.
- [ ] T010 [US2] Run [quickstart.md](quickstart.md) §3 manually (both the normal case and the deactivated-creator edge case). Verify via `SELECT user_id FROM stock_adjustments WHERE reason LIKE 'Recepción compra%' ORDER BY id DESC LIMIT 5` that every row references the receiver and never `0`.

**Checkpoint**: Audit attribution defect closed. The `stock_adjustments.user_id` column now reliably points at the user accountable for the change.

---

## Phase 5: User Story 3 — Mixed-payment cancellation flow (Priority: P2)

**Goal**: When a sale paid partly in cash and partly on credit is cancelled, the cancelling user is shown both portions and explicitly chooses whether to refund the credit portion to the customer's balance. The choice is recorded in `action_logs`. Pure-cash and pure-credit cancellations are unchanged.

**Independent Test**: Run [quickstart.md](quickstart.md) §4 (both refund-chosen and refund-declined paths plus the non-mixed regression check). The customer balance and the audit row must reflect the user's choice every time.

### Implementation for User Story 3

- [X] T011 [US3] Change `cancelSale(id, userId)` to `cancelSale(id, userId, options?: { refundMixedCredit?: boolean })` in [src/main/db/queries/sales.ts](../../src/main/db/queries/sales.ts). Inside the transaction, after restocking but before the existing `payment_method === 'credit'` branch, add:
  - Detect mixed payment by `sale.payment_method === 'mixed'`.
  - Compute `creditPortion` from `SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ? AND method = 'credit'` (the canonical query — see [research.md](research.md) §3; mirrors the filter that the sale-creation path already uses to bump the customer's balance, so the displayed and refunded amounts cannot drift).
  - If `options?.refundMixedCredit === true`: update `customers.balance` by `+= creditPortion` and write `action_logs.details = 'Venta #N anulada — porción crédito $X (devolución aplicada)'`.
  - Else: leave the balance alone and write `action_logs.details = 'Venta #N anulada — porción crédito $X (devolución NO aplicada por decisión del cajero)'`.
  - Remove the existing `TODO(P6 follow-up)` comment that flagged the gap.
- [X] T012 [P] [US3] Update [src/preload/index.ts](../../src/preload/index.ts) and [src/preload/index.d.ts](../../src/preload/index.d.ts) so the renderer's `sales.cancel` signature is `(id: number, options?: { refundMixedCredit?: boolean }) => Promise<Sale | null>`. The optional `options` argument flows through `ipcRenderer.invoke('sales:cancel', id, options)`.
- [X] T013 [US3] Update [src/main/ipc/sales.ipc.ts](../../src/main/ipc/sales.ipc.ts) `sales:cancel` handler to accept the optional `options` argument and pass it through to `cancelSale(id, ctx.userId, options)`.
- [X] T014 [P] [US3] Create [src/renderer/src/modules/ventas-listado/MixedCancellationModal.tsx](../../src/renderer/src/modules/ventas-listado/MixedCancellationModal.tsx) — a presentational modal that takes props `{ cashPortion: number; creditPortion: number; onConfirm: (refund: boolean) => void; onCancel: () => void }`. No store imports, no API calls. Two primary buttons: "Devolver crédito al cliente" and "No devolver". Follow the styling of [src/renderer/src/modules/ventas/CobroModal.tsx](../../src/renderer/src/modules/ventas/CobroModal.tsx).
- [X] T015 [US3] Update [src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx](../../src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx) so the cancel-button handler:
  - If `sale.payment_method !== 'mixed'`: behave exactly as today (`window.api.sales.cancel(sale.id)` with no options).
  - If `sale.payment_method === 'mixed'`: compute cash and credit portions from the sale's payment breakdown, open `MixedCancellationModal` with those portions. On confirm, call `window.api.sales.cancel(sale.id, { refundMixedCredit: refund })`. On modal cancel, do nothing.
- [ ] T016 [US3] Run [quickstart.md](quickstart.md) §4 manually — all three sub-paths (refund applied, refund declined, non-mixed regression). Verify both the `customers.balance` value and the matching `action_logs.details` string after each cancellation.

**Checkpoint**: Mixed-payment cancellation is no longer silent. The user's decision is always captured in the audit log.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fold-in fixes for the two medium-severity review items that have no user-facing UX (FR-011 and FR-012), extend the smoke test, run the final manual checks, and commit.

- [X] T017 [P] Wrap the body of `cancelPurchaseOrder(id)` in [src/main/db/queries/purchases.ts](../../src/main/db/queries/purchases.ts) inside `db.transaction(() => { ... })`. The body is the existing single UPDATE plus the `getPurchaseOrderById(id)` read — both inside the transaction. No behaviour change is expected; this brings the function in line with `createPurchaseOrder` and `receivePurchaseOrder`. Addresses FR-011.
- [X] T018 [P] Add `createUserAtomicRecoveryCheck(data)` to [src/main/db/queries/users.ts](../../src/main/db/queries/users.ts), next to the existing `createUser`. Implementation: a single `db.transaction(() => { ... })` that (a) re-reads `SELECT COUNT(*) FROM users WHERE active = 1 AND role = 'admin'`; (b) computes `effectiveRole = count === 0 ? 'admin' : data.role`; (c) inserts the user with `effectiveRole`; (d) returns the inserted row. Addresses FR-012.
- [X] T019 Update [src/main/ipc/users.ipc.ts](../../src/main/ipc/users.ipc.ts) — replace the existing pattern
  ```ts
  const payload = isRecoveryMode() ? { ...data, role: 'admin' } : data
  const created = usersQuery.createUser(payload)
  refreshRecoveryMode()
  ```
  with
  ```ts
  const created = usersQuery.createUserAtomicRecoveryCheck(data)
  refreshRecoveryMode()
  ```
  Remove the now-unused `isRecoveryMode` import if no other handler in the file uses it. Depends on T018.
- [X] T020 [P] Extend [scripts/auth-smoke.ts](../../scripts/auth-smoke.ts) with the recovery-atomicity test described in [quickstart.md](quickstart.md) §5: seed an empty users table, fire two concurrent calls to `createUserAtomicRecoveryCheck` with `role: 'cashier'`, assert exactly one resulting user has `role: 'admin'`. The test must run under `npm run smoke:auth` and exit non-zero on failure.
- [ ] T021 Run [quickstart.md](quickstart.md) §5 (smoke test) and §6 (code review of `cancelPurchaseOrder` transaction wrapping). Both must pass.
- [ ] T022 [P] Add a `## 1.2.0` entry to [CHANGELOG.md](../../CHANGELOG.md) covering the three fixes: held-tickets per-user scoping, purchase-reception audit attribution, mixed-payment cancellation UX. Also note FR-011 and FR-012 as supporting correctness improvements.
- [ ] T023 Create a single conventional commit covering all of Phase 3–6. Suggested format:
  ```
  feat(round-2): scope held tickets per cashier, fix purchase audit attribution, mixed-payment cancellation prompt

  - US1: held_tickets.user_id (migration v6); list/add/remove filter by session user
  - US2: receivePurchaseOrder(id, userId); audit row no longer falls back to order creator or 0
  - US3: cancelSale options.refundMixedCredit + MixedCancellationModal; audit row captures decision
  - FR-011: cancelPurchaseOrder wrapped in db.transaction
  - FR-012: createUserAtomicRecoveryCheck closes the recovery-mode race
  ```

---

## Dependencies Summary

```
US1: T001 → T002 → T003 → T004
     T005 (parallel with T003/T004)
     T006, T007 (after T001-T005)

US2: T008 → T009 → T010   (independent of US1, can run in parallel)

US3: T011, T012 (parallel)
     T013 (after T011, T012)
     T014 (parallel with all above)
     T015 (after T012, T014)
     T016 (after T011-T015)

Polish:
     T017 (parallel)
     T018 → T019
     T020 (parallel with T017-T019)
     T021 (after T020 and T017)
     T022 (parallel with T017-T021)
     T023 (last)
```

**Parallel-friendly grouping** (safe to do simultaneously inside a single working session):

- T001 (schema) + T005 (renderer store)
- T012 (preload) + T014 (modal component)
- T017 (cancelPurchaseOrder tx) + T018 (atomic recovery) + T020 (smoke test) + T022 (CHANGELOG)

---

## Independent Test Criteria

| Story | Pass criterion (single sentence) |
|---|---|
| US1 | After cashier A logs out and cashier B logs in, B sees zero of A's held tickets; legacy rows survive the migration with `user_id IS NULL`. |
| US2 | After supervisor B receives a PO created by admin A, every new `stock_adjustments` row has `user_id = B.id` and zero rows have `user_id = 0`. |
| US3 | Cancelling a mixed-payment sale opens the modal exactly once; either path produces a customer-balance and `action_logs.details` outcome that matches the chosen option; non-mixed cancellations skip the modal. |
| FR-011 | Code review confirms `cancelPurchaseOrder` runs inside `db.transaction()`. |
| FR-012 | `npm run smoke:auth` passes the new concurrent-recovery-creation assertion. |

---

## Implementation Strategy

**MVP scope**: User Story 1 alone closes the privacy gap surfaced by the round-2 review and is shippable as a hotfix if the user-facing scope of US2/US3 needs more design review. Recommended cut-line if scope must shrink: ship US1 + Polish (FR-011, FR-012, smoke test) and defer US2/US3 to the next release.

**Recommended sequence (single developer)**:
1. Land US1 first — it's the only story with a schema migration, so getting it correct early de-risks the rest.
2. Land US2 next — it's the smallest scope and entirely main-process.
3. Land US3 last — it has the largest renderer surface (a new modal + a page integration).
4. Roll Polish into the same PR as US3 (the polish items each touch only one file).

**Recommended sequence (two developers working in parallel)**:
- Developer A: US1 (held tickets full stack) — Phase 3.
- Developer B: US2 (purchase audit, main-only) + US3 (mixed-cancel renderer + modal) — Phase 4 & 5.
- Merge: Polish in a final pass, single commit.

---

## Total task count

**23 tasks** across three user stories and one polish phase. No setup or foundational tasks — reuse of feature 001's infrastructure is intentional and documented in [plan.md](plan.md) §Constitution Check.

| Phase | Tasks | Parallel-friendly |
|---|---|---|
| 3 (US1) | T001–T007 (7) | T001+T005 in parallel |
| 4 (US2) | T008–T010 (3) | All sequential within the story |
| 5 (US3) | T011–T016 (6) | T011/T012/T014 in parallel |
| 6 (Polish) | T017–T023 (7) | T017/T018/T020/T022 in parallel |
