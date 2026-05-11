import * as salesQuery from '../db/queries/sales'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerSalesIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('sales:create', getRule('sales:create'), (_event, _ctx, data: unknown) =>
    salesQuery.createSale(data as Parameters<typeof salesQuery.createSale>[0])
  )
  registerAuthorized('sales:getAll', getRule('sales:getAll'), (_event, _ctx, opts: unknown) =>
    salesQuery.getAllSales(opts as Parameters<typeof salesQuery.getAllSales>[0])
  )
  registerAuthorized('sales:getById', getRule('sales:getById'), (_event, _ctx, id: number) =>
    salesQuery.getSaleById(id)
  )
  registerAuthorized(
    'sales:getRecent',
    getRule('sales:getRecent'),
    (_event, _ctx, limit?: number) => salesQuery.getRecentSales(limit)
  )
  registerAuthorized(
    'sales:getByRegister',
    getRule('sales:getByRegister'),
    (_event, _ctx, registerId: number) => salesQuery.getSalesByRegister(registerId)
  )
  registerAuthorized(
    'sales:cancel',
    getRule('sales:cancel'),
    (_event, ctx, id: number, options?: { refundMixedCredit?: boolean }) =>
      salesQuery.cancelSale(id, ctx.userId!, options)
  )
  registerAuthorized('sales:dayTotal', getRule('sales:dayTotal'), () =>
    salesQuery.getDaySalesTotal()
  )

  return listRegisteredChannels().slice(before)
}
