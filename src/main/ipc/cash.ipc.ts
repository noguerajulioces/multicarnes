import * as cashQuery from '../db/queries/cash'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerCashIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized(
    'cash:open',
    getRule('cash:open'),
    (_event, _ctx, userId: number, openingAmount: number) =>
      cashQuery.openCashRegister(userId, openingAmount)
  )

  registerAuthorized('cash:getCurrent', getRule('cash:getCurrent'), () =>
    cashQuery.getCurrentCashRegister()
  )

  // 004-logout-cash-close: logout guard reads the caller's own open register,
  // if any. User id comes from ctx (the authenticated session), never from
  // the client, so callers cannot probe other users' registers.
  registerAuthorized('cash:getMyOpenRegister', getRule('cash:getMyOpenRegister'), (_event, ctx) => {
    // Defensive: the privileged guard already rejects unauthenticated callers,
    // so ctx.userId should be set here. Belt-and-suspenders for the type.
    if (ctx.userId == null) return null
    return cashQuery.getOpenCashRegisterByUserId(ctx.userId)
  })

  // T028: cashier-self exception. Matrix lets all 3 roles through; the handler
  // tightens to "admin/supervisor OR cashier-who-opened-this-register".
  registerAuthorized(
    'cash:close',
    getRule('cash:close'),
    (
      _event,
      ctx,
      id: number,
      closingAmount: number,
      notes?: string,
      userId?: number,
      keptAmount?: number | null
    ) => {
      if (ctx.role !== 'admin' && ctx.role !== 'supervisor') {
        const register = cashQuery.getCashRegisterById(id) as { user_id: number } | undefined
        if (!register || register.user_id !== ctx.userId) {
          throw new Error('Solo podés cerrar la caja que abriste vos.')
        }
      }
      // 010-cash-float-close: optional 5th arg — the cash left in the drawer as
      // the float for the next shift. Validated in the query layer.
      return cashQuery.closeCashRegister(
        id,
        closingAmount,
        notes,
        userId ?? ctx.userId ?? undefined,
        keptAmount
      )
    }
  )

  // 010-cash-float-close: amounts of the most recent close, so the apertura
  // screen can propose the float that stayed in the drawer. Exposes no operator
  // data, hence open to every role that can open a register.
  registerAuthorized('cash:getLastClosed', getRule('cash:getLastClosed'), () =>
    cashQuery.getLastClosedCashRegister()
  )

  // Cashier-self exception (mirrors cash:close at lines 21-38).
  // Matrix lets all 3 roles through; the handler tightens to
  // "admin/supervisor OR cashier-who-opened-this-register".
  registerAuthorized(
    'cash:addMovement',
    getRule('cash:addMovement'),
    (
      _event,
      ctx,
      registerId: number,
      userId: number,
      type: string,
      amount: number,
      description: string
    ) => {
      if (ctx.role !== 'admin' && ctx.role !== 'supervisor') {
        const register = cashQuery.getCashRegisterById(registerId) as
          | { user_id: number }
          | undefined
        if (!register || register.user_id !== ctx.userId) {
          throw new Error('Solo podés registrar movimientos en la caja que abriste vos.')
        }
      }
      return cashQuery.addCashMovement(registerId, userId, type, amount, description)
    }
  )

  registerAuthorized(
    'cash:getMovements',
    getRule('cash:getMovements'),
    (_event, _ctx, registerId: number, opts?: { page: number; perPage: number }) =>
      opts ? cashQuery.getCashMovements(registerId, opts) : cashQuery.getCashMovements(registerId)
  )

  registerAuthorized(
    'cash:getSummary',
    getRule('cash:getSummary'),
    (_event, _ctx, registerId: number) => cashQuery.getCashRegisterSummary(registerId)
  )

  registerAuthorized('cash:getAll', getRule('cash:getAll'), () => cashQuery.getAllCashRegisters())

  return listRegisteredChannels().slice(before)
}
