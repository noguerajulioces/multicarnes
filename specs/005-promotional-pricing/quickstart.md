# Quickstart — Manual QA: Promotional Pricing

The project has no automated test suite for renderer/IPC paths; this checklist is the manual quickstart that QA runs against a build of the 005-promotional-pricing branch. Each numbered test maps to a spec acceptance scenario, an FR, or a success criterion so coverage is traceable.

**Build & launch**:

```bash
git checkout 005-promotional-pricing
npm install
npm run dev
```

The first launch on an existing install will trigger migration v8; verify the splash shows briefly and the app reaches the login screen without error. A `pre-migrate-v8-*.db` backup is written under `userData/backups` automatically.

---

## Test 1 — Admin sets a fixed-amount promo and the POS sells it at that price (P1, US1.1, US1.3)

1. Sign in as **admin**.
2. Open **Productos**, pick any product with a normal price (note the price).
3. Toggle **En promoción** → choose **Monto fijo** → enter a value strictly between `1` and `price - 1` → save.
4. Sign out and sign in as **cashier** with an open register.
5. Search for the product in the POS and add it to the cart.

**Expected**:
- The cart line uses the promo price as `unit_price` (line subtotal = `qty × promo`).
- A **PROMO** badge appears on the line.
- The normal price is rendered with a strike-through next to the promo unit price.
- A line "Ahorrás Gs. N" appears, where `N = (price - promo) × qty`, formatted with es-PY thousands separators.

**Covers**: FR-001, FR-002, FR-006, FR-007, FR-009, US1 scenarios 1, 3.

---

## Test 2 — Percentage promo computes the right price (P1, US1.2)

1. As admin, on a product with `price = 20000` (or pick one and note the price).
2. Set promo type **Porcentaje de descuento** → value `20` → save.
3. As cashier, add the product.

**Expected**:
- `unit_price = Math.round(20000 × (1 − 20/100)) = 16000`.
- "Ahorrás Gs. 4.000" per unit; if you add `qty = 3`, line shows "Ahorrás Gs. 12.000".

**Covers**: FR-006, R5.

---

## Test 3 — Fixed-amount validation blocks bad promo values (US1.5, FR-003)

As admin, on a product with `price = 10000`:
1. Try to set fixed promo `= 10000` → save should fail with "El precio promo debe ser menor al precio normal."
2. Try `= 12000` → same error.
3. Try `= 0` or negative → "El precio promo debe ser mayor a 0."
4. Try percent `= 0` or `100` → "El descuento debe estar entre 1% y 99%."

**Expected**: in every case, the save is rejected, the form stays open, and no audit row is written.

**Covers**: FR-003, contract validation rules.

---

## Test 4 — Scheduled promo activates on the right day and deactivates on the right day (P2, US2)

This test requires being able to advance the system clock (or to run the app on three different days). On a staging machine:

1. As admin, on a product, enable promo (any type/value), set `Desde = T+1`, `Hasta = T+3` where T is today.
2. As cashier (still day T), add the product → **normal price**, no badge, no "Ahorrás".
3. Advance system clock to T+1. Without changing the product, add it → **promo price**, badge, "Ahorrás".
4. Advance to T+4. Add it → **normal price** again, no badge.
5. Verify no admin action was needed at any step.

**Expected**: behaviour transitions automatically at calendar-day boundaries in the local timezone.

**Covers**: FR-005, US2 scenarios 1–4, R4.

---

## Test 5 — Date-range validation (US2.5, FR-004)

As admin: try to save promo with `Desde = 2026-06-10`, `Hasta = 2026-06-05` → save fails with "La fecha 'Desde' debe ser anterior o igual a 'Hasta'.". The form stays open.

**Covers**: FR-004.

---

## Test 6 — Supervisor disables a live promo and POS reflects it on next add (P3, US3)

1. As admin, enable a promo on a product with no date range.
2. As cashier, add it to a cart (verify promo line) but **do not check out**.
3. Sign out (or in a second machine) sign in as supervisor.
4. Edit the same product → turn promo **off** → save.
5. As cashier (same cart still open), add the **same product again**.

**Expected**:
- The original line, added before the disable, keeps its promo price (snapshot — FR-008).
- The new line uses the normal price with no badge.
- Both lines appear in the cart correctly summed.

**Covers**: FR-008, FR-015, US3 scenarios 1, 2.

---

## Test 7 — Cashier cannot edit promo (FR-001)

1. As **cashier**, open the products listing (cashier-accessible per the existing matrix for `products:getAll`).
2. Attempt to navigate to a product's edit form.

**Expected**: the edit controls are not available (cashier already cannot reach `ProductoFormPage.tsx` in the existing app — verify the promo section is also absent if they happen to land on a read-only view).

3. (Optional, dev-tools test) Try to invoke `window.api.products.update({ id, promo_enabled: true, ... })` from the renderer console while signed in as cashier.

**Expected**: the IPC call rejects with the existing authorization error (matrix entry already restricts to admin/supervisor).

**Covers**: FR-001, US3 scenario 3.

---

## Test 8 — Receipt shows the "Ahorrás" totals line (FR-010)

1. As cashier with at least one promo line in the cart (and a non-promo line, to verify the math), complete the sale (any payment method).
2. Print the thermal ticket AND view the PDF ticket from the Sale Detail screen.

**Expected**:
- Both renditions display, above the **TOTAL** line, a single line `Ahorrás Gs. N` where `N` is the sum of `(normal − promo) × qty` across all promo lines in the sale, formatted with es-PY separators.
- A sale with no promo lines prints with no "Ahorrás" line — byte-identical to current output.

**Covers**: FR-010, R8, SC-005.

---

## Test 9 — "Solo en promo" filter on the product listing (FR-011)

1. As admin, create a mix: 2 products with active promos, 2 with promo_enabled but date range in the future, 2 with no promo.
2. On **Productos**, toggle the **Solo en promo** filter.

**Expected**: only the 2 active-today promos appear in the list (paged).

3. Untoggle the filter → full list returns. Toggle while a search term is also entered → both filters compose (AND).

**Covers**: FR-011, R7.

---

## Test 10 — Audit trail captures promo changes (FR-012)

Run a quick sequence as admin: enable a promo, edit it (change percentage), disable it.

Then in a sqlite shell (or via an admin tool) inspect `action_logs`:

```sql
SELECT id, user_id, action, details, created_at
FROM action_logs
WHERE action IN ('promo_enable','promo_update','promo_disable')
ORDER BY id DESC
LIMIT 10;
```

**Expected**: three rows in order, each attributed to the admin user. `details` contains valid JSON matching the shapes in the data model.

**Covers**: FR-012, R9.

---

## Test 11 — Migration v8 idempotency

1. Quit the app.
2. Re-launch.

**Expected**: app starts cleanly, no migration errors, `schema_migrations` already shows `version = 8` from the first run, no second backup is taken for v8.

3. (Optional, hard test) Open `pos.db` in sqlite shell and run the migration SQL by hand — it must be a no-op given the `PRAGMA table_info` guards.

**Covers**: migration idempotency (Principle VI rule 2).

---

## Test 12 — Cart line stability across promo expiry mid-sale (FR-008 edge case)

1. As admin, set a promo with `Hasta = T` (today).
2. As cashier, add the product to a cart **before** local midnight.
3. Hold the ticket in memory across midnight (suspend with F9 and resume after midnight, or — easier — let the system clock advance via a manual change).
4. Resume the cart and look at the line.

**Expected**: the line continues to show the promo unit_price and "Ahorrás" — the expiry does not retroactively re-price a line already added.

5. Add the **same product** to a new line after midnight.

**Expected**: the new line uses the normal price.

**Covers**: FR-008, spec Edge Cases, R3.

---

## Success-criteria coverage matrix

| SC | Covered by tests |
|----|------------------|
| SC-001 (next add reflects within 2 s) | Tests 1, 6 |
| SC-002 (100% of active-promo lines priced at promo) | Tests 1, 2, 4 |
| SC-003 (100% of inactive-promo lines priced at normal) | Tests 4 (off-window), 6 (post-disable), 7 |
| SC-004 (1-click "Solo en promo" filter) | Test 9 |
| SC-005 ("Ahorrás" on at least 95% of promo-bearing receipts) | Test 8 |
| SC-006 (zero "me cobraron precio normal" complaints) | Indirect — Tests 1–6 prevent the regressions that would generate those complaints |
