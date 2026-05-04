# Users & roles — test cases

Module: `src/renderer/src/modules/usuarios`
Prefix: `USR`

| ID      | Title                                          | Priority |
| ------- | ---------------------------------------------- | -------- |
| USR-001 | Create user with role                          | P1       |
| USR-002 | Validation: duplicate username                 | P2       |
| USR-003 | Edit user (change role / name)                 | P2       |
| USR-004 | Reset / change password                        | P1       |
| USR-005 | Disable user                                   | P1       |
| USR-006 | Cashier role: restricted access                | P1       |
| USR-007 | Admin role: full access                        | P1       |
| USR-008 | Audit: user shown on sale / cash close         | P2       |

---

## USR-001 — Create user

**Steps:**

1. Open Users → **New**.
2. Fill: full name, username, password, role (admin / cashier / …), active flag.
3. Save.

**Expected:** User listed and can log in immediately.

---

## USR-002 — Duplicate username

**Steps:**

1. Try to create a user with an existing username.

**Expected:** Save blocked with a clear error.

---

## USR-003 — Edit user

**Steps:**

1. Edit an existing user, change role and full name.

**Expected:** New role is enforced on next login (or live, per spec). Full name updates in the header.

---

## USR-004 — Change password

**Steps:**

1. Reset password for a user.
2. Log in as that user with the new password.
3. Log in with the old password.

**Expected:** New password works. Old password is rejected.

---

## USR-005 — Disable user

**Steps:**

1. Mark a user as inactive.
2. Try to log in as that user.

**Expected:** Login is blocked (covers LOG-007).

---

## USR-006 — Cashier restrictions

**Preconditions:** Logged in as a `cashier` role user.
**Steps:**

1. Try to access Users, Reports (financial), Configuration, Backup.
2. Try to void a sale or close another cashier's session.

**Expected:** Restricted modules / actions are hidden or denied. Cashier can only run sales, attend their own cash, and basic customer / product lookups (per spec).

---

## USR-007 — Admin permissions

**Preconditions:** Logged in as admin.
**Steps:**

1. Access every module.
2. Perform privileged actions (void, refund, change config).

**Expected:** All actions succeed.

---

## USR-008 — User auditing on records

**Steps:**

1. As cashier A, do a sale.
2. As cashier B, do a sale.
3. Open both sales.

**Expected:** Each sale shows the cashier who created it. Cash session shows opener and closer.
