import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createProductViaIpc,
  createCustomerViaIpc,
  openCashRegisterViaIpc
} from './helpers/seed'

interface SaleRow {
  id: number
  payment_method: string
  total: number
  status: string
}

test.describe('Sales — list & filters', () => {
  // -----------------
  // sales-list-6-1 (P2) — list filters via salesByPeriod
  // -----------------
  test('sales-list-6-1 — reports.salesByPeriod filters by payment method', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'List target',
        price: 10_000,
        stock: 10
      })
      const customer = await createCustomerViaIpc(window, { name: 'List Customer' })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // One cash + one credit sale.
      await ipc(
        window,
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            items: [
              { productId: a.productId, quantity: 1, unitPrice: 10_000, subtotal: 10_000 }
            ],
            subtotal: 10_000,
            discount: 0,
            total: 10_000,
            paymentMethod: 'cash',
            payments: [{ method: 'cash', amount: 10_000 }]
          })
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
          productId: product.id,
          customerId: customer.id
        }
      )

      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

      const cashOnly = (await ipc(
        window,
        async ([from, to, method]) =>
          window.api.reports.salesByPeriod(from, to, method),
        [today, tomorrow, 'cash'] as const
      )) as SaleRow[]
      const creditOnly = (await ipc(
        window,
        async ([from, to, method]) =>
          window.api.reports.salesByPeriod(from, to, method),
        [today, tomorrow, 'credit'] as const
      )) as SaleRow[]

      expect(cashOnly.every((s) => s.payment_method === 'cash')).toBe(true)
      expect(creditOnly.every((s) => s.payment_method === 'credit')).toBe(true)
      expect(cashOnly.length).toBeGreaterThanOrEqual(1)
      expect(creditOnly.length).toBeGreaterThanOrEqual(1)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-list-6-2 (P2) — date range excludes future dates
  // -----------------
  test('sales-list-6-2 — salesByPeriod returns nothing for a future-only date range', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Date target',
        price: 5_000,
        stock: 5
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)
      await window.evaluate(
        async (a) => {
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            items: [
              { productId: a.productId, quantity: 1, unitPrice: 5_000, subtotal: 5_000 }
            ],
            subtotal: 5_000,
            discount: 0,
            total: 5_000,
            paymentMethod: 'cash',
            payments: [{ method: 'cash', amount: 5_000 }]
          })
        },
        { registerId: register.id, userId: admin.id, productId: product.id }
      )

      const farFuture = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
      const farther = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10)
      const empty = (await ipc(
        window,
        async ([from, to]) => window.api.reports.salesByPeriod(from, to),
        [farFuture, farther] as const
      )) as SaleRow[]
      expect(empty.length).toBe(0)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-list-6-3 (P3) — pagination FIXME
  // -----------------
  test.fixme(
    'sales-list-6-3 — pagination shows correct page counts',
    async () => {
      // sales.getRecent / sales.getAll do not currently expose paging in a
      // way that's straightforward to assert via IPC; the renderer page does
      // it. Coverage to land alongside a SalesListPage POM later.
    }
  )
})
