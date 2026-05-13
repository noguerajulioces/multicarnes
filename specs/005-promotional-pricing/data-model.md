# Phase 1 — Data Model: Promotional Pricing

## 1. Entities

### 1.1 `products` (extended — existing table)

The existing table at [src/main/db/schema.ts:19-32](../../src/main/db/schema.ts#L19-L32) gains five additive columns. Existing columns are unchanged.

| Column | Type | Null? | Default | Source | Description |
|--------|------|-------|---------|--------|-------------|
| `id` | INTEGER | NO | autoinc | existing | Primary key. |
| `category_id` | INTEGER | YES | — | existing | FK → `categories(id)`. |
| `name` | TEXT | NO | — | existing | Product name. |
| `barcode` | TEXT | YES, UNIQUE | — | existing | Optional unique barcode. |
| `price` | INTEGER | NO | `0` | existing | **Normal** selling price in Gs. |
| `price_type` | TEXT | NO | `'unit'` | existing | One of the 8 `PriceType` values. |
| `stock` | REAL | NO | `0` | existing | Current on-hand stock. |
| `min_stock` | REAL | NO | `0` | existing | Threshold for low-stock alerts. |
| `image` | TEXT | YES | — | existing | Filename under `userData/images`. |
| `active` | INTEGER | NO | `1` | existing | Soft-delete flag. |
| `created_at` | TEXT | NO | local now | existing | Insertion timestamp. |
| `updated_at` | TEXT | NO | local now | existing | Last-modified timestamp. |
| **`promo_enabled`** | **INTEGER** | **NO** | **`0`** | **NEW (v8)** | `1` if a promo is configured AND turned on; `0` otherwise. |
| **`promo_type`** | **TEXT** | **YES** | **`NULL`** | **NEW (v8)** | `'fixed'` or `'percent'`. `NULL` is valid only when `promo_enabled = 0`. |
| **`promo_value`** | **INTEGER** | **YES** | **`NULL`** | **NEW (v8)** | For `'fixed'`: Gs amount. For `'percent'`: integer 1–99. `NULL` only when `promo_enabled = 0`. |
| **`promo_from`** | **TEXT** | **YES** | **`NULL`** | **NEW (v8)** | `YYYY-MM-DD` (local). `NULL` ≡ "no lower bound". |
| **`promo_to`** | **TEXT** | **YES** | **`NULL`** | **NEW (v8)** | `YYYY-MM-DD` (local). `NULL` ≡ "no upper bound". |

**Application-level invariants** (enforced in `queries/products.ts`):
1. If `promo_enabled = 1` then `promo_type IN ('fixed','percent')` AND `promo_value IS NOT NULL`.
2. If `promo_type = 'fixed'` then `promo_value` is a positive integer **strictly less than** `price` at the moment of save.
3. If `promo_type = 'percent'` then `promo_value` is an integer in `[1, 99]`.
4. If both `promo_from` and `promo_to` are non-null, then `promo_from <= promo_to` (lexicographic on `YYYY-MM-DD` is correct).
5. Any non-null `promo_from` / `promo_to` matches `^\d{4}-\d{2}-\d{2}$`.

**Why no DB-level CHECK constraints**: see research R6 — application validation surfaces clearer errors and matches existing patterns (barcode uniqueness, stock validation).

### 1.2 `action_logs` (existing — new action values only)

[Existing schema](../../src/main/db/schema.ts) at lines 152-158. No change to columns.

New `action` values added by this feature:

| `action` | When written | `details` payload (JSON-stringified) |
|----------|--------------|--------------------------------------|
| `promo_enable` | `products.update` flips `promo_enabled` from `0` → `1`, or a new product is created with `promo_enabled = 1`. | `{ "product_id": N, "type": "fixed"\|"percent", "value": V, "from": "YYYY-MM-DD"\|null, "to": "YYYY-MM-DD"\|null }` |
| `promo_update` | `products.update` mutates any promo field while `promo_enabled` stays `1`. | `{ "product_id": N, "before": { "type":..., "value":..., "from":..., "to":... }, "after": { same shape } }` |
| `promo_disable` | `products.update` flips `promo_enabled` from `1` → `0`. | `{ "product_id": N, "previous": { "type":..., "value":..., "from":..., "to":... } }` |

The audit row is inserted **inside the same `db.transaction()`** as the product update, so the audit and the change are atomic.

### 1.3 `sale_items` (existing — no change)

Sales lines store `unit_price` and `subtotal` already. The current behaviour persists: whichever `unit_price` the cashier rang up is recorded verbatim, whether it came from a promo or not. No new column needed on the persisted side — the "Ahorrás" totals on the receipt are derived at print time from `sale_items.unit_price` vs the `products.price` of each line (joined through `product_id`). Lines added under promo therefore continue to show their as-charged price even if the promo state on the product later changes.

> **Note on historical "Ahorrás" reprints**: because `sale_items` does NOT snapshot the `normal_price` at the time of sale (we rely on the product's current `price` to compute savings), a reprint of an old sale will show "Ahorrás" amounts computed against the product's *current* `price`, not the price at the time of the original sale. This is acceptable in v1 because (a) the as-charged line price is preserved verbatim — the customer is never re-charged or refunded for a reprint, and (b) merchants change normal `price` rarely. If retroactive accuracy on reprints becomes important, a future migration adds `normal_price` to `sale_items` and the receipt renderer reads that instead. Documented here so a reviewer can decide whether to file a follow-up.

---

## 2. Derived / in-memory shapes

### 2.1 `Product` (TypeScript — extended in `src/shared/types.ts`)

```ts
export interface Product {
  // existing
  id: number
  category_id: number | null
  category_name?: string
  name: string
  barcode: string | null
  price: number
  price_type: PriceType
  stock: number
  min_stock: number
  image: string | null
  active: boolean
  low_stock?: boolean
  created_at?: string
  updated_at?: string
  // promo (NEW — all optional on read so callers that don't care can ignore)
  promo_enabled?: boolean
  promo_type?: 'fixed' | 'percent' | null
  promo_value?: number | null
  promo_from?: string | null  // YYYY-MM-DD
  promo_to?: string | null    // YYYY-MM-DD
}
```

Mapping from the SQLite row to this shape happens in `queries/products.ts`'s row mapper: `promo_enabled` is converted `INTEGER → boolean` (consistent with how `active` is mapped today).

### 2.2 `EffectivePrice` (NEW — `src/renderer/src/lib/promo.ts`)

```ts
export interface EffectivePrice {
  /** What the POS charges for one unit of this product right now. */
  unitPrice: number
  /** The product's normal price (i.e. the strike-through value). */
  normalPrice: number
  /** Per-unit savings: normalPrice - unitPrice. Always > 0 when returned. */
  savingsPerUnit: number
}

export function isPromoActive(product: Product, now: Date): EffectivePrice | null
export function computeEffectivePrice(product: Product, now: Date): EffectivePrice | null  // alias for clarity at call sites
```

**Semantics** (encoding R2, R4, R5):
1. If `product.promo_enabled !== true` → return `null`.
2. If `product.promo_from` is set, and `format(now, 'YYYY-MM-DD') < promo_from` → return `null` (promo not yet active).
3. If `product.promo_to` is set, and `format(now, 'YYYY-MM-DD') > promo_to` → return `null` (promo expired).
4. If `promo_type === 'fixed'` → `unitPrice = promo_value`.
5. If `promo_type === 'percent'` → `unitPrice = Math.round(product.price * (1 - promo_value / 100))`.
6. If `unitPrice >= product.price` → return `null` (defensive — guards against a normal-price drop that erased the promo gap). This means a stale fixed-amount promo that no longer beats the normal price silently disables itself rather than charging the customer at the higher of the two.
7. Otherwise return `{ unitPrice, normalPrice: product.price, savingsPerUnit: product.price - unitPrice }`.

### 2.3 `CartItem` (TypeScript — extended in `src/shared/types.ts`)

```ts
export interface CartItem {
  // existing
  product: Product
  quantity: number
  subtotal: number
  // NEW — present only when the line was added under an active promo
  unit_price?: number           // what we charged per unit (mirrors the snapshot)
  normal_price?: number         // for the strike-through and "Ahorrás" math
  savings_per_unit?: number     // == normal_price - unit_price; cached for render perf
}
```

**Snapshot at add-to-cart time** (encoding R3):

```ts
addItem(product, quantity) {
  const eff = computeEffectivePrice(product, new Date())
  const unit = eff?.unitPrice ?? product.price
  const newItem: CartItem = {
    product,
    quantity,
    subtotal: Math.round(quantity * unit),
    ...(eff ? {
      unit_price: eff.unitPrice,
      normal_price: eff.normalPrice,
      savings_per_unit: eff.savingsPerUnit,
    } : {})
  }
  // ... existing merge-existing-or-push logic, using `unit` in place of product.price ...
}
```

**Existing line update** when quantity changes: `subtotal = Math.round(newQty * (item.unit_price ?? item.product.price))`. The cart never recomputes `unit_price`; only the user explicitly removing and re-adding the line refreshes the promo decision (and the UI does not currently expose a "re-evaluate" action — that's intentional).

### 2.4 Receipt payload (existing `Sale` shape — no change)

Receipt rendering takes the persisted `Sale` (with `sale_items`) and the current `Product` rows (joined via `product_id`) and computes the "Ahorrás" totals at render time. No new field crosses the IPC or storage boundary.

```ts
// pseudocode for ticket.ts and ticket-pdf.ts
const savings = sale.items.reduce((sum, item) => {
  const product = productsById.get(item.product_id)
  if (!product) return sum
  const normal = product.price
  return item.unit_price < normal ? sum + (normal - item.unit_price) * item.quantity : sum
}, 0)
if (savings > 0) {
  printLine(`Ahorrás Gs. ${formatGs(savings)}`)
}
```

---

## 3. State transitions

A product's promo state moves through this small finite state machine:

```
                                  enable
                                ──────────▶
              no-promo                              enabled
            (promo_enabled=0)                  (promo_enabled=1)
              ◀──────────                          │     ▲
                  disable                          │     │
                                                edit│     │ edit
                                                    ▼     │
                                              enabled (new values)
```

There is no "scheduled-but-not-yet-active" persistent state — that distinction is computed from `promo_from` / `promo_to` at evaluation time. From the database's perspective, the product is either `promo_enabled=0` or `promo_enabled=1`; the date range is data inside the latter state, not a separate state.

This keeps the persistent state machine minimal (matches Principle VII) and avoids a background job to "wake" promos at midnight.

---

## 4. Migration (v8)

Appended to the `MIGRATIONS` array in [src/main/db/index.ts](../../src/main/db/index.ts) after the existing v7 entry. Pseudocode:

```ts
{
  version: 8,
  name: 'add_products_promo_columns',
  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[]
    const has = (n: string) => cols.some((c) => c.name === n)
    if (!has('promo_enabled')) {
      db.exec('ALTER TABLE products ADD COLUMN promo_enabled INTEGER NOT NULL DEFAULT 0')
    }
    if (!has('promo_type')) {
      db.exec('ALTER TABLE products ADD COLUMN promo_type TEXT')
    }
    if (!has('promo_value')) {
      db.exec('ALTER TABLE products ADD COLUMN promo_value INTEGER')
    }
    if (!has('promo_from')) {
      db.exec('ALTER TABLE products ADD COLUMN promo_from TEXT')
    }
    if (!has('promo_to')) {
      db.exec('ALTER TABLE products ADD COLUMN promo_to TEXT')
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_promo_enabled
        ON products(promo_enabled) WHERE promo_enabled = 1;
    `)
  }
}
```

`schema.ts` is updated in parallel so fresh installs get the columns from the initial `CREATE TABLE` (the migration is a no-op on a fresh database since the columns already exist).

**Rollback**: the `pre-migrate-v8-*.db` backup created automatically by `preMigrateBackup()` in `index.ts:231-260` is sufficient for rollback. No data is dropped or transformed.

**Index rationale**: the partial index on `promo_enabled = 1` keeps the "Solo en promo" filter (R7) fast even at tens of thousands of products, while costing almost nothing in storage and writes (most products have `promo_enabled = 0` and so don't enter the index).
