# Contract: Promo Fields on `products:*` IPC Channels

This feature adds **no new IPC channels**. It extends the request and response payloads of the existing `products:*` channels to carry the five new promo fields. Matrix entries for these channels are already correct and are not modified.

| Channel | Direction | Matrix entry | Change |
|---------|-----------|--------------|--------|
| `products:create` | renderer → main | `privileged: [admin, supervisor]` (existing) | Request: accepts 5 new optional fields. Response: returns the created Product including those fields. |
| `products:update` | renderer → main | `privileged: [admin, supervisor]` (existing) | Request: accepts 5 new optional fields. Response: returns the updated Product. |
| `products:getAll` | renderer → main | `privileged: [admin, supervisor, cajero]` (existing) | Request: accepts a new optional `inPromoOnly?: boolean` filter (see [products-in-promo-filter.md](products-in-promo-filter.md)). Response items include the 5 promo fields. |
| `products:getById` | renderer → main | `privileged: [admin, supervisor, cajero]` (existing) | Response: Product with 5 promo fields. |
| `products:getByBarcode` | renderer → main | `privileged: [admin, supervisor, cajero]` (existing) | Response: Product with 5 promo fields. |

---

## Request fields (write channels)

```ts
interface CreateOrUpdateProductInput {
  // ... all existing fields ...

  promo_enabled?: boolean        // default false on create
  promo_type?: 'fixed' | 'percent' | null
  promo_value?: number | null    // Gs for 'fixed'; integer 1..99 for 'percent'
  promo_from?: string | null     // 'YYYY-MM-DD' or null
  promo_to?: string | null       // 'YYYY-MM-DD' or null
}
```

### Validation (enforced in main, mirrored in the renderer form)

| Code | Condition | User-facing message (Spanish) |
|------|-----------|-------------------------------|
| `PROMO_INCOMPLETE` | `promo_enabled === true` AND (`promo_type` missing OR `promo_value` missing) | `"Para activar la promoción, indicá el tipo y el valor."` |
| `PROMO_FIXED_NOT_LESS_THAN_PRICE` | `promo_type === 'fixed'` AND `promo_value >= price` | `"El precio promo debe ser menor al precio normal."` |
| `PROMO_FIXED_NOT_POSITIVE` | `promo_type === 'fixed'` AND `promo_value <= 0` | `"El precio promo debe ser mayor a 0."` |
| `PROMO_PERCENT_OUT_OF_RANGE` | `promo_type === 'percent'` AND (`promo_value < 1` OR `promo_value > 99`) | `"El descuento debe estar entre 1% y 99%."` |
| `PROMO_DATE_FORMAT` | Either bound set and not `^\d{4}-\d{2}-\d{2}$` | `"La fecha debe tener formato AAAA-MM-DD."` |
| `PROMO_DATE_RANGE` | Both bounds set and `promo_from > promo_to` (lexicographic) | `"La fecha 'Desde' debe ser anterior o igual a 'Hasta'."` |

### Error envelope

Errors flow through the existing `registerAuthorized` error path — a thrown `Error` becomes a rejected IPC promise on the renderer, surfaced as a toast via the existing `toast.store.ts` pattern. The new error codes go on `error.message` for the form to switch on.

---

## Response shape (read channels)

The `Product` interface in `src/shared/types.ts` is extended (see [data-model.md §2.1](../data-model.md)). On the row mapper inside `queries/products.ts`:

```ts
function rowToProduct(row: any): Product {
  return {
    // ... existing field mapping ...
    promo_enabled: !!row.promo_enabled,
    promo_type: row.promo_type ?? null,
    promo_value: row.promo_value ?? null,
    promo_from: row.promo_from ?? null,
    promo_to: row.promo_to ?? null,
  }
}
```

For backwards compatibility, callers that don't know about promo fields ignore them — TypeScript's optional-property semantics + the additive nature of the row mapper guarantee zero behaviour change for non-promo code paths.

---

## Audit-log side-effect

Each successful `products:create` or `products:update` that changes any of (`promo_enabled`, `promo_type`, `promo_value`, `promo_from`, `promo_to`) writes one row to `action_logs` inside the same transaction:

| Change | `action` | `details` (JSON) |
|--------|----------|-------------|
| `0 → 1` (enable) | `promo_enable` | `{ "product_id": N, "type":..., "value":..., "from":..., "to":... }` |
| Mutation while `1` | `promo_update` | `{ "product_id": N, "before": {...}, "after": {...} }` |
| `1 → 0` (disable) | `promo_disable` | `{ "product_id": N, "previous": {...} }` |

If only non-promo fields change (e.g., name, price), no promo audit row is written.

---

## Idempotency

- `products:update` with the same values as the current row is a no-op for the data **and** for the audit log (no audit row is written when no promo field actually changed).
- `products:update` flipping `promo_enabled` from `1` to `1` (i.e., no change) is also a no-op.

This matches the spirit of FR-012 in feature 002 / round-2 fixes: the system never writes a misleading audit row.
