# Multicarnes POS

![Version](https://img.shields.io/badge/version-1.6.9-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC.svg?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

Desktop Point of Sale (POS) system for **Multicarnes S.R.L.** (Encarnación, Paraguay), built with Electron, React, and TypeScript. Manages sales, cash registers, products, purchases, customers, reports, and users on a local SQLite database, with thermal printing, barcode/scale input, and self-updating packaged builds.

## Features

- **Sales (POS)** with name or barcode search, products priced by kg or by unit, variable-weight scale barcodes, discounts, and payments in cash, transfer, credit (fiado), or mixed. Tickets can be held per cashier and resumed later.
- **Promotional pricing** per product (fixed Gs. or % off, optional date range), applied automatically at the register; the receipt prints an "Ahorrás" line when a sale used promo prices.
- **Cash management** with opening (zero balance allowed with explicit confirmation), closing, and reconciliation, manual income/expense logging, and shift summaries.
- **Cash movements history** ("Movimientos de Caja") with server-side pagination, role-aware filters, append-only voiding (anular), and Excel export.
- **Products and stock** with categories, low-stock alerts, and audited stock adjustments in three modes (sumar / restar / reemplazar), with full traceability.
- **Purchases and suppliers** with purchase orders, goods reception, and cost history.
- **Customers** with credit (fiado) balances and payment recording in two modes — **cash** (affects the cash register) or **salary deduction** (does not) — plus a full activity sheet.
- **Receipt delivery** beyond the thermal printer: share by **WhatsApp** (plain text via `wa.me`), download as **PNG image**, or as **PDF**, from the post-sale modal and the sales history detail.
- **Reports** for sales by period, top products (with net revenue), profit margins, stock movements, and cash closures, with charts (Recharts) and Excel / PDF export.
- **Users and roles** (Admin, Supervisor, Cashier) with PIN authentication hashed with bcrypt, and **server-side IPC authorization** for privileged operations.
- **Self-service profile** at `/perfil` (avatar in header or user block in sidebar) so any user can review their account and change their own PIN, with current-PIN verification.
- **Header notifications** with a per-user read state (debtor customers and below-minimum stock), and an onboarding tour for first-time users.
- **Backups** of the database, automated on cash closure with manual restore, plus automatic pre-migration backups.
- **Auto-update** for packaged builds via `electron-updater`, with file logging via `electron-log`.

## Tech stack

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| Desktop framework | Electron 39 + electron-vite                 |
| UI                | React 19 + TypeScript 5.9 + Tailwind CSS 4  |
| Global state      | Zustand                                     |
| Routing           | React Router DOM 7                          |
| Database          | SQLite (`better-sqlite3`)                   |
| Security          | bcryptjs (PIN hash)                         |
| Printing          | node-thermal-printer (ESC/POS)              |
| Charts            | Recharts                                    |
| Reports / export  | xlsx + jsPDF                                |
| Dates             | date-fns                                    |
| Onboarding        | @reactour/tour                              |
| Updates / logging | electron-updater + electron-log             |
| Testing           | Vitest (integration) + Playwright (e2e)     |
| Packaging         | electron-builder                            |

Currency: **Guaraníes (Gs.)** — integers, no decimals.

## Project structure

```
pos-multicarnes/
├── docs/            # Technical documentation (DB schema, spec, user manual, QA)
├── specs/           # Feature specs (001–008), one folder per shipped feature
├── .specify/        # Constitution, functional spec, and gap analysis
├── tests/
│   ├── integration/ # Vitest tests against a real SQLite DB
│   └── e2e/         # Playwright end-to-end tests
├── scripts/         # Auxiliary scripts (auth smoke test, etc.)
├── src/
│   ├── main/        # Electron main process
│   │   ├── db/      # SQLite schema, versioned migrations, seed, queries
│   │   ├── ipc/     # IPC handlers per module
│   │   └── updater.ts
│   ├── preload/     # Secure main ↔ renderer bridge
│   ├── renderer/    # React app (modules, stores, components, lib)
│   └── shared/      # Shared TypeScript types
├── resources/       # Icons and packaged resources
├── build/           # Build resources (entitlements, etc.)
├── electron-builder.yml
└── electron.vite.config.ts
```

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- On Windows, native build tools for `better-sqlite3` (Visual Studio Build Tools).
- On macOS, Xcode Command Line Tools.

> `better-sqlite3` is a native module. The `predev` / `prestart` / `postinstall` scripts run `electron-builder install-app-deps` so the binary matches Electron's ABI. Integration tests run against Node, so `pretest:integration` rebuilds it for Node first. If you hit a `NODE_MODULE_VERSION` mismatch, re-run the relevant rebuild step (`npm run rebuild:node` or `npm run rebuild:electron`).

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Auxiliary commands:

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run typecheck     # Type-check main + renderer
npm run smoke:auth    # Quick auth smoke test (tsx)
```

## Testing

```bash
npm run test:integration          # Vitest, against a real SQLite DB
npm run test:integration:watch    # Watch mode
npm run test:integration:coverage # With coverage (v8)
npm run test:e2e                  # Playwright end-to-end
npm test                          # Integration + e2e
```

Integration tests live in [`tests/integration/`](tests/integration) and exercise the main-process IPC/query layer against a temporary SQLite database. End-to-end tests in [`tests/e2e/`](tests/e2e) drive the packaged app with Playwright (auth, sales, cash, products, customers, purchases, reports, users, backup, authorization, and more).

## Production build

```bash
npm run build         # typecheck + electron-vite build
npm run build:win     # Windows (NSIS installer)
npm run build:mac     # macOS (dmg)
npm run build:linux   # Linux (AppImage / snap / deb)
npm run build:unpack  # Unpacked build (for inspection)
```

Artifacts are generated under `dist/`.

## Release

Releases are automated with **release-it** (Conventional Commits):

```bash
npm run release       # bump version + changelog + commit + tag + push
```

Pushing the `vX.Y.Z` tag triggers the CI build. See [`CHANGELOG.md`](CHANGELOG.md) for the full history.

## Database

- Local SQLite database created automatically at `app.getPath('userData')/pos.db` on first launch.
- Synchronous access via `better-sqlite3` from the main process.
- The renderer **never** queries the DB directly: all communication goes through IPC (`module:action`).
- Sale and payment operations are wrapped in transactions to guarantee stock and cash consistency.
- **Versioned migrations** (currently up to v12) apply additively on startup; a pre-migration backup of the DB is written before each upgrade.

Initial data (seed):

- Default categories: Vacuno, Cerdo, Pollo, Embutidos, Otros.

## Roles and permissions

| Module                                | Admin | Supervisor | Cashier |
| ------------------------------------- | :---: | :--------: | :-----: |
| Login / Dashboard                     |   ✓   |     ✓      |    ✓    |
| Cash register (open / view)           |   ✓   |     ✓      |    ✓    |
| Cash closure                          |   ✓   |     ✓      |    ✗    |
| Sales                                 |   ✓   |     ✓      |    ✓    |
| Customer payments (cash / deduction)  |   ✓   |     ✓      |    ✓    |
| Profile / change own PIN              |   ✓   |     ✓      |    ✓    |
| Products (edit / adjust stock)        |   ✓   |     ✓      |    ✗    |
| Purchases / Customers / Reports       |   ✓   |     ✓      |    ✗    |
| Users / Settings                      |   ✓   |     ✗      |    ✗    |

Authorization is enforced **server-side** in the IPC layer, not just hidden in the UI.

## Receipt printing & sharing

The receipt pipeline is centralised in [`src/renderer/src/lib/ticket.ts`](src/renderer/src/lib/ticket.ts), which converts a `Sale` plus business settings into a paper-aware list of formatted lines. From that single representation:

- [`Ticket.tsx`](src/renderer/src/modules/ventas/Ticket.tsx) renders an on-screen preview using a monospaced font and the exact target paper width (220 px for 58 mm, 320 px for 80 mm).
- [`ticket-pdf.ts`](src/renderer/src/lib/ticket-pdf.ts) exports the same lines to a PDF sized to the paper width.
- [`print.ipc.ts`](src/main/ipc/print.ipc.ts) sends the lines to a thermal printer via `node-thermal-printer`.

After confirming a sale, [`TicketPreviewModal`](src/renderer/src/modules/ventas/TicketPreviewModal.tsx) opens with the preview and actions to print, export PDF, or start a new sale. The print button checks for a configured printer in advance; if none is set, it is replaced by **Configurar impresora**, which navigates to Settings. The IPC handler returns `{ ok, error? }` instead of throwing, keeping the dev console free of stack traces for expected failures (no printer configured, printer offline).

When no printer is available, the receipt can be delivered by **WhatsApp** (plain text), **PNG image**, or **PDF** from the same modal and from the sales history detail.

To configure a printer, go to **Configuración → Impresora térmica** and fill in the OS-reported printer name and paper width.

## Documentation

All project documentation lives in [`docs/`](docs/README.md). Start at the [docs index](docs/README.md) — it links to:

- [`database.md`](docs/database.md) — schema, ER diagram (Mermaid), table reference, transactional flows, and migrations.
- [`MANUAL.md`](docs/MANUAL.md) — end-user manual.
- [`qa/`](docs/qa/README.md) — manual QA guide and per-module test cases.

Per-feature design docs live under [`specs/`](specs), and the locked-stack rules, functional inventory, and risk register live under [`.specify/`](.specify/memory).

## Recommended IDE

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) — generated from Conventional Commits and following [Semantic Versioning](https://semver.org/).

## Author

**Julio Noguera** — developed for Multicarnes S.R.L.
