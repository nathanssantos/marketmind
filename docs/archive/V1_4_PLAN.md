# v1.4 — Backlog (archived)

> **Status:** All three core items shipped in v1.4.0 (PR #293).
>
> **Shipped**: A.1 password complexity (#293), A.2 layout snapshot/history + server guard (#293), B.1 logger leads with cause (#293).
>
> **Deferred to v1.5**: A.1 login soft-nudge → V1_5_PLAN A.1.b. A.2 audit log → V1_5_PLAN B.2. A.2 Postgres `archive_mode=on` → V1_5_PLAN B.3. A.2 frontend snapshot UI (was implicit, surfaced post-merge) → V1_5_PLAN B.1.
>
> See `docs/V1_5_PLAN.md` for the live plan.
>
> ---
>
> Captured during v1.3.1 work. Pulls together user-asked follow-ups + hardening items surfaced while diagnosing the v1.3.0 → v1.3.1 layout-loss regression.

## A — Auth hardening

### A.1 — Password complexity policy

**User request (2026-04-30):** require stronger passwords on signup, password change, and (optionally) prompt on login when an existing user's password violates the new policy.

Current state:
- Backend: `apps/backend/src/routers/auth.ts` validates only `z.string().min(8)`. No upper/lower/digit/symbol checks.
- Frontend: `LoginPage.tsx` / `RegisterPage.tsx` / `SecurityTab` (change password) inherit the same min-8 rule.

Proposal:
- Shared validator in `packages/utils` (or a new `packages/auth-policy`): `validatePassword(input)` returns `{ valid: boolean, issues: PasswordIssue[] }` where `PasswordIssue` is an enum of `tooShort`, `noUppercase`, `noLowercase`, `noDigit`, `noSymbol`, `commonPassword` (compare against a small built-in list — top 1k weak passwords).
- Default policy: min 10 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 symbol. Configurable via `apps/backend/src/constants/auth.ts`.
- Backend zod schemas use `.refine(validatePassword)` on:
  - `auth.register.input.password`
  - `auth.changePassword.input.newPassword`
  - `auth.resetPassword.input.password`
- Frontend mirrors the same checks for inline UX (live strength meter + per-rule checklist). Same shared validator → no drift.
- Login: do **not** block weak passwords (existing users may still be on the old policy); instead show a one-time soft warning + "Change password now" button after a successful login when `validatePassword` flags the existing password. No forced reset; nudge only.
- i18n: `auth.password.policy.{tooShort,noUppercase,noLowercase,noDigit,noSymbol,common}` keys in en/pt/es/fr.
- Tests: backend zod refine tests + frontend `LoginPage`/`RegisterPage`/`SecurityTab` strength-meter tests.

**Effort**: ~1 day. **Risk**: medium — touches active sign-up + change-password flows.

### A.2 — Layout/state durability hardening (post-incident)

After the layout-overwrite incident (data loss verified at 14:46 on 2026-04-30, no recovery possible because Postgres `wal_level=replica` + `archive_mode=off` + no app-level snapshot):

- **Daily snapshot of `user_layouts`** — small periodic job that copies the current row to `user_layouts_history` with `created_at` per snapshot. Cheap (rows are <2KB). Recoverable from any prior day. Add `auth.restoreLayoutSnapshot(snapshotId)` for self-service recovery.
- **Compare-then-write guard on layout save** — if the incoming `data` is the literal default state AND the existing row is non-default, refuse the write and log a warning. Belt-and-suspenders against any future regression that bypasses the in-memory `isHydrated` guard. Server-side defence.
- **Audit / write log** for `user_layouts.save` — write-once log: `(user_id, prev_data_hash, new_data_hash, source, timestamp)`. Doesn't restore the data but tells us when overwrites happen so we can correlate with releases.
- **Postgres archive mode** (infra) — flip `archive_mode=on` + WAL archiving so future incidents are PITR-recoverable. Out-of-app config change.

**Effort**: ~half-day for the snapshot+guard+audit, plus separate infra work. **Risk**: low.

## B — Logging hygiene

### B.1 — Drizzle "Failed query" cause is being truncated past the 500-char cap

`apps/backend/src/services/logger.ts:25` formats errors as `${error.message} (cause: ${causeStr})` and then truncates to 500 chars. `DrizzleQueryError.message` already contains the full SELECT statement (60+ columns for `trade_executions`), pushing the cause off the end of the string.

The cause is the only useful part — knowing "Failed query" tells us nothing without the underlying connection error / constraint violation / pool-exhaustion message.

Proposal: lead with the cause, then the query, so truncation drops the LEAST useful info first:
```
const msg = causeStr
  ? `${causeStr} | query: ${error.message}`
  : error.message;
```

Plus, special-case `DrizzleQueryError` to extract `cause.message` directly when present (don't rely on the generic `cause` formatting), so we get postgres error codes like `57P01 terminating connection due to administrator command`.

**Effort**: ~30 min. **Risk**: zero.

## C — Acceptance

A v1.4 phase is "done" when:
- The deliverable lands on develop with green CI
- Tests pass (`pnpm test`)
- Type-check + lint clean

Sequence proposed:
1. B.1 (logger fix — 30 min, easy win, immediately improves debuggability)
2. A.1 (password policy — most user-visible)
3. A.2 (layout durability — defense in depth, ship after the fix is soaked)
