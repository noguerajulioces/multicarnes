import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule, matrixSummary } from '../auth/matrix'
import * as alerts from '../auth/alerts'
import * as authQuery from '../db/queries/auth'
import { isRecoveryMode } from '../auth/recovery'
import type { AuthAuditFilters } from '../../shared/auth-types'

export function registerAuthIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('auth:matrixSummary', getRule('auth:matrixSummary'), () => matrixSummary())

  registerAuthorized(
    'auth:listAuditEntries',
    getRule('auth:listAuditEntries'),
    (_e, _c, filters?: AuthAuditFilters) => authQuery.listAudit(filters ?? {})
  )

  registerAuthorized('auth:listAlerts', getRule('auth:listAlerts'), () => alerts.getOpenAlerts())

  registerAuthorized(
    'auth:acknowledgeAlert',
    getRule('auth:acknowledgeAlert'),
    (_e, ctx, alertId: number) => {
      if (ctx.userId == null) {
        throw new Error('No se pudo identificar al usuario para el ack.')
      }
      alerts.acknowledge(alertId, ctx.userId)
      return { ok: true as const }
    }
  )

  registerAuthorized('auth:recoveryNeeded', getRule('auth:recoveryNeeded'), () => ({
    recoveryNeeded: isRecoveryMode()
  }))

  return listRegisteredChannels().slice(before)
}
