# Reports — test cases

Module: `src/renderer/src/modules/reportes`
Prefix: `RPT`

| ID      | Title                                                  | Priority |
| ------- | ------------------------------------------------------ | -------- |
| RPT-001 | Sales report — today                                   | P1       |
| RPT-002 | Sales report — date range                              | P1       |
| RPT-003 | Sales report — filter by user                          | P2       |
| RPT-004 | Sales report — filter by payment method                | P2       |
| RPT-005 | Best-selling products                                  | P2       |
| RPT-006 | Stock / inventory report                               | P2       |
| RPT-007 | Cash sessions report                                   | P2       |
| RPT-008 | Purchases report                                       | P2       |
| RPT-009 | Export to PDF                                          | P2       |
| RPT-010 | Export to Excel                                        | P2       |
| RPT-011 | Empty range shows "no data" — no crash                 | P2       |
| RPT-012 | Numbers match the source modules                       | P1       |

---

## RPT-001 — Sales today

**Steps:**

1. Make 2 sales today.
2. Open Reports → Sales → "Today".

**Expected:** Both sales are listed. Total = sum of both. Counts and averages are correct.

---

## RPT-002 — Date range

**Steps:**

1. Pick a range covering yesterday and today.

**Expected:** Sales from both days are aggregated. Range labels match the picker.

---

## RPT-003 — Filter by user

**Steps:**

1. Select cashier A in the filter.

**Expected:** Only sales by A. Total is recomputed.

---

## RPT-004 — Filter by payment method

**Steps:**

1. Filter by Cash.
2. Filter by Card.

**Expected:** Mixed-payment sales appear under both, with the corresponding amount split (or whatever the spec defines — verify it's consistent).

---

## RPT-005 — Best-selling products

**Steps:**

1. Open Reports → Best sellers for the current week.

**Expected:** Products ranked by quantity (or revenue, per spec). Numbers tie back to sales history.

---

## RPT-006 — Stock report

**Steps:**

1. Open Reports → Stock / Inventory.

**Expected:** Each product with its current stock, value (qty × cost), and low-stock flag where applicable.

---

## RPT-007 — Cash sessions report

**Steps:**

1. Open Reports → Cash sessions for a range.

**Expected:** All sessions in range with opener, closer, opening, expected, counted, difference. Totals reconcile with each session detail.

---

## RPT-008 — Purchases report

**Steps:**

1. Open Reports → Purchases for a range.

**Expected:** All purchases in range with supplier, total. Aggregate matches purchases module.

---

## RPT-009 — Export PDF

**Steps:**

1. Run any report.
2. Export to PDF.

**Expected:** File saved at the chosen path. Opens in any PDF reader. Layout is readable, columns aligned, totals match the on-screen view.

---

## RPT-010 — Export Excel

**Steps:**

1. Export the same report to Excel.

**Expected:** `.xlsx` file opens in Excel / LibreOffice. Numeric columns are numbers (not text). Totals match.

---

## RPT-011 — Empty range

**Steps:**

1. Run a report with a range where no data exists.

**Expected:** "No data" state is shown. App does not crash. Export is disabled or produces an empty-but-valid file.

---

## RPT-012 — Cross-check totals

**Steps:**

1. Pick a single day with known sales.
2. Compare report total against:
   - Sum of sales in Sales → History.
   - Cash-paid total against the cash session.

**Expected:** All three numbers match exactly.
