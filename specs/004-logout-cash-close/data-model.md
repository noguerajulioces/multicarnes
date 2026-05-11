# Phase 1 Data Model: Logout Requires Cash Register Close

**Feature**: 004-logout-cash-close
**Date**: 2026-05-11

This feature introduces **no new tables, columns, indexes, or migrations**. It reads existing columns on the existing `cash_registers` table. The data model below is descriptive — it documents the shape of data the new query and IPC return, and the renderer-side state transitions during a guarded logout.

---

## Entities

### CashRegister (existing — no change)

Defined by the existing migration baseline. Relevant columns for this feature:

| Column     | Type    | Constraint                                  | Use here |
|------------|---------|---------------------------------------------|----------|
| `id`       | INTEGER | PK                                          | Identifier passed to close-register flow. |
| `user_id`  | INTEGER | NOT NULL, FK → `users(id)`                  | Filter predicate: "open registers belonging to *this* user." |
| `status`   | TEXT    | NOT NULL, CHECK in (`open`, `closed`)       | Filter predicate: `status = 'open'`. |
| `opened_at`| TEXT    | NOT NULL                                    | Displayed in the blocked-logout notice. |
| `opening_amount` | REAL | NOT NULL                                | Displayed in the blocked-logout notice (context for the user). |
| `closed_at`| TEXT    | NULL when open                              | Not read by this feature. |

**Invariant relied upon**: at most one row per `user_id` has `status = 'open'` at a time. Established by the existing open-register flow ([cash:open](../../src/main/ipc/cash.ipc.ts#L8) refuses to open a second register for the same user). This feature does not enforce the invariant — it depends on it being already true and uses `LIMIT 1` defensively.

### LogoutGuardDecision (conceptual, in-memory only)

Computed fresh per logout attempt. Not persisted.

```typescript
type LogoutGuardDecision =
  | { kind: 'allow' }
  | { kind: 'block'; openRegister: CashRegister }
  | { kind: 'error'; message: string }
```

| Field | Meaning |
|-------|---------|
| `kind: 'allow'`  | User has no open register; renderer proceeds to `auth.store.logout()`. |
| `kind: 'block'`  | User has an open register; renderer opens `LogoutBlockedModal` with `openRegister` populated. |
| `kind: 'error'`  | Underlying check failed (IPC reject, DB error); modal opens in error state with retry. |

---

## Query shape

### New: `getOpenCashRegisterByUserId(userId)`

Location: [src/main/db/queries/cash.ts](../../src/main/db/queries/cash.ts), alongside `getCurrentCashRegister`.

```typescript
export function getOpenCashRegisterByUserId(userId: number): CashRegister | undefined {
  const stmt = db.prepare(`
    SELECT cr.*, u.name AS user_name
    FROM cash_registers cr
    LEFT JOIN users u ON u.id = cr.user_id
    WHERE cr.user_id = ? AND cr.status = 'open'
    LIMIT 1
  `)
  return stmt.get(userId) as CashRegister | undefined
}
```

- Returns `undefined` when the user has no open register (mapped to `kind: 'allow'` upstream).
- `LIMIT 1` is defensive against the invariant ever being violated; the query never returns more than one row.
- Joins `users` for `user_name` to keep the row shape identical to `getCurrentCashRegister`, so the renderer can render the same UI fragments.

### Index assessment

No new index. The expected predicate is `user_id = ? AND status = 'open'`. The existing primary-key index on `cash_registers(id)` is not used here, but at typical retail scale (≤ low tens of thousands of rows total over the table's lifetime; a single-digit number of `status='open'` rows at any moment) a full scan is well under the 200 ms SC-004 budget. If profiling later shows a regression, add `CREATE INDEX idx_cash_registers_user_status ON cash_registers(user_id, status)` in a follow-up migration. Not adding it preemptively (Principle VII).

---

## State transitions (renderer)

This is the only state-changing piece in the feature. It happens entirely in the renderer.

```text
                  ┌─────────────────────────┐
                  │  user clicks "Cerrar    │
                  │     sesión" button      │
                  └────────────┬────────────┘
                               │
                               ▼
              ┌────────────────────────────────────┐
              │ requestLogout() (useLogoutGuard)   │
              │ • call window.api.cash             │
              │     .getMyOpenRegister()           │
              └────┬──────────────┬────────────────┘
                   │              │
       result: open=null    result: open=Register   reject/throw
                   │              │                       │
                   ▼              ▼                       ▼
        auth.store.logout()   open LogoutBlocked     open LogoutBlocked
        navigate to /login    Modal (block state)    Modal (error state)
                                   │                       │
                            ┌──────┴──────┐                │
                            ▼             ▼                ▼
                  "Cerrar caja ahora"  "Cancelar"     "Reintentar"
                            │             │                │
                            ▼             ▼                ▼
                 useCashStore        close modal      re-run
                  .setRegister(r)    (no logout)      requestLogout()
                 navigate
                  to /caja/cierre
```

No global state is added. The transitions consume `useCashStore.setRegister` (already exists) and `useNavigate` from react-router-dom (already in use).

---

## Out of scope (explicitly not modeled)

- Persistence of "user attempted logout at T" — the spec does not require an audit row for blocked logouts, and adding one would be drive-by scope under Principle VI/VII.
- Cross-tab / multi-window synchronization — Electron renderer is single-window in this app.
- Server-side enforcement beyond the per-user filter — the close action itself (`cash:close`) is already authorized; the guard is a UX gate, not the only thing standing between an open register and the user.
