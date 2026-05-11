import { test } from '@playwright/test'


/**
 * Cash register flows. The "cashier closes own register, not another's"
 * test (cash-7-3) is the most important — it validates the cashier-self
 * exception added in feature 001 (T028).
 */
test.describe('Cash register', () => {

  test.fixme('cash-7-1 — open register with ₲0 requires confirmation (P1)', async () => {
    // Preconditions: cashier logged in, no active register.
    // Steps: navigate /caja → redirected to apertura → submit ₲0 → confirm dialog.
    // Expected: register opened with opening_amount = 0.
  })

  test.fixme('cash-7-2 — cashier closes their own register (P2)', async () => {
    // Preconditions: cashier opened a register.
    // Steps: /caja → "Cerrar Caja" → enter counted → submit.
    // Expected: register status flips to closed.
  })

  test.fixme('cash-7-3 — cashier cannot close another cashier register (P2)', async () => {
    // Preconditions: Cashier A opens register; Cashier B logs in.
    // Steps: as B, ipc cash.close(registerA.id, ...).
    // Expected: rejection (cashier-self exception denied). Register stays open.
  })

  test.fixme('cash-7-4 — movement updates the summary (P2)', async () => {
    // Preconditions: register open.
    // Steps: add income ₲50,000 with description "Ajuste".
    // Expected: summary income totals ₲50,000.
  })

  test.fixme('cash-7-5 — stale-close requires a note (P3)', async () => {
    // Preconditions: register opened_at > 24h ago.
    // Steps: open close form.
    // Expected: notes field required; submit disabled until filled.
  })
})
