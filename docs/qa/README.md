# QA — POS Multicarnes

Manual testing guide for the POS Multicarnes desktop app (Electron + React + SQLite).

## 1. Scope

This folder contains everything QA needs to validate a build before release:

- [release-checklist.md](release-checklist.md) — fast smoke test to run on every build.
- [test-cases/](test-cases/) — detailed cases per module (login, sales, cash, products, etc.).
- [bug-report-template.md](bug-report-template.md) — format for filing defects.

## 2. Test environment

### Supported platforms

| OS      | Versions                       | Notes                       |
| ------- | ------------------------------ | --------------------------- |
| Windows | 10, 11                         | Primary target              |
| macOS   | 13+ (Ventura)                  | Secondary                   |
| Linux   | Ubuntu 22.04+                  | Best-effort                 |

### Hardware requirements

- Thermal printer (ESC/POS, USB or network) — required for sales ticket tests.
- Barcode scanner (HID keyboard mode) — recommended for product tests.
- Cash drawer (optional, opens via printer pulse).

### Build under test

QA receives a signed installer per platform from the release pipeline:

- Windows: `pos-multicarnes-Setup-x.y.z.exe`
- macOS: `pos-multicarnes-x.y.z.dmg`
- Linux: `pos-multicarnes-x.y.z.AppImage`

The app stores its SQLite database in the OS user-data directory:

- Windows: `%APPDATA%\pos-multicarnes\`
- macOS: `~/Library/Application Support/pos-multicarnes/`
- Linux: `~/.config/pos-multicarnes/`

> Delete this folder to reset the app to a clean state between test runs.

## 3. Test data

Use the seed admin user that ships with a fresh install:

- **Username:** `admin`
- **Password:** `admin123`

> Change the password as part of the first-login flow (covered in [test-cases/login.md](test-cases/login.md)).

After login, create the following baseline data once per fresh DB:

1. At least 2 product categories.
2. At least 5 products with stock and barcode.
3. At least 1 customer with RUC/CI.
4. Open a cash session before running sales tests.

## 4. Test execution flow

For each release candidate:

1. Install on a clean machine (or wipe the user-data folder).
2. Run [release-checklist.md](release-checklist.md) — must pass 100%.
3. Run module test cases relevant to the changes (see release notes / CHANGELOG).
4. File any defect using [bug-report-template.md](bug-report-template.md).
5. Sign off the release in the QA log.

## 5. Test case format

Every case follows this structure:

| Field              | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| **ID**             | Stable identifier, e.g. `SAL-001`                    |
| **Title**          | Short description                                    |
| **Priority**       | P1 (blocker) / P2 (major) / P3 (minor)               |
| **Preconditions**  | Required state before steps (logged in, cash open…)  |
| **Steps**          | Numbered actions                                     |
| **Expected**       | Observable result                                    |

Result is recorded as **Pass / Fail / Blocked** with a short note and, for failures, a linked bug ID.

## 6. Reporting bugs

Use [bug-report-template.md](bug-report-template.md). Always include:

- App version (visible in the About / footer).
- OS and version.
- Steps to reproduce (numbered, from a known state).
- Expected vs. actual.
- Screenshots, screen recording, and the SQLite DB file when relevant.
- Console / log output (`View → Toggle Developer Tools → Console`).

## 7. Severity vs. priority

| Severity   | Definition                                          |
| ---------- | --------------------------------------------------- |
| Critical   | Data loss, cannot bill, app crashes on launch.      |
| Major      | A core flow is broken but workaround exists.        |
| Minor      | Cosmetic, copy, layout, non-blocking.               |

Priority (P1/P2/P3) is set by the product owner, not QA.
