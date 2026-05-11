import { test } from '@playwright/test'

const skipOnMac = process.platform === 'darwin'

/**
 * sales-4-* — POS happy path tests. See test-plan.md for full scenarios.
 *
 * These exercise the actual UI flow (search → add to cart → CobroModal →
 * confirm). To implement, write a `SalesPage` POM with helpers like
 * searchProduct(), addToCart(quantity), openPaymentModal(),
 * confirmPaymentCash(), confirmPaymentCredit(customer), confirmMixed(cash,
 * credit, customer).
 *
 * The hardest part is product search: the page uses a typeahead that opens
 * an autocomplete dropdown — selectors will need to match `[data-testid] or
 * a stable visible string`.
 */
test.describe('Sales — POS happy path', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  test.fixme('sales-4-1 — cash sale completes and writes the audit chain', async () => {
    // Preconditions: cashier logged in, register open, product with stock 10.
    // Steps: search product → add 2 units → pay cash → confirm.
    // Expected: sale.status=completed, stock-=2, stock_adjustments row written.
  })

  test.fixme('sales-4-2 — credit sale increases customer balance', async () => {
    // Preconditions: cashier, register open, customer with balance 0.
    // Steps: add product → credit payment → pick customer → confirm.
    // Expected: customer.balance == sale.total.
  })

  test.fixme('sales-4-3 — mixed payment splits cash + credit', async () => {
    // Preconditions: cashier, register open, customer with balance 0.
    // Steps: add product total >= 100k → split 50k cash + 50k credit.
    // Expected: payment_method=mixed, two sale_payments rows, customer.balance=50k.
  })

  test.fixme('sales-4-4 — cannot create sale when register is closed (P2)', async () => {
    // Preconditions: cashier logged in, register closed.
    // Steps: invoke sales:create via ipc().
    // Expected: rejection with the P2 guard message.
  })

  test.fixme('sales-4-5 — hold + resume completes the sale', async () => {
    // Preconditions: cashier, register open.
    // Steps: add 2 products → Suspender → open held panel → Reanudar → pay cash.
    // Expected: held ticket removed, final sale matches the held cart.
  })

  test.fixme('sales-4-6 — print:ticket is invoked on completion (P3)', async () => {
    // Preconditions: cashier, register open, no printer configured.
    // Steps: complete a cash sale.
    // Expected: print:ticket called once; print:hasConfig returns false (no real print).
  })
})
