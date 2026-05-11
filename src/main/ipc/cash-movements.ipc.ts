// 003-cash-movements-history
//
// IPC handlers for the unified cash-movements timeline. The :list channel
// passes the authenticated context into listMovements so cashier scoping is
// enforced server-side; the :void channel passes the actor id through to the
// query for the append-only inverse insert.

import * as cashMovementsQuery from '../db/queries/cash-movements'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'
import type { CashMovementListOpts, Role } from '../../shared/types'

export function registerCashMovementsIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized(
    'cashMovements:list',
    getRule('cashMovements:list'),
    (_event, ctx, opts: CashMovementListOpts = {}) => {
      // ctx.userId / ctx.role are guaranteed to be non-null by the time the
      // privileged guard hands off to us. Reject defensively otherwise.
      if (ctx.userId == null || ctx.role == null) {
        throw new Error('No tenés sesión iniciada para realizar esta acción.')
      }
      return cashMovementsQuery.listMovements(opts, {
        callerUserId: ctx.userId,
        callerRole: ctx.role as Role
      })
    }
  )

  registerAuthorized(
    'cashMovements:void',
    getRule('cashMovements:void'),
    (_event, ctx, originalId: number) => {
      if (ctx.userId == null) {
        throw new Error('No tenés sesión iniciada para realizar esta acción.')
      }
      return cashMovementsQuery.voidMovement(originalId, ctx.userId)
    }
  )

  return listRegisteredChannels().slice(before)
}
