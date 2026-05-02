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
- **Cash management** with opening, closing, and reconciliation, manual income/expense logging, and shift summaries.
- **Products and stock** with categories, low-stock alerts, audited adjustments, and traceability.
- **Purchases and suppliers** with purchase orders, goods reception, and cost history.
- **Customers** with credit balances, payment recording, and full activity sheet.
- **Reports** for sales by period, top products, profit margins, stock movements, and cash closures, exportable to Excel and PDF.
- **Users and roles** (Admin, Supervisor, Cashier) with PIN authentication hashed with bcrypt.
- **Thermal printing** of receipts (58 mm / 80 mm) via `node-thermal-printer`.
- **Backups** of the database, automated on cash closure with manual restore.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop framework | Electron + electron-vite |
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| Global state | Zustand |
| Routing | React Router DOM |
| Database | SQLite (`better-sqlite3`) |
| Security | bcryptjs (PIN hash) |
| Printing | node-thermal-printer |
| Reports | xlsx + jsPDF |
| Packaging | electron-builder |

Currency: **Guaraníes (Gs.)** — integers, no decimals.

## Project structure

```
pos-multicarnes/
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

| Module | Admin | Supervisor | Cashier |
|---|:---:|:---:|:---:|
| Login / Dashboard | ✓ | ✓ | ✓ |
| Cash register (open / view) | ✓ | ✓ | ✓ |
| Cash closure | ✓ | ✓ | ✗ |
| Sales | ✓ | ✓ | ✓ |
| Products (edit) | ✓ | ✓ | ✗ |
| Purchases / Customers / Reports | ✓ | ✓ | ✗ |
| Users / Settings | ✓ | ✗ | ✗ |

## Documentation

The full technical specification (DB schema, modules, business rules, IPC, and types) lives in [spec_pos_multicarnes.md](spec_pos_multicarnes.md).

## Recommended IDE

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### [Unreleased]
- Onboarding tour for first-time users (`@reactour/tour`).

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
