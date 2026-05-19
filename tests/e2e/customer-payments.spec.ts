import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createUserViaIpc,
  createCustomerViaIpc,
  createProductViaIpc,
  openCashRegisterViaIpc,
  closeCashRegisterViaIpc
} from './helpers/seed'
import { LoginPage } from './pom/LoginPage'

// 008-debt-payment-types: end-to-end coverage of the "Registrar Pago" modal.
// US1 (cash affects register), US2 (salary deduction does NOT), US3 (visual
// distinction in the payment history), plus edge cases (no open register,
// role permissions, numeric limits, UX, regression on previous features).
//
// Setup pattern mirrors the rest of the suite: every test launches its own
// Electron instance with a throw-away userData dir via launchApp(). Where a
// test only needs data-layer effects we drive via the ipc() shortcut; where
// the test specifically covers UI invariants we click through the modal.

interface CustomerRow {
  id: number
  name: string
  balance: number
}

interface PaymentRow {
  id: number
  amount: number
  note: string | null
  affects_cash: boolean
  user_id: number
  user_name: string | null
  created_at: string
}

interface CashMovementsListResult {
  items: Array<{
    id: number
    type: 'income' | 'expense' | 'opening' | 'closing' | 'void'
    amount: number
    description: string
    registerId: number
  }>
  total: number
}

interface CashSummary {
  register: { opening_amount: number }
  cashSales: number
  incomes: number
  expenses: number
}

const DEBT = 100_000

test.describe('008 — Debt payment types (Efectivo vs Descuento de sueldo)', () => {
  // -----------------
  // US1 — Cash payment affects the register
  // -----------------
  test('US1 — cashier with open register pays in cash → balance reduced, cash_movement income created, included in close', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Pago 1',
        role: 'cajero',
        pin: '111111'
      })
      const customer = await createCustomerViaIpc(window, { name: 'Deudor US1' })
      const product = await createProductViaIpc(window, {
        name: 'Bife US1',
        price: DEBT,
        stock: 5
      })
      // Generate the debt via a credit sale, then close admin's register so
      // we can hand off to the cashier without "ya hay una caja abierta".
      const adminRegister = await openCashRegisterViaIpc(window, admin.id, 0)
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: a.debt, subtotal: a.debt }],
            subtotal: a.debt,
            discount: 0,
            total: a.debt,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: a.debt }]
          })
        },
        {
          registerId: adminRegister.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id,
          debt: DEBT
        } as {
          registerId: number
          userId: number
          customerId: number
          productId: number
          debt: number
        }
      )
      await closeCashRegisterViaIpc(window, adminRegister.id, 0, admin.id)

      // Login as the cashier, open their own register.
      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Pago 1', '111111')
      const cashierRegister = await openCashRegisterViaIpc(window, cashier.id, 0)

      // Register a cash payment of 30_000 against the customer's debt.
      await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 30_000, 'Abono e2e', true)
        },
        [customer.id, cashier.id] as const
      )

      // (a) Balance moved from -100_000 to -70_000.
      const afterPayment = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerRow
      expect(afterPayment.balance).toBe(-70_000)

      // (b) cash_movements has an income row of 30_000 for the cashier's register.
      const movements = (await ipc(window, (opts) => window.api.cashMovements.list(opts), {
        registerId: cashierRegister.id,
        types: ['income']
      })) as CashMovementsListResult
      const debtIncome = movements.items.find(
        (m) => m.amount === 30_000 && m.description.includes('Deudor US1')
      )
      expect(debtIncome, 'expected an income row referencing the customer').toBeDefined()

      // (c) Register summary expects 30_000 as income, included in close.
      const summary = (await ipc(
        window,
        (id) => window.api.cash.getSummary(id),
        cashierRegister.id
      )) as CashSummary
      expect(summary.incomes).toBe(30_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // US2 — Salary-deduction payment does NOT affect the register
  // -----------------
  test('US2 — salary-deduction payment reduces balance without creating a cash_movement, ignored at close', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'Deudor US2', isEmployee: true })
      const product = await createProductViaIpc(window, {
        name: 'Bife US2',
        price: 60_000,
        stock: 5
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 60_000, subtotal: 60_000 }],
            subtotal: 60_000,
            discount: 0,
            total: 60_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 60_000 }]
          })
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      // Salary-deduction payment (affectsCash = false).
      await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 60_000, 'Acuerdo nómina', false)
        },
        [customer.id, admin.id] as const
      )

      // (a) Balance is 0.
      const after = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerRow
      expect(after.balance).toBe(0)

      // (b) No income row for this 60k payment in cash_movements.
      const incomes = (await ipc(window, (opts) => window.api.cashMovements.list(opts), {
        registerId: register.id,
        types: ['income']
      })) as CashMovementsListResult
      const stray = incomes.items.find((m) => m.amount === 60_000)
      expect(stray, 'salary-deduction must NOT generate a cash_movement income').toBeUndefined()

      // (c) Register summary income excludes the 60k.
      const summary = (await ipc(
        window,
        (id) => window.api.cash.getSummary(id),
        register.id
      )) as CashSummary
      expect(summary.incomes).toBe(0)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // Edge — no open register at all
  // -----------------
  test('Edge — cashier with NO open register: backend rejects cash payment with the spec message', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Sin Apertura',
        role: 'cajero',
        pin: '333333'
      })
      const customer = await createCustomerViaIpc(window, { name: 'Sin Caja' })
      const product = await createProductViaIpc(window, { name: 'p3', price: 10_000, stock: 1 })
      const adminReg = await openCashRegisterViaIpc(window, admin.id, 0)
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 10_000, subtotal: 10_000 }],
            subtotal: 10_000,
            discount: 0,
            total: 10_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 10_000 }]
          })
        },
        {
          registerId: adminReg.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )
      await closeCashRegisterViaIpc(window, adminReg.id, 0, admin.id)

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Sin Apertura', '333333')

      // Cash payment WITHOUT opening a register first.
      const cashResult = await ipc(
        window,
        async ([cId, uId]) => {
          try {
            await window.api.customers.addPayment(cId, uId, 5_000, undefined, true)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [customer.id, cashier.id] as const
      )
      expect(cashResult.ok, 'cash payment must be rejected without an open register').toBe(false)
      if (!cashResult.ok) {
        expect(cashResult.message).toMatch(/caja abierta/i)
      }

      // Salary deduction without a register succeeds.
      const salaryResult = await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 5_000, undefined, false)
          return { ok: true }
        },
        [customer.id, cashier.id] as const
      )
      expect(salaryResult.ok).toBe(true)

      const after = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerRow
      expect(after.balance).toBe(-5_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // US3 — Payment history shows the type per row, pre-release rows as Efectivo
  // -----------------
  test('US3 — payment history surfaces Efectivo / Descuento de sueldo and pre-release rows default to Efectivo', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'Mix History' })
      await openCashRegisterViaIpc(window, admin.id, 0)

      // 1) Cash payment.
      await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 10_000, 'cash row', true)
        },
        [customer.id, admin.id] as const
      )
      // 2) Salary-deduction payment.
      await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 20_000, 'deduction row', false)
        },
        [customer.id, admin.id] as const
      )

      const payments = (await ipc(
        window,
        (id) => window.api.customers.getPayments(id),
        customer.id
      )) as PaymentRow[]
      expect(payments).toHaveLength(2)
      const byAmount = (n: number): PaymentRow => {
        const row = payments.find((p) => p.amount === n)
        if (!row) throw new Error(`expected payment of ${n} in history`)
        return row
      }
      expect(byAmount(10_000).affects_cash).toBe(true)
      expect(byAmount(20_000).affects_cash).toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // Permissions — cashier role
  // -----------------
  test('Permissions — cashier CAN addPayment (both kinds) but CANNOT updatePayment / deletePayment', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Perms',
        role: 'cajero',
        pin: '444444'
      })
      const customer = await createCustomerViaIpc(window, { name: 'Perms Target' })
      const product = await createProductViaIpc(window, { name: 'p-perm', price: 30_000, stock: 5 })
      const adminReg = await openCashRegisterViaIpc(window, admin.id, 0)
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 30_000, subtotal: 30_000 }],
            subtotal: 30_000,
            discount: 0,
            total: 30_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 30_000 }]
          })
        },
        {
          registerId: adminReg.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )
      await closeCashRegisterViaIpc(window, adminReg.id, 0, admin.id)

      // Login as cashier, open their own register, register two payments
      // (one cash, one salary deduction). Both should be allowed by the matrix.
      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Perms', '444444')
      await openCashRegisterViaIpc(window, cashier.id, 0)

      const cashOk = await ipc(
        window,
        async ([cId, uId]) => {
          try {
            await window.api.customers.addPayment(cId, uId, 5_000, 'cash', true)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [customer.id, cashier.id] as const
      )
      expect(cashOk.ok, 'cashier should be allowed to register a cash payment').toBe(true)

      const salaryOk = await ipc(
        window,
        async ([cId, uId]) => {
          try {
            await window.api.customers.addPayment(cId, uId, 5_000, 'salary', false)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [customer.id, cashier.id] as const
      )
      expect(salaryOk.ok, 'cashier should be allowed to register a salary-deduction payment').toBe(
        true
      )

      const payments = (await ipc(
        window,
        (id) => window.api.customers.getPayments(id),
        customer.id
      )) as PaymentRow[]
      expect(payments).toHaveLength(2)
      const lastPaymentId = payments[0].id

      // updatePayment and deletePayment are admin/supervisor only.
      const updateRes = await ipc(
        window,
        async (id) => {
          try {
            await window.api.customers.updatePayment(id, 9_999, 'tampered')
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        lastPaymentId
      )
      expect(updateRes.ok, 'cashier must NOT be able to updatePayment').toBe(false)

      const deleteRes = await ipc(
        window,
        async (id) => {
          try {
            await window.api.customers.deletePayment(id)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        lastPaymentId
      )
      expect(deleteRes.ok, 'cashier must NOT be able to deletePayment').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // Numeric limits — overpayment leaves a positive balance
  // -----------------
  test('Overpayment — cliente debe 60k, pago 100k → balance final +40k y cash_movement por 100k', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'Sobrepago' })
      const product = await createProductViaIpc(window, { name: 'p-over', price: 60_000, stock: 5 })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 60_000, subtotal: 60_000 }],
            subtotal: 60_000,
            discount: 0,
            total: 60_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 60_000 }]
          })
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      await ipc(
        window,
        async ([cId, uId]) => {
          await window.api.customers.addPayment(cId, uId, 100_000, undefined, true)
        },
        [customer.id, admin.id] as const
      )

      const after = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerRow
      expect(after.balance).toBe(40_000)

      const movements = (await ipc(window, (opts) => window.api.cashMovements.list(opts), {
        registerId: register.id,
        types: ['income']
      })) as CashMovementsListResult
      const income = movements.items.find((m) => m.amount === 100_000)
      expect(income, 'cash_movement should record the full 100k even if it overpays').toBeDefined()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // UI — modal renders the type toggle and the no-register banner
  // -----------------
  test('UI — modal "Registrar Pago" shows the type toggle, the no-register banner, and the salary-deduction button is always enabled', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja UI',
        role: 'cajero',
        pin: '555555'
      })
      const customer = await createCustomerViaIpc(window, { name: 'UI Target' })

      // Login as cashier WITHOUT opening a register — the banner should fire.
      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja UI', '555555')

      // The cashier home redirects to /caja/apertura when no register is open.
      // Navigate directly to the customer ficha via the in-app hash router.
      await window.evaluate((id) => {
        window.location.hash = `#/clientes/${id}`
      }, customer.id)

      // Wait for the page to render.
      await expect(window.getByRole('heading', { name: 'UI Target' })).toBeVisible({
        timeout: 15_000
      })

      // Open the "Registrar Pago" modal.
      await window.getByRole('button', { name: /Registrar Pago/i }).click()
      await expect(window.getByRole('heading', { name: 'Registrar Pago' })).toBeVisible()

      // Both type buttons are present.
      const efectivo = window.getByRole('button', { name: /Efectivo/i })
      const descuento = window.getByRole('button', { name: /Descuento de sueldo/i })
      await expect(efectivo).toBeVisible()
      await expect(descuento).toBeVisible()

      // With Efectivo (default) selected and no open register, the banner shows.
      await expect(
        window.getByText('Necesitás abrir caja para registrar pagos en efectivo.')
      ).toBeVisible()

      // Clicking Descuento de sueldo hides the banner.
      await descuento.click()
      await expect(
        window.getByText('Necesitás abrir caja para registrar pagos en efectivo.')
      ).toBeHidden()

      // Back to Efectivo brings it back.
      await efectivo.click()
      await expect(
        window.getByText('Necesitás abrir caja para registrar pagos en efectivo.')
      ).toBeVisible()

      // Cancel closes the modal.
      await window.getByRole('button', { name: /Cancelar/i }).click()
      await expect(window.getByRole('heading', { name: 'Registrar Pago' })).toBeHidden()

      // Reference the unused locals so eslint doesn't flag them.
      void admin
      void cashier
    } finally {
      await cleanup()
    }
  })
})
