<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR. Two principles materially expanded — Principle I now
enumerates the additional production deps that were already shipping
(documenting reality, not approving anything new); Principle V now formally
allows renderer-side report generation (xlsx, jsPDF) under stated conditions,
reconciling the constitution with the existing codebase.

Modified principles:
  - Principle I (Locked Technology Stack) — appended already-shipping packages
  - Principle V (Isolated Hardware & Reporting Services) — split rules so
    thermal printer logic stays in main, but report formatters MAY live in
    the renderer when no untrusted input crosses the formatter boundary

Added sections: (none)
Removed sections: (none)

Templates requiring updates: ✅ no action

Follow-up TODOs: (none)

Previous version history:
  1.0.0 (2026-05-08) — Initial ratification.
-->

# POS Multicarnes Constitution

## Core Principles

### I. Locked Technology Stack

The project's technology choices are fixed. The approved stack is:
Electron + electron-vite (desktop shell), React 19 + TypeScript + Tailwind CSS 4
(UI), Zustand (state), React Router DOM (routing), better-sqlite3 (database),
bcryptjs (PIN hashing), node-thermal-printer (printing), xlsx + jsPDF (reports),
and electron-builder (packaging).

The following packages are also part of the approved baseline (added in v1.1.0
to document already-shipping dependencies; their inclusion records reality
rather than approving anything new):

- `recharts` — dashboard charts (sales bar chart, top-products donut)
- `@reactour/tour` — guided onboarding tours (per-page)
- `date-fns` — date formatting and arithmetic helpers
- `lucide-react` — icon set used across the UI
- `clsx` + `tailwind-merge` — className composition for Tailwind
- `@fontsource/inter` — UI font embedded with the bundle

Rules:

- New runtime or build dependencies MUST NOT be added without an explicit written
  justification covering: the problem it solves, why no existing dependency suffices,
  and bundle/security impact. The justification MUST be approved by the project owner
  before installation.
- Replacing or upgrading a major framework version (Electron, React, Tailwind, etc.)
  is a MAJOR-level decision and requires the same approval gate.
- Removing a stack component is also gated; nothing on this list may be silently
  swapped out.

**Rationale:** This is a production POS deployed to retail hardware. Each new
dependency expands the attack surface, the bundle size shipped to thermal-printer
hosts, and the maintenance burden on a single-maintainer codebase. Stack stability
is a feature, not a constraint to route around.

### II. Strict Typing & Single-Responsibility Components

TypeScript MUST run in strict mode with `noImplicitAny` enforced. Any code that
silences the type system (`any`, `as unknown as`, `// @ts-ignore`,
`// @ts-expect-error`) MUST be accompanied by a comment explaining the constraint
and SHOULD be removed at the earliest opportunity.

React components MUST be small and single-responsibility. A component that mixes
data fetching, state mutation, formatting, and presentation MUST be split. UI
components SHOULD remain presentational; orchestration belongs in hooks, stores,
or services.

Zustand stores MUST be scoped per domain (e.g., auth, sales, inventory, settings).
A single global mega-store is prohibited. Cross-store coordination MUST happen
through explicit calls between stores or via selectors, not by collapsing them.

**Rationale:** Strict types catch the class of bugs that bite hardest in retail
software (silent number/string coercions on prices, undefined IDs on prints).
Small components and scoped stores keep cognitive load low for a small team and
make regressions in one domain less likely to ripple into another.

### III. Layered Data Access (Repository Pattern)

All SQLite access MUST go through a dedicated service or repository module.
React components, hooks, Zustand stores, and IPC handlers MUST NOT call
better-sqlite3 directly.

Rules:

- Repository/service modules own SQL strings, prepared statements, and result
  shaping into typed domain objects.
- Callers receive typed domain objects, never raw rows.
- Schema knowledge (column names, joins) MUST NOT leak outside the repository
  layer.

**Rationale:** Centralizing DB access is the only realistic way to evolve the
schema safely, audit query patterns for performance, and keep the renderer
honest about the main/renderer boundary.

### IV. Main/Renderer Boundary Integrity

The Electron main process and renderer process MUST remain separate. The
renderer MUST NOT import Node.js APIs, better-sqlite3, node-thermal-printer,
the filesystem, child_process, or any other main-only module directly.

All renderer access to main-process capabilities MUST flow through the preload
bridge using a typed, explicitly-listed IPC surface. Each new capability
exposed to the renderer requires:

1. A handler registered in main.
2. A typed function exposed via preload's `contextBridge`.
3. A matching type definition consumed by the renderer.

`nodeIntegration` MUST remain disabled and `contextIsolation` MUST remain enabled.

**Rationale:** This boundary is the application's primary security control. A
renderer with direct Node access turns every XSS or compromised dependency into
a full local-machine compromise on a POS terminal that handles cash and customer
data.

### V. Isolated Hardware & Reporting Services

Thermal printer logic and report generation MUST live in dedicated service
modules. Hardware always goes in the main process; report formatters (xlsx,
jsPDF) MAY live in the renderer under the conditions in V.b.

#### V.a — Hardware (main process only)

- Thermal-printer logic MUST live in main-process services. Business code
  MUST NOT speak to `node-thermal-printer` directly.
- A feature MUST call the printer service by intent
  (`printSaleReceipt(sale)`), not by assembling ESC/POS primitives inline.
- The printer service owns device discovery, connection, retry, and error
  surfacing.

#### V.b — Report formatters (renderer permitted)

- Report formatters (xlsx, jsPDF) MAY live in the renderer (e.g.,
  `src/renderer/src/lib/export.ts`, `src/renderer/src/lib/ticket-pdf.ts`)
  provided:
  1. They take plain data in and return blobs / strings / buffers out — no
     UI or state imports.
  2. No untrusted input crosses the formatter boundary. Today every input
     comes from the local SQLite DB; merchant-entered free-text fields
     (notes, customer names) are rendered as text by these libraries, not
     evaluated.
  3. A future change that introduces external or attacker-controllable
     input MUST move the formatter back to main behind an IPC channel.
- A feature MUST still call the formatter by intent
  (`exportInventoryToXlsx(rows)`), not by assembling spreadsheet or PDF
  primitives inline at the call site.

**Rationale (hardware):** Hardware behavior (paper out, port disconnects,
encoding quirks) is the noisiest source of regressions in this app.
Isolating it means a printer firmware change is a one-file blast radius.

**Rationale (renderer-side reports):** xlsx and jsPDF are pure CPU work over
trusted internal data. Moving them to main would require a new IPC surface,
serialization of ~MB-sized buffers, and retesting every export path for
zero functional gain. The cost of refactoring outweighs the security benefit
because the only inputs are fields the renderer already controls. The "no
untrusted input" rule above is the gate that prevents this from becoming a
free pass: any introduction of external input flips the formatter back to
main-only.

### VI. Schema Evolution via Migrations & Feature Preservation

Existing working features MUST NOT be modified opportunistically. Changes to a
working feature require either (a) a defect being fixed, or (b) an explicit task
to evolve that feature — drive-by edits are prohibited.

The SQLite schema MUST NOT be changed in a way that breaks existing data or
existing queries without:

1. A documented migration plan covering schema diff, data backfill, and rollback.
2. The migration applied through code that runs on app start, idempotent, and
   versioned.
3. Verification that existing repositories still work against the migrated
   schema.

Destructive migrations (drop column, drop table, narrow type) require explicit
approval and a backup step.

**Rationale:** This is a deployed POS with real merchant data on customer
machines. A schema change that loses sales history or breaks a printed receipt
template is not recoverable from the developer's machine. Migrations are the
contract that lets the schema evolve without that risk.

### VII. Simplicity, Approval & Non-Regression

Prefer simple, direct solutions over clever or generic ones. Add abstraction
only when a concrete second use case demands it; three similar lines is better
than a premature abstraction.

When in doubt — about scope, schema impact, IPC surface, dependency choice, or
whether a change touches a working feature — STOP and ask the project owner
before implementing. Speculative work is more expensive than a clarifying
question.

A change MUST NOT be merged if it knowingly degrades an existing working
feature. If a regression is unavoidable to ship a higher-priority change, it
MUST be called out explicitly and approved.

**Rationale:** This codebase is maintained by a small team with no automated
test suite covering hardware paths. Simplicity and explicit approval are the
substitutes for the safety net a larger test infrastructure would otherwise
provide.

## Technology Stack Constraints

The stack listed in Principle I is the complete approved surface. The following
operational constraints reinforce it:

- The `dependencies` and `devDependencies` lists in `package.json` are the source
  of truth. PRs that add to either list MUST link to the approval that justified
  the addition.
- Native modules (better-sqlite3, node-thermal-printer) MUST be rebuilt for
  Electron via the existing `postinstall` hook; do not introduce alternative
  native module workflows.
- Bundling and packaging MUST go through electron-vite (dev/build) and
  electron-builder (distribution). Custom packaging scripts that bypass these
  tools are prohibited.
- Folder structure under `src/` (`main/`, `preload/`, `renderer/`, `shared/`,
  `assets/`) MUST NOT be reorganized without prior agreement. New code goes into
  the correct existing process directory.

## Development Workflow & Quality Gates

The following gates MUST pass on every change before it is considered complete:

- `npm run typecheck` (both `typecheck:node` and `typecheck:web`) passes with
  zero errors.
- `npm run lint` passes with zero errors. Warnings SHOULD be addressed; net-new
  warnings introduced by a change MUST be addressed.
- The application starts under `npm run dev` and the touched feature works
  end-to-end on the developer's machine, including any thermal printer or
  report path the change exercises.
- Database changes have been exercised against a fresh database AND against an
  existing database (migration path).

Documentation rules:

- Committed documentation (README, `docs/**/*.md`, spec files) MUST be written
  in English even when discussion happens in other languages.
- User-facing UI strings MAY be in the deployment locale (Spanish for this
  project) and remain so unless an i18n initiative is approved.

Release rules:

- Versioning of the application follows the existing `release-it` +
  conventional-changelog flow. Constitution version (this document) is
  independent of application version and is governed below.

## Governance

This constitution is the highest-authority document for engineering decisions in
this repository. Any practice, code review comment, or AI-assisted suggestion
that conflicts with it MUST defer to the constitution unless the constitution is
amended first.

Amendment procedure:

1. Propose the change as a PR that edits this file and includes a Sync Impact
   Report comment at the top.
2. Justify the version bump (MAJOR / MINOR / PATCH) per the rules below.
3. Update any dependent templates or runtime guidance flagged in the report.
4. Obtain approval from the project owner.
5. Merge; the merge commit's date becomes `LAST_AMENDED_DATE`.

Versioning policy for this document:

- **MAJOR**: A principle is removed, redefined incompatibly, or governance is
  restructured in a way that invalidates prior decisions.
- **MINOR**: A new principle or section is added, or existing guidance is
  materially expanded.
- **PATCH**: Wording, clarification, formatting, or non-semantic refinements.

Compliance review:

- Code reviewers MUST treat constitution principles as review criteria. PRs that
  violate a principle without an accompanying amendment MUST be revised or
  rejected.
- Periodically (at least once per minor application release), the project owner
  SHOULD scan recent changes for drift and either correct the drift or amend
  the constitution to reflect intentional evolution.

**Version**: 1.1.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
