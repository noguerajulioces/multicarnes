# Cash session — test cases

Module: `src/renderer/src/modules/caja`
Prefix: `CSH`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| CSH-001 | Open cash session with opening amount          | P1       |
| CSH-002 | Cannot open a second concurrent session        | P1       |
| CSH-003 | Cash inflow (manual deposit)                   | P2       |
| CSH-004 | Cash outflow (manual withdrawal)               | P2       |
| CSH-005 | Live expected balance reflects sales           | P1       |
| CSH-006 | Close session with matching counted amount     | P1       |
| CSH-007 | Close session with shortage                    | P1       |
| CSH-008 | Close session with surplus                     | P1       |
| CSH-009 | Cannot make a sale on a closed session         | P1       |
| CSH-010 | Closed session is visible in cash history      | P2       |

---

## CSH-001 — Open cash session

**Preconditions:** No open session.
**Steps:**

1. Open Caja.
2. Click **Open session**, enter opening amount 100,000.
3. Confirm.

**Expected:** Session is open. Opening amount, opener username, datetime are stored. Status indicator: **Open**.

---

## CSH-002 — Cannot open a second session

**Preconditions:** A session is already open.
**Steps:**

1. Try to open a new session.

**Expected:** Action is disabled or blocked with a clear message. Only one session can be open at a time.

---

## CSH-003 — Manual deposit

**Steps:**

1. With session open, register a deposit of 50,000 with reason "Initial reinforcement".

**Expected:** Movement appears in the session detail. Expected balance increases by 50,000.

---

## CSH-004 — Manual withdrawal

**Steps:**

1. Register a withdrawal of 20,000 with reason "Supplier petty cash".

**Expected:** Movement appears. Expected balance decreases by 20,000. Cannot withdraw more than current expected balance (or warning is shown, per spec).

---

## CSH-005 — Expected balance reflects sales

**Preconditions:** Open session, opening 100,000.
**Steps:**

1. Sell 30,000 in cash.
2. Sell 15,000 by card.
3. Open the cash session detail.

**Expected:** Cash expected = 130,000 (only cash sales counted). Card sales are tracked separately.

---

## CSH-006 — Close with matching amount

**Steps:**

1. Close the session with counted = expected.

**Expected:** Difference = 0. Session is marked closed. Z-report / closing ticket prints (if configured).

---

## CSH-007 — Close with shortage

**Steps:**

1. Counted = expected − 5,000.
2. Confirm close.

**Expected:** Difference = −5,000 stored. Closing report flags the shortage.

---

## CSH-008 — Close with surplus

**Steps:**

1. Counted = expected + 2,000.
2. Confirm close.

**Expected:** Difference = +2,000 stored.

---

## CSH-009 — No sale on closed session

**Preconditions:** Most recent session is closed, no new one opened.
**Steps:**

1. Open Sales and try to confirm a sale.

**Expected:** Same block as SAL-001 — must open a new session first.

---

## CSH-010 — Cash history

**Steps:**

1. Open Caja → History.

**Expected:** Closed sessions are listed with: opener, closer, open/close datetimes, opening, expected, counted, difference. Can drill into each one to see all movements.
