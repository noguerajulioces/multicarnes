# IPC Channel Signature Changes

**Feature**: 002-review-fixes
**Scope**: Four IPC channels change shape. Every change is in lockstep across [src/main/ipc](../../../src/main/ipc), [src/preload/index.ts](../../../src/preload/index.ts), and [src/preload/index.d.ts](../../../src/preload/index.d.ts) so the renderer cannot call a stale signature even at compile time.

> The auth-guard wrapper from feature 001 resolves the caller's `userId` server-side before the handler body runs; the body reads it from the resolved session, not from a renderer-supplied argument.

---

## 1. `heldTickets:list`

**Before**:
```ts
window.api.heldTickets.list(): Promise<HeldTicketRow[]>
```
Returns every row in `held_tickets`.

**After**:
```ts
window.api.heldTickets.list(): Promise<HeldTicketRow[]>
```
Signature unchanged at the preload boundary. The main-side handler now reads the authenticated user id from the session and passes it to `listHeldTickets(userId)`, which filters by `WHERE user_id = ?`. **No renderer change required for this channel.**

---

## 2. `heldTickets:add`

**Before**:
```ts
window.api.heldTickets.add(data: {
  id: string
  label: string
  payload: string
  discount: number
}): Promise<HeldTicketRow>
```

**After**:
```ts
window.api.heldTickets.add(data: {
  id: string
  label: string
  payload: string
  discount: number
}): Promise<HeldTicketRow>
```
Signature unchanged at the preload boundary. The main-side handler now derives `userId` from the session and passes it to `addHeldTicket({ ...data, userId })`. **No renderer change required for this channel.**

---

## 3. `heldTickets:remove`

**Before**:
```ts
window.api.heldTickets.remove(id: string): Promise<void>
```

**After**:
```ts
window.api.heldTickets.remove(id: string): Promise<void>
```
Signature unchanged at the preload boundary. The main-side handler passes the session's `userId` to `removeHeldTicket(id, userId)`, which adds `AND user_id = ?` to the DELETE. **No renderer change required for this channel.**

---

## 4. `purchases:receive`

**Before**:
```ts
window.api.purchases.receive(id: number): Promise<PurchaseOrder>
```

**After**:
```ts
window.api.purchases.receive(id: number): Promise<PurchaseOrder>
```
Signature unchanged at the preload boundary. The main-side handler derives `userId` from the session and passes it to `receivePurchaseOrder(id, userId)`. **No renderer change required for this channel.**

---

## 5. `sales:cancel`

**Before**:
```ts
window.api.sales.cancel(id: number): Promise<Sale | null>
```

**After**:
```ts
window.api.sales.cancel(id: number, options?: {
  refundMixedCredit?: boolean
}): Promise<Sale | null>
```
The optional `options` parameter is the **only** signature change visible to the renderer. The renderer's existing cancel-button flow passes nothing (preserving today's behaviour for non-mixed sales). The new `MixedCancellationModal` passes `{ refundMixedCredit: true | false }` once the user has chosen. The main-side handler derives `userId` from the session as before.

**Behaviour by payment method**:

| Payment method | `options.refundMixedCredit` | Customer balance change | `action_logs.details` |
|---|---|---|---|
| `cash` (or any non-credit single tender) | ignored | none | unchanged from today |
| `credit` (pure) | ignored | `+= sale.total` (existing behaviour) | unchanged from today |
| `mixed` | `undefined` or `false` | none | `"Venta #N anulada — porción crédito $X (devolución NO aplicada por decisión del cajero)"` |
| `mixed` | `true` | `+= creditPortion` | `"Venta #N anulada — porción crédito $X (devolución aplicada)"` |

The renderer is responsible for *only* asking the question when `payment_method === 'mixed'`. The main process accepts the flag in any case and ignores it when not applicable.

---

## Auth matrix entries

No new entries are added. The existing entries for `heldTickets:*`, `purchases:receive`, and `sales:cancel` already cover the channels:

| Channel | Existing matrix entry | Notes |
|---|---|---|
| `heldTickets:list` | `roles-only` → `['admin', 'supervisor', 'cashier']` | Filtering by `user_id` happens *after* the guard allows the call. Other users' tickets are not even returned. |
| `heldTickets:add` | `roles-only` → `['admin', 'supervisor', 'cashier']` | The resolved `userId` becomes the row owner. |
| `heldTickets:remove` | `roles-only` → `['admin', 'supervisor', 'cashier']`. Ownership is **not** validated by the guard (the channel arg is a ticket id, not a user id, so `self-or-roles` doesn't fit). | Ownership is enforced inside the repository: `DELETE … AND user_id = ?` plus a `changes === 0` check that writes an `action_logs` row and throws (FR-003). The guard's audit covers role; the repository's `action_logs` row covers cross-user attempts. |
| `purchases:receive` | `roles-only` → `['admin', 'supervisor']` | The resolved `userId` becomes the audit attribution. |
| `sales:cancel` | `roles-only` → `['admin', 'supervisor']` | The resolved `userId` is recorded in `action_logs.user_id` as today. |

---

## Stability commitment

Once this feature ships, these signatures are part of the application's renderer/main contract. Any subsequent change requires a coordinated update across the three files listed at the top of this document and the matrix entry above; piecemeal changes are explicitly rejected.
