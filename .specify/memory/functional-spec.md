# POS Multicarnes — Functional Specification

> Reverse-engineered functional specification of the POS Multicarnes application as of branch `fix/qa-feedback-round-1`. Each feature documents observable behavior, intended users, and acceptance criteria derived from the actual implementation, with `file:line` citations.

## 1. Overview

POS Multicarnes is a desktop point-of-sale application for a meat-shop business (butchery / mini-market). It runs on Electron + React + TypeScript with a local SQLite database (better-sqlite3) and supports thermal-receipt printing, scale-barcode parsing, multi-tier pricing, customer credit accounts, supplier purchases, cash-session reconciliation, scheduled backups, and Excel/PDF reporting.

The app is single-tenant and offline-first: all data lives in a local SQLite file, with no network sync.

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Shell | Electron 39 |
| Renderer | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Routing | react-router-dom v7 |
| Database | better-sqlite3 (local file) |
| Auth hashing | bcryptjs |
| Printing | node-thermal-printer (ESC/POS) + jsPDF (PDF fallback) |
| Reports export | xlsx + jsPDF |
| Charts | Recharts |
| Onboarding | @reactour/tour |
| Locale | es-PY (Paraguayan Guaraní, no decimals on currency) |

## 3. Roles & Access Model

Three roles are defined in [src/main/db/schema.ts:8](src/main/db/schema.ts#L8) and [src/shared/types.ts:1](src/shared/types.ts#L1):

| Role | Typical access |
|---|---|
| `admin` | Full access; user management; configuration; reports |
| `supervisor` | Reports, cash close, stock adjustments |
| `cajero` | Sales (POS), open cash session |

Role enforcement is **UI-only**; the IPC backend does not re-check roles on most handlers. This is documented as a known cross-cutting concern in §17.

---

## 4. Authentication

### 4.1 PIN-based login
**What it does:** Users pick their account from a list and authenticate with a 6-digit numeric PIN. Optional on-screen numeric keypad for touch devices.

**Who uses it:** All roles.

**Acceptance criteria:**
- PIN must be exactly 6 numeric digits ([src/main/db/queries/users.ts:7-9](src/main/db/queries/users.ts#L7-L9)).
- PIN is hashed with bcrypt before storage ([src/main/db/queries/users.ts:42](src/main/db/queries/users.ts#L42), [src/main/db/seed.ts:8](src/main/db/seed.ts#L8)).
- Inactive users are excluded from the login list and cannot authenticate ([src/main/db/queries/users.ts:18, 30](src/main/db/queries/users.ts#L18)).
- Invalid PIN returns `null`, no account state is mutated ([src/main/db/queries/users.ts:35-36](src/main/db/queries/users.ts#L35-L36)).
- Non-numeric input is stripped client-side ([src/renderer/src/modules/login/LoginPage.tsx:151-152, 252](src/renderer/src/modules/login/LoginPage.tsx#L151-L152)).
- Authenticated user is persisted in `localStorage` via the auth store ([src/renderer/src/store/auth.store.ts:24](src/renderer/src/store/auth.store.ts#L24)).
- Non-admin users with no open cash register are routed to the cash-opening screen after login ([src/renderer/src/modules/login/LoginPage.tsx:86-89](src/renderer/src/modules/login/LoginPage.tsx#L86-L89)).

**Data persisted:** session in `localStorage`; no DB writes on login itself.

### 4.2 First-run admin setup
**What it does:** When the database has zero users, the login screen replaces account selection with an admin-creation form.

**Who uses it:** Owner / installer at first launch.

**Acceptance criteria:**
- Triggered only when the active-user list is empty ([LoginPage.tsx:38, 118](src/renderer/src/modules/login/LoginPage.tsx#L38)).
- Validates name is non-empty, PIN is exactly 6 digits, PIN confirmation matches ([LoginPage.tsx:42-53](src/renderer/src/modules/login/LoginPage.tsx#L42-L53)).
- Creates the user with `role='admin'` ([LoginPage.tsx:58](src/renderer/src/modules/login/LoginPage.tsx#L58)).

**Data persisted:** `users` row with `role='admin'`, `active=1`, bcrypt `pin_hash`.

### 4.3 Forgot-PIN modal
**What it does:** Informational modal — there is **no** automatic PIN recovery; the user is told an admin must reset it from user management.

**Acceptance criteria:** read-only modal; no recovery flow exists ([LoginPage.tsx:307-332](src/renderer/src/modules/login/LoginPage.tsx#L307-L332)).

---

## 5. User Management

### 5.1 Create user
**Who:** Admin (UI-enforced). **What:** Admin creates accounts for cashiers, supervisors, or other admins.

**Acceptance criteria:**
- Name is required ([UsuariosPage.tsx:56-58](src/renderer/src/modules/usuarios/UsuariosPage.tsx#L56-L58)).
- PIN must be 6 digits and match its confirmation ([UsuariosPage.tsx:64-70](src/renderer/src/modules/usuarios/UsuariosPage.tsx#L64-L70)).
- Role must be one of `admin | supervisor | cajero` ([schema.ts:8](src/main/db/schema.ts#L8)).
- New users default to `active=1` ([schema.ts:10](src/main/db/schema.ts#L10)).
- PIN is bcrypt-hashed before insert ([users.ts:42](src/main/db/queries/users.ts#L42)).

**Data persisted:** `users(id, name, role, pin_hash, active, created_at)`.

### 5.2 List & edit users
**Who:** Admin.

**Acceptance criteria:**
- All users (active and inactive) are listed, ordered by name ([users.ts:13](src/main/db/queries/users.ts#L13)).
- Role is rendered as a colored badge (admin=brand, supervisor=info, cajero=neutral) ([UsuariosPage.tsx:20-24, 168](src/renderer/src/modules/usuarios/UsuariosPage.tsx#L20-L24)).
- Active state shown as Activo/Inactivo badge ([UsuariosPage.tsx:171-172](src/renderer/src/modules/usuarios/UsuariosPage.tsx#L171-L172)).
- On edit, PIN is optional; only changed fields are updated ([users.ts:54-67](src/main/db/queries/users.ts#L54-L67)).
- The `active` checkbox is the deactivation mechanism — there is no destructive user delete.

---

## 6. Profile (Self-service)

### 6.1 View profile
Logged-in user sees their name, role badge, active status, ID, role description, and join date ([PerfilPage.tsx:111-128](src/renderer/src/modules/perfil/PerfilPage.tsx#L111-L128)).

### 6.2 Change own PIN
**Acceptance criteria:**
- Current PIN must be exactly 6 digits ([PerfilPage.tsx:63-64](src/renderer/src/modules/perfil/PerfilPage.tsx#L63-L64)).
- New PIN must be 6 digits, match confirmation, and differ from current ([PerfilPage.tsx:67-74](src/renderer/src/modules/perfil/PerfilPage.tsx#L67-L74)).
- Current PIN is verified via the same bcrypt login path before the new PIN is stored ([PerfilPage.tsx:78-81](src/renderer/src/modules/perfil/PerfilPage.tsx#L78-L81)).

**Data persisted:** `users.pin_hash`.

---

## 7. Sales (POS / Checkout)

### 7.1 Cart management
**Who:** Cashier with an open cash session.

**Acceptance criteria:**
- Adding the same product increments quantity instead of duplicating the row ([cart.store.ts:23-32](src/renderer/src/store/cart.store.ts#L23-L32)).
- Per-line subtotal recomputes as `quantity * price` and total recomputes as `subtotal - discount` on every change ([cart.store.ts:45-49, 65-68](src/renderer/src/store/cart.store.ts#L45-L49)).
- Plus/minus buttons step by `cartStep` per price-type (e.g., 0.25 kg, 1 unit) ([VentasPage.tsx:426-452](src/renderer/src/modules/ventas/VentasPage.tsx#L426-L452)).
- Discount is applied as either fixed Gs amount or percentage; percentage recomputes on cart change ([VentasPage.tsx:89-94](src/renderer/src/modules/ventas/VentasPage.tsx#L89-L94)).
- Cart cleared via F8 hotkey or "Cancelar" button (with confirmation) ([VentasPage.tsx:211-223, 268-289](src/renderer/src/modules/ventas/VentasPage.tsx#L211-L223)).

**Data persisted:** none — cart is in-memory only.

### 7.2 Product search & grid
**Acceptance criteria:**
- Free-text search matches name or barcode, debounced 300 ms ([VentasPage.tsx:125-131](src/renderer/src/modules/ventas/VentasPage.tsx#L125-L131)).
- Category chip filter; "Todas" resets ([VentasPage.tsx:588-621](src/renderer/src/modules/ventas/VentasPage.tsx#L588-L621)).
- Lazy load 30 products per page via `IntersectionObserver` ([VentasPage.tsx:133-152, 681-684](src/renderer/src/modules/ventas/VentasPage.tsx#L133-L152)).
- Out-of-stock products are disabled; low-stock products show a warning badge when `stock <= min_stock` ([VentasPage.tsx:638-674](src/renderer/src/modules/ventas/VentasPage.tsx#L638-L674)).

### 7.3 Barcode scanner
**Acceptance criteria:**
- Active only when no modal is open and focus is not on a text input ([VentasPage.tsx:156-159](src/renderer/src/modules/ventas/VentasPage.tsx#L156-L159)).
- Buffer flushes on Enter or 100 ms idle; minimum 3 characters to trigger lookup ([VentasPage.tsx:160, 196-202](src/renderer/src/modules/ventas/VentasPage.tsx#L160)).
- "Escaneando" hint badge shown for 300 ms while typing ([VentasPage.tsx:203-204](src/renderer/src/modules/ventas/VentasPage.tsx#L203-L204)).
- Scale-barcode parsing is attempted **first**; on miss, the full barcode is used for product lookup ([VentasPage.tsx:160-194](src/renderer/src/modules/ventas/VentasPage.tsx#L160-L194)).

### 7.4 Scale barcode parsing
**What it does:** Decodes EAN-13 codes printed by Bizerba/Toledo scales that embed a 5-digit product code and a 5-digit weight in grams.

**Acceptance criteria:**
- Recognizes prefix `2X` (where `X` is any digit) ([balance-code.ts:23](src/renderer/src/lib/balance-code.ts#L23)).
- Extracts the 5-digit product code from positions 2–7 ([balance-code.ts:28](src/renderer/src/lib/balance-code.ts#L28)).
- Extracts weight in grams from positions 7–12 and converts to kilograms ([balance-code.ts:29-35](src/renderer/src/lib/balance-code.ts#L29-L35)).
- Rejects when weight is zero or invalid ([balance-code.ts:31](src/renderer/src/lib/balance-code.ts#L31)).
- Auto-adds the product with the parsed weight only when its `price_type` is kg-based; otherwise emits a warning toast ([VentasPage.tsx:165-178](src/renderer/src/modules/ventas/VentasPage.tsx#L165-L178)).

### 7.5 Quantity / amount modal
**Acceptance criteria:**
- For decimal price types (kg, l, m): supports "Por cantidad" or "Por monto" entry; quick-pick presets `[0.25, 0.5, 1, 2]` ([VentasPage.tsx:716-804](src/renderer/src/modules/ventas/VentasPage.tsx#L716-L804)).
- For unit types: quantity-only with presets `[1, 2, 5, 10]` ([VentasPage.tsx:716-717](src/renderer/src/modules/ventas/VentasPage.tsx#L716-L717)).
- "Por monto" mode divides amount by unit price and shows approximate quantity ([VentasPage.tsx:309-316, 884-887](src/renderer/src/modules/ventas/VentasPage.tsx#L309-L316)).
- "máx" button caps the quantity to the available stock ([VentasPage.tsx:872-878](src/renderer/src/modules/ventas/VentasPage.tsx#L872-L878)).
- Quantity exceeding stock displays a red warning ([VentasPage.tsx:890-900](src/renderer/src/modules/ventas/VentasPage.tsx#L890-L900)).

### 7.6 Payment methods
Four methods, configured in the cobro modal ([CobroModal.tsx:17-22](src/renderer/src/modules/ventas/CobroModal.tsx#L17-L22)):

| Method | Behavior |
|---|---|
| Efectivo (cash) | Captures received amount; computes change when `received >= total` ([CobroModal.tsx:226-243](src/renderer/src/modules/ventas/CobroModal.tsx#L226-L243)). |
| Transferencia | Amount only; no balance impact. |
| Fiado (credit) | Requires customer; decrements `customers.balance` by total ([sales.ts:58-63](src/main/db/queries/sales.ts#L58-L63)). |
| Mixto | Splits across up to 3 methods (cash + transfer + credit); validates the sum equals total; if a credit portion exists, customer is required ([CobroModal.tsx:49-56, 251-298](src/renderer/src/modules/ventas/CobroModal.tsx#L49-L56)). |

### 7.7 Customer assignment
**Acceptance criteria:**
- Customer search triggers on ≥ 2 characters ([CobroModal.tsx:40-45](src/renderer/src/modules/ventas/CobroModal.tsx#L40-L45)).
- Selected customer is shown as a chip with current balance; clearable ([CobroModal.tsx:143-194](src/renderer/src/modules/ventas/CobroModal.tsx#L143-L194)).
- Required for credit and mixed-with-credit sales ([CobroModal.tsx:54-56](src/renderer/src/modules/ventas/CobroModal.tsx#L54-L56)).

### 7.8 Sale creation (transactional)
**Acceptance criteria:**
- Sale, items, payments, stock decrement, and customer-balance adjustment are wrapped in a single transaction ([sales.ts:18-79](src/main/db/queries/sales.ts#L18-L79)).
- `sale_items` are inserted and `products.stock` is decremented per item in the same transaction ([sales.ts:38-46](src/main/db/queries/sales.ts#L38-L46)).
- Multi-method payments are persisted to `sale_payments` ([sales.ts:49-56](src/main/db/queries/sales.ts#L49-L56)).
- Credit method decreases `customers.balance` by the total; mixed decreases by the credit portion ([sales.ts:58-74](src/main/db/queries/sales.ts#L58-L74)).
- Sale status defaults to `completed` ([schema.ts:88](src/main/db/schema.ts#L88)).

**Data persisted:** `sales`, `sale_items`, `sale_payments`, plus updates to `products.stock` and `customers.balance`.

### 7.9 Held / suspended sales
**What it does:** Pauses the current ticket and saves it locally so it can be resumed later in the same session.

**Acceptance criteria:**
- F9 or "Suspender" pauses the cart and persists it to `localStorage['held-tickets']` ([VentasPage.tsx:225-231](src/renderer/src/modules/ventas/VentasPage.tsx#L225-L231), [held.store.ts:42-52](src/renderer/src/store/held.store.ts#L42-L52)).
- A held ticket carries `{id, savedAt, label, items[], discount}` ([held.store.ts:6-12](src/renderer/src/store/held.store.ts#L6-L12)).
- "Pendientes" badge shows the count; resuming a ticket warns when the current cart is non-empty ([VentasPage.tsx:235-242, 375-384](src/renderer/src/modules/ventas/VentasPage.tsx#L235-L242)).
- Held tickets persist across app restarts via `localStorage` ([held.store.ts:22-36](src/renderer/src/store/held.store.ts#L22-L36)).

### 7.10 POS hotkeys
| Key | Action | File:line |
|---|---|---|
| F1 | Start page tour | [VentasPage.tsx:701](src/renderer/src/modules/ventas/VentasPage.tsx#L701) |
| F4 | Focus discount input, select all | [VentasPage.tsx:271-274](src/renderer/src/modules/ventas/VentasPage.tsx#L271-L274) |
| F8 | Cancel cart (with confirmation) | [VentasPage.tsx:275-277](src/renderer/src/modules/ventas/VentasPage.tsx#L275-L277) |
| F9 | Suspend cart | [VentasPage.tsx:278-280](src/renderer/src/modules/ventas/VentasPage.tsx#L278-L280) |
| F12 | Open cobro modal (when items present) | [VentasPage.tsx:281-284](src/renderer/src/modules/ventas/VentasPage.tsx#L281-L284) |

Hotkeys are inactive while any modal is open ([VentasPage.tsx:270](src/renderer/src/modules/ventas/VentasPage.tsx#L270)).

### 7.11 Sale cancellation
**What it does:** Marks a previously-completed sale as `cancelled`, restocks the items, refunds a credit balance when applicable, and writes an audit trail.

**Who uses it:** Admin or supervisor (UI-gated; backend role enforcement arrives with feature 001-ipc-authorization).

**Acceptance criteria:**
- IPC channel: `sales:cancel(id, userId)` ([src/main/ipc/sales.ipc.ts](src/main/ipc/sales.ipc.ts), [src/main/db/queries/sales.ts:141-175](src/main/db/queries/sales.ts#L141-L175)).
- **Idempotent:** if the sale is missing or already `cancelled`, the call returns `null` and no state changes ([sales.ts:144-145](src/main/db/queries/sales.ts#L144-L145)).
- **Stock restore:** every `sale_items` row's `quantity` is added back to `products.stock` inside the transaction ([sales.ts:147-167](src/main/db/queries/sales.ts#L147-L167)). Each restore writes a `stock_adjustments` row with `reason='Anulación venta #<id>'` (P5).
- **Credit refund:** when the original `payment_method = 'credit'`, the **full** sale total is added back to `customers.balance` ([sales.ts:157-162](src/main/db/queries/sales.ts#L157-L162)).
- **Status flip:** `sales.status` is set to `'cancelled'`. Cash queries filter `status = 'completed'` ([cash.ts:60, 167, 198](src/main/db/queries/cash.ts#L60)), so cancelled sales drop out of the day's expected-cash, KPI cards, and reports automatically.
- **Audit log:** an `action_logs` row is inserted with `action='cancel_sale'` and the cancelling user's ID ([sales.ts:165-169](src/main/db/queries/sales.ts#L165-L169)).
- **Atomic:** all of the above run inside a single `db.transaction()`; any failure rolls back ([sales.ts:143](src/main/db/queries/sales.ts#L143)).

**Known divergence (filed as TODO, not blocking):** when `payment_method = 'mixed'` and the original sale included a `credit` portion, that credit portion is **not** refunded to the customer balance. Pure-`cash` and pure-`transfer` cancellations correctly do nothing to the balance (cash is already in the drawer, transfers are bank-side); only the `mixed`-with-credit path leaves the customer balance lower than it should be after cancellation. Conservative position: leave the existing behaviour and flag for follow-up; merchants today can correct via a manual customer payment with note `Reverso parcial venta #<id>`.

**Data persisted:** `sales.status='cancelled'`, `products.stock` (incremented), `customers.balance` (incremented for credit), `stock_adjustments` (one row per item), `action_logs` (one row).

---

## 8. Sales History & Detail

### 8.1 Sale listing
**Acceptance criteria:**
- Date-range filter; default = first day of current month → today ([VentasListadoPage.tsx:49-50](src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx#L49-L50)).
- Columns: date, ID, customer, total, payment method, cashier, actions ([VentasListadoPage.tsx:180-189](src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx#L180-L189)).
- Footer shows total count and grand total ([VentasListadoPage.tsx:256-264](src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx#L256-L264)).
- Credit sales display a "Fiado · Pagado" badge when the customer's balance is non-negative ([VentasListadoPage.tsx:88-96, 213-219](src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx#L88-L96)).
- Excel and PDF export available ([VentasListadoPage.tsx:33-40, 100-106](src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx#L33-L40)).

### 8.2 Sale detail
**Acceptance criteria:**
- Single sale view with items table, totals, payments breakdown, and notes ([VentaDetallePage.tsx:131-251](src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L131-L251)).
- Printer icon opens the ticket preview modal for re-print ([VentaDetallePage.tsx:74-82](src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L74-L82)).
- 404 message when the sale ID is not found ([VentaDetallePage.tsx:38-57](src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L38-L57)).

---

## 9. Inventory & Products

### 9.1 Product CRUD
**Who:** Admin / supervisor.

**Acceptance criteria:**
- Name and price are required ([ProductoFormPage.tsx:333](src/renderer/src/modules/productos/ProductoFormPage.tsx#L333)).
- Barcode is optional but **unique** when present ([schema.ts:23](src/main/db/schema.ts#L23), [products.ts:100](src/main/db/queries/products.ts#L100)).
- Soft-delete via `active=0` ([schema.ts:29](src/main/db/schema.ts#L29), [products.ts:160-162](src/main/db/queries/products.ts#L160-L162)).
- List supports search by name/barcode, category filter, status filter, low-stock filter, paginated 50 per page ([products.ts:3-35](src/main/db/queries/products.ts#L3-L35), [ProductosPage.tsx:23](src/renderer/src/modules/productos/ProductosPage.tsx#L23)).
- `created_at` and `updated_at` are auto-tracked ([schema.ts:30-31](src/main/db/schema.ts#L30-L31)).

**Data persisted:** `products(id, category_id, name, barcode, price, price_type, stock, min_stock, image, active, created_at, updated_at)`.

### 9.2 Categories
- Names are unique ([schema.ts:16](src/main/db/schema.ts#L16)).
- Can be created inline from the product form ([ProductoFormPage.tsx:63-69](src/renderer/src/modules/productos/ProductoFormPage.tsx#L63-L69)).
- Default seed categories: Vacuno, Cerdo, Pollo, Embutidos, Otros ([seed.ts:15](src/main/db/seed.ts#L15)).

### 9.3 Multi-tier pricing (price types)
Eight types defined in [src/renderer/src/lib/price-types.ts:12-35](src/renderer/src/lib/price-types.ts#L12-L35) and [src/shared/types.ts:2](src/shared/types.ts#L2):

| Type | Decimals | Step | Cart step |
|---|---|---|---|
| `unit` | 0 | 1 | 1 |
| `kg` | 3 | 0.001 | 0.25 |
| `g` | 0 | 1 | 50 |
| `l` | 2 | 0.01 | 0.25 |
| `ml` | 0 | 1 | 50 |
| `m` | 2 | 0.01 | 0.5 |
| `docena` | 0 | 1 | 1 |
| `paquete` | 0 | 1 | 1 |

Quantities are formatted with `es-PY` locale (`formatQty`) ([price-types.ts:43-52](src/renderer/src/lib/price-types.ts#L43-L52)).

### 9.4 Stock tracking & manual adjustments
**Acceptance criteria:**
- `stock` and `min_stock` are stored as REAL to support fractional quantities ([schema.ts:26](src/main/db/schema.ts#L26)).
- Manual stock adjustment requires a non-empty reason ([ProductosPage.tsx:301](src/renderer/src/modules/productos/ProductosPage.tsx#L301), [ProductoDetallePage.tsx:101-104](src/renderer/src/modules/productos/ProductoDetallePage.tsx#L101-L104)).
- Each adjustment writes a row to `stock_adjustments(quantity_before, quantity_after, reason, user_id, created_at)` ([schema.ts:129-137](src/main/db/schema.ts#L129-L137), [products.ts:177-182](src/main/db/queries/products.ts#L177-L182)).
- Sales decrement `products.stock` directly inside the sale transaction (§7.8); sales **do not** write to `stock_adjustments` — only manual edits and purchase receptions do.

### 9.5 Low-stock alerts
- A product is "low stock" when `stock <= min_stock` ([products.ts:295-307](src/main/db/queries/products.ts#L295-L307)).
- "Sin stock" badge when `stock <= 0`, "Bajo mínimo" badge otherwise ([ProductosPage.tsx:216-220](src/renderer/src/modules/productos/ProductosPage.tsx#L216-L220)).

### 9.6 Product images
- Accepted formats: PNG, JPG, JPEG, WebP ([products.ipc.ts:38](src/main/ipc/products.ipc.ts#L38)).
- Filenames follow `product_{id}_{timestamp}.{ext}` and are stored in the user-data images directory ([products.ipc.ts:45](src/main/ipc/products.ipc.ts#L45)).
- Images are served via the custom `product-img://` protocol ([ProductosPage.tsx:197](src/renderer/src/modules/productos/ProductosPage.tsx#L197)).
- Fallback icon shown when no image is set ([ProductosPage.tsx:202](src/renderer/src/modules/productos/ProductosPage.tsx#L202)).

### 9.7 Barcode lookup
- Lookup endpoint `products:getByBarcode` returns only **active** products ([products.ts:74](src/main/db/queries/products.ts#L74), [products.ipc.ts:10-12](src/main/ipc/products.ipc.ts#L10-L12)).
- Barcode is part of the full-text search match ([products.ts:25-27](src/main/db/queries/products.ts#L25-L27)).

### 9.8 Product detail / analytics
- KPI cards: current stock, price, 7-day units sold, last purchase cost ([ProductoDetallePage.tsx:248-282](src/renderer/src/modules/productos/ProductoDetallePage.tsx#L248-L282)).
- Margin % = `(retail_price - last_unit_cost) / retail_price` ([ProductoDetallePage.tsx:176-179](src/renderer/src/modules/productos/ProductoDetallePage.tsx#L176-L179)).
- Recent-sales table (last 20) with customer and cashier ([products.ts:215-231](src/main/db/queries/products.ts#L215-L231)).
- Stock-movement audit table with before/after/delta/reason/user ([ProductoDetallePage.tsx:317-343](src/renderer/src/modules/productos/ProductoDetallePage.tsx#L317-L343)).
- Activate / deactivate toggle is gated by a confirmation dialog ([ProductoDetallePage.tsx:118-137](src/renderer/src/modules/productos/ProductoDetallePage.tsx#L118-L137)).

---

### 9.9 Promotional pricing (per-product)
**What it does:** Per-product promotional sale price managed by Admin/Supervisor. The POS automatically uses the promo price when active, shows a PROMO badge with strike-through normal price and "Ahorrás" indicator on the cart line, and prints an "Ahorrás" totals line on the receipt when at least one line was sold under promo.

**Who uses it:** Admin/Supervisor manage; Cashier consumes (UI hides the controls; matrix enforces `products:create`/`update` on admin+supervisor only).

**Acceptance criteria:**
- Five additive columns on `products`: `promo_enabled` (0/1), `promo_type` (`fixed`|`percent`), `promo_value` (Gs amount or 1–99 percent), and the optional `promo_from`/`promo_to` calendar-day window ([src/main/db/schema.ts:19-38](src/main/db/schema.ts#L19-L38)).
- Migration **v8** (`add_products_promo_columns`) is additive and idempotent under `PRAGMA table_info`; partial index `idx_products_promo_enabled` covers the "Solo en promo" filter ([src/main/db/index.ts](src/main/db/index.ts)).
- Validation in `queries/products.ts` throws typed `PROMO_*` errors (fixed must be > 0 and < normal price; percent must be integer 1–99; date range must be `Desde <= Hasta` when both bounds set; format `YYYY-MM-DD`). Errors are translated to Spanish in the form via `PROMO_ERROR_MSG`.
- Audit log: each promo-state change writes a `promo_enable` / `promo_update` / `promo_disable` row to `action_logs` inside the same `db.transaction()` as the product mutation, with JSON details capturing before/after; attribution via `ctx.userId` from the IPC handler.
- Activation rule: a promo is active iff `promo_enabled = 1` AND (`promo_from` is null OR today >= promo_from) AND (`promo_to` is null OR today <= promo_to), in local timezone. Pure function `isPromoActive(product, now)` in [src/renderer/src/lib/promo.ts](src/renderer/src/lib/promo.ts).
- Effective unit price: `promo_value` for `fixed`, or `Math.round(price * (1 - percent/100))` half-up for `percent`. If the computed promo price is not strictly less than the normal price, the promo silently self-disables (defensive against stale fixed amounts after a normal-price drop).
- Cart line snapshot (FR-008): `addItem` in [src/renderer/src/store/cart.store.ts](src/renderer/src/store/cart.store.ts) records `unit_price`/`normal_price`/`savings_per_unit` at add-to-cart. Lines already in the cart are never re-priced when the promo is later edited, disabled, or expires.
- Cart line render in [src/renderer/src/modules/ventas/VentasPage.tsx](src/renderer/src/modules/ventas/VentasPage.tsx): `<Badge tone="success">PROMO</Badge>`, struck-through normal price next to the active unit price, and an "Ahorrás Gs. N" line where N = `savings_per_unit × quantity`.
- Receipt totals: `getSaleById` joins `p.price as normal_price` so the receipt has the data without an extra IPC; [src/renderer/src/lib/ticket.ts](src/renderer/src/lib/ticket.ts) sums savings across promo lines and prints "Ahorrás Gs." above TOTAL when > 0. `ticket-pdf.ts` inherits via the shared `RenderedTicket.lines`.
- Admin discovery: "Solo en promo" filter chip on [src/renderer/src/modules/productos/ProductosPage.tsx](src/renderer/src/modules/productos/ProductosPage.tsx) adds `inPromoOnly: true` to `products:getAll`, which translates to a SQL predicate matching the renderer-side activation rule. Cashier role does not see the chip (UI gating; existing matrix already restricts the product-edit path).
- Receipt savings caveat (v1): `normal_price` on `SaleItem` is the product's **current** price (joined at read time), not a snapshot of the price at the moment of sale. A reprint after a normal-price raise can therefore show an inflated "Ahorrás". Out of scope to fix in v1 — a future change can snapshot `normal_price` onto `sale_items` if retroactive accuracy matters ([specs/005-promotional-pricing/data-model.md §1.3](specs/005-promotional-pricing/data-model.md)).

**Data persisted:** `products.promo_*` columns (additive); `action_logs` rows tagged `promo_enable`/`promo_update`/`promo_disable`. No new tables.

**Reference:** [specs/005-promotional-pricing/](specs/005-promotional-pricing/).

---

## 10. Customers

### 10.1 Customer CRUD & balance ledger
**Acceptance criteria:**
- Search by name, phone, or document ([customers.ts:3-31](src/main/db/queries/customers.ts#L3-L31), [ClientesPage.tsx:151-162](src/renderer/src/modules/clientes/ClientesPage.tsx#L151-L162)).
- Toggle filter for "is employee" ([ClientesPage.tsx:40, 164-172](src/renderer/src/modules/clientes/ClientesPage.tsx#L40)).
- Document type is `CI` or `RUC` ([ClientesPage.tsx:315-325](src/renderer/src/modules/clientes/ClientesPage.tsx#L315-L325), [schema.ts:40](src/main/db/schema.ts#L40)).
- `balance` is signed: negative = customer owes the store, positive = store owes the customer ([ClienteFichaPage.tsx:167, 256](src/renderer/src/modules/clientes/ClienteFichaPage.tsx#L167)).
- Customer deletion is **blocked** when balance ≠ 0 or any sale or payment exists for them ([customers.ts:165-196](src/main/db/queries/customers.ts#L165-L196)).

**Data persisted:** `customers(id, name, phone, address, document, document_type, is_employee, balance, created_at)` ([schema.ts:34-44](src/main/db/schema.ts#L34-L44)).

### 10.2 Customer payments (account credits)
**Acceptance criteria:**
- Payments are CRUD; create/update/delete adjust `customers.balance` transactionally ([customers.ts:105-162](src/main/db/queries/customers.ts#L105-L162), [customers.ipc.ts:12-23](src/main/ipc/customers.ipc.ts#L12-L23)).
- Each payment records `customer_id, user_id, amount, note, created_at` ([schema.ts:139-146](src/main/db/schema.ts#L139-L146)).

### 10.3 Customer profile (Ficha)
- Sales history with expandable line items and per-row payment breakdown ([ClienteFichaPage.tsx:270-367](src/renderer/src/modules/clientes/ClienteFichaPage.tsx#L270-L367)).
- Payment history list with timestamps and notes ([ClienteFichaPage.tsx:369-432](src/renderer/src/modules/clientes/ClienteFichaPage.tsx#L369-L432)).

---

## 11. Suppliers & Purchases

### 11.1 Supplier CRUD
- Fields: `name, phone, email, address, active, created_at` ([schema.ts:46-54](src/main/db/schema.ts#L46-L54)).
- List paginated with name search ([purchases.ts:3-23](src/main/db/queries/purchases.ts#L3-L23), [ProveedoresPage.tsx:21-73](src/renderer/src/modules/compras/ProveedoresPage.tsx#L21-L73)).

### 11.2 Purchase orders
**Acceptance criteria:**
- States: `pending | received | cancelled` rendered as Pendiente / Recibida / Cancelada badges ([ComprasPage.tsx:27-37, 140-141](src/renderer/src/modules/compras/ComprasPage.tsx#L27-L37)).
- New order: pick supplier (optional), add items via product search, set quantity and unit cost ([NuevaCompraPage.tsx:59-87](src/renderer/src/modules/compras/NuevaCompraPage.tsx#L59-L87)).
- Two save options: "Guardar Pendiente" (status='pending', no stock change) and "Guardar y Recibir" (status='received', stock incremented immediately) ([NuevaCompraPage.tsx:90-112](src/renderer/src/modules/compras/NuevaCompraPage.tsx#L90-L112), [purchases.ts:151](src/main/db/queries/purchases.ts#L151)).
- When marking an order received, `products.stock` is incremented per line and `products.updated_at` is touched ([purchases.ts:176-180, 194-197](src/main/db/queries/purchases.ts#L176-L180)).
- Orders may be cancelled after creation ([purchases.ts:207-210](src/main/db/queries/purchases.ts#L207-L210)).

**Data persisted:** `purchase_orders(id, supplier_id, user_id, total, status, notes, created_at, received_at)` and `purchase_items(id, order_id, product_id, quantity, unit_cost, subtotal)` ([schema.ts:109-127](src/main/db/schema.ts#L109-L127)).

---

## 12. Cash Management (Caja)

### 12.1 Open cash session
**Acceptance criteria:**
- Only one register may be open at a time; opening with one already open throws "Ya hay una caja abierta" ([cash.ts:5-6](src/main/db/queries/cash.ts#L5-L6)).
- Opening amount defaults to 0 and may be left at 0 ([AperturaCajaPage.tsx:22-30](src/renderer/src/modules/caja/AperturaCajaPage.tsx#L22-L30)).
- `cash_registers` row is created with `user_id, opened_at, opening_amount, status='open'` ([schema.ts:56-67](src/main/db/schema.ts#L56-L67)).
- Active register is mirrored to `localStorage` for renderer state ([cash.store.ts:9-26](src/renderer/src/store/cash.store.ts#L9-L26)).

### 12.2 Sales blocked without an open session
- The Sales screen replaces itself with a full-screen prompt to open a register when none exists ([VentasPage.tsx:328-356](src/renderer/src/modules/ventas/VentasPage.tsx#L328-L356)).
- Enforcement is **client-side only** (the IPC `sales:create` handler does not validate session presence) — see §17.

### 12.3 Cash in/out movements
- Movement type must be `income` or `expense` ([schema.ts:73](src/main/db/schema.ts#L73)).
- Description is required and amount must be > 0 ([CajaPage.tsx:220, 229-235](src/renderer/src/modules/caja/CajaPage.tsx#L220)).
- Persisted as `cash_movements(register_id, user_id, type, amount, description, created_at)` ([cash.ts:130-143](src/main/db/queries/cash.ts#L130-L143)).

### 12.4 Live session summary
- KPI cards: opening_amount, cashSales (cash + cash portion of mixed), incomes, expenses, expectedCash ([CajaPage.tsx:110-139](src/renderer/src/modules/caja/CajaPage.tsx#L110-L139)).
- Cash sales include both `payment_method='cash'` rows and the cash portion of `payment_method='mixed'` rows ([cash.ts:55-75](src/main/db/queries/cash.ts#L55-L75)).
- Movements table sorted by `created_at DESC` ([cash.ts:145-157](src/main/db/queries/cash.ts#L145-L157)).

### 12.5 Close session (Arqueo)
**Who:** Supervisor or admin ([CajaPage.tsx:78](src/renderer/src/modules/caja/CajaPage.tsx#L78)).

**Acceptance criteria:**
- Counted-cash input is required ([CierreCajaPage.tsx:154-163](src/renderer/src/modules/caja/CierreCajaPage.tsx#L154-L163)).
- Expected = `opening_amount + cash_sales + mixed_cash_sales + incomes - expenses` ([cash.ts:88-94](src/main/db/queries/cash.ts#L88-L94)).
- Difference = `closed_amount - expected_amount` ([cash.ts:94](src/main/db/queries/cash.ts#L94)).
- If the register was opened on a previous calendar day, **notes are mandatory** and an entry is written to `action_logs` ([CierreCajaPage.tsx:36, 41-44](src/renderer/src/modules/caja/CierreCajaPage.tsx#L36), [cash.ts:111-125](src/main/db/queries/cash.ts#L111-L125)).
- On close, an automatic backup is triggered when `auto_backup='1'` ([CierreCajaPage.tsx:52-58](src/renderer/src/modules/caja/CierreCajaPage.tsx#L52-L58)).
- A low-stock OS notification is fired on close ([CierreCajaPage.tsx:68-77](src/renderer/src/modules/caja/CierreCajaPage.tsx#L68-L77)).

**Data persisted:** updates `cash_registers(closed_at, closing_amount, expected_amount, difference, notes, status='closed')`.

---

## 13. Dashboard

### 13.1 Manager dashboard
**Who:** Admin / supervisor.

**KPI cards:**
- Total Vendido Hoy with day-over-day Δ% ([DashboardPage.tsx:289-296](src/renderer/src/modules/dashboard/DashboardPage.tsx#L289-L296)).
- Tickets Hoy with day-over-day Δ% ([DashboardPage.tsx:298-304](src/renderer/src/modules/dashboard/DashboardPage.tsx#L298-L304)).
- Cobros Pendientes (sum of credit balances owed) ([DashboardPage.tsx:306-312](src/renderer/src/modules/dashboard/DashboardPage.tsx#L306-L312)).
- Alertas de Stock (count of low-stock + out-of-stock products) ([DashboardPage.tsx:314-321](src/renderer/src/modules/dashboard/DashboardPage.tsx#L314-L321)).

**Charts:**
- Sales bar chart with selectable period (7 d / 30 d / 6 m); 6-month view aggregates by calendar month ([DashboardPage.tsx:325-339](src/renderer/src/modules/dashboard/DashboardPage.tsx#L325-L339), [DashboardPage.tsx:77-91](src/renderer/src/modules/dashboard/DashboardPage.tsx#L77-L91)).
- Top-5 products donut chart by quantity within the selected period ([TopProductsDonut.tsx:1-94](src/renderer/src/modules/dashboard/TopProductsDonut.tsx#L1-L94), [DashboardPage.tsx:178](src/renderer/src/modules/dashboard/DashboardPage.tsx#L178)).
- Last 8 sales table ([RecentSalesTable.tsx:24-114](src/renderer/src/modules/dashboard/RecentSalesTable.tsx#L24-L114)).
- Stock summary card with up to 4 most-urgent products ([StockSummaryCard.tsx:36-49](src/renderer/src/modules/dashboard/StockSummaryCard.tsx#L36-L49)).

### 13.2 Cashier dashboard
**Who:** Cajero — simplified view with only Tickets Hoy + Alertas de Stock + Stock Summary ([DashboardPage.tsx:208-266](src/renderer/src/modules/dashboard/DashboardPage.tsx#L208-L266)).

---

## 14. Reports

Date range defaults to month-to-date; the "Consultar" button triggers loading per tab ([ReportesPage.tsx:278-279, 313-316](src/renderer/src/modules/reportes/ReportesPage.tsx#L278-L279)).

| Tab | Description | Data source |
|---|---|---|
| **Resumen** | Tickets count, subtotal, total discounts, total revenue; tables by day, by payment method, by cashier ([ReportesPage.tsx:450-598](src/renderer/src/modules/reportes/ReportesPage.tsx#L450-L598)) | `salesSummary(from, to)` ([reports.ts:125-189](src/main/db/queries/reports.ts#L125-L189)) |
| **Comparativo** | Current range vs equivalent previous range; total sales, tickets, avg ticket, units, discounts with Δ% ([ReportesPage.tsx:601-682](src/renderer/src/modules/reportes/ReportesPage.tsx#L601-L682)) | `salesComparison(from, to)` ([reports.ts:228-251](src/main/db/queries/reports.ts#L228-L251)) |
| **Fiados Pendientes** | All customers with `balance < 0`, last credit-sale and last-payment timestamps; footer totals ([ReportesPage.tsx:685-750](src/renderer/src/modules/reportes/ReportesPage.tsx#L685-L750)) | `pendingCredits()` ([reports.ts:99-123](src/main/db/queries/reports.ts#L99-L123)) |
| **Más Vendidos** | Top products by quantity & revenue, optional category filter ([ReportesPage.tsx:752-790](src/renderer/src/modules/reportes/ReportesPage.tsx#L752-L790)) | `topProducts(from, to, categoryId?)` ([reports.ts:28-46](src/main/db/queries/reports.ts#L28-L46)) |
| **Margen** | Per product: sale price, last cost, margin Gs, margin %; "-" when no cost history ([ReportesPage.tsx:793-850](src/renderer/src/modules/reportes/ReportesPage.tsx#L793-L850)) | `profitMargin()` ([reports.ts:49-63](src/main/db/queries/reports.ts#L49-L63)) |
| **Mov. Stock** | Audit trail of `stock_adjustments` with color-coded delta ([ReportesPage.tsx:853-904](src/renderer/src/modules/reportes/ReportesPage.tsx#L853-L904)) | `stockMovements(from, to)` ([reports.ts:66-83](src/main/db/queries/reports.ts#L66-L83)) |
| **Cierres Caja** | Closed cash sessions: opened, closed, cashier, expected, counted, difference (color-coded) ([ReportesPage.tsx:907-966](src/renderer/src/modules/reportes/ReportesPage.tsx#L907-L966)) | `cashRegisters()` ([reports.ts:85-96](src/main/db/queries/reports.ts#L85-L96)) |

### 14.1 Export
**Acceptance criteria:**
- Excel export uses XLSX, sheet name "Reporte" ([export.ts:20-44](src/renderer/src/lib/export.ts#L20-L44)).
- PDF export uses jsPDF with a Multicarnes-branded red header (#CC1C1C), alternating-row striping, and a footer reporting record count and "Multicarnes S.R.L." ([export.ts:47-132](src/renderer/src/lib/export.ts#L47-L132)).
- Export buttons are hidden when the active tab has no data ([ReportesPage.tsx:354, 426-437](src/renderer/src/modules/reportes/ReportesPage.tsx#L354)).

---

## 15. Printing

### 15.1 Thermal ticket print
**Acceptance criteria:**
- Backend uses `node-thermal-printer` with the EPSON ESC/POS protocol ([print.ipc.ts:36-42](src/main/ipc/print.ipc.ts#L36-L42)).
- Paper width is configurable: 58 mm (32 chars) or 80 mm (48 chars) per `app_settings.thermal_printer_width` ([print.ipc.ts:33-34](src/main/ipc/print.ipc.ts#L33-L34)).
- Printer connectivity is checked before print; if unconfigured, returns "No hay impresora configurada. Andá a Configuración → Impresora térmica." ([print.ipc.ts:30](src/main/ipc/print.ipc.ts#L30)).
- Connectivity failure returns "No se pudo conectar a la impresora" ([print.ipc.ts:53](src/main/ipc/print.ipc.ts#L53)).
- Cuts the paper after print ([print.ipc.ts:63](src/main/ipc/print.ipc.ts#L63)).
- `print:hasConfig` IPC indicates whether a printer is configured for use by UI gating ([print.ipc.ts:76](src/main/ipc/print.ipc.ts#L76)).

### 15.2 Ticket content
Rendered by [src/renderer/src/lib/ticket.ts](src/renderer/src/lib/ticket.ts) and printed both as ESC/POS and PDF:

| Section | Fields |
|---|---|
| Header | Business name (uppercase, centered), address, phone — all from `app_settings` ([ticket.ts:125-128](src/renderer/src/lib/ticket.ts#L125-L128)). |
| Metadata | `TICKET #{sale.id}`, date `dd/mm/yyyy hh:mm` (es-PY), cashier name, customer name (if any) ([ticket.ts:132-134](src/renderer/src/lib/ticket.ts#L132-L134)). |
| Items | Wrapped product name, then `qty x unit_price ... subtotal` ([ticket.ts:141-149](src/renderer/src/lib/ticket.ts#L141-L149)). |
| Totals | Optional Subtotal + Discount lines; **TOTAL Gs.** in bold/emphasized larger font ([ticket.ts:155-163](src/renderer/src/lib/ticket.ts#L155-L163)). |
| Payments | Method label ("Efectivo", "Transferencia", "Fiado", "Mixto"); per-method breakdown for mixed ([ticket.ts:167-173](src/renderer/src/lib/ticket.ts#L167-L173)). |
| Cash extras | "Recibido" line, and bold "Vuelto" line when change > 0 ([ticket.ts:176-178](src/renderer/src/lib/ticket.ts#L176-L178)). |
| Footer | "¡Gracias por su compra!" centered ([ticket.ts:184](src/renderer/src/lib/ticket.ts#L184)). |

### 15.3 PDF ticket
**Acceptance criteria:**
- jsPDF with Courier monospace, base font 9pt, 10pt for emphasized lines ([ticket-pdf.ts:6-7, 26, 33](src/renderer/src/lib/ticket-pdf.ts#L6-L7)).
- Page width matches the configured thermal width (58 or 80 mm) ([ticket-pdf.ts:17](src/renderer/src/lib/ticket-pdf.ts#L17)).
- For emphasized lines (TOTAL), label and value are positioned independently to absorb the larger font width ([ticket-pdf.ts:36-41](src/renderer/src/lib/ticket-pdf.ts#L36-L41)).
- File name pattern: `ticket-{saleId}.pdf` ([TicketPreviewModal.tsx:73](src/renderer/src/modules/ventas/TicketPreviewModal.tsx#L73)).

### 15.4 Reprint
There is no dedicated reprint flow. Re-printing is achieved by opening any past sale's detail and clicking the printer icon ([VentaDetallePage.tsx:74-82](src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L74-L82)).

---

## 16. Backup, Configuration & System Utilities

### 16.1 Manual backup
- Button "Hacer Backup Ahora" copies `pos.db` to `{backup_path}/backup_YYYY-MM-DDTHH-mm-ss.db` ([BackupPage.tsx:50-60](src/renderer/src/modules/backup/BackupPage.tsx#L50-L60), [backup.ipc.ts:16-22](src/main/ipc/backup.ipc.ts#L16-L22)).
- Default `backup_path` is `app.getPath('userData')/backups`, configurable via folder picker ([backup.ipc.ts:6-13](src/main/ipc/backup.ipc.ts#L6-L13)).

### 16.2 Restore backup
- File picker selects a `.db` to restore ([backup.ipc.ts:95-109](src/main/ipc/backup.ipc.ts#L95-L109)).
- Confirmation modal is **danger**-styled before overwrite; the system **automatically backs up the current DB first** ([BackupPage.tsx:63-80](src/renderer/src/modules/backup/BackupPage.tsx#L63-L80)).

### 16.3 Auto-backup at cash close
- Setting `auto_backup` (0/1); when enabled, a backup is created automatically at session close ([BackupPage.tsx:200-214](src/renderer/src/modules/backup/BackupPage.tsx#L200-L214)).

### 16.4 Scheduled daily backup
**Acceptance criteria:**
- Settings `backup_schedule_enabled` (0/1) and `backup_schedule_time` (HH:MM) ([BackupPage.tsx:216-256](src/renderer/src/modules/backup/BackupPage.tsx#L216-L256)).
- A 60-second poller checks if scheduling is enabled and if the current time matches; runs at most one backup per day ([backup.ipc.ts:35-73](src/main/ipc/backup.ipc.ts#L35-L73)).
- Success and failure both raise OS notifications ([backup.ipc.ts:55-70](src/main/ipc/backup.ipc.ts#L55-L70)).
- "Next scheduled time" is displayed in the UI ([BackupPage.tsx:252-253](src/renderer/src/modules/backup/BackupPage.tsx#L252-L253)).

### 16.5 Configuration page
All settings are stored in `app_settings(key, value)` via `window.api.settings.set(key, value)` ([backup.ipc.ts:121-126](src/main/ipc/backup.ipc.ts#L121-L126), [ConfiguracionPage.tsx:21-46](src/renderer/src/modules/configuracion/ConfiguracionPage.tsx#L21-L46)).

| Group | Keys |
|---|---|
| Business identity | `business_name`, `business_address`, `business_phone` ([ConfiguracionPage.tsx:58-103](src/renderer/src/modules/configuracion/ConfiguracionPage.tsx#L58-L103)) |
| Login UX | `login_keypad_enabled` (0/1) ([ConfiguracionPage.tsx:144-181](src/renderer/src/modules/configuracion/ConfiguracionPage.tsx#L144-L181)) |
| Thermal printer | `thermal_printer_name`, `thermal_printer_width` (58/80) ([ConfiguracionPage.tsx:183-226](src/renderer/src/modules/configuracion/ConfiguracionPage.tsx#L183-L226)) |
| Backup | `backup_path`, `auto_backup`, `backup_schedule_enabled`, `backup_schedule_time` |
| Tutorials | "Reiniciar tutoriales" clears `tour:seen:*` from localStorage ([ConfiguracionPage.tsx:228-257](src/renderer/src/modules/configuracion/ConfiguracionPage.tsx#L228-L257), [tour.store.ts:22-28](src/renderer/src/store/tour.store.ts#L22-L28)) |

> Theme is **not** in `app_settings`; it is persisted in `localStorage` under the key `theme` ([theme.store.ts:5, 30](src/renderer/src/store/theme.store.ts#L5)).

### 16.6 Cross-cutting utilities
- **Theme:** `light` / `dark`, applied by toggling a `dark` class on the root element ([theme.store.ts:12-15, 30, 34](src/renderer/src/store/theme.store.ts#L12-L15)).
- **Toasts:** in-memory Zustand store; default duration 4 s; success/error/info/warning ([toast.store.ts:14, 22-26](src/renderer/src/store/toast.store.ts#L14)).
- **Confirm dialogs:** Promise-based modal API; supports a `danger` flag for destructive actions ([confirm.store.ts:13-27](src/renderer/src/store/confirm.store.ts#L13-L27), [confirm.ts:11-14](src/renderer/src/lib/confirm.ts#L11-L14)).
- **Guided tours:** per-page tours persisted under `tour:seen:{key}` in localStorage; auto-start with a 600 ms delay ([use-page-tour.ts:16-36](src/renderer/src/lib/use-page-tour.ts#L16-L36), [tour.store.ts:3, 31-33](src/renderer/src/store/tour.store.ts#L3)). Tour scripts: backup (4 steps), config (5 steps) ([tour-steps.ts:259-305](src/renderer/src/lib/tour-steps.ts#L259-L305)).
- **Hotkeys:** `useHotkey(key|key[], handler, deps)` keydown utility ([hotkeys.ts:8-16](src/renderer/src/lib/hotkeys.ts#L8-L16)).
- **OS notifications:** `notify:show(title, body)` via Electron `Notification` ([notifications.ipc.ts:3-9](src/main/ipc/notifications.ipc.ts#L3-L9)).
- **Window controls:** custom titlebar via React; `window:minimize / maximizeToggle / close / isMaximized` IPC and a broadcast `window:state` event ([src/main/index.ts:84, 97, 103-104, 118-130](src/main/index.ts#L84)).
- **Splash screen:** shown during DB init; minimum visible 1500 ms ([src/main/index.ts:25, 49-73, 147](src/main/index.ts#L25)).

---

## 17. Cross-cutting Observations (current state)

These are facts about the codebase as it stands today, useful for downstream `/speckit-plan` or `/speckit-analyze` work:

1. **Authorization is now server-side.** As of feature 001-ipc-authorization (committed alongside this round), every IPC handler is wrapped by `registerAuthorized()` ([src/main/auth/guard.ts](src/main/auth/guard.ts)) which (a) resolves the caller's identity from a sender-id-keyed session map ([src/main/auth/session.ts](src/main/auth/session.ts)), (b) re-reads the role from `users` on every call, (c) evaluates against the canonical matrix ([src/main/auth/matrix.ts](src/main/auth/matrix.ts)), (d) records every decision in `auth_audit`. A boot self-test ([src/main/auth/self-test.ts](src/main/auth/self-test.ts)) refuses to start the app if any guarded channel lacks a matrix entry. Recovery (zero active admins) is handled by [src/main/auth/recovery.ts](src/main/auth/recovery.ts) and the `auth:recoveryNeeded` channel.
2. **Sales decrement `products.stock` directly** ([sales.ts:38-46](src/main/db/queries/sales.ts#L38-L46)) — they do **not** create a `stock_adjustments` row. Only manual adjustments and purchase receptions write to that audit table, so the stock-movements report does not include sales.
3. **One-register invariant is enforced server-side**, but the "no sales without an open register" rule is enforced client-side only ([VentasPage.tsx:328-356](src/renderer/src/modules/ventas/VentasPage.tsx#L328-L356) vs no check in [src/main/ipc/sales.ipc.ts](src/main/ipc/sales.ipc.ts)).
4. **`hotkeys.ts` is a thin wrapper.** All POS hotkeys (F4/F8/F9/F12) are wired ad-hoc inside `VentasPage.tsx` rather than through this hook.
5. **Held tickets live in `localStorage`,** not in the database — they are device-bound and cannot be recovered if the user data is wiped.
6. **No reprint flow as a discrete feature.** Reprints reuse the sale-detail screen.
7. **No PIN-recovery flow.** Recovery requires admin to edit the user.

---

*Generated: 2026-05-08. Source branch: `fix/qa-feedback-round-1`.*
