# IPC Channels — New & Modified

## New channels

### `auth:recoveryNeeded`

**Direction**: renderer → main
**Rule**: `public`
**Returns**: `{ recoveryNeeded: boolean }`
**Behavior**: Returns `true` iff `SELECT COUNT(*) FROM users WHERE active=1 AND role='admin'` is `0`. Used by the login screen to decide whether to render the first-run-style admin-creation form.

### `auth:matrixSummary`

**Direction**: renderer → main
**Rule**: `privileged: ['admin']`
**Returns**: `Array<{ operation: string, kind: AuthRule['kind'], roles?: Role[], recoveryOnly?: boolean }>`
**Behavior**: Read-only dump of the matrix for the admin "Authorization rules" page (small ops feature; can be deferred to a follow-up if needed).

### `auth:listAuditEntries`

**Direction**: renderer → main
**Rule**: `privileged: ['admin']`
**Args**: `{ from?: string, to?: string, userId?: number, operation?: string, outcome?: AuthOutcome, limit?: number, offset?: number }`
**Returns**: `{ entries: AuthAuditEntry[], total: number }`
**Behavior**: Paginated query of `auth_audit` joined with `users.name`. Default `limit=50`, max `1000`. Newest first.

### `auth:listAlerts`

**Direction**: renderer → main
**Rule**: `privileged: ['admin']`
**Returns**: `AuthAlert[]` (only those with `acknowledged_at IS NULL`)
**Behavior**: Computed query that:

1. Groups `auth_audit` by `claimed_user_id` over the last 10 minutes.
2. Filters to groups with `count(*) where outcome LIKE 'blocked-%' >= 5`.
3. For each surviving group, ensures a row exists in `auth_alert_acks` with `acknowledged_at IS NULL` (inserts on first observation), then returns the merged record.

### `auth:acknowledgeAlert`

**Direction**: renderer → main
**Rule**: `privileged: ['admin']`
**Args**: `{ alertId: number }`
**Returns**: `{ ok: true }`
**Behavior**: `UPDATE auth_alert_acks SET acknowledged_at = datetime('now','localtime'), acknowledged_by = ctx.userId WHERE id = ? AND acknowledged_at IS NULL`. No-op if already acknowledged.

### `users:logout`

**Direction**: renderer → main
**Rule**: `public`
**Returns**: `{ ok: true }`
**Behavior**: Removes the session entry for `event.sender.id`. Idempotent.

---

## Modified channels

### `users:login` *(behavior change)*

- **Existing behavior**: validates name + PIN against bcrypt; returns the user record on success.
- **Added behavior**: on success, **records** the session as `sessionMap.set(event.sender.id, { userId, loginAt })`. On failure, no session is touched.
- Signature unchanged from the renderer's perspective.

### `users:create` *(rule + behavior change)*

- **Rule**: `privileged: ['admin']` with `recoveryOnly: true`.
- **Added behavior**: when invoked under recoveryMode, the handler MUST refuse to create any user with role ≠ `admin` (recovery only creates the first admin).

### `users:update` *(field-level enforcement)*

- **Rule**: `self-or-roles: ['admin']` with `selfArgIndex: 0` (the `id` is the first arg).
- **Added behavior**: when the caller is the same user as the target (i.e., the `self` branch matched), the handler MUST reject any update that touches `role`, `active`, or `name`. Only `pin_hash` may change. This preserves today's PIN-change UX while preventing self-promotion.

### Every other existing channel

- **No signature change**. Each `register*Ipc()` function in `src/main/ipc/*.ipc.ts` switches its `ipcMain.handle(...)` calls to `registerAuthorized(...)`. Handler bodies are unchanged except for two cases that consume the new context arg:
  - `cash:close` — uses `ctx.userId` to allow the cashier-self path.
  - `products:getAll` / `products:getById` — when `ctx.role === 'cajero'`, strip `last_purchase_cost` and any margin field from the response.

---

## Preload surface

`src/preload/index.ts` exposes:

```ts
window.api.auth = {
  recoveryNeeded(): Promise<{ recoveryNeeded: boolean }>
  matrixSummary(): Promise<...>
  listAuditEntries(filters): Promise<...>
  listAlerts(): Promise<AuthAlert[]>
  acknowledgeAlert(alertId: number): Promise<{ ok: true }>
}
window.api.users.logout = (): Promise<{ ok: true }>
```

---

## Error envelope

When a guard rejects a call, `registerAuthorized` throws `AuthError` carrying:

```ts
class AuthError extends Error {
  outcome: 'blocked-no-user' | 'blocked-inactive' | 'blocked-insufficient-role'
  operation: string
  // toString returns a stable, locale-keyed message used by the renderer toaster.
}
```

In Electron, thrown errors from `ipcMain.handle` propagate as a rejected promise on the renderer. The renderer's `src/renderer/src/lib/api-error.ts` intercepts these uniformly and emits the toast: "No tenés permiso para realizar esta acción." (FR-024).
