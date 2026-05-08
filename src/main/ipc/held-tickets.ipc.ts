import * as heldQuery from '../db/queries/held-tickets'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerHeldTicketsIpc(): string[] {
  const before = listRegisteredChannels().length
  registerAuthorized('held:list', getRule('held:list'), () => heldQuery.listHeldTickets())
  registerAuthorized(
    'held:add',
    getRule('held:add'),
    (_e, _c, data: { id: string; label: string; payload: string; discount: number }) =>
      heldQuery.addHeldTicket(data)
  )
  registerAuthorized('held:remove', getRule('held:remove'), (_e, _c, id: string) =>
    heldQuery.removeHeldTicket(id)
  )
  registerAuthorized('held:clear', getRule('held:clear'), () => heldQuery.clearHeldTickets())
  return listRegisteredChannels().slice(before)
}
