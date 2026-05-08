# Research — Server-side Authorization

Eleven decisions taken in Phase 0. Each is recorded with the choice, why it won, and the alternatives considered and rejected.

---

## R1. Identity binding at the IPC boundary

**Decision**: Identity is bound to the Electron `webContents.id` of the sender. On a successful `users:login`, the main process records `senderId → { userId, loginAt }` in an in-memory map. Every subsequent privileged call uses `event.sender.id` (which the renderer cannot forge) to look up the caller's user id, then re-resolves the role from the `users` table at decision time.

**Rationale**: A POS terminal has exactly one renderer process. The `event.sender.id` is set by the Electron main process from the OS-level webContents handle and is not addressable from renderer code — even malicious renderer code cannot supply a different sender id. This gives us a forge-proof anchor without introducing tokens, cookies, or signed envelopes.

**Alternatives rejected**:
- *Pass `userId` from renderer with every IPC call* — relies on caller cooperation, which is exactly what we're hardening against.
- *Hybrid (caller passes id; main verifies it matches a session map)* — strictly weaker than the chosen design (the caller-supplied field is dead code) and adds noise in every IPC payload.
- *Signed token in the renderer* — overkill for a single-process desktop app and adds a key-management problem.

---

## R2. Authorization matrix location

**Decision**: A TypeScript `Record<string, AuthRule>` exported from `src/main/auth/matrix.ts`. One file. Compile-time type checked. Reviewed in PRs.

**Rationale**: FR-007 requires the matrix to be reviewable in a single artifact. A TS object literal gives us (a) compile-time type checking on rule shapes, (b) a single PR-reviewable diff for any change, (c) zero runtime parse cost. It ships with the binary, so a runtime tamper attempt cannot mutate it without modifying signed code.

**Alternatives rejected**:
- *JSON file* — loses type checking; tampering would not be caught by the build.
- *Database table editable by admins* — admins could lock themselves out by misconfiguration; complicates recovery; runtime mutability is a footgun for a security-critical artifact.
- *Per-IPC-file inline rule* — fails FR-007 (matrix must be reviewable in one place).

---

## R3. Handler-wrapping strategy

**Decision**: A `registerAuthorized(channel, rule, handler)` helper in `src/main/auth/guard.ts` that wraps `ipcMain.handle`. Each `register*Ipc()` function in `src/main/ipc/*.ipc.ts` switches its calls to use this helper. The helper:

1. Reads `event.sender.id`.
2. Looks up the session.
3. Re-resolves the user from the DB.
4. Evaluates the rule.
5. Persists an `AuthAuditEntry`.
6. On success: invokes the original handler with `(event, ctx, ...args)` where `ctx = { userId, role }`.
7. On rejection: throws an `AuthError` with the outcome code; the renderer translates this into a toast.

**Rationale**: Minimum diff. Every existing handler keeps its signature (the new `ctx` is additive and ignored by handlers that don't use it). Failures are uniform — no chance of forgetting to write a check. The helper is the only place that calls `event.sender`.

**Alternatives rejected**:
- *Central interceptor patching `ipcMain.handle`* — brittle; fights the API; surprises future readers.
- *Decorators on handler functions* — Electron's `ipcMain.handle` is a function call, not a class method; decorators don't fit.
- *Per-handler manual checks* — 81 places to forget. Fails closed only if every developer remembers; that's the bug class we're trying to eliminate.

---

## R4. Audit table design

**Decision**: A new dedicated table `auth_audit` with structured columns:

```sql
CREATE TABLE auth_audit (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  operation          TEXT    NOT NULL,
  claimed_user_id    INTEGER,
  resolved_user_id   INTEGER,
  resolved_role      TEXT,
  outcome            TEXT    NOT NULL CHECK(outcome IN
                       ('allowed','blocked-no-user','blocked-inactive','blocked-insufficient-role')),
  sender_id          INTEGER,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_auth_audit_user_time_outcome
  ON auth_audit(claimed_user_id, created_at, outcome);
```

**Rationale**: The repeated-failure detection rule (FR-018) requires an indexed query of `(user, time-window, outcome)`. Stuffing structured fields into the existing `action_logs.details` JSON would make this query a table scan. Per FR-017, the structured fields are also the audit contract for incident review — reading them from JSON is unergonomic.

**Alternatives rejected**:
- *Reuse `action_logs(action TEXT, details TEXT)`* — see above; no efficient index for the rate-limit query, less type safety, mixes free-form events with structured ones.
- *Separate tables per outcome* — overkill; queries cross outcomes for rate-limiting.

---

## R5. Alert surfacing — pull on dashboard load

**Decision**: A second table `auth_alert_acks(id, user_id, window_start, acknowledged_at)`. The dashboard load triggers a query: "for each user, how many `blocked-*` rows exist in `auth_audit` in the last 10 minutes?" If any user has ≥5 and there is no matching `auth_alert_acks` row marked acknowledged for that window, an alert is returned. Acknowledgment writes the `acknowledged_at` timestamp.

**Rationale**: FR-018 requires the alert to be "visible to administrators on dashboard load and persists until acknowledged" — this is a pull pattern by definition. Pull keeps the audit-write path fast (single INSERT, no fan-out). The 10-minute window is computed via index range scan in <1 ms.

**Alternatives rejected**:
- *OS notification on the 5th failure* — duplicates the channel (admins not at the terminal won't see it; admins at the terminal already see audit), adds toast spam if attacker brute-forces.
- *Dedicated long-poll channel* — overengineered for single-terminal usage.

---

## R6. Recovery flow detection

**Decision**: At app start (`src/main/index.ts`), after `initDatabase()`, run `SELECT COUNT(*) FROM users WHERE active = 1 AND role = 'admin'`. If 0, a flag `recoveryMode=true` is set in main and exposed via a new `auth:recoveryNeeded` IPC channel (public). The renderer reads it and routes to the existing first-run admin-creation flow.

**Rationale**: Reuses the existing first-run UX in [LoginPage.tsx:38, 118](../../src/renderer/src/modules/login/LoginPage.tsx). One additional admin-count check turns the same flow into a recovery flow. Closes automatically once an admin exists (FR-021).

**Alternatives rejected**:
- *Special "recovery PIN" baked at install time* — new piece of secret to lose; adds setup steps for the merchant.
- *Allow restore from backup as recovery* — explicitly out of scope per spec assumption ("Recovery scope: only creates the first admin").

---

## R7. Pre-login (public) surface

**Decision**: Exactly six channels are `public`:

| Channel | Why public |
|---|---|
| `users:getActive` | Login screen needs the active user list. Exposes only `id`, `name`, `role`. |
| `users:login` | Authentication itself. |
| `users:create` | Public **only when** `recoveryMode=true` (no active admin). The matrix encodes this with a special `recovery-only` modifier; otherwise admin-only. |
| `auth:recoveryNeeded` | Renderer queries it to decide whether to show recovery UI. |
| `settings:getAll` | Splash + login layout reads theme, business name, printer width. Returns only display-safe keys (filter at the handler). |
| `print:hasConfig` | Splash check. Returns boolean only. |
| `notify:show` | OS notification API; carries no DB state. |
| `window:minimize` / `window:maximizeToggle` / `window:close` / `window:isMaximized` | Window controls; no business state. |

Everything else is `privileged` or `self-only`. Failure-closed default applies (FR-008).

**Rationale**: A short, explicit allow-list is easier to audit than a "everything is public except…" list. Each item earned its public-ness with a written reason.

**Alternatives rejected**:
- *Allow all read operations pre-login* — violates Principle IV's spirit and exposes data via direct invocation.

---

## R8. `users:update` and `users:getById` — hybrid `self-or-roles` rule

**Decision**: Introduce a fourth rule kind `self-or-roles`. The handler must accept `targetUserId` as the first non-context arg; the guard allows the call if either:

- the resolved caller's role is in `roles`, OR
- the resolved caller's `userId === targetUserId`.

This covers both:
- A user editing their own PIN (today's `PerfilPage.tsx` flow) → matches as `self`.
- An admin editing any user → matches by role.

Handlers that update user records additionally enforce field-level rules: a self-only caller can only change `pin_hash` (PIN change), not `role` or `active`. The guard does not enforce this — the handler validates the diff against the caller context.

**Rationale**: Avoids splitting `users:update` into two channels. Keeps the existing PerfilPage flow working without changes to the renderer (other than passing the target id, which it already does).

**Alternatives rejected**:
- *Split into `users:updateSelf` + `users:updateAny`* — doubles the surface; renderer must know which to call.
- *Always require admin* — breaks self-service PIN change (regression).

---

## R9. Testing posture

**Decision**: This feature ships **without** new test infrastructure. Validation is via:

1. A **startup self-test** (`src/main/auth/self-test.ts`) that runs after IPC handler registration and asserts every registered channel has a matrix entry. If a channel is missing, the app refuses to finish booting and surfaces an error dialog. This is the structural backstop for FR-008 (fail closed).
2. A **manual quickstart** ([quickstart.md](quickstart.md)) walking through every acceptance scenario from spec.md.
3. **Constitution-acknowledged debt**: gap analysis P4 is named explicitly in the spec as a separate, follow-up feature.

**Rationale**: Adding a test runner mid-feature pulls in tooling decisions (Vitest? Bun? Custom?) that are bigger than this feature. The startup self-test catches the highest-value bug class (forgot to gate a handler) without any new tooling. The quickstart preserves the feature's repeatable verification.

**Alternatives rejected**:
- *Block this feature on a real test runner* — couples two big changes; delays the security fix.
- *Skip the self-test* — re-introduces the bug class.

---

## R10. Performance

**Decision**: No caching. Re-resolve user from DB on every privileged call.

**Rationale**: SQLite primary-key SELECT on a tiny `users` table (<100 rows in practice) is sub-millisecond. WAL-mode INSERT to `auth_audit` is sub-millisecond. The combined per-call overhead is well under the 100 ms p95 budget (FR-023). Caching would add invalidation complexity and would let role demotions persist for the cache window — defeating FR-025 ("evaluated against the new role on the next call").

**Alternatives rejected**:
- *5-minute role cache* — saves ~1 ms per call; costs FR-025 freshness; adds invalidation edges (logout, role change, deactivate).

---

## R11. Migration shape

**Decision**: Extend the existing `runMigrations()` in [src/main/db/index.ts](../../src/main/db/index.ts) with two additive blocks:

```ts
// auth_audit
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name)
if (!tables.includes('auth_audit')) {
  db.exec(`CREATE TABLE auth_audit (...)`)
  db.exec(`CREATE INDEX idx_auth_audit_user_time_outcome ON auth_audit(...)`)
}
if (!tables.includes('auth_alert_acks')) {
  db.exec(`CREATE TABLE auth_alert_acks (...)`)
}
```

Plus a 90-day retention pass that runs once per app start (cheap):

```ts
db.prepare("DELETE FROM auth_audit WHERE created_at < datetime('now','-90 days')").run()
```

**Rationale**: Additive only. Re-runnable safely (the `IF NOT EXISTS` guard). Consistent with the project's current introspection-based migration style. Does not modify any existing column or table.

**Alternatives rejected**:
- *Introduce `schema_migrations` table now* — separate, larger feature (gap analysis P3). Out of scope here.
- *Run retention as a scheduled job* — a 90-day cleanup is fine to run at boot; the data volume is small and the deletion is a single index range scan.

---

*All NEEDS CLARIFICATION resolved. Proceed to Phase 1 design.*
