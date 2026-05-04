# Purchases — test cases

Module: `src/renderer/src/modules/compras`
Prefix: `PUR`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| PUR-001 | Register a purchase with multiple items        | P1       |
| PUR-002 | Stock increases after purchase is confirmed    | P1       |
| PUR-003 | Cost is updated on purchased products          | P2       |
| PUR-004 | Edit a draft purchase                          | P2       |
| PUR-005 | Cancel / void a purchase                       | P2       |
| PUR-006 | Purchase appears in history with totals        | P2       |
| PUR-007 | Validation: empty supplier / no items          | P2       |

---

## PUR-001 — Register purchase

**Steps:**

1. Open Compras → **New**.
2. Choose / create a supplier.
3. Add items (product, qty, unit cost).
4. Confirm.

**Expected:** Purchase is saved with correct subtotal, tax (if any), and total.

---

## PUR-002 — Stock increases

**Preconditions:** Product Z stock = 5.
**Steps:**

1. Register a purchase of 10 units of Z.

**Expected:** Product Z stock = 15 immediately after confirmation.

---

## PUR-003 — Cost update

**Steps:**

1. Note product cost before purchase.
2. Register a purchase with a different unit cost.

**Expected:** Per spec — either weighted-average cost is updated, or last-cost is updated. Verify the chosen behavior is consistent across products.

---

## PUR-004 — Edit draft

**Preconditions:** A draft purchase exists (not yet confirmed).
**Steps:**

1. Reopen the draft, change quantities and items, save.

**Expected:** Changes persist. Stock has not yet moved.

---

## PUR-005 — Cancel / void

**Steps:**

1. Cancel a confirmed purchase (admin only).

**Expected:** Stock added by the purchase is reverted. Purchase is marked as voided.

---

## PUR-006 — Purchase history

**Steps:**

1. Open Compras → History.

**Expected:** All purchases listed with supplier, date, total, status. Totals match the purchases report.

---

## PUR-007 — Validation

**Steps:**

1. Try to confirm a purchase with no supplier.
2. Try to confirm with no line items.

**Expected:** Both blocked with clear messages.
