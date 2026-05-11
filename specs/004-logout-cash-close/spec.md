# Feature Specification: Logout Requires Cash Register Close

**Feature Branch**: `004-logout-cash-close`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "Cuando un usuario cierra sesión, el sistema debe obligarlo a cerrar su caja abierta antes de permitir el logout. Si el cajero tiene una caja abierta a su nombre, no debe poder cerrar sesión hasta cerrarla; se le mostrará un aviso y un atajo al flujo de cierre de caja. Si no tiene caja abierta, el logout procede normalmente. Aplica a todos los roles que puedan abrir caja (cajero principalmente; admin/supervisor solo si tienen una caja propia abierta)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cashier with open register is blocked from logging out (Priority: P1)

A cashier finishes their shift and clicks "Cerrar sesión" while their cash register is still open. The system blocks the logout, shows a clear notice explaining a register is open in their name, and offers a one-click shortcut that takes them directly into the close-register flow. Once the register is closed (or already closed by another path), the cashier can log out normally.

**Why this priority**: This is the core value of the feature — preventing the accounting hole where a shift ends with cash unaccounted for and the next user (or the next session of the same user) inherits an open register that doesn't reflect a real physical count. Without P1, the feature has no purpose.

**Independent Test**: Sign in as a cashier, open a cash register, attempt to log out. Verify the logout is blocked, the notice names the open register, and the shortcut button navigates to the close-register screen with that register preselected. Then close the register and verify logout proceeds.

**Acceptance Scenarios**:

1. **Given** a signed-in cashier with an open cash register in their name, **When** they trigger logout, **Then** the system blocks the logout and displays a notice identifying the open register (with at least the register opening time and current expected balance summary visible).
2. **Given** the blocking notice is shown, **When** the cashier clicks the "Cerrar caja ahora" shortcut, **Then** they are navigated to the existing close-register flow with their open register selected.
3. **Given** the cashier completes the close-register flow successfully, **When** they trigger logout again, **Then** the logout succeeds with no further blocking.
4. **Given** a signed-in cashier with no open cash register in their name, **When** they trigger logout, **Then** the logout proceeds immediately with no extra prompt.

---

### User Story 2 - Admin/Supervisor blocked only when they personally have an open register (Priority: P2)

An admin or supervisor who never opened a register themselves can log out freely, even if other users in the system have open registers. But if an admin/supervisor opened a register in their own name (e.g., they covered a shift), the same blocking rule applies to them.

**Why this priority**: Avoids friction for managers doing routine logouts while still enforcing the rule symmetrically for any user who personally holds an open register. Lower than P1 because in practice managers rarely operate a register themselves.

**Independent Test**: Sign in as an admin while a cashier has an open register, log out, and verify logout proceeds with no block. Then, in a separate session, have an admin open a register in their own name and verify they get the same block as a cashier.

**Acceptance Scenarios**:

1. **Given** an admin/supervisor with no register opened in their name, **When** they trigger logout, **Then** the logout proceeds normally regardless of other users' open registers.
2. **Given** an admin/supervisor who personally opened a register that is still open, **When** they trigger logout, **Then** the same block, notice, and shortcut are shown as for a cashier.

---

### User Story 3 - Forced/system logout paths preserve the same guarantee (Priority: P3)

Any path that ends the user's session — explicit "Cerrar sesión" button, idle timeout, app-shutdown logout, switching user accounts — must either run the same guard or surface the same block. The user is never silently logged out while holding an open register.

**Why this priority**: Closes a gap where alternate exit paths could bypass the rule. P3 because the primary "Cerrar sesión" button is the dominant flow in practice; other paths are edge cases worth covering once the main path works.

**Independent Test**: For each non-button logout path that exists in the app (e.g., idle auto-logout, "Switch user", quitting the app while signed in), reproduce it while holding an open register and verify the user is either blocked or, if the path is unavoidable (e.g., OS shutdown), the next sign-in surfaces the same close-register reminder.

**Acceptance Scenarios**:

1. **Given** a cashier with an open register, **When** an idle-timeout logout fires, **Then** the system either blocks the logout (keeping the session active with the same notice) or, on the next sign-in by the same user, surfaces an unmissable reminder to close the still-open register.
2. **Given** the cashier chooses "Switch user" with an open register, **When** the switch is attempted, **Then** the system blocks it and offers the close-register shortcut just like the explicit logout button.

---

### Edge Cases

- A register opened in the user's name is left open from a previous session (app was force-quit). On the next sign-in, the open register is detected; logout is blocked until it's closed. The user can close it normally even though it wasn't opened in the current session.
- Two users in some way share the same machine/install: the rule is strictly per-user — user A's logout is never blocked by user B's open register.
- Cashier has an open register but the system clock has crossed midnight or a business-day boundary. The block still applies — the register is open by status, not by calendar date.
- During the close-register flow, the user cancels or aborts halfway. They return to the previous screen with the register still open, and any new logout attempt is blocked again with the same notice.
- A network/IPC error prevents reading register state. The logout MUST default to blocked (with an explanatory message and a retry) rather than allowing logout on an indeterminate state — losing a session is recoverable, losing audit integrity is not.
- The user's role no longer permits opening a register (e.g., their role was changed), but a register opened earlier in their name is still open. The block still applies; the close-register flow remains accessible to them for the purpose of closing their own register.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST, on every logout attempt, check whether the currently signed-in user has any cash register that is currently open in their name.
- **FR-002**: If at least one such open register exists, the system MUST block the logout and display a notice that (a) explains why logout is blocked, (b) identifies the open register (at minimum: opening time and a summary of expected balance or movement count), and (c) offers a primary action to go directly to the close-register flow.
- **FR-003**: The primary action in the block notice MUST navigate the user to the existing close-register flow with their open register preselected, so no extra selection step is needed.
- **FR-004**: If the user has no open register in their name, the system MUST proceed with logout without showing any extra prompt or step.
- **FR-005**: The rule MUST apply uniformly to every user role that is allowed to open a cash register (cashier, admin, supervisor). The trigger is "this user owns an open register," not the user's role.
- **FR-006**: One user's open register MUST NOT block another user's logout. The check is strictly scoped to the signed-in user.
- **FR-007**: All session-ending paths the application exposes (explicit logout button, idle timeout, switch-user, in-app session reset) MUST run the same guard. Paths that cannot run the guard (e.g., OS-level kill, power loss) MUST be compensated by re-surfacing the same close-register reminder on the next sign-in by the same user, until the register is closed.
- **FR-008**: When the underlying check cannot determine register state (data error, IPC failure), the system MUST default to blocking logout and present a retry, rather than allowing logout on indeterminate state.
- **FR-009**: After the user successfully closes their open register, a subsequent logout attempt MUST proceed without re-blocking, with no manual refresh required by the user.
- **FR-010**: The block notice and close-register shortcut MUST be presented in Spanish, matching the existing cashier-facing UI language convention.
- **FR-011**: The feature MUST NOT introduce any new way to close a register; it MUST reuse the existing close-register flow exactly as it works today.
- **FR-012**: The feature MUST NOT auto-close any register on the user's behalf under any circumstance. Closing always requires an explicit user action through the existing flow.

### Key Entities *(include if feature involves data)*

- **User Session**: The signed-in user whose logout is being attempted. Relevant attributes: user id, role.
- **Cash Register (open)**: A cash register record owned by a specific user, in an "open" state, with an opening timestamp and accumulated movements. Relationship: zero-or-one open register per user at any given time (existing invariant).
- **Logout Guard Decision**: Conceptual result of the check — either "allow logout" or "block logout, here is the open register to close." This is computed fresh on every logout attempt; no stored state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero new occurrences of "user X logged out while register Y was still open" in the audit/movements history after the feature ships, measured over a 30-day window post-release.
- **SC-002**: 100% of logout attempts by a user holding an open register result in either a successful close-then-logout or an explicit user-chosen cancellation — never a silent logout while the register is still open.
- **SC-003**: A cashier who triggers logout with an open register reaches the close-register screen in a single click from the block notice (no manual register selection step required).
- **SC-004**: Logout latency for users with no open register increases by no more than a perceptible amount (target: under 200 ms added to the existing logout time), so the guard is invisible to the common case.
- **SC-005**: Support tickets or shift-handover incidents tagged "caja abierta al cambiar turno" / "caja sin cerrar" drop by at least 80% in the first quarter after release, compared to the prior quarter baseline.

## Assumptions

- The existing data model already represents register ownership (`opened_by` / user id on the open register row) and an open/closed status field — the check is a query on existing data, not a new schema.
- The current close-register flow accepts being entered with a preselected register, or can be reached at a URL/route that selects it; if not, a minor adjustment is needed to support the deep-link, and that adjustment is in scope.
- Only one cash register can be open per user at a time (existing invariant from prior features). The block notice therefore references "your open register" in the singular.
- Idle-timeout and switch-user flows, if present, route through a single logout entry point that this guard can hook into; if multiple disjoint entry points exist, all of them are in scope to update.
- End-user copy (notice, button labels) is in Spanish; the rest of the project docs/spec remain in English per the project's documentation language convention.
- The feature does not change any cash-handling, accounting, or audit logic — it only changes when a user is permitted to end their session.
