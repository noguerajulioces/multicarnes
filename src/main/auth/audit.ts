// Decision recorder. Persists every guard outcome to auth_audit.

import * as authQuery from '../db/queries/auth'
import type { AuthOutcome, Role } from '../../shared/auth-types'

export interface AuthDecision {
  operation: string
  senderId: number | null
  claimedUserId: number | null
  resolvedUserId: number | null
  resolvedActive: boolean
  resolvedRole: Role | null
  outcome: AuthOutcome
  decidedAt: string
}

export function recordDecision(decision: AuthDecision): void {
  try {
    authQuery.insertAudit({
      operation: decision.operation,
      claimedUserId: decision.claimedUserId,
      resolvedUserId: decision.resolvedUserId,
      resolvedRole: decision.resolvedRole,
      outcome: decision.outcome,
      senderId: decision.senderId
    })
  } catch (err) {
    // Audit write failures must not block the call. Surface in console; the
    // call's outcome is already determined.
    console.error('[auth] audit insert failed:', err)
  }
}
