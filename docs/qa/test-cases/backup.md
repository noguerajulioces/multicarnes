# Backup & restore — test cases

Module: `src/renderer/src/modules/backup`
Prefix: `BAK`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| BAK-001 | Manual backup — file is created                | P1       |
| BAK-002 | Backup contains all current data               | P1       |
| BAK-003 | Restore from backup repopulates data           | P1       |
| BAK-004 | Restore overwrites current data (with warning) | P1       |
| BAK-005 | Restore from corrupted file fails safely       | P1       |
| BAK-006 | Scheduled / automatic backup (if configured)   | P2       |
| BAK-007 | Backup file path / name is sensible            | P3       |

---

## BAK-001 — Create backup

**Steps:**

1. Open Backup.
2. Choose a destination folder.
3. Run **Backup now**.

**Expected:** A file is created at the destination with a clear name (e.g. `pos-multicarnes-backup-YYYYMMDD-HHmm.db`).

---

## BAK-002 — Backup contains data

**Preconditions:** Known products, customers, sales exist.
**Steps:**

1. Inspect the backup file (open with a SQLite tool, or use BAK-003).

**Expected:** All current entities are present and counts match the live DB.

---

## BAK-003 — Restore

**Preconditions:** A valid backup file. App ideally on a different machine or after wiping the user-data folder.
**Steps:**

1. Open Backup → **Restore**.
2. Pick the backup file.
3. Confirm the warning.
4. Restart the app if prompted.

**Expected:** After restart, products, customers, sales, sessions, users all match the source state. Login works with the source credentials.

---

## BAK-004 — Restore warning

**Steps:**

1. With existing data in the app, run a restore.

**Expected:** A clear warning is shown: existing data will be overwritten / replaced. Restore only proceeds on explicit confirm.

---

## BAK-005 — Corrupted backup

**Steps:**

1. Make a copy of a backup, truncate or modify it, then try to restore.

**Expected:** Restore fails with a clear error. Existing data is unchanged. App is still usable.

---

## BAK-006 — Scheduled backup

**Preconditions:** Auto-backup is enabled in configuration.
**Steps:**

1. Set the schedule to a near time, leave the app running.

**Expected:** Backup file is produced at the scheduled time without user action. Failure (e.g. disk full) is logged / surfaced to the admin.

---

## BAK-007 — Filename sanity

**Expected:** Backup files include a timestamp, do not collide on rapid successive runs, and are placed where the user told them to go.
