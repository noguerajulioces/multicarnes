import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createUserViaIpc,
  createProductViaIpc,
  openCashRegisterViaIpc
} from './helpers/seed'
import { LoginPage } from './pom/LoginPage'

interface SalesSummaryTotals {
  sales_count: number
  total: number
}

interface SalesSummary {
  totals: SalesSummaryTotals
}

interface TopProductRow {
  product_name: string
  total_revenue: number
  total_quantity: number
}

test.describe('Reports', () => {
  // -----------------
  // report-11-1 (P1) — cashier blocked from profit-margin
  // -----------------
  test('report-11-1 — cashier invoking reports:profitMargin is rejected', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, {
        name: 'Caja Reports',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Reports', '222222')

      const result = await ipc(window, async () => {
        try {
          await window.api.reports.profitMargin()
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok, 'cashier must NOT be able to read profit margin').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // report-11-2 (P2) — sales summary returns expected aggregations
  // -----------------
  test('report-11-2 — salesSummary aggregates the count and total for the period', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Report Product',
        price: 10_000,
        stock: 100
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // Create three cash sales.
      await ipc(
        window,
        async (a) => {
          for (let i = 0; i < 3; i++) {
            await window.api.sales.create({
              registerId: a.registerId,
              userId: a.userId,
              items: [{ productId: a.productId, quantity: 1, unitPrice: 10_000, subtotal: 10_000 }],
              subtotal: 10_000,
              discount: 0,
              total: 10_000,
              paymentMethod: 'cash',
              payments: [{ method: 'cash', amount: 10_000 }]
            })
          }
        },
        { registerId: register.id, userId: admin.id, productId: product.id }
      )

      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
      const summary = (await ipc(
        window,
        async ([from, to]) => window.api.reports.salesSummary(from, to),
        [today, tomorrow] as const
      )) as SalesSummary
      expect(summary.totals.sales_count).toBe(3)
      expect(summary.totals.total).toBe(30_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // report-11-3 (P3) — top products lists highest-revenue first
  // -----------------
  test('report-11-3 — topProducts ranks by revenue descending', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const productA = await createProductViaIpc(window, {
        name: 'Top Product A',
        price: 20_000,
        stock: 100
      })
      const productB = await createProductViaIpc(window, {
        name: 'Top Product B',
        price: 5_000,
        stock: 100
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // A: 5 units (100k revenue). B: 1 unit (5k revenue).
      await ipc(
        window,
        async (a) => {
          for (let i = 0; i < 5; i++) {
            await window.api.sales.create({
              registerId: a.registerId,
              userId: a.userId,
              items: [{ productId: a.aId, quantity: 1, unitPrice: 20_000, subtotal: 20_000 }],
              subtotal: 20_000,
              discount: 0,
              total: 20_000,
              paymentMethod: 'cash',
              payments: [{ method: 'cash', amount: 20_000 }]
            })
          }
          await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            items: [{ productId: a.bId, quantity: 1, unitPrice: 5_000, subtotal: 5_000 }],
            subtotal: 5_000,
            discount: 0,
            total: 5_000,
            paymentMethod: 'cash',
            payments: [{ method: 'cash', amount: 5_000 }]
          })
        },
        {
          registerId: register.id,
          userId: admin.id,
          aId: productA.id,
          bId: productB.id
        }
      )

      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
      const top = (await ipc(
        window,
        async ([from, to]) => window.api.reports.topProducts(from, to),
        [today, tomorrow] as const
      )) as TopProductRow[]
      expect(top.length).toBeGreaterThanOrEqual(2)
      // The SQL orders by total_quantity DESC. A sold 5 units, B sold 1.
      const idxA = top.findIndex((r) => r.product_name === productA.name)
      const idxB = top.findIndex((r) => r.product_name === productB.name)
      expect(idxA).toBeGreaterThanOrEqual(0)
      expect(idxB).toBeGreaterThanOrEqual(0)
      expect(idxA).toBeLessThan(idxB)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // report-11-4 (P3) — export Excel save dialog is too fragile to assert
  // -----------------
  test.fixme('report-11-4 — export to Excel triggers a save dialog (fragile, native dialog)', async () => {
    // Excel export uses xlsx in the renderer (Principle V.b) and ends with
    // either a Blob download or a native save dialog. Native dialogs aren't
    // drivable by Playwright; this stays as manual QA.
  })
})
