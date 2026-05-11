# Authorization Matrix

> The single canonical source of truth for who can do what. Lives in `src/main/auth/matrix.ts` as a TypeScript object literal. This document is the human-readable mirror reviewed in PRs whenever the matrix changes.

## Rule kinds

- **`public`** — accessible without authentication.
- **`self-only`** — caller must be the user identified by `args[selfArgIndex]`. No role required.
- **`self-or-roles`** — caller satisfies the rule if either (a) the caller's role is in `roles`, or (b) the caller is the user identified by `args[selfArgIndex]`.
- **`privileged`** — caller's role must be in `roles`.
- **`privileged` with `recoveryOnly: true`** — the operation is also `public` while `recoveryMode=true` (no active admins exist).

Channels not listed are denied by default (FR-008).

---

## Authentication & users

| Channel | Rule | Notes |
|---|---|---|
| `users:getActive` | `public` | Login picker. Returns only `id`, `name`, `role` of active users. |
| `users:login` | `public` | Authentication itself. Establishes the session on success. |
| `users:logout` *(new)* | `public` | Clears session for current `senderId`. |
| `users:create` | `privileged: ['admin']`, `recoveryOnly: true` | Public when no admin exists (recovery / first run). |
| `users:getAll` | `privileged: ['admin']` | Full user list incl. inactive. |
| `users:getById` | `self-or-roles: ['admin']` | Cashier reads own; admin reads any. |
| `users:update` | `self-or-roles: ['admin']`, `selfArgIndex: 0` | Self-update may only modify `pin_hash` (handler-enforced). Admin may modify all fields. |

## Authorization (new module)

| Channel | Rule | Notes |
|---|---|---|
| `auth:recoveryNeeded` | `public` | Boolean — does the system have zero active admins? Used by login UI to show recovery flow. |
| `auth:matrixSummary` | `privileged: ['admin']` | Read-only dump of the matrix for ops review. |
| `auth:listAuditEntries` | `privileged: ['admin']` | Paginated query of `auth_audit`, filterable by user/operation/outcome/date. |
| `auth:listAlerts` | `privileged: ['admin']` | Open alerts (acknowledged_at IS NULL). |
| `auth:acknowledgeAlert` | `privileged: ['admin']` | Marks an alert acknowledged. |

## Profile (self-service)

The existing `PerfilPage` flow continues to work via `users:update` with `self-or-roles` (above). No new channel.

## Cash management

| Channel | Rule | Notes |
|---|---|---|
| `cash:open` | `privileged: ['admin','supervisor','cajero']` | Any logged-in user opens their own session. |
| `cash:getCurrent` | `privileged: ['admin','supervisor','cajero']` | |
| `cash:close` | `privileged: ['admin','supervisor']` + special: cashier may close the register **they opened**. | The handler additionally checks `cash_registers.user_id == ctx.userId` for the cashier-self path. |
| `cash:addMovement` | `privileged: ['admin','supervisor']` | Cash in/out movements (FR-011). |
| `cash:getMovements` | `privileged: ['admin','supervisor','cajero']` | Read own session. |
| `cash:getSummary` | `privileged: ['admin','supervisor','cajero']` | |
| `cash:getAll` | `privileged: ['admin','supervisor']` | Historical sessions. |

## Sales

| Channel | Rule | Notes |
|---|---|---|
| `sales:create` | `privileged: ['admin','supervisor','cajero']` | (FR-012) |
| `sales:getById` | `privileged: ['admin','supervisor','cajero']` | |
| `sales:getRecent` | `privileged: ['admin','supervisor','cajero']` | Dashboard. |
| `sales:getByRegister` | `privileged: ['admin','supervisor','cajero']` | |
| `sales:cancel` | `privileged: ['admin','supervisor']` | (FR-011) |
| `sales:dayTotal` | `privileged: ['admin','supervisor','cajero']` | Dashboard tile. |

## Customers

| Channel | Rule | Notes |
|---|---|---|
| `customers:getAll` | `privileged: ['admin','supervisor','cajero']` | |
| `customers:getById` | `privileged: ['admin','supervisor','cajero']` | |
| `customers:create` | `privileged: ['admin','supervisor']` | (FR-014) |
| `customers:update` | `privileged: ['admin','supervisor']` | |
| `customers:delete` | `privileged: ['admin','supervisor']` | |
| `customers:addPayment` | `privileged: ['admin','supervisor']` | |
| `customers:updatePayment` | `privileged: ['admin','supervisor']` | |
| `customers:deletePayment` | `privileged: ['admin','supervisor']` | |
| `customers:getPayments` | `privileged: ['admin','supervisor','cajero']` | Read-only. |
| `customers:getSales` | `privileged: ['admin','supervisor','cajero']` | Read-only. |

## Products

| Channel | Rule | Notes |
|---|---|---|
| `products:getAll` | `privileged: ['admin','supervisor','cajero']` | Response is **stripped** of `last_purchase_cost` / margin fields when caller is `cajero` (handler-enforced; the rule lets the call through). |
| `products:getById` | `privileged: ['admin','supervisor','cajero']` | Same content-stripping for cajero. |
| `products:getByBarcode` | `privileged: ['admin','supervisor','cajero']` | |
| `products:create` | `privileged: ['admin','supervisor']` | (FR-013) |
| `products:update` | `privileged: ['admin','supervisor']` | |
| `products:adjustStock` | `privileged: ['admin','supervisor']` | |
| `products:categories` | `privileged: ['admin','supervisor','cajero']` | |
| `products:createCategory` | `privileged: ['admin','supervisor']` | |
| `products:lowStock` | `privileged: ['admin','supervisor','cajero']` | Cashier sees stock alerts on dashboard. |
| `products:movements` | `privileged: ['admin','supervisor']` | Audit data. |
| `products:recentSales` | `privileged: ['admin','supervisor']` | May reveal price history. |
| `products:salesStats` | `privileged: ['admin','supervisor']` | |
| `products:lastPurchase` | `privileged: ['admin','supervisor']` | Cost data (FR-015). |
| `products:uploadImage` | `privileged: ['admin','supervisor']` | |
| `products:pickImage` | `privileged: ['admin','supervisor']` | |
| `products:saveImageFromPath` | `privileged: ['admin','supervisor']` | |
| `products:getImagePath` | `public` | Returns directory string only; no DB. |

## Suppliers & purchases

All supplier and purchase channels are **`privileged: ['admin','supervisor']`** because they reveal cost data:

`suppliers:getAll`, `suppliers:getById`, `suppliers:create`, `suppliers:update`, `purchases:getAll`, `purchases:getById`, `purchases:create`, `purchases:receive`, `purchases:cancel`.

## Reports

| Channel | Rule | Notes |
|---|---|---|
| `reports:salesByPeriod` | `privileged: ['admin','supervisor','cajero']` | Operational; no cost data. |
| `reports:topProducts` | `privileged: ['admin','supervisor','cajero']` | Quantity & revenue, no cost. |
| `reports:profitMargin` | `privileged: ['admin','supervisor']` | (FR-015) |
| `reports:stockMovements` | `privileged: ['admin','supervisor']` | Audit data. |
| `reports:cashRegisters` | `privileged: ['admin','supervisor']` | |
| `reports:pendingCredits` | `privileged: ['admin','supervisor']` | Customer financial state. |
| `reports:salesSummary` | `privileged: ['admin','supervisor','cajero']` | Operational. |
| `reports:salesComparison` | `privileged: ['admin','supervisor','cajero']` | Operational. |

## Backup & settings

| Channel | Rule | Notes |
|---|---|---|
| `backup:create` | `privileged: ['admin','supervisor']` | |
| `backup:list` | `privileged: ['admin','supervisor']` | |
| `backup:restore` | `privileged: ['admin']` | (FR-010) |
| `backup:selectFolder` | `privileged: ['admin']` | |
| `settings:getAll` | `public` (with field whitelist) | Handler returns only display-safe keys (theme, business name/phone/address, printer name, printer width, login keypad, backup-schedule flags). Excludes any future sensitive key. |
| `settings:set` | `privileged: ['admin']` | (FR-010) |

## System utilities

| Channel | Rule | Notes |
|---|---|---|
| `notify:show` | `public` | OS notification API only; no DB. |
| `print:ticket` | `privileged: ['admin','supervisor','cajero']` | |
| `print:hasConfig` | `public` | Boolean only. |
| `window:minimize` / `window:maximizeToggle` / `window:close` / `window:isMaximized` | `public` | Window controls. |

---

## Coverage summary

- **Total channels** in matrix: 85 (81 existing + 4 new `auth:*`).
- **Rule kinds used**: `public` (12), `self-or-roles` (2 — `users:getById`, `users:update`), `privileged` (71). No `self-only` channels in v1 — the two self-cases are covered by `self-or-roles` so admin can also act.
- **Recovery-only**: 1 (`users:create`).
- **Default**: deny. A handler not in the matrix is treated as `{kind:'privileged', roles:[]}` and always blocks.
