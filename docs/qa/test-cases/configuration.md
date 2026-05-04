# Configuration — test cases

Module: `src/renderer/src/modules/configuracion`
Prefix: `CFG`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| CFG-001 | Edit business info (name, RUC, address)        | P1       |
| CFG-002 | Business info appears on tickets / reports     | P1       |
| CFG-003 | Configure thermal printer                      | P1       |
| CFG-004 | Test-print from configuration                  | P2       |
| CFG-005 | Change tax / IVA settings                      | P2       |
| CFG-006 | Currency / locale formatting                   | P2       |
| CFG-007 | Toggle features (e.g. discounts, customer req) | P2       |
| CFG-008 | Settings persist across restarts               | P1       |

---

## CFG-001 — Business info

**Steps:**

1. Open Configuration → Business.
2. Update name, RUC, address, phone, logo.
3. Save.

**Expected:** Save success. Reopening the section shows the new values.

---

## CFG-002 — Business info on output

**Steps:**

1. Make a sale, print the ticket.
2. Run a report and export to PDF.

**Expected:** Updated business info shows on both. Logo (if set) is rendered correctly.

---

## CFG-003 — Configure printer

**Steps:**

1. Open Configuration → Printer.
2. Pick interface (USB, network, system), set paper width, char codepage.
3. Save.

**Expected:** Settings persist. No errors on save.

---

## CFG-004 — Test print

**Steps:**

1. Click **Test print** from configuration.

**Expected:** Printer prints a test page. If the printer is offline, a clear error is shown — not a silent fail.

---

## CFG-005 — Tax / IVA

**Preconditions:** Tax-rate setting exists.
**Steps:**

1. Change tax rate.
2. Make a new sale.

**Expected:** New sale uses the new tax. Existing sales are unaffected.

---

## CFG-006 — Currency & locale

**Steps:**

1. Verify currency format on prices, totals, change.

**Expected:** Format is consistent everywhere (sales screen, history, reports, tickets) and matches the configured locale.

---

## CFG-007 — Feature toggles

**Steps:**

1. Toggle a feature (e.g. "Require customer on every sale").
2. Try to confirm a sale that violates it.

**Expected:** Toggle changes the validation behavior immediately or after restart, per spec.

---

## CFG-008 — Persistence

**Steps:**

1. Change several settings.
2. Restart the app.

**Expected:** All settings are preserved.
