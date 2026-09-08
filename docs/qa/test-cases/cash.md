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
| CSH-011 | Close with the float left in the drawer        | P1       |
| CSH-012 | Float larger than the counted cash is rejected | P1       |
| CSH-013 | Close PDF prints float, withdrawal and notes   | P1       |
| CSH-014 | Next opening proposes the float left           | P2       |
| CSH-015 | History shows Quedó / Retiro / Notas           | P2       |

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

---

## CSH-011 — Close with the float left in the drawer (010)

**Preconditions:** Configuración › Caja has "Fondo de caja por defecto" = 600,000. Session open with opening 600,000 and 590,000 of cash income (sales or a manual deposit).
**Steps:**

1. Open Caja → **Cerrar caja**. Enter counted 1,190,000.
2. Check the field **Efectivo que queda en caja**: it is prefilled with 600,000.
3. Check **A retirar / entregar**: 590,000.
4. Change the float to 620,000.
5. Confirm the close.

**Expected:** After step 4, "A retirar / entregar" = 570,000 while **Efectivo esperado** and **Diferencia** do not change (the float never enters the arqueo). After confirming, the "Caja cerrada" view shows "Queda en caja (fondo)" 620,000 and "Retiro / entrega" 570,000. Cash history (Reportes › Cierres Caja) shows Quedó 620,000 and Retiro 570,000. No cash movement is created for the withdrawal; the closing movement carries the full counted 1,190,000.

Evidence: [`docs/qa/evidence/010-cash-float-close/`](../evidence/010-cash-float-close/README.md).

---

## CSH-012 — Float larger than the counted cash is rejected (010)

**Steps:**

1. In the close screen enter counted 400,000 and float 620,000.
2. Try to confirm.
3. Lower the float to 400,000.

**Expected:** After step 1 an inline message says the float cannot exceed the counted cash and **Confirmar Cierre** is disabled; the arqueo still shows the real difference. After step 3 the button is enabled again. (A stale close entered with counted 0 requires float 0 for the same reason.)

---

## CSH-013 — Close PDF prints float, withdrawal and notes (010)

**Steps:**

1. Close a session with float 600,000, counted 1,190,000 and the note "Quedó en caja 600.000 para mañana".
2. Click **Descargar PDF del cierre** and open the file.
3. Repeat with a close that has no notes.

**Expected:** In the "Caja (efectivo)" block, after the arqueo result, the PDF shows "Queda en caja (fondo) Gs. 600.000" and "Retiro / entrega Gs. 590.000". The note is printed verbatim at the foot as "Observaciones del cierre: …". The close without notes prints no observations line.

---

## CSH-014 — Next opening proposes the float left (010)

**Preconditions:** The most recent close recorded a float (e.g. 620,000 from CSH-011).
**Steps:**

1. Open Caja → Apertura.
2. Check the prefilled amount and the legend under it.
3. Edit the amount to 600,000 and open the session.

**Expected:** The amount is prefilled with 620,000 and the legend reads "Quedó del cierre anterior (date, time): Gs. 620.000". The edited value wins: the session opens with 600,000. When the last close recorded no float (closed before this feature) the default float is proposed with the legend "Fondo de caja por defecto"; with neither, the field starts at 0 and the usual "abrir en 0" confirmation applies.

---

## CSH-015 — History shows Quedó / Retiro / Notas (010)

**Steps:**

1. Open Reportes → **Cierres Caja**.
2. Export to Excel and to PDF.

**Expected:** Each close shows Quedó, Retiro (= Contado − Quedó) and the close notes readable in the row. Closes recorded before this feature show "—" in Quedó and Retiro. Both exports include the three columns.
