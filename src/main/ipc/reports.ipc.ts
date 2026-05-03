import { ipcMain } from 'electron'
import * as reportsQuery from '../db/queries/reports'

export function registerReportsIpc(): void {
  ipcMain.handle(
    'reports:salesByPeriod',
    (_, from: string, to: string, method?: string, userId?: number) =>
      reportsQuery.salesByPeriod(from, to, method, userId)
  )
  ipcMain.handle('reports:topProducts', (_, from: string, to: string, categoryId?: number) =>
    reportsQuery.topProducts(from, to, categoryId)
  )
  ipcMain.handle('reports:profitMargin', () => reportsQuery.profitMargin())
  ipcMain.handle('reports:stockMovements', (_, from: string, to: string, productId?: number) =>
    reportsQuery.stockMovements(from, to, productId)
  )
  ipcMain.handle('reports:cashRegisters', () => reportsQuery.cashRegisterReport())
  ipcMain.handle('reports:pendingCredits', () => reportsQuery.pendingCredits())
  ipcMain.handle('reports:salesSummary', (_, from: string, to: string) =>
    reportsQuery.salesSummary(from, to)
  )
  ipcMain.handle('reports:salesComparison', (_, from: string, to: string) =>
    reportsQuery.salesComparison(from, to)
  )
}
