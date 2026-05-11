import { test } from '@playwright/test'


test.describe('Sales — list & filters', () => {

  test.fixme('sales-list-6-1 — filter by payment method narrows the result (P2)', async () => {
    // Seed: 1 cash + 1 credit + 1 mixed sale.
    // Action: open /ventas, filter "Crédito".
    // Expected: only the credit sale visible.
  })

  test.fixme('sales-list-6-2 — filter by date range excludes older sales (P2)', async () => {
    // Seed: sales spanning two days (use IPC to set created_at).
    // Action: set "Desde / Hasta" to today.
    // Expected: only today's sales visible.
  })

  test.fixme('sales-list-6-3 — pagination shows correct page counts (P3)', async () => {
    // Seed: 75 sales.
    // Action: open /ventas, navigate to page 2.
    // Expected: page 2 shows 25 rows (50/page).
  })
})
