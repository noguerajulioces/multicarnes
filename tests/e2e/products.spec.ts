import { test } from '@playwright/test'

const skipOnMac = process.platform === 'darwin'

test.describe('Products', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  test.fixme('product-9-1 — create product with required fields (P2)', async () => {
    // Steps: /productos/nuevo → fill Nombre, Categoría, Precio, Tipo → submit.
    // Expected: product visible in /productos.
  })

  test.fixme('product-9-2 — adjust stock writes a stock_adjustments row (P2)', async () => {
    // Preconditions: product stock 10.
    // Steps: adjust → new=15, motivo="Inventario".
    // Expected: stock=15; adjustments row with before=10, after=15, reason="Inventario".
  })

  test.fixme('product-9-3 — cashier cannot adjust stock (P2)', async () => {
    // Steps: ipc products.adjustStock as cashier.
    // Expected: rejection; no row written.
  })

  test.fixme('product-9-4 — low-stock filter shows only flagged products (P3)', async () => {
    // Seed: stock 0 + stock 100 products.
    // Steps: toggle "Stock bajo".
    // Expected: only stock-0 product visible.
  })

  test.fixme('product-9-5 — cashier product detail hides cost/margin/stats (P3)', async () => {
    // Steps: cashier opens /productos/:id.
    // Expected: movements / recent sales / stats / last purchase sections empty.
  })
})
