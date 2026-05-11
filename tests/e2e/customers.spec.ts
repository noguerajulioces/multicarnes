import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createUserViaIpc,
  createCustomerViaIpc,
  createProductViaIpc,
  openCashRegisterViaIpc
} from './helpers/seed'
import { LoginPage } from './pom/LoginPage'
import { SidebarNav } from './pom/SidebarNav'

interface CustomerFull {
  id: number
  name: string
  balance: number
  is_employee: number
}

interface CustomerPaymentRow {
  id: number
  amount: number
  note: string | null
}

test.describe('Customers', () => {
  // -----------------
  // customer-8-1 (P2) — create customer with name only
  // -----------------
  test('customer-8-1 — IPC creates customer with just a name', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const created = await createCustomerViaIpc(window, { name: 'Solo Nombre' })
      expect(created.id).toBeGreaterThan(0)
      expect(created.name).toBe('Solo Nombre')
      expect(created.balance).toBe(0)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // customer-8-2 (P2) — create employee customer
  // -----------------
  test('customer-8-2 — IPC creates employee customer with is_employee = 1', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const created = await createCustomerViaIpc(window, {
        name: 'Empleado',
        isEmployee: true
      })
      const full = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        created.id
      )) as CustomerFull
      expect(full.is_employee).toBe(1)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // customer-8-3 (P2) — cannot delete customer with sales history
  // -----------------
  test('customer-8-3 — customers:delete rejects when the customer has at least one sale', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'No-Delete' })
      const product = await createProductViaIpc(window, {
        name: 'For-sale',
        price: 10_000,
        stock: 5
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // Generate one credit sale so the customer has history.
      await window.evaluate(
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [
              { productId: a.productId, quantity: 1, unitPrice: 10_000, subtotal: 10_000 }
            ],
            subtotal: 10_000,
            discount: 0,
            total: 10_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 10_000 }]
          })
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      const result = (await ipc(
        window,
        (id) => window.api.customers.delete(id),
        customer.id
      )) as { ok: boolean; error?: string }
      expect(result.ok, 'delete must be rejected when customer has sales').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // customer-8-4 (P2) — payment decreases the debt
  // -----------------
  test('customer-8-4 — addPayment reduces customer balance (debt) by the paid amount', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'Owes Money' })
      const product = await createProductViaIpc(window, {
        name: 'Owed product',
        price: 100_000,
        stock: 10
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // Customer takes a credit sale of 100k.
      await window.evaluate(
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [
              { productId: a.productId, quantity: 1, unitPrice: 100_000, subtotal: 100_000 }
            ],
            subtotal: 100_000,
            discount: 0,
            total: 100_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 100_000 }]
          })
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      const beforePayment = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      expect(Math.abs(beforePayment.balance)).toBe(100_000)

      // Pay 40k.
      await ipc(
        window,
        async ([customerId, userId]) => {
          await window.api.customers.addPayment(customerId, userId, 40_000, 'Abono')
        },
        [customer.id, admin.id] as const
      )

      const afterPayment = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      expect(Math.abs(afterPayment.balance)).toBe(60_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // customer-8-5 (P3) — delete payment refunds the debt back to the original amount
  // -----------------
  test('customer-8-5 — deletePayment reverses the balance change', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const customer = await createCustomerViaIpc(window, { name: 'Refund Customer' })
      const product = await createProductViaIpc(window, {
        name: 'Refund product',
        price: 50_000,
        stock: 10
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      await window.evaluate(
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [
              { productId: a.productId, quantity: 1, unitPrice: 50_000, subtotal: 50_000 }
            ],
            subtotal: 50_000,
            discount: 0,
            total: 50_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 50_000 }]
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
          await window.api.customers.addPayment(cId, uId, 20_000, 'partial')
        },
        [customer.id, admin.id] as const
      )

      // Read back the payment row.
      const payments = (await ipc(
        window,
        (id) => window.api.customers.getPayments(id),
        customer.id
      )) as CustomerPaymentRow[]
      expect(payments.length).toBe(1)
      const paymentId = payments[0].id

      const beforeDelete = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      expect(Math.abs(beforeDelete.balance)).toBe(30_000)

      // Delete the payment.
      await ipc(window, (id) => window.api.customers.deletePayment(id), paymentId)

      const afterDelete = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      // Balance restored.
      expect(Math.abs(afterDelete.balance)).toBe(50_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // customer-8-6 (P3) — cashier blocked from customer mutation
  // -----------------
  test('customer-8-6 — cashier cannot create/update/delete customers', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, { name: 'Caja Cust', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Cust', '222222')

      // Cashier sidebar should NOT include Clientes (or if it does, the
      // mutation IPC channels are role-gated to admin/supervisor).
      const nav = new SidebarNav(window)
      await nav.assertNoLink(/^Clientes$/i)

      const result = await ipc(window, async () => {
        try {
          await window.api.customers.create({ name: 'Sneaky' })
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok, 'cashier must NOT be able to create customers').toBe(false)
    } finally {
      await cleanup()
    }
  })
})
