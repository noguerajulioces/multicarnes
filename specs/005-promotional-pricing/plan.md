# Implementation Plan: Promotional Pricing

**Branch**: `005-promotional-pricing` | **Date**: 2026-05-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [/specs/005-promotional-pricing/spec.md](spec.md)

## Summary

Per-product promotional pricing managed by Admin/Supervisor and consumed automatically by the POS. The feature adds five additive columns to the `products` table (toggle, type, value, optional date range), a small derived "effective price" decision computed renderer-side at "add to cart" time, and presentational badge / struck-through price / "Ahorrás" indicators in the cart line and the printed receipt. No new IPC channels are introduced for the read path — the renderer already receives the full product row via `products:getAll` / `products:getByBarcode` and computes the effective price locally. The existing mutating IPC handlers (`products:create`, `products:update`) accept the new fields; their matrix entries already restrict to `admin` and `supervisor`. Promo-config changes are recorded via the existing `action_logs` audit channel. One additive migration (v8) brings the new columns on upgraded installs; fresh installs pick them up through the seed schema.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 20 (Electron 39 main), React 19 (renderer)
**Primary Dependencies**: Electron 39, React 19, Zustand, React Router DOM, better-sqlite3, Tailwind v4, `date-fns` for date-range comparisons (all already in stack — no additions)
**Storage**: SQLite — additive migration v8 on `products` adding `promo_enabled`, `promo_type`, `promo_value`, `promo_from`, `promo_to`. No new tables. Existing `action_logs` reused for audit. See [src/main/db/schema.ts:19-32](../../src/main/db/schema.ts#L19-L32) for the current `products` shape.
**Testing**: manual quickstart only (project has no automated test suite for renderer/IPC paths, matches features 001–004 convention).
**Target Platform**: Electron desktop (macOS + Windows POS terminals).
**Project Type**: desktop-app (main + preload + renderer processes, existing layout).
**Performance Goals**: effective-price computation per cart-add is O(1) on data already in memory (< 1 ms); promo-config changes propagate to a running cashier session within one product-list refetch cycle (SC-001 target < 2 s end-to-end).
**Constraints**: must not change existing line-item pricing pipeline for non-promo products (FR-009); cart line MUST snapshot the unit price at add-to-cart so mid-sale promo changes don't repaint the line (FR-008); receipts MUST render "Ahorrás" totals only when at least one line was sold under promo (FR-010); Cashier role MUST NOT be able to invoke promo writes — enforced both UI-side and matrix-side (FR-001).
**Scale/Scope**: 1 migration, 5 new product columns, 4 edited query functions (`products.create/update/getAll/getById`), 1 small lib (`promo.ts` for the active-promo decision), edits to ~6 renderer files (product form, products page filter, cart store, cart line UI, receipt renderer renderer-side ticket + ticket-pdf). Estimated ~400 LOC net.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Locked Tech Stack | ✅ Pass | Zero new runtime or dev dependencies. Uses Tailwind, Zustand, better-sqlite3, `date-fns` already in `package.json`. |
| II. Strict Typing & SRP | ✅ Pass | The active-promo decision is a single pure function (`isPromoActive(product, now)` → `null` or `EffectivePrice`). The product-form promo controls are a self-contained subcomponent. The cart-line badge is a presentational component. No `any`; no new global store. |
| III. Layered Data Access | ✅ Pass | New columns are owned by [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts). Result shaping into typed `Product` is done in the same module. Renderer never touches better-sqlite3 directly. |
| IV. Main/Renderer Boundary | ✅ Pass | No new IPC channels. The existing `products:*` channels carry the new columns through. Their matrix entries already enforce `admin`/`supervisor` on mutations and allow all three roles on reads. `nodeIntegration` stays off; `contextIsolation` stays on. |
| V. Isolated Hardware & Reports | ✅ Pass (V.b) | Receipt rendering extensions live in [src/renderer/src/lib/ticket.ts](../../src/renderer/src/lib/ticket.ts) and [src/renderer/src/lib/ticket-pdf.ts](../../src/renderer/src/lib/ticket-pdf.ts). Inputs (line items + totals) remain plain data sourced from the local SQLite DB — no untrusted input crosses the formatter boundary, so V.b is satisfied. The thermal-print main-side service is unchanged. |
| VI. Schema Evolution | ✅ Pass | Additive migration v8 adds five `NULL`-able / defaulted columns to `products`. No existing query is invalidated: every existing query continues to return rows; only callers that opt-in to the new fields will read them. Migration is idempotent (checks `PRAGMA table_info(products)` before ALTERing). The pre-migrate backup hook in [src/main/db/index.ts](../../src/main/db/index.ts) runs automatically. No backfill required — `promo_enabled` defaults to `0`, all other columns default to `NULL`, which equals "no promo" semantics. |
| VII. Simplicity & Non-Regression | ✅ Pass | Smallest viable design: no new tables, no new IPC channels, no new modal — the existing product form gains a "Promoción" section. The cart store snapshots one extra optional field per line (the normal-price reference). Existing non-promo cart behaviour is byte-for-byte unchanged when `promo_enabled = 0`. |

**Result**: no violations. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-promotional-pricing/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Feature spec
├── research.md          # Phase 0 — decisions + rationale
├── data-model.md        # Phase 1 — entities, fields, validation, derived state
├── quickstart.md        # Phase 1 — manual QA steps tied to acceptance scenarios
├── contracts/
│   ├── products-promo-fields.md   # Extended shape on the existing products:* IPC
│   └── products-in-promo-filter.md # Optional inPromoOnly filter on products:getAll
└── tasks.md             # /speckit-tasks output (not created here)
```

### Source Code (repository root)

This feature is additive and touches files in three of the existing process trees. No new top-level directories.

```text
src/
├── main/
│   ├── db/
│   │   ├── index.ts                            # ADD: migration v8 (promo columns on products)
│   │   ├── schema.ts                           # EDIT: fresh-install CREATE TABLE products gains 5 columns
│   │   └── queries/
│   │       └── products.ts                     # EDIT: create/update accept promo fields; getAll supports inPromoOnly filter; row → Product mapper carries new fields
│   ├── ipc/
│   │   └── products.ipc.ts                     # EDIT: pass-through of new fields on create/update; new optional inPromoOnly arg on getAll
│   └── auth/
│       └── matrix.ts                           # UNCHANGED (existing products:create / products:update / products:getAll entries already correct)
│
├── preload/
│   └── index.ts                                # EDIT: bridge signatures pick up the extended payload types (TypeScript-only change)
│
├── shared/
│   └── types.ts                                # EDIT: extend Product with promo fields + add EffectivePrice helper type; extend CartItem with optional normal_price snapshot
│
└── renderer/
    └── src/
        ├── lib/
        │   ├── promo.ts                        # NEW: isPromoActive(product, now), computeEffectivePrice(product, now) — pure functions, unit-testable
        │   ├── ticket.ts                       # EDIT: render line as promoUnitPrice with normalPrice strike-through; add totals "Ahorrás" line when any line had a promo
        │   └── ticket-pdf.ts                   # EDIT: mirror ticket.ts changes for the PDF surface
        ├── store/
        │   └── cart.store.ts                   # EDIT: addItem captures EffectivePrice snapshot (unit_price + normal_price + savings); subtotal already drives off unit_price
        ├── modules/
        │   ├── productos/
        │   │   ├── ProductoFormPage.tsx        # EDIT: add "Promoción" section (toggle, fixed/% radio, value input, optional date range, inline validation)
        │   │   └── ProductosPage.tsx           # EDIT: add "Solo en promo" filter chip alongside existing category/status/low-stock filters
        │   └── ventas/
        │       └── VentasPage.tsx              # EDIT: cart line renders PROMO badge, struck-through normal price, "Ahorrás X Gs" line when item.normal_price > item.unit_price
        └── components/
            └── PromoBadge.tsx                  # NEW: tiny presentational badge component reused in cart line and (optionally) product cards
```

**Structure Decision**: keep existing layout. The feature slots into the established `main/db`, `main/ipc`, `preload`, `shared`, and `renderer/src/{lib,store,modules,components}` locations. No reorganisation. The new `promo.ts` lives in `renderer/src/lib/` because it is consumed by the renderer at cart-add and receipt-render time; the same function is not needed in main today (the SQL filter is straightforward inline). If a future feature wants main-side scheduling — e.g., a nightly job that pre-resolves which products are "currently in promo" — the function can be lifted to `src/shared/` then; YAGNI for now.

## Complexity Tracking

No constitution violations to justify. Section intentionally empty.
