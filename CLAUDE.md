<!-- SPECKIT START -->
Active feature: **003-cash-movements-history** — new "Movimientos de Caja"
page with server-side pagination, role-aware filters, append-only voiding,
and Excel export. Backed by an additive `cash_movements` migration (v7)
that broadens the `type` CHECK and adds a `void_of` linkage, plus a one-time
backfill of synthetic opening/closing rows from existing `cash_registers`.

Plan: [specs/003-cash-movements-history/plan.md](specs/003-cash-movements-history/plan.md).
Spec: [specs/003-cash-movements-history/spec.md](specs/003-cash-movements-history/spec.md).

Prior feature (landed): **002-review-fixes** — three correctness fixes
surfaced by the round-2 code review (held tickets per-cashier, purchase
reception audit attribution, mixed-payment cancellation UX) plus two
medium-severity fold-ins (cancelPurchaseOrder transaction, recovery-mode
atomicity). Reference: [specs/002-review-fixes/](specs/002-review-fixes/).

Earlier feature (landed): **001-ipc-authorization** — server-side
authorization for privileged operations (US1–US5 + Round-2 P2/P3/P5/P6/P7/P8/P9
cleanups). All implementation tasks landed; manual quickstart Tests 1–9 are
deferred until QA can run them against a live build.
Reference: [specs/001-ipc-authorization/](specs/001-ipc-authorization/).

Project-wide context:
- Stack: Electron 39 + React 19 + TypeScript 5.9 + Tailwind v4, better-sqlite3, Zustand.
  See [.specify/memory/constitution.md](.specify/memory/constitution.md) for the
  full set of locked-stack rules and engineering principles (v1.1.0).
- Codebase inventory: [.specify/memory/functional-spec.md](.specify/memory/functional-spec.md).
- Known gaps & risk register: [.specify/memory/gap-analysis.md](.specify/memory/gap-analysis.md).
- All committed docs (README, docs/*.md, specs) are written in English.
<!-- SPECKIT END -->
