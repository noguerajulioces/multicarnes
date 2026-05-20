import * as customersQuery from '../db/queries/customers'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerCustomersIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('customers:getAll', getRule('customers:getAll'), (_e, _c, opts: unknown) =>
    customersQuery.getAllCustomers(opts as Parameters<typeof customersQuery.getAllCustomers>[0])
  )
  registerAuthorized('customers:getById', getRule('customers:getById'), (_e, _c, id: number) =>
    customersQuery.getCustomerById(id)
  )
  registerAuthorized('customers:create', getRule('customers:create'), (_e, _c, data: unknown) =>
    customersQuery.createCustomer(data as Parameters<typeof customersQuery.createCustomer>[0])
  )
  registerAuthorized(
    'customers:update',
    getRule('customers:update'),
    (_e, _c, id: number, data: unknown) =>
      customersQuery.updateCustomer(id, data as Parameters<typeof customersQuery.updateCustomer>[1])
  )
  registerAuthorized(
    'customers:addPayment',
    getRule('customers:addPayment'),
    (
      _e,
      ctx,
      customerId: number,
      _userId: number,
      amount: number,
      note: string | undefined,
      affectsCash: boolean
    ) => {
      // ctx.userId is non-null here because the matrix marks this channel as
      // 'privileged' — the guard rejects unauthenticated calls before reaching us.
      if (ctx.userId === null) throw new Error('Sesión inválida.')
      // Attribute the payment to the authenticated caller, not the
      // renderer-supplied userId (_userId), so the customer_payments row and
      // its cash_movements income can never be charged to different users.
      return customersQuery.addCustomerPayment({
        customerId,
        userId: ctx.userId,
        amount,
        note,
        affectsCash,
        callerUserId: ctx.userId
      })
    }
  )
  registerAuthorized(
    'customers:updatePayment',
    getRule('customers:updatePayment'),
    (_e, _c, paymentId: number, amount: number, note?: string | null) =>
      customersQuery.updateCustomerPayment(paymentId, amount, note)
  )
  registerAuthorized(
    'customers:deletePayment',
    getRule('customers:deletePayment'),
    (_e, _c, paymentId: number) => customersQuery.deleteCustomerPayment(paymentId)
  )
  registerAuthorized(
    'customers:getPayments',
    getRule('customers:getPayments'),
    (_e, _c, customerId: number) => customersQuery.getCustomerPayments(customerId)
  )
  registerAuthorized(
    'customers:getSales',
    getRule('customers:getSales'),
    (_e, _c, customerId: number) => customersQuery.getCustomerSales(customerId)
  )
  registerAuthorized('customers:delete', getRule('customers:delete'), (_e, _c, id: number) =>
    customersQuery.deleteCustomer(id)
  )

  return listRegisteredChannels().slice(before)
}
