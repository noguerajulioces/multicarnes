// Orchestration layer for the repeated-failure alert lifecycle.
// Pure orchestration; all DB access lives in src/main/db/queries/auth.ts.

import * as authQuery from '../db/queries/auth'
import type { AuthAlert } from '../../shared/auth-types'

export function getOpenAlerts(): AuthAlert[] {
  return authQuery.detectAndPersistAlertWindows()
}

export function acknowledge(alertId: number, ackByUserId: number): void {
  authQuery.acknowledgeAlert(alertId, ackByUserId)
}
