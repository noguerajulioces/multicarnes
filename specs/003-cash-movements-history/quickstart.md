# Quickstart: Cash Movements History — Manual Verification

**Feature**: 003-cash-movements-history
**Date**: 2026-05-11
**Audience**: QA / developer doing hand verification after the implementation lands.

These checks together exercise FR-001 through FR-033 and SC-001 through SC-008. They are written to be run against a live build (`npm run dev` or an installed `pos-multicarnes-1.x.0-setup.exe`) on a database that has at least one closed cash register session, at least one manual income, at least one manual expense, and at least two cashier users.

## Prerequisites

- Two cashier accounts (`cashier-a`, `cashier-b`) and one admin (`owner`).
- A populated `pos.db` predating this migration. If your dev DB is empty, run `scripts/auth-smoke.ts` once to seed users and a sample register, then add a couple of movements through `CajaPage`.
- Pre-migration row counts captured (for §2.5):

  ```sh
  sqlite3 ~/Library/Application\ Support/pos-multicarnes/pos.db \
    "SELECT COUNT(*) FROM cash_movements;"
  ```

## §1. Sidebar entry & role visibility (FR-001, FR-009, FR-010, FR-015, FR-018)

1. Log in as **owner** (admin). Observe a new sidebar entry "Movimientos de Caja". Click it. The page renders, defaulting to today's date range.
2. Verify the filter bar exposes: Date range, Type multiselect, Cashier dropdown (enabled), Cash register session dropdown, Description search, Page size selector, Export button.
3. Verify each row shows a "Anular" action button when applicable. Verify the void button is **not shown** on rows where `type IN ('opening', 'closing', 'void')` nor on rows that are already voided.
4. Log out. Log in as **cashier-a**. Observe the sidebar entry is visible.
5. Open the page. The Cashier filter is locked to "cashier-a" (disabled control). The "Anular" button is **not present** on any row.
6. Manipulate the request via DevTools console: `window.api.cashMovements.list({ userId: <id of cashier-b> })`. Verify the returned items still only contain rows where `userId === <id of cashier-a>` — i.e., the server-side override worked.
7. Manipulate via DevTools: `window.api.cashMovements.void(<id of a movement>)`. Verify the call rejects with an authorization error and that an entry appears in `auth_audit` with `outcome='blocked-insufficient-role'`.

✅ Passing means cashier-self scoping cannot be bypassed and void is admin-only.

## §2. Migration v7 against an existing populated database (FR-002, FR-003)

1. Before launching, snapshot `pos.db` to `pos.db.pre-v7.bak`.
2. Launch the app. Migration runs at start.
3. Verify schema state:

   ```sql
   SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
   -- → 7
   PRAGMA table_info(cash_movements);
   -- → includes a void_of column with type INTEGER, notnull=0
   SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements';
   -- → CHECK(type IN ('income','expense','opening','closing','void'))
   ```

4. Verify backfill:

   ```sql
   -- Every register has exactly one opening row.
   SELECT cr.id, COUNT(*) FROM cash_registers cr
   LEFT JOIN cash_movements cm ON cm.register_id = cr.id AND cm.type = 'opening'
   GROUP BY cr.id HAVING COUNT(*) <> 1;
   -- → 0 rows
   -- Every CLOSED register has exactly one closing row.
   SELECT cr.id, COUNT(*) FROM cash_registers cr
   LEFT JOIN cash_movements cm ON cm.register_id = cr.id AND cm.type = 'closing'
   WHERE cr.status = 'closed' GROUP BY cr.id HAVING COUNT(*) <> 1;
   -- → 0 rows
   ```

5. Verify no manual income/expense row was lost or duplicated:

   ```sql
   SELECT COUNT(*) FROM cash_movements WHERE type IN ('income','expense');
   -- → matches the pre-migration count from §Prerequisites
   ```

6. **Re-run safety**: shut the app, change `schema_migrations` to delete the v7 row, restart. The migration runs again, no rows are duplicated (`NOT EXISTS` guards do their job), no exception is thrown.

✅ Passing means the migration is forward-compatible, idempotent, and lossless.

## §3. Filtering, pagination, search (FR-005–FR-014, SC-006)

1. As **owner**, set Date range = last 30 days. Verify pagination controls show `Total: N` and pages navigate correctly.
2. Set Type filter to `{ expense }`. Confirm only expenses appear.
3. Set Cashier filter to `cashier-a`. Confirm only `cashier-a`'s rows appear.
4. Set Register filter to a specific session. Confirm only that session's rows appear.
5. Type `gasolina` (or any substring known to match one description) in the Search box. Confirm filtering is case-insensitive and partial-match.
6. Change Page size to 100. Confirm the rows per page change; total page count drops accordingly.
7. Apply a filter, navigate to page 3, then change a filter. Confirm the page resets to 1.
8. Apply filters, navigate away to /ventas, come back. Confirm filters are preserved (URL search params).
9. Cold reload (Ctrl+R / restart app). Filters reset to defaults (today).

**Performance check (SC-006).** Against a populated DB (≥10k movements is sufficient), first page returns in well under one second. Measure: in DevTools Network tab, inspect the IPC roundtrip duration.

## §4. Void flow (FR-019–FR-025, SC-004, SC-008)

1. As **owner**, find a manual expense row. Click "Anular". Confirm the action prompt.
2. Within 5 seconds (SC-004), observe:
   - The original row's amount is struck-through and a "Anulado" badge appears.
   - A new row with `type=void` appears, same absolute amount, description prefixed with `[ANULACIÓN]`, linked back to the original.
   - The "Anular" button disappears from the original.
3. Click the "Anular" button again on the *same* original via DevTools (`window.api.cashMovements.void(<id>)`). Verify the call rejects with `'Este movimiento ya fue anulado.'` and that no second inverse row is created.
4. Try voiding an `opening` row via DevTools. Verify `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'`
5. Try voiding the void row itself via DevTools. Verify `'No se puede anular una anulación.'`
6. Verify `auth_audit` has exactly one new row with `operation='cashMovements:void'` and `outcome='allowed'`. Verify `action_logs` has one new row with `action='void_cash_movement'` and a JSON-shaped `details` field with both ids.

**Pair integrity (SC-008).**

```sql
-- Every void has exactly one original.
SELECT id FROM cash_movements WHERE type='void' AND void_of IS NULL; -- → 0 rows
-- No two voids point to the same original.
SELECT void_of, COUNT(*) FROM cash_movements
WHERE type='void' GROUP BY void_of HAVING COUNT(*) > 1; -- → 0 rows
```

## §5. Cross-module navigation (FR-031, FR-032)

1. Click the register session id on any row from a *closed* session. Confirm the browser navigates to Reportes → Cierres Caja with that session expanded.
2. Click the register session id on a row from the *currently open* session. Confirm the browser navigates to CajaPage (the open-register page).
3. On a voided original, click the "void by" link in the row. Confirm the URL/filter switches to highlight the inverse row.
4. On a void row, click the "void of" link. Confirm it highlights the original.

## §6. Excel export (FR-026–FR-030, SC-005)

1. As **owner**, apply filters that yield ~50 rows. Click Export.
2. The file downloads as `movimientos-caja_<from>_<to>.xlsx`. Open it; every filtered row is present.
3. Apply filters that yield >100 rows but <5000. Click Export. Verify the file contains *all* rows across pages, not just the visible page. Measure: should complete within 10 seconds.
4. Apply filters that yield >5000 rows. Click Export. Verify the file completes within 30 seconds.
5. Apply filters that would yield >10000 rows. Verify a prompt warns the user before generating and offers to narrow the date range.

## §7. Open-register integration (synthetic emission)

1. As any cashier, open a new cash register from CajaPage.
2. Reload the "Movimientos de Caja" page. The new session appears with one `opening` row (`amount = opening_amount`, `description = 'Apertura de caja'`, `created_at` = the open time).
3. Add a manual income from CajaPage. Reload. The new income appears as a separate row.
4. Close the cash register from CierreCajaPage. Reload Movimientos de Caja. A `closing` row appears with the counted amount and (if any) the difference annotated in the description.

✅ Passing means the synthetic emission inside `openCashRegister` / `closeCashRegister` works without changing the existing UX.

## §8. Smoke-test extension

The new automated check in `scripts/auth-smoke.ts` exercises:

- Cashier scoping cannot be bypassed by passing `opts.userId` of another user (FR-015, FR-017).
- A single void creates exactly one inverse with the original preserved (FR-019, FR-021).
- A second void on the same original is rejected (FR-025).
- A void of an `opening` row is rejected (FR-022).
- A void of a `void` row is rejected (FR-023).

Run:

```sh
npm run typecheck && tsx scripts/auth-smoke.ts
```

Expected: green, with one new section "cash movements void invariants" at the bottom.
