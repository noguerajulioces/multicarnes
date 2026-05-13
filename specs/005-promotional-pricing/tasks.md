---

description: "Dependency-ordered tasks for 005-promotional-pricing"
---

# Tasks: Promotional Pricing

**Input**: Design documents from `/specs/005-promotional-pricing/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: This project has no automated test suite for renderer / IPC paths (matches features 001–004). [quickstart.md](quickstart.md) is the manual QA plan; running it lives in the Polish phase. No automated-test tasks are generated.

**Organization**: Tasks are grouped by user story so each can be delivered as an independently testable increment. Within each phase, [P] marks tasks that touch different files and have no in-phase dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks in the same phase)
- **[Story]**: Which user story this task belongs to (US1 = P1, US2 = P2, US3 = P3 from [spec.md](spec.md))
- Each task description includes the exact file path

## Path Conventions

Single project, existing layout (per [plan.md](plan.md)): `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`. Specs under `specs/005-promotional-pricing/`.

---

## Phase 1: Setup

**Purpose**: Branch and dev-environment readiness.

- [X] T001 Create and check out the `005-promotional-pricing` branch off `main` (`git checkout -b 005-promotional-pricing`)
- [X] T002 [P] Verify the dev environment boots: `npm install`, then `npm run typecheck` (both `typecheck:node` and `typecheck:web`) and `npm run dev` reaches the login screen with zero errors *(baseline typecheck verified; `npm run dev` deferred to manual sanity check)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared types, and the pure promo-decision function on which every user story depends.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Migration v8 must be applied on dev DBs before any UI work has rows to read or write.

- [X] T003 Extend `Product` (5 optional promo fields), extend `CartItem` (optional `unit_price`, `normal_price`, `savings_per_unit`), and add the `EffectivePrice` interface in [src/shared/types.ts](../../src/shared/types.ts) per [data-model.md §2.1, §2.2, §2.3](data-model.md)
- [X] T004 [P] Add the five promo columns to the fresh-install `CREATE TABLE products` block (defaults and nullability per data-model §1.1) in [src/main/db/schema.ts](../../src/main/db/schema.ts)
- [X] T005 [P] Append migration **v8** (`add_products_promo_columns`) to the `MIGRATIONS` array — with `PRAGMA table_info(products)` idempotency guards and the partial index `idx_products_promo_enabled ON products(promo_enabled) WHERE promo_enabled = 1` — in [src/main/db/index.ts](../../src/main/db/index.ts)
- [X] T006 ~Update the row → `Product` mapper~ **No-op**: `products.ts` queries use `SELECT p.*` (no explicit row mapper exists). The columns added in T004/T005 propagate to `getAll` / `getById` / `getByBarcode` automatically. `promo_enabled` comes back as INTEGER on the wire; the TS type declares `boolean` to match the existing `active` convention. Renderer code should treat it as truthy/falsy, not `=== true`.
- [X] T007 [P] Create [src/renderer/src/lib/promo.ts](../../src/renderer/src/lib/promo.ts) exporting `isPromoActive(product, now)` and its `computeEffectivePrice` alias, implementing the 7-step semantics (toggle → date bounds → fixed/percent math → rounding → self-disable when promo ≥ normal) from data-model §2.2 and research R2/R4/R5
- [X] T008 ~Create `PromoBadge` component~ **Obsolete**: the existing generic [src/renderer/src/components/ui/Badge.tsx](../../src/renderer/src/components/ui/Badge.tsx) already covers the use case. T014 will render `<Badge tone="success">PROMO</Badge>` directly — avoids premature abstraction (Constitution Principle VII).

**Checkpoint**: Foundation ready. The schema accepts and returns promo fields end-to-end (IPC payloads carry them via the existing channels), `isPromoActive` is callable from the renderer, and the badge component is importable. User-story phases can now begin.

---

## Phase 3: User Story 1 — Admin sets a promo and POS sells at that price (Priority: P1) 🎯 MVP

**Goal**: Admin/Supervisor turns on a promo on a product (fixed amount or percentage), and a cashier sees the promo price, the PROMO badge, the struck-through normal price, and the "Ahorrás" indicator on the cart line. The receipt sums savings across promo lines.

**Independent Test**: [quickstart.md Tests 1–3, 8](quickstart.md). Skips date-range and "Solo en promo" filter — those land in US2 / US3.

### Implementation for User Story 1

- [X] T009 [US1] Add promo validation in `create` and `update` in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts), throwing the typed errors documented in [contracts/products-promo-fields.md](contracts/products-promo-fields.md): `PROMO_INCOMPLETE`, `PROMO_FIXED_NOT_LESS_THAN_PRICE`, `PROMO_FIXED_NOT_POSITIVE`, `PROMO_PERCENT_OUT_OF_RANGE` *(also included `PROMO_DATE_FORMAT`/`PROMO_DATE_RANGE` since the validator is one function; US2 will just start sending dates)*
- [X] T010 [US1] Persist `promo_enabled`, `promo_type`, `promo_value` in the `INSERT` / `UPDATE` statements in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts), inside the existing transaction *(also persists `promo_from`/`promo_to` — same column writes whether or not the form supplies them)*
- [X] T011 [US1] Write `action_logs` rows (`promo_enable` / `promo_update` / `promo_disable`) with the JSON `details` shapes from [data-model.md §1.2](data-model.md), inside the same `db.transaction()` as the product mutation in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts) — idempotent (no audit row when no promo field changed). IPC handler now forwards `ctx.userId` for attribution ([src/main/ipc/products.ipc.ts](../../src/main/ipc/products.ipc.ts)).
- [X] T012 [P] [US1] Add a "Promoción" section (toggle, `Monto fijo` / `Porcentaje` radio, value input) to [src/renderer/src/modules/productos/ProductoFormPage.tsx](../../src/renderer/src/modules/productos/ProductoFormPage.tsx). Backend `PROMO_*` errors are translated to Spanish via `PROMO_ERROR_MSG`. Date inputs land in T017 (US2).
- [X] T013 [P] [US1] Update `addItem` in [src/renderer/src/store/cart.store.ts](../../src/renderer/src/store/cart.store.ts) to call `computeEffectivePrice(product, new Date())` and snapshot `unit_price`, `normal_price`, `savings_per_unit` on the `CartItem`. Update `updateQuantity` to derive `subtotal` from the snapshotted `unit_price` (falling back to `product.price`)
- [X] T014 [US1] Render the PROMO badge (via existing `<Badge tone="success">`), the struck-through normal price, and the "Ahorrás Gs. N" line on each promo cart line in [src/renderer/src/modules/ventas/VentasPage.tsx](../../src/renderer/src/modules/ventas/VentasPage.tsx)
- [X] T015 [P] [US1] Add the totals-level "Ahorrás Gs." line **above** the TOTAL line in [src/renderer/src/lib/ticket.ts](../../src/renderer/src/lib/ticket.ts), printed only when summed savings > 0. Also extended `getSaleById` in [src/main/db/queries/sales.ts](../../src/main/db/queries/sales.ts) to include `p.price as normal_price` on the items join, and added `normal_price?: number` to `SaleItem` in [src/shared/types.ts](../../src/shared/types.ts) — the receipt now has the data it needs without a new IPC.
- [X] T016 [P] [US1] ~Mirror on PDF~ **No-op**: [src/renderer/src/lib/ticket-pdf.ts](../../src/renderer/src/lib/ticket-pdf.ts) iterates `RenderedTicket.lines` from `renderTicket`, so the new line from T015 flows automatically. The line is plain (not emphasized), so the PDF renderer's special path isn't triggered.

**Checkpoint**: User Story 1 fully functional. Admin can save a promo with a fixed amount or a percentage, cashier sees it applied in the POS, and printed/PDF tickets carry the savings totals. This is the MVP slice — deployable on its own.

---

## Phase 4: User Story 2 — Scheduled promo with date range (Priority: P2)

**Goal**: Admin/Supervisor sets `Desde` and/or `Hasta` on a promo; the POS activates and deactivates the promo automatically when the local date crosses those bounds. Validation rejects inverted ranges. The `isPromoActive` function already honors date bounds (built in T007 / foundational), so this phase is about wiring the form, persistence, and validation around it.

**Independent Test**: [quickstart.md Tests 4 and 5](quickstart.md).

### Implementation for User Story 2

- [ ] T017 [US2] Extend the "Promoción" section in [src/renderer/src/modules/productos/ProductoFormPage.tsx](../../src/renderer/src/modules/productos/ProductoFormPage.tsx) with two `<input type="date">` controls for `Desde` and `Hasta` (both optional) and renderer-side format / range validation mirroring T018
- [ ] T018 [US2] Add `PROMO_DATE_FORMAT` and `PROMO_DATE_RANGE` validation cases in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts), per [contracts/products-promo-fields.md](contracts/products-promo-fields.md)
- [ ] T019 [US2] Persist `promo_from` / `promo_to` in the `INSERT` / `UPDATE` SQL and include them in the JSON `details` of the `promo_enable` / `promo_update` / `promo_disable` audit rows in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts)

**Checkpoint**: User Story 2 fully functional. A scheduled promo with `Desde = T+1, Hasta = T+3` activates and deactivates automatically when the local date crosses the bounds, with no admin action required at the boundary.

---

## Phase 5: User Story 3 — Supervisor edits/disables, cart line stability, and "Solo en promo" discovery (Priority: P3)

**Goal**: Supervisor can edit/disable a live promo and the POS picks it up on the next product lookup or scan. Lines already in a cart keep the snapshotted price (emergent from T013). Cashier role cannot reach the promo controls (emergent from the existing matrix). The admin product listing gains a "Solo en promo" filter chip.

**Independent Test**: [quickstart.md Tests 6, 7, 9, 12](quickstart.md).

Most of the spec behaviour for US3 emerges from work already done in foundational + US1 (snapshot stability, matrix-enforced role gating, per-action refetch propagation — see research R10). The discrete code work for US3 is the discovery filter.

### Implementation for User Story 3

- [ ] T020 [US3] Extend the list-filter shape with optional `inPromoOnly?: boolean` and add the SQL `WHERE` predicate from [contracts/products-in-promo-filter.md](contracts/products-in-promo-filter.md) — `promo_enabled = 1 AND (promo_from IS NULL OR promo_from <= date('now','localtime')) AND (promo_to IS NULL OR promo_to >= date('now','localtime'))` — in [src/main/db/queries/products.ts](../../src/main/db/queries/products.ts)
- [ ] T021 [P] [US3] Forward `inPromoOnly` through the `products:getAll` handler in [src/main/ipc/products.ipc.ts](../../src/main/ipc/products.ipc.ts) and update the preload bridge typing in [src/preload/index.ts](../../src/preload/index.ts) (TS-only pass-through)
- [ ] T022 [US3] Add a "Solo en promo" filter chip alongside the existing category / status / low-stock chips in [src/renderer/src/modules/productos/ProductosPage.tsx](../../src/renderer/src/modules/productos/ProductosPage.tsx); toggling it sets `inPromoOnly: true` on the next list fetch and resets the page index (existing filter-change pattern)

**Checkpoint**: All three user stories functional independently. Admin discovery, scheduling, and edit/disable flows all behave per spec.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end, exercise the migration twice, and keep the project's documentation index honest.

- [ ] T023 [P] Run `npm run typecheck` (both `typecheck:node` and `typecheck:web`) and `npm run lint` — fix any new errors or net-new warnings introduced by the feature
- [ ] T024 Run the full manual QA pass from [quickstart.md](quickstart.md) (Tests 1–12) against a fresh `npm run dev` build; check off each test result in the file or in a PR comment
- [ ] T025 Verify migration v8 idempotency: shut down the app and relaunch it twice in a row. `schema_migrations` should show exactly one v8 row and only one `pre-migrate-v8-*.db` backup file
- [ ] T026 [P] Update [.specify/memory/functional-spec.md](../../.specify/memory/functional-spec.md) — add a "Promotional Pricing" subsection under §9 (Inventory & Products) with `file:line` citations to the new code (the lib/promo.ts function, the cart store snapshot, the cart-line render in VentasPage, the receipt totals in ticket.ts / ticket-pdf.ts, and the action_logs additions)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. Independent of US2, US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Form edit at T017 layers on top of US1's `ProductoFormPage` edits at T012 — sequential within the file; T018 and T019 are products.ts edits sequential after US1's T009–T011.
- **User Story 3 (Phase 5)**: Depends on Foundational. T020 / T021 / T022 do not touch any file owned by US1 or US2 — fully independent.
- **Polish (Phase 6)**: Depends on whichever user stories you want shipped.

### Within Each User Story

- US1 in-phase order: T009 → T010 → T011 (all in `products.ts`, sequential), then T012 / T013 / T014 / T015 / T016 in parallel (different files), except T014 reads the snapshot fields populated by T013 — keep T014 sequential after T013 to avoid intermediate-state churn.
- US2 in-phase order: T017 in the form is independent of T018 / T019 (different files); T018 → T019 sequential within `products.ts`.
- US3 in-phase order: T020 → T021 sequential by data flow (handler reads the filter type added in T020); T022 depends on both.

### Parallel Opportunities

- **Setup phase**: T002 alone is `[P]`-eligible; it has no dependency on T001 if the branch already exists locally.
- **Foundational phase**: T004 / T005 / T007 / T008 in parallel after T003. T006 is sequential because it consumes the `Product` type added in T003.
- **US1**: T012 + T013 + T015 + T016 in parallel after the products.ts tasks (T009–T011) complete. T014 follows T013.
- **US2**: T017 in parallel with T018 (different files), then T019 after T018.
- **US3**: T021 in parallel with T020 *only* if the developer reads the contract first; otherwise sequential is safer.
- **Polish**: T023 + T026 in parallel.

---

## Parallel Example: Foundational

```bash
# After T003 lands the type extensions in src/shared/types.ts, the following can be picked up in parallel by separate sessions or developers:
Task: "Fresh-install promo columns in src/main/db/schema.ts"           # T004
Task: "Migration v8 in src/main/db/index.ts"                            # T005
Task: "Pure promo decision in src/renderer/src/lib/promo.ts"            # T007
Task: "PromoBadge component in src/renderer/src/components/PromoBadge.tsx" # T008
```

T006 (mapper) is the merge point — it consumes the type from T003 and is consumed by the IPC reads in US1.

## Parallel Example: User Story 1

```bash
# Once T009–T011 land in src/main/db/queries/products.ts, four UI/lib edits can proceed in parallel:
Task: "Promo section UI in src/renderer/src/modules/productos/ProductoFormPage.tsx"  # T012
Task: "Snapshot in src/renderer/src/store/cart.store.ts"                              # T013
Task: "Ahorrás totals line in src/renderer/src/lib/ticket.ts"                         # T015
Task: "Ahorrás totals line on PDF in src/renderer/src/lib/ticket-pdf.ts"              # T016

# Then T014 (VentasPage cart-line render) follows T013 once the snapshot fields exist.
```

---

## Implementation Strategy

### MVP First — User Story 1 only

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. **Stop and validate**: run quickstart Tests 1, 2, 3, 8 against the dev build.
4. If those pass, the MVP is deployable — admin can flag a product as in promo (fixed or %), POS sells at the promo price, and receipts show the savings.

### Incremental Delivery

1. Ship US1 → real merchants can use untimed promos manually.
2. Add US2 → schedulable campaigns activate themselves at midnight.
3. Add US3 → supervisor can discover all live promos in one click, and the cart snapshot rule is verified end-to-end against the edit/disable flow.

### Parallel Team Strategy

With more than one developer, after Phase 2 (Foundational) is merged:

- Developer A → US1 (T009–T016)
- Developer B → US3 (T020–T022) — touches a disjoint set of files from US1 (only `products.ts` is shared with US1's T009–T011; serialize the queries.ts edits if both are happening at once)
- US2 layers on US1's form edit, so it is best picked up by Developer A immediately after US1 lands.

---

## Notes

- This feature has no automated test layer; quickstart.md is the contract test plan. Tests live in Phase 6 (T024) as a manual sweep.
- [P] tasks are different files with no in-phase dependency. Multiple edits to `src/main/db/queries/products.ts` are NEVER `[P]` with each other.
- The matrix entries for `products:create` / `products:update` / `products:getAll` are already correct (admin+supervisor on writes; all three roles on reads). No `matrix.ts` task is needed (re-verified in plan Constitution Check).
- The audit-log writes in T011 / T019 are part of the same transaction as the product mutation — never write the audit row outside the transaction.
- Commit after each task or at most each `[P]`-group; small commits make the eventual review of this feature easier.
- Stop at any checkpoint to validate the relevant quickstart tests before proceeding to the next story.
