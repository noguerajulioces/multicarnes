<!-- SPECKIT START -->
Active feature: **004-logout-cash-close** — block logout when the signed-in
user owns an open cash register, with a one-click shortcut into the existing
close-register flow. Per-user IPC query (`cash:getMyOpenRegister`) scoped to
`ctx.userId`, a `useLogoutGuard` hook that gates `auth.store.logout()`, and a
shared `LogoutBlockedModal`. No schema change; no new dependencies.

Plan: [specs/004-logout-cash-close/plan.md](specs/004-logout-cash-close/plan.md).
Spec: [specs/004-logout-cash-close/spec.md](specs/004-logout-cash-close/spec.md).

Prior feature (landed): **003-cash-movements-history** — "Movimientos de Caja"
page with server-side pagination, role-aware filters, append-only voiding,
and Excel export. Backed by an additive `cash_movements` migration (v7) plus a
one-time backfill of synthetic opening/closing rows.
Reference: [specs/003-cash-movements-history/](specs/003-cash-movements-history/).

Earlier feature (landed): **002-review-fixes** — three correctness fixes from
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
