# Audit Schema

DDL for the two new tables. Both are added to `src/main/db/schema.ts` (declarations) and `src/main/db/index.ts` `runMigrations()` (idempotent migration).

## `auth_audit`

```sql
CREATE TABLE IF NOT EXISTS auth_audit (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  operation          TEXT    NOT NULL,
  claimed_user_id    INTEGER,                                          -- nullable
  resolved_user_id   INTEGER,                                          -- nullable
  resolved_role      TEXT,                                             -- nullable
  outcome            TEXT    NOT NULL CHECK(outcome IN
                       ('allowed',
                        'blocked-no-user',
                        'blocked-inactive',
                        'blocked-insufficient-role')),
  sender_id          INTEGER,                                          -- nullable
  created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_time_outcome
  ON auth_audit(claimed_user_id, created_at, outcome);
```

**Why these indexes**: The repeated-failure detection rule (FR-018) is the only frequent query. It scans the last 10 minutes filtered by user and `outcome LIKE 'blocked-%'`. The composite index makes that a small range scan.

**Why not a foreign key on `claimed_user_id`**: We want to retain audit rows for users that have been deactivated or even deleted (record-keeping). FK with cascade would lose audit data; FK without cascade would block user deletion. Audit retention beats referential integrity for this column.

**Retention**: 90 days, enforced at app start by:

```sql
DELETE FROM auth_audit WHERE created_at < datetime('now','-90 days');
```

## `auth_alert_acks`

```sql
CREATE TABLE IF NOT EXISTS auth_alert_acks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  window_start     TEXT    NOT NULL,
  acknowledged_at  TEXT,                                  -- nullable until ack
  acknowledged_by  INTEGER REFERENCES users(id),
  UNIQUE(user_id, window_start)
);
```

**Why an FK here but not on `auth_audit`**: an alert ack is meaningful only as long as the user exists; if a user is deleted, their alert acks may be deleted too without losing audit context (the underlying audit rows persist).

## Read queries

### Repeated-failure window detection (drives `auth:listAlerts`)

```sql
WITH windows AS (
  SELECT
    claimed_user_id      AS user_id,
    MIN(created_at)      AS window_start,
    COUNT(*)             AS failure_count
  FROM auth_audit
  WHERE created_at >= datetime('now','-10 minutes')
    AND outcome LIKE 'blocked-%'
    AND claimed_user_id IS NOT NULL
  GROUP BY claimed_user_id
  HAVING COUNT(*) >= 5
)
SELECT
  w.user_id,
  u.name           AS user_name,
  w.window_start,
  w.failure_count,
  COALESCE(a.id, NULL)              AS alert_id,
  COALESCE(a.acknowledged_at, NULL) AS acknowledged_at
FROM windows w
JOIN users u ON u.id = w.user_id
LEFT JOIN auth_alert_acks a
  ON a.user_id = w.user_id AND a.window_start = w.window_start;
```

The `auth:listAlerts` handler runs this query, inserts a fresh `auth_alert_acks` row for any window without one, and returns rows where `acknowledged_at IS NULL`.

### Audit list (drives `auth:listAuditEntries`)

```sql
SELECT a.id, a.operation, a.claimed_user_id, a.resolved_user_id,
       a.resolved_role, a.outcome, a.sender_id, a.created_at,
       u.name AS user_name
FROM auth_audit a
LEFT JOIN users u ON u.id = a.claimed_user_id
WHERE (?5 IS NULL OR a.created_at >= ?5)
  AND (?6 IS NULL OR a.created_at <= ?6)
  AND (?1 IS NULL OR a.claimed_user_id = ?1)
  AND (?2 IS NULL OR a.operation = ?2)
  AND (?3 IS NULL OR a.outcome = ?3)
ORDER BY a.created_at DESC
LIMIT ?4 OFFSET ?7;
```

## Write queries

### Insert one decision (called from every privileged guard call)

```sql
INSERT INTO auth_audit
  (operation, claimed_user_id, resolved_user_id, resolved_role, outcome, sender_id)
VALUES (?, ?, ?, ?, ?, ?);
```

### Acknowledge an alert

```sql
UPDATE auth_alert_acks
   SET acknowledged_at = datetime('now','localtime'),
       acknowledged_by = ?
 WHERE id = ?
   AND acknowledged_at IS NULL;
```

### Insert ack-tracking row when first detecting a window

```sql
INSERT OR IGNORE INTO auth_alert_acks (user_id, window_start)
VALUES (?, ?);
```

The `OR IGNORE` covers the race where two concurrent dashboard loads observe the same window simultaneously.

## Performance estimates

| Operation | Estimated cost (local SQLite, WAL) |
|---|---|
| Insert one `auth_audit` row | ~0.3 ms |
| Compose `AuthDecision` (1 SELECT on `users` by id) | ~0.2 ms |
| Repeated-failure detection (10-min window, indexed) | ~0.5 ms |
| Audit list with default `limit=50` | ~1–2 ms |

**Total per privileged call**: ≤ 1 ms in the common path, well under the 100 ms p95 budget (FR-023).
