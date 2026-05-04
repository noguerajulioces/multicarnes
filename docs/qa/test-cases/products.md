# Products — test cases

Module: `src/renderer/src/modules/productos`
Prefix: `PRD`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| PRD-001 | Create product with all required fields        | P1       |
| PRD-002 | Validation: missing name / price               | P2       |
| PRD-003 | Validation: duplicate barcode                  | P2       |
| PRD-004 | Edit product                                   | P1       |
| PRD-005 | Search by name                                 | P1       |
| PRD-006 | Search by barcode                              | P1       |
| PRD-007 | Filter by category                             | P2       |
| PRD-008 | Adjust stock manually                          | P2       |
| PRD-009 | Soft delete / disable product                  | P2       |
| PRD-010 | Disabled product is not sellable               | P1       |
| PRD-011 | Price change is reflected in new sales only    | P2       |
| PRD-012 | Bulk import (if available)                     | P2       |

---

## PRD-001 — Create product

**Steps:**

1. Open Products → **New**.
2. Fill: name, price, cost, barcode, category, initial stock, unit (kg/unit).
3. Save.

**Expected:** Product appears in the list with all fields populated. Stock matches initial stock.

---

## PRD-002 — Required-field validation

**Steps:**

1. Try to save with empty name.
2. Try to save with empty / non-numeric price.

**Expected:** Field-level errors. No record written. Form remains editable.

---

## PRD-003 — Duplicate barcode

**Preconditions:** A product with barcode `7790000000001` exists.
**Steps:**

1. Try to create a new product with the same barcode.

**Expected:** Save is blocked with a clear error. Existing product is not modified.

---

## PRD-004 — Edit product

**Steps:**

1. Open an existing product.
2. Change price and stock.
3. Save.

**Expected:** Changes persist after navigating away and back, and after restarting the app.

---

## PRD-005 — Search by name

**Steps:**

1. Type a fragment of a product name in the search field.

**Expected:** List filters in real time (or after submit). Matches are case-insensitive and accent-insensitive.

---

## PRD-006 — Search by barcode

**Steps:**

1. Type / scan a full barcode in the search field.

**Expected:** Exact match is shown.

---

## PRD-007 — Filter by category

**Steps:**

1. Pick a category in the filter.

**Expected:** Only products in that category are shown. Clearing the filter restores all.

---

## PRD-008 — Adjust stock

**Steps:**

1. Open a product.
2. Use the stock adjustment action to set or add stock with a reason.

**Expected:** New stock value persists. Movement is recorded (visible in product history / inventory log).

---

## PRD-009 — Disable product

**Steps:**

1. Mark a product as inactive / disabled.

**Expected:** Product is hidden from the active list (or shown greyed out, per spec). No stock change.

---

## PRD-010 — Disabled product is not sellable

**Steps:**

1. Open Sales.
2. Try to add the disabled product by click and by barcode.

**Expected:** Product does not appear in catalog and barcode lookup returns "not available".

---

## PRD-011 — Price change scope

**Steps:**

1. Note the price of an existing past sale.
2. Change the product price.
3. Open the past sale.

**Expected:** Past sale still shows the old price. New sales use the new price.

---

## PRD-012 — Bulk import

**Preconditions:** Bulk import feature is shipped.
**Steps:**

1. Use the import action with a sample Excel/CSV.

**Expected:** Valid rows imported, invalid rows reported with row numbers. No partial-corrupt state on failure.
