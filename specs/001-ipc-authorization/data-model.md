# Data Model — Server-side Authorization

## Entities

### 1. `AuthSession` (in-memory, main-process state, NOT persisted)

| Field | Type | Notes |
|---|---|---|
| `senderId` | `number` | Electron `webContents.id` — primary key of the in-memory map. |
| `userId` | `number` | FK → `users(id)`. Set on `users:login` success. |
| `loginAt` | `string` (ISO-8601) | For diagnostics only. |

**Lifecycle**:

- `none → active`: created on `users:login` success. Replaces any prior session for the same `senderId` (login replaces login).
- `active → cleared`: on explicit `users:logout`, on app quit, on `webContents` destroy event, or on `users:update` that deactivates the same `userId`.

**Storage**: a `Map<number, AuthSession>` in `src/main/auth/session.ts`. Not persisted across app restarts — re-login required after every restart (consistent with current behavior).

---

### 2. `AuthDecision` (transient, computed per call)

Computed in `src/main/auth/guard.ts` for every privileged call. Not persisted as a separate entity — its fields are written into `AuthAuditEntry` (next).

| Field | Type | Notes |
|---|---|---|
| `operation` | `string` | The IPC channel name, e.g., `"sales:create"`. |
| `senderId` | `number \| null` | From `event.sender.id`; null only in pathological edge cases. |
| `claimedUserId` | `number \| null` | Looked up from `AuthSession` by `senderId`; null if no session. |
| `resolvedUserId` | `number \| null` | The `users.id` returned from the DB lookup; null if not found. |
| `resolvedActive` | `boolean` | `users.active === 1`. |
| `resolvedRole` | `'admin' \| 'supervisor' \| 'cajero' \| null` | Read from `users.role`; null if user not found. |
| `outcome` | `AuthOutcome` | One of: `allowed`, `blocked-no-user`, `blocked-inactive`, `blocked-insufficient-role`. |
| `decidedAt` | `string` (ISO) | Time of decision. |

**Validation rules**:

- If `claimedUserId` is `null` → outcome is forced to `blocked-no-user`.
- If `resolvedActive` is `false` → outcome is `blocked-inactive`.
- If rule kind is `privileged` and `resolvedRole` is not in `rule.roles` → `blocked-insufficient-role`.
- If rule kind is `self-or-roles`: outcome is `allowed` if (`resolvedRole ∈ rule.roles`) **OR** (`resolvedUserId === targetUserId` provided by the call); else `blocked-insufficient-role`.
- If rule kind is `self-only`: outcome is `allowed` if (`resolvedUserId === targetUserId`); else `blocked-insufficient-role`.
- If rule kind is `public`: outcome is `allowed` regardless of `resolvedUserId`.

---

### 3. `AuthMatrixEntry` (compile-time data, not persisted)

| Field | Type | Notes |
|---|---|---|
| `kind` | `'public' \| 'self-only' \| 'self-or-roles' \| 'privileged'` | |
| `roles` | `Role[]` | Required iff `kind ∈ {'privileged', 'self-or-roles'}`. |
| `recoveryOnly` | `boolean` (optional) | If `true`, the operation is also accepted when `recoveryMode=true` (zero active admins). Used by `users:create` only. |
| `selfArgIndex` | `number` (optional) | For `self-only` and `self-or-roles`: which positional arg holds the target user id. Defaults to `0`. |

The matrix shape is `Record<ChannelName, AuthMatrixEntry>` exported from `src/main/auth/matrix.ts`. Channels not in the matrix are treated as `{kind: 'privileged', roles: []}` — i.e., **deny all** (FR-008).

---

### 4. `AuthAuditEntry` (persisted — table `auth_audit`)

```sql
CREATE TABLE auth_audit (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  operation          TEXT    NOT NULL,
  claimed_user_id    INTEGER,                                    -- nullable
  resolved_user_id   INTEGER,                                    -- nullable
  resolved_role      TEXT,                                       -- nullable
  outcome            TEXT    NOT NULL CHECK(outcome IN
                       ('allowed',
                        'blocked-no-user',
                        'blocked-inactive',
                        'blocked-insufficient-role')),
  sender_id          INTEGER,                                    -- nullable
  created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_auth_audit_user_time_outcome
  ON auth_audit(claimed_user_id, created_at, outcome);
```

| Column | Notes |
|---|---|
| `operation` | The IPC channel name. |
| `claimed_user_id` | The `userId` from `AuthSession`; `NULL` for `blocked-no-user`. |
| `resolved_user_id` | The `users.id` actually found in the DB; `NULL` if not found. |
| `resolved_role` | The role at decision time; `NULL` if user not found or inactive. |
| `outcome` | Constrained by CHECK. |
| `sender_id` | Electron `webContents.id`. Useful for incident review (multi-window scenarios; today always one). |

**Validation**:

- `outcome='allowed'` requires `resolved_user_id IS NOT NULL` AND `resolved_role IS NOT NULL`.
- `outcome='blocked-no-user'` requires `claimed_user_id IS NULL` AND `resolved_user_id IS NULL`.
- `outcome='blocked-inactive'` requires `resolved_user_id IS NOT NULL`.
- `outcome='blocked-insufficient-role'` requires `resolved_user_id IS NOT NULL` AND `resolved_role IS NOT NULL`.

**Retention**: rows older than 90 days are deleted at app start (FR-019).

---

### 5. `AuthAlertAck` (persisted — table `auth_alert_acks`)

```sql
CREATE TABLE auth_alert_acks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  window_start     TEXT    NOT NULL,
  acknowledged_at  TEXT,                                  -- nullable until ack'd
  acknowledged_by  INTEGER REFERENCES users(id),          -- the admin who ack'd
  UNIQUE(user_id, window_start)
);
```

**Semantics**:

- A "window" is identified by the `created_at` of the 5th (or any subsequent) blocked entry from a user within the last 10 minutes. The first time the dashboard query encounters such a window without a matching ack row, it inserts a row with `acknowledged_at = NULL`.
- An admin acknowledging the alert sets `acknowledged_at` and `acknowledged_by`.
- Subsequent loads of the dashboard skip windows whose row has `acknowledged_at IS NOT NULL`.
- The same user triggering a fresh wave of failures more than 10 minutes after the last one creates a new window with a different `window_start`.

**State transitions**:

```text
  none → triggered (acknowledged_at IS NULL)
                                    │
                                    ▼
                          acknowledged (acknowledged_at SET)
```

---

## Schema migration

Added to `runMigrations()` in `src/main/db/index.ts`. Both blocks are idempotent:

```ts
const tables = new Set(
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
    .map((r) => r.name)
)

if (!tables.has('auth_audit')) {
  db.exec(`/* CREATE TABLE auth_audit ... */`)
  db.exec(`/* CREATE INDEX idx_auth_audit_user_time_outcome ... */`)
}
if (!tables.has('auth_alert_acks')) {
  db.exec(`/* CREATE TABLE auth_alert_acks ... */`)
}

// Retention (cheap; runs once per app start)
db.prepare("DELETE FROM auth_audit WHERE created_at < datetime('now','-90 days')").run()
```

No existing tables are altered. Re-running on a migrated DB is a no-op for the CREATE blocks; the retention statement is always run and is bounded by the index.

---

## Shared types (`src/shared/auth-types.ts`)

```ts
export type Role = 'admin' | 'supervisor' | 'cajero'

export type AuthOutcome =
  | 'allowed'
  | 'blocked-no-user'
  | 'blocked-inactive'
  | 'blocked-insufficient-role'

export type AuthRule =
  | { kind: 'public' }
  | { kind: 'self-only'; selfArgIndex?: number }
  | { kind: 'self-or-roles'; roles: Role[]; selfArgIndex?: number }
  | { kind: 'privileged'; roles: Role[]; recoveryOnly?: boolean }

export interface AuthAuditEntry {
  id: number
  operation: string
  claimedUserId: number | null
  resolvedUserId: number | null
  resolvedRole: Role | null
  outcome: AuthOutcome
  senderId: number | null
  createdAt: string
}

export interface AuthAlert {
  id: number
  userId: number
  userName: string                  // joined from users at read time
  windowStart: string
  failureCount: number              // joined-aggregated at read time
  acknowledgedAt: string | null
}
```

These types are shared via `src/shared/` so the renderer (alerts banner, profile page) and main (matrix, audit) refer to the same definitions.
