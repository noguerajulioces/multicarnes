# Login & session — test cases

Module: `src/renderer/src/modules/login`
Prefix: `LOG`

| ID      | Title                                  | Priority |
| ------- | -------------------------------------- | -------- |
| LOG-001 | Login with valid credentials           | P1       |
| LOG-002 | Login with invalid password            | P1       |
| LOG-003 | Login with non-existent user           | P2       |
| LOG-004 | Empty fields validation                | P2       |
| LOG-005 | Logout clears session                  | P1       |
| LOG-006 | Session survives app restart           | P2       |
| LOG-007 | Disabled user cannot log in            | P2       |

---

## LOG-001 — Login with valid credentials

**Preconditions:** Fresh install, app on login screen.
**Steps:**

1. Enter username `admin`.
2. Enter password `admin123`.
3. Click **Login**.

**Expected:** User lands on the dashboard. Username and role are visible in the header.

---

## LOG-002 — Login with invalid password

**Preconditions:** Login screen.
**Steps:**

1. Enter username `admin`.
2. Enter password `wrongpass`.
3. Click **Login**.

**Expected:** Inline error: "Invalid credentials". User stays on login screen. Password field is cleared or focused.

---

## LOG-003 — Login with non-existent user

**Steps:**

1. Enter username `ghost_user`.
2. Enter any password.
3. Click **Login**.

**Expected:** Same generic error as LOG-002 (do not leak whether the user exists).

---

## LOG-004 — Empty fields validation

**Steps:**

1. Click **Login** with both fields empty.
2. Fill only username, click **Login**.
3. Fill only password, click **Login**.

**Expected:** Form-level or per-field validation prevents submit. No network/IPC call is made.

---

## LOG-005 — Logout clears session

**Preconditions:** Logged in.
**Steps:**

1. Open the user menu in the header.
2. Click **Logout**.

**Expected:** App returns to login screen. Going Back / refreshing does not restore the session. Pressing Login again works normally.

---

## LOG-006 — Session survives app restart

**Preconditions:** Logged in.
**Steps:**

1. Close the app from the title bar.
2. Reopen the app.

**Expected:** Either (a) login is required again, or (b) session is restored — whichever the product spec defines. Behavior must be consistent and not show a half-loaded UI.

---

## LOG-007 — Disabled user cannot log in

**Preconditions:** A user has been marked inactive in the Users module.
**Steps:**

1. Try to log in with that user's credentials.

**Expected:** Error: "User is disabled" (or the equivalent). User is not granted access.
