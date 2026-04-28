# v1.3 — Backlog after the v1.2 standardization sweep

This file consolidates everything that survived the v1.2 release plus net-new ideas. Treat it as a backlog: items can move into a v1.3 release plan when scoped, or get shelved to v1.4+ if priorities shift. Each item lists rough effort + value tradeoff.

## A. Carryover from V1_2_PLAN.md

These were in `docs/V1_2_PLAN.md` but consciously deferred — captured here so they aren't lost.

### A.1 — `<DataCard>` primitive (deferred from Phase A.2)
**Status**: deferred
**Why**: Wallets/Profiles/Watchers/CustomSymbols cards each carry semantic colors (active = blue accent, profitable = green, default = yellow, etc.). A naïve abstraction would either flatten that meaning or expose an over-broad `accentColor` API. The risk of a wrong abstraction outweighed the benefit when v1.2 was scoped.
**Revisit when**: A new card type lands and we have 5+ instances, OR product wants a global toggle on the accent visibility.

### A.2 — Custom Symbols "Create New" form rows → `<FormRow>`/`<Field>` (deferred from B.1)
**Status**: deferred
**Why**: Existing labels use `fontSize="xs" fontWeight="medium"`; Chakra's `<Field.Label>` defaults differ (sm by default), so a swap shifts label typography across the entire form. Visual diff would be non-trivial.
**Effort**: ~2h to migrate + verify; low product value
**Revisit when**: We touch the form for unrelated reasons.

### A.3 — Chart input units ✅ shipped
- Padding fields (Top/Bottom/Left/Right) now have `(px)` suffix on labels.
- Line Width helper updated to include `(px)`.
- Other Chart Dimensions fields already had unit hints in helperText.

---

## B. Doc maintenance — drains since v1.2

These docs lag the post-v1.2 reality.

### B.1 — `CLAUDE.md` Project Version ✅ already current
- `CLAUDE.md` already shows `Project Version: 1.2.0` and the System Status block already references "0 forbidden patterns" + visual-regression CI gate. No change needed.

### B.2 — `docs/UI_STYLE_GUIDE.md` sync ✅ shipped
- `<EmptyState dashed>` already documented with full prop table.
- Added "Applied surfaces" line under PanelHeader (PerformancePanel, SetupStatsTable, PerformanceCalendar, EquityCurveChart).
- `_dark={{}}` elimination already documented in the "0 forbidden patterns" callout.

### B.3 — `apps/electron/src/renderer/components/ui/README.md` catalog refresh ✅ shipped
- EmptyState row already cross-referenced `dashed` prop and applied surfaces.
- Added a note that `<MarketNoData>` is a private helper inside MarketSidebar (not a `ui/` primitive).

---

## C. Test coverage gaps

### C.1 — Backend: custom-symbol-service deeper testing
- v1.1 work made `backfillKlines` smart about marketType fallback + Binance auto-fetch + weight renormalization
- No unit tests cover those branches (the integration path is exercised by the live POLITIFI flow only)
- **Effort**: revised ~half-day. The service uses private state + `db` + `smartBackfillKlines`; meaningful tests need testcontainers + a Binance mock harness, which is bigger than the original 3h estimate.
- **Value**: high — these branches caused the v1.1 POLITIFI shipping to require multiple fixup commits
- **Note**: better tackled as a focused PR with the test infra (component fixture factory + smartBackfillKlines mock) shared with future backend tests.

### C.2 — Frontend: visual regression baseline coverage holes
- Flow modals (AddWatcher / CreateWallet / StartWatchers / ImportProfile / TradingProfiles) don't render in the gallery because they need real click-flows. They're missing from baseline → no regression catch on these surfaces.
- **Effort**: ~2h adding click-driven captures via mcp-app
- **Value**: closes one of the deferred items from the v1.1 visual review

### C.3 — Empty-state semantics tests ✅ shipped (mostly)
- 7 surfaces now have explicit "renders EmptyState when X" tests: `ScreenerResultsTable`, `ChecklistEditor`, `IndicatorLibrary`, `WatchersList`, `TradingProfilesManager`, `CustomSymbolsTab`, `WalletManager`.
- Skipped: `Portfolio`, `OrdersList` — too many hooks and global state to mock cleanly; the visual-regression baseline still catches regressions on these surfaces.

---

## D. Performance + DX

### D.1 — Bundle size audit ✅ shipped (this PR)
- Wired `pnpm bundle:analyze` (rollup-plugin-visualizer behind `ANALYZE=1`).
- Extended `manualChunks` to split pinets, recharts, d3, grid, trpc, socket.io, react-icons into their own vendor chunks.
- Main bundle: 2,124 KB → 1,121 KB raw (587 KB → 325 KB gz). −44%.
- Findings + follow-up recommendations: `docs/V1_3_BUNDLE_AUDIT.md`.

### D.2 — Lazy-load Settings tabs
- Settings dialog mounts every tab on open (13 tabs). Most users only look at 1-2.
- **Effort**: ~3h to split each tab into a lazy chunk + loading skeleton
- **Value**: medium — reduces dialog open time, especially on cold cache

### D.3 — `perfMonitor` for dialogs/modals ✅ shipped (this PR)
- Added `recordDialogMount(name, ms)` to `perfMonitor` + `dialogMounts: DialogMountStat[]` field on `PerfSnapshot`.
- New `useDialogMount(name, isOpen)` hook captures the elapsed time between body render (when `isOpen` flips true) and the post-commit effect.
- Wired into `SettingsDialog`, `BacktestModal`, `AnalyticsModal`. Visible in `ChartPerfOverlay` when `localStorage['chart.perf']='1'`.

### D.4 — Storybook for primitives
- Primitives in `apps/electron/src/renderer/components/ui/` are documented in README + Style Guide but have no isolated playground. As `@marketmind/ui` package extraction approaches (planned for v1.2+), Storybook becomes the natural home.
- **Effort**: ~1 day to set up + write stories for the 30+ primitives
- **Value**: high if the extraction is real; defer otherwise

---

## E. MCP infrastructure followups

### E.1 — `mcp-app` flow tools (deferred from v1.1)
- AddWatcher/CreateWallet/StartWatchers/ImportProfile/TradingProfiles are all "click-flow" modals that the current `mcp-app` tools can't open without manual click chains
- Adding `app.openFlow({ name, walletId? })` would let agents drive these end-to-end
- **Effort**: ~4h
- **Value**: high — closes the gallery gap (C.2) AND lets agents repro user issues with these dialogs

### E.2 — `mcp-trading` (deferred from v1.1, scoped at v1.2)
- The threat-model writeup landed in v1.1 docs (`docs/MCP_SECURITY.md`). Implementation didn't.
- A trading MCP would let agents place/cancel/manage orders. Highest-impact MCP capability gain.
- **Effort**: ~1 week — auth scoping, audit log, dry-run mode, idempotency keys
- **Value**: very high if your use case includes agentic trading; very low otherwise. Decide based on your own usage pattern before scoping.

### E.3 — pixelmatch-as-image-diff for CI artifacts
- `scripts/visual-diff.mjs` writes red-overlay PNGs to `<session>/diffs/`. CI uploads them as artifacts but the user has to download + view. A web-friendly side-by-side gallery (like `screenshot.gallery` does) would beat that.
- **Effort**: ~2h — extend `renderGalleryHtml` to read diffs/ and add a third image column ("diff")
- **Value**: medium — only relevant when visual regression is failing, but speeds that loop up

---

## F. a11y deeper sweep

v1 Phase 1.4 did a high-level a11y audit on Settings dialog. v1.2 didn't add any a11y work. Things that would benefit:

### F.1 — Color-contrast pass
- `fg.muted` over `bg.muted` in dark mode falls below 4.5:1 (noted in V1_POST_RELEASE_PLAN.md as deferred)
- Other muted-on-muted pairings likely have the same issue
- **Effort**: ~half-day to audit + tune the dark-mode `fg.muted` token
- **Value**: medium — moves us toward WCAG AA

### F.2 — Keyboard navigation in chart
- Chart canvas accepts mouse + scroll; keyboard support is partial (arrow-pan exists but not documented)
- **Effort**: ~1 day
- **Value**: medium — improves desktop power-user reach

### F.3 — Screen-reader pass on dialogs
- Settings dialog has aria-labels but the full "open Settings → Account → change name → save → close" flow with VoiceOver hasn't been verified
- **Effort**: ~half-day testing + minor tweaks
- **Value**: medium

---

## G. Net-new ideas

### G.1 — Per-wallet light/dark theme override ❌ dropped
- Confirmed with the user that theme should stay per-user (which is what we already have via UI preferences). No per-wallet override needed.

### G.2 — Visual review automation
- The `docs/visual-review-2026-04.md` was a 1-shot manual scoring. A recurring `pnpm visual:review` script that walks the baseline + flags surfaces missing tokens, has hardcoded shades, or oversized headings would catch regressions before CI does.
- **Effort**: ~1 day for a v0
- **Value**: medium — useful as the codebase grows

### G.3 — Strategy JSON → Pine migration completion
- Memory mentions "PineTS migration" as ongoing. Status unclear from the codebase. Could be a v1.3 deliverable if close to done.
- **Action**: review `apps/backend/strategies/` and the memory entry to scope

---

## Sequencing (current state)

**Already shipped on develop after v1.2.0**:
- A.3, B.1, B.2, B.3 (doc drains + chart input units)
- C.2, E.1, E.3 (visual gallery flow-modal coverage + mcp-app flow tools + pixelmatch HTML gallery)
- D.1, D.2, D.3 (bundle chunk split + lazy Settings tabs + dialog mount perf)
- F.1 (fg.muted contrast bumped to clear WCAG AA)
- G.2 audit script (forbidden shade-literal CI gate)
- Bundle follow-ups #1+#2+#3 (lazy locales, lazy pinets, lazy recharts) — main bundle −60%
- Logo brand-lock (PR #240)
- P&L color sweep to canonical trading.profit/loss tokens (PR #241)

**Open backlog (still candidates for v1.3 release)**:
- C.1 — backend custom-symbol-service tests (~3h)
- C.3 — empty-state semantics tests (~1h-3h depending on mock surface)
- F.2 — keyboard nav in chart (~1d)
- F.3 — screen-reader pass on dialogs (~half-day)
- G.2 — visual review automation script (~1d)
- G.3 — Pine migration completion review (research)
- Smaller bundle follow-ups (react-router subset, indicators catalog lazy, react-icons consolidation)

**Deferred to v1.4+**:
- D.4 (Storybook + ui package extraction)
- E.2 (mcp-trading)

---

## What this doc is not

This is a **backlog**, not a release plan. Items get formalized into a release plan (with sequencing, acceptance criteria, per-PR mandate) when they're picked up. Until then they're just "things we know we want to do."

When picking the next one, prefer items that:
1. Close a known gap (carryover items, doc drains)
2. Have clear scope + value tradeoff
3. Don't require touching code in surfaces you're about to refactor anyway

---

**Last updated**: 2026-04-28 (post v1.2.0 release)
