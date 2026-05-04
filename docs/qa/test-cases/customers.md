# Customers — test cases

Module: `src/renderer/src/modules/clientes`
Prefix: `CUS`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| CUS-001 | Create customer with required fields           | P1       |
| CUS-002 | Validation: missing name / document            | P2       |
| CUS-003 | Validation: duplicate document                 | P2       |
| CUS-004 | Edit customer                                  | P2       |
| CUS-005 | Search by name / document                      | P1       |
| CUS-006 | Disable customer                               | P3       |
| CUS-007 | Customer is selectable in a sale               | P1       |
| CUS-008 | Customer purchase history                      | P2       |

---

## CUS-001 — Create customer

**Steps:**

1. Open Customers → **New**.
2. Fill: name, document type & number (RUC / CI), phone, email, address.
3. Save.

**Expected:** Customer appears in the list with all fields. Default flag (e.g. "Walk-in") behavior is preserved if applicable.

---

## CUS-002 — Required-field validation

**Steps:**

1. Try to save without name and / or document number.

**Expected:** Field errors block save.

---

## CUS-003 — Duplicate document

**Preconditions:** Customer with document `1234567` exists.
**Steps:**

1. Create a new customer with the same document.

**Expected:** Save is blocked with a clear error.

---

## CUS-004 — Edit customer

**Steps:**

1. Open a customer and change phone and address.
2. Save.

**Expected:** Changes persist. Past sales linked to this customer keep the previous data on the printed ticket (snapshot) — or update, depending on spec; verify behavior is consistent.

---

## CUS-005 — Search

**Steps:**

1. Search by partial name.
2. Search by full document.

**Expected:** Both return the expected match. Empty search shows the full list.

---

## CUS-006 — Disable customer

**Steps:**

1. Mark a customer as inactive.

**Expected:** Customer is hidden from selection in new sales (or filtered, per spec). Past sales are unaffected.

---

## CUS-007 — Customer selectable in sale

**Steps:**

1. In Sales, open the customer selector.
2. Search and select an active customer.

**Expected:** Customer is attached to the sale and printed on the ticket.

---

## CUS-008 — Customer purchase history

**Steps:**

1. Open the customer detail view.

**Expected:** Sales for this customer are listed with date, total, and status. Totals match the sales report filtered by this customer.
