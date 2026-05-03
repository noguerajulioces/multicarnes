import { ipcMain } from 'electron'
import * as cashQuery from '../db/queries/cash'

export function registerCashIpc(): void {
  ipcMain.handle('cash:open', (_, userId: number, openingAmount: number) =>
    cashQuery.openCashRegister(userId, openingAmount)
  )
  ipcMain.handle('cash:getCurrent', () => cashQuery.getCurrentCashRegister())
  ipcMain.handle('cash:close', (_, id: number, closingAmount: number, notes?: string) =>
    cashQuery.closeCashRegister(id, closingAmount, notes)
  )
  ipcMain.handle(
    'cash:addMovement',
    (_, registerId: number, userId: number, type: string, amount: number, description: string) =>
      cashQuery.addCashMovement(registerId, userId, type, amount, description)
  )
  ipcMain.handle('cash:getMovements', (_, registerId: number) =>
    cashQuery.getCashMovements(registerId)
  )
  ipcMain.handle('cash:getSummary', (_, registerId: number) =>
    cashQuery.getCashRegisterSummary(registerId)
  )
  ipcMain.handle('cash:getAll', () => cashQuery.getAllCashRegisters())
}
