# Phase 0 Research: Logout Requires Cash Register Close

**Feature**: 004-logout-cash-close
**Date**: 2026-05-11

Resolves the open questions implicit in the spec. No `[NEEDS CLARIFICATION]` markers exist in spec.md; these are design-decision records captured to avoid re-deciding them in Phase 1.

---

## Decision 1 — Where to put the logout guard

**Decision**: Introduce a new renderer hook `useLogoutGuard` that exposes a single `requestLogout()` function. The existing `auth.store.logout()` stays untouched as the raw teardown step. The three existing logout call sites stop calling `logout()` directly and call `requestLogout()` instead. `requestLogout()` is the only path from a button click to `logout()`.

**Rationale**:
- The Zustand auth store today is purely synchronous local-storage teardown ([auth.store.ts:33](../../src/renderer/src/store/auth.store.ts#L33)). Awaiting an IPC inside the store action would mix sync + async semantics and force every consumer to handle the promise — high blast radius.
- A hook is the idiomatic React 19 + Zustand seam for "async user-initiated action that needs UI side-effects (modal, navigation)."
- Keeping `auth.store.logout()` as-is preserves the ability to do an unconditional teardown from non-UI paths (recovery mode, future test harness) without bypassing the guard from UI paths — UI paths simply must use `requestLogout`.

**Alternatives considered**:
- *Make `auth.store.logout` async and do the guard inside it* — rejected; muddies the store contract, breaks every existing call site silently, and complicates handling of the "show modal" UI side-effect from inside a Zustand store.
- *Put the check inside a React Router route loader* — rejected; logout is not a route navigation, it's a state mutation. Wrong abstraction.
- *Wrap each logout button locally* — rejected; the spec requires the rule on *every* logout entry point (FR-007). A single hook makes that enforceable by code review (any new logout site must import `useLogoutGuard`).

---

## Decision 2 — Per-user open register query

**Decision**: Add a new query `getOpenCashRegisterByUserId(userId: number)` in [src/main/db/queries/cash.ts](../../src/main/db/queries/cash.ts) that returns `CashRegister | undefined`. The IPC handler reads `ctx.userId` from the authenticated context and passes it; the client never supplies a userId.

**Rationale**:
- The existing `getCurrentCashRegister()` returns *any* register with `status='open'`. The feature spec is strictly per-user (FR-006: "One user's open register MUST NOT block another user's logout"). Reusing `getCurrentCashRegister` would either over-block (cashier B blocked by cashier A's register) or require a post-filter in the renderer, which violates Principle III (schema knowledge leaking out of the repository).
- The query is `SELECT ... FROM cash_registers WHERE user_id = ? AND status = 'open' LIMIT 1` — one indexed lookup. SC-004 budget (200 ms) is multiple orders of magnitude away.
- Passing the userId from `ctx.userId` (the authenticated session) rather than from the client prevents a client-controlled "is *some other user's* register open?" probe. Matches the pattern established by feature 001-ipc-authorization.

**Alternatives considered**:
- *Reuse `getCurrentCashRegister` and filter in the renderer* — rejected; violates Principle III and leaks schema. Also racy if two registers were ever open simultaneously.
- *Trust the renderer-side `useCashStore.register`* — rejected; the store is a cache hydrated by earlier IPC calls. It can be stale (e.g., another tab/window closed the register), and trusting client-side state for a security-relevant gate is exactly what feature 001 prohibited.

---

## Decision 3 — Authorization rule for the new channel

**Decision**: Register `cash:getMyOpenRegister` with `registerAuthorized` and an auth-matrix rule that allows all three roles (admin, supervisor, cashier) — i.e., any authenticated user. No role check beyond "is logged in." The handler itself does not need additional tightening because the query is already scoped to `ctx.userId`.

**Rationale**:
- The feature applies to every role that can open a register (FR-005). All three roles can.
- The query result is the caller's own data — there is no cross-user disclosure risk. The matrix rule "any authenticated user" is appropriate.
- Mirroring the shape of existing `cash:getCurrent` registration in [cash.ipc.ts:15](../../src/main/ipc/cash.ipc.ts#L15) keeps the IPC surface uniform.

**Alternatives considered**:
- *Skip `registerAuthorized` and use a plain `ipcMain.handle`* — rejected; every authenticated channel in this codebase goes through the guard (per feature 001). Bypassing it for one new channel breaks the audit pattern and would fail review.

---

## Decision 4 — Deep-linking into the close-register flow

**Decision**: The shortcut button in the blocked-logout modal does two things, in order: (1) calls `useCashStore.getState().setRegister(register)` to hydrate the renderer cache with the user's open register, (2) navigates to `/caja/cierre` via React Router. The existing [CierreCajaPage.tsx:14](../../src/renderer/src/modules/caja/CierreCajaPage.tsx#L14) reads from `useCashStore` and works unchanged.

**Rationale**:
- The close-register page already supports the "open register exists in the store → close it" flow. By hydrating the store before navigation, we satisfy FR-003 (no extra selection step) without modifying the page (FR-011).
- The hydrate-then-navigate pair runs synchronously after the IPC returns — no race between the page mounting and the store populating.

**Alternatives considered**:
- *Pass the register id as a URL search param and have CierreCajaPage fetch by id* — rejected; modifies the close-register page (violates FR-011) and adds a redundant fetch since we already have the register object from the guard query.
- *Open the close-register flow in a modal instead of navigating* — rejected; the page is non-trivial (counted cash entry, notes, summary) and forcing it into a modal is a UI regression. Navigation is the path users already know.

---

## Decision 5 — Behavior on IPC / data failure

**Decision**: If `window.api.cash.getMyOpenRegister()` rejects or throws, the modal opens in an error state with the message "No se pudo verificar el estado de la caja. Reintentar." and a single "Reintentar" button that re-runs the check. The logout is **not** proceeded with. There is no "ignore and log out anyway" affordance.

**Rationale**:
- Per FR-008, the failure mode must be fail-closed. Audit integrity is non-recoverable; a stuck session is trivially recoverable (the user retries, or in the worst case force-quits the app, after which the next sign-in surfaces the same reminder per FR-007).
- A single retry button keeps the UX simple. If repeated failures occur, that is a real bug worth surfacing to the user, not papering over with a bypass.

**Alternatives considered**:
- *Show a "logout anyway" escape hatch after N retries* — rejected; defeats the feature's purpose. Operators who genuinely need to bypass would have to quit the app at the OS level, which is the correct fallback.

---

## Decision 6 — Idle timeout & switch-user scope

**Decision**: Inspection of the renderer (see Phase 0 exploration in the plan summary) found no idle-timeout handler and no "switch user" button in the current codebase. The plan therefore covers only the three existing logout entry points: [Header.tsx:93](../../src/renderer/src/components/Header.tsx#L93), [Sidebar.tsx:218](../../src/renderer/src/components/Sidebar.tsx#L218), [Sidebar.tsx:244](../../src/renderer/src/components/Sidebar.tsx#L244). FR-007 is satisfied today because no other path exists.

A docstring comment on `requestLogout` documents the invariant: *"Every UI path that terminates the session must call this function instead of `auth.store.logout()` directly. If you are adding an idle timeout or switch-user flow, route it through here."*

**Rationale**:
- We do not invent surfaces (idle, switch-user) that the app does not have. If they are added later, the comment is the enforcement point for the next reviewer.

---

## Resolved unknowns

All NEEDS-CLARIFICATION items: none in spec. All design questions implicit in the spec are answered above. Phase 1 design can proceed.
