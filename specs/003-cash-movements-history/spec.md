# Feature Specification: Cash Movements History

**Feature Branch**: `003-cash-movements-history`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "Cash Movements History page — a new sidebar entry 'Movimientos de Caja' that lists all cash register movements (manual income, manual expense, and register opening/closing entries) with server-side pagination, filters, and Excel export. Replaces the current limitation where CajaPage only shows movements for the currently open register."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auditable history of manual cash movements (Priority: P1)

As a shop owner (admin) reconciling the day-to-day cash flow with my bookkeeper, I need a single place where I can see every manual ingreso and egreso made from the cash register, across any date range and any cashier, so I can verify what was put in or taken out of the till outside of sales.

Today, once a cash register session is closed, the individual movements that produced its totals are not visible anywhere — only the session-level summary in Reportes → Cierres Caja. Recovering the detail requires opening the database directly.

**Why this priority**: This is the primary motivation for the feature. Without this story the page has no reason to exist. It unblocks accounting reconciliation, which is currently a manual, error-prone task.

**Independent Test**: Open the new "Movimientos de Caja" entry in the sidebar. Confirm the page lists every manual movement (income and expense) from every closed and open cash register session, ordered by date descending, paginated, with cashier and session attribution visible per row.

**Acceptance Scenarios**:

1. **Given** an admin user is logged in and there are manual movements across multiple closed sessions, **When** they open Movimientos de Caja with no filters applied, **Then** the most recent movements appear first, with date/time, type, description, amount, cashier name, and a link to the session detail in Reportes.
2. **Given** an admin user is on the page, **When** they set a date range covering only last week, **Then** the list refreshes to show only movements created within that range and the pagination resets to page 1.
3. **Given** an admin user is filtering by cashier "Maria" and type "expense", **When** the list refreshes, **Then** only expenses created by Maria are shown.
4. **Given** an admin user is viewing a filtered result that spans multiple pages, **When** they click "Export to Excel", **Then** the downloaded file contains every row across every page that matches the current filters, not just the visible page.

---

### User Story 2 - Cashier sees their own movements only (Priority: P2)

As a cashier, I want to consult my own past ingresos and egresos so I can verify what I registered during my shifts, but I must not see movements from other cashiers or sensitive financial information beyond my own activity.

**Why this priority**: Useful for cashier self-service and reduces interruptions to supervisors over routine "did I record that?" questions. Important for trust and minimizing data exposure, but secondary to the audit use case in P1.

**Independent Test**: Log in as a cashier user. Open Movimientos de Caja. Confirm that only rows where the cashier is the creator are visible, the cashier filter is locked to their own identity, and there are no controls to void or modify entries.

**Acceptance Scenarios**:

1. **Given** a cashier user is logged in and other cashiers have created movements, **When** they open Movimientos de Caja, **Then** only their own movements are listed and the "Cashier" filter is fixed to their own name and not editable.
2. **Given** a cashier is viewing their movements, **When** they look at any row, **Then** no "Anular" (void) action is visible.
3. **Given** a cashier exports their movements to Excel, **When** the file is opened, **Then** it contains only their own rows.

---

### User Story 3 - Void an incorrectly registered movement (Priority: P2)

As an admin or supervisor, when a cashier records an ingreso or egreso by mistake (wrong amount, wrong description, or duplicated entry), I need to cancel its effect on the register totals without erasing the original entry from history, so the audit trail remains intact while the cash balance becomes correct.

**Why this priority**: Without this, a misregistered movement either stays incorrect forever or someone edits the database manually. Both are unacceptable for a system meant to support audit. The original ask explicitly preferred "append-only with reversals" over destructive edits.

**Independent Test**: As admin, locate a movement in the list, click "Anular", confirm. The original row remains visible but marked as voided, and a new inverse movement appears in the list referencing the original. The cash register session totals in Reportes reflect a net zero effect from the pair.

**Acceptance Scenarios**:

1. **Given** an admin user views a non-voided manual movement, **When** they click "Anular" and confirm, **Then** the original row is visually marked as voided (e.g., struck-through amount and a badge), and a new inverse movement appears with opposite type and same absolute amount, linked back to the original.
2. **Given** a movement has already been voided, **When** the admin looks at its row, **Then** the "Anular" action is not shown, and the row clearly indicates "Voided by [inverse movement reference]".
3. **Given** an admin voids a movement that belongs to a closed cash register session, **When** they revisit the session summary in Reportes → Cierres Caja, **Then** the session totals are unchanged (voids do not retroactively alter historical session closings; they create their own audit entry in the current period).
4. **Given** a cashier views any row, **When** they look at the actions column, **Then** no void control is visible regardless of who created the original entry.

---

### User Story 4 - Trace a movement to its register session (Priority: P3)

As any authorized user, when I see a movement in the list and need context (what shift it belonged to, what the closing balance was that day), I want to jump directly to the session's closure detail in Reportes from the row, so I do not have to manually correlate by date and cashier.

**Why this priority**: Quality-of-life. The feature is usable without this — users can navigate to Reportes manually — but the link saves a meaningful amount of friction during reconciliation.

**Independent Test**: Click the register session id (or its dedicated link icon) on any row. The browser navigates to the corresponding "Cierre Caja" detail in the Reportes module, scoped to that session.

**Acceptance Scenarios**:

1. **Given** a user clicks the session id on any movement row, **When** the click is registered, **Then** they are taken to the Cierres Caja detail for that exact session.
2. **Given** the movement belongs to a still-open session, **When** the user clicks the session id, **Then** they are taken to the current cash register page (CajaPage) instead of a closure detail.

---

### Edge Cases

- **Voiding a voiding entry**: An admin tries to void an inverse movement that was itself created to cancel another entry. The system should prevent this (voids are not themselves voidable) to avoid recursive ambiguity. The void action is hidden for any row whose type is "void".
- **Date range spans many months**: A user sets a 12-month date range that returns 50,000+ rows. Pagination and filtering must remain responsive; the export must complete without the UI freezing, or warn the user if the export exceeds a safety threshold.
- **Deleted cashier**: A movement was created by a cashier user who has since been removed. The row must still display the cashier's name (snapshotted) and not error out.
- **Concurrent void**: Two admins click "Anular" on the same row at the same moment. Only one inverse movement should be created; the second attempt must be rejected with a clear message.
- **Cash register reopened/edited externally**: If a session's open/close entries are ever modified directly in the database, the list reflects current state on next load. The page does not cache stale data.
- **Movement with zero amount**: Validation should prevent creation upstream; the list must not crash if one exists in legacy data.
- **Cashier role demoted to none / suspended user**: A cashier who lost access tries to open the page. Auth guard denies; same enforcement as other authenticated pages.

## Requirements *(mandatory)*

### Functional Requirements

**Listing and pagination**

- **FR-001**: The system MUST expose a new top-level sidebar entry "Movimientos de Caja" visible only to authenticated users.
- **FR-002**: The page MUST list movements of types: manual income, manual expense, register opening, register closing, and inverse (void) entries.
- **FR-003**: The list MUST NOT include cash-payment portions of sales; those remain in the existing sales listing.
- **FR-004**: Results MUST be sorted by movement timestamp descending by default, with the most recent first.
- **FR-005**: The system MUST paginate results server-side, default page size 25, configurable to 10/25/50/100 per page.
- **FR-006**: Total result count MUST be displayed alongside pagination controls so users know the size of the filtered set.

**Filtering**

- **FR-007**: Users MUST be able to filter by a date range (from / to), defaulting to the current day on first load.
- **FR-008**: Users MUST be able to filter by movement type using a multi-select control (income, expense, opening, closing, void).
- **FR-009**: Admin and supervisor users MUST be able to filter by cashier (any user with cashier role or above).
- **FR-010**: Cashier users MUST have the cashier filter fixed to their own identity and the control disabled.
- **FR-011**: Users MUST be able to filter by a specific cash register session id, presented as a dropdown of recent sessions.
- **FR-012**: Users MUST be able to search the description field by free text (case-insensitive, partial match).
- **FR-013**: Applying or changing any filter MUST reset pagination to page 1 and refresh results.
- **FR-014**: Filter state MUST persist within the session (e.g., navigating away and back preserves filters until the page is reopened from cold start).

**Authorization**

- **FR-015**: The list MUST scope rows to the requesting user's identity when the user has the cashier role: only movements where the cashier created the entry are returned.
- **FR-016**: Admin and supervisor users MUST see all movements regardless of cashier.
- **FR-017**: Authorization MUST be enforced on the server side, not only by hiding UI controls. Any attempt by a cashier to query movements belonging to another user MUST be rejected.
- **FR-018**: The void action MUST be available only to admin and supervisor roles, both in the UI and on the server.

**Voiding**

- **FR-019**: Voiding a movement MUST create a new movement of inverse effect (income ↔ expense; opening ↔ closing not allowed — see FR-022) with the same absolute amount and a description that references the original.
- **FR-020**: The inverse movement MUST be linked to the original via a structural reference (so the UI can show "voided by" / "void of").
- **FR-021**: The original movement MUST remain in the table; it MUST NOT be deleted or rewritten.
- **FR-022**: Opening and closing movements MUST NOT be voidable through this page. Adjustments to opening/closing balances belong to the cash close flow itself.
- **FR-023**: An inverse (void) movement MUST NOT itself be voidable.
- **FR-024**: After a successful void, the list MUST reflect both the original (marked voided) and the new inverse entry without a manual refresh.
- **FR-025**: Void attempts on an already-voided movement MUST be rejected with a clear, user-readable message.

**Export**

- **FR-026**: Users MUST be able to export the currently filtered result set to an Excel (.xlsx) file.
- **FR-027**: The export MUST include every row matching the current filters, across all pages — not only the rows visible on the current page.
- **FR-028**: Exported columns MUST include: date/time, type, description, amount, cashier name, register session id, voided flag, and reference to inverse entry when applicable.
- **FR-029**: The export filename MUST include the filter date range (e.g., `movimientos-caja_2026-05-01_2026-05-11.xlsx`).
- **FR-030**: If the filtered result exceeds a safe export threshold (suggested: 10,000 rows), the system MUST warn the user before generating the file and offer to narrow the date range.

**Cross-module navigation**

- **FR-031**: Each row MUST link from its session id to the corresponding session detail in Reportes → Cierres Caja, or to the open cash register page if the session is still open.
- **FR-032**: Voided rows MUST display a control to navigate directly to the inverse entry, and vice versa.

**Audit**

- **FR-033**: Every void operation MUST be recorded in the existing auth/audit log with: actor user id, original movement id, inverse movement id, timestamp, and reason if provided.

### Key Entities

- **Cash Movement**: An entry recording money moving in or out of a cash register session outside of a sale. Has a type, an amount, a description, a creating user, a register session reference, a creation timestamp, and an optional reference to an original movement it is voiding.
- **Cash Register Session**: An open/close cycle of the till during which sales and manual movements are recorded. Provides the scoping container for movements and the link target for the row-level navigation.
- **User (Cashier)**: The actor that creates movements. Used both as a foreign reference on each movement and as a filter dimension. Cashier role drives row-level scoping; admin and supervisor roles unlock cross-cashier visibility and the void action.
- **Void Reference**: The structural link between an original movement and its inverse cancelling entry. Carries the audit semantics ("this movement was voided" / "this movement is the void of another").

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shop owner can produce a complete, filterable list of every manual cash movement for any date range in under 30 seconds, without opening the database, without writing a query, and without contacting support.
- **SC-002**: 100% of manual ingreso and egreso entries recorded in the system are retrievable through the new page, including those from already-closed cash register sessions.
- **SC-003**: A cashier opening the page sees only their own movements; no test scenario produces a cross-cashier leak through filter manipulation, URL editing, or repeated requests.
- **SC-004**: An admin can void a misregistered movement and have the corresponding cash balance correction reflected in the live cash register page (for open sessions) or in the audit history (for closed sessions) within 5 seconds of confirming the action.
- **SC-005**: Exports of up to 5,000 rows complete in under 10 seconds on the target hardware; exports of 5,000–10,000 rows complete in under 30 seconds and prompt the user before generating the file beyond that threshold.
- **SC-006**: Filtered queries (date range + type + cashier + session) return the first page of results in under 1 second for datasets of up to 100,000 total movements.
- **SC-007**: Time spent by the shop owner reconciling daily cash with their bookkeeper drops measurably (anecdotal target: from ~30 minutes/week of manual cross-referencing to under 5 minutes).
- **SC-008**: No void operation in production results in inconsistent paired records (every voided original has exactly one inverse; every inverse references exactly one original).

## Assumptions

- The existing `cash_movements` schema can accommodate the void linkage with an additive change; no rewrite of past records is required.
- The existing auth role model (cashier / supervisor / admin) is the authoritative source for "who sees what" and "who can void". No new role is introduced.
- The existing Reportes → Cierres Caja module already presents the per-session detail view that movement rows link to; no changes to that view are required as part of this feature beyond accepting deep links.
- The existing Excel export utility used by the sales listing is reusable for the movements export; otherwise the visual UX is consistent with sales export (same button placement, same loading state, same filename convention).
- Manual creation of new movements is out of scope for this page. Creation continues to live in the open cash register page (CajaPage) to keep the till-side workflow unchanged.
- Mobile-first responsive design is not required; the application is desktop-only (Electron).
- Spanish is the language for all user-facing labels in this page; technical documentation (this spec, the plan, the tasks file) remains in English, consistent with prior features in this codebase.
- Performance targets assume the production dataset will not exceed ~100,000 manual movements within any practical date range; if that ceiling is approached, additional indexing or archival policies may be required and would be addressed in a separate feature.
