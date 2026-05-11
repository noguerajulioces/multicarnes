# IPC Contract: `cash:getMyOpenRegister`

**Feature**: 004-logout-cash-close
**Direction**: renderer → main
**Pattern**: request/response via `ipcRenderer.invoke` / `ipcMain.handle` through `registerAuthorized`.

---

## Purpose

Return the **caller's own** open cash register if one exists. Used by the logout guard to decide whether to block logout.

The handler does **not** accept a user id from the client. The user id comes from `AuthContext.userId` on the authenticated channel — preventing a client from probing for other users' open registers.

---

## Authorization

- Registered with `registerAuthorized` (per feature 001-ipc-authorization).
- Matrix rule: **any authenticated user** (admin, supervisor, cashier). The query result is the caller's own data.
- Rejects with the standard "no autenticado" error when the session is not signed in.

Add to [src/main/auth/matrix.ts](../../../src/main/auth/matrix.ts):

```typescript
'cash:getMyOpenRegister': { roles: ['admin', 'supervisor', 'cashier'] },
```

---

## Request

| Field | Type | Notes |
|-------|------|-------|
| (no arguments) | — | The handler reads `ctx.userId` from `AuthContext`. |

Renderer call:

```typescript
window.api.cash.getMyOpenRegister()
```

---

## Response

`Promise<CashRegister | null>`

- `null` → the caller has no open register. Logout should proceed.
- `CashRegister` object → the caller has an open register. Logout must be blocked. Shape matches the row returned by the existing `cash:getCurrent` channel (same `SELECT ... LEFT JOIN users` shape) so renderer components that render register summaries can be reused without an adapter.

Example (block case):

```json
{
  "id": 42,
  "user_id": 7,
  "user_name": "Maria Cajera",
  "opening_amount": 150000,
  "opened_at": "2026-05-11T08:03:11.000Z",
  "status": "open",
  "closed_at": null
}
```

---

## Errors

| Condition | Behavior |
|-----------|----------|
| Caller not authenticated | Channel rejects with the standard auth-guard error before reaching the handler. Renderer treats this as a "session lost" — surface via the existing auth-error toast and route to login. |
| DB error / unexpected exception | Handler does not catch; the rejection propagates. Renderer treats any rejection as `kind: 'error'` per data-model.md — blocked-logout modal opens in error state with retry. |
| Invariant violation (>1 row) | `LIMIT 1` truncates. The handler returns the first row deterministically. No special-case logic. |

The renderer **never** treats an error as "no open register" — fail-closed per FR-008.

---

## Idempotency & side-effects

- Pure read. No mutation. Safe to call any number of times.
- No caching at the handler layer. The renderer hook calls it fresh on every logout attempt; staleness is not a concern within a single attempt.

---

## Wiring summary

1. **Matrix** — [src/main/auth/matrix.ts](../../../src/main/auth/matrix.ts): add the rule above.
2. **Query** — [src/main/db/queries/cash.ts](../../../src/main/db/queries/cash.ts): add `getOpenCashRegisterByUserId(userId)`.
3. **Handler** — [src/main/ipc/cash.ipc.ts](../../../src/main/ipc/cash.ipc.ts): one new `registerAuthorized` block:

   ```typescript
   registerAuthorized(
     'cash:getMyOpenRegister',
     getRule('cash:getMyOpenRegister'),
     (_event, ctx) => cashQuery.getOpenCashRegisterByUserId(ctx.userId) ?? null
   )
   ```

4. **Preload bridge** — [src/preload/index.ts](../../../src/preload/index.ts): add to the `cash` namespace:

   ```typescript
   getMyOpenRegister: () => ipcRenderer.invoke('cash:getMyOpenRegister')
   ```

5. **Renderer type** — [src/renderer/src/types/api.d.ts](../../../src/renderer/src/types/api.d.ts) (or wherever the `window.api.cash` interface is declared): add `getMyOpenRegister(): Promise<CashRegister | null>`.

---

## Out of contract

- No second channel for "check if anyone has any open register" — the guard is strictly per-user.
- No streaming/subscription variant — logout is a discrete action, not a continuously-observed state.
