import { ipcMain } from 'electron'
import * as heldQuery from '../db/queries/held-tickets'

export function registerHeldTicketsIpc(): void {
  ipcMain.handle('held:list', () => heldQuery.listHeldTickets())
  ipcMain.handle(
    'held:add',
    (_, data: { id: string; label: string; payload: string; discount: number }) =>
      heldQuery.addHeldTicket(data)
  )
  ipcMain.handle('held:remove', (_, id: string) => heldQuery.removeHeldTicket(id))
  ipcMain.handle('held:clear', () => heldQuery.clearHeldTickets())
}
