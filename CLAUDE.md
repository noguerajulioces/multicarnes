<!-- SPECKIT START -->
Active feature: **002-review-fixes** — three correctness fixes surfaced
by the round-2 code review (held tickets per-cashier, purchase reception
audit attribution, mixed-payment cancellation UX) plus two medium-severity
fold-ins (cancelPurchaseOrder transaction, recovery-mode atomicity).

Plan: [specs/002-review-fixes/plan.md](specs/002-review-fixes/plan.md).
Spec: [specs/002-review-fixes/spec.md](specs/002-review-fixes/spec.md).

Prior feature (landed): **001-ipc-authorization** — server-side authorization
for privileged operations (US1–US5 + Round-2 gap-analysis P2/P3/P5/P6/P7/P8/P9
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
