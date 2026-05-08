import * as purchasesQuery from '../db/queries/purchases'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerPurchasesIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('suppliers:getAll', getRule('suppliers:getAll'), (_e, _c, opts: unknown) =>
    purchasesQuery.getAllSuppliers(opts as Parameters<typeof purchasesQuery.getAllSuppliers>[0])
  )
  registerAuthorized('suppliers:getById', getRule('suppliers:getById'), (_e, _c, id: number) =>
    purchasesQuery.getSupplierById(id)
  )
  registerAuthorized('suppliers:create', getRule('suppliers:create'), (_e, _c, data: unknown) =>
    purchasesQuery.createSupplier(data as Parameters<typeof purchasesQuery.createSupplier>[0])
  )
  registerAuthorized(
    'suppliers:update',
    getRule('suppliers:update'),
    (_e, _c, id: number, data: unknown) =>
      purchasesQuery.updateSupplier(
        id,
        data as Parameters<typeof purchasesQuery.updateSupplier>[1]
      )
  )
  registerAuthorized('purchases:getAll', getRule('purchases:getAll'), (_e, _c, opts: unknown) =>
    purchasesQuery.getAllPurchaseOrders(
      opts as Parameters<typeof purchasesQuery.getAllPurchaseOrders>[0]
    )
  )
  registerAuthorized('purchases:getById', getRule('purchases:getById'), (_e, _c, id: number) =>
    purchasesQuery.getPurchaseOrderById(id)
  )
  registerAuthorized('purchases:create', getRule('purchases:create'), (_e, _c, data: unknown) =>
    purchasesQuery.createPurchaseOrder(
      data as Parameters<typeof purchasesQuery.createPurchaseOrder>[0]
    )
  )
  registerAuthorized('purchases:receive', getRule('purchases:receive'), (_e, _c, id: number) =>
    purchasesQuery.receivePurchaseOrder(id)
  )
  registerAuthorized('purchases:cancel', getRule('purchases:cancel'), (_e, _c, id: number) =>
    purchasesQuery.cancelPurchaseOrder(id)
  )

  return listRegisteredChannels().slice(before)
}
