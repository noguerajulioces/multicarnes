# IPC Channels: Cash Movements History

**Feature**: 003-cash-movements-history
**Date**: 2026-05-11

Two new IPC channels are added by this feature. No existing channel changes signature. Both are registered through the standard `registerAuthorized` flow ([src/main/auth/guard.ts](../../../src/main/auth/guard.ts)) and entered in [src/main/auth/matrix.ts](../../../src/main/auth/matrix.ts).

## Channel: `cashMovements:list`

**Purpose.** Return a paginated, filtered slice of cash movements visible to the caller. Used by the new "Movimientos de Caja" page.

**Authorization matrix entry:**

```ts
'cashMovements:list': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }
```

All three roles can call the channel. Cashier-self scoping (FR-015) is enforced **inside the handler** before the query is built — the same shape used by `cash:close` at [cash.ipc.ts:21-38](../../../src/main/ipc/cash.ipc.ts#L21-L38).

**Request payload:**

```ts
interface CashMovementListOpts {
  from?: string                // 'YYYY-MM-DD' inclusive; default = today
  to?: string                  // 'YYYY-MM-DD' inclusive; default = today
  types?: CashMovementType[]   // subset of {income, expense, opening, closing, void}; default = all
  userId?: number              // ignored when caller is cajero (forced to caller's id)
  registerId?: number          // optional, restricts to one cash register session
  search?: string              // optional case-insensitive substring on description
  page?: number                // 1-indexed; default 1
  perPage?: number             // default 25; clamped to [10, 100]
}
```

**Response payload:**

```ts
interface CashMovementListResult {
  items: CashMovementRow[]
  total: number
  page: number
  perPage: number
}

interface CashMovementRow {
  id: number
  registerId: number
  userId: number
  userName: string
  type: 'income' | 'expense' | 'opening' | 'closing' | 'void'
  amount: number           // integer Gs.
  description: string
  createdAt: string        // 'YYYY-MM-DD HH:MM:SS' localtime
  isVoided: boolean
  voidedBy: number | null  // inverse movement id if this row was voided
  voidOf: number | null    // original id if this row IS the void
  registerStatus: 'open' | 'closed'
}
```

**Handler skeleton:**

```ts
registerAuthorized(
  'cashMovements:list',
  getRule('cashMovements:list'),
  (_event, ctx, opts: CashMovementListOpts) => {
    return cashMovementsQuery.listMovements(opts, {
      callerUserId: ctx.userId,
      callerRole: ctx.role
    })
  }
)
```

**Errors (surfaced as `Error.message`, no special code):**

| Condition | Message |
|---|---|
| `perPage` outside [10, 100] | `'perPage debe estar entre 10 y 100.'` |
| `from > to` | `'El rango de fechas es inválido.'` |
| `types` contains unknown value | `'Tipo de movimiento inválido.'` |

Authorization failures (caller not authenticated, role missing) are surfaced through the standard `registerAuthorized` failure path and recorded in `auth_audit` automatically.

**Preload binding** ([src/preload/index.ts](../../../src/preload/index.ts)):

```ts
cashMovements: {
  list: (opts: CashMovementListOpts): Promise<CashMovementListResult> =>
    ipcRenderer.invoke('cashMovements:list', opts),
  // ... void below
}
```

**Type definition** ([src/preload/index.d.ts](../../../src/preload/index.d.ts)):

```ts
cashMovements: {
  list: (opts: CashMovementListOpts) => Promise<CashMovementListResult>
  void: (originalId: number) => Promise<CashMovementRow>
}
```

---

## Channel: `cashMovements:void`

**Purpose.** Anular a previously recorded manual movement by inserting an inverse (`type='void'`) row linked to the original via `void_of`. The original survives intact.

**Authorization matrix entry:**

```ts
'cashMovements:void': { kind: 'privileged', roles: ['admin', 'supervisor'] }
```

Cashier role is excluded by the matrix; no further handler-side check is needed for role gating (FR-018).

**Request payload:**

```ts
number  // the id of the original movement to void
```

A single positional argument keeps the channel signature consistent with how other one-id mutations are shaped (`sales:cancel`, `purchases:cancel`).

**Response payload:**

```ts
CashMovementRow  // the newly created inverse row
```

The renderer applies the returned row by appending to its list (or invalidating + refetching the first page). The caller is also expected to refetch the original row's status so the UI flips the original from non-voided to voided.

**Handler skeleton:**

```ts
registerAuthorized(
  'cashMovements:void',
  getRule('cashMovements:void'),
  (_event, ctx, originalId: number) => {
    return cashMovementsQuery.voidMovement(originalId, ctx.userId)
  }
)
```

**Errors:**

| Condition | Message | Constraint |
|---|---|---|
| Original not found | `'Movimiento no encontrado.'` | — |
| Original is opening or closing | `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'` | FR-022 |
| Original is itself a void | `'No se puede anular una anulación.'` | FR-023 |
| Original already voided | `'Este movimiento ya fue anulado.'` | FR-025 |

All four are user-readable (Spanish for the renderer toast) and reach the renderer through the existing api-error pipeline at [src/renderer/src/lib/api-error.ts](../../../src/renderer/src/lib/api-error.ts).

**Audit footprint:**

- One `auth_audit` row with `operation = 'cashMovements:void'`, `resolved_user_id = ctx.userId`, `resolved_role = ctx.role`, `outcome = 'allowed'`. The guard writes this automatically.
- One `action_logs` row with `action = 'void_cash_movement'`, `details = JSON.stringify({ original_id, inverse_id })`. The query function writes this explicitly inside the same transaction as the inverse-row insert.

---

## Existing channels touched

None of these change signature. Listed for awareness:

- `cash:open` — handler unchanged; the query function `openCashRegister` now also inserts a synthetic `opening` row in `cash_movements` (data-model §"Ongoing synthetic emission"). The IPC contract for `cash:open` is unaffected.
- `cash:close` — same as above for the `closing` row.
- `cash:getMovements` — unchanged; still returns movements for one register. The "Movimientos de Caja" page does not call this channel; it calls the new `cashMovements:list` with a cross-register, paginated scope.
- `cash:getSummary` — unchanged signature. Internal SQL is updated to account for void rows so historical session totals do not silently shift when a void is added (data-model §"Effect on cash_registers totals").

## Preload surface diff

The only renderer-visible additions are the two functions on the `cashMovements` object. The existing `cash` object on the preload bridge is untouched.

```ts
// Before (excerpt):
window.api.cash.open(...)
window.api.cash.getCurrent()
window.api.cash.close(...)
window.api.cash.addMovement(...)
window.api.cash.getMovements(...)
window.api.cash.getSummary(...)
window.api.cash.getAll()

// After (additions only):
window.api.cashMovements.list(opts)
window.api.cashMovements.void(originalId)
```

The split (`cash.*` vs `cashMovements.*`) mirrors the split already used between `customers.*` and `customers:addPayment` style channels: page-level read surfaces get their own namespace to keep imports tight.
