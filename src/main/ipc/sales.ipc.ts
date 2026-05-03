import { ipcMain } from 'electron'
import * as salesQuery from '../db/queries/sales'

export function registerSalesIpc(): void {
  ipcMain.handle('sales:create', (_, data) => salesQuery.createSale(data))
  ipcMain.handle('sales:getById', (_, id: number) => salesQuery.getSaleById(id))
  ipcMain.handle('sales:getRecent', (_, limit?: number) => salesQuery.getRecentSales(limit))
  ipcMain.handle('sales:getByRegister', (_, registerId: number) =>
    salesQuery.getSalesByRegister(registerId)
  )
  ipcMain.handle('sales:cancel', (_, id: number, userId: number) =>
    salesQuery.cancelSale(id, userId)
  )
  ipcMain.handle('sales:dayTotal', () => salesQuery.getDaySalesTotal())
}
