# Feature Specification: Server-side Authorization for Privileged Operations

**Feature Branch**: `001-ipc-authorization`
**Created**: 2026-05-08
**Status**: Draft
**Input**: User description: "para P1 (autorización en IPC)"

## Background

Today, every privileged operation in the POS application — creating users, closing a cash register, restoring a database backup, deleting a customer, adjusting stock, cancelling a sale, modifying configuration — is enforced **only** at the user-interface layer. The back-office layer trusts whatever the renderer asks it to do. A single compromise of the renderer (XSS through a product image, a malicious dependency, or an unintended dev-tools call) is enough to invoke any operation, including those that mutate cash, customer balances, or the database file itself. This feature closes that gap by requiring every privileged operation to verify the caller's identity and role at the moment of execution, against the canonical source of truth.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cashier cannot escalate to administrative actions (Priority: P1)

A cashier is logged in to take orders. Through any path other than the cashier menu (menu hiding, dev-tools, a malicious script in the renderer, a compromised dependency), the cashier cannot create a new user, restore a backup, change global settings, or modify another cashier's account. The system rejects the operation server-side, regardless of what the user interface allowed.

**Why this priority**: Administrative actions are the highest-impact path to compromise. Creating a new admin, restoring a tampered backup, or altering settings can give the attacker permanent control of the terminal and the data on it. The current state is "renderer is trusted" — closing this is the single biggest risk reduction available.

**Independent Test**: Log in as a cashier, attempt each administrative operation (create user, edit user role, deactivate user, restore backup, change a setting) by directly invoking the underlying capability bypassing the UI. The system must refuse each attempt and the persisted state must be unchanged.

**Acceptance Scenarios**:

1. **Given** a cashier is logged in and the user list contains exactly one admin and the cashier, **When** the cashier directly invokes the create-user operation requesting a new admin account, **Then** the operation is rejected, no user record is created, and the user list still contains exactly one admin and the cashier.
2. **Given** a cashier is logged in, **When** the cashier directly invokes the restore-backup operation, **Then** the operation is rejected and the database file is unchanged.
3. **Given** a cashier is logged in, **When** the cashier directly invokes the update-settings operation, **Then** the operation is rejected and configuration values are unchanged.
4. **Given** a cashier is logged in, **When** the cashier directly invokes the update-user operation against another cashier's record, **Then** the operation is rejected and the target user record is unchanged.

---

### User Story 2 — Financial mutations require appropriate role (Priority: P1)

Operations that move money or alter ledger state — closing a cash session, adding cash in/out movements, cancelling a sale, deleting a customer with history, editing a customer's payment record — are only executed when the caller's role is on the explicit allow-list for that operation. A cashier can record sales, but cannot close a cash session that is not their own; a cashier cannot cancel a sale; a cashier cannot delete a customer.

**Why this priority**: Financial integrity is the second pillar of the cash-handling business. Allowing any user to silently cancel a sale, edit a customer payment, or close a register changes the day's reconciliation in ways the merchant cannot trace.

**Independent Test**: Log in as a cashier and attempt each financial mutation by directly invoking the underlying capability. Verify each is rejected and the totals shown in the cash session and the customer ledger remain unchanged.

**Acceptance Scenarios**:

1. **Given** a cashier is logged in and a register is open under another user, **When** the cashier directly invokes the close-register operation, **Then** the operation is rejected and the register stays open.
2. **Given** a cashier is logged in, **When** the cashier directly invokes the cancel-sale operation against any sale, **Then** the operation is rejected and the sale stays in `completed` state.
3. **Given** a cashier is logged in, **When** the cashier directly invokes the delete-customer-payment operation, **Then** the operation is rejected and both the payment and the customer balance are unchanged.
4. **Given** a supervisor is logged in, **When** the supervisor invokes the cancel-sale operation, **Then** the operation is allowed.
5. **Given** a cashier opened the current register at 09:00, **When** the same cashier attempts to close the register, **Then** the operation is allowed (the cashier owns the session).

---

### User Story 3 — Sensitive reports respect role boundaries (Priority: P2)

Reports and detail screens that reveal cost or margin information — profit margin per product, last-purchase cost on the product detail page, supplier purchase history — are only returned to admins and supervisors. A cashier requesting any of those is refused. Operational reports (today's sales, top sold products by revenue, sales-by-payment-method) remain available to cashiers because they need them for shift handover.

**Why this priority**: Cost data is competitive information that the business does not want to share with cashiers, who are typically the highest-turnover role. The risk is leakage rather than corruption — lower than P1, but still material — and the gating is straightforward to add once the identity check is in place.

**Independent Test**: Log in as a cashier and request each cost-revealing report. Verify the response contains no cost or margin field. Then log in as supervisor and verify the same reports return full data.

**Acceptance Scenarios**:

1. **Given** a cashier is logged in, **When** the cashier requests the profit-margin report, **Then** the operation is rejected.
2. **Given** a cashier is logged in, **When** the cashier requests the product-detail view of any product, **Then** the response does not include the last-purchase cost or the margin percentage.
3. **Given** a supervisor is logged in, **When** the supervisor requests the profit-margin report, **Then** the report is returned with full cost and margin data.
4. **Given** a cashier is logged in, **When** the cashier requests the sales-by-payment-method or top-sold-products-by-revenue report, **Then** the report is returned (no cost data is involved).

---

### User Story 4 — Authorization failures are audited and surfaced (Priority: P2)

Every blocked operation is recorded as an audit entry with timestamp, the operation that was attempted, the user who attempted it (or "no user identified" if the caller did not provide identity), and the reason for the block (no user, user inactive, role insufficient). When the same user accumulates more than five blocked attempts in a ten-minute window, the system raises an alert visible to administrators on next dashboard load.

**Why this priority**: Without an audit trail, the merchant has no way to know whether the new defenses ever fired or whether someone is actively probing. This is detection capability, not prevention; lower priority than the prevention itself, but essential for incident response.

**Independent Test**: Trigger a known-blocked operation as a cashier; confirm an audit entry exists. Trigger six rapid blocked attempts as the same cashier; confirm an alert is visible to administrators.

**Acceptance Scenarios**:

1. **Given** a cashier is logged in, **When** the cashier attempts any operation outside their role's allow-list, **Then** an audit entry is written within five seconds containing the operation, the cashier's user id, the timestamp, and the block reason.
2. **Given** the same cashier has produced six authorization-blocked attempts in the last ten minutes, **When** an administrator opens the dashboard, **Then** an alert indicates "repeated authorization failures from {cashier name}".
3. **Given** an operation is invoked with no user identity provided at all, **When** the system processes the call, **Then** the operation is blocked, the audit entry records "no user identified", and no further state is changed.

---

### User Story 5 — Recovery path for empty or corrupted user table (Priority: P3)

The merchant must be able to recover when the local database has been wiped or contains no admin user (e.g., a botched manual edit, a partial restore, or a fresh installation). In this state, the application detects there is no admin and enters a recovery mode that allows the same first-run admin-creation flow that exists today. Once at least one admin user exists, normal authorization rules apply and the recovery path closes automatically.

**Why this priority**: Without this path, the new authorization rules become a foot-gun: the merchant could lock themselves out of their own POS by losing their admin PIN. The P1 stories prevent attackers; this story prevents the merchant from being the casualty.

**Independent Test**: Wipe the user table; launch the app; observe the recovery flow appears and accepts a new admin. After admin is created, verify that subsequent unauthorized operations are blocked normally.

**Acceptance Scenarios**:

1. **Given** the database has zero active admin users, **When** the application starts, **Then** the first-run admin-creation flow is shown and no privileged operations succeed until an admin exists.
2. **Given** a fresh install, **When** the user creates the first admin, **Then** that admin is the only account that can be used to grant further roles, and authorization is enforced from that moment forward.
3. **Given** at least one active admin already exists, **When** any caller attempts to invoke the recovery flow, **Then** the recovery flow is unavailable and ordinary authorization applies.

---

### Edge Cases

- **User deactivated mid-session**: A user is logged in and has the renderer open; an admin marks them inactive. On their next privileged operation, the system MUST block the call as if the user were not authenticated.
- **Role demoted mid-session**: A supervisor is logged in; an admin changes their role to cajero. The next privileged operation is evaluated against the new role, not the role at login time.
- **Caller claims a different user id**: The renderer presents user id X as the caller, but X did not log in here (e.g., a tampered renderer or a captured session). The system MUST resolve identity from the canonical user record, not from any value the caller controls. (How exactly identity is established is an implementation choice for the planning phase; the spec only requires that the role used for the decision is read from the canonical user record at the moment of the call.)
- **All admin accounts deactivated simultaneously**: An admin deactivates the only other admin and then themself. Subsequent privileged operations all fail; the recovery path (User Story 5) becomes the only way forward.
- **Concurrent operations from the same user**: Two privileged operations arrive from the same user nearly simultaneously. Each is evaluated independently against the latest role; there is no coordination requirement between them.
- **Self-service operations**: A user reads their own profile or changes their own PIN. These do not require role check, but they MUST verify the user is acting on their own record (cannot edit somebody else's profile).
- **Read operations during seed/migration**: At application start, before the user logs in, certain read operations (active user list for the login screen, app-settings load for theme and printer config) MUST remain accessible without an authenticated user; they are part of the pre-login surface.
- **Long-running privileged operation**: An operation begins under a valid role; the user is deactivated before it completes. The operation's authorization is evaluated once at entry; it is not re-checked mid-operation.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity & role resolution

- **FR-001**: For every operation classified as privileged, the system MUST identify the calling user before executing the operation.
- **FR-002**: The role used for the authorization decision MUST be read from the canonical user record at the moment of the call. Values supplied by the caller MUST NOT be trusted as the source of role.
- **FR-003**: If the caller cannot be identified, the operation MUST be rejected with a "no user identified" outcome.
- **FR-004**: If the caller is identified but the user record is inactive, the operation MUST be rejected with a "user inactive" outcome.
- **FR-005**: If the caller is identified and active but the role is not on the operation's allow-list, the operation MUST be rejected with an "insufficient role" outcome.

#### Authorization matrix

- **FR-006**: Every operation in the system MUST be classified as either "public" (no auth required), "self-only" (the caller must own the target record), or "privileged" (the caller's role must be on the operation's allow-list).
- **FR-007**: The classification and the allow-list for every privileged operation MUST be defined in a single, reviewable artifact (the authorization matrix). It is not acceptable for authorization rules to be discoverable only by reading individual operation implementations.
- **FR-008**: The authorization matrix MUST be the single source of truth: an operation that exists in the system but is not in the matrix MUST be treated as privileged-deny-all (fails closed).

#### Role assignments

- **FR-009**: User-management operations (create, update, deactivate, role change, PIN reset for another user) MUST be admin-only.
- **FR-010**: Backup restore and global settings change MUST be admin-only.
- **FR-011**: Cash-session close, cash in/out movements, and sale cancellation MUST be allowed for admin and supervisor; additionally, the cashier who opened the current cash session MAY close that same session.
- **FR-012**: Recording new sales MUST be allowed for cajero, supervisor, and admin.
- **FR-013**: Manual stock adjustments and product CRUD MUST be allowed for admin and supervisor only.
- **FR-014**: Customer create, update, payment record, and delete operations MUST be allowed for admin and supervisor only.
- **FR-015**: Reports that reveal cost, last-purchase price, or profit margin MUST be admin and supervisor only. Operational reports (sales-by-day, top-sold-by-revenue, recent sales, today's totals) remain accessible to cajero.
- **FR-016**: Self-service operations (read own profile, change own PIN) MUST verify the caller is operating on their own record. They do not require a role check.

#### Audit & detection

- **FR-017**: Every authorization decision on a privileged operation MUST be auditable. At minimum, the audit entry MUST capture: timestamp, operation name, claimed user id (or "no user"), resolved user role (or "unresolved"), and outcome (allowed / blocked-no-user / blocked-inactive / blocked-insufficient-role).
- **FR-018**: When five or more authorization-blocked entries are recorded for the same user within a ten-minute window, an alert MUST be raised that is visible to administrators on dashboard load and persists until acknowledged.
- **FR-019**: The audit log MUST be retained for at least 90 days. Older entries MAY be pruned on app start.

#### Recovery & first-run

- **FR-020**: When the database contains zero active admin users, the application MUST present the first-run admin-creation flow. Privileged operations MUST remain unavailable until at least one active admin exists.
- **FR-021**: Once at least one active admin exists, the recovery flow MUST be unavailable; subsequent calls to it MUST be rejected.
- **FR-022**: The recovery flow MUST NOT allow restoring a backup or changing settings; its only capability is to create the first admin user.

#### Operational

- **FR-023** *(aspirational, no automated verification in v1)*: Authorization decisions SHOULD complete within 100 milliseconds at the 95th percentile under the application's typical load (single terminal, single logged-in user, populated `users` table). Plan-level estimate: <2 ms via one indexed lookup + one INSERT in WAL mode (see [plan.md](plan.md) and [contracts/audit-schema.md](contracts/audit-schema.md) §Performance estimates). v1 ships **without an automated benchmark** — verification is by ad-hoc measurement during quickstart Test 1 if a regression is suspected. Adding a real benchmark task is deferred to a future feature alongside the test-runner introduction (gap analysis P4).
- **FR-024**: An authorization rejection MUST surface to the user as a clear "you do not have permission to do this" message; it MUST NOT silently no-op.
- **FR-025**: When user-management operations change a user's role or active state, ongoing sessions for that user remain logged in, but every subsequent privileged operation is re-evaluated against the new role/active state on the next call.

### Key Entities

- **User Identity Claim**: The user id presented by the caller alongside a privileged operation. Subject to verification — never trusted as a source of role.
- **Authorization Matrix**: The single canonical mapping of (operation → allowed roles). Includes all operations classified as `public`, `self-only`, or `privileged`. The matrix is reviewable in one place.
- **Authorization Decision**: The outcome of evaluating a single call: one of `allowed`, `blocked-no-user`, `blocked-inactive`, `blocked-insufficient-role`. Carries the input (operation, claimed user id) and the resolved fields (resolved user id, resolved role, decision, timestamp).
- **Authorization Audit Entry**: A persisted record of an Authorization Decision. Used both for incident review and for the repeated-failure detection rule.
- **Privileged Operation**: A named operation that mutates state or reveals sensitive data; subject to the matrix.
- **Self-only Operation**: A named operation a user may perform only on their own record (read own profile, change own PIN). Identity-verified, not role-verified.
- **Public Operation**: A named operation accessible without authentication (e.g., listing active users on the login screen, reading display-only settings before login). Explicitly enumerated; everything else is private by default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of operations that mutate persistent state are listed in the authorization matrix as either `privileged` or `self-only`. None are missing.
- **SC-002**: When a logged-in cashier directly invokes any administrative operation by bypassing the user interface, the operation is rejected and the on-disk state is unchanged. Verified for every operation listed as admin-only in the matrix.
- **SC-003**: When a logged-in cashier directly invokes any financial-mutation operation outside the cashier's allow-list (cancel sale, close another's register, delete customer payment), the operation is rejected and the affected ledger totals (cash session, customer balance, sale status) are unchanged.
- **SC-004**: A logged-in cashier who requests a profit-margin report receives a rejection. A logged-in cashier who opens the product detail screen does not receive cost or margin fields in the response.
- **SC-005**: For every authorization-blocked operation, an audit entry is written within five seconds. The number of blocked operations in production with no corresponding audit entry is zero.
- **SC-006**: After six authorization failures from the same user in ten minutes, an administrator opening the dashboard sees the repeated-failure alert. The alert is dismissable and is recorded as acknowledged.
- **SC-007**: When the database contains zero active admins, no privileged operation succeeds until the first-run admin flow has created one.
- **SC-008** *(aspirational, no automated verification in v1)*: Authorization decisions complete in under 100 milliseconds at the 95th percentile, measured on the production hardware profile (single user, local database). Documented as a target; v1 does not include an automated benchmark task. Verification is via ad-hoc measurement if regression is suspected. Plan-level estimate: <2 ms in the common path (see [contracts/audit-schema.md](contracts/audit-schema.md) §Performance estimates).
- **SC-009**: When a previously logged-in user is deactivated, their next attempted privileged operation is rejected within one operation cycle (no need to re-launch the app).
- **SC-010**: After a role demotion (supervisor → cajero), the user's next attempted privileged operation is evaluated against the new role within one operation cycle.

## Assumptions

- **Identity layer**: The existing `users` table remains the single source of truth for identity and role. No external identity provider is introduced.
- **Role set**: The three existing roles (`admin`, `supervisor`, `cajero`) are sufficient. No new roles are added by this feature.
- **Single-terminal usage**: Each POS terminal has at most one logged-in user at a time. Concurrent multi-user sessions on the same terminal are out of scope.
- **Authorization matrix location**: The matrix lives in a single artifact in the source tree. The exact format (data file, code-as-data, table) is an implementation choice for the plan phase.
- **Front-end gates remain**: The renderer continues to hide menu items the user cannot use, for usability. Front-end gates are best-effort and explicitly not authoritative; the back-office gate is.
- **Session model**: A session begins at login (PIN verification) and ends at explicit logout or app shutdown. There is no inactivity timeout in this feature; an inactivity-timeout policy is a separate feature if desired.
- **Recovery scope**: The recovery flow only creates the first admin. Backup restoration as a recovery action is explicitly **not** part of the recovery flow — restore is admin-only after the recovery flow has produced an admin.
- **Audit log location**: Authorization audit entries are persisted alongside other action logs in the existing `action_logs` table or a dedicated table chosen during planning. Either way, they are queryable from the same database.
- **Pre-login surface**: A small, explicitly-named set of operations (active-user list for the login screen, theme/printer/business-name read for splash and login layout) remain unauthenticated. The matrix enumerates them as `public`. Everything not enumerated is `privileged`.
- **Existing self-service flows**: Today's "view own profile" and "change own PIN" continue to work without role checks; they are reclassified as `self-only`.
- **Performance baseline**: A local SQLite role lookup is fast enough that re-resolving the role on every call is acceptable. Caching is not required by this spec.

## Out of Scope

- Inactivity-based session timeout (separate feature if needed).
- Multi-factor authentication (separate feature).
- New roles beyond admin/supervisor/cajero.
- Encrypting the audit log or making it tamper-evident (separate hardening feature).
- Cross-terminal sync of audit logs (the POS is single-tenant; logs stay local).
- Replacing the existing PIN-only authentication with passwords or biometrics.
