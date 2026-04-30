# v1.5 — Backlog

> Captured 2026-04-30 after v1.4.0 shipped. Pulls together the deferred sub-items from V1_4_PLAN A.1/A.2 plus maintenance items that surfaced during the v1.3.0 → v1.4.0 cycle.
>
> v1.4.0 is in production; A.1 (password policy on register/change/reset), A.2 (layout snapshot/history + server guard), and B.1 (logger leads with cause) are done. The items below are the loose ends from those threads + housekeeping.

## A — Auth follow-throughs

### A.1.b — Login soft-nudge for users with policy-violating passwords

The v1.4 password policy is enforced on register / changePassword / resetPassword but **not** on login (existing users with old weaker passwords must still be able to sign in). Plan A.1 specified a soft warning post-login when `validatePassword` flags the existing password — this got deferred to keep PR #293 focused.

What ships:
- `auth.login` validates `input.password` against the policy after a successful `verify()`. Adds `passwordPolicyViolated: boolean` to the response (when `requiresTwoFactor` is false).
- `auth.verifyTwoFactor` does the same. Tricky: the 2FA flow doesn't carry the plaintext password between login and verify. Two options:
  1. Keep the plaintext in a short-lived in-memory map keyed on the temp 2FA challenge id (security: 10-min TTL matches `AUTH_EXPIRY.TWO_FACTOR_CODE`).
  2. Skip the soft-nudge on 2FA users (they'll see it the next non-2FA login, which never happens for 2FA-enabled accounts — so really skip).
  Pick option 2 unless we want the nudge to reach 2FA users. Document the choice.
- Frontend `useBackendAuth.login` returns the flag. `LoginPage` shows a one-shot toast ("Sua senha não atende aos novos requisitos. Trocar agora?" with a CTA navigating to Settings → Security) when the flag is true. Don't repeat per-session.
- i18n: `auth.passwordPolicy.softNudge.{title,body,changeNow,laterCta}` in en/pt/es/fr.
- Tests: `auth.router` test that login returns the flag for a weak password and not for a strong one. Frontend `LoginPage` test: nudge toast renders when flag is true, doesn't render when false.

**Effort**: ~2-3h. **Risk**: low. **Visible**: yes (only to users with weak passwords, one-shot per login).

## B — Layout durability follow-throughs

### B.1 — Snapshot list + restore UI in Settings

Backend has `layout.listSnapshots` + `layout.restoreSnapshot` from #293 but no frontend yet. Without UI the recovery is dev-only.

What ships:
- New "Layouts" section under Settings → Data tab (alongside the kline storage block from v1.2). Renders list of snapshots: `<SnapshotAt> · <Tab count> tabs · <Layout count> presets`. Click → preview side panel showing parsed tabs/presets summary. "Restore" CTA → confirmation dialog → calls `layout.restoreSnapshot.mutate({ snapshotId })`.
- After restore, `useLayoutStore.getState().hydrate(...)` re-runs from the new authoritative state in the DB so the in-memory store stays in sync without a reload.
- Empty state: `<EmptyState>` ("No snapshots yet — they're created automatically once a day when the layout changes").
- i18n: `settings.data.layouts.{title,description,empty,restore,restoreConfirmTitle,restoreConfirmBody,restored,restoreFailed,tabsCount,presetsCount,snapshotAt}` in en/pt/es/fr.
- Tests: component test that lists snapshots, opens preview, calls restoreMutation on confirm; mocks `trpc.layout.listSnapshots.useQuery` + `restoreSnapshot.useMutation`.

**Effort**: ~3-4h. **Risk**: low. **Visible**: yes (Settings tab, optional path).

### B.2 — Audit log of layout writes

Tracks every `user_layouts.save` so any future overwrite can be correlated with the release that caused it. Doesn't restore data — that's what B.1 is for — but tells us *when* the write happened and from where.

What ships:
- New `user_layouts_audit` table: `(id serial, user_id, prev_data_hash varchar(64), new_data_hash varchar(64), source varchar(64), client_version varchar(20), ts timestamp)`. Hash with sha256 over `data` strings (cheap, stable).
- `layout.save` writes a row on every successful save. Source defaults to `'renderer'`; future clients can override (e.g. `'mcp'`, `'cli'`).
- Retention: 90 days. Pruned on write (same pattern as `userLayoutsHistory`).
- No UI. Read via `psql` or future support tooling.
- Tests: 3 router tests covering audit row created, hash differs from prior, retention prune.

**Effort**: ~1h. **Risk**: zero. **Visible**: no (operational only).

### B.3 — Postgres `archive_mode=on` + WAL archiving

Infra change in `docker-compose.yml` (and the user's local PG, if running outside docker) so future incidents are PITR-recoverable. Out of app scope but documented here so it's not lost.

What ships:
- `docker-compose.yml` postgres service: `command: postgres -c archive_mode=on -c archive_command='cp %p /var/lib/postgresql/wal_archive/%f' -c wal_level=replica`. Mount `wal_archive` as a separate named volume.
- `docs/RELEASE_PROCESS.md` (or new `docs/INFRA_RECOVERY.md`) section: "How to PITR recover a row" — point-in-time-recovery walk-through for the `user_layouts` data-loss case.
- Disk usage note: WAL archive grows ~10-50MB/day for this workload. Add a cron in the doc for weekly prune of >30-day archives.

**Effort**: ~1h infra + ~30min docs. **Risk**: low (additive). **Visible**: no.

## C — Maintenance / housekeeping

### C.1 — `MEMORY.md` consolidation (currently 219 lines, limit 200)

The auto-memory index has grown past the 200-line cap that gets loaded into context at conversation start. Lines 200+ were truncated during this session's load, which means agents starting fresh miss the tail. Each entry should be one line under ~150 chars per the auto-memory spec.

What ships:
- Audit each entry; merge or split detail topic files where the index has bled into descriptions.
- Move long descriptions into the underlying `*.md` file each entry points at; keep the index line tight.
- Target: under 180 lines.
- Validate by reading the truncated portion at lines 200-219 to confirm no critical info was load-blocked during this session.

**Effort**: ~30min. **Risk**: zero (memory only). **Visible**: no.

### C.2 — Move `V1_4_PLAN.md` into `docs/archive/`

A.1 / A.2 / B.1 all shipped in v1.4.0. The plan file is stale; archive with completion markers per the `V1_5_PLAN` precedent (`Shipped: A.1 #293, A.2 #293, B.1 #293`). Pairs naturally with this PR — the new live plan is V1_5_PLAN, the old one moves out.

**Effort**: ~5min. **Risk**: zero.

## D — Optional / observation-driven

### D.1 — Trade_executions error post-mortem (only if it reappears)

The user pasted a `Failed query: select ... from trade_executions where (symbol = $1 and status = $2) | params: SOLUSDT,open` log line during this session. Cause was truncated past the 500-char cap; the B.1 fix should now expose it.

What to do:
- If the error reappears after v1.4.0 ships, the log will now lead with the postgres error code (e.g. `57P01 terminating connection due to administrator command`).
- Most likely a transient connection drop during backend restart — `binance-price-stream.ts:245 getOpenExecutionsForSymbol` runs on every price tick for active symbols and races a backend restart.
- Fix would be: pool-level retry on `57P01` / `08006` / `08001` codes (1-2 retries with 100ms backoff). Or just guard the call site with a try/catch that logs at `debug` instead of `error` for known-transient codes.

**Trigger**: re-observe with v1.4.0+ logs to confirm the cause class. Don't speculate further until the data lands.

## E — Sequencing

Proposed order:
1. C.2 (archive V1_4_PLAN — bundled with this PR)
2. C.1 (MEMORY.md trim — cheap, eliminates a context-loss hazard)
3. B.2 (audit log — 1h, gives observability for any future incident)
4. A.1.b (login soft-nudge — most user-visible)
5. B.1 (snapshots UI — biggest user-visible payoff)
6. B.3 (postgres archive_mode — infra, ship when comfortable)

Skip D.1 unless the error reappears.

## F — Acceptance

A v1.5 phase is "done" when:
- The deliverable lands on develop with green CI
- `pnpm test` passes (currently 5,449 backend + 2,279 unit + 108 browser + 11 utils + 722 indicators ≈ 8,569 total)
- Type-check + lint clean across all workspaces
- Audit script (`scripts/audit-shade-literals.mjs`) reports 0 forbidden patterns
