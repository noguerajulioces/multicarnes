# Multicarnes POS

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC.svg?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

Desktop Point of Sale (POS) system for **Multicarnes S.R.L.** (Encarnación, Paraguay), built with Electron, React, and TypeScript. Manages sales, cash registers, products, purchases, customers, reports, and users, with a local SQLite database and thermal printing support.

## Features

- **Sales (POS)** with name or barcode search, support for products by kg or by unit, discounts, and payments in cash, transfer, credit (fiado), or mixed.
- **Cash management** with opening (zero balance allowed with explicit confirmation), closing, and reconciliation, manual income/expense logging, and shift summaries.
- **Products and stock** with categories, low-stock alerts, audited adjustments, and traceability.
- **Purchases and suppliers** with purchase orders, goods reception, and cost history.
- **Customers** with credit balances, payment recording, and full activity sheet.
- **Reports** for sales by period, top products, profit margins, stock movements, and cash closures, exportable to Excel and PDF.
- **Users and roles** (Admin, Supervisor, Cashier) with PIN authentication hashed with bcrypt.
- **Self-service profile** at `/perfil` (avatar in header or user block in sidebar) so any user can review their account and change their own PIN, with current-PIN verification.
- **Receipt rendering pipeline** — a single source of truth produces three outputs: an on-screen preview, a downloadable PDF (`jspdf`), and an ESC/POS print stream (`node-thermal-printer`) for 58 mm / 80 mm thermal printers.
- **Backups** of the database, automated on cash closure with manual restore.

## Tech stack

| Layer             | Technology                             |
| ----------------- | -------------------------------------- |
| Desktop framework | Electron + electron-vite               |
| UI                | React 19 + TypeScript + Tailwind CSS 4 |
| Global state      | Zustand                                |
| Routing           | React Router DOM                       |
| Database          | SQLite (`better-sqlite3`)              |
| Security          | bcryptjs (PIN hash)                    |
| Printing          | node-thermal-printer                   |
| Reports           | xlsx + jsPDF                           |
| Packaging         | electron-builder                       |

Currency: **Guaraníes (Gs.)** — integers, no decimals.

## Project structure

```
pos-multicarnes/
├── docs/            # Technical documentation (DB schema, ER diagram, etc.)
├── src/
│   ├── main/        # Electron main process (DB, IPC, services)
│   │   ├── db/      # SQLite schema, seed, and queries
│   │   └── ipc/     # IPC handlers per module
│   ├── preload/     # Secure main ↔ renderer bridge
│   ├── renderer/    # React app (modules, stores, components)
│   └── shared/      # Shared TypeScript types
├── resources/       # Icons and packaged resources
├── build/           # Build resources (entitlements, etc.)
├── electron-builder.yml
└── electron.vite.config.ts
```

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- On Windows, native build tools for `better-sqlite3` (`windows-build-tools` or Visual Studio Build Tools).
- On macOS, Xcode Command Line Tools.

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
```

## Production build

```bash
npm run build:win     # Windows (NSIS installer)
npm run build:mac     # macOS (dmg)
npm run build:linux   # Linux (AppImage / snap / deb)
npm run build:unpack  # Unpacked build (for inspection)
```

Artifacts are generated under `dist/`.

## Database

- Local SQLite database created automatically at `app.getPath('userData')/pos.db` on first launch.
- Synchronous access via `better-sqlite3` from the main process.
- The renderer **never** queries the DB directly: all communication goes through IPC (`module:action`).
- Sale operations are wrapped in transactions to guarantee stock and cash consistency.

Initial data (seed):

- Default categories: Vacuno, Cerdo, Pollo, Embutidos, Otros.

## Roles and permissions

| Module                          | Admin | Supervisor | Cashier |
| ------------------------------- | :---: | :--------: | :-----: |
| Login / Dashboard               |   ✓   |     ✓      |    ✓    |
| Cash register (open / view)     |   ✓   |     ✓      |    ✓    |
| Cash closure                    |   ✓   |     ✓      |    ✗    |
| Sales                           |   ✓   |     ✓      |    ✓    |
| Profile / change own PIN        |   ✓   |     ✓      |    ✓    |
| Products (edit)                 |   ✓   |     ✓      |    ✗    |
| Purchases / Customers / Reports |   ✓   |     ✓      |    ✗    |
| Users / Settings                |   ✓   |     ✗      |    ✗    |

## Receipt printing

The receipt pipeline is centralised in [`src/renderer/src/lib/ticket.ts`](src/renderer/src/lib/ticket.ts), which converts a `Sale` plus business settings into a paper-aware list of formatted lines. From that single representation:

- [`Ticket.tsx`](src/renderer/src/modules/ventas/Ticket.tsx) renders an on-screen preview using a monospaced font and the exact target paper width (220 px for 58 mm, 320 px for 80 mm).
- [`ticket-pdf.ts`](src/renderer/src/lib/ticket-pdf.ts) exports the same lines to a PDF sized to the paper width.
- [`print.ipc.ts`](src/main/ipc/print.ipc.ts) sends the lines to a thermal printer via `node-thermal-printer`.

After confirming a sale, [`TicketPreviewModal`](src/renderer/src/modules/ventas/TicketPreviewModal.tsx) opens with the preview and three actions: **PDF**, **Imprimir** and **Nueva Venta**. The print button checks for a configured printer in advance; if none is set, it is replaced by **Configurar impresora**, which navigates to Settings. The IPC handler returns `{ ok, error? }` instead of throwing, keeping the dev console free of stack traces for expected failures (no printer configured, printer offline).

To configure a printer, go to **Configuración → Impresora térmica** and fill in the OS-reported printer name and paper width.

## Documentation

All project documentation lives in [`docs/`](docs/README.md). Start at the [docs index](docs/README.md) — it links to the database schema, the technical specification, and any future docs.

## Recommended IDE

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### [Unreleased]

#### Added

- Onboarding tour for first-time users (`@reactour/tour`).
- Self-service profile page at `/perfil` with PIN change protected by current-PIN verification; reachable from the avatar dropdown in the header and from the user block in the sidebar (which now reflects the active route).
- Receipt rendering pipeline: shared text generator + on-screen preview + PDF export + thermal print, all driven by the same source. Preview modal opens automatically after a successful sale.
- Smooth POS entry transition (branded splash with fade-in) when navigating to `/ventas`, regardless of cash register state.
- Configurable minimum display time and fade-out for the boot splash window so the brand introduction is not cut short on fast renders.

#### Changed

- Cash register opening now allows a zero starting balance with an explicit confirmation dialog; pressing Enter submits the form.
- Print IPC contract returns `{ ok, error? }` instead of throwing, eliminating noisy stack traces in the dev console for expected failures.
- Windows / macOS icon configuration cleaned up and made explicit in `electron-builder.yml`; runtime icon for `BrowserWindow` selected per platform.

### [1.0.0] — 2026-04

#### Added

- Sales module (POS) with barcode reader, kg/unit pricing, discounts, and split payments (cash, transfer, credit, mixed).
- Cash register module with opening, manual movements, closure, and reconciliation.
- Product, category, and stock management with low-stock alerts and audited adjustments.
- Purchases module with suppliers, purchase orders, and goods reception.
- Customer module with credit (fiado) balances, payment recording, and history.
- Reports for sales, top products, margins, stock movements, and cash closures, with Excel and PDF export.
- User management with role-based access (Admin / Supervisor / Cashier) and bcrypt-hashed PINs.
- Thermal printing of receipts (58 mm / 80 mm).
- Automatic database backup on cash closure and manual restore from settings.

#### Fixed

- PDF export forced to portrait orientation regardless of column count.

## Author

**Julio Noguera** — developed for Multicarnes S.R.L.
