<!-- SPECKIT START -->
Active feature: **006-notif-read-state** — header notification dropdown gains
a per-user "read" state with inbox semantics: the dropdown lists only rows
with unread alerts, "marks as read" when the dropdown closes, and renders
"Sin notificaciones pendientes" once everything is read. The bell badge
silences after the close and re-lights only when a *new* entity enters the
alert set (a new debtor customer or a new product below min stock).
Renderer-only: `useNotificationStore`
(`src/renderer/src/store/notifications.store.ts`) persists seen IDs to
`localStorage` under `notif:seen:<userId>:<category>` and exposes
`selectUnseenCount` / `selectUnseenForCategory` consumed by
`NotificationBell` in `Header.tsx`. No SQLite migration, no new IPC channels,
no new dependencies.

Plan: [specs/006-notif-read-state/plan.md](specs/006-notif-read-state/plan.md).
Spec: [specs/006-notif-read-state/spec.md](specs/006-notif-read-state/spec.md).

Prior feature: **005-promotional-pricing** — per-product promo price managed
by Admin/Supervisor and consumed automatically by the POS. Five additive
columns on `products` (toggle, fixed-Gs or %-off, optional date range), a
pure `isPromoActive(product, now)` decision in `src/renderer/src/lib/promo.ts`,
cart lines snapshot the price at add-to-cart, and the receipt prints an
"Ahorrás" totals line when any line was sold under promo. Additive migration
v8; no new IPC channels; reuses existing `products:*` and `action_logs`.
Reference: [specs/005-promotional-pricing/](specs/005-promotional-pricing/).

Earlier feature: **004-logout-cash-close** — block logout when the signed-in
user owns an open cash register, with a one-click shortcut into the existing
close-register flow. Per-user IPC query (`cash:getMyOpenRegister`) scoped to
`ctx.userId`, a `useLogoutGuard` hook that gates `auth.store.logout()`, and a
shared `LogoutBlockedModal`. No schema change; no new dependencies.
Reference: [specs/004-logout-cash-close/](specs/004-logout-cash-close/).

Earlier landed feature: **003-cash-movements-history** — "Movimientos de Caja"
page with server-side pagination, role-aware filters, append-only voiding,
and Excel export. Backed by an additive `cash_movements` migration (v7) plus a
one-time backfill of synthetic opening/closing rows.
Reference: [specs/003-cash-movements-history/](specs/003-cash-movements-history/).

Even earlier (landed): **002-review-fixes** — three correctness fixes from
the round-2 code review (held tickets per-cashier, purchase reception audit
attribution, mixed-payment cancellation UX) plus two fold-ins.
Reference: [specs/002-review-fixes/](specs/002-review-fixes/).

Earliest landed feature: **001-ipc-authorization** — server-side authorization
for privileged operations (US1–US5 + Round-2 cleanups). Manual quickstart
Tests 1–9 deferred until QA runs them against a live build.
Reference: [specs/001-ipc-authorization/](specs/001-ipc-authorization/).

Project-wide context:
- Stack: Electron 39 + React 19 + TypeScript 5.9 + Tailwind v4, better-sqlite3, Zustand.
  See [.specify/memory/constitution.md](.specify/memory/constitution.md) for the
  full set of locked-stack rules and engineering principles (v1.1.0).
- Codebase inventory: [.specify/memory/functional-spec.md](.specify/memory/functional-spec.md).
- Known gaps & risk register: [.specify/memory/gap-analysis.md](.specify/memory/gap-analysis.md).
- All committed docs (README, docs/*.md, specs) are written in English.
<!-- SPECKIT END -->
