# Visual review — Phase 6.2 (April 2026)

Tela-a-tela review of every Settings tab, modal and sidebar against the **compact-style rules** in `docs/V1_POST_RELEASE_PLAN.md`. This document drives Phase 6.3 fixes and the visual-regression baseline.

## Method

- Source captures: `apps/electron/screenshots/2026-04-27T21-24-33-951Z/` (44 PNGs, dark+light, fixtures-driven).
- Each surface scored against:
  1. **Density** — compact spacing/typography per the plan's rule table.
  2. **Component primacy** — uses `<FormSection>`/`<PanelHeader>`/`<FormRow>`/`<Callout>`, not ad-hoc.
  3. **Theme parity** — dark and light render identically (no hardcoded shade literals).
  4. **Layout** — no overflow/truncation/empty-state wreckage.
- Severity:
  - **P0** — broken layout/overflow/mismatched theme. Block release.
  - **P1** — inconsistent spacing, typography, or pattern. Should fix before baseline.
  - **P2** — minor token miss, doc-only. Defer to v1.2 if cheap.

---

## Settings tabs (13)

### `account`
- ✅ Standard header with PageTitle + email field + verified badge.
- ✅ Avatar color picker, FormSection for Resources.
- 🟡 **P2** — "Member since: December 31, 2025" timezone artifact (UTC `2026-01-01` rendered as local). Cosmetic, won't fix.

### `security`
- ✅ Two FormSections (Password / Two-factor / Active sessions). Spacing fine.
- ✅ 2FA toggle row + Active sessions cards properly bounded.
- 🟢 No issues.

### `notifications`
- ✅ Two FormSections (In-app / Sound). Toggles aligned.
- ✅ Callout `tone="info"` for "More notification options coming soon".
- 🟢 No issues.

### `general`
- ✅ Language Select + Theme Light/Dark toggle. Minimal, on-spec.
- 🟢 No issues.

### `chart`
- ✅ FormSections (Chart Type / Display Options / Color Palette / Chart Dimensions / Grid).
- ✅ Color palette swatches sized correctly.
- 🟡 **P2** — Right margin / volume height ratio inputs are bare numbers without units in placeholder. Cosmetic.

### `wallets`
- ✅ Two demo wallet cards with balance/initial/PnL, color-banded by performance.
- ✅ "+ Create Wallet" CTA top-right of section.
- 🟢 No issues.

### `tradingProfiles`
- ✅ Single profile card "Conservative Breakout" with description + enabled setups + Max Concurrent.
- ✅ Import / + New Profile actions top-right.
- 🟡 **P2** — Star icon in title is purely decorative; card border-left color (yellow accent) is meaningful (default profile). OK but undocumented.

### `autoTrading`
- ✅ Emergency Stop banner, Trading Mode tabs, Active Watchers (3) with cards, Auto Rotation panel.
- ✅ Components compact and well-bounded.
- 🟡 **P1** — "Stop All" / "+ Add Watcher" buttons sit at the right edge with no visual separator from the watcher cards row above; a `mt={3}` would tighten the rhythm.

### `indicators`
- ✅ Empty state shows "No indicators yet. Click 'New' to add one." with Reset/New CTAs.
- ✅ Header shows "0 indicators" count.
- 🟢 No issues.

### `customSymbols`
- ✅ **Fixed in PR #212** — header (title + BetaBadge + count + description) was missing.
- 🟡 **P2** — On the "Create New" tab, the components rows use bare `<Input>` + `<Button>` without `<FormRow>` wrappers. Lower priority since this is a power-user form.

### `data`
- ✅ Kline Maintenance, Check Intervals (sliders), Storage (Clear All Klines), Liquidity Heatmap.
- ✅ Sliders compact, toggles aligned.
- 🟢 No issues.

### `updates`
- ✅ Application updates section with auto-check toggle + interval slider + Check Now / Reset buttons.
- 🟢 No issues.

### `about`
- ✅ Logo + Version 1.0.0 + description + Resources FormSection + copyright Callout.
- 🟢 No issues.

---

## Modals (5)

### `settings`
- (Covered by tab list above.)
- ✅ Dialog padding, header, sidebar nav all on-spec.

### `orders`
- ✅ **Fixed in PR #212** — modal wasn't mounting because OrdersDialog lives inside TradingSidebar; capture pipeline now opens the sidebar first.
- ✅ "All Orders" header + status filter + table with closed executions.
- 🟡 **P1** — table column headers (`SYMBOL/PNL/SIDE/STATUS/...`) use small caps; row cells fine. Density is good but the table fills full modal width without much breathing room — likely intentional (lots of columns).

### `backtest`
- ✅ Tabs: Basic / Strategies / Filters / Risk. Form layout clean.
- ✅ Symbol pill, Market/Interval selects, dates, capital, leverage, "All inputs valid" status, Cancel + Run backtest CTAs.
- 🟢 No issues.

### `screener`
- ✅ Header (Market Screener + BETA badge + Crypto/Futures/30m selectors + close).
- ✅ "Filters (0)" + Add Filter + Refresh + Save in empty state.
- 🟡 **P2** — modal renders empty/short until filters added; consider an EmptyState component with hint text. Defer to v1.2 if not blocking.

### `analytics`
- ✅ Header (`Analytics — Demo Paper Wallet`), Day/Week/Month/All Time pills.
- ✅ Performance summary cards (Total Return, Net PNL, Win Rate, Profit Factor, Avg Win/Loss, Max DD, Largest W/L).
- ✅ Daily Performance calendar with empty-state ("No trades this month").
- ✅ Equity Curve panel.
- 🟡 **P1** — calendar fixture intentionally empty; Phase 6.2 follow-up will populate full DailyPerformance shape (`pnlPercent/tradesCount/wins/losses/grossProfit/grossLoss`) for richer review.

---

## Sidebars (4)

### `trading`
- ✅ Tabs Orders / Portfolio. Quick trade % presets, Buy/Sell. Today's P&L card.
- ✅ "No open positions" empty state.
- 🟢 No issues.

### `autoTrading`
- ✅ **Fixed in PR #212** — fixture shape mismatch; now shows 3 watchers (BTC/ETH/SOL) with Stop All CTA.
- ✅ Tabs Watchers / Scalping / Logs. Direction toggles (Short Only / Auto / Long Only). Auto-Trade Position Size %.
- 🟢 No issues.

### `market`
- ✅ **Fixed in PR #212** — `common.noData` literal was rendering; key now translated.
- ✅ Indicator cards (Fear & Greed, BTC Dominance, MVRV, BTC Production Cost, Open Interest, Long/Short, Altcoin Season, ADX, Order Book) all show "No data available" empty state cleanly.
- 🟡 **P1** — none of the indicators populate via fixtures. Real data requires backend and CoinGecko/external APIs. Phase 6.2 follow-up: mock these procedures for richer captures.

### `orderFlow`
- ✅ DOM / Metrics tabs.
- 🟡 **P2** — "0.00" placeholder is misleading without context (Bid/Ask price, expected to populate from book ticker stream). Acceptable for empty state but a label "Awaiting price stream…" would be clearer.

---

## Top app workspace (always-on chrome)

### Top toolbar
- 🟡 **P1** — `BTCUSDT NaN%` shows next to symbol when fixtures empty the price stream. Real run shows actual %, but empty state should fall back to `—` instead of `NaN%`.

### Tab bar
- ✅ Active chart tabs render with CryptoIcon + symbol + 24h % (red/green by sign).
- ✅ **Fixed in PR #212** — POLITIFI now shows daily % via `ticker.getDailyBatch` synthetic-symbol path.
- ✅ **Fixed in PR #212** — CryptoIcon caches working source per asset; no more letter flicker on remount.

---

## Theme parity (dark vs light)

Spot-checked sidebar-market, modal-analytics, settings-account, settings-chart, sidebar-trading.

- ✅ All foreground/background tokens resolve correctly across both modes — no hardcoded shade literals leaking through.
- ✅ Color-coded badges (green/red PnL, blue accents) maintain contrast on both backgrounds.
- 🟢 No P0/P1 theme bugs identified.

---

## Summary

| Severity | Count | Surfaces |
|---|---|---|
| **P0** | 0 | — |
| **P1** | 4 | autoTrading buttons spacing, orders modal column density (note), analytics calendar empty fixture, market sidebar empty fixtures, top-toolbar `NaN%` |
| **P2** | 5 | account timezone artifact, chart input units, tradingProfiles default-marker, customSymbols form rows, screener empty state, orderFlow placeholder |

**Phase 6.3 plan (P1 only):**

1. Fix `BTCUSDT NaN%` empty-state in top toolbar (renderer guard against NaN).
2. Tighten `mt` between Auto-Trading watcher row and Stop All / Add Watcher actions.
3. Populate full `analytics.getDailyPerformance` fixture shape so the calendar tells a story (deferred from earlier — see TODO in `fixtures.ts`).
4. Add minimal mocks for Market sidebar indicator procedures (`getFearGreedIndex`, `getBtcDominance`, etc.) — values can be static; goal is to verify populated layout, not real data.

P2 items go to a v1.2 follow-up backlog.

---

**Acceptance for Phase 6.2:** this document committed, P0/P1 actionable list converged, captures session preserved as `apps/electron/screenshots/2026-04-27T21-24-33-951Z/`. Ready to enter Phase 6.3 (fixes + re-capture) and Phase 6.4 (baseline snapshot).
