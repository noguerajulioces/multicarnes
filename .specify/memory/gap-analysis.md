# POS Multicarnes — Gap Analysis

> Cross-validation of [`functional-spec.md`](functional-spec.md) and [`constitution.md`](constitution.md) against the actual codebase as of branch `fix/qa-feedback-round-1`. Generated 2026-05-08.
>
> Methodology: every IPC handler, schema table, route, and major code path was inventoried; every concrete claim in the functional spec was tested against `file:line` evidence. This document corrects errors found in the functional spec along the way.

---

## 1. Fully implemented

These functional-spec features are present and behave as documented.

### Authentication & users
- PIN-based login with bcrypt hashing, inactive-user exclusion, and 6-digit format enforcement ([src/main/db/queries/users.ts:7-9, 18, 30, 35-36, 42](src/main/db/queries/users.ts)).
- First-run admin setup gated on empty user list ([src/renderer/src/modules/login/LoginPage.tsx:38, 58](src/renderer/src/modules/login/LoginPage.tsx)).
- Self-service PIN change with current-PIN re-verification ([src/renderer/src/modules/perfil/PerfilPage.tsx:78](src/renderer/src/modules/perfil/PerfilPage.tsx)).
- User CRUD with soft-deactivation via `active=0` ([src/renderer/src/modules/usuarios/UsuariosPage.tsx](src/renderer/src/modules/usuarios/UsuariosPage.tsx)).

### Sales (POS)
- In-memory cart with deduplicated rows, recomputed subtotals/totals, fixed-amount and percentage discounts ([src/renderer/src/store/cart.store.ts:23-68](src/renderer/src/store/cart.store.ts)).
- Bizerba/Toledo balance-barcode parsing (`2X` prefix → product code + grams) restricted to kg-priced products ([src/renderer/src/lib/balance-code.ts:18-36](src/renderer/src/lib/balance-code.ts)).
- Quantity / amount modal with stock cap and price-type-aware presets ([src/renderer/src/modules/ventas/VentasPage.tsx:716-900](src/renderer/src/modules/ventas/VentasPage.tsx)).
- Four payment methods (cash / transfer / credit / mixed) with mixed-up-to-3-methods validation and required-customer rule for credit portions ([src/renderer/src/modules/ventas/CobroModal.tsx:49-298](src/renderer/src/modules/ventas/CobroModal.tsx)).
- Atomic sale-creation transaction: inserts sale + items + payments + decrements stock + adjusts customer balance ([src/main/db/queries/sales.ts:18-79](src/main/db/queries/sales.ts)).
- Held tickets persisted to `localStorage['held-tickets']` across restarts ([src/renderer/src/store/held.store.ts:22-52](src/renderer/src/store/held.store.ts)).
- POS hotkeys F1/F4/F8/F9/F12 wired in `VentasPage.tsx`.

### Inventory
- Product CRUD with unique barcode constraint and soft-delete ([src/main/db/schema.ts:19-32](src/main/db/schema.ts), [src/main/db/queries/products.ts](src/main/db/queries/products.ts)).
- Eight price types with locale-aware formatting (`es-PY`) ([src/renderer/src/lib/price-types.ts:12-52](src/renderer/src/lib/price-types.ts)).
- Manual stock adjustments writing to `stock_adjustments` audit table with required reason ([src/main/db/queries/products.ts:177-182](src/main/db/queries/products.ts)).
- Low-stock alerts via `stock <= min_stock` predicate ([src/main/db/queries/products.ts:295-307](src/main/db/queries/products.ts)).
- Image upload via custom `product-img://` protocol ([src/main/ipc/products.ipc.ts:36-51](src/main/ipc/products.ipc.ts)).
- Product detail KPIs, recent sales, and movement audit ([src/renderer/src/modules/productos/ProductoDetallePage.tsx:248-401](src/renderer/src/modules/productos/ProductoDetallePage.tsx)).

### Customers
- CRUD with CI/RUC document types, signed `balance` ledger, employee flag ([src/main/db/schema.ts:34-44](src/main/db/schema.ts)).
- Customer-payment CRUD with transactional balance adjustment ([src/main/db/queries/customers.ts:105-162](src/main/db/queries/customers.ts)).
- Hard-delete blocked when `balance ≠ 0` or any sale/payment exists ([src/main/db/queries/customers.ts:165-196](src/main/db/queries/customers.ts)).

### Suppliers & purchases
- Supplier CRUD; purchase-order CRUD with `pending / received / cancelled` status ([src/main/db/queries/purchases.ts](src/main/db/queries/purchases.ts)).
- "Save as pending" vs. "Save and receive" flow; reception increments `products.stock` ([src/main/db/queries/purchases.ts:151, 176-180, 194-197](src/main/db/queries/purchases.ts)).

### Cash management
- Single-open-register invariant enforced at the **query layer** ([src/main/db/queries/cash.ts:5-6](src/main/db/queries/cash.ts)).
- Live session summary mixing direct-cash sales and the cash portion of mixed payments ([src/main/db/queries/cash.ts:55-94](src/main/db/queries/cash.ts)).
- Stale-register close logs to `action_logs` and demands notes ([src/main/db/queries/cash.ts:111-125](src/main/db/queries/cash.ts), [src/renderer/src/modules/caja/CierreCajaPage.tsx:36, 41-44](src/renderer/src/modules/caja/CierreCajaPage.tsx)).

### Reports & dashboard
- Seven report tabs (Resumen / Comparativo / Fiados / Más Vendidos / Margen / Mov. Stock / Cierres Caja) with Excel + branded PDF export ([src/renderer/src/modules/reportes/ReportesPage.tsx](src/renderer/src/modules/reportes/ReportesPage.tsx), [src/renderer/src/lib/export.ts](src/renderer/src/lib/export.ts)).
- Manager dashboard with 4 KPI cards, period selector, sales bar chart, top-5 donut, recent-sales table, stock summary ([src/renderer/src/modules/dashboard/DashboardPage.tsx](src/renderer/src/modules/dashboard/DashboardPage.tsx)).
- Cashier dashboard variant with 2 KPIs only.

### Printing
- ESC/POS thermal print via `node-thermal-printer`, configurable 58/80 mm width, paper-cut on completion ([src/main/ipc/print.ipc.ts:30-63, 76](src/main/ipc/print.ipc.ts)).
- PDF ticket via jsPDF Courier monospace, sized to thermal width, 9pt/10pt sizes ([src/renderer/src/lib/ticket-pdf.ts:6-41](src/renderer/src/lib/ticket-pdf.ts)).
- Ticket content (header / metadata / items / totals / payments / change / footer) per [src/renderer/src/lib/ticket.ts:113-195](src/renderer/src/lib/ticket.ts).

### Backup & config
- Manual backup, scheduled daily backup (60s poller, max-1-per-day), restore-with-pre-backup, and folder picker all wired ([src/main/ipc/backup.ipc.ts:6-126](src/main/ipc/backup.ipc.ts), [src/renderer/src/modules/backup/BackupPage.tsx](src/renderer/src/modules/backup/BackupPage.tsx)).
- All configurable settings persist via `app_settings` upsert ([src/main/ipc/backup.ipc.ts:121-126](src/main/ipc/backup.ipc.ts)).

### Cross-cutting
- Theme store (`localStorage`), toast store, confirm dialogs (Promise-based), guided tours (per-page, `tour:seen:*`), OS notifications via Electron `Notification`, custom titlebar with `window:*` IPC channels, splash screen with 1500 ms minimum.

---

## 2. Partially implemented

Features that exist but have specific missing pieces.

### 2.1 Sale notes — write path absent in POS UI
- Schema supports `sales.notes` ([schema.ts:89](src/main/db/schema.ts#L89)).
- Sale detail page **reads** and renders notes when present ([VentaDetallePage.tsx:244-248](src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L244-L248)).
- **Missing:** the POS / cobro flow has **no input field** to enter sale notes. The only way notes ever get populated today is through `sales.cancel(saleId, userId, reason)` (see §4.1). Functionally, sale notes are write-once-on-cancellation only.

### 2.2 Schema-evolution mechanism — exists, but not what the constitution mandates
- A `runMigrations` function does run on every app start and performs three legacy migrations ([src/main/db/index.ts:16-52](src/main/db/index.ts#L16-L52)):
  1. Adds `products.image` column if missing.
  2. Adds `customers.document` and `customers.document_type`; backfills from legacy `ci`/`ruc` columns.
  3. Inserts default `backup_schedule_*` rows in `app_settings`.
- **Missing pieces vs. Constitution Principle VI:**
  - No version table or migration ledger — replays based on `PRAGMA table_info` introspection rather than versioned steps.
  - No documented migration plan, no rollback path, no backup-before-migrate guard.
  - No test coverage of fresh-DB vs. migrated-DB equivalence (Workflow & Quality Gates explicitly require this).
- > **Correction to functional-spec.md:** §17 implied no migration system exists. That was wrong; an ad-hoc migration system **does** exist but is not versioned.

### 2.3 Stock audit trail — sales bypass it
- `stock_adjustments` is written **only** by manual adjustments via `products.adjustStock` ([products.ts:177-182](src/main/db/queries/products.ts#L177-L182)).
- Sales decrement `products.stock` directly inside the sale transaction ([sales.ts:38-46](src/main/db/queries/sales.ts#L38-L46)) without a corresponding `stock_adjustments` row.
- **Verified false in code:** the functional-spec §9.4 and §17 stated "Only manual adjustments and purchase receptions write to that audit table." Purchase **receptions also bypass** the audit table (see §3.2 below). Net result: the "Mov. Stock" report only shows manual adjustments.

### 2.4 Authorization model — UI-only, zero backend enforcement
- Three roles defined: `admin / supervisor / cajero` ([schema.ts:8](src/main/db/schema.ts#L8)).
- Restrictions are enforced **only** in renderer components (e.g., `CajaPage.tsx:78` for "supervisor or admin can close").
- **Missing:** none of the **81 IPC handlers** in `src/main/ipc/*` perform a role check. Any code in the renderer (or anything that compromises the renderer) can invoke `users:create`, `cash:close`, `sales:cancel`, etc. without re-validation. See §5.1.

### 2.5 Sale-creation register validation
- Renderer blocks the POS screen unless an open register is in `localStorage` ([VentasPage.tsx:328-356](src/renderer/src/modules/ventas/VentasPage.tsx#L328-L356)).
- IPC `sales:create` and DB `createSale()` accept any `register_id` that satisfies the FK — they do **not** check `cash_registers.status='open'` ([sales.ipc.ts:5](src/main/ipc/sales.ipc.ts#L5), [sales.ts:18-79](src/main/db/queries/sales.ts#L18-L79)).
- A renderer with a stale or tampered `localStorage` cash-store state can post sales against a closed register.

### 2.6 Reporting service location — violates Principle V
- Constitution Principle V mandates that xlsx/jsPDF reporting "MUST live in dedicated service modules in the main process".
- All four `xlsx` / `jsPDF` imports are in the renderer:
  - [src/renderer/src/lib/export.ts:1-2](src/renderer/src/lib/export.ts#L1-L2)
  - [src/renderer/src/lib/ticket-pdf.ts:1](src/renderer/src/lib/ticket-pdf.ts#L1)
- No equivalent in `src/main/`. Direct violation; partial because the **separation of concerns** is otherwise clean (formatters take plain data in, return blobs out — they just live in the wrong process).

### 2.7 Stack list completeness — Principle I
- The constitution's locked stack lists 9 packages.
- `package.json` ships **6 additional production dependencies** in active use that are not enumerated: `recharts`, `@reactour/tour`, `date-fns`, `lucide-react`, `clsx`, `tailwind-merge`, `@fontsource/inter`.
- The spirit of "no dependency added without approval" is undermined when the baseline doesn't reflect what's already shipping.

### 2.8 TypeScript strict mode — inherited from template, not asserted
- Both [tsconfig.web.json](tsconfig.web.json) and [tsconfig.node.json](tsconfig.node.json) `extends` `@electron-toolkit/tsconfig/*` and override **none** of the strict-mode flags locally.
- Effectively delegated to the upstream template; the project has no first-party assertion that `strict: true` and `noImplicitAny: true` are on. Constitution Principle II mandates these explicitly. A `@electron-toolkit` upgrade could silently flip them.

---

## 3. In spec but not in code

Concrete claims in the functional spec or constitution that are **not** backed by the code.

### 3.1 Purchase receptions writing to `stock_adjustments`
- Functional-spec §9.4 / §17 implied that purchase receptions write to the audit table. **They do not.**
- [src/main/db/queries/purchases.ts:187-204](src/main/db/queries/purchases.ts#L187-L204) shows `receivePurchaseOrder()` only updates `products.stock`; no insert into `stock_adjustments`.
- > Action: correct §9.4 / §17 of the functional spec.

### 3.2 Versioned, idempotent, rollback-aware migration plan
- Constitution Principle VI requires it.
- Code has the ad-hoc `runMigrations` only (see §2.2). The versioned/rollback aspect is **specified, not implemented**.

### 3.3 Repository pattern as a discrete layer
- Constitution Principle III says "all SQLite access MUST go through a dedicated service or repository module."
- Code has `src/main/db/queries/*.ts` which is morally a repository layer, but several IPC handlers reach into shared `getDb()` directly when they need pragmas or single-statement queries. This is a stylistic gap rather than a strict violation, but the principle reads as if a strict layer exists; in practice the layer is conventional.

### 3.4 Automated quality gates (Workflow rule)
- Constitution requires `npm run typecheck`, `npm run lint`, dev-mode end-to-end verification, and DB migration-path testing on every change.
- There is **no test infrastructure** of any kind in the repo: zero `*.test.*`, zero `*.spec.*`, no `__tests__` directories, no test runner script. The "exercise on a fresh DB AND existing DB" gate has no tooling backing it.

### 3.5 Approval gate / dependency justification
- Constitution Principle I requires written justification before adding dependencies.
- No mechanism in the repo (no `DEPENDENCIES.md`, no PR template, no CI hook) records or enforces this. It exists as a norm only.

---

## 4. In code but not in spec

Logic, IPC handlers, or behaviors that exist in code but were not captured in `functional-spec.md`.

### 4.1 Sale cancellation flow
- IPC `sales:cancel` is registered ([src/main/ipc/sales.ipc.ts](src/main/ipc/sales.ipc.ts)) and handled in [src/main/db/queries/sales.ts](src/main/db/queries/sales.ts).
- The schema includes `sales.status IN ('completed','cancelled')` ([schema.ts:88](src/main/db/schema.ts#L88)).
- **Missing from spec:** the entire cancellation feature — what it does to stock, customer balance, the cash session, and the audit trail. This is a high-impact gap because cancellation is a sensitive POS operation.

### 4.2 `action_logs` table
- Generic event log used for `force_close_register` ([cash.ts:111-125](src/main/db/queries/cash.ts#L111-L125)) and potentially other audit events.
- Spec §12.5 mentioned the `action_logs` write but did not document the table itself or any other event types written to it.

### 4.3 Database hardening pragmas
- [src/main/db/index.ts:57-58](src/main/db/index.ts#L57-L58) sets `journal_mode = WAL` and `foreign_keys = ON` on every boot.
- These are non-trivial integrity decisions (WAL changes crash-recovery semantics; `foreign_keys = ON` makes the schema's `REFERENCES` constraints actually enforced) and the spec is silent on both.

### 4.4 Legacy column backfill (`ci` / `ruc` → `document` / `document_type`)
- Migration in [db/index.ts:34-45](src/main/db/index.ts#L34-L45) backfills customer documents from older column names. Indicates the project has a deployed-data legacy not reflected in the spec.

### 4.5 `PosScreen` route vs. layout split
- Route `/pos` renders `PosScreen` **outside** the authenticated `Layout` shell, while `/ventas` (sales listing) renders inside it ([router.tsx:31-32, 34](src/renderer/src/router.tsx#L31-L32)).
- The spec discussed POS behavior but did not document this UX split (full-screen no-chrome POS vs. chromed listing).

### 4.6 IPC handlers omitted from the spec
The following channels exist but were not enumerated:
- `cash:getCurrent`, `cash:getAll` — dashboard / report consumers.
- `sales:cancel`, `sales:dayTotal`, `sales:getRecent`, `sales:getByRegister`.
- `users:getById`, `users:getActive`.
- `customers:getSales`, `customers:updatePayment`, `customers:deletePayment`, `customers:getPayments`.
- `products:getById`, `products:movements`, `products:salesStats`, `products:lastPurchase`, `products:recentSales`, `products:saveImageFromPath`, `products:pickImage`, `products:getImagePath`, `products:createCategory`.
- `purchases:receive`, `purchases:cancel` (the spec mentioned the effects but not the handlers).
- `settings:getAll`, `settings:set` (mentioned implicitly).
- `window:minimize`, `window:maximizeToggle`, `window:close`, `window:isMaximized`.
- `notify:show`.

**Total IPC channels registered: 81. Channels with role checks: 0.**

### 4.7 `HotkeysHelp` component
- A `HotkeysHelp` UI component imports `useHotkey` and renders a help overlay.
- This contradicts the spec's claim that "all POS hotkeys are wired ad-hoc inside `VentasPage.tsx`." `VentasPage` does wire them ad-hoc, but `HotkeysHelp` is the only **non-POS** consumer of the hotkeys utility — and the spec didn't mention it.

### 4.8 Image-handling sub-flow
- `products:pickImage` returns a data URL, `products:saveImageFromPath` copies an image into the app's data directory, `products:getImagePath` exposes the storage location. The spec covered the high-level behavior but not these granular IPC steps.

### 4.9 Product list skeleton & lazy categories
- `ProductosPage.tsx` performs lazy category loading and table-skeleton rendering during `Consultar` operations. UX detail not captured.

---

## 5. Priority recommendation

Ranked by risk to a POS in production. The risk model assumes: real money in the cash drawer, customer credit accounts, deployed to merchant machines without remote support, single maintainer.

### CRITICAL — fix before next merchant deployment

**P1. Backend authorization on IPC.**  
0 of 81 IPC handlers verify the caller's role or even verify that a user is logged in. A single XSS through a product image, supplier name, or customer note can call `users:create`, `cash:close`, `sales:cancel`, `customers:update` (mutating balances), or `backup:restore` (overwriting the database). For a POS, this is the single biggest risk. The fix: pass `userId` from the renderer's auth store on every IPC call **and** re-resolve role on the main side from the `users` table before executing privileged operations. Channels needing role gates at minimum: `users:*`, `cash:close`, `cash:addMovement`, `sales:cancel`, `customers:delete`, `products:adjustStock`, `backup:restore`, `settings:set`.

**P2. `sales:create` must validate the cash register is open.**  
Currently a stale `register_id` (cleared session, tampered localStorage, race condition during a close) can post sales onto a closed register. This corrupts the cash-session reconciliation report (counted vs. expected) and the cash-flow KPIs. Fix at the query layer: `WHERE id = ? AND status = 'open'` precondition before insert.

**P3. Migration safety.**  
The current `runMigrations` works for the migrations it has done, but it is **not safe for the next non-trivial schema change** (no version table, no rollback, no pre-migrate backup). The constitution mandates versioned migrations precisely because losing merchant data is unrecoverable. Adding a version table now is cheap; adding it after the next bad migration is not. Recommend: introduce `schema_migrations(version, applied_at)`, wrap each migration in a transaction, and add an automatic pre-migrate backup if the schema-version delta is non-zero.

### HIGH — fix this quarter

**P4. Test coverage of cash and sales paths.**  
Zero automated tests on a codebase whose two most sensitive operations are sale-creation (transactional, multi-table, decrements stock + balance) and cash-close (computes expected vs. counted). The constitution names this gap explicitly in Principle VII as the reason for its conservatism. Suggested first targets: `salesQuery.createSale` (cash / credit / mixed / customer-credit edge cases), `cashQuery.closeRegister` (expected calculation), and `customerQuery.updatePayment` (balance delta).

**P5. Sales-driven stock changes need an audit row.**  
Today, `products.stock` can drift from the sum of receipts minus sales without any reconcilable trail (only the `sale_items` themselves). When a merchant calls about "stock is wrong", there is no single audit table to consult. Either: extend `stock_adjustments` to record sale-driven decrements (cheap), or document explicitly that the audit table covers manual changes only (acceptable, but the report needs a banner saying so).

**P6. Reprint / re-issue policy on sale cancellation.**  
A `sales:cancel` IPC exists but the spec doesn't document what it does to: (a) `products.stock` (does it restock?), (b) `customers.balance` (does it refund credit?), (c) cash-session reconciliation (does the cancelled total subtract from the day's expected cash?). This needs to be **documented in the spec and verified in code** before any merchant uses it, or it will produce silently wrong reports.

### MEDIUM — schedule

**P7. Move xlsx/jsPDF to main, OR amend Principle V.**  
Today's setup works, but a future Electron security hardening (e.g., disabling renderer access to a node module, or a CSP change) could break exports without warning. Either move them to main behind `reports:*` IPC channels, or relax the principle to allow renderer-side reporting and document why.

**P8. Update Principle I's stack list.**  
Add the 6 deps already shipping. Until done, Principle I cannot be a real gate.

**P9. Held tickets to SQLite.**  
`localStorage['held-tickets']` is fragile: a `userData` reset, a corrupted Electron storage, or a different OS user account erases pending tickets that may already represent partial sales. Move them to a `held_tickets` table; persistence is two columns (`payload TEXT`, `created_at`). Bonus: they survive cross-device if the DB is restored from backup.

### LOW — track but don't block

**P10. Componentization of POS-screen.**  
`VentasPage.tsx` is the worst offender of Principle II (mixed responsibilities). Refactor opportunistically as bugs land in that file; not worth a dedicated cleanup PR.

**P11. Sale notes input.**  
Spec implies notes exist; UI only supports them on cancellation. If merchants ask for it, add an input on the cobro modal.

**P12. Reprint flow as discrete feature.**  
Today's "open the sale, click the printer" is fine. Promote to a first-class feature only if support tickets repeatedly request it.

---

## Appendix A — corrections to commit back to `functional-spec.md`

1. §9.4 / §17: remove the claim that purchase receptions write to `stock_adjustments`. They do not. — **Resolved (P5, 2026-05-08):** sales, cancellations, and purchase receptions now write `stock_adjustments` rows; Mov. Stock report is complete.
2. §17 #2: tighten — only **manual** adjustments write to `stock_adjustments`. Sales bypass it; purchase receptions bypass it. — **Resolved (P5, 2026-05-08).**
3. §17: add note about the existing `runMigrations` mechanism (acknowledge it exists but is unversioned). — **Resolved (P3, 2026-05-08):** `runMigrations` now uses a versioned `schema_migrations` ledger with pre-migrate backup safeguard.
4. Add §7.11 "Sale cancellation" describing the cancellation flow once its semantics are documented (P6 above). — **Resolved (P6, 2026-05-08):** §7.11 added to functional-spec.md.
5. Add §16.7 "Database hardening" mentioning WAL + `foreign_keys=ON`.
6. Add `action_logs` to the table inventory (currently only mentioned in passing under §12.5).

## Appendix B — verification provenance

| Claim category | Verification method |
|---|---|
| IPC inventory (81 channels, 0 role checks) | Read each `src/main/ipc/*.ts` file end-to-end |
| Sales bypass `stock_adjustments` | Read `src/main/db/queries/sales.ts:18-79` |
| Purchases bypass `stock_adjustments` | Read `src/main/db/queries/purchases.ts:151-204` |
| `sales:create` no register-open check | Read `src/main/ipc/sales.ipc.ts:5` and `sales.ts:16-79` |
| xlsx/jsPDF location | `grep -rn "from 'xlsx'\|from 'jspdf'" src/` |
| `hotkeys.ts` consumers | `grep -rn "useHotkey\|hotkeys" src/renderer` |
| TypeScript strict mode | Read `tsconfig.web.json`, `tsconfig.node.json`, `tsconfig.json` |
| `runMigrations` body | Read `src/main/db/index.ts:16-52` |
| Renderer Node-import isolation | `grep -rn "better-sqlite3\|node-thermal-printer\|child_process\|^import.*'fs'\|^import.*'path'" src/renderer` |
| Test files | `find . -name "*.test.*" -o -name "*.spec.*"` (excluding `node_modules`) |

*Generated: 2026-05-08. Source branch: `fix/qa-feedback-round-1`.*
