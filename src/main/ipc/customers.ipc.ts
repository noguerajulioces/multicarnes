import { ipcMain } from 'electron'
import * as customersQuery from '../db/queries/customers'

export function registerCustomersIpc(): void {
  ipcMain.handle('customers:getAll', (_, search?: string) => customersQuery.getAllCustomers(search))
  ipcMain.handle('customers:getById', (_, id: number) => customersQuery.getCustomerById(id))
  ipcMain.handle('customers:create', (_, data) => customersQuery.createCustomer(data))
  ipcMain.handle('customers:update', (_, id: number, data) => customersQuery.updateCustomer(id, data))
  ipcMain.handle('customers:addPayment', (_, customerId: number, userId: number, amount: number, note?: string) =>
    customersQuery.addCustomerPayment(customerId, userId, amount, note))
  ipcMain.handle('customers:getPayments', (_, customerId: number) => customersQuery.getCustomerPayments(customerId))
  ipcMain.handle('customers:getSales', (_, customerId: number) => customersQuery.getCustomerSales(customerId))
}
