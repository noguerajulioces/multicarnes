import { ipcMain } from 'electron'
import * as purchasesQuery from '../db/queries/purchases'

export function registerPurchasesIpc(): void {
  ipcMain.handle('suppliers:getAll', (_, opts) => purchasesQuery.getAllSuppliers(opts))
  ipcMain.handle('suppliers:getById', (_, id: number) => purchasesQuery.getSupplierById(id))
  ipcMain.handle('suppliers:create', (_, data) => purchasesQuery.createSupplier(data))
  ipcMain.handle('suppliers:update', (_, id: number, data) => purchasesQuery.updateSupplier(id, data))
  ipcMain.handle('purchases:getAll', (_, opts) => purchasesQuery.getAllPurchaseOrders(opts))
  ipcMain.handle('purchases:getById', (_, id: number) => purchasesQuery.getPurchaseOrderById(id))
  ipcMain.handle('purchases:create', (_, data) => purchasesQuery.createPurchaseOrder(data))
  ipcMain.handle('purchases:receive', (_, id: number) => purchasesQuery.receivePurchaseOrder(id))
  ipcMain.handle('purchases:cancel', (_, id: number) => purchasesQuery.cancelPurchaseOrder(id))
}
