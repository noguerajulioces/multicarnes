import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createUserViaIpc,
  createProductViaIpc
} from './helpers/seed'
import { LoginPage } from './pom/LoginPage'

interface ProductFull {
  id: number
  name: string
  price: number
  stock: number
  min_stock: number
  cost?: number
  margin?: number
}

interface StockAdjustmentRow {
  product_id: number
  user_id: number
  quantity_before: number
  quantity_after: number
  reason: string
}

test.describe('Products', () => {
  // -----------------
  // product-9-1 (P2) — create product
  // -----------------
  test('product-9-1 — IPC creates a product visible in getAll', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const created = await createProductViaIpc(window, {
        name: 'CRUD Product',
        price: 12_345,
        stock: 7
      })
      const list = (await ipc(window, () => window.api.products.getAll({}))) as {
        items?: ProductFull[]
      }
      const items = list.items ?? []
      expect(items.find((p) => p.id === created.id)).toBeDefined()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // product-9-2 (P2) — adjust stock writes a stock_adjustments row
  // -----------------
  test('product-9-2 — adjustStock updates stock and persists an audit row', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Adjust target',
        price: 5_000,
        stock: 10
      })

      await ipc(
        window,
        async ([id, newStock, reason, userId]) => {
          await window.api.products.adjustStock(
            id as number,
            newStock as number,
            reason as string,
            userId as number
          )
        },
        [product.id, 15, 'Inventario test', admin.id] as const
      )

      const after = (await ipc(
        window,
        (id) => window.api.products.getById(id),
        product.id
      )) as ProductFull
      expect(after.stock).toBe(15)

      // The stock_adjustments row is visible via reports.stockMovements.
      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
      const adjustments = (await ipc(
        window,
        async ([from, to, id]) => window.api.reports.stockMovements(from, to, id),
        [today, tomorrow, product.id] as const
      )) as StockAdjustmentRow[]
      const row = adjustments.find((m) => m.reason === 'Inventario test')
      expect(row, 'stock_adjustments row with our reason must exist').toBeDefined()
      expect(row!.quantity_before).toBe(10)
      expect(row!.quantity_after).toBe(15)
      expect(row!.user_id).toBe(admin.id)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // product-9-3 (P2) — cashier blocked from products:adjustStock
  // -----------------
  test('product-9-3 — cashier cannot invoke products:adjustStock', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Stock',
        role: 'cajero',
        pin: '222222'
      })
      const product = await createProductViaIpc(window, {
        name: 'Locked stock',
        price: 1_000,
        stock: 5
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Stock', '222222')

      const result = await ipc(
        window,
        async ([id, userId]) => {
          try {
            await window.api.products.adjustStock(
              id as number,
              999,
              'Sneaky',
              userId as number
            )
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [product.id, cashier.id] as const
      )
      expect(result.ok, 'cashier must NOT be able to adjust stock').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // product-9-4 (P3) — low-stock filter
  // -----------------
  test('product-9-4 — getAll({ lowStock: true }) returns only products at or below min_stock', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      // Create one product clearly in low-stock state, one well above.
      const low = await createProductViaIpc(window, {
        name: 'Low product',
        price: 1_000,
        stock: 0
      })
      const high = await createProductViaIpc(window, {
        name: 'Stocked product',
        price: 1_000,
        stock: 50
      })

      const filtered = (await ipc(window, () =>
        window.api.products.getAll({ lowStock: true })
      )) as { items?: ProductFull[] }
      const ids = (filtered.items ?? []).map((p) => p.id)
      expect(ids).toContain(low.id)
      expect(ids).not.toContain(high.id)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // product-9-5 (P3) — cashier sees no cost / margin on detail
  // -----------------
  test('product-9-5 — cashier products:getById omits cost / margin / last_cost fields', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Cost-hidden',
        price: 10_000,
        stock: 1
      })
      await createUserViaIpc(window, { name: 'Caja Detail', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Detail', '222222')

      const view = (await ipc(
        window,
        (id) => window.api.products.getById(id),
        product.id
      )) as Record<string, unknown>
      expect(view).not.toHaveProperty('cost')
      expect(view).not.toHaveProperty('margin')
      expect(view).not.toHaveProperty('last_cost')
    } finally {
      await cleanup()
    }
  })
})
