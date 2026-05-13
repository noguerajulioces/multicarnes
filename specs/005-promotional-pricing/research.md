# Phase 0 — Research & Decisions: Promotional Pricing

Resolves the open design choices that were not pinned by the spec, so Phase 1 can produce a concrete data model and IPC contracts. No `NEEDS CLARIFICATION` markers remain after this phase.

---

## R1 — Store promo on `products` row vs separate `promotions` table

**Decision**: store promo as five additive columns on `products` (`promo_enabled INTEGER`, `promo_type TEXT`, `promo_value INTEGER`, `promo_from TEXT`, `promo_to TEXT`).

**Rationale**:
- The spec restricts v1 to **one** active promo per product (Assumptions). A separate table only pays off when overlap or history is required; we have neither in scope.
- Keeping promo on the row lets the existing `products:getAll` / `products:getByBarcode` IPC channels carry the promo state without any new join, query, or channel. The renderer's existing product cache already covers POS lookups.
- The existing audit log (`action_logs`) records before/after on the product row, so we get change history "for free" without a dedicated `promotions_history` table.
- Migration is a trivial additive ALTER guarded by `PRAGMA table_info(products)`, consistent with v6 (`add_held_tickets_user_id`).

**Alternatives considered**:
- **`promotions` table with 1-to-1 FK to product** — pays the cost of joins and a second mutation surface, no benefit at v1. Would be the right call if/when overlapping promos, customer-scoped promos, or campaign objects enter scope (explicitly out of scope per Assumptions).
- **Separate `promotion_campaigns` (1-to-many products)** — same conclusion as above; revisit only when category/campaign scoping is on the roadmap.

---

## R2 — Active-promo decision: where it runs and when

**Decision**: a pure function `isPromoActive(product, now)` in `src/renderer/src/lib/promo.ts` returns either `null` (no active promo) or `{ unitPrice, normalPrice, savings }`. Called by:
1. The cart store's `addItem` when a product is added — captures the result as the line snapshot.
2. The product-list filter when "Solo en promo" is selected — filters by the same pure check on the local row.
3. The receipt renderer reads the snapshotted fields from each line, no re-evaluation.

**Rationale**:
- Cart-line price stability (FR-008) requires evaluation at the single moment of "add to cart". Re-evaluating per render would risk a line silently re-pricing if the system clock crosses `promo_to` mid-sale.
- A pure function is trivially testable and has zero infrastructure cost — no IPC round-trip per cart-add, no main-side daemon, no schedulers.
- The same function is the natural place to encode the date-comparison rules (R4) and the rounding rule (R5), keeping all promo semantics in one file.

**Alternatives considered**:
- **Main-side resolver** (`promo:resolve(productId)` IPC) — adds an IPC hop on every cart-add and a new channel, with no functional benefit since the renderer already holds the product row.
- **Re-evaluate on every cart render** — violates FR-008 and creates a UX where a cashier sees the price flicker if the clock crosses the promo boundary while ringing up a customer.

---

## R3 — Cart line snapshot vs live recompute

**Decision**: extend `CartItem` with optional `normal_price` and `savings_per_unit` fields, both `number | undefined`. They are populated by `addItem` only when the active-promo decision returned a result. `subtotal` continues to derive from `quantity × unit_price` (where `unit_price = product.price` for non-promo lines or `unit_price = promo unit price` for promo lines).

**Rationale**:
- Snapshotting is the only way to satisfy FR-008 without a wall-clock dependency in the render path.
- The two extra optional fields cost 16 bytes per cart line and are `undefined` for the non-promo majority, so the data structure is byte-for-byte identical to today's behaviour when promos are not in play. This makes the change reviewable as "additive only".
- The fields naturally feed the badge/strike-through/"Ahorrás" UI without any conditional plumbing in the cart store itself — UI components can render-on-defined.

**Alternatives considered**:
- **Hold full `EffectivePrice` object on each line** — same outcome with one extra field; the two-scalar shape is simpler and avoids `null` checks across renderer code.
- **Recompute on render with frozen `now`** — adds a "frozen clock per cart" hidden state. Strictly more code than the snapshot, with no advantage.

---

## R4 — Date-range semantics: timezone and inclusivity

**Decision**:
- `promo_from` and `promo_to` are stored as `TEXT` in `YYYY-MM-DD` form (date only, no time).
- The active-promo decision treats `promo_from` as the **start of day** (00:00 local) and `promo_to` as the **end of day** (23:59:59.999 local), so both bounds are inclusive at the calendar-day grain.
- "Local" is the store's local timezone — the same one the rest of the POS already uses (`datetime('now','localtime')` throughout `schema.ts`).
- Either bound may be `NULL`. `NULL` `promo_from` ≡ "no lower bound"; `NULL` `promo_to` ≡ "no upper bound".

**Rationale**:
- A POS terminal lives in one timezone (the shop's). Storing UTC and converting at the boundary would buy nothing and add a stamp of complexity reviewers would have to chase.
- Calendar-day grain matches the user's mental model — "promo del 15 al 17" inclusive of both days — and matches how `date-fns` formats dates in the existing UI.
- `YYYY-MM-DD` text columns compare correctly as strings in SQLite, which lets the optional "Solo en promo" filter use a single SQL predicate without a `julianday()` conversion.

**Alternatives considered**:
- **Store full ISO datetimes** — invites timezone confusion ("does 2026-05-17T23:59 mean local or UTC?") and requires a UI for hours/minutes the spec doesn't ask for.
- **Make `to` exclusive** — non-obvious to a non-developer admin; the spec already implies inclusive ("active up to and including" in spec Edge Cases).

---

## R5 — Rounding for percentage promos

**Decision**: `effectiveUnitPrice = Math.round(normalPrice * (1 - percent / 100))`. Half values round to the nearest even integer (banker's rounding via `Math.round`) — actually `Math.round` in JavaScript rounds half **up** for positive numbers, which is what we want and is the rule the spec already commits to ("round to the nearest whole guaraní", Assumptions).

**Rationale**:
- The store currency (Guaraní) has no decimals. Rounding has to happen somewhere; rounding once at price computation is the cleanest place.
- `Math.round` on a positive integer × float is deterministic in V8 and produces the same result every time for the same inputs, so two identical promo configurations yield identical receipts.
- This rule lives inside `computeEffectivePrice(product, now)` in `promo.ts`. If the merchant ever wants a different rule (e.g., always round down), it's a single-function change.

**Alternatives considered**:
- **Floor** — favours the customer; cleaner story for "promo at least X% off". Rejected because rounding pennies in either direction is below the user's perception threshold for guaraní amounts and the half-up rule is what most spreadsheet users expect.
- **Configurable rule in `app_settings`** — over-engineered for v1.

---

## R6 — Validation rules at save time

**Decision**: enforce in `src/main/db/queries/products.ts` inside the `create` / `update` functions, before the SQL runs. Renderer-side validation in `ProductoFormPage.tsx` mirrors the same rules for immediate feedback, but main is the source of truth (defence in depth, consistent with how barcode uniqueness is enforced today).

Rules:
- `promo_enabled` may only be `1` if `promo_type` is `'fixed'` or `'percent'` and `promo_value` is set.
- `'fixed'`: `promo_value` MUST be an integer strictly greater than `0` and strictly less than the product's current `price`.
- `'percent'`: `promo_value` MUST be an integer in `[1, 99]`.
- `promo_from` / `promo_to`: each, when present, MUST match `^\d{4}-\d{2}-\d{2}$`. When both are present, `promo_from <= promo_to` (lexicographic compare works given the format).
- On validation failure, throw a typed error; the existing IPC error-surfacing path translates that into a renderer-side toast.

**Rationale**: matches the spec's FR-003 and FR-004 verbatim, and keeps the validation co-located with the SQL it protects.

**Alternatives considered**: schema-level CHECK constraints — would surface as opaque SQLite errors and force `try/catch` parsing on the renderer. Application-level validation is consistent with how the codebase already handles barcode and stock validation.

---

## R7 — Filter "Solo en promo" on the product listing

**Decision**: extend the existing `productListFilter` shape used by `products:getAll` with an optional `inPromoOnly?: boolean`. When `true`, the SQL `WHERE` clause adds the same predicate the renderer pure function would use, translated to SQL:

```sql
WHERE promo_enabled = 1
  AND (promo_from IS NULL OR promo_from <= date('now','localtime'))
  AND (promo_to   IS NULL OR promo_to   >= date('now','localtime'))
```

`date('now','localtime')` returns `YYYY-MM-DD` in SQLite — matches the storage format from R4 exactly, so the comparison is direct text and uses the natural ordering.

**Rationale**:
- Reuses the existing list-paging infrastructure ([src/main/db/queries/products.ts:3-35](../../src/main/db/queries/products.ts#L3-L35)) instead of introducing a new "promotions list" IPC channel.
- The filter chip on `ProductosPage.tsx` follows the existing pattern (category / status / low-stock chips).
- Cashier role does not need this filter; matrix entry for `products:getAll` is unchanged.

**Alternatives considered**:
- **Renderer-side filter on a full product fetch** — fine at hundreds of products but degrades when the catalogue grows; pushing the predicate to SQL keeps the page snappy on thousands of rows.
- **Dedicated `products:listInPromo` channel** — adds matrix surface for no read-side benefit.

---

## R8 — Receipt totals: when to show "Ahorrás X Gs"

**Decision**: the receipt renderer (`ticket.ts` and `ticket-pdf.ts`) iterates the line items, sums per-line `savings = (normal_price - unit_price) × quantity` for lines where `normal_price` is set, and prints the line `Ahorrás Gs. <total>` **only when the sum is > 0**. Position: above the existing "TOTAL Gs." line so it reads as a context cue, not a payment line.

**Rationale**:
- Avoids a dedicated boolean on the receipt payload — the data needed (per-line normal price) is already on the line item per R3.
- Skipping the line when no savings exist keeps non-promo receipts byte-identical to today's output (Principle VII).
- Position above TOTAL matches the existing visual hierarchy where "Subtotal" / "Descuento" / "TOTAL" descend in importance.

**Alternatives considered**:
- **Per-line "antes Gs. X" annotation on the printed ticket** — adds visual noise on a 32-char/48-char thermal width and is harder to scan; the spec calls out a single totals-level line, not a per-line one, for the receipt.

---

## R9 — Audit log payload for promo-config changes

**Decision**: reuse the existing `action_logs(user_id, action, details, created_at)` table. New `action` values:
- `'promo_enable'` — `details` is JSON `{ "product_id": N, "type": "fixed|percent", "value": V, "from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null }`.
- `'promo_update'` — `details` is JSON `{ "product_id": N, "before": {...}, "after": {...} }`.
- `'promo_disable'` — `details` is JSON `{ "product_id": N, "previous": {...} }`.

The audit row is written inside the same DB transaction as the product update, in `src/main/db/queries/products.ts`.

**Rationale**:
- Mirrors the pattern used for `cancel_sale` ([src/main/db/queries/sales.ts:165-169](../../src/main/db/queries/sales.ts#L165-L169)).
- JSON `details` is the established shape — keeps the audit queryable by `action` without a new column, and a future "promo audit" page can `json_extract(details, '$.product_id')` to filter.
- Transactional write guarantees the audit and the product change are atomic.

**Alternatives considered**: a dedicated `promo_audit` table — overkill for the volume; the existing `action_logs` reporting surface ([src/main/db/queries/reports.ts](../../src/main/db/queries/reports.ts)) already handles this shape.

---

## R10 — Propagation to a running cashier session

**Decision**: no new push mechanism. The cashier's POS already calls `products:getByBarcode` on every scan and `products:getAll` on each product-search input change ([src/renderer/src/modules/ventas/VentasPage.tsx:125-152](../../src/renderer/src/modules/ventas/VentasPage.tsx#L125-L152)). Those calls round-trip through main and return the current promo state every time. Lines already in the cart are unaffected (R3 snapshot).

**Rationale**:
- The existing per-action refetch pattern means a promo saved by an admin will appear on the next product lookup or scan — typically within 1–2 seconds of activity, comfortably inside the 2 s SC-001 budget.
- Adding an explicit "promo changed" broadcast channel would be a new bidirectional IPC surface (a new main-to-renderer pattern this codebase doesn't currently use for product data) — disproportionate to the benefit.

**Alternatives considered**: broadcast invalidation via a new `products:invalidated` event — defer until there is evidence the per-action refetch is too slow in practice.

---

## R11 — Dev dependencies for migration / promo

**Decision**: none. All work uses the existing stack — `better-sqlite3` for the migration, `date-fns` (already in the bundle per constitution v1.1.0) for any non-trivial date formatting in `ProductoFormPage.tsx`, native `<input type="date">` for the from/to controls.

**Rationale**: Principle I forbids new runtime deps without written justification. The existing toolkit covers the needs.

---

## Summary table

| ID | Decision | Affected file(s) |
|----|----------|------------------|
| R1 | Promo lives on the `products` row | `schema.ts`, `index.ts` (migration v8) |
| R2 | Pure `isPromoActive(product, now)` renderer-side | `lib/promo.ts` (new) |
| R3 | Cart line snapshots `normal_price` + `savings_per_unit` | `cart.store.ts`, `types.ts` |
| R4 | Calendar-day inclusive in local TZ, `YYYY-MM-DD` text | `lib/promo.ts`, `queries/products.ts` |
| R5 | `Math.round(normalPrice * (1 - percent/100))` half-up | `lib/promo.ts` |
| R6 | Validation in main + mirrored in form | `queries/products.ts`, `ProductoFormPage.tsx` |
| R7 | `inPromoOnly` optional filter on existing `products:getAll` | `queries/products.ts`, `products.ipc.ts`, `ProductosPage.tsx` |
| R8 | Receipt prints totals-level "Ahorrás" only when > 0 | `lib/ticket.ts`, `lib/ticket-pdf.ts` |
| R9 | Audit via existing `action_logs` with JSON `details` | `queries/products.ts` |
| R10 | Rely on existing per-action product refetch | (no new code) |
| R11 | Zero new dependencies | `package.json` (no edit) |
