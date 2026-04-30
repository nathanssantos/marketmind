# v1.5 — Backlog (rescued)

> Captured 2026-04-30 after v1.4.0 shipped. Rescued and consolidated from:
>
> - V1_4 follow-throughs (login soft-nudge, snapshot UI, audit log, archive_mode)
> - V1_3 deferred items (a11y, visual-review automation, package extraction)
> - V1_POST_RELEASE deferrals (mcp-trading, design tokens, ui extraction)
> - The BACKTEST_UI_PLAN that was deleted with #200 — Wave 0 shipped, waves 1–6 still pending
> - Maintenance items surfaced this session (MEMORY.md cap, log cause format already shipped)
>
> Order = highest user value first. Anything user-visible before infra; anything operationally cheap (audit log, MEMORY.md trim) interleaved between bigger items so the cadence stays even.

---

## A — Auth follow-throughs

### A.1.b — Login soft-nudge for users with policy-violating passwords
The v1.4 password policy is enforced on register / changePassword / resetPassword but **not** on login. Plan A.1 originally specified a soft warning post-login when `validatePassword` flags the existing password — deferred from #293 to keep the PR focused.

**What ships**:
- `auth.login` validates `input.password` against the policy after a successful `verify()`. Adds `passwordPolicyViolated: boolean` to the response.
- 2FA flow: skip the nudge (plaintext doesn't carry across the verify step; piping it would expand the threat surface). Document the choice.
- `useBackendAuth.login` returns the flag. `LoginPage` shows a one-shot toast with a "Trocar agora" CTA navigating to Settings → Security. Don't repeat per-session.
- i18n: `auth.passwordPolicy.softNudge.{title,body,changeNow,laterCta}` in en/pt/es/fr.
- Tests: `auth.router` returns flag for weak / not for strong; `LoginPage` toast renders when flag is true.

**Effort**: ~2-3h. **Risk**: low.

---

## B — Layout durability follow-throughs

### B.1 — Snapshot list + restore UI in Settings
Backend has `layout.listSnapshots` + `layout.restoreSnapshot` from #293 but no frontend yet. Without UI the recovery is dev-only.

**What ships**:
- New "Layouts" section under Settings → Data tab. Lists snapshots: `<SnapshotAt> · <Tab count> tabs · <Layout count> presets`. Click → preview side panel. "Restore" CTA → confirmation dialog → calls `layout.restoreSnapshot.mutate({ snapshotId })`.
- After restore, `useLayoutStore.getState().hydrate(...)` re-runs from the new authoritative state in the DB so the in-memory store stays in sync without a reload.
- Empty state: `<EmptyState>` ("No snapshots yet — they're created automatically once a day when the layout changes").
- i18n: `settings.data.layouts.{title,description,empty,restore,restoreConfirmTitle,restoreConfirmBody,restored,restoreFailed,tabsCount,presetsCount,snapshotAt}` in en/pt/es/fr.
- Tests: component test that lists, opens preview, calls restoreMutation on confirm.

**Effort**: ~3-4h. **Risk**: low.

### B.2 — Audit log of layout writes
Tracks every `user_layouts.save` so any future overwrite can be correlated with the release that caused it.

**What ships**:
- New `user_layouts_audit` table: `(id serial, user_id, prev_data_hash varchar(64), new_data_hash varchar(64), source varchar(64), client_version varchar(20), ts timestamp)`. SHA256 hash over data strings.
- `layout.save` writes a row on every successful save; `source` defaults to `'renderer'`.
- 90-day retention pruned on write.
- 3 router tests: audit row created, hash differs from prior, retention prune.

**Effort**: ~1h. **Risk**: zero.

### B.3 — Postgres `archive_mode=on` + WAL archiving
PITR-recoverable Postgres so future incidents (like the 2026-04-30 layout loss) can be recovered.

**What ships**:
- `docker-compose.yml` postgres service: `command: postgres -c archive_mode=on -c archive_command='cp %p /var/lib/postgresql/wal_archive/%f' -c wal_level=replica`. Mount `wal_archive` as a separate named volume.
- New `docs/INFRA_RECOVERY.md`: "How to PITR recover a row" walk-through for a `user_layouts` style data-loss case.
- Disk usage note: WAL archive ~10-50MB/day for this workload. Cron snippet for weekly prune of >30-day archives.

**Effort**: ~1h infra + ~30min docs. **Risk**: low.

---

## C — MCP capability extensions

### C.1 — `mcp-trading` server (deferred from V1_POST_RELEASE 5.6 / V1_3 E.2)
Concept doc lives at `docs/MCP_TRADING_CONCEPT.md`. Highest-impact MCP capability — moves real money — and the user explicitly asked for a deliberate enablement gesture.

**What ships**:
- New `packages/mcp-trading/` package mirroring the structure of `mcp-app` / `mcp-backend`.
- Tools (mirroring `apps/backend/src/routers/trading/`): `trading.place_order`, `trading.cancel_order`, `trading.close_position`, `trading.set_sl_tp`, `trading.list_orders`, `trading.list_positions`. All read-tools always available; write-tools gated.
- **Enablement toggle**: new `agentTradingEnabled: boolean` in user preferences, default `false`. Settings → Security → "AI Agent Trading" subsection with explicit confirm dialog (`"Allow MCP-connected agents to place real orders on your behalf? This affects real money."`). Toggle is per-wallet so it can be enabled for paper but not live.
- **Audit log**: new `mcp_trading_audit` table — `(id, user_id, wallet_id, tool, input_json, result_json, status, ts)`. Every write tool writes a row; user can review in Settings → Security → "AI Agent Activity".
- **Rate limit**: 30 writes/hour per wallet (enforced server-side via `@fastify/rate-limit`). 429 with retry-after.
- **Idempotency keys**: every write tool accepts an `idempotency_key` (UUID); duplicate keys return the prior result without re-executing.
- **Dry-run mode**: `dry_run: true` flag returns the projected order/position state without hitting the exchange.
- Per-package `README.md` covering threat model + tool schema. Update `docs/MCP_SERVERS.md` + `docs/MCP_AGENT_GUIDE.md` + `docs/MCP_SECURITY.md`.
- Tests: contract tests for each tool (mirror existing `mcp-strategy` pattern), idempotency-key dedup test, audit-row written test, rate-limit-429 test.

**Effort**: ~1 week. **Risk**: high blast radius — gated by toggle + paper-first default. Ship in stages: read tools → toggle UI + audit log → write tools (paper only) → write tools (live, gated by per-wallet toggle).

**Sequencing within C.1**: split across multiple PRs — read tools + audit table + toggle UI as one foundation PR, write tools (paper) as a second, live unlock as a third.

---

## D — Accessibility (deferred from V1_3 F.2/F.3)

### D.1 — Keyboard navigation in chart ✅ shipped (#302)
Centralized registry + dispatcher + `?` help modal. 11 chart shortcuts (pan / zoom / home / end / reset zoom) registered via the new system.

### D.1.b — Migrate remaining keyboard handlers to the registry
After #302 the chart-pan shortcuts go through `useKeyboardShortcut`, but the other handlers in `apps/electron/src/renderer/components/Chart/ChartCanvas/useChartKeyboardShortcuts.ts` still attach their own `window.addEventListener('keydown', ...)`:

- `Esc` → cancel `slTpPlacement` mode
- `Esc` → cancel `tsPlacement` mode
- `Esc` → cancel order drag
- `Delete` / `Backspace` → delete selected drawing
- `Mod+C` → copy selected drawing
- `Mod+V` → paste drawing

Each one duplicates the typing-target check + the input-detection logic the dispatcher already does. Easy to drift.

**What ships**:
- Convert each handler to a `useKeyboardShortcut({ scope: 'when-condition', when: () => predicate, action })` registration. Drop the bare `useEffect` + `addEventListener` blocks.
- Drawings shortcuts gain a `group: 'drawing'` so they show up in the help modal next to chart navigation.
- Trading shortcuts (placement-mode escapes, order-drag escape) gain `group: 'trading'`.
- Existing behavior preserved exactly — only the dispatch path changes.
- Tests: drop the per-effect listener tests in favor of registration assertions on the registry (mirrors what `useKeyboardNavigation.test.ts` does post-#302).

**Effort**: ~half-day. **Risk**: low (mechanical refactor). **Visible**: yes — adds drawing/trading entries to the `?` help modal so users discover them.

### D.2.a — axe-core dialog a11y spec ✅ shipped (#306)
- `apps/electron/e2e/a11y-dialogs.spec.ts` opens Settings / Backtest / Analytics / KeyboardShortcutHelpModal and asserts no critical/serious axe violations.
- DialogCloseTrigger wrapper now defaults `aria-label="Close"` so any consumer auto-passes the `button-name` rule.
- 2 rules currently disabled with documented justification — see D.2.b/D.2.c below.

### D.2.b — Manual VoiceOver pass on dialogs (needs human in the loop)
The axe spec from D.2.a catches missing labels and structural issues automatically, but doesn't verify the actual screen-reader experience. Things only a real VoiceOver run will catch:
- Focus order on tab navigation
- Whether `aria-describedby` correctly associates error text with its field
- Whether `aria-live` regions actually announce inline success/error toasts
- Trap behavior inside `<Dialog>` — does `Tab` from the last focusable element wrap back to the first
- Reading order of grouped content (e.g. SettingsDialog's vertical tab rail + content panel)

**What ships**: VoiceOver run on Settings / Analytics / Backtest / ChartCloseDialog. Notes every place focus order is wrong, labels are missing, or `aria-live` regions are silent. Per-finding fix in a follow-up PR.

**Effort**: ~half-day testing + ~half-day fixes. **Risk**: low. **Blocked by**: needs the developer (or an a11y QA contractor) to run VoiceOver — can't be automated.

### D.2.c — Color-contrast violations in Analytics ✅ shipped (#308)
Root cause was `bg.muted` (`#4a5568` _dark) being too light — `trading.loss/profit` over it gave ~2.3:1 contrast, well below 4.5:1 AA. Fixed by switching `<DataCard>` from a `bg.muted` fill to a `border` outline, which moves the text onto `bg.panel` (`#1a202c` _dark) where contrast clears comfortably. Also migrated `PerformanceCalendar`'s `getSignColor` from `red.500/green.500` literals to `trading.loss/profit` semantic tokens. `color-contrast` rule re-enabled in `e2e/a11y-dialogs.spec.ts`.

### D.2.d — Chakra/Ark useId() ARIA strictness (deferred from D.2.a skip list)
The axe spec also disables `aria-valid-attr-value` because Chakra/Ark UI generate IDs via React's `useId()` (e.g. `tabs:_r_2a_:content-account`). axe-core's strict IDREF check rejects these even though they're valid HTML5 and screen readers handle them correctly.

**What ships** (only if it ever blocks something real):
- Configure Ark UI's `idPrefix` on every Tabs/Accordion/Dialog instance to use a colon-free pattern.
- Or wait for Chakra v3 / Ark UI to ship a fix and re-enable the rule.
- Skip otherwise — this is a known-cosmetic violation, not an a11y regression.

**Effort**: ~half-day audit + sweep, **OR** zero if we keep the skip. **Risk**: zero either way.

---

## E — Backtest UI modal (rescued from deleted BACKTEST_UI_PLAN)

The 6-wave plan from #148/#149 was deleted in #200. Wave 0 (shared zod schema, #150) shipped. Waves 1–6 are unimplemented. Backtest CLI exists; the UI modal does not.

### E.1 — Wave 1: shape the backend mutation for fire-and-forget + progress events
- `backtest.run.useMutation` returns `{ runId }` immediately; results stream via socket `backtest:progress` + `backtest:complete` events.
- Server-side: backend keeps a `Map<runId, BacktestState>` in memory. On `complete`, persist the result row and emit final.
- Tests: contract test for the new return shape; integration test that progress events fire for a 100-bar backtest.
- **Effort**: ~half-day.

### E.2 — Wave 2: modal shell + 4-tab form
- New `<BacktestModal>` rendering on the toolbar (next to the existing screener button — `Toolbar.tsx:233-242`).
- 4 tabs: **Strategy** (which JSON/Pine), **Period** (start/end + interval), **Filters** (FilterManager preset), **Risk** (SL/TP/trailing).
- All inputs use the shared `@marketmind/types` zod schema from Wave 0.
- Reuses `<FormSection>` / `<FormRow>` / `<Field>` primitives. `Select inside Dialog` carries `usePortal={false}`.
- **Effort**: ~1 day.

### E.3 — Wave 3: progress UI + ETA smoothing
- After Run, modal switches to a progress view: percent bar + bars-processed counter + smoothed ETA. Cancel button.
- ETA uses a 5-window moving average of bars/sec to avoid bouncing.
- **Effort**: ~half-day.

### E.4 — Wave 4: results view
- On `backtest:complete`, modal switches to results: equity curve (lazy-loaded recharts), trade list, summary stats (win rate, profit factor, max DD).
- Reuses `<EquityCurveChart>` from `apps/electron/src/renderer/components/Trading/AnalyticsModal/`.
- **Effort**: ~1 day.

### E.5 — Wave 5: recent runs + persistence
- New tab "Recent Runs" lists past 50 runs; click loads results without re-running.
- Backend: `backtest_runs` table (already exists per Wave 0 zod schema layout) — wire CRUD.
- **Effort**: ~half-day.

### E.6 — Wave 6: polish
- Keyboard shortcut to open (`Ctrl/Cmd+Shift+B`).
- Modal-mount perf tag via `useDialogMount('BacktestModal', isOpen)` (already wired pattern from v1.3.0).
- Visual regression baseline for the modal (open + form state + progress + results).
- **Effort**: ~half-day.

**Total**: ~4 person-days across 6 PRs. **Risk**: medium — new modal touches toolbar + backend mutation contract, but Wave 0's zod schema removed the CLI/router drift risk.

---

## F — Package + token system (deferred from V1_POST_RELEASE 2.1/2.2)

### F.1 — Design tokens phase
The v1.4 sweep finished migrating to semantic tokens (`X.fg / .subtle / .muted / .solid`, `trading.*`, `accent.*`). The tokens themselves still live inside `apps/electron/src/renderer/theme/` — not a shared package.

**What ships**:
- Extract `apps/electron/src/renderer/theme/` into `packages/tokens/`.
- Re-export from `@marketmind/types` so backend (e.g. for chart screenshots, future tooling) can reference token names.
- `@marketmind/tokens/system` re-exports `defaultSystem` for any Chakra v3 consumer.
- Document the token taxonomy in `docs/UI_STYLE_GUIDE.md`.

**Effort**: ~half-day. **Risk**: low (pure refactor).

### F.2 — `@marketmind/ui` extraction (audit + plan only)
The `apps/electron/src/renderer/components/ui/` directory has been the single source of truth for ~30 wrappers since v1.0. Per `CLAUDE.md`: "designed for future extraction into a standalone `@marketmind/ui` package."

**What ships** (this PR is plan-only — extraction is its own follow-up):
- Inventory every export, group by stability tier (Tier-1 = stable wrappers, Tier-2 = composed primitives, Tier-3 = trading-specific).
- Document peer-dependency boundaries (which wrappers pull from `@marketmind/types` / `@marketmind/utils` / `@marketmind/tokens` once F.1 lands).
- Extraction sequencing proposal (Tier-1 first behind a `@marketmind/ui-core` workspace alias; Tier-2 next; Tier-3 stays in app indefinitely).
- Risk register: Storybook setup, snapshot test infra, electron-specific imports (toaster, cryptoIcon, etc.).

**Effort**: ~3-4h for the audit doc. **Risk**: zero.

---

## G — Test + CI infra

### G.1 — Visual review automation script (deferred from V1_3 G.2 / V1_5 archive C.2)
Speculative tier below the audit script. Walks renderer + flags surfaces missing tokens, oversized headings, or non-MM spacing.

**What ships**:
- `scripts/visual-review.mjs` reads `.tsx` files under `renderer/components/`, looks for: `fontSize` outside `MM.fontSize.*`, padding/margin outside `MM.spacing.*`, components that don't reference any semantic token.
- Reports findings as a markdown table (no auto-fix).
- Optional CI gate behind `RUN_VISUAL_REVIEW=1` (off by default).
- **Skip unless** we hit a wave of token-style regressions after v1.4.

**Effort**: ~1 day. **Risk**: zero.

### G.2 — Backend custom-symbol-service deeper testing (deferred from V1_3 C.1)
`backfillKlines` is smart about marketType fallback + auto-fetch + weight renormalization. Branches aren't unit-tested; integration-only via the live POLITIFI flow.

**What ships**:
- Component fixture factory for custom symbols (composable in `__tests__/helpers/`).
- `smartBackfillKlines` mock harness so unit tests can exercise the marketType fallback without testcontainers.
- 6-8 unit tests covering each branch.
- **Effort**: ~half-day.

---

## H — Maintenance / housekeeping

### H.1 — `MEMORY.md` consolidation (currently 219 lines, cap 200)
Auto-memory index has grown past the 200-line cap that gets loaded into context at conversation start. Lines 200+ were truncated during this session. Each entry should be one line under ~150 chars per the auto-memory spec.

**What ships**:
- Audit each entry; merge or move detail into topic files.
- Drop entries that violate the "What NOT to save" rule (architecture, file paths, debug recipes — derivable from code).
- Target: under 150 lines.

**Effort**: ~30min. **Risk**: zero.

### H.2 — Archive `V1_4_PLAN` ✅ shipped (#296)

### H.3 — Trade_executions error post-mortem (only if it reappears)
The v1.4 logger fix should now expose the underlying postgres error code on the `Failed query: ... from trade_executions` log. Most likely a transient connection drop during backend restart — `binance-price-stream.ts:245 getOpenExecutionsForSymbol` runs on every price tick.

**Trigger**: re-observe with v1.4.0+ logs to confirm the cause class. If `57P01 / 08006 / 08001` appears, add pool-level retry on those codes (1-2 retries with 100ms backoff). If it doesn't reappear, drop.

---

## Sequencing

Proposed:

1. ✅ **H.1** MEMORY.md trim (auto-memory)
2. ✅ **B.2** layout audit log (#298)
3. ✅ **A.1.b** login soft-nudge (#299)
4. ✅ **B.1** snapshot UI (#300)
5. ✅ **F.1** design tokens extraction (#301)
6. ✅ **D.1** keyboard nav in chart — registry + dispatcher + help modal (#302)
7. ✅ **D.1.b** migrate remaining `useChartKeyboardShortcuts` handlers (#304)
8. ✅ **B.3** Postgres archive_mode (#305)
9. ✅ **D.2.a** axe-core dialog spec (#306)
10. **D.2.b** manual VoiceOver pass — needs human-in-the-loop, deferred
11. ✅ **D.2.c** Analytics color-contrast fix — DataCard outline + trading.* token sweep (#308)
12. **G.2** backend custom-symbol tests — coverage closure
13. **E.1–E.6** Backtest UI modal — biggest single-feature push, sequenced as 6 separate PRs
14. **C.1** mcp-trading — biggest blast radius; ship in stages: foundation (toggle + audit + read tools) → paper-write → live-write
15. **F.2** ui extraction plan — audit doc, gates the actual extraction
16. **G.1** visual review automation — speculative, do only if regressions warrant

Skip H.3 unless logs show the error.

## Acceptance

A v1.5 phase is "done" when:
- The deliverable lands on develop with green CI
- `pnpm test` passes (currently 5,449 backend + 2,279 unit + 108 browser + 11 utils + ~722 indicators ≈ 8,569 total)
- Type-check + lint clean across all workspaces
- Audit script (`scripts/audit-shade-literals.mjs`) reports 0 forbidden patterns
