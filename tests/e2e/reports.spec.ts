import { test } from '@playwright/test'


test.describe('Reports', () => {

  test.fixme('report-11-1 — cashier blocked from profit-margin report (P1)', async () => {
    // Preconditions: cashier logged in.
    // Steps: sidebar shows no "Reportes" (or direct nav blocked);
    //        ipc reports.profitMargin rejects with blocked-insufficient-role.
    // Expected: rejection + audit row.
  })

  test.fixme('report-11-2 — sales summary returns expected aggregations (P2)', async () => {
    // Seed: 3 sales for today.
    // Steps: open /reportes Resumen with today's date range.
    // Expected: totals.sales_count=3, totals.total=sum.
  })

  test.fixme('report-11-3 — top products lists highest-revenue first (P3)', async () => {
    // Seed: product A sold 5×, product B sold 1×.
    // Expected: A first in the list.
  })

  test.fixme('report-11-4 — export to Excel triggers a save dialog (P3, fragile)', async () => {
    // Action: click "Exportar a Excel".
    // Expected: file save dialog or download. Hard to assert headlessly.
  })
})
