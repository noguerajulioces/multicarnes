// Recovery mode detection (FR-020 / FR-021).
//
// "Recovery mode" is true when the database has zero active admins. While
// recovery mode is on, the matrix's recoveryOnly modifier flips users:create
// from admin-only to public, allowing the first admin to be created. Once
// the first admin lands, refreshRecoveryMode() should be called to close it.

import { getDb } from '../db'

let recoveryMode = false

export function refreshRecoveryMode(): boolean {
  try {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS c FROM users WHERE active = 1 AND role = 'admin'")
      .get() as { c: number }
    recoveryMode = row.c === 0
  } catch {
    // Pre-DB initialization or schema not ready — fail open by default so the
    // app can boot the first time on a fresh install.
    recoveryMode = true
  }
  return recoveryMode
}

export function isRecoveryMode(): boolean {
  return recoveryMode
}
