# Feature Specification: Promotional Pricing

**Feature Branch**: `005-promotional-pricing`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "A veces la empresa tiene precios de promoción, sea para liquidar stock o durante x tiempo. La idea es poder manejar esos precios de venta donde se setea que tendrá precio de promoción y eso es lo que se ve en el POS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin sets a promo price on a product and the POS sells it at that price (Priority: P1)

An admin opens a product, turns on "En promoción", chooses whether the promo is a fixed amount (in guaraníes) or a percentage off the normal price, and saves. From that moment, when any cashier adds that product to the cart in the POS, the line uses the promo price automatically. The cart line shows a "PROMO" badge, the normal price struck through, and an "Ahorrás X Gs" indicator so the cashier and customer both see the saving.

**Why this priority**: This is the entire core value of the feature. Without P1, there is no promotional-pricing capability at all — the admin cannot influence the POS price, and the cashier cannot reflect a promotion to the customer.

**Independent Test**: Sign in as admin, pick a product with a known normal price, enable promo with a fixed amount (or percentage) lower than the normal price, save, and sign out. Sign in as cashier, add that product to a sale, and verify the line uses the promo price, shows the badge and struck-through normal price, and the "Ahorrás" amount matches `normal − promo`.

**Acceptance Scenarios**:

1. **Given** an admin viewing a product with a normal price, **When** they enable "En promoción", choose "Monto fijo", enter a value strictly between 1 and `normalPrice − 1`, and save, **Then** the product is persisted with the promo enabled and the chosen fixed price.
2. **Given** an admin viewing a product with a normal price, **When** they enable "En promoción", choose "Porcentaje de descuento", enter an integer percentage in the range 1–99, and save, **Then** the product is persisted with the promo enabled and the chosen percentage; the effective price the POS will use is `round(normalPrice × (1 − percent/100))` rounded to the nearest guaraní.
3. **Given** a product with an active promo, **When** a cashier adds it to the cart, **Then** the cart line uses the promo price, the unit price field shows the promo amount, and the line displays a "PROMO" badge, the normal price struck through, and "Ahorrás X Gs" where X is `normalPrice − promoPrice` for that line quantity.
4. **Given** a product without an active promo, **When** a cashier adds it to the cart, **Then** the line behaves exactly as today: normal price, no badge, no struck-through price, no savings line.
5. **Given** an admin attempts to save a promo with a fixed amount greater than or equal to the normal price, **When** they click save, **Then** the save is rejected with a clear validation message explaining the promo price must be lower than the normal price.

---

### User Story 2 - Admin schedules a promo with a date range and it activates/deactivates automatically (Priority: P2)

An admin enables a promo on a product and additionally enters a "Desde" date and/or a "Hasta" date. The promo only takes effect on or after "Desde" and stops taking effect after "Hasta", without anyone needing to touch the toggle on those days. When no dates are entered, the toggle alone controls whether the promo is active.

**Why this priority**: Schedulable promos let the business plan campaigns ahead of time (e.g., "fin de semana 15-17"), avoiding manual toggling at odd hours and the risk of forgetting to disable a promo. Lower than P1 because the toggle-only path already delivers the core feature; date-driven scheduling is a strict enhancement.

**Independent Test**: As admin, set a promo on a product with `Desde = tomorrow` and `Hasta = tomorrow + 2 days`. Today, verify the POS still shows the normal price. Advance the system clock (or wait until the next day in a staging environment) and verify the POS now shows the promo price. Advance past `Hasta` and verify the price returns to normal — all without re-editing the product.

**Acceptance Scenarios**:

1. **Given** a product with promo enabled, `Desde` set to a future date, and no `Hasta`, **When** a cashier adds the product to the cart today, **Then** the line uses the normal price (promo not yet active).
2. **Given** a product with promo enabled, `Desde` set to a past date, and `Hasta` set to a future date, **When** a cashier adds the product to the cart, **Then** the line uses the promo price.
3. **Given** a product with promo enabled and `Hasta` set to yesterday, **When** a cashier adds the product to the cart today, **Then** the line uses the normal price (promo expired) and no manual disable was required.
4. **Given** a product with promo enabled and no date range, **When** a cashier adds the product, **Then** the line uses the promo price (the toggle alone controls activation).
5. **Given** an admin enters `Desde` later than `Hasta`, **When** they save, **Then** the save is rejected with a validation message indicating the date range is invalid.

---

### User Story 3 - Supervisor disables or edits a promo and the POS reflects it on the next sale (Priority: P3)

A supervisor can edit an existing promo (change amount or percentage, change dates, or disable it altogether). After saving, the next product lookup or "add to cart" action in any POS session uses the updated state. A line already in an in-progress cart keeps the price it was added at, so the cashier is never surprised by a price changing mid-sale.

**Why this priority**: Lets shift supervisors react to live situations (mis-priced promo, sudden change of plan, end of liquidation) without waiting for an admin. P3 because the most common workflow is admin-driven setup; supervisor edits are a smaller share of activity.

**Independent Test**: As supervisor, disable a promo that is currently active. Without restarting the POS app, in another session as cashier, search for the product and add it to a new cart line — verify it uses the normal price. Then re-enable the promo and add a fresh line — verify the promo price applies again.

**Acceptance Scenarios**:

1. **Given** a supervisor viewing a product with an active promo, **When** they turn the promo toggle off and save, **Then** subsequent additions of that product to any cart use the normal price, and existing cart lines added before the change retain their original price until the cart is finalised or cleared.
2. **Given** a supervisor editing a promo's fixed amount or percentage, **When** they save a valid new value, **Then** the next cart line added for that product uses the new promo amount.
3. **Given** a cashier role, **When** the cashier attempts to access the promo-editing controls on a product, **Then** the controls are not available (read-only or hidden), and any attempt to change promo state via the underlying operation is rejected on the server side.

---

### Edge Cases

- **Promo configured but currently inactive** (toggle on, but today is outside the date range): the product is treated as not in promo. The POS shows the normal price with no badge, exactly as if the toggle were off.
- **Cart line price stability**: a line added with a promo price keeps that price even if the promo is disabled or expires while the cart is still open. The applied price is snapshotted at "add to cart" time. The receipt reflects what was actually charged.
- **Products sold by weight (carnicería)**: the promo applies to the unit price (per-kg), and the line total is `promoUnitPrice × weight`. The "Ahorrás" amount is computed on the line total, not just the unit price.
- **Rounding for percentage promos**: the computed effective price is rounded to the nearest whole guaraní. Rounding direction is documented so the same percent on the same normal price always yields the same effective price.
- **Normal price changes while a promo is active**: a fixed-amount promo keeps its fixed amount (the admin must edit it explicitly if needed); a percentage promo recomputes against the new normal price automatically on the next cart-add.
- **Receipt / printed ticket**: the receipt shows the unit price actually charged. A summary line "Ahorrás X Gs" appears on the receipt totals when at least one line in the sale used a promo price, so the customer sees the saving.
- **Sales reports / movements history**: existing reports already record line-level prices; nothing changes structurally. The promo is reflected as a lower unit price on those lines. No new report is in scope for v1.
- **Concurrent edits**: if two managers edit the same product's promo at the same time, last write wins. The audit log records both writes so the change is traceable.
- **Promo on a product that is currently out of stock**: the promo is still saved and shown in admin listings, but has no effect until the product has stock and is sold. Out-of-stock behaviour is unchanged.
- **Time-zone for date range**: "Desde" and "Hasta" are interpreted in the store's local time zone (the same one already used by the rest of the POS). A promo `Hasta = 2026-05-17` is active up to and including 23:59:59 local on that date.
- **Cashier-side discovery**: cashiers cannot search "only products in promo" in v1; the badge appears in the cart line when applicable. A products-in-promo filter is admin-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow Admin and Supervisor roles to enable, edit, and disable a promotional price on any individual product. Cashier role MUST NOT have access to these controls in the UI or to the corresponding privileged operations.
- **FR-002**: For each product, the promo configuration MUST capture: whether the promo is enabled, the promo type (`fixed` or `percent`), the promo value (a positive guaraní amount for `fixed`, or an integer percentage 1–99 for `percent`), and an optional date range (`from` and/or `to`).
- **FR-003**: The system MUST reject saving a `fixed` promo whose value is not strictly less than the product's normal price, or a `percent` promo whose value is outside the integer range 1–99.
- **FR-004**: The system MUST reject saving a date range where `to` is earlier than `from`. Either bound MAY be empty; an empty bound means "no lower/upper limit".
- **FR-005**: A product's promo MUST be considered active at a given moment if and only if the promo toggle is enabled AND (no date range is set, OR the current local date is on or after `from` (when set) AND on or before `to` (when set)). All other cases mean the promo is inactive.
- **FR-006**: When a cashier adds a product to the cart and the promo is active at that moment, the line MUST use the effective promo price: the `fixed` amount, or `round(normalPrice × (1 − percent/100))` to the nearest guaraní for a `percent` promo.
- **FR-007**: A cart line that used a promo price MUST visually present, in the POS cart UI, a "PROMO" badge, the normal price struck through next to the promo unit price, and a line "Ahorrás X Gs" where X is `(normalPrice − promoUnitPrice) × quantity` (or, for by-weight products, `(normalPrice − promoUnitPrice) × weight`).
- **FR-008**: A cart line MUST snapshot the unit price at the moment the product is added. Subsequent changes to the product's promo configuration MUST NOT alter the price of lines already in the cart. The line on the final sale, the receipt, and the movements history MUST reflect the snapshotted price.
- **FR-009**: A product without an active promo MUST be added to the cart at its normal price with no badge, no struck-through price, and no "Ahorrás" line — identical to the current behaviour.
- **FR-010**: The printed and on-screen receipt MUST display, on sales where at least one line used a promo price, a totals-level "Ahorrás X Gs" summarising the total customer saving across all promo lines in that sale.
- **FR-011**: The Admin/Supervisor product listing MUST offer a way to filter or otherwise easily see "products currently in promo" without scanning the full catalogue.
- **FR-012**: The system MUST record promo-configuration changes (enable, disable, value change, date-range change) in the existing audit log, attributing the change to the user who made it. No separate audit subsystem is required.
- **FR-013**: All copy presented to end-users (admin promo controls, cashier badge and "Ahorrás" text, validation messages) MUST be in Spanish, matching the existing UI language convention. Spec and developer docs remain in English.
- **FR-014**: The feature MUST NOT introduce any new way to discount a sale at the cart line beyond setting the unit price via promo configuration. Existing manual discounts (if any) remain governed by their own rules and are out of scope for this feature.
- **FR-015**: Cashier sessions MUST pick up promo-configuration changes on the next product lookup or add-to-cart action, without requiring the cashier to log out and in again or restart the POS app.

### Key Entities *(include if feature involves data)*

- **Product (existing, extended)**: gains promo-related attributes — `promoEnabled` (boolean), `promoType` (`fixed` | `percent`), `promoValue` (number), `promoFrom` (date, optional), `promoTo` (date, optional). Normal price is unchanged.
- **Promo Activation Decision**: a derived value computed at "add to cart" time from the product's promo attributes and the current local date. Either "no promo" or "promo active with effective unit price = X". Not stored; computed fresh per cart-add.
- **Cart Line Item (existing, extended interpretation)**: records the unit price actually applied to the line (already an existing field); when that price came from an active promo, the line additionally remembers the normal-price reference and the saving so the UI and the receipt can render the badge and "Ahorrás" line without recomputing from a potentially-changed product state. No new line table is required if existing line storage already retains the normal price or it can be added as an additive field.
- **Audit Log Entry (existing)**: gains entries for each promo-configuration change with the actor, the product, and the before/after values, using the existing audit mechanism.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Once a promo is saved by an Admin or Supervisor, the next cart-add of that product by any cashier reflects the promo price within 2 seconds, without the cashier restarting the POS or signing out.
- **SC-002**: 100% of cart lines added while a product's promo is active are priced at the promo unit price; zero lines are priced at the normal price for products with an active promo, over any 30-day measurement window post-release.
- **SC-003**: 100% of cart lines added while a product's promo is inactive (toggle off, outside date range, or no promo configured) are priced at the normal price; zero lines are inadvertently priced at a previous or future promo amount.
- **SC-004**: Admins can identify all currently-in-promo products from the product listing in a single filter action (one click or one toggle), not by scanning rows manually.
- **SC-005**: Customers see the saving on their receipt: at least 95% of receipts for sales containing at least one promo line display the "Ahorrás X Gs" totals line correctly (verified by spot-checking printed and on-screen receipts in QA).
- **SC-006**: Zero customer complaints in the first quarter post-release of the form "me cobraron precio normal cuando estaba en promo" attributable to the feature itself (i.e., excluding cases where the promo had legitimately expired or was disabled before the sale).

## Assumptions

- Only one active promotional price exists per product at a time. Stacked or overlapping promos on the same product are out of scope; if the business wants to schedule a follow-on promo, they update the existing record.
- A line's price is snapshotted at "add to cart". A promo that expires mid-sale does not retroactively re-price lines already in the cart. This avoids surprising the cashier after they have quoted the customer.
- Percentage promos are restricted to whole integers 1–99 for v1. Fractional percentages and 100% (free) are out of scope to keep the math and UI simple; "free" goods are handled by other mechanisms outside this feature.
- Rounding for percentage promos is "round to the nearest whole guaraní" (half-up). This is consistent enough across systems for our scale; if a different rule is wanted later it is a follow-up.
- Dates `from` and `to` are interpreted in the store's local time zone, inclusive of the full day. The system clock used is the existing one — no new time-source dependency is introduced.
- The existing product-edit UI is the natural place to host the promo controls; no separate "promotions" module is required for v1.
- The existing audit log mechanism is reused for promo-config changes; no new audit table or pipeline is added.
- Receipts already render line items and totals via the existing receipt component; rendering the badge struck-through price and "Ahorrás" line is a presentation change, not a new receipt format.
- The locked stack (Electron 39 + React 19 + TypeScript 5.9 + Tailwind v4 + better-sqlite3 + Zustand) per `.specify/memory/constitution.md` is honoured; no new runtime dependency is added by this feature.
- Out of scope for v1: combo / 2x1 / bundle promotions, quantity-based discounts (e.g., "20% off when buying 3+"), customer-segment promos, category-level promos, coupon codes, and any analytics dashboard dedicated to promo performance.
