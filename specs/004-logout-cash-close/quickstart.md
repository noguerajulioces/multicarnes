# Quickstart QA: Logout Requires Cash Register Close

**Feature**: 004-logout-cash-close
**Audience**: QA / developer verifying the feature end-to-end against a live build.
**Prereqs**: `npm install`, `npm run dev` starts cleanly; a database with at least three users seeded — one admin, one supervisor, one cashier.

All UI copy in this feature is Spanish. The on-screen text below quotes the expected labels verbatim so the tester can match exactly.

---

## Test 1 — Cashier with open register is blocked (P1 / FR-001, FR-002, FR-003)

1. Sign in as the cashier user.
2. Open a cash register: navigate to the cash flow and use the existing "Abrir caja" with any opening amount.
3. From the main UI, click **Cerrar sesión** in the header (or sidebar — repeat for each entry point in Test 5).
4. **Expected**: a modal appears with:
   - A title indicating logout is blocked because the user has an open register.
   - The opening time and opening amount of the open register visible.
   - A primary button labeled **"Cerrar caja ahora"**.
   - A secondary button labeled **"Cancelar"**.
   - No "logout anyway" or "ignore" button.
5. Click **Cancelar** → the modal closes; the user remains signed in on the same page; nothing else changes.
6. Trigger logout again → the modal reappears (state is recomputed each time).
7. Click **Cerrar caja ahora** → the app navigates to the close-register page (`/caja/cierre`) with the cashier's open register already preselected (the page shows the same register without a manual choose step).
8. Complete the close-register flow normally (enter counted amount, optional notes, confirm).
9. After the close succeeds, trigger logout again.
10. **Expected**: logout proceeds immediately; the app navigates to the login screen with no modal interruption.

---

## Test 2 — Cashier without open register logs out normally (FR-004, SC-004)

1. Sign in as the cashier user, with no open register in their name (close any open register first).
2. Trigger logout.
3. **Expected**: logout proceeds immediately; no modal appears; latency is indistinguishable from before this feature shipped.

---

## Test 3 — Admin/Supervisor not blocked by other users' open registers (P2 / FR-006)

1. As the cashier, open a cash register and then sign out via Test 1 → close-register → logout (or leave the cashier's register open for the next step).
   - For the "leave open" variant: sign out the cashier via Test 1; the register stays open in the DB.
2. Sign in as the admin user. Do **not** open a register in the admin's own name.
3. Trigger logout.
4. **Expected**: logout proceeds immediately; no modal; the cashier's open register does not block the admin.
5. Repeat with the supervisor user. Same expected result.

---

## Test 4 — Admin/Supervisor blocked when *they* have an open register (P2 / FR-005)

1. Sign in as the admin user.
2. Open a register in the admin's own name (admins can open registers).
3. Trigger logout.
4. **Expected**: same blocked-logout modal as in Test 1, identifying the admin's own register. The role is irrelevant — the trigger is "this user owns an open register."
5. Either close the register (logout then proceeds) or cancel (admin stays signed in).
6. Repeat with the supervisor user. Same expected behavior.

---

## Test 5 — All logout entry points use the same guard (FR-007)

For each of the three logout UI affordances:

- **Header → "Cerrar sesión"** button.
- **Sidebar (expanded)** → "Cerrar sesión" button.
- **Sidebar (collapsed)** → icon-only logout button.

Sign in as a cashier with an open register and trigger logout via that affordance. The same blocked-logout modal must appear in all three cases. No affordance is allowed to bypass the guard.

---

## Test 6 — Fail-closed on IPC / DB error (FR-008)

This test requires a development environment where IPC can be simulated to fail. If not feasible to simulate, document this test as "deferred to runtime monitoring."

1. Sign in as any user (with or without an open register).
2. Temporarily break the `cash:getMyOpenRegister` handler (e.g., throw an error from the handler).
3. Trigger logout.
4. **Expected**: the modal opens in an **error state**:
   - Message conveys the system could not verify register state.
   - A single **"Reintentar"** button is visible.
   - No "logout anyway" button.
5. Restore the handler and click **Reintentar**.
6. **Expected**: the check re-runs successfully; either logout proceeds (no open register) or the modal switches to the normal block state.

---

## Test 7 — Force-quit recovery surfaces the same reminder (FR-007, edge case)

This test verifies the spec's requirement that paths the guard cannot intercept (force-quit, OS kill) are compensated by re-surfacing the close-register reminder on the next sign-in.

1. Sign in as the cashier; open a register.
2. Force-quit the app (Cmd+Q on macOS, equivalent on Windows). Do **not** sign out through the UI.
3. Relaunch the app; sign in as the **same** cashier.
4. **Expected**: the cashier's open register is still open in the DB. Trigger logout — the same blocked-logout modal appears. The user is never able to silently leave a register open across sessions.

(Note: the spec does not require an *automatic* reminder banner on sign-in beyond what the existing dashboard already shows. The blocked-logout modal on the next logout attempt is the enforcement point.)

---

## Sign-off

- [ ] Test 1 passes (cashier blocked, shortcut works, logout proceeds after close)
- [ ] Test 2 passes (no-open-register logout is unchanged)
- [ ] Test 3 passes (admin/supervisor not blocked by other users)
- [ ] Test 4 passes (admin/supervisor blocked by their own open register)
- [ ] Test 5 passes (all 3 logout buttons guarded)
- [ ] Test 6 passes (fail-closed on IPC error) — or marked deferred
- [ ] Test 7 passes (force-quit → next-login logout is still guarded)

Reviewer notes: _______________________________________________________________
