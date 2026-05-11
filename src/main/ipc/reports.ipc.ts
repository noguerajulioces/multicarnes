import * as reportsQuery from '../db/queries/reports'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerReportsIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized(
    'reports:salesByPeriod',
    getRule('reports:salesByPeriod'),
    (_e, _c, from: string, to: string, method?: string, userId?: number) =>
      reportsQuery.salesByPeriod(from, to, method, userId)
  )
  registerAuthorized(
    'reports:topProducts',
    getRule('reports:topProducts'),
    (_e, _c, from: string, to: string, categoryId?: number) =>
      reportsQuery.topProducts(from, to, categoryId)
  )
  registerAuthorized('reports:profitMargin', getRule('reports:profitMargin'), () =>
    reportsQuery.profitMargin()
  )
  registerAuthorized(
    'reports:stockMovements',
    getRule('reports:stockMovements'),
    (_e, _c, from: string, to: string, productId?: number) =>
      reportsQuery.stockMovements(from, to, productId)
  )
  registerAuthorized('reports:cashRegisters', getRule('reports:cashRegisters'), () =>
    reportsQuery.cashRegisterReport()
  )
  registerAuthorized('reports:pendingCredits', getRule('reports:pendingCredits'), () =>
    reportsQuery.pendingCredits()
  )
  registerAuthorized(
    'reports:salesSummary',
    getRule('reports:salesSummary'),
    (_e, _c, from: string, to: string) => reportsQuery.salesSummary(from, to)
  )
  registerAuthorized(
    'reports:salesComparison',
    getRule('reports:salesComparison'),
    (_e, _c, from: string, to: string) => reportsQuery.salesComparison(from, to)
  )

  return listRegisteredChannels().slice(before)
}
