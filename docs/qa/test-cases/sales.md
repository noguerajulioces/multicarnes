# Sales — test cases

Module: `src/renderer/src/modules/ventas`
Prefix: `SAL`

| ID      | Title                                              | Priority |
| ------- | -------------------------------------------------- | -------- |
| SAL-001 | Cannot start a sale without an open cash session   | P1       |
| SAL-002 | Add product by clicking the catalog               | P1       |
| SAL-003 | Add product by barcode scan / typing              | P1       |
| SAL-004 | Increase / decrease quantity                       | P1       |
| SAL-005 | Apply line-level discount                          | P2       |
| SAL-006 | Apply global discount                              | P2       |
| SAL-007 | Remove a line item                                 | P2       |
| SAL-008 | Select a customer                                  | P2       |
| SAL-009 | Cash payment with change calculation               | P1       |
| SAL-010 | Mixed payment (cash + card)                        | P2       |
| SAL-011 | Cancel sale before confirmation                    | P2       |
| SAL-012 | Confirm sale prints ticket                         | P1       |
| SAL-013 | Confirm sale falls back to PDF when no printer     | P2       |
| SAL-014 | Sale appears in history with correct totals        | P1       |
| SAL-015 | Stock decreases after sale                         | P1       |
| SAL-016 | Cannot sell more than available stock              | P1       |
| SAL-017 | Reprint ticket from sale history                   | P2       |
| SAL-018 | Void / cancel a confirmed sale                     | P2       |

---

## SAL-001 — Cannot start a sale without an open cash session

**Preconditions:** Logged in. No cash session open.
**Steps:**

1. Open Sales.
2. Try to add a product / confirm a sale.

**Expected:** App blocks the action and prompts to open a cash session, or redirects to the Cash module.

---

## SAL-002 — Add product by clicking the catalog

**Preconditions:** Open cash session, at least 1 product with stock.
**Steps:**

1. Open Sales.
2. Click a product card.

**Expected:** Product appears as a line with quantity 1 at its current price. Subtotal updates.

---

## SAL-003 — Add product by barcode

**Preconditions:** Product with barcode `7790000000001` exists in stock.
**Steps:**

1. Focus the barcode input (or just type, if global).
2. Type / scan `7790000000001` and press Enter.

**Expected:** That product is added (or quantity incremented if already in cart). Input clears for the next scan.

---

## SAL-004 — Increase / decrease quantity

**Preconditions:** Sale with at least one line, stock > 1.
**Steps:**

1. Click `+` on the line — quantity goes 1 → 2.
2. Click `−` twice — quantity goes 2 → 0.

**Expected:** When quantity reaches 0, the line is removed (or kept at 1 with a confirm — match the spec). Subtotal updates correctly each time.

---

## SAL-005 — Line discount

**Steps:**

1. Add a product with unit price 10,000.
2. Apply a 10% discount on the line.

**Expected:** Line total = 9,000. Discount column shows 10% / 1,000. Cart total reflects the discount.

---

## SAL-006 — Global discount

**Steps:**

1. Add 2 products totalling 20,000.
2. Apply a global 5% discount.

**Expected:** Total shown = 19,000. Tax / subtotal split (if displayed) is recalculated correctly.

---

## SAL-007 — Remove a line item

**Steps:**

1. Add 2 different products.
2. Click the trash / remove icon on one line.

**Expected:** Only that line is removed. The other line, totals, and stock projection are unchanged.

---

## SAL-008 — Select a customer

**Preconditions:** At least one customer exists.
**Steps:**

1. Open the customer selector in the sale.
2. Search by name or document.
3. Pick a customer.

**Expected:** Customer name and document show in the sale header. Ticket / receipt will include this customer.

---

## SAL-009 — Cash payment with change

**Steps:**

1. Cart total = 18,500.
2. Choose payment method **Cash**.
3. Enter received = 20,000.
4. Confirm.

**Expected:** Change due = 1,500 displayed before confirm. Sale is registered with `paid = 20000`, `change = 1500`.

---

## SAL-010 — Mixed payment (cash + card)

**Steps:**

1. Cart total = 50,000.
2. Add cash 20,000 and card 30,000 in payments.
3. Confirm.

**Expected:** Sale is accepted. Both payments are stored. Total paid = total due. No change.

---

## SAL-011 — Cancel sale before confirmation

**Steps:**

1. Add products to a sale.
2. Click **Cancel** / clear cart.
3. Confirm the cancel dialog.

**Expected:** Cart is empty. No record is written. Stock is unchanged.

---

## SAL-012 — Confirm sale prints ticket

**Preconditions:** Thermal printer configured and online.
**Steps:**

1. Complete a sale and confirm.

**Expected:** Ticket prints once with: business header, sale ID, datetime, line items (qty, name, unit, total), subtotal, discounts, total, payment, change, customer (if selected), footer.

---

## SAL-013 — Confirm sale without printer

**Preconditions:** No printer configured / printer offline.
**Steps:**

1. Complete and confirm a sale.

**Expected:** Sale is still saved. App offers a PDF preview / save dialog as fallback. No silent failure.

---

## SAL-014 — Sale appears in history

**Steps:**

1. Confirm a sale of total 25,000.
2. Open Sales → History.

**Expected:** The sale is the latest row, with correct ID, datetime, total, customer, and payment method.

---

## SAL-015 — Stock decreases after sale

**Preconditions:** Product X has stock 10.
**Steps:**

1. Sell 3 units of product X.

**Expected:** Product X stock = 7 in the products module immediately. Cash report stock movement reflects the sale.

---

## SAL-016 — Cannot oversell

**Preconditions:** Product Y has stock 2.
**Steps:**

1. Try to add quantity 3 of product Y to the cart.

**Expected:** App blocks and shows "insufficient stock" (or similar). Quantity stays at 2.

---

## SAL-017 — Reprint ticket from history

**Steps:**

1. Open Sales → History.
2. Click **Reprint** on a past sale.

**Expected:** Ticket prints with the same content as the original (clearly marked as reprint, e.g. "DUPLICATE").

---

## SAL-018 — Void a confirmed sale

**Preconditions:** Logged in as admin (cashiers may not be allowed).
**Steps:**

1. Open the sale in history.
2. Click **Void / Cancel**.
3. Confirm.

**Expected:** Sale is marked as voided. Stock is restored. Voided sale is excluded from totals in reports (or shown separately, per spec).
