import * as heldQuery from '../db/queries/held-tickets'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerHeldTicketsIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('held:list', getRule('held:list'), (_e, ctx) =>
    heldQuery.listHeldTickets(ctx.userId!)
  )

  registerAuthorized(
    'held:add',
    getRule('held:add'),
    (_e, ctx, data: { id: string; label: string; payload: string; discount: number }) =>
      heldQuery.addHeldTicket({ ...data, userId: ctx.userId! })
  )

  registerAuthorized('held:remove', getRule('held:remove'), (_e, ctx, id: string) =>
    heldQuery.removeHeldTicket(id, ctx.userId!)
  )

  registerAuthorized('held:clear', getRule('held:clear'), (_e, ctx) =>
    heldQuery.clearHeldTickets(ctx.userId!)
  )

  return listRegisteredChannels().slice(before)
}
