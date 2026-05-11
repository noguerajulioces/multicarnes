import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import {
  loginAsSeedAdmin,
  createProductViaIpc,
  createCustomerViaIpc,
  openCashRegisterViaIpc
} from './helpers/seed'

interface SaleCreated {
  id: number
  status: string
  total: number
  payment_method: string
}

interface ProductFull {
  id: number
  stock: number
}

interface StockAdjustmentRow {
  id: number
  product_id: number
  user_id: number
  quantity_before: number
  quantity_after: number
  reason: string
}

interface CustomerFull {
  id: number
  balance: number
}

async function createCashSale(
  window: import('@playwright/test').Page,
  args: { userId: number; registerId: number; productId: number; quantity: number }
): Promise<SaleCreated> {
  return window.evaluate(async (a) => {
    const product = (await window.api.products.getById(a.productId)) as { price: number }
    const unitPrice = product.price
    const subtotal = unitPrice * a.quantity
    const result = (await window.api.sales.create({
      registerId: a.registerId,
      userId: a.userId,
      items: [{ productId: a.productId, quantity: a.quantity, unitPrice, subtotal }],
      subtotal,
      discount: 0,
      total: subtotal,
      paymentMethod: 'cash',
      payments: [{ method: 'cash', amount: subtotal }]
    })) as SaleCreated
    return result
  }, args)
}

test.describe('Sales — POS happy path', () => {
  // -----------------
  // sales-4-1 (P1) — cash sale completes and writes the audit chain
  // -----------------
  test('sales-4-1 — cash sale completes, decrements stock and writes stock_adjustments', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Pollo Test',
        price: 30_000,
        stock: 10,
        priceType: 'unit'
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      const sale = await createCashSale(window, {
        userId: admin.id,
        registerId: register.id,
        productId: product.id,
        quantity: 2
      })

      expect(sale.status).toBe('completed')
      expect(sale.payment_method).toBe('cash')
      expect(sale.total).toBe(60_000)

      // Stock dropped from 10 to 8.
      const after = (await ipc(
        window,
        (id) => window.api.products.getById(id),
        product.id
      )) as ProductFull
      expect(after.stock).toBe(8)

      // A stock_adjustments row references the sale.
      const movements = (await ipc(
        window,
        async (id) => {
          const today = new Date().toISOString().slice(0, 10)
          const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
          return window.api.reports.stockMovements(today, tomorrow, id)
        },
        product.id
      )) as StockAdjustmentRow[]
      const saleRow = movements.find((m) => m.reason?.includes(`Venta #${sale.id}`))
      expect(saleRow, `stock_adjustments row for sale #${sale.id} not found`).toBeDefined()
      expect(saleRow!.user_id).toBe(admin.id)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-4-2 (P2) — credit sale increases customer balance (negative-for-debtor)
  // -----------------
  test('sales-4-2 — credit sale moves the customer balance by the sale total', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Carne Credit',
        price: 25_000,
        stock: 10
      })
      const customer = await createCustomerViaIpc(window, { name: 'Customer Credit' })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      const sale = await window.evaluate(
        async (a) => {
          const result = (await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 25_000, subtotal: 25_000 }],
            subtotal: 25_000,
            discount: 0,
            total: 25_000,
            paymentMethod: 'credit',
            payments: [{ method: 'credit', amount: 25_000 }]
          })) as SaleCreated
          return result
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      expect(sale.payment_method).toBe('credit')

      const customerAfter = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      // Negative-for-debtor convention.
      expect(Math.abs(customerAfter.balance)).toBe(25_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-4-3 (P2) — mixed payment splits between cash + credit
  // -----------------
  test('sales-4-3 — mixed payment records two sale_payments rows and moves balance by the credit portion', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Mixed Product',
        price: 100_000,
        stock: 10
      })
      const customer = await createCustomerViaIpc(window, { name: 'Mixed Customer' })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      const sale = await window.evaluate(
        async (a) => {
          const result = (await window.api.sales.create({
            registerId: a.registerId,
            userId: a.userId,
            customerId: a.customerId,
            items: [{ productId: a.productId, quantity: 1, unitPrice: 100_000, subtotal: 100_000 }],
            subtotal: 100_000,
            discount: 0,
            total: 100_000,
            paymentMethod: 'mixed',
            payments: [
              { method: 'cash', amount: 50_000 },
              { method: 'credit', amount: 50_000 }
            ]
          })) as SaleCreated & { payments?: { method: string; amount: number }[] }
          return result
        },
        {
          registerId: register.id,
          userId: admin.id,
          customerId: customer.id,
          productId: product.id
        }
      )

      expect(sale.payment_method).toBe('mixed')

      // The full sale (via getById) returns the payments array.
      const full = (await ipc(window, (id) => window.api.sales.getById(id), sale.id)) as {
        payments?: { method: string; amount: number }[]
      }
      expect(full.payments).toBeDefined()
      const cashRow = full.payments?.find((p) => p.method === 'cash')
      const creditRow = full.payments?.find((p) => p.method === 'credit')
      expect(cashRow?.amount).toBe(50_000)
      expect(creditRow?.amount).toBe(50_000)

      // Customer balance moved by ONLY the credit portion (50k), not the whole 100k.
      const customerAfter = (await ipc(
        window,
        (id) => window.api.customers.getById(id),
        customer.id
      )) as CustomerFull
      expect(Math.abs(customerAfter.balance)).toBe(50_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-4-4 (P2) — cannot create a sale when no register is open
  // -----------------
  test('sales-4-4 — sales:create is rejected when no register is open (P2 invariant)', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'No-register product',
        price: 10_000,
        stock: 5
      })

      // Note: NO register opened. sales:create must reject.
      const result = await window.evaluate(
        async (a) => {
          try {
            await window.api.sales.create({
              registerId: 999, // synthetic, no register exists
              userId: a.userId,
              items: [{ productId: a.productId, quantity: 1, unitPrice: 10_000, subtotal: 10_000 }],
              subtotal: 10_000,
              discount: 0,
              total: 10_000,
              paymentMethod: 'cash',
              payments: [{ method: 'cash', amount: 10_000 }]
            })
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        { userId: admin.id, productId: product.id }
      )
      expect(result.ok, 'sales:create must reject when no register is open').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-4-5 (P2) — hold ticket then resume completes the sale
  // -----------------
  test('sales-4-5 — held ticket can be resumed and finalised as a normal sale', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const product = await createProductViaIpc(window, {
        name: 'Hold-resume product',
        price: 15_000,
        stock: 10
      })
      const register = await openCashRegisterViaIpc(window, admin.id, 0)

      // Hold a ticket via IPC (the renderer flow uses the same channel).
      const ticketId = `hold-${Date.now()}`
      await ipc(
        window,
        async (id) => {
          await window.api.heldTickets.add({
            id,
            label: 'Hold-resume test',
            payload: '[]',
            discount: 0
          })
        },
        ticketId
      )

      const beforeFinal = (await ipc(window, () => window.api.heldTickets.list())) as Array<{
        id: string
      }>
      expect(beforeFinal.some((t) => t.id === ticketId)).toBe(true)

      // Resume = remove the held ticket and create a normal sale.
      await ipc(
        window,
        async (id) => {
          await window.api.heldTickets.remove(id)
        },
        ticketId
      )

      const sale = await createCashSale(window, {
        userId: admin.id,
        registerId: register.id,
        productId: product.id,
        quantity: 1
      })
      expect(sale.status).toBe('completed')

      const afterFinal = (await ipc(window, () => window.api.heldTickets.list())) as Array<{
        id: string
      }>
      expect(afterFinal.some((t) => t.id === ticketId)).toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // sales-4-6 (P3) — print:ticket would fire on completion
  // -----------------
  test('sales-4-6 — print:hasConfig returns false in test (no real printer)', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      // We don't have a real printer in CI; confirm the channel responds and
      // reports no configuration. This is the closest e2e assertion to "the
      // ticket-printing pipeline exists" without a physical device.
      const hasConfig = (await ipc(window, () => window.api.print.hasConfig())) as boolean
      expect(hasConfig).toBe(false)
    } finally {
      await cleanup()
    }
  })
})
