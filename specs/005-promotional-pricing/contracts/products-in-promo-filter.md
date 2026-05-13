# Contract: `inPromoOnly` Filter on `products:getAll`

Extends the existing list-paged `products:getAll` IPC channel with an optional `inPromoOnly?: boolean` flag. Matrix entry is unchanged (`privileged: [admin, supervisor, cajero]`); the new flag is for the admin/supervisor product-listing view, but it is safe to expose to cashier callers since it only narrows the result, not widens it.

---

## Request

```ts
interface ProductListFilters {
  // ... existing fields: search, categoryId, statusFilter, lowStockOnly, page, perPage ...
  inPromoOnly?: boolean   // NEW. default false / undefined ≡ "do not filter on promo"
}
```

## Response

Same shape as today (`Paginated<Product>`). Each `Product` now includes the five promo fields per the [main contract](products-promo-fields.md).

---

## SQL semantics

When `inPromoOnly === true`, the `WHERE` clause picks up:

```sql
AND promo_enabled = 1
AND (promo_from IS NULL OR promo_from <= date('now','localtime'))
AND (promo_to   IS NULL OR promo_to   >= date('now','localtime'))
```

The `date('now','localtime')` SQLite call returns `YYYY-MM-DD` in the store's local timezone — same string format used by `promo_from` / `promo_to`, so the comparison is direct text and uses natural ordering (research R4, R7).

The partial index `idx_products_promo_enabled` (created in migration v8) covers this predicate and keeps the query fast on large catalogues.

When `inPromoOnly === false` or omitted, the query is byte-identical to today's behaviour — non-regression for every existing caller.

---

## Renderer wiring

[src/renderer/src/modules/productos/ProductosPage.tsx](../../src/renderer/src/modules/productos/ProductosPage.tsx) adds a "Solo en promo" filter chip in the same chip group as the existing "Bajo mínimo" / status filters. Selecting it sets `inPromoOnly: true` on the next `products:getAll` call and clears the page index (existing filter-change behaviour).

The cashier-facing `VentasPage.tsx` does not consume this filter in v1 (out-of-scope per spec assumptions).
