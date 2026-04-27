# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — Modal sweep (post-v1)
- **CreateWalletDialog**: replaced 3 ad-hoc `<Alert.Root>` blocks with `<Callout tone="info|warning|danger">`, tightened content gap from 4 → 3.
- **AddWatcherDialog**: replaced 3 inline colored `<Box bg="orange.50/blue.50" ...>` panels with `<Callout>`, tightened gaps from 5 → 3, secondary buttons sized down to xs.
- **ImportProfileDialog**: parsed-profile preview moved into `<Callout tone="success">`; field gap tightened.
- **StartWatchersModal**: no-wallet warning, info footer text replaced with `<Callout tone="warning|info">`; semantic tokens `green.subtle`/`green.muted` for the quick-start panel.
- **ScalpingConfig**: outer VStack gap reduced from 6 → 4.

### Docs
- `apps/electron/src/renderer/components/ui/README.md` — documents `Callout`, `FormSection`, `FormRow`, typography scale, `CollapsibleSection.variant="static"`.
- `CLAUDE.md` — UI rules updated with the new section/row composition guidance, all new wrappers added to the must-use-from-`ui` list.

## [1.0.0] - 2026-04-27

**v1 launch** 🚀 — Settings overhaul, full account & security flows, shared UI primitives, no-accordion AutoTrading.

### Added — Settings overhaul (v1)
- **Vertical-rail Settings dialog** (`apps/electron/src/renderer/components/Settings/SettingsDialog.tsx`). Replaces horizontal `Tabs.Root` with `orientation="vertical"`, 220px sticky rail + scrollable content. Tabs grouped under section labels (`ACCOUNT` / `APPEARANCE` / `TRADING` / `SYSTEM`) with icons.
- **`Settings/constants.ts`**: tab IDs, group definitions, icon mapping, `SettingsTab` union, `isSettingsTab` guard, `AVATAR_COLOR_PALETTE`.
- **Account tab** (`AccountTab.tsx`) — replaces standalone `AccountDialog`. Avatar upload / preview / delete (PNG/JPG/WEBP/GIF up to 500KB), display name, email + verified badge + resend verification, color picker fallback for initials.
- **Security tab** (`SecurityTab.tsx`) — change password (current + new + confirm with validation, invalidates other sessions), 2FA toggle (gated by emailVerified), active sessions list with per-session revoke + "log out other sessions".
- **Notifications tab** (`NotificationsTab.tsx`) — order-update toasts on/off, setup-detected toasts on/off, notification sound on/off + "more coming soon" callout.
- **Updates tab** (`UpdatesTab.tsx`) — auto-update settings extracted from About: auto-check toggle, interval slider, auto-download toggle, manual check + status badge.
- **`openSettings(tab?)` plumbing** — `GlobalActionsContext`, `MainLayout`, `SettingsDialog.initialTab`, `e2eBridge` updated. `UserAvatar` "Account" menu item now opens Settings on the Account tab; "Settings" opens default tab.
- **Backend**: `auth.changePassword` (verifies current + invalidates other sessions), `auth.uploadAvatar` / `getAvatar` / `deleteAvatar` (base64 + mime validation, 700KB cap), `auth.listSessions` / `revokeSession` / `revokeAllOtherSessions`, `auth.updateProfile` extended to accept `avatarColor`. Schema migration `0033_user_avatar_session_metadata.sql`: `users.avatar_data/_mime_type/_color` + `sessions.created_at/_user_agent/_ip`.
- **Avatar storage**: base64 in `users.avatar_data` text column. No filesystem dependency (good for Electron portability). 700KB DB cap server-side, 500KB client-side, mime allowlist `image/png|jpeg|webp|gif`.
- **Session metadata captured on create**: `userAgent` + `ip` recorded at register / login / 2FA verify, surfaced in Security tab's sessions list.

### Added — UI primitives (`apps/electron/src/renderer/components/ui/`)
- **`Callout`** — info/success/warning/danger/neutral toned banner with icon, optional title + body, `compact` mode.
- **`FormSection`** + **`FormRow`** — standardized section header (title / description / optional action) + label/helper/control row layout used across every Settings tab.
- **`PageTitle` / `SectionTitle` / `SubsectionTitle` / `SectionDescription` / `FieldHint` / `MetaText`** — typography scale for consistent heading + body text sizes.
- **`CollapsibleSection.variant="static"`** — non-accordion mode for the AutoTrading sub-sections (no chevron, content always shown). Backwards-compatible default `"collapsible"`.
- **`Switch` wrapper** now forwards `data-testid` + `aria-label` props (was eating them silently).

### Changed
- **AutoTrading tab — no more accordion**. All 12 `WatcherManager` sub-sections (Watchers list, Dynamic Selection, Position Size, Leverage, Risk Management, Trailing Stop, TP Mode, Stop Mode, Entry Settings, Filters, Opportunity Cost, Pyramiding) and the 5 Trading Profile editor sections (Filters, Fib Entry, Trailing Stop, Risk, base) now use `variant="static"` — content always visible, no toggle, faster scan.
- **Tab reorganization**: 9 → 13 tabs. Old (General | Wallets | Chart | Indicators | Trading Profiles | Auto-Trading | Custom Symbols | Data | About) → new groups: Account/Security/Notifications · General/Chart · Wallets/Trading Profiles/Auto-Trading/Indicators/Custom Symbols · Data/Updates/About.
- **Compact spacing throughout**. Settings dialog content padding `p={6}` → `p={4}`. Section gaps `gap={6}` → `gap={5}`. Field gaps `gap={4}` → `gap={3}`. Avatar 80×80 → 64×64. Buttons `size="sm"` → `size="xs"` for secondary actions. Title sizes downsized one step (md → sm). Helper text 2xs (smaller) for inline hints.
- **`AboutTab` slimmed** — version + resources + copyright only. Auto-update settings live in Updates tab.
- **`GeneralTab`** uses `FormSection` for language + theme; `LanguageSelector` no longer renders its own header (parent FormSection provides it).
- **`ChartSettingsTab`** rewritten with `FormSection` + 2-col grids; helpers moved to `helperText`; reset button to `size="sm"`.
- **`DataTab`** uses `FormSection` + `Callout` (replaces ad-hoc colored repair-result text); heatmap section + storage section + cooldowns all consistent.
- **Locale strings** added in 4 languages (en / pt / es / fr): `settings.tabs.{account,security,notifications,updates}`, `settings.section.{account,appearance,trading,system}`, full `settings.account.*`, `settings.security.*`, `settings.notifications.*` blocks; `settings.autoUpdate` got `description` + `checking` keys.

### Removed
- **`apps/electron/src/renderer/components/Account/`** (folder + `AccountDialog.tsx`) — content lives in the new Account tab.
- **`apps/electron/src/renderer/components/Settings/useSettingsDialog.ts`** — never imported, used `window.confirm`.
- **`apps/electron/src/renderer/components/Settings/SetupConfigTab.tsx`** — never wired up; its config (minConfidence / minRiskReward) is set per-watcher.

### Tests
- New unit tests: `AccountTab` (10), `SecurityTab` (11), `NotificationsTab` (4), `UpdatesTab` (4), `UserAvatar` (3), updated `SettingsDialog` (8). Covers tab navigation via `initialTab`, mutation wiring, validation, session revoke flows, avatar mime-type guards.
- Frontend total: 2126 → 2155 unit (+29). All passing.

## [0.115.0] - 2026-04-27

UX polish + dead-code cleanup. No new features, no behaviour change.

### Changed
- **Boleta — outline borders on the menu / +/- buttons** (`apps/electron/src/renderer/components/Layout/QuickTradeToolbar.tsx`). The 3-dots menu trigger and the +/- size-step buttons used `variant="ghost"`; the size presets used `variant="outline"`. All three now match.
- **Indicator selector relocated to the top toolbar with a label** (`apps/electron/src/renderer/components/Layout/Toolbar.tsx` + `IndicatorTogglePopoverGeneric.tsx` + `ChartToolsToolbar.tsx`). Was a square icon at the top of the left vertical drawing toolbar; now sits next to `ChartTypeSelector` with the gauge icon + "Indicators" label, matching the labeled selectors. The popover gained `triggerVariant: 'icon' | 'labeled'` and `popoverPlacement: 'right-start' | 'bottom-start'` so the same component still serves both shapes. Store wiring is unchanged — the singleton `useIndicatorStore` continues to drive every chart panel.
- **Position-line PnL: `$` → `USD`** (`apps/electron/src/renderer/components/Chart/renderPositions.ts`). The position info-tag PnL badge now renders `+USD X.XX` / `-USD X.XX` instead of `+$X.XX` / `-$X.XX`, matching the rest of the app's currency formatting.

### Removed
- **8 dead `VITE_*` env keys** (root `.env.example`) for the removed AI features (Anthropic / OpenAI / Gemini API keys), the removed news features (NewsAPI / CryptoPanic), plus `BINANCE_API_KEY`/`SECRET` (wallets store these encrypted per-wallet in the backend DB) and `ALPHA_VANTAGE_API_KEY` (replaced by IB integration). Kept only what's actually read.
- **4 dead backend env keys** (`apps/backend/.env.example`): `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `ENABLE_METRICS`, `METRICS_PORT` — zero references in the codebase. Annotated remaining docker-only vars (`DATABASE_USER`, `REDIS_PASSWORD`, `PGADMIN_*`, etc.) with `# [docker]`.
- **5 stale plan docs**: `docs/BACKTEST_UI_PLAN.md`, `docs/CRYPTO_SIGNAL_IDEAS.md`, `docs/SCREENER_IMPLEMENTATION_PLAN.md`, `docs/plans/auto-trading-e2e.md`, `docs/plans/screener-modal-e2e.md`. No in-tree code references any of them.

## [0.114.0] - 2026-04-27

Four real chart-order bugs the user reported, plus the white-flash UX polish extended to every cancel/close path. +47 unit tests.

### Fixed
- **SL/TP cancel modal stays open after confirm** (`apps/electron/src/renderer/components/Chart/ChartCanvas/useChartTradingActions.ts`). `handleConfirmCloseOrder` never called `setOrderToClose(null)` after the `sltp:` branch ran — the modal sat open with the loading-X order behind it. Now dismisses immediately on confirm; the order stays visible at its position with the X-button-loading state until the backend ACKs.
- **Move-order shows duplicate (origin + destination)** (`useChartTradingActions.ts`). `handleUpdateOrder` for exchange-* IDs set `orderLoadingMapRef` on the OLD id, which bypassed the cancelled-status filter in the data merge — so the cancelled original AND the new optimistic-at-new-price both rendered. Loading flag now lives only on the new optimistic; the old id is hidden by the cancelled filter immediately. One order moves.
- **Close: order disappears, comes back, then disappears again** (`useChartTradingActions.ts`). The flash was set AFTER the mutation resolved, but `finally` ran the same tick — clearing the snapshot/loading and removing the order before the flash had a chance to play. Now the flash is set BEFORE the mutation starts (while the order is fully visible), and the cleanup in `finally` is deferred by `FLASH_DURATION_MS` so the white pulse actually plays out.
- **Flash effect was only firing on SL/TP move** (multiple paths). Same root cause as above for cancels/closes — entity removed before the flash key applies. Applied the "flash-first, defer cleanup" pattern uniformly to: exchange-* X-cancel, pending exec X-cancel, SL/TP cancel via confirm dialog, position close via confirm dialog. Move-entry already worked because the order persists at the new price.

### Added
- **`closeOrderTargetParser` + 19 tests** (`apps/electron/src/renderer/components/Chart/ChartCanvas/closeOrderTargetParser.ts` + `__tests__`). Encodes the 5-grammar of close-target ids (`null`, `ts-disable`, `sltp:type:id1,id2,...`, `exchange-(order|algo)-<id>`, `<execId>`) into a discriminated union. Round-tripped against `encodeSltpTarget`. Catches malformed inputs without throwing.
- **`exchangeMoveBuilder` + 11 tests** (`exchangeMoveBuilder.ts` + `__tests__`). Single source of truth for the optimistic-execution + `addBackendOrder` payload shape when moving an exchange-* order. Covers algo (STOP_MARKET / TAKE_PROFIT_MARKET) vs regular LIMIT, `price` vs `stopPrice` routing, FUTURES default, opt-id determinism, `reduceOnly: true` invariant.
- **`orderDragValidators` + 17 tests** (`orderDragValidators.ts` + `.test.ts`). `isValidTakeProfit` (LONG above / SHORT below entry), `isTighterStop` (slTightenOnly mode), `clampStopToTighten` (drag-preview clamp), `findRelatedOrdersForSlTp` (multi-entry SL/TP fan-out: same symbol + same side + active).

### Changed
- `useChartTradingActions.ts` and `useOrderDragHandler.ts` consume the new helpers. ~80 lines of inline math now live behind tested seams.

### Notes
- Frontend tests: 2079 → 2126 unit + 97 browser. Backend untouched.
- Cumulative across this session: 1933 → 2126 unit (+193), 0 → 8 boleta e2e, 74 → 153 chromium e2e (+79 stabilized), 10 real production bugs found + fixed.

## [0.113.0] - 2026-04-27

Coverage parity for the portfolio sidebar's PnL math + orphan-orders classification, two real bug fixes surfaced by the work.

### Fixed
- **Scalping P&L sign placement** (`apps/electron/src/renderer/components/Trading/scalpingDashboardUtils.ts`). `formatScalpingPnl` rendered `$-7.50` (sign inside the `$` prefix), non-standard accounting and inconsistent with every other PnL string in the app. Now produces `-$7.50`. The v0.111 characterisation test that locked in the buggy format is now updated to assert the correct one.
- **Duplicate `price:update` listener** (`apps/electron/src/renderer/hooks/useTabTickers.ts`). `useTabTickers` AND `RealtimeTradingSyncContext` both listened on `price:update` and both wrote to `usePriceStore` for every tick — `updatePrice` ran twice per event, every event (confirmed in the e2e trace dump that diagnosed the v0.112 socket leak). `RealtimeTradingSyncProvider` mounts at the App root and is the canonical sole owner now. The `useTabTickers` listener was removed. No behaviour change beyond halving the per-tick work.

### Added
- **Portfolio position math + 36 tests** (`apps/electron/src/renderer/components/Trading/portfolioPositionMath.ts` + `.test.ts`). `usePortfolioData.ts` carried ~80 lines of inline math driving the entire sidebar's display: per-`(symbol, side)` grouping with weighted-avg entry, leverage-aware `pnlPercent` with sign-flip for SHORT, mark-to-market PnL with a 3-tier price-source precedence (centralized → ticker → avgPrice fallback), plus stop-protected and TP-projected aggregations, total exposure / margin, leverage detection, and effective capital. Extracted and covered with 36 tests including the divide-by-zero guard when `avgPrice=0` and the SHORT pct sign inversion.
- **Orphan-order classifier + 14 tests** (`apps/electron/src/renderer/hooks/orphanOrdersClassifier.ts` + `.test.ts`). `useOrphanOrders` had a 60-line inline `useMemo` doing the exchange-order → orphan / tracked / skip classification with no isolated tests — if a future `tradeExecutions` column gets added (a 7th order-id field) and isn't wired into `buildTrackedOrderIds`, orders for that column would be silently flagged as orphans, and the user-facing "Cancel orphan" button would cancel real positions' protective orders. Extracted and tested: all 6 known order-id columns flow through, null/empty filtering, multi-execution dedupe, algo orders classified with `isAlgo=true` so cancellation routes correctly, mixed scenarios.

### Notes
- Frontend tests: 2029 → 2079 unit + 97 browser. Backend untouched.
- Cumulative across this session: 1933 → 2079 unit (+146), 0 → 8 boleta e2e, 74 → 153 chromium e2e (+79 stabilized), 6 real production bugs found + fixed.

## [0.112.0] - 2026-04-26

E2E suite goes from 150/153 → **153/153 passing on a clean develop**, with zero flakes across runs. The 3 long-running flaky `symbol-tab-percentages` tests are fixed; three latent test fragilities exposed by the fix were hardened in turn.

### Fixed
- **e2e socket isolation** (`apps/electron/src/renderer/services/socketBus.ts`). `socketBus.ensureSocket()` opened a real socket.io connection to `BACKEND_URL` (`http://localhost:3001`) unconditionally. With a developer's `pnpm dev` backend running, the e2e tests received **real Binance `price:update` events** for BTC + ETH that raced against test fixtures — same class of bug as the v0.110 playwright port collision. Repro on develop: `symbol-tab-percentages.spec.ts` saw ETH badge `-21.28%` (real BTC random-walk price ≈ 2381 against the `open=3000` fixture) instead of the expected `+1.00%`. Fix: gate `autoConnect` and `reconnection` on `IS_E2E_BYPASS_AUTH`. The `Socket` instance still exists (the e2e bridge wraps it via `socket.listeners(event)`), so explicit `emitSocketEvent(...)` still works — but the wire never opens and no real-world events leak in.
- **boleta — buy/sell click captured stale price** (`apps/electron/e2e/sidebar-quick-trade.spec.ts`). `BuySellButtons` reads `currentPrice` from `usePricesForSymbols` which has a 250ms throttle. Without socket-pushed re-renders during the initial load window, the click handler's `useCallback` closure could capture `price=0` even after the priceStore had been populated by the chart's kline-close. Added `waitForBuyPrice` helper that polls the button's accessible name (which reflects the captured closure value) before allowing the click.
- **trading-flow chart canvas paint** (`apps/electron/e2e/helpers/chartTestSetup.ts`). `waitForChartReady` waited for canvas mount + 10 frames but not for actual painted pixels. Socket-pushed re-renders historically masked the ~100ms gap between the rAF batch returning and the chart's first paint. Extended the helper to also poll for at least one canvas with non-zero alpha before returning.
- **backtest modal Risk tab Switch** (`apps/electron/e2e/backtest-modal-flow.spec.ts:316`). Chakra v3 Switch (Ark UI) needed two fixes: scope the locator to `[role="tabpanel"][data-state="open"]` (Chakra Tabs marks inactive panels with `data-state="closed"`, NOT the `hidden` attribute, so the bare selector matched a 0×0 hidden switch in another panel), and use `label.click({force:true})` (mouse coordinates miss because the visible track is `aria-hidden` and hit-testing skips it; force-click on the label routes through Ark UI's controlled handler reliably).

### Notes
- Test totals: **2029 unit + 97 browser + 153 e2e = 2279 tests, 100% passing on develop**.
- Cumulative across this session: 1933 → 2029 unit (+96), 0 → 8 boleta e2e, 74 → 153 chromium e2e (+79 recovered or stabilized).

## [0.111.0] - 2026-04-26

Coverage parity for the Market sidebar and the Auto-Trading sidebar (Watchers + Logs + Scalping tabs). +75 unit tests, 4 pure-logic helpers extracted from inline-in-component code.

### Added
- **`marketIndicatorUtils.test.ts`** (+43 tests) — every formatter and threshold-color helper used by every chart in the Market sidebar's indicators tab: `getRefreshIntervals` (per-key clamp logic + `orderBook` quarter-of-half), `formatTooltipDate` (3 missing-data paths), `formatFundingRate`, `formatLargeNumber` (B/M/K thresholds), `getFearGreedLevel` / `getFearGreedColor` (5 levels × 10 boundary cases + > 100 fallback), `getAltSeasonColor`, `getAdxColor`, `getOrderBookPressureColor`, `getMvrvColor`, `formatUsd`.
- **`watchersTabUtils.{ts,test.ts}`** (+13 tests) — extracted from `WatchersTab.tsx`. `sortWatchers` (4 keys × 2 directions, undefined-profile sorts first, unknown-key no-op, immutability, empty input) and `formatSuggestionPrice` (>= 1: 2 decimals; < 1: 4 sig figs).
- **`scalpingDashboardUtils.{ts,test.ts}`** (+7 tests) — extracted from `ScalpingDashboard.tsx`. `formatScalpingPnl` (the negative-value test explicitly locks in the current `$-X.XX` quirk — sign inside the dollar prefix — flagging it for a follow-up rather than stealth-fixing) and `scalpingPnlColor` (zero is neutral, not green — fresh-session correctness).
- **`logsTabUtils.{ts,test.ts}`** (+12 tests) — extracted from `LogsTab.tsx`. `LOGS_TAB_FONT_SIZE_STEPS` ladder lockfile, `clampFontSizeIndex`, `fontSizeForIndex` (with clamp + fallback), `isScrolledToBottom` (default 50px threshold + custom threshold + viewport-taller-than-content edge case where the user is "always at the bottom").

### Changed
- **`WatchersTab.tsx`, `ScalpingDashboard.tsx`, `LogsTab.tsx`** now consume the extracted helpers — net **-26 inline lines** across the three files. Behaviour is unchanged.

### Notes
- Frontend tests: 1954 → 2029 unit + 97 browser. Backend untouched.
- OrderFlow sidebar already had parity tests (1:1 test-to-source ratio in `OrderFlow/__tests__/`) — no changes needed there.

## [0.110.0] - 2026-04-26

Test infrastructure recovery + Orders sidebar coverage parity with the boleta.

### Fixed
- **Playwright e2e port collision with `pnpm dev`** (`apps/electron/playwright.config.ts`). The webServer config has `reuseExistingServer: !process.env.CI`. When a developer runs `pnpm dev` (port 5173) and then triggers `playwright test`, Playwright silently adopts the dev server — which doesn't set `VITE_E2E_BYPASS_AUTH=true`. Result: the e2e bridge (`window.__indicatorStore`, `__drawingStore`, `__priceStore`, `__layoutStore`, `__socketTestBridge`, `__globalActions`) never installed, every test that called `waitForE2EBridge` timed out at 30s, and the chromium project reported 76 of 153 failing on a clean develop. Defaulted the e2e port to 5174 so it never collides; pre-fix → post-fix on a clean develop: 74 → 150 passing. Override is still available via `PLAYWRIGHT_WEB_PORT`.

### Added
- **`useOrdersFilters` hook + 21 tests** (`apps/electron/src/renderer/hooks/useOrdersFilters.ts` + `.test.ts`). `OrdersList` had a 45-line inline filter+sort block — same shape as the boleta's `usePortfolioFilters`. Mirror-extracted to a hook for parity, then unit-tested: `filterOrders` (all 7 status filters including the CANCELED+REJECTED merge in `cancelled` and the EXPIRED+EXPIRED_IN_MATCH merge in `expired`), `sortOrders` (10 sort options + immutability + the `updateTime || time` fallback when `updateTime` is 0), `useOrdersFilters` end-to-end (composed pipeline + memoization).

### Changed
- **`OrdersList` consumes the new hook** (`apps/electron/src/renderer/components/Trading/OrdersList.tsx`). Net `+1 import / -45 inline lines`. Behaviour is unchanged — the same code now ships behind a tested seam.

### Notes
- Frontend tests: 1933 → 1954 unit + 97 browser. Backend untouched.
- Chromium e2e: 74 → 150 passing on clean develop. Remaining 3 failures (`symbol-tab-percentages.spec.ts`) are a pre-existing data-race in the badge calculation, tracked separately.

## [0.109.0] - 2026-04-26

Pure test-coverage release for the trading sidebar boleta. No production code changed.

### Added
- **Boleta unit suite** (`apps/electron/src/renderer/components/Layout/QuickTradeToolbar.test.tsx`, +26 tests). Covers all 7 user-flagged features: Buy/Sell (incl. the v0.107 regression that `createOrder` is called with `quantity` not `percent`), Reverse Position, Close Position, Cancel Orders (success path + `result.error` toast + thrown-rejection toast), Grid Orders / Trailing Stop / Checklist sub-component wiring (rendered only after Toggle advanced), SPOT vs FUTURES gating (Reverse/Close/Cancel hidden for SPOT), and size-preset / +-5% rounding with bound clamping.
- **Portfolio-filter pipeline tests** (`apps/electron/src/renderer/hooks/usePortfolioFilters.test.ts`, +18 tests). `filterPositions` (all/long/short/profitable/losing — zero-PnL exclusion is asserted both ways), `sortPositions` (newest, oldest, symbol asc/desc, pnl asc/desc, exposure-desc, immutability of input), `calculateStats` (PnL totals, margin-denominated %, empty-array guard), and the `usePortfolioFilters` hook itself (memoization + filter-applies-before-stats invariant).
- **E2E boleta spec** (`apps/electron/e2e/sidebar-quick-trade.spec.ts`, +8 tests, ~6s wall-clock). Same 7 features driven through the live tRPC mock — each handler asserted against the exact endpoint it should hit (`trading.createOrder`, `futuresTrading.reversePosition`, `closePositionAndCancelOrders`, `cancelAllOrders`). Uses position-fixture vs no-position-fixture split to prove the Reverse/Close rows are visually disabled without an open position.

### Notes
- Frontend tests: 1933 → 1977 unit + 97 browser, plus 8 new e2e in the chromium project. Backend untouched.

## [0.108.0] - 2026-04-26

Follow-up to v0.107.0: the daily-PnL fix was incomplete and the user reproduced the same symptom on a 3rd close.

### Fixed
- **Daily PnL only refreshed on the FIRST close of the day** (`apps/backend/src/routers/analytics/stats.ts` — `getDailyPerformance`). v0.107.0 fell back to trade-level PnL only when `incomeSum === 0`. The user's reproduction: 2 earlier trades closed and the periodic income sync had picked them up — so `incomeSum = 40` (non-zero). They closed a 3rd trade; `tradeRealizedNet` jumped to 90 but `incomeSum` was still 40 (next sync hadn't run). The fallback condition was false → the sidebar's "Today's P&L" stayed on +40.66 / 2 trades. Replaced with a sharper rule: when the day has any closed trades (`stats.closedPositions > 0`), always use `tradeRealizedNet` — gives an instant update on every close, on every trade, and stays consistent with the wins/losses count above (which already comes from `tradeStatsByDay`). Funding-only days (no closed trades) still fall through to `incomeSum` so the funding delta surfaces.

### Changed
- **Backend regression test** (`apps/backend/src/__tests__/routers/analytics.router.test.ts`). Replaced "prefers incomeEvents over trade pnl when both are populated" — that assertion encoded the broken behaviour where `incomeSum` would shadow a freshly-closed trade. The new test seeds 2 prior trades synced to `incomeEvents` (`incomeSum = 40`) + a 3rd closed trade not yet synced, asserts the daily bucket returns `pnl: 90` (sum of all 3 trades), not the stale 40. Kept the "no closed trades, funding-only day" case so the income-sum branch is still exercised.

### Notes
- Backend tests: 5370 → 5371 (one replaced, one added). Frontend untouched.

## [0.107.0] - 2026-04-26

Two real bugs in the sidebar trading flow that the user reported. Both were single-source-of-truth violations producing surprising behaviour.

### Fixed
- **Boleta `10%` (or any %) preview-vs-actual mismatch** (`apps/electron/src/renderer/components/Layout/QuickTradeToolbar.tsx`). The QuickTradeToolbar sent `percent: sizePercent` to the backend, which then ran `calculateQtyFromPercent` against `accountInfo.availableBalance` (live from Binance). The frontend preview used `wallet.currentBalance` (DB-cached client-side). Whenever the user had open positions consuming margin, `availableBalance < currentBalance` — so picking 10% showed a quantity computed against the full wallet but Binance executed 10% of the smaller available balance. Now the toolbar sends `quantity: pendingOrder.quantity` directly so what the user previewed is exactly what gets submitted; if the cached balance is stale enough that Binance would reject, the failure surfaces as a clear error instead of a silently smaller fill.
- **Daily PnL stuck after closing a trade** (`apps/backend/src/routers/analytics/stats.ts` — `getDailyPerformance`). The daily `pnl` value was sourced purely from `getDailyIncomeSum` (`incomeEvents` table — REALIZED_PNL + COMMISSION + FUNDING_FEE on the Binance side). Income events are populated by a periodic sync that runs on a ~1 min cadence — when a trade just closed, `tradeExecutions.pnl` was already updated synchronously but `incomeEvents` for the day was empty until the next sync. The user's sidebar Daily PnL appeared stuck on the previous total until they manually clicked "atualizar carteira", which triggers a sync. The wins/losses count for the day was already using `tradeExecutions` so this was an internal inconsistency inside one query response. Fix: when `incomeSum === 0` for a day but trades did close that day, surface the trade-level realized PnL (`grossProfit - grossLoss`) immediately. The next income sync replaces it with the funded-and-commissioned authoritative figure.

### Added
- **Backend regression tests** (`apps/backend/src/__tests__/routers/analytics.router.test.ts`, +2):
  - `falls back to trade-level pnl when income events have not synced yet (regression: daily PnL stuck after close)` — seeds a closed trade with no matching `incomeEvents` row; pre-fix the daily bucket returned `pnl: 0`.
  - `prefers incomeEvents over trade pnl when both are populated` — guards the fallback from being too eager when the sync has actually run.
- **Frontend hook tests** (`apps/electron/src/renderer/hooks/useOrderQuantity.test.ts`, +7): futures formula `(balance × leverage × pct) / price`, SPOT ignores leverage, zero-balance / zero-price guards, missing-symbol-leverage falls back to 1×, `sizePercent` flows through, missing-wallet handled with balance=0.

### Notes
- Floors lifted: backend tests 5368 → 5370 (+2), frontend unit 1882 → 1889 (+7). E2E count unchanged at 179.
- Pre-existing baseline flakes (`symbol-tab-percentages`, `visual/chart.visual`) confirmed unrelated.

## [0.106.0] - 2026-04-26

Three real bugs in the indicators flow surfaced while writing the coverage you asked for. All three meant config changes from the indicator dialog never reached the chart canvas without a manual workaround. The fix is centralized in `useUserIndicators` so every surface (popover + Settings library + future) gets the sync for free.

### Fixed
- **Editing a userIndicator didn't propagate to active chart instances** (`apps/electron/src/renderer/hooks/useUserIndicators.ts`). The dialog called `userIndicators.update` and invalidated the list query, but `indicatorStore.instances[i].params` was frozen at the time `addInstance` was first called. Renderers (`renderOverlayLine`, `renderIchimoku`, …) read directly from `instance.params`, so the chart kept showing the old color / period / lineWidth / smooth / source until the user toggled the indicator off and on again. `update.onSuccess` now re-applies `variables.params` onto every active instance whose `userIndicatorId` matches — replace, not merge, since the dialog always sends the full param record.
- **Deleting from `IndicatorLibrary` (Settings → Indicators) left orphan instances.** The popover-side delete already called `removeInstancesByUserIndicatorId`, but the library forgot — so a deleted indicator's chart instance kept rendering against a dangling `userIndicatorId`. `remove.onSuccess` now does this centrally for every consumer; the popover's redundant manual call has been removed.
- **Reset of all userIndicators** wiped the server-side list but left the chart holding orphan instances. `reset.onSuccess` now wipes all client-side instances; `useAutoActivateDefaultIndicators` reseeds the chart with the refreshed catalog defaults on the next render.

### Added
- **`useUserIndicators.test.tsx` (6 tests)** — exercises every onSuccess path with seeded chart instances: update with params re-applies onto every matching instance; update without params is a no-op; remove drops only matching instances; reset wipes everything; all of them invalidate the list query.
- **`ParamFields.test.tsx` (18 tests)** — covers the four field components individually + the `ParamFields` router. NumberField (5: value render, parsed integer, parsed float, NaN-on-clear, ignore-non-numeric); BooleanField (3: render, toggle via switch root, disabled no-op); ColorField (2: current hex render, preset click commits onChange); SelectField (2: render selected option, switch via dropdown); router (6: integer / color / boolean / select schemas route correctly, default fallback when value is missing, render order matches schema definition).
- **`chart-indicators.spec.ts` (6 e2e)** — popover toggle adds an instance with the full param record (color + period + lineWidth all reach `instance.params`); toggle off removes; library shows seeded indicators with category groups + param summaries; **the regression specs**: editing an indicator from the dialog re-applies new params onto every active chart instance (period 20 → 50 reflected on the chart immediately, no toggle off/on needed); deleting via popover removes the active chart instance; resetting from Settings wipes all active instances.

### Notes
- Floors lifted: frontend unit 1858 → 1882 (+24), e2e 173 → 179 (+6). Backend test count unchanged at 5368.
- Pre-existing baseline flakes (`symbol-tab-percentages` socket-driven specs, `visual/chart.visual` snapshots) confirmed unrelated.

## [0.105.0] - 2026-04-26

Small feature on top of v0.104.0: ESC now cancels the active drawing edit the same way ESC cancels an order drag — drag-in-flight reverts the drawing back to its mousedown position, mid-placement discards the pending without committing.

### Added
- **`cancelInteraction({ revert: true })`** on `useDrawingInteraction` (`apps/electron/src/renderer/components/Chart/drawings/useDrawingInteraction.ts`). When a drag is in flight, calls `updateDrawing(originalDrawing.id, originalDrawing)` with the snapshot captured at mousedown so the drawing snaps back. When a placement is in flight, the pending is discarded — same behaviour as the existing mouseleave cancel since there is nothing on-store to revert to. Default `revert: false` preserves the v0.104.0 behaviour for the window-level mouseup safety net and for `handleCanvasMouseLeave` (drag is released in place, drawing keeps its current position).
- **ESC handler in `ChartCanvas.tsx`** now checks `drawingInteractionRef.current?.isDrawing()` first and calls `cancelInteraction({ revert: true })` if so, returning early. A subsequent ESC press still deselects + clears the active tool (existing path). The ref bridge is needed because `useTradingShortcuts` is declared earlier in the render than `useChartAuxiliarySetup`, which is what produces the actual `drawingInteraction` object.
- **Coverage** — 2 new unit tests in `useDrawingInteraction.test.ts`: revert restores `startIndex` after a drag-then-cancel; revert during placement still discards the pending without committing. 2 new e2e specs in `chart-drawings-interaction.spec.ts`: ESC during a horizontalLine drag (price reverts to the seeded value); ESC during a line placement (no commit even after the trailing mouseup).

### Notes
- Floors lifted: frontend unit 1856 → 1858 (+2), e2e 171 → 173 (+2). Backend test count unchanged at 5368.
- Pre-existing baseline flakes (`symbol-tab-percentages` socket-driven specs, `visual/chart.visual` snapshots) confirmed unrelated.

## [0.104.0] - 2026-04-26

Bug-fix release for the chart drawings layer. The "mouse grudado" symptom users hit was the visible result of five interaction bugs that compounded into a single bad experience.

### Fixed
- **Phase stuck after mouseup-outside-canvas** (`apps/electron/src/renderer/components/Chart/ChartCanvas/useChartInteraction.ts`). Releasing the mouse outside the chart canvas during a drag or mid-placement no longer leaves `phaseRef.current` stuck in `'dragging'` / `'placing-second'` / `'placing-third'`. A window-level mouseup safety net (registered via a ref so it doesn't churn on every render) now finalizes the in-flight interaction with the last-known mouse position, or cancels cleanly when the position is unknown.
- **Mouseleave didn't cancel pending placement** (same file). Cursor + tooltip cleared but the drawing-interaction phase stayed pending. Now `handleCanvasMouseLeave` calls `drawingInteraction.cancelInteraction()` so the next click on the canvas starts fresh.
- **First click on a drawing immediately entered drag mode** (`apps/electron/src/renderer/components/Chart/drawings/useDrawingInteraction.ts`). Selection logic now separates "select" from "drag": first click on an unselected drawing only selects (handles appear); a subsequent click on the body or a handle of an already-selected drawing enters drag mode. Hits directly on a handle still go straight to drag (handles only render after selection, so this only fires when the renderer + selection state are racing).
- **Zero-length cancellation** (same file) now uses `isTwoPointDrawing(...)` so it covers ray / trendLine / priceRange / ellipse / gannFan instead of just line / ruler / arrow + rectangle / area. A misclick (mousedown + mouseup at the same pixel) no longer adds a degenerate 1-pixel drawing.
- **`isDrawing` was a stale snapshotted boolean** read across renders (same file). The hook doesn't re-render between mouse events — no zustand subscription tracks `phaseRef` — so consumers like `useChartInteraction.handleCanvasMouseUp` saw a `false` even right after a mousedown that just transitioned to `'placing-second'`, and skipped the drawing's mouseup branch entirely. Drawings simply weren't getting committed under e2e tests, and were probably racing in production. `isDrawing` is now a getter `() => boolean` reading `phaseRef.current` live.
- **`isDrawing` short-circuit was eating the channel/pitchfork finalize click** (`apps/electron/src/renderer/components/Chart/ChartCanvas/useChartInteraction.ts`). The `if (drawingInteraction?.isDrawing()) preventDefault; return` guard before calling the drawing handler swallowed the mousedown that's supposed to commit a channel during phase `'placing-third'`. The drawing handler already branches on phase + tool, so the guard was redundant — removed.

### Added
- **`cancelInteraction()`** on `useDrawingInteraction` — releases drag state without reverting (the drawing freezes at its current position, mouse becomes free again) and discards pending placements (mid-placement abandons don't litter the chart).
- **19 unit tests** in `apps/electron/src/renderer/components/Chart/drawings/useDrawingInteraction.test.ts` covering the full state machine: 2-point creation (line/ray/arrow/trendLine), zero-length cancellation across all 5 newly-covered types via `it.each`, three-point creation (channel placing-second → placing-third → idle), freeform (pencil), single-click types (text/horizontalLine/verticalLine/anchoredVwap), selection-vs-drag (4 cases including locked drawings and empty-space deselect), and `cancelInteraction` (3 cases including drag-release without revert).
- **16 e2e specs** in `apps/electron/e2e/chart-drawings-interaction.spec.ts` covering creation flows for line / ray / arrow / trendLine / horizontalLine / verticalLine / pencil / channel; zero-length cancellation per 2-point type; the stuck-mouse regressions (mouseup-outside-canvas during drag, mouseleave-mid-placement); DrawingToolbar tool-button state transitions including same-button-toggle-off.

### Changed
- **`useChartInteraction.drawingPan.test.ts`** existing mock + invariant updated for the new `isDrawing()` getter shape and the `cancelInteraction` field. The old assertion *"drawing.handleMouseDown is NOT called while drawing"* was inverted into the correct one *"drawing.handleMouseDown MUST be called so it can finalize, and pan must NOT receive the click"*.

### Notes
- Floors lifted: frontend unit 1837 → 1856 (+19), e2e 155 → 171 (+16). Backend test count unchanged at 5368.
- Pre-existing baseline flakes (`symbol-tab-percentages` socket-driven specs, `visual/chart.visual` snapshots) confirmed unrelated.

## [0.103.0] - 2026-04-26

Bug-fix release. The Analytics modal had two related issues that produced contradictory cards on the same screen — both fixed here, with regression coverage at every layer.

### Fixed
- **`analytics.getPerformance` — period-aware `totalReturn`** (`apps/backend/src/routers/analytics/trades.ts`). Before this fix, `totalReturn` was always derived from the all-time wallet balance (`(currentBalance - effectiveCapital) / effectiveCapital`) regardless of the period selected. That produced screens like "Net PnL +$615.85 / Total Return -37.86%" on the same Week filter — opposite signs for the same period. Now: for `period === 'all'` the calculation is unchanged; for `'day' | 'week' | 'month'` it's `(netPnL / effectiveCapital) * 100`, sign-consistent with `netPnL` by construction.
- **`analytics.getPerformance` — single source of truth for `netPnL`** (same router). Previously `netPnL` was overridden with `getDailyIncomeSum` (Binance income — REALIZED_PNL + COMMISSION + FUNDING_FEE) when a period was selected, while W/L count, `avgWin`, `avgLoss`, `profitFactor`, and `largestWin`/`largestLoss` were always computed from per-trade `tradeExecutions.pnl`. Funding paid on currently-open positions slipped into `netPnL` but never into the trade-level metrics, breaking the math users expect: `W × avgWin + L × avgLoss == netPnL`. Now all metrics come from the same `tradeExecutions.pnl` sum so the identity always holds. `totalFunding` (already returned in the payload) is now displayed separately in the UI as `Gross · Fees · Funding` so the funding component stays visible without polluting `netPnL`.

### Changed
- **`PerformancePanel` Net PnL subtext** (`apps/electron/src/renderer/components/Trading/PerformancePanel.tsx`) now shows `Gross · Fees · Funding` when `totalFunding !== 0`. When funding is exactly zero (e.g. SPOT-only wallets, paper wallets) the line collapses back to `Gross · Fees`.

### Added
- **Backend regression tests** (`apps/backend/src/__tests__/routers/analytics.router.test.ts`, +2 cases):
  - `should keep totalReturn sign-consistent with netPnL across periods` — seeds a recent winner + an older loser, then asserts `Math.sign(netPnL) === Math.sign(totalReturn)` for both `day` and `month` periods.
  - `should keep netPnL = sum(trade.pnl) so W × avgWin + L × avgLoss matches` — stuffs a stray `FUNDING_FEE` income event into the period; under the old implementation it would have polluted `netPnL` and broken the W/L math identity.
- **Frontend unit tests** (`apps/electron/src/renderer/components/Trading/PerformancePanel.test.tsx`, 9 cases): renders all 9 metric cards, positive/negative `totalReturn` formatting, `Gross / Fees / Funding` conditional subtext, W/L summary line, period button → `setPerformancePeriod`, loading + no-data branches.
- **E2E** (`apps/electron/e2e/analytics-modal.spec.ts`, 7 specs): toolbar trigger toggle, all metric labels render, period buttons each trigger `analytics.getPerformance` re-fetch, `totalReturn` sign flips when switching from `All Time` → `Week` (the actual regression visible to the user), `Gross · Fees · Funding` subtext, no-wallet state.

### Notes
- Floors lifted: backend tests 5366 → 5368 (+2), frontend unit 1828 → 1837 (+9), e2e 148 → 155 (+7).
- The 4 pre-existing baseline flakes (`symbol-tab-percentages` socket-driven specs, `visual/chart.visual` snapshots) confirmed unrelated.

## [0.102.0] - 2026-04-26

Closes the largest e2e gap in the app: **auto-trading was at zero specs** before this release. Mirrors the coverage shape that just shipped for Backtest (v0.100.0) and Screener (v0.101.0).

### Added
- **Auto-trading e2e — 8 new spec files (45 tests)** under `apps/electron/e2e/auto-trading-*.spec.ts`:
  - `auto-trading-sidebar-toggle.spec.ts` (6) — toolbar `LuBot` toggle, three-tab render (Watchers / Scalping / Logs), default tab, last-active-tab persistence after close+reopen, `autoTradingSidebarTab` `syncUI` write-through.
  - `auto-trading-watchers-tab.spec.ts` (8) — empty-state CTA, populated-state with badge + Stop All, `stopAllWatchers` mutation flow, `DirectionModeSelector` triggering `updateConfig`, position-size slider committing on release, watcher-row click-through, no-wallet warning.
  - `auto-trading-start-watchers-modal.spec.ts` (6) — open/close, default header (Spot/Futures/Timeframe/count), market-type switch triggering `getFilteredSymbolsForQuickStart` re-fetch, direction-mode buttons firing `updateConfig`, Start Top N firing `startWatchersBulk` + closing the modal, disabled-state with empty filtered symbols.
  - `auto-trading-add-watcher-dialog.spec.ts` (3) — single-mode default render, single↔bulk mode toggle changing the submit label, single-mode submit firing `startWatcher`.
  - `auto-trading-logs-tab.spec.ts` (6) — empty waiting line, single `autoTrading:log` socket event appending a line, multi-event ordering, `Clear logs` button wiping the buffer, font-size +/− controls altering computed `font-size`, error-level lines rendering in red.
  - `auto-trading-watcher-manager.spec.ts` (10) — Settings → Auto-Trading entry path, Trading Mode auto/semi-assisted toggle, all major collapsible section headers visible, Emergency Stop confirm/cancel/confirm flow with `emergencyStop` mutation, Position Size + Risk Management + Trailing Stop section expansion.
  - `auto-trading-socket-invalidations.spec.ts` (5) — `order:update` invalidating `trading.getOrders`, `order:created` invalidating both orders + wallet, `position:update` invalidating `autoTrading.getActiveExecutions`, `wallet:update` invalidating `wallet.list`, smoke test that arbitrary unhandled events don't crash the page.
  - `electron/auto-trading-sidebar.spec.ts` (1) — packaged-Electron smoke: trigger opens the sidebar, all three tabs visible, switching to Logs renders the waiting line, toggle closes — using `installTrpcMockOnContext` per the `page.route × Vite` rule documented in `docs/BROWSER_TESTING.md` Layer 4.

- **uiStore unit coverage — 10 new tests** in `apps/electron/src/renderer/store/uiStore.test.ts` for the auto-trading slice: `autoTradingSidebarOpen` toggle/setter, `autoTradingSidebarTab` accepting all three values via `it.each`, `setWatchersTableSort` updating both key + direction independently.

### Changed
- **`e2eBridge.installE2EBridge()`** now exposes `window.__uiStore` (the full Zustand `useUIStore`) so e2e specs can seed `activeWalletId` directly without going through the wallet picker UI. Gated on `IS_E2E_BYPASS_AUTH` — zero production impact.
- **New `exposeGlobalActionsForE2E(actions)` helper** + `window.__globalActions` bridge, wired via `useEffect` in `apps/electron/src/renderer/components/Layout/MainLayout.tsx`. Lets specs open the Settings dialog programmatically (avoiding the user-avatar menu traversal).

### Notes
- Floors lifted: e2e 103 → 148 (+45), frontend unit 1818 → 1828 (+10). Backend test count unchanged at 5366.
- Pre-existing baseline flakes in `symbol-tab-percentages.spec.ts` and `visual/chart.visual.spec.ts` confirmed unrelated — same failures present on `develop` HEAD before this PR landed.
- Implementation plan archived at `docs/plans/auto-trading-e2e.md`.

## [0.101.0] - 2026-04-26

Quality-of-life follow-up to the v0.100.0 Backtest ship: comprehensive e2e + unit coverage for the **Screener modal** (previously zero specs), plus a small but load-bearing fix to the e2e helper.

### Added
- **Screener modal — comprehensive e2e coverage** (`apps/electron/e2e/screener-modal-flow.spec.ts`, 22 tests). Mirrors the Backtest modal's coverage depth: trigger toggle + Escape close, header `Select`s for asset class / market / interval (with hit-count-bumped `screener.run` assertions), `usePortal=false` validation so dropdown clicks land inside the dialog, `PresetBar` rendering + active-preset toggling + preset-A→preset-B switching, `FilterBuilder` add/remove + Clear All, mutual exclusion of preset vs custom filters, footer Save gating + `SaveScreenerDialog` flow with name validation, saved-screeners load/delete, results-table rendering + sortable column headers + row-click wiring, refresh button hit-count delta, empty-state message, loading spinner during in-flight `screener.run` (delayed mock), and error block on `NOT_FOUND` short-circuit.
- **Screener modal — packaged-Electron coverage** (`apps/electron/e2e/electron/screener-modal.spec.ts`, 3 tests). Uses `installTrpcMockOnContext` so the renderer boots inside the actual Electron main process: confirms toolbar trigger opens dialog with header Selects visible, opening the modal fires `screener.run` and clicking a preset chip fires `screener.runPreset`, Escape closes + reopen still works.
- **Screener store unit coverage** (`apps/electron/src/renderer/store/screenerStore.test.ts`, 18 tests). Covers `toggleSort` cycle (asc↔desc on same field, reset-to-desc on field switch), `clearFilters` resetting both `customFilters` and `activePresetId`, `updateFilter` partial-merge by id, `hydrate` accepting partial-key payloads without clobbering unset fields, plus the open/close + asset/market/interval setters.

### Fixed
- **`installTrpcMock` now awaits resolvers** (`apps/electron/e2e/helpers/trpcMock.ts`). `buildBatchResponse` was synchronously mapping resolvers — async overrides (e.g. `delayRunMs` for loading-state specs) returned a `Promise` that `JSON.stringify` serialized as `{}`, leaving the consumer with `data.results === undefined` and the page caught by the React error boundary. Now Promise-aware, fully backwards-compatible for sync resolvers.

### Notes
- Floors lifted: frontend unit 1800 → 1818 (+18), e2e specs 78 → 103 (+25 — 22 chromium + 3 electron). Backend unit count unchanged at 5366.
- Pre-existing baseline flakes (`symbol-tab-percentages`, `visual/chart.visual`) confirmed unrelated to this change — same failures present on the `develop` HEAD before this PR landed.

## [0.100.0] - 2026-04-26

First user-facing feature ship after the v0.99.x performance + quality stabilization run: a complete in-app **Backtest** experience plus the e2e infrastructure to keep it honest.

### Added
- **Backtest UI modal** (`apps/electron/src/renderer/components/Backtest/`). Toolbar trigger (next to the Screener button) and `Cmd/Ctrl+Shift+B` shortcut open a 4-tab dialog wired to the existing `BacktestEngine`:
  - **Basic** — symbol (via `SymbolSelector`), market type, interval, dates, initial capital, leverage (FUTURES-only conditional)
  - **Strategies** — checkbox grid driven by `setupDetection.listStrategies`; status badges, recommended-timeframe mismatch warning, bulk Select all / Defaults / Clear, "Show experimental" toggle
  - **Filters** — driven by the new `FILTER_DEFINITIONS` taxonomy; toggles + sub-params grouped by family (trend / momentum / volume / volatility / session / confluence) inside `CollapsibleSection`s
  - **Risk** — sizing, stops, fibonacci (long/short split), cooldown, futures simulation
  Submit gates on `simpleBacktestInputSchema.safeParse`; a "Recent runs" panel below the form shows the last 5 cached results.
- **Live progress channel** — `backtest:progress` / `backtest:complete` / `backtest:failed` events emitted to the user's socket room with phase, processed/total, and an honest ETA (clamped to `null` until > 5% has run, smoothed client-side).
- **`BacktestProgressReporter`** (`apps/backend/src/services/backtesting/`) — thin reporter threaded through `BacktestEngine.run` and `MultiWatcherBacktestEngine.run`; treats a missing `wsService` as no-op so the CLI path is unchanged. Mirrors the existing `BacktestOptimizer.onProgress(current, total)` signature so optimizer adoption is mechanical.
- **Shared Zod schema** — `packages/types/src/backtest-input.ts` (`simpleBacktestInputSchema`, `multiWatcherBacktestInputSchema`, `getDefaultBacktestInput`) and `packages/types/src/backtest-filter-definitions.ts` (`FILTER_DEFINITIONS`, `FILTER_GROUPS`). Single source of truth for the engine, the tRPC router, the modal, and any future CLI client. `DEFAULT_ENABLED_SETUP_IDS` exported alongside.
- **`installTrpcMockOnContext`** (`apps/electron/e2e/helpers/trpcMock.ts`) — Electron-friendly tRPC mock that uses `addInitScript` fetch monkey-patch instead of `page.route`. Necessary because `page.route` enables CDP request interception that conflicts with Vite's ESM loader inside the Electron renderer (see Notes below).

### Changed
- **`backtest.simple.run` / `backtest.multiWatcher` mutations** now return `{ backtestId }` immediately and run the engine fire-and-forget. Result is fetched via the existing `getResult({ id })` query once `backtest:complete` arrives. Both routers consume the shared Zod schema, expanding the public-API surface to every filter the engine already supported (FVG, choppiness, session, supertrend, direction, bollinger squeeze, partial exits, market context).
- **Toolbar gains a Backtest icon** (`LuFlaskConical`) next to the screener trigger, wired to `useBacktestModalStore`.
- **Documentation** (`docs/BROWSER_TESTING.md` Layer 4, plus a `CLAUDE.md` warning) — captures the page.route × Electron × Vite incompatibility and the `installTrpcMockOnContext` workaround so future agents don't waste time rediscovering the trap.

### Fixed
- **Electron smoke spec was failing on `develop`** — pre-existing canvas-doesn't-mount + `__mmPerf` undefined. Root cause: `page.route()` in Electron breaks Vite's ESM loader on reload (every `/src/**` and `@vite/client` request fails with `net::ERR_FAILED`, even when the route pattern matches none of those URLs — confirmed empirically). Switching the Electron-only adapter to `addInitScript` fetch override resolved both failures.
- **`base-chart-canvas.png` and `chart-with-ema.png` visual goldens drifted** vs the recorded baselines (~4% pixel diff). Reproduced on `develop` — environmental drift, not regression. Regenerated via `--update-snapshots`.

### Notes
- Test floor lifts: backend **5,366** (was 5,352), frontend unit **1,800** (was 1,789), full e2e gauntlet **78 / 78** across chromium / visual-regression / perf / electron projects.
- New `BacktestProgressPayload` / `BacktestCompletePayload` / `BacktestFailedPayload` are typed end-to-end through `ServerToClientEvents`.

## [0.99.3] - 2026-04-25

Follow-up to v0.99.2's chart performance overhaul. v0.99.2 had the right architecture (Wave 1's `React.memo` with structural comparator on `ChartCanvas`) but missed a stable callback in the parent — so the memo never actually short-circuited. v0.99.3 fixes that and pins the new perf baseline so CI catches any regression.

### Fixed
- **`ChartCanvas` memo wasn't firing in production** — `ChartPanelContent` was passing `onNearLeftEdge={hasMore ? () => { void loadOlderKlines(); } : undefined}`, an inline arrow recreated on every parent render. Wave 1's structural comparator correctly detected `prev.onNearLeftEdge !== next.onNearLeftEdge` and forced a re-render, defeating the optimization. The perf-test page snapshot showed `ChartCanvas#BTCUSDT@1h` re-rendering ~105×/s under tick storm despite Wave 1 — the cascade was untouched. Wrap `onNearLeftEdge` in `useCallback` (`loadOlderKlines` from `useKlinePagination` is already stable). Memo now actually skips on live ticks; perf tests confirm the win.
- **Electron-builder uploaded zero binaries to v0.99.1 / v0.99.2 releases** — the desktop-release workflow runs `electron-builder --publish always`, but our config left `releaseType` at the default `draft`. The release process creates the GitHub release as finalized BEFORE the build, so when electron-builder tried to publish a "draft" to an existing "release", it logged `existing type not compatible with publishing type` and skipped every artifact. Manual recovery for v0.99.2 (toggle release to draft → re-run workflow → publish) brought the assets back. Pinning `releaseType: 'release'` in `apps/electron/electron-builder.js` prevents the recurrence.

### Changed
- **`apps/electron/e2e/perf/baseline.json` refreshed** to lock in the post-overhaul render rates as the new floor:
  - `kline-append`: 166.66 → 0 renders/s
  - `many-drawings`: 44.84 → 0
  - `kline-replace-loop`: 28.01 → 0
  - `price-tick-storm`: 6.51 → 0
  Future PRs that regress the React.memo path will fail the perf suite's `assertRegression`.

### Notes
- Multi-PR delivery: #142 (release-type fix), #144 (`onNearLeftEdge` callback), #145 (baseline refresh).
- Verified end-to-end: `pnpm --filter @marketmind/electron test:perf` runs all 18 perf scenarios green; `assertRegression` passes against the new baseline; full unit + browser + backend suites unchanged (1,782 + 97 + 5,352 passing).

## [0.99.2] - 2026-04-25

Chart performance overhaul — multi-wave initiative to fix the cross-chart re-render fan-out users see when running 2+ chart panels in the grid. With one chart the UI was fluid; with 2+ each kline tick / focus change / hover event was waking many panels at once. This release decouples the canvas from React's per-tick render path, narrows store fan-out to per-symbol/per-chart, and prunes redundant resize/store work in the render pipeline.

Plus a CI hotfix that unblocks the `Lint & Type Check` and `Dependency Audit` jobs that had been silently failing on develop.

### Performance
- **`ChartCanvas` decoupled from per-tick re-renders** — `useKlineLiveStream` now exposes a stable `klineSource` (ref + RAF-flushed subscribe). `ChartCanvas` is wrapped in `React.memo` with a structural comparator that returns "equal" when only the live candle's OHLC changed. The canvas redraws via `manager.markDirty('klines')` from the imperative subscribe, without re-executing the component body or its ~25 sub-hooks. Structural changes (new candle, symbol/timeframe switch) still go through React so indicators / state still update.
- **Per-symbol price subscribe** — `ChartCanvas` swapped global `usePriceStore.subscribe` for the existing per-symbol `subscribeToPrice(symbol, cb)`. Charts no longer wake on unrelated symbols' price ticks.
- **Narrow store subscribers** — `strategyVisualizationStore` and `setupStore` now use `subscribeWithSelector` middleware. The `ChartCanvas` listeners pass a slice selector + listener pair, so they only fire when `highlightedCandles` / `detectedSetups` actually change — not on unrelated mutations like `setActiveStrategy` or `setLoading`.
- **`focusedPanelId` boolean selector** — `ChartGridPanel` was selecting the focused-panel-id string, so EVERY panel re-rendered on any focus change. Now selects `s.focusedPanelId === panelConfig.id` (boolean). Only the previously-focused and newly-focused panels re-render.
- **`getActiveLayout` decomposed** — `ChartGrid` was calling a method inside its selector (`useLayoutStore(s => s.getActiveLayout())`), which triggers re-runs on every store mutation. Replaced with three primitive selectors + `useMemo` to derive `activeTab` and `activeLayout`. No spurious re-renders on unrelated layoutStore writes.
- **RAF-throttled `ResizeObserver`** in both `useChartCanvas` and `CanvasManager.observeResize`. During grid drag/resize, multiple resize events within the same frame coalesce to a single resize + redraw.
- **Memoized contexts and JSX**: `PinnedControlsContext` provider value (`useMemo` + `useCallback`), `ChartGridPanel` header HStack (`useMemo`).
- **`orderFlashStore` batch lookup** — `useOrderLinesRenderer` now reads the flash-times Map once at the top of `renderOrderLines` instead of calling `useOrderFlashStore.getState().getFlashTime(orderId)` per order per frame.
- **tRPC invalidation flush window** in `RealtimeTradingSyncContext` bumped from 16ms to 100ms. Under realtime event storms (rapid position / order / wallet updates), invalidations now coalesce into a single flush instead of firing every frame.

### Added
- **`chart.perf` overlay extensions** (`apps/electron/src/renderer/utils/canvas/perfMonitor.ts`) — counters for per-instance `ChartCanvas` renders (keyed `<symbol>@<timeframe>`), store wakes per imperative subscriber (`priceStore`, `setupStore`, `strategyVisualizationStore`, `tooltipStore`), and socket dispatch handler-counts. The overlay (`ChartPerfOverlay`) gains "store wakes/s" and "socket handlers/s" sections. All counters early-return when the flag is off — zero overhead in normal use. New `docs/CHART_PERF_BASELINE.md` documents the measurement recipe (2×2 grid, 60-s windows for idle/hover/focus/pan scenarios).

### Fixed
- **CI: `Lint & Type Check` job** — `packages/fibonacci` and `packages/logger` imported `@marketmind/types` from src but didn't declare the dependency in `package.json`, so pnpm couldn't compute the correct topological build order; the job had been silently failing on develop since Waves 6/7/8 of the previous quality overhaul. Adding the deps revealed a circular dep — `packages/types/src/trading-config.ts` re-exported `FIBONACCI_TARGET_LEVELS` from `@marketmind/fibonacci`, but `git grep` confirmed every consumer already imported the symbols directly from `@marketmind/fibonacci` so the re-export was dead. Removed it.
- **CI: `Dependency Audit` job** — `pnpm install --frozen-lockfile` was failing with HTTP 502 from electron's binary CDN. The audit doesn't need the binary; pass `--ignore-scripts` and set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
- **CI: pact `Run Tests` flake** — pact mock servers grab random ports per `executeTest`, and vitest's default parallel file execution would race two contract tests onto the same port on CI's smaller runner. New `contracts` vitest project with `pool: 'forks'`, `fileParallelism: false`, `retry: 2`. Unit project excludes contract tests; CI runs both as separate steps.

### Notes
- Multi-wave plan and per-wave PRs: #136 (Wave 0 — instrumentation), #137 (Waves 2/3/4/5/8 mechanical), #138 (Wave 1 + Wave 7 partial), #139 (Wave 6 + Wave 4). Plus #132 (CI build-order fix) and #134 (CI audit + pact fix).
- Behavior preserved: 1,782 unit + 97 browser tests pass throughout. Smoke-test the live candle on a 2×2 grid after upgrading — if anything looks frozen (tooltip lag, indicator stuck, drawing snap fails on the live candle), the consumer needs to migrate to `klineSource.subscribe`.
- Deferred (await measurements before tackling): incremental indicator append-only path, dirty-layer split (crosshair vs full overlay), `walletAutoTradingConfig` hoist to a shared parent hook, `getActiveExecutions` server-side symbol filter.

## [0.99.1] - 2026-04-25

Quality overhaul release — eight-wave initiative covering the lint config, the type system, and the `@marketmind/types` package architecture. No user-facing changes; entirely internal refactor + rule tightening. Backend went from ~999 lint warnings + ~360 `any` to **0 lint errors / 603 warnings** with `no-explicit-any` now enforced as `error` in `apps/backend/src` (test mocks and CLI scripts keep `warn` as an intentional escape hatch).

### Changed
- **Lint rule promotions across both apps** — `prefer-nullish-coalescing`, `prefer-optional-chain`, `no-unnecessary-type-assertion`, `react-hooks/exhaustive-deps` graduated from `warn` to `error`. `explicit-function-return-type` reconfigured with `allowExpressions/allowTypedFunctionExpressions/allowHigherOrderFunctions`. Electron `no-magic-numbers` ignore list tightened (`[2, 4, 7, 12, 24, 60, 100, 1000]`, `ignoreEnums`, `ignoreNumericLiteralTypes`).
- **New advanced typescript-eslint rules enabled as `error`**: `switch-exhaustiveness-check`, `no-base-to-string`, `restrict-template-expressions`, `no-unsafe-enum-comparison`, `only-throw-error`.
- **Imports + tests linting** — added `eslint-plugin-import-x` (import order, no-cycle, no-duplicates) and `eslint-plugin-vitest` (recommended preset, no-focused / no-disabled) across both apps. `eslint-plugin-jsx-a11y` recommended preset added in electron.
- **`@marketmind/types` package restructured** — trading domain split into `trading/order.ts`, `trading/setup.ts`, `trading/profile.ts`, `trading/config.ts`. `indicators.ts` and `indicator-constants.ts` merged. `TradeNotificationPayload` and other event payloads rewritten as discriminated unions on `type`. New `utils.ts` exposes `Brand<T,K>`, `Result<T,E>`, `NonEmptyArray<T>`. Type-level tests (`__tests__/`) lock in invariants via `expectTypeOf`.
- **TS compiler strictness sweep** — verified `strict`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables` are all on consistently across workspaces.

### Added
- **Canonical types replacing inline string-literal unions** — `PositionSide`, `OrderSide`, `MarketType`, `TimeInterval`, `FuturesOrderType`, `EntryOrderType`, `SetupSuggestionStatus`, `TradeExecutionStatus`, `ExitReason`, `WalletType`, `IndicatorId` (derived from a const-asserted array). Replaced ~214 inline `'LONG' | 'SHORT'` across 79 files and ~95 inline `'SPOT' | 'FUTURES'` across 60 files. DB schema columns now use `$type<...>()` to enforce the canonical types end-to-end.
- **Branded ID types** — new `packages/types/src/branded.ts`: `WalletId`, `UserId`, `OrderId`, `SetupId`, `ExecutionId`, `ProfileId`, `SymbolString`, `StrategyId`. Each ID flows through tRPC routers as a structurally-checked nominal type, preventing the "passed walletId where userId was expected" class of bug at compile time.
- **Typed Binance adapters** — `BinanceKlineTuple` + `ParsedKline` shapes replace `Promise<any[]>` in `binance-historical.ts`. `BacktestEngine`, `BacktestOptimizer`, `FuturesBacktestEngine`, `TradeExecutor`, `FilterManager` consume `Kline`, `TradingSetup`, `TradeResult`, `BacktestMetrics` from `@marketmind/types`.

### Removed
- `packages/types/src/indicator-results.ts` (544-line dead duplicate of `indicators.ts`).
- Duplicate `ExchangeId` declaration in `apps/backend/src/exchange/types.ts` — the package version is now the single source of truth.
- Trailing inline `import('./tradingSetup').TradingSetup[]` and `import('./kline').Kline[]` references in `packages/types/src/backtesting.ts` (replaced with top-level imports for a readable dependency graph).

### Notes
- Plan + per-wave PRs: #120 (Wave 0 — cleanup), #121 (Wave 1 — inline-union reconciliation), #122 (Wave 2 — new canonical types), #123 (Wave 3 — rule promotions), #124 + #129 (Wave 4a + 4b — `any` elimination, ~360 → 0 in src), #125 (Wave 5 — advanced typescript-eslint rules), #126 (Wave 6 — branded IDs), #128 (Wave 7 — types package architecture polish), #127 (Wave 8 — TS compiler strictness sweep).
- 5,352 backend tests + full electron + packages suites all green throughout. Zero behavioral changes shipped — every wave was verified with the full test gauntlet before merging.

## [0.99.0] - 2026-04-25

### Added
- **Unified socket architecture** — typed events/rooms (`packages/types/src/socket-events.ts`), refcounted room subscriptions, single dispatcher with RAF-coalesced fan-out for high-rate events (`price:update`, `kline:update`, `aggTrade:update`, `depth:update`, `bookTicker:update`, `scalpingMetrics:update`). Frontend `socketBus` replaces `socketService`; backend collapses 13 hand-written `socket.on('subscribe:*')` into one ROOM_HANDLERS table.
- **Per-symbol price subscribers** — new `priceStore.subscribeToPrice(symbol, cb)` keeps non-active symbol-tab badges live without waking every consumer on every tick. Fixes the regression where only the active tab's percentage updated in real time.
- **Tab/chart-viewed symbols stay subscribed** across the price-stream reconcile window (was the user-visible bug). Reconcile now needs = open positions ∪ active subscription rooms, and the safety-net interval was widened from 5 → 30 minutes.
- **Beta badge** UI primitive (`components/ui/beta-badge.tsx`); Screener modal title carries it. **Custom Symbols** moved from a standalone modal into a Settings tab (also marked beta). README + landing site (4 locales) flag both as "(beta)".

### Changed
- **Bumped every external dep to latest** across the monorepo (9 package.json files). Major bumps with migration: `electron 39 → 41`, `vite 7 → 8 (Rolldown)`, `typescript 5.9 → 6.0`, `eslint 9 → 10`, `vitest 3 → 4` (packages aligned), `i18next 25 → 26 + react-i18next 16 → 17`, `pino 9 → 10`, `jsdom 27 → 29`, `globals 16 → 17`. `pnpm outdated -r` reports zero outdated packages.
- **TypeScript 6 fallout**: removed deprecated `baseUrl` from electron tsconfig (paths still resolve); set `noUncheckedSideEffectImports: false` for CSS side-effect imports.
- **ESLint 10 fallout**: 21 new dead-code findings fixed across 13 backend + 1 frontend file (`no-useless-assignment`, `preserve-caught-error`).
- **Vite 8 fallout**: rewrote `manualChunks` from object → function (Rolldown rejects the object form); switched from `vite-plugin-electron/simple` to the regular API to avoid the now-deprecated `inlineDynamicImports` flag in the preload bundle.
- **Electron 41 fallout**: migrated `webContents.on('console-message', ...)` to the new single-event-object signature.
- **`source='chart'` 30 s gate dropped** — strict timestamp-monotonic wins so WS ticks never get blocked by chart writes.
- **Aggregate-trade public stream** (`@aggTrade`) replaces `@trade` for live-price feed (Binance SDK regression: `subscribeTrades` routed to `usdmPrivate` and 400'd; `subscribeAggregateTrades` correctly hits `usdmMarket`).
- **`pnpm-workspace.yaml`** allowlist key fixed: `ignoredBuiltDependencies` → `onlyBuiltDependencies` so electron's binary install actually runs on bumps.

### Removed
- `vite-plugin-electron-renderer` — our renderer doesn't import any Node/Electron module (uses `contextBridge` via preload). Eliminated the `customResolver` deprecation it injected.
- `eslint-plugin-react` — only used to disable two rules that aren't needed in React 19 + TS. Deleted plugin and its rule entries.
- `react-virtualized-auto-sizer` and 3 deprecated `@types/*` packages (libs ship their own types now).
- Frontend dead code from the socket refactor: `services/socketService{,test}.ts`, `hooks/useWebSocket{,test}.ts`, `CustomSymbols/CustomSymbolsModal.tsx`.
- Redundant polling: `trading.getTickerPrices` (live via priceStore + WS).

### Fixed
- **`fees = exitFee` race** — `getAllTradeFeesForPosition` could return `exitFee=0` before the closing trade was indexed; guarded with `> 0`.
- **`accumulatedFunding` double-count** — funding was re-added every hourly sync when status was already closed; now skipped.
- Type cascade after the React-error-boundary 6.x bump (`ErrorBoundary` rewritten with an `unknown → Error` helper).
- Unsafe `x?.foo !== null` patterns in `MarketIndicatorCharts` exposed by stricter typescript-eslint.

### Notes
- Two CI flakes surfaced and were resolved in-flight: an integration-only test (`applyTransferDelta`) was running in the unit project (added to `INTEGRATION_SERVICE_TESTS`); a CodeQL "incomplete escaping" alert in an E2E spec (`replace('%','').replace('+','')` only strips first occurrence — switched to `/[%+]/g`).
- Two upstream peer warnings silenced via `pnpm.peerDependencyRules.allowedVersions`: `vite-plugin-pwa` doesn't yet declare vite 8 in its peer range (works in practice; only loaded for web builds anyway).

## [0.98.3] - 2026-04-24

### Added
- **Real-time deposit/withdrawal handling** — Spot user-data stream now dispatches `outboundAccountPosition` (overwrites `currentBalance`), `balanceUpdate` (routes through the shared `applyTransferDelta` writer), `listenKeyExpired`, and `eventStreamTerminated` (close + 1 s + resubscribe, mirroring the futures pattern). Was previously only handling `executionReport`.
- **Futures `ACCOUNT_UPDATE` transfer reasons → real-time totals** — when `m` is `DEPOSIT`, `WITHDRAW`, `TRANSFER`, `INTERNAL_TRANSFER`, `ADMIN_DEPOSIT`, or `ADMIN_WITHDRAW`, the USDT delta now also bumps `wallets.totalDeposits`/`totalWithdrawals` (alongside the existing `currentBalance` overwrite). Other reasons keep the direct-update path.
- **Hourly REST income-sync becomes reconciliation** — `takeOverSyntheticTransferRow` finds the matching synthetic sibling (same wallet, |amount| match, ±60 s) for each TRANSFER record, deletes it, lets the real Binance `tranId` row insert, and skips the totals bump for that record so we don't double-count.
- **Single-source-of-truth helpers**: `services/income-events/syntheticTranId.ts` (paper close + real-time both consume it), `services/wallet-balance/applyTransferDelta.ts` (the only writer that touches `currentBalance + totals + synthetic income_event` in a single DB transaction), `constants/income-types.ts::TRANSFER_REASONS`, expanded `services/user-stream/types.ts` (sole registry of Binance WS event payload types — spot + futures), and `services/user-stream/dispatcher.ts` (typed `switch(e)` helper shared by both streams).

### Changed
- **Futures stream**: `TRADE_LITE`, `STRATEGY_UPDATE`, `GRID_UPDATE` now have explicit trace-only cases instead of falling through to the `default:` "Unhandled event type" warn — these were polluting prod logs.
- `binance-user-stream.ts` no longer carries an inline `OrderUpdateEvent` type; consumes the shared `SpotExecutionReport` from `user-stream/types.ts`.

### Notes
- New tests: `syntheticTranId` (monotonic / negative / collision-free), `applyTransferDelta` (deposit, withdrawal, `newBalance` override, zero no-op), spot-stream dispatch coverage for the 4 new events, `handle-account-events` transfer-routing branches, `syncFromBinance` takeover (sibling found / amount mismatch / out-of-window cases), and futures-stream trace-only behavior for TRADE_LITE/STRATEGY_UPDATE/GRID_UPDATE.
- A `BaseUserStreamService` extraction was deliberately deferred — spot manages its listenKey via REST keepalive, futures via SDK subscribe; merging the two lifecycles loses more clarity than it saves duplication.

## [0.98.2] - 2026-04-24

### Changed
- **Docs + landing-site cleanup** — removed Interactive Brokers / stocks references from every public surface (README, landing site across all 4 locales, package keywords, screener plan). The exchange abstraction code under `apps/backend/src/exchange/interactive-brokers/` stays intact; the feature is simply no longer advertised while stock support is incomplete. Landing site's `stats.exchanges` drops from 2 → 1 and the "Multi-Exchange" feature card is reframed as "Binance Integration".

### Removed
- `docs/INTERACTIVE_BROKERS_INTEGRATION.md` — planning doc for an unshipped feature.
- `docs/EXCHANGE_ABSTRACTION_PLAN.md` — internal refactor plan whose motivation (IB support) isn't part of the shipped product.

## [0.98.1] - 2026-04-23

### Fixed
- **2-click drawing leaves chart panning with mouse** — when drawing a 2-point tool (ray, line, rectangle, etc.) via two discrete clicks, the second click fell through `handleCanvasMouseDown` to the pan handler (drawing returned `false` because `phase='placing-second'` didn't match the initial-click branches), setting `isPanning=true`. The subsequent mouseup finalized the drawing via an early-return path that skipped `handleMouseUp()`, leaving `isPanning` stuck and making the chart follow the cursor. Part 10's `isPanning` short-circuit in `handleCanvasMouseMove` made the stuck state more obvious by fully suppressing hit-tests. Fix: `handleCanvasMouseDown` now checks `drawingInteraction.isDrawing` first and swallows the event before reaching the pan handler; `handleCanvasMouseUp` always calls `handleMouseUp()` even when drawing claims the event (belt-and-suspenders). New hook-level test suite `useChartInteraction.drawingPan.test.ts` locks in the regression.

### Added
- **Stream health watchdog + synthesized klines + header degradation dot** — when Binance Futures (or another exchange) silently drops specific stream types (`@kline_*`, `@aggTrade`, `@markPrice`) while keeping the WS connection "open" and other streams (`@bookTicker`, `@trade`) alive, position P&L kept updating but the chart froze. Restart of app or host didn't help because the backend WS connection stayed in a zombie state. Confirmed as external (Binance-side) incident via direct WS probing: `@trade` ✅, `@bookTicker` ✅, `@kline_*` / `@aggTrade` / `@markPrice` ❌ (0 frames in 10 s while the connection appeared open).
  - **Backend watchdog** — both `BinanceKlineStreamService` and `BinanceFuturesKlineStreamService` now track `lastMessageAt` + `healthStatus` per subscription. A 15 s watchdog marks anything silent > 60 s as `degraded` (warns + emits `stream:health` via socket.io) and triggers a forced reconnect (`closeAll(true)` + `start()` + resubscribe) once per 120 s cooldown window. Recovery (either a new frame arriving or silence < threshold on next check) flips the status back to `healthy` + emits.
  - **Synthesized klines while degraded** — new `KlineSynthesisService` (`services/kline-synthesis.ts`) owns its own WS client subscribed to `@trade` (which stays alive during kline degradation). On degradation the stream service calls `klineSynthesisService.enable(symbol, interval, marketType)`; the service aligns each trade to the interval's bucket boundary, accumulates OHLCV, emits progressive updates (≤ 1 every 200 ms) via the same `emitKlineUpdate` channel, and emits `isClosed: true` when a new bucket begins. On recovery (or unsubscribe), `klineSynthesisService.disable(...)` cleans up state for that combo so native frames take over. Frontend consumers need no change — `kline:update` flows through the same socket room.
  - **Frontend health hook + header dot** — new `useStreamHealth(symbol, interval, marketType)` hook combines backend `stream:health` events with a local 60 s silence fallback timer. `StreamHealthDot` renders a small pulsing orange circle (8 px, 2 s pulse) **just before the timeframe label** in each chart's grid-window header (e.g. "🟠 1h kline") with a `TooltipWrapper` exposing the degradation message on hover. Discreet but high-signal. Shows immediately on `degraded`, with a 3 s hide-debounce so brief recovery flickers don't toggle the dot on/off. Translations added to all 4 locales (en, pt, es, fr).

### Performance
- **Chart perf tune-up — eliminate cross-component rerenders, patch leaks** — a 9-part push to restore fully-fluid chart interaction after the v0.94-era generic-pipeline refactor reintroduced micro-stutters. Baselines refreshed against the new floor.
  - **Part 1 — Measurement instrumentation.** `perfMonitor.recordComponentRender('QuickTradeToolbar' | 'MainLayout')` at the top of the two chart siblings so the harness can see ripple re-renders. New `.fixme` scenarios `hover-and-tick-storm` (chart-hotpath) and `quick-trade-toolbar-tick-storm` (sibling-renders) document the bug ahead of the fix.
  - **Part 2 — QuickTradeToolbar throttle.** `usePriceStore((s) => s.prices[symbol]?.price)` replaced with `usePricesForSymbols([symbol])` (250 ms throttle, diff-based). `useBookTicker` adjusted for the same pattern. `quick-trade-toolbar-tick-storm` flipped live: `QuickTradeToolbar` now renders ≤ 10/s under a 10-symbol tick storm (was ~200/s).
  - **Part 3 — ChartCanvas stabilize `external` + consolidate selectors.** The `external` object is now `useMemo`'d with explicit deps; `hoveredKlineIndex` moved to a tooltip store + ref so hover no longer invalidates downstream `useCallback` deps. Three separate `useIndicatorStore((s) => s.instances.some(...))` selectors collapsed into one `useShallow` read, extracted to a shared `useIndicatorVisibility()` hook and reused in `useChartTradingData`. `hover-and-tick-storm` flipped live; `ChartCanvas` renders bounded under simultaneous hover + tick.
  - **Part 4 — Panel dispatcher background batching.** `drawPanelBackground` now runs **once per panel group**, not once per indicator (MEMORY note: Phase B invariant regressed). New browser test `useGenericChartIndicatorRenderers.browser.test.tsx` locks it in via a spy on the background helper.
  - **Part 5 — Idle tick-poll gating.** `useGenericChartIndicators` 500 ms poll now gated on `priceStore.tickSeq` monotonic counter + not-panning + no-compute-in-flight. New `idle-tick-poll` scenario added (`test.fixme` for now — captures a bimodal rAF-throttle flake in headless Chromium where standalone runs show renderRate ~120/s while full-suite runs show ~0/s; root cause outside the chart is under investigation).
  - **Part 6 — ChartCanvas realtime-price imperative subscribe.** The last hot-store hook in the chart top-level (`usePriceStore((s) => s.getPrice(symbol))`) converted to imperative `store.subscribe()` that writes to `latestKlinesPriceRef` and marks the overlay layer dirty. Chart top-level is now free of hot-store selectors.
  - **Part 7 — Memory-leak sweep.** Lifecycle audit across `components/Chart/**`, `stores/**`, and relevant hooks: every subscribe/addEventListener/setInterval/ResizeObserver has a cleanup path, `CanvasManager.dispose()` fires on unmount, perfMonitor maps are bounded. New browser test `CanvasManager.lifecycle.browser.test.ts` (6 checks: observer disconnect, global registry cleanup, animation-frame cancel, 20-cycle churn balance, klines/bounds cleared, renderCallback nulled). New perf scenario `mount-unmount-churn` drives 10 route-navigation cycles and asserts heap-growth ≤ 1× baseline. Playwright `perf` project now launches with `--enable-precise-memory-info` + `--js-flags=--expose-gc`.
  - **Part 8 — Perf-spec harness deduplication.** Shared `e2e/perf/harness.ts` hosts `BaselineEntry`, `BaselineMap`, `loadBaseline`, `writeRunResult`, `assertRegression`, and the constants `WARMUP_FRAMES`, `MEASURE_FRAMES`, `NOISE_FLOOR_MS`, `RELATIVE_REGRESSION_CAP`, `OVERLAY_INDICATORS`, `TICK_STORM_SYMBOLS`. All four perf specs (`chart-perf`, `chart-hotpath`, `chart-mobile`, `sibling-renders`) import from it. `hover-and-tick-storm` ChartCanvas cap relaxed 2 → 5 to accommodate documented flake at the tightest bound (tick rate ~200/s; cap still proves the selector isn't broken).
  - **Part 9 — Baseline refresh + harness robustness.** `pnpm --filter @marketmind/electron test:perf:update` re-seeded against the new floor: 16 scenarios in `baseline.json` plus 2 sibling-renders entries (different shape, skipped by the updater). `scripts/perf/update-baseline.ts` gained an `isBaselineEntry` type guard so non-`{fps, p95FrameMs, renderRate}` shapes (sibling-renders, quick-trade-toolbar-tick-storm) are now reported as "skipped" instead of crashing `.toFixed` on undefined.
  - **Part 10 — Pan rerender cascade fix.** Diagnose run surfaced ChartCanvas re-rendering **74×** during a 9-second pan (the existing `renderRate` assertion was blind to it — that metric measures the post-pan idle 1-second window, not the pan itself). Root cause: `useChartCanvas.handleMouseMove` called `setViewport(newViewport)` on its 50 ms throttle, forcing a React render cascade through every wrapped hook. Fixes: (1) new `notifyViewportChange` callback replaces `updateViewport` on the pan path — it only fires `onViewportChange` and skips React state; (2) removed the redundant `useEffect([viewport]) → manager.setViewport(viewport)` sync (dead — every path that calls `setViewport` already mutates the manager directly); (3) `useChartInteraction.handleCanvasMouseMove` short-circuits on `isPanning` BEFORE the drawing/order/grid hit-test block, so `drawingInteraction.handleMouseMove` (which runs `hitTestDrawings` across all drawings) no longer fires during pan. New `componentRenderTotal` helper + tightened `pan-drag-loop` assertion (cap 10) catch a regression that slipped past the old window-based check. **Post-fix: 6 re-renders (92 % reduction).**

### Test coverage
- **Real assertions on E2E flow specs (Part 1, #85)** — `apps/electron/e2e/trading-flow.spec.ts` and `wallet-management.spec.ts` previously gated every `expect(...)` behind `if (await locator.isVisible())`, so the specs passed silently when the UI failed to render. Rewritten with hard assertions against `data-testid` selectors, seeded through `trpcMock` + `VITE_E2E_BYPASS_AUTH=true`. Adds `data-testid` hooks to the components the specs observe (`current-symbol`, wallet selector rows). Previously-skipped `should display chart with kline data` is now enabled and passes.
- **`useOrderDragHandler` browser test suite (Part 2, #86)** — `useOrderDragHandler.browser.test.tsx` covers the 217-LOC pixel-drag hook under real Chromium: SL/TP drags with `yToPrice` conversion, clamp behavior when dragged out of bounds, swap-rejection when dragging SL past TP, and the `dragSlEnabled` / `dragTpEnabled` preference gates. Hook internals are never asserted — only `updateOrder` callback arguments.
- **FVG + Fibonacci renderer browser tests (Part 3, #87)** — `renderFVG.browser.test.tsx` pixel-samples the bullish/bearish zone output, verifies filled gaps are not drawn, and regression-covers the viewport-culling fix (gaps created before the visible window still render). `renderFibonacci.browser.test.tsx` locks in the "nearest" mode pivot-selection fix (H2 wins when it's above H1) plus level hit-testing math.
- **`ViewportNavigator` browser test suite (Part 4, #88)** — exercises `clientX - rect.left` pixel → data-index conversions that jsdom can't model (jsdom returns zero rects). Confirms mousemove at (300, 150) on an 800×600 canvas reports the correct `hoveredIndex` / `hoveredPrice` given a known viewport, and drawing-tool clicks place at the cursor, not at (0,0).
- **Pine strategy golden-output snapshot suite (Part 5, #89)** — `apps/backend/src/__tests__/strategies/golden-outputs.test.ts` runs every one of the 106 builtin strategies through `SetupDetectionService` against a 500-kline synthetic fixture (trending + ranging + reversal sections) and snapshots `{ strategyName, signals: [{ timestamp, direction, entryPrice }] }`. Prices rounded to 2dp to avoid floating-point churn. First run establishes the snapshot; subsequent indicator-engine or strategy edits that shift any output surface as a failing diff.
- **Visual regression screenshot suite (Part 6, #90)** — `apps/electron/e2e/visual/chart.visual.spec.ts` rewritten with deterministic fixtures (locked viewport 1280×720, disabled animations, mocked tRPC). Three target renders baseline-compared at `maxDiffPixelRatio: 0.002`. Chart kline baselines remain an explicit non-goal (too noisy).
- **Mobile, many-drawings, 20-symbol-storm perf scenarios (Part 7, #91)** — `chart-hotpath.spec.ts` gains `many-drawings` (80 mixed drawings under pan+zoom) and `price-tick-storm-20` (20-symbol tick storm). New `chart-mobile.spec.ts` spec covers narrow-viewport (390×844) scenarios: `mobile-overlay`, `mobile-pan-zoom`, `mobile-tick-storm`. New `seedDrawings` / `clearDrawings` helpers on `chartTestSetup` drive `window.__drawingStore`. Baselines committed.
- **CI browser-test job + coverage artifact (Part 8, #92)** — new GitHub Actions job `Browser Tests` runs `pnpm --filter @marketmind/electron test:browser:run` after `Run Tests`. Frontend + backend unit jobs now emit coverage (`-- --coverage`), uploaded as a 14-day artifact. No third-party coverage tool integration (explicit non-goal).
- **Docs + verification (Part 9, this PR)** — "Writing a new browser test" subsection in `docs/BROWSER_TESTING.md` documenting the isolated-renderer and `renderHook` patterns. Perf README extended with Part 7 scenarios. README testing stats bumped with a "Browser tests" line.

## [0.98.0] - 2026-04-21

### Added
- **Position \$ P&L badge on chart** — next to the existing % badge on a position line, a second pill renders the realized+unrealized P&L in dollars (`+$12.34` / `-$5.67` / `$0.00`), green when positive, red when negative. Shares `drawPercentBadge` as the pill primitive; positioned between the `%` badge and SL/TP buttons.
- **Perf instrumentation overlay (Phase 0)** — `perfMonitor.ts` exposes an opt-in overlay (gated on `localStorage('chart.perf')`) that tracks FPS median / p95 frame time / per-section ms / ChartCanvas renders per second, rendered in the top-right of the canvas. Intended for regression checks, not production display.
- **Browser autonomy harness** — new Playwright `perf` and `electron` projects plus helpers (`trpcMock`, `klineFixtures`, `chartTestSetup`, `consoleCapture`) and CLI wrappers under `scripts/perf/`. `VITE_E2E_BYPASS_AUTH=true` short-circuits `AuthGuard` + `useBackendAuth` (renderer-only; prod build dead-code-eliminates the branch), exposes Zustand stores on `window.__indicatorStore` / `window.__preferencesStore`, and lets `e2e/perf/chart-perf.spec.ts` drive the real chart with mocked tRPC responses. Baseline numbers live in `apps/electron/e2e/perf/baseline.json`; regressions >10% fail the `compare-baseline.ts` check. Intended for Claude-driven regression runs without manual browser steps.
- **Chart hot-path perf suite (PR A)** — `apps/electron/e2e/perf/chart-hotpath.spec.ts` adds three regression scenarios that target real-world render pressure: `price-tick-storm` (10 symbols × ~100 Hz via `pushPriceTicks`), `kline-replace-loop` (current-bar mutation through the React Query cache via `updateLatestKline`), and `kline-append` (new-bar appends via `appendKline`). Driver helpers live in `chartTestSetup.ts` and mutate `window.__priceStore` / `window.__queryClient`. Both bridges are gated on `IS_E2E_BYPASS_AUTH` and dead-code-eliminated in production. New `test:perf:diagnose` script (env `PERF_DIAGNOSE=1`) dumps top-5 slowest sections per scenario into a git-ignored `diagnose-<timestamp>.json`. Baseline seeded from first local green run; `toRawKline` serializer factored from `trpcMock` into `klineFixtures` for reuse between the mock and the driver helpers.
- **Chart hot-path perf suite (PR B)** — three interaction-driven scenarios plus perf-monitor counters. `pan-drag-loop` (synthetic `mousedown`+rAF-paced `mousemove`+`mouseup` via `drivePan`), `wheel-zoom-loop` (alternating `page.mouse.wheel` via `driveWheelZoom`), and `indicator-churn` (rapid `addIndicators` / `clearIndicators` cycles). `perfMonitor` gains `droppedFrames` (count of frames where `lastFrameMs > 33ms`) and `longSections` (count of `measure()` calls > 16ms), both cleared on `reset()` and surfaced in `PerfSnapshot` + the overlay. Baselines seeded from first local green run (`renderRate ~0` for pan is expected — pan bypasses React).
- **Sibling renderer sentinel (PR C)** — `apps/electron/e2e/perf/sibling-renders.spec.ts` verifies `Portfolio` and `OrdersList` don't balloon past 10 renders/sec under a 10-symbol price tick storm. Instrumentation: `perfMonitor.recordComponentRender('Portfolio' | 'OrdersList')` at the top of each component so future regressions — e.g., a new `usePriceStore` selector slipped into an OrderCard — fail the sentinel instead of silently eroding Portfolio responsiveness. Current local numbers: ~3.2/s for both sidebar components vs. ~128/s for ChartCanvas, so the 10/s ceiling is safely above the healthy baseline while still catching a regression.

### Performance
- **Chart re-render decoupling (Phase A)** — `ChartCanvas` no longer subscribes to hot Zustand stores via selectors. Prices, aggTrades, live trading data, and preferences now flow through imperative `subscribe()` handlers that write to refs and call `CanvasManager.markDirty(...)`, so React re-renders only on symbol switch, indicator add/remove, or resize. Target: ChartCanvas renders ≤ 1/s during continuous ticks (previously ~5/s).
- **Panel renderer hot-loop optimizations (Phase B)** — batched `save`/`restore` + `drawPanelBackground` at the dispatcher (`useGenericChartIndicatorRenderers`) so each pane pays the setup cost once per panel group, not once per indicator. Shared visible-range cache via `CanvasManager.getFrameCached` keyed on `(series, visibleStart, visibleEnd)` means MACD/Stoch/DMI/BB with N series compute the range once per frame.
- **Parallel pine worker batches (Phase C)** — `runCompute` in `useGenericChartIndicators` now runs native evaluators inline and fans out pine batches through `Promise.allSettled` in chunks of `clamp(hardwareConcurrency - 1, 2, 6)`. Cancellation tokens + per-batch error isolation preserved. Prior sequential `await` in a loop was leaving cores idle when multiple pine indicators were active.
- **Orphan orders polling alignment (Phase D)** — `useOrphanOrders` aligned `staleTime` with `refetchInterval` (`ORPHAN_POLLING_MS = 10_000`), eliminating refetch thrash when the component re-observed stale-by-default queries.

### Fixed
- **Pill-tag text vertical centering** — every canvas pill on the chart (position info tag, % badge, \$ P&L badge, SL/TP buttons, price-axis tag, current-price tag) had its text drifting one pixel above visual center because monospace at `textBaseline='middle'` renders on the em-square middle, not the cap-height middle. Added `ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET = 1` applied uniformly to every affected `fillText`. `drawCurrentPriceTag`'s timer row tightened from 16→13px + 1px gap + 9px font so the timer sits snug against the price.
- **Indicator value tags clipped behind price scale** — Phase B's dispatcher applied `applyPanelClip({chartWidth})` before calling pane renderers, but `drawPanelValueTag` renders at `x=chartWidth` extending `+64px` into the price-scale area. The tag body was clipped out entirely. Removed the clip; `drawPanelBackground` + `save/restore` stay for batched background fill.

### Changed
- **Source-of-truth: interval→ms conversion (PR D)** — replaced six scattered duplicates of the interval→milliseconds map with imports from `@marketmind/types`' canonical `INTERVAL_MS` (backed by `TIME_MS` in `packages/types/src/intervals.ts`). Callers now share one definition: `kline-stream.ts`, `gap-classifier.ts`, `routers/auto-trading.ts`, `routers/auto-trading/diagnostics.ts`, `scripts/data/backfill-historical.ts`. `apps/backend/src/constants` now also re-exports `INTERVAL_MINUTES`. Test mocks continue to pin small literal maps on purpose.
- **Source-of-truth: TestKline fixture type (PR #80)** — promoted the e2e-local `FixtureKline` interface into `@marketmind/types` as `TestKline`. `apps/electron/e2e/helpers/klineFixtures.ts`, `chartTestSetup.ts`, and `trpcMock.ts` now consume the canonical type; no more drift risk between fixture shape and the production `Kline`.
- **Source-of-truth: price formatters (PR #81)** — consolidated `formatPrice` + `formatPriceDisplay` into `packages/utils/src/formatters.ts`. `formatPrice(value, { decimals? })` is threshold-based (>=1 → 2d, else 6) when no `decimals` passed and fixed-decimal otherwise; `formatPriceDisplay(value, { abbreviated? })` keeps the chart-granularity thresholds plus opt-out K/M abbreviation. Backend `apps/backend/src/utils/formatters.ts` and renderer `apps/electron/src/renderer/utils/formatters.ts` now re-export from `@marketmind/utils`. The math-precision helper previously named `priceUtils.formatPrice` was renamed to `formatPriceExact` to eliminate the name collision; `formatChartPrice` and exchange-specific formatters (`formatPriceForBinance`, `formatQuantityForBinance`) stay where they are — they solve different problems.

### Notes
- **Boleta + chart leverage/quantity parity verified** — both the quick-trade toolbar (`QuickTradeToolbar.tsx`) and chart modifier+click entries (`useChartTradingActions.ts`) already consume the exact same `useOrderQuantity(symbol, marketType)` hook — one leverage query, one margin formula (`balance × leverage × pct / price`). Only `price` differs between them: boleta uses bid/ask, chart uses the clicked price — intentional for margin-based sizing.

## [0.97.2] - 2026-04-19

### Fixed
- **Daily P&L semantics** — replaced the derived `realized_pnl_events` table with `income_events`, a 1:1 mirror of Binance income history. Daily aggregation is now `SUM(amount)` grouped by `income_time AT TIME ZONE $tz` across `REALIZED_PNL`, `COMMISSION`, and `FUNDING_FEE` rows — so yesterday's entry fees and hourly fundings stay on yesterday even when a multi-day position closes today. Paper wallets synthesize 3 rows at close (negative `binance_tran_id`, scoped unique per wallet) so the same math applies. Analytics endpoints (`getDailyPerformance`, `getEquityCurve`, `getPerformance`) accept an optional `tz` (frontend passes `Intl.DateTimeFormat().resolvedOptions().timeZone`). Two-step deploy: migration `0031` adds the table → run `backfill-income-events.ts` / `reconcile-wallet-balance.ts` / `synthesize-paper-history.ts` → migration `0032` drops `realized_pnl_events`.
- **Boleta % position sizing** — moved quantity-from-percent math to the backend (`services/trading/order-quantity.ts`). `createOrder` now accepts `percent` + `referencePrice` and computes the quantity server-side from **live** Binance `availableBalance` and per-symbol `leverage` (falling back to `accountInfo.positions[symbol].leverage`, never `1` when a real leverage is readable). Frontend `useOrderQuantity` still runs for the size-preview display, but `QuickTradeToolbar` now sends `percent` instead of `quantity`, eliminating the stale-cache + leverage-fallback-to-1 drift that was letting 75% @ 10x open at ~1.7× exposure instead of ~7.5×.
- **Drag pending entry "Margin insufficient"** — `updatePendingEntry` now cancels the prior LIMIT/STOP_MARKET before submitting the replacement, so free margin is released first (previously both orders held margin for a beat and Binance rejected the replacement when the account was tight).

### Changed
- **Unified income-type constants** — `apps/backend/src/constants/income-types.ts` is the only place the literal income-type strings live. `PNL_CONTRIBUTING_TYPES` = `['REALIZED_PNL','COMMISSION','FUNDING_FEE']`.
- **`services/income-events/` module** — single source of truth: `insertIncomeEvent` (idempotent upsert on `UNIQUE(wallet_id, binance_tran_id)`), `syncFromBinance` (wallet-scoped backfill window from last `income_time`), `synthesizePaperClose` (3 rows per paper close), `matcher.linkIncomeToExecution`, `dailyAggregate.{getDailyIncomeSum, getDailyIncomeBreakdown, getEquityCurvePoints}`, `emitPositionClose` (single call site for the 8 former writers).
- **Test-infra hardening** — `setupTestDatabase` now takes a Postgres advisory lock before `DROP/CREATE`, so concurrent vitest workers serialize instead of racing on `pg_type_typname_nsp_index`. Default test email gained a random suffix so two workers that grab the same `Date.now()` no longer collide on `users_email_key`.

## [0.97.1] - 2026-04-19

### Changed
- **Default checklist template** — every entry now carries an explicit `weight` (tuned per timeframe × indicator, e.g. `RSI 4h: 2`, `Stoch 4h: 1.75`, `EMA 200: 1.5`, `Volume 1h: 1.5`). EMA 200 and EMA 21 demoted from `required` to `preferred` — no condition is required by default. `ChecklistTemplateEntry` type now requires `weight` explicitly; seeding and materialization no longer fall back to timeframe defaults for template entries.
- **Short tier labels in checklist UI** — badges render `req` / `pref` instead of the full words; the `current` timeframe renders as `curr`. New i18n keys `checklist.tier.requiredShort`, `checklist.tier.preferredShort`, and `checklist.timeframes.current` across en/pt/es/fr.
- **`sync-default-checklist.ts` maintenance script** — now updates `tier` + `weight` on existing conditions (matched by composite key), accepts an email argument for per-user runs, and supports an optional `--prune` flag that removes legacy conditions not present in the template. Orders are renumbered after every write.
- **Package descriptions** — dropped the "AI-powered" framing from `package.json`, `apps/electron/vite.config.ts` (PWA manifest), and the agent-guide docs (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.claude/project-instructions.md`, `.gemini/instructions.md`). AI is not part of the current product scope.

### Added
- **Package keywords + GitHub repo topics** — root, backend, and electron `package.json` files now carry keyword arrays; the GitHub repo was updated with topics (trading, crypto, charts, klines, candlestick, technical-analysis, indicators, backtesting, auto-trading, binance, futures, electron, desktop, react, typescript, cryptocurrency) to improve discoverability.

## [0.97.0] - 2026-04-19

### Added
- **Per-condition weights on the pre-trade checklist** — every condition now carries a `weight` (range 0.1–5, step 0.25) that multiplies its contribution to the score. Defaults follow the timeframe: `1m=0.5`, `5m=0.75`, `15m=1`, `30m=1.25`, `1h=1.5`, `2h=1.75`, `4h=2`, `6h=2.25`, `8h=2.5`, `12h=2.75`, `1d=3`, `3d=3.5`, `1w=4`, `current=1`. Higher timeframes contribute more to the final score, so a 4h oversold outweighs a 15m oversold. Exposed via `getDefaultChecklistWeight()` in `@marketmind/types`.
- **Weighted score formula** — `calculateChecklistScore` now uses `requiredWeightPassed × 2 + preferredWeightPassed × 1` over `requiredWeightTotal × 2 + preferredWeightTotal × 1`. Tier multiplier (required = 2×, preferred = 1×) unchanged. Backend evaluator tracks both count and weight totals per side/tier.
- **Weight UI** — `ChecklistFields` dialog gets a number input (auto-updates to timeframe default when TF changes); `ChecklistEditor` card and `ChecklistSection` row render a `×multiplier` badge.
- **QuickTradeToolbar +/− buttons** — between the size slider and leverage badge, stepping 5% at a time with snap-to-5 behavior.
- **i18n keys** — `checklist.weight` and `checklist.weightHint` across en/pt/es/fr.

### Fixed
- **Dialog X close button** — `FormDialog` now wires `<DialogCloseTrigger asChild><CloseButton size="sm" /></DialogCloseTrigger>`, so every dialog built on `FormDialog` (plus `ProfileEditorDialog`, `ImportProfileDialog`, `DynamicSymbolRankings`, `ScreenerModal`, `ChartCloseDialog`) renders its close button. Chakra v3's `DialogCloseTrigger` uses `forwardAsChild: true`, which rendered nothing when passed no child element — the root cause of the missing X.
- **Checklist reorder arrows** — `commit()` was calling `.sort(sortByOrder)` before `.map((c, idx) => ({ ...c, order: idx }))`, which undid the swap from `handleMove` by re-sorting on the old `order` field. Removing the redundant sort restores up/down reordering.

### Changed
- **Size preset buttons** — replaced `0.5%` / `1%` with `25%` / `75%`. Final presets: `5, 10, 25, 50, 75, 100`.
- **Legacy checklist records** — `parseChecklistConditions` in `apps/backend/src/utils/profile-transformers.ts` now fills `weight` with `getDefaultChecklistWeight(timeframe)` when absent, so existing profiles in the JSON column work without a migration.

## [0.96.0] - 2026-04-19

### Fixed
- **SL/TP anti-slippage protection (Binance Futures)** — closing orders now ship `workingType: MARK_PRICE` + `priceProtect: true` so wicks no longer trigger stops and abnormal Last vs Mark divergence blocks execution at market. Previously, `STOP_MARKET` / `TAKE_PROFIT_MARKET` triggers used `CONTRACT_PRICE` (Last) without `priceProtect`, producing significant slippage on closes — including stops already in profit flipping to a loss. Centralized in `apps/backend/src/constants/algo-orders.ts` (`ALGO_ORDER_DEFAULTS`) and consumed from every algo-order call site: `protection-orders.ts` (SL + TP create), `exchange-trailing-stop.ts` (futures trailing), `routers/trading/order-mutations.ts` (manual algo), `routers/trading/execution-updates.ts` (drag pending entry), `routers/futures-trading/order-helpers.ts` (conditional orders). Updates cancel+recreate through the same helpers, so the defaults propagate automatically. `submitFuturesAlgoOrder` was extended to forward `priceProtect` as the SDK's `BooleanString`.
- **Stochastic chart vs checklist disagreement** — `smoothK` / `smoothD` parameters were silently dropped in the chart pipeline, so the rendered series diverged from the checklist evaluator's result. Catalog-driven indicator params now flow end-to-end (fix: 851995c9).
- **Screener Stochastic params** — aligned with catalog definition + duplicate metadata file removed (fix: 4c11afdf).
- **Stale liquidation-threshold assertions** — `position-monitor-extended.test.ts` referenced 0.30/0.15 distances from a prior threshold regime; updated to the current 0.12 (warning) / 0.07 (danger) bands. `trading-core/constants.test.ts` CRITICAL threshold corrected to 0.05.

### Added
- **Catalog-validated tRPC inputs** for indicator params (`packages/trading-core/schemas`) — single source of truth shared by backend routers and frontend type-checks; legacy param keys dropped (feat: 497053ea + e1c5dc92).
- **One-shot legacy → catalog migration on startup** — existing user indicators are materialized against `INDICATOR_CATALOG` on boot so upgraded installs inherit the new param shapes without manual intervention (feat: d37cd979).
- **`fibonacci`, `fvg`, `liquidityLevels` ported to the generic pipeline** — the three deferred legacy render hooks now consume `CUSTOM_RENDERER_REGISTRY`, completing the v0.94 migration (feat: cfbba9ec).

### Changed
- **Backend indicator handlers** aligned to catalog param keys — no more hand-maintained drift between handler input shapes and catalog definitions (refactor: 96cd6611).
- **Legacy chart pipeline deleted** — generic indicator instances API is now the only code path. Removed ~12 legacy files (`indicatorRendererImports.ts`, `indicatorRendererTypes.ts`, `layers/{Background,Data,Indicator,Overlay}Layer.ts`, `useChartIndicatorRenderers.ts`, `useChartIndicators.ts`, `useChartRendering.test.ts`, etc.) and their tests (refactor: 83b22870).

### Notes
- **Edge case (documented, not fixed)**: when the market suffers a real crash (not a wick), `priceProtect=true` will **block** SL execution. The position is temporarily unprotected. Existing mitigations (liquidation-monitor + position-sync) still detect the state and can force-close — no new logic added this release.

## [0.95.0] - 2026-04-18

### Added
- **Trading Checklist system end-to-end** — per-profile checklist of indicator conditions (EMA, RSI, Stoch, Volume, etc.) evaluated against live klines. Backend evaluator (`apps/backend/src/services/checklist/evaluate-checklist.ts`) computes per-condition `passed/value` plus weighted score (required ×2, preferred ×1). New tRPC procedure `trading.evaluateChecklist` (`profileId | conditions`, `symbol`, `interval`, `marketType`).
- **Combined per-side scoring in one call** — `evaluateChecklist` now returns `{ results, score, scoreLong, scoreShort }`. Frontend dropped from 2 parallel queries (LONG + SHORT) to a single call; klines and indicator series are fetched/computed once.
- **Score deduplication by composite key** — when two conditions resolve to the same `(userIndicatorId, resolvedTimeframe, op, threshold)` for a given side (e.g. `RSI 14 current` + `RSI 14 1h` on a 1h chart), only one counts toward the score. Explicit-timeframe entries take precedence over `current`. Each result row reports `countedLong` / `countedShort`; deduped rows render at reduced opacity with a tooltip explanation.
- **Focused-panel timeframe resolution** — `current` now resolves against the focused chart panel's timeframe via `useLayoutStore.getFocusedPanel()?.timeframe`, falling back to the prop. Multi-chart layouts pick the right interval per active panel.
- **Default checklist template** (`packages/trading-core/src/indicators/checklistDefaults.ts`) — 21 entries covering EMA 200 / EMA 21 (priceAbove/priceBelow current, required), RSI 14 oversold/overbought (current + 15m/1h/4h, preferred), Stoch 14 oversold/overbought (current + 15m/1h/4h, preferred), Volume rising 1h. All `enabled: false` so users opt-in per condition.
- **Default profile auto-seeded on registration** — `seedDefaultTradingProfile` runs after `seedDefaultUserIndicators` in the auth router; new accounts ship with a `Default Profile` containing the materialized checklist + `DEFAULT_ENABLED_SETUPS`.
- **Maintenance scripts** in `apps/backend/scripts/maintenance/`:
  - `sync-default-checklist.ts` — adds missing template entries (e.g. newly added Stoch 14) to existing user profiles without overwriting customizations.
  - `seed-default-trading-profile.ts` — backfills default profiles for existing users who registered before the auto-seed flow.
  - `enable-stoch-checklist.ts` — one-off enabler for Stoch 14 conditions on existing profiles.
- **Frontend Checklist UI**:
  - `ChecklistSection` (chart-side) — collapsible row under QuickTradeToolbar with two score badges (`L 29% S 29%`), three groups (LONG / SHORT / BOTH), 15s refetch.
  - `ChecklistEditor` — full editor with reorder chevrons (TooltipWrapper i18n: `checklist.editor.moveUp/moveDown`), per-condition tier/side/timeframe badges, indicator picker via `IndicatorConfigDialog`.
- **`AutoTradingTab`** in Settings — extracted Settings tab wrapping `WatcherManager` for cleaner navigation.
- **`tradingProfileQueries`** util (`apps/backend/src/services/database/`) — centralized profile lookup (`getByIdAndUser` / `findByIdAndUser`) mirroring the `walletQueries` pattern; replaces ad-hoc queries in the trading-profiles router.
- **`schemas.ts`** in `@marketmind/trading-core` — `CONDITION_OPS` / `CONDITION_TIERS` / `CONDITION_SIDES` const arrays plus matching Zod schemas (`conditionOpSchema`, `conditionTierSchema`, `conditionSideSchema`, `conditionThresholdSchema`, `checklistConditionSchema`). `ConditionOp/Tier/Side` types now derive from these arrays — single source of truth shared by backend router validation and frontend type-checking.

### Fixed
- **Badge & Button padding regression** — Chakra v3's system recipe size variants overrode the project's wrapper inline padding (`<Badge size="sm">` collapsed to `px=1.5`). Resolved by extending `badgeRecipe.variants.size` in `apps/electron/src/renderer/theme/recipes.ts` and applying `!important` raw CSS via the `css` prop in `apps/electron/src/renderer/components/ui/{badge,button}.tsx`. Badges and buttons now have visible breathing room across setup chips, checklist tier/side/timeframe pills, score badges, and dialogs.
- **Select options inside Dialogs** — `usePortal=false` propagation guard so Chakra `DialogPositioner` no longer intercepts portal clicks (fix: 7c0bfa9e).
- **Indicator pane colors / thresholds + auto-seed** restored after the v0.94 generic-pipeline migration; empty pane gap dropped (fix: 94a3dae4).
- **Generic line indicators wick alignment** — X coordinate now centered on candle wick instead of body edge; duplicate legacy renderers removed (fix: 398bc71b).

### Changed
- **`trading-profiles` router**: `name` and `enabledSetupTypes` are now optional in `createProfileSchema` (defaults applied server-side from `DEFAULT_ENABLED_SETUPS`); inline duplicate Zod schemas removed in favor of imports from `@marketmind/trading-core/schemas`.
- **`badgeRecipe`**: `base` slot trimmed of size-specific styles; new `variants.size` block (`xs/sm/md/lg`) drives padding/min-height/font-size/gap so sizing comes from the project recipe instead of Chakra's defaults. `defaultVariants.size = 'sm'`.
- **`profile-transformers`**: added `parseChecklistConditions` / `stringifyChecklistConditions` / `parseIndicatorParams` / `stringifyIndicatorParams` helpers; consumers (`auth`, `user-indicators`, `trading-profiles`, sync scripts) standardized on these instead of ad-hoc `JSON.parse/stringify`.
- **`CreateTradingProfileInput`** in `@marketmind/types`: `name` and `enabledSetupTypes` optional.

## [0.94.0] - 2026-04-18

### Added
- **5 deferred catalog indicators ported** to the generic pipeline with custom render dispatch: `orb` (Opening Range Breakout), `sessionBoundaries`, `footprint`, `liquidityHeatmap`, `liquidationMarkers`. All wired through `INDICATOR_CATALOG` with `evaluator: { service: 'native', scriptId: <X> }` and rendered via `CUSTOM_RENDERER_REGISTRY`.
- **External-data plumbing for generic renderers**: `useGenericChartIndicators` and `useGenericChartIndicatorRenderers` now accept `marketEvents`, `footprintBars`, `liquidityHeatmap`, and `liquidityColorMode` so custom renderers can consume non-kline feeds. `NativeEvaluatorContext` and `GenericRendererExternal` formalize the contract.
- **Per-panel override props** on `IndicatorTogglePopoverGeneric`: `activeUserIndicatorIdsOverride` + `onToggleUserIndicatorOverride` operate on `UserIndicator.id`, ready for per-panel toggling of catalog instances in a future revision.
- **Locales**: 5 new indicator names + `orbPeriodMinutes` param key in **en**, **pt**, **es**, **fr** root-level `indicators.*` block.

### Removed
- **Legacy `IndicatorTogglePopover`** (~440 lines): the file is now a re-export shim for `IndicatorTogglePopoverGeneric`. All callers automatically use the generic pipeline.
- **`VITE_USE_GENERIC_INDICATOR_PIPELINE` feature flag** + `apps/electron/src/renderer/constants/featureFlags.ts`: the generic pipeline is the only path now.
- **`ChartToolsToolbar` per-panel override wiring**: simplified to `<IndicatorTogglePopover />` (no `useLayoutStore` / `IndicatorId` imports). Per-panel control will return on the new `UserIndicator`-id-based override interface when the panel layout system migrates to catalog instances.

### Notes
- Per-indicator legacy render hooks for `fibonacci`, `fvg`, and `liquidityLevels` remain in place because their catalog entries reference `scriptId` / `rendererId` strings without working `NATIVE_EVALUATORS` or `CUSTOM_RENDERER_REGISTRY` entries. Removing the legacy hooks now would silently break those visualizations. Full per-hook removal is queued for v0.95 once those three are ported.

## [0.93.0] - 2026-04-18

### Added
- **5 new catalog indicators** with custom render kinds: **Ichimoku Cloud** (`ichimoku` — cloud fill polygon + tenkan/kijun/chikou), **Pivot Points** (`pivotPoints` — sparse high/low markers with dashed projection lines), **Volume Profile** (`volumeProfile` — viewport-aware horizontal histogram with POC line), **Daily VWAP** (`dailyVwap`), **Weekly VWAP** (`weeklyVwap`). All wired through `INDICATOR_CATALOG` with `evaluator: { service: 'native', scriptId: <X> }`.
- **Custom-render dispatch pipeline**: `CUSTOM_RENDERER_REGISTRY` (keyed by `rendererId`) plus `getCustomRenderer` / `registerCustomRenderer` in `apps/electron/src/renderer/components/Chart/ChartCanvas/renderers/index.ts`. `useGenericChartIndicatorRenderers` exposes a new `renderAllCustomIndicators()` that iterates instances whose `definition.render.kind === 'custom'` and dispatches to the registry; `useChartRenderPipeline` wires it in between panel and CVD rendering.
- **Native evaluators** for `ichimoku`, `pivotPoints`, `dailyVwap`, `weeklyVwap`, `volumeProfile` in `nativeEvaluators.ts` — all reuse existing pure-function calculators from `lib/indicators/*`.
- **Default seeds** for all 5 new indicators in `DEFAULT_USER_INDICATOR_SEEDS` so users get them on auto-seed.

### Fixed
- **`buildBatches` now batches custom-render indicators**: Previously skipped (`if (def.render.kind === 'custom') continue`), which meant any catalog entry with `kind: 'custom'` had its evaluator silently dropped. Without evaluator output, the renderer received nothing and never drew. Now custom kinds batch like overlay/pane kinds; entries without a registered renderer in `CUSTOM_RENDERER_REGISTRY` are simply ignored by `renderAllCustomIndicators` (safe no-op for legacy fibonacci/fvg/etc.).

### Locales
- Extended root-level `indicators.*` block in **en**, **pt**, **es**, **fr** with names (`ichimoku`, `pivotPoints`, `volumeProfile`, `dailyVwap`, `weeklyVwap`), params (`tenkanPeriod`, `kijunPeriod`, `senkouPeriod`, `tenkanColor`, `kijunColor`, `chikouColor`, `lookback`, `lookahead`, `highColor`, `lowColor`, `numBuckets`, `maxBarWidth`, `opacity`), outputs (`tenkan`, `kijun`, `senkouA`, `senkouB`, `chikou`, `pivotHigh`, `pivotLow`, `rendered`).

### Notes
- 5 deferred indicators remain (`orb`, `sessionBoundaries`, `footprint`, `liquidityHeatmap`, `liquidationMarkers`) — all require non-kline external data feeds (market events, footprint tick data, liquidation feed). Bringing them into the generic pipeline will require extending the evaluator interface to accept extra context, planned for v0.94.
- `activityIndicator` is a chart-display toggle (not a catalog indicator) and intentionally stays out of the catalog.

## [0.92.0] - 2026-04-18

### Added
- **7 new catalog indicators** in `INDICATOR_CATALOG`: **Awesome Oscillator** (`ao`), **Aroon** (`aroon`), **Chaikin Money Flow** (`cmf`), **Elder Ray** (`elderRay`), **Klinger Oscillator** (`klinger`), **Ultimate Oscillator** (`ultimateOsc`), **Vortex** (`vortex`). All wired to existing native evaluators via `evaluator: { service: 'native', scriptId: <X> }` and rendered through the generic pipeline (`pane-line` / `pane-multi` / `pane-histogram`).
- **Native evaluator dispatch** for the 7 new indicators in `apps/electron/src/renderer/lib/indicators/nativeEvaluators.ts` (calls existing `calculateAO`/`calculateAroon`/`calculateCMF`/`calculateElderRay`/`calculateKlinger`/`calculateUltimateOscillator`/`calculateVortex`).
- **Default seeds** for `aroon` (period 25) and `vortex` (period 14) in `DEFAULT_USER_INDICATOR_SEEDS` so new users get them on first auto-seed.

### Locales
- Root-level `indicators.*` block in **en**, **pt**, **es**, **fr**: indicator names (ao, aroon, cmf, elderRay, klinger, ultimateOsc, vortex), shared `params` (period, fastPeriod, slowPeriod, signalPeriod, shortPeriod, midPeriod, longPeriod, color, lineWidth), and `outputs` (value, aroonUp, aroonDown, aroonOscillator, bullPower, bearPower, kvo, signal, viPlus, viMinus).

### Notes
- 10 legacy popover indicators (`ichimoku`, `pivotPoints`, `dailyVwap`, `weeklyVwap`, `volumeProfile`, `footprint`, `liquidationMarkers`, `liquidityHeatmap`, `orb`, `activityIndicator`) are still **deferred** — they require custom render kinds and dedicated dispatch wiring outside the generic `RENDERER_REGISTRY`. The `VITE_USE_GENERIC_INDICATOR_PIPELINE` flag and the legacy `IndicatorTogglePopover` stay in place so users keep access to those visualizations until v0.93 closes the gap.

## [0.91.0] - 2026-04-18

### Added
- **Indicator Library UI**: New `Indicators` tab in Settings (`SettingsDialog`) mounting `IndicatorLibrary`, the management surface for user indicators. Supports create / edit / duplicate / delete and "Reset to defaults". Indicators are grouped by catalog category and show a parameters summary; custom ones get a "Custom" badge.
- **Inline indicator management on chart popover**: `IndicatorTogglePopoverGeneric` now exposes per-row Edit/Delete buttons plus a "+ New" button in the header — no need to open Settings to add or tweak an indicator. Deleting an indicator also tears down its active chart instances.
- **`useUserIndicators` shared hook**: Single React-Query hook (`apps/electron/src/renderer/hooks/useUserIndicators.ts`) wrapping `trpc.userIndicators.{list,create,update,delete,duplicate,reset}` with a 5-min `staleTime` and unified cache invalidation. Used by `IndicatorLibrary`, `IndicatorTogglePopoverGeneric`, and `ProfileEditorDialog` so all surfaces share one source of truth.
- **`userIndicators.duplicate` tRPC mutation**: Server-side clone with " (copy)" label suffix and `isCustom=true`. Includes ownership check (rejects cloning another user's indicator) + 2 router tests covering happy-path and cross-user isolation.

### Changed
- **`ProfileEditorDialog` now consumes `useUserIndicators`** instead of calling `trpc.userIndicators.list.useQuery` directly, so checklist editing benefits from the shared cache.

### Locales
- Added `settings.tabs.indicators` and the `settings.indicators.*` block (`title`, `count`, `reset`, `new`, `empty`, `custom`, `duplicate`, `deleteTitle`, `deleteDescription`, `resetTitle`, `resetDescription`) in **en**, **pt**, **es**, **fr**.

## [0.90.0] - 2026-04-18

### Fixed
- **Pane indicators flip with main pane**: Stochastic, RSI, MACD, ADX, AO, Aroon, CCI, CMO, CMF, Elder Ray, Klinger, MFI, OBV, PPO, ROC, TSI, Ultimate Osc, Vortex, Williams %R now invert their Y axis when `chartFlipped` is enabled. Both the legacy per-indicator renderers and the new generic pipeline (`renderPaneLine`, `renderPaneMulti`, `renderPaneHistogram`) read `manager.isFlipped()` and pass it to the value-to-Y factories.
- **Direction arrows flip with chart**: Position tags (`↑/↓` next to leverage), trailing-stop labels (`TS ↑`), and liquidation tags (`LIQ ↓`) now mirror direction when the chart is flipped — extracted to a shared `getDirectionArrow(isLong, flipped)` helper.
- **Vertical mouse/touch pan inverted under flipped chart**: Dragging down was moving content up (and vice-versa) when `chartFlipped` was on. `CanvasManager.panVertical` now negates `deltaY` when flipped, restoring "drag follows finger/mouse" semantics. Keyboard pan (`Cmd+ArrowUp/Down`) and touch pan inherit the same fix.

### Added
- **`createNormalizedValueToY` / `createDynamicValueToY` flip parameter**: `oscillatorRendering.ts` factories accept an optional `flipped: boolean` and invert the Y mapping symmetrically. `drawZoneFill` is now flip-safe (uses `Math.min(topY, bottomY)` + `Math.abs`).
- **`OscillatorSetup.flipped` field**: Surfaced via `useOscillatorSetup` so panel renderers can pass it through.
- **`getDirectionArrow` helper** at `Chart/utils/directionArrow.ts` + 4 unit tests covering all `(isLong × flipped)` combinations.
- **`createNormalizedValueToY` / `createDynamicValueToY` tests** (6 tests) — verify min/max mapping, flip mirroring, and symmetric range behavior.
- **`CanvasManager.panVertical` flip test** — verifies pan delta is negated under flipped state and magnitude is preserved.

### Changed
- **Test infra**: ~45 renderer hook test files now mock `isFlipped: vi.fn(() => false)` on their `CanvasManager` stubs, restoring suite green after the new `manager.isFlipped()` calls in the renderers.
- **Generic indicator pipeline wired into `ChartCanvas`** (additive). `useGenericChartIndicators` + `useGenericChartIndicatorRenderers` now run alongside the legacy renderers. With no `IndicatorInstance`s in the store (default), they are no-ops — zero behavior change for existing users. When the user opts in via the new `IndicatorTogglePopoverGeneric` (flag default `true`, override with `VITE_USE_GENERIC_INDICATOR_PIPELINE=false`), added instances render through the catalog-driven `RENDERER_REGISTRY`. Legacy renderers still fire for `activeIndicators` so prior preferences keep working; full legacy deletion is queued for v0.91 after manual UI QA.

## [0.89.0] - 2026-04-18

### Added
- **Pre-trade checklist**: Per-profile list of indicator conditions (`ChecklistCondition`) evaluated before every trade. `required` conditions must pass; `preferred` conditions add to a 0-100 confidence score (required × 2 weight, preferred × 1).
- **ChecklistEditor component**: New section in `ProfileEditorDialog` to add / reorder / enable / edit / delete conditions, backed by `trpc.tradingProfiles.updateChecklist`.
- **ChecklistSection in Quick Trade toolbar**: Live evaluation badge (`requiredPassed/requiredTotal` + score %) plus expandable per-condition pass/fail list, driven by `trpc.trading.evaluateChecklist` polling every 15s for the default profile.
- **Default seeded checklist**: New profiles are auto-populated via `materializeDefaultChecklist` with conditions mirroring the currently enabled auto-trade filters (trend, RSI, choppiness, etc.).
- **Declarative `INDICATOR_CATALOG`** (`@marketmind/trading-core`): Single source of truth for indicator metadata (params, outputs, valueRange, evaluator { service: 'pine' | 'native', scriptId, outputKey }) — foundation for zero-hardcoded-id indicator pipeline.
- **`user_indicators` table + router**: Per-user indicator instances with auto-seed of defaults on first access (`userIndicatorsRouter` + `seedDefaultUserIndicators`).
- **Generic `IndicatorConfigDialog`**: Unified create/edit/checklist-condition modes for indicator configuration (replaces per-indicator modal variants).
- **New condition operators**: `priceAbove`, `priceBelow` for comparing indicator series to close price.
- **Choppiness as a native indicator** in the checklist evaluator (ATR + highest/lowest composition via `PineIndicatorService`).
- **Flip chart toolbar button**: `LuFlipVertical2` toggle in `ChartToolsToolbar` now mirrors the `chartFlipped` chart preference (previously only reachable via Settings → Chart).

### Changed
- **`TradingProfile`** (`@marketmind/types`): New `checklistConditions: ChecklistConditionDto[]` field (persisted as JSON text in the new `checklist_conditions` DB column, migration `0030_checklist_conditions.sql`).
- **`ChecklistConditionDto.op`** is now typed as the `ChecklistConditionOp` union (was `string`) so frontend and backend agree on the allowed operators.

### Fixed
- **`handleToggleEnabled` switch signature**: `onCheckedChange` in `ChecklistEditor` now correctly handles the Chakra switch callback shape (was causing a TS error).

## [0.88.0] - 2026-04-17

### Added
- **OHLC row on chart header**: Hovering candles now shows OHLC + delta% + volume + buy/sell pressure inline in the chart header (shared `KlineOHLCRow` component also used by the tooltip)
- **Liquidity heatmap intensity mode**: New "intensity" color mode with warm ramp (olive → amber → red → magenta) that encodes magnitude without green/red bid/ask coloring; toggle in Settings → Chart
- **Fear & Greed reference lines**: 4 horizontal reference lines (25/45/55/75) on the Fear & Greed mini-chart, driven by the new `FEAR_GREED_LEVELS` constant (single source for colors and thresholds)
- **`useOrderQuantity` hook**: Single formula for order quantity calculation shared by the Quick Trade toolbar and chart canvas-direct entries (click/drag/Shift+Alt)
- **Fear & Greed level localization keys**: `extremeFear` / `fear` / `neutral` / `greed` / `extremeGreed` in en/pt/es/fr

### Fixed
- **Leverage missing in canvas-direct entries**: Click/drag/shortcut entries from the chart canvas were using `balance × pct / price` instead of `balance × leverage × pct / price`, producing smaller quantities than the Quick Trade sidebar
- **Liquidation CRITICAL threshold**: Raised from 3% to 5% (`LIQUIDATION_THRESHOLDS.CRITICAL` in `@marketmind/trading-core`) so critical alerts fire earlier
- **ORB label collision**: TSE and ASX zones that overlap during DST periods now concatenate into a single label (`ORB TSE / ASX`) instead of stacking on top of each other
- **Zoom cursor anchoring**: Candle under the cursor stays under the cursor during scroll zoom, even when the viewport was pinned to the last candle (snap-to-end override now only applies when the cursor is in the rightmost 5%)
- **Y-pan multiplication after Y-scale stretch**: Vertical pan was amplified proportionally to `priceScale` after stretching the Y axis — now `panVerticalOffset` honors the current `priceScale` so 1px of mouse motion equals 1px of chart motion regardless of zoom
- **"More actions" button border**: Quick Trade toolbar chevron now uses `variant="outline"` to match the other toolbar buttons
- **OHLC header overflow**: Header row now uses `nowrap` + `overflow="hidden"` on all inner stacks so OHLC/volume/buy% cannot wrap to a second line
- **Stochastic K/D colors swapped**: K and D line colors corrected in the Stochastic indicator
- **Position-sync fee correctness**: Real fees used during position sync instead of synthetic values

### Changed
- **Liquidity LUTs**: Moved inline LUTs out of `useLiquidityHeatmapRenderer` into a new `liquidityLUTs.ts` module (single source of truth for `BID_LUT_COLORED`, `ASK_LUT_COLORED`, `INTENSITY_LUT` + `getLiquidityLUTs(mode)`)
- **Fear & Greed color resolution**: `getFearGreedColor` now iterates `FEAR_GREED_LEVELS` instead of carrying hardcoded thresholds

## [0.87.0] - 2026-04-13

### Added
- **PineScript strategy system**: Migrated all 105 JSON strategies to PineScript v5 format (106 total .pine files) via PineTS runtime
- **PineIndicatorService**: Single-source backend indicator computation using PineTS, replacing `@marketmind/indicators` package
- **PineIndicatorCache**: Shared indicator cache layer integrated with FilterManager for batch backtesting performance
- **Frontend PineTS workers**: 15 frontend web workers migrated from `@marketmind/indicators` to PineTS async computation
- **Frontend pineWorkerService**: Unified PineTS service for all frontend indicator computation (22 indicators: SMA, EMA, RSI, ATR, HMA, WMA, CCI, MFI, ROC, CMO, VWAP, OBV, WPR, TSI, SAR, Highest, Lowest, BB, MACD, Stoch, KC, Supertrend, DMI)
- **Local indicator implementations**: Moved pivot points, swing points, and zigzag implementations from package to local `lib/indicators/`

### Removed
- **`@marketmind/indicators` package**: Deleted entirely (124 files, ~17K lines) — all functionality replaced by PineTS + local implementations
- **JSON strategy files**: Replaced by `.pine` PineScript v5 files in `strategies/builtin/`

### Changed
- **Backend filters**: All 14 filters migrated from `@marketmind/indicators` to PineIndicatorService
- **IndicatorEngine**: Migrated to PineTS for all indicator computations
- **Screener service**: Migrated to PineTS-based indicator computation
- **Monorepo packages**: Reduced from 7 to 6 shared packages (types, chart-studies, fibonacci, logger, trading-core, risk, utils)
- **Strategy interpreter**: Now parses PineScript v5 files instead of JSON configs

## [0.86.0] - 2026-04-07

### Added
- **Standalone Volume Profile**: Kline-based volume profile that works without scalping/wallet — calculates price-level volume distribution with POC, buy/sell separation directly from visible candles
- **Volume Profile in indicator popover**: Toggle on/off via Order Flow category alongside Footprint, Liquidity Heatmap, and Liquidation Markers
- **Footprint in indicator popover**: Now accessible from the Order Flow indicator category
- **Desktop build pipeline**: GitHub Actions workflow builds macOS (DMG+ZIP) and Windows (NSIS) installers on tag push, publishes to GitHub Releases
- **Auto-update on startup**: UpdateManager now checks for updates every 24h automatically
- **Release process documentation**: `docs/RELEASE_PROCESS.md` with version checklist and code signing guide

### Fixed
- **Kline candle corruption on symbol switch**: Invalidate React Query cache on symbol change and set staleTime to 0 — prevents stale cached candles when returning to a previously viewed symbol
- **Volume Profile coordinate mapping**: Uses `manager.priceToY()` like all other chart renderers instead of custom function that ignored chart padding and bounds

### Changed
- Default indicators: removed EMA-7 and Daily VWAP from defaults (kept EMA-9, EMA-21, EMA-200, Stochastic, RSI)
- Volume Profile decoupled from scalping metrics — works independently for any symbol/timeframe
- electron-builder config: added `publish` (GitHub provider) and `zip` target for macOS auto-update

## [0.85.0] - 2026-04-04

### Added
- **Open-source release**: Repository is now public under MIT license
- **Landing page**: MarketMind presentation site at [marketmind-app.vercel.app](https://marketmind-app.vercel.app) with 4 languages (EN/PT/ES/FR), dark/light mode
- **Backend demo mode**: `DEMO_MODE` env var for read-only deployment (charts + indicators without auth/trading)
- **Portfolio integration**: MarketMind featured on GitHub profile README

### Changed
- Updated README with landing page link, current stats (7,200+ tests), and full package list
- Updated QUICK_START.md with current date
- Cleaned up repository: removed stale logs, old optimization plans, and internal AI prompts

### Removed
- `MONOREPO.md` (redundant with QUICK_START.md)
- `CUSTOM_SYMBOLS_IMPLEMENTATION_PROMPT.md` (internal AI prompt)
- `docs/plans/PLAN-01` through `PLAN-06` (old optimization plans)
- Stale log and result files from root and apps/backend

## [0.84.0] - 2026-04-03

### Added
- **Long/Short Position drawing tools**: New drawing types for projecting trades with entry, SL, TP zones, R:R ratio, percentage badges, and adjustable handles
- **Drawing lock system**: Lock/unlock button in drawing toolbar prevents accidental editing and deletion of drawings
- **Order confirmation modal**: Buy/Sell orders now show confirmation dialog with symbol, side, price, quantity, leverage, total value, margin required, and liquidation price
- **Leverage-aware position sizing**: % buttons in order entry now represent percentage of total margin (balance × leverage) instead of just wallet balance

### Fixed
- **Drawing position drift on reload**: Deserialized drawings lost time fields needed for index re-resolution when klines changed
- **Drawing selection after creation**: Redundant `setActiveTool(null)` after `selectDrawing()` was clearing the selection immediately
- **Drawing handle drag corruption**: Handle drag captured resolved indices instead of raw store indices, causing position corruption on subsequent interactions
- **Hit testing mismatch**: Hit testing now uses resolved indices matching what the renderer displays
- **Current price line style not applied**: `currentPriceLineStyle` setting was stored but never passed to renderer (hardcoded `setLineDash`)
- **Current price line width mismatch**: Default constant was THICK (2px) while config default was 1px
- **Chart padding not applied**: `paddingTop`/`paddingBottom` config values were ignored by CanvasManager coordinate mapping

### Changed
- **ORB moved to indicator system**: Opening Range Breakout moved from toolbar toggle to indicator selector under Price Structure category
- **Drawing toolbar position**: Toolbar now fixed at top-center of chart instead of following the drawing
- **Ruler icon**: Improved SVG to look like an actual ruler with body and tick marks
- **Ruler button position**: Moved next to Price Range in toolbar
- **Default current price line style**: Changed from 'solid' to 'dotted'
- **P/L areas toggle removed**: Replaced by new Long/Short Position drawing tools

## [0.83.1] - 2026-03-30

### Fixed
- **Heatmap column alignment**: Columns now align exactly with candlesticks using same coordinate system as CanvasManager
- **Heatmap real-time updates**: Live bucket emitted every 2s so current candle shows data immediately instead of lagging by 1 minute
- **Heatmap settings apply immediately**: Adding always-collect symbols starts depth collection instantly, no restart needed

### Changed
- **TimescaleDB hypertable**: Heatmap table converted to hypertable with auto-compression (>1 day) and retention policy (7 days)
- **Code review optimizations**: Race condition fix, stack overflow prevention, deduped bid/ask loops, extracted constants, capped snapshot payload

## [0.83.0] - 2026-03-30

### Added
- **Liquidity Heatmap**: Thermal overlay on the price chart showing order book depth density with bid (green) and ask (red) separation
- **Full order book sampling**: Aggregator samples all 1000 levels every 2s, bins by price, accumulates into 1-minute time buckets
- **Heatmap data persistence**: Buckets saved to PostgreSQL (`liquidity_heatmap_buckets` table), loaded on startup (last 24h)
- **Always-collect symbols**: Settings UI in Data tab to configure symbols that always collect depth data (BTCUSDT by default)
- **Heatmap always-collect config**: New tRPC router (`heatmap`) with get/add/remove endpoints, changes apply immediately
- **Order Flow indicator category**: New category in indicator toggle popover with Liquidity Heatmap toggle

### Changed
- **Removed old OrderBookHeatmap**: Replaced useless sidebar heatmap with chart-integrated thermal overlay
- **OrderFlowSidebar**: Reduced to 2 tabs (DOM, Metrics) after removing Heatmap tab
- **Depth stream**: Added `getFullBook()` method exposing full order book Maps for heatmap aggregation

### Removed
- **OrderBookHeatmap component**: Sidebar-based heatmap with no price alignment (replaced by chart overlay)

## [0.82.0] - 2026-03-29

### Added
- **Authentication pages**: Login, Register, Forgot Password, Reset Password pages with full i18n (en, pt, es, fr)
- **Email verification**: Registration now sends verification email; verify-email page with resend support
- **Two-factor authentication**: Optional email-based 2FA per user; 6-digit code input page with resend
- **Password recovery**: Resend email service for password reset with secure single-use tokens (1h expiry)
- **Remember me**: Login supports short (24h) vs long (30d) session duration
- **User avatar dropdown**: Toolbar avatar with initials, dropdown menu for Account, Settings, and Logout
- **Account dialog**: Edit profile name, view email verification status, toggle 2FA, member since date
- **User profile**: `name` column on users table with `updateProfile` endpoint
- **Auth guard**: Route protection replacing dev-only AutoAuth; redirects to login when unauthenticated
- **Cleanup scheduler**: Hourly cleanup of expired sessions, tokens, and 2FA codes
- **Rate limiting**: Password reset (3/email/hr), email verification (5/email/hr), 2FA attempts (5/user/15min)
- **Security audit events**: PASSWORD_RESET_REQUEST/SUCCESS/FAILURE, EMAIL_VERIFICATION_SENT/SUCCESS, TWO_FACTOR_SENT/SUCCESS/FAILURE/TOGGLED

### Changed
- **ChakraProvider lifted** from App.tsx to index.tsx so auth pages share the theme
- **Settings button** moved from toolbar to user avatar dropdown
- **PasswordInput** fixed to full-width (100%) matching other inputs
- **Auth constants** extracted to `AUTH_EXPIRY` (backend) and `AUTH_UI` (frontend) for single source of truth
- **Rate limiter cleanup** deduplicated from 5 identical loops to generic `cleanupStore()` function
- **Email templates** use extracted `EMAIL_COLORS` constants and derive expiry text from `AUTH_EXPIRY`
- **Error handling** uses tRPC error codes (`isRateLimited`, `isConflict`) instead of fragile string matching

### Removed
- **AutoAuth component**: Replaced by proper AuthGuard with login redirect

## [0.75.0] - 2026-03-24

### Added
- **Daily & Weekly VWAP indicators**: new chart overlays alongside existing Monthly VWAP, with distinct orange tones
- **RSI(14) indicator**: standard 14-period RSI with 70/30 overbought/oversold levels, alongside existing RSI(2)
- **Default active indicators**: Stochastic, RSI(14), and Daily VWAP now enabled by default for new users
- **SIGNAL_COLORS semantic palette**: centralized base colors (BULLISH, BEARISH, PRIMARY, SECONDARY, etc.) eliminating ~60 duplicate color definitions
- **Drawing color tokens**: fibonacci golden, key level, buy/danger zone, label bg, snap indicator colors now in theme system
- **VWAP, ATR, and order flow color tokens**: all chart colors now flow through Chakra semantic tokens with light/dark mode support

### Fixed
- **Overlay indicator clipping**: 15+ overlay renderers (ATR, Supertrend, Ichimoku, Parabolic SAR, Keltner, Donchian, DEMA/TEMA/WMA/HMA, Pivot Points, Fibonacci, Session Boundaries, Volume Profile, Footprint) now clip to chart area, preventing bleeding into oscillator panels
- **Drawing clipping**: fibonacci drawings, areas, and all user drawings now clip to chart area
- **Sub-panel oscillator clipping**: 11 oscillators (Vortex, AO, Aroon, CMO, Elder Ray, Klinger, TSI, ROC, MFI, Ultimate Osc, PPO) now clip to their panel boundaries via `applyPanelClip()`
- **VWAP UTC consistency**: all VWAP variants (daily, weekly, monthly) now use UTC for period boundary detection, fixing timezone-dependent calculation errors
- **VWAP boundary detection**: daily VWAP now compares year+month+day (not just day), monthly compares year+month (not just month), preventing reset failures across month/year boundaries
- **Right margin clipping**: overlays no longer cut short at `effectiveWidth`; clip rect uses `chartWidth` matching kline rendering
- **Token-INDICATOR_COLORS sync**: ADX, Ichimoku chikou, OBV, CCI, MACD, Klinger/PPO zero lines dark mode values now match between theme tokens and fallback constants
- **RSI line color**: changed from purple to blue (#2196f3) for both RSI(2) and RSI(14)

### Changed
- **Unified color architecture**: all chart colors now flow from `chartIndicatorTokens.ts` (tokens) → `colorResolvers.ts` → `useChartColors()` → renderers, with `INDICATOR_COLORS` as fallback
- **INDICATOR_COLORS deduplicated**: ~40 constants now reference `SIGNAL_COLORS` base values instead of repeating hex literals
- **All hex colors lowercase**: standardized to lowercase format across all color files
- **Light mode color variants**: ~15 tokens updated with proper light-mode values for VWAP, scalping, FVG, drawing colors

### Removed
- **Dead code**: `useFibonacciProjectionRenderer.ts` (orphaned, never imported) and all references

## [0.74.0] - 2026-03-22

### Added
- **Instant position feedback**: all trading mutations (create, close, cancel, update SL/TP, reverse) now return updated open executions in the response, enabling instant UI updates via React Query `setQueryData`

### Changed
- **Trading mutations enriched response**: `createOrder`, `cancelOrder`, `closePosition`, `reversePosition`, `closePositionAndCancelOrders`, `closeTradeExecution`, `cancelTradeExecution`, `updateTradeExecutionSLTP`, `cancelIndividualProtectionOrder` all return `openExecutions` alongside their normal response
- **Frontend cache updates**: `useBackendTradingMutations`, `useBackendFuturesTrading`, and `useChartTradingActions` now use `setQueryData` for instant cache updates instead of waiting for query refetch cycle

### Refactored
- **44 files split to ≤500 lines**: systematic code quality pass across the entire monorepo
  - `binance-futures-user-stream.ts` (2519→542): handlers extracted to `user-stream/`
  - `auto-trading.ts` router (2282→index): 9 sub-routers
  - `ChartCanvas.tsx` (2182→379): hooks extracted for trading data, shortcuts, animations
  - `trading.ts` router (2085→index): 7 sub-routers
  - `useOrderLinesRenderer.ts` (1674→244): drawing, hit-test, render sections extracted
  - `order-executor.ts` (1666→270): validator, sizing, executors extracted
  - `auto-trading-scheduler.ts` (1628→290): thin facade over modules
  - `IndicatorEngine.ts` (1582→368): handlers, cache, screener extracted
  - `futures-trading.ts` (1341→index): 8 sub-routers
  - `position-monitor.ts` (1328→440): exit, fees, liquidation extracted
  - `theme/index.ts` (1250→30): tokens, recipes, color resolvers extracted
  - `ProfileEditorDialog.tsx` (1191→240): form sections and hooks extracted
  - `kline-maintenance.ts` (1087→343): gap/corruption detection extracted
  - `pyramiding.ts` (1021→482): calculations and evaluators extracted
  - `ExitCalculator.ts` (981→432): swing/pivot helpers extracted
  - Plus 29 more files between 500-973 lines

## [0.73.0] - 2026-03-21

### Added
- **Opening Range Breakout (ORB) renderer**: new chart overlay that visualizes the opening range of each trading session with breakout levels and tests (276 test cases)
- **ORB toggle in chart tools toolbar**: users can now enable/disable ORB visualization from the chart tools menu

### Changed
- **QuickTradeToolbar overhaul**: simplified size presets (0.5, 1, 5, 10, 50, 100), added menu-based actions, cleaner layout
- **TradingSidebar**: now receives symbol, marketType, and quick trade mode props for better integration with QuickTradeActions
- **Layout improvements**: updated MainLayout, ChartWindow, and Toolbar for better component composition

### Performance
- **Parallelize SL+TP protection orders**: stop loss and take profit orders are now placed simultaneously via `Promise.all()`, saving 200-400ms per trade execution
- **Reduce tRPC polling overhead**: chart trading queries reduced from 18 req/min to ~4 req/min per chart (78% reduction) by using standardized `QUERY_CONFIG` intervals
- **Eliminate unnecessary overlay redraws**: removed 1-second `setInterval` that forced overlay redraws even with no data changes (60 wasted redraws/min eliminated)
- **Optimize order animation RAF loop**: replaced 100ms polling with event-driven approach — RAF loop only runs during active loading/flash animations

### Removed
- **Daily PnL visibility toggle**: removed eye icon button and show/hide logic from Portfolio summary (PnL is now always visible)

## [0.72.0] - 2026-03-20

### Added
- **useKlineLiveStream hook**: extracted kline live stream logic from App.tsx and ChartWindow.tsx into a reusable hook, eliminating ~300 lines of duplicated code
- **Instant order feedback**: all order operations now follow a consistent loading → flash → error toast pattern (entry creation, cancel, close, entry drag, grid orders)
- **Grid orders optimistic UI**: grid orders now appear instantly with loading spinners, flash on confirmation, and clean up on error

### Changed
- **Kline interval constants unified**: replaced duplicated `INTERVAL_MS` maps across `klineQueries.ts`, `kline-fetcher.ts` with single `INTERVAL_MS` from `@marketmind/types`
- **WebSocket reconnect grace period**: reduced from 60s to 10s for faster recovery
- **Kline mapper cleanup**: removed unused legacy aliases (`convertDbKlineToKline`, `convertDbKlinesToKlines`, `convertDbKlinesReversed`)
- **Orphan order detection**: simplified hook to use backend executions directly with proper null-safety
- **Backend test mocks updated**: aligned test mocks with refactored kline mapper and trailing stop exports

### Fixed
- **Reduce order optimistic UI**: LONG entries against SHORT positions (and vice versa) now show instant optimistic feedback instead of being silently skipped
- **Exchange order cancel missing flash**: cancel operations now show confirmation flash animation
- **Position close missing flash**: close operations now show brief confirmation flash before removal
- **Exchange entry drag missing flash**: drag-to-move on exchange orders now shows flash at new price
- **Grid order error cleanup**: when a grid order fails mid-batch, all remaining unprocessed optimistic entries are properly cleaned up

## [0.71.0] - 2026-03-19

### Added
- **Arrow drawing tool**: two-point arrow with arrowhead, same interaction as line tool
- **Text drawing tool**: single-click placement with inline editing, font size/bold/underline support
- **Per-drawing color and line width**: all drawing types now support custom color and thickness
- **Floating drawing toolbar**: appears on selection with color presets, custom color picker, line width buttons, delete; draggable; text-specific font controls
- **Pencil smoothing**: quadratic bezier interpolation replaces jagged lineTo, with 3px minimum distance filter
- **Right-click context menu**: "Clear All Drawings" option on chart (legacy setup menu items removed)
- **Trailing stop indicator interval**: configurable ATR calculation timeframe independent from trading interval
- **Economic calendar provider**: backend router, frontend EconomicCalendarProvider service
- **Market session boundaries**: session boundary renderer on chart with market event tooltips

### Changed
- **chart-studies types refactored**: extracted shared `TwoPointFields` interface, collapsed duplicate serialization cases, merged identical hit-testing handle branches
- **Type guard for two-point drawings**: `isTwoPointDrawing()` replaces 6 repeated type union checks in interaction handler
- **Context menu simplified**: removed legacy setup-related items (hide/show/delete setups), now drawings-only

## [0.70.0] - 2026-03-18

### Added
- **Chart color palettes**: configurable chart palettes (Default, TradingView, Monokai, Night Owl, Solarized) in Settings > Chart
- **Liquidation price on execution creation**: auto-calculated via `calculateLiquidationPrice` when opening futures positions, also synced on pyramid entries
- **Quick trade size presets expanded**: added 25%, 50%, 100% presets, slider max raised to 100%

### Fixed
- **Orphaned sibling executions after SL close**: when Binance closes an entire position (consolidated group) via one SL algo order, remaining sibling executions now get properly closed by checking Binance position=0 in `closeResidualPosition`
- **Position sync orphan handling**: `processedSymbols` skip now only applies to the update path, allowing all orphaned executions for the same symbol to be closed in a single sync cycle
- **User stream test mocks**: added missing `emitPositionClosed`, `getPositionEventBus`, and `cancelAllSymbolOrders` mocks that prevented `cancelPendingEntryOrders` tests from passing

### Changed
- **Liquidation alert thresholds tightened**: WARNING 50%→15%, DANGER 25%→8%, CRITICAL 10%→3% (closer to actual liquidation)
- **Liquidation alert cooldown**: increased from 60s to 5min to reduce alert spam
- **Volume renderer simplified**: removed buy-pressure (taker) coloring from volume bars for cleaner rendering

## [0.69.0] - 2026-03-16

### Added
- **EMA cross scalping strategy**: EMA 7/9 crossover with CCI + Parabolic SAR trend confirmation, ATR-based SL/TP
- **ATR-based SL/TP for all scalping strategies**: dynamic exit levels clamped within min/max bounds, replacing fixed percentages
- **Direction mode**: scalping config supports `auto`, `long_only`, `short_only` filtering
- **DirectionModeSelector UI component**: reusable direction mode picker in `@renderer/components/ui`
- **KlineIndicatorManager service**: centralized indicator state management for scalping
- **Screener presets**: "Best for Scalping", "CCI Scalping Long", "CCI Scalping Short"
- **Scalping DB columns**: `directionMode`, extended strategy enum with `ema-cross`

### Changed
- **Scalping signal engine**: all strategies now use `computeAtrExit()` with ATR multipliers and fallback percentages
- **buildResult**: simplified — receives `slPercent`/`tpPercent` instead of raw distances
- **Scalping constants**: added ATR multipliers and bounds (`SCALPING_ATR`), EMA cross constants
- **Startup audit**: expanded validation for scalping state consistency
- **WatchersList**: shows direction mode badge, improved scalping status display

### Fixed
- **Position monitor SL/TP log spam**: consolidated check was firing every tick when exchange-side protection existed — now skips silently if all executions have exchange SL/TP orders

### Removed
- **28 obsolete scripts**: one-time audit, debug, and trading fix scripts no longer needed

## [0.68.0] - 2026-03-15

### Added
- **Portfolio margin-based metrics**: Stop-Protected and TP-Projected now show PnL at SL/TP level as % of margin (leverage-adjusted ROI) instead of raw notional value
- **Portfolio margin line**: Total Exposure section shows margin amount when positions have leverage > 1
- **Translation keys**: `stopProtectedOfMargin`, `tpProjectedOfMargin`, `margin` in all 4 locales (en/pt/es/fr)

### Changed
- **Default indicators**: removed MACD and Bollinger Bands from defaults; added CCI (period 14)
- **CCI overbought/oversold levels**: ±100 → ±150 for fewer, higher-quality signals
- **Parabolic SAR defaults**: step 0.02/max 0.2 → 0.03/0.3 for faster reaction on lower timeframes
- **Default EMAs**: EMA 7 (cyan), EMA 9 (magenta), EMA 21 (green), EMA 50 (gold) active by default; EMA 200 disabled; EMA 19 color changed to magenta
- **Scalping execution engine**: improved position management, scheduler robustness, signal engine tuning
- **Leverage storage**: backend now correctly stores and propagates leverage across all trade execution paths
- **LeveragePopover**: simplified, reads actual leverage from exchange
- **Kline prefetch**: improved reliability and error handling
- **Trailing stop**: enhanced with better leverage awareness
- **Protection orders**: improved error handling and retry logic
- **TrpcProvider**: improved cache management
- **DomLadder**: rendering improvements
- **API ban detection**: new apiBanStore for tracking rate limit bans

### Fixed
- **Stop-Protected display**: was showing notional value at SL (e.g., 994% of margin); now shows actual PnL at SL level with correct sign (red for loss, green for locked profit)
- **Portfolio PnL%**: already correctly multiplied by leverage (verified)
- **Chart drag preview**: already correctly applies leverage to SL/TP percentage preview (verified)
- **Order executor**: leverage correctly passed through auto-trading pipeline

## [0.67.0] - 2026-03-14

### Added
- **Scalping system end-to-end**: complete real-time scalping pipeline from UI → tRPC → Scheduler → Binance streams → Signal evaluation → Order execution → Position close → Metrics display
- **5 scalping strategies**: imbalance, CVD divergence, mean reversion (VWAP), momentum burst, absorption reversal — each with configurable SL/TP and confidence scoring
- **3 Binance real-time streams**: aggTrade, bookTicker, and depth20 streams with auto-reconnect and subscription management
- **Order book analysis**: OrderBookManager with imbalance ratio, microprice, spread, wall detection, and absorption detection
- **Volume profile**: real-time POC (Point of Control), value area high/low with 70% coverage (Market Profile standard)
- **CVD tracking**: cumulative volume delta with 300-bar history, exhaustion detection (momentum tapering)
- **Execution engine**: MARKET/LIMIT/IOC order modes, SL/TP protection orders, micro-trailing stop (8 ticks), emergency close on protection failure
- **Circuit breaker**: session loss limit (2%), daily loss limit (2%), max daily trades (50), max session trades (50)
- **Consecutive loss cooldown**: pauses signals for 15 minutes after 3 consecutive losses, resets on first win
- **PositionEventBus**: event-driven position close propagation from Binance user stream to scalping engine
- **ScalpingConfig DB table**: per-wallet configuration with 25+ tunable parameters (leverage, position size, strategies, thresholds)
- **Scalping tRPC router**: 9 endpoints — getConfig, upsertConfig, start, stop, getStatus, getMetrics, getVolumeProfile, getAggTradeHistory, resetCircuitBreaker
- **Scalping dashboard UI**: real-time metrics display, signal feed, circuit breaker status, volume profile visualization
- **ScalpingConfig UI**: full configuration panel with strategy toggles, risk parameters, execution mode, chart settings
- **Chart overlays**: CVD renderer, imbalance heatmap, volume profile overlay with POC/value area lines
- **Tick & volume charts**: configurable ticks-per-bar and volume-per-bar from scalping config
- **Metrics history mapping**: maps scalping metrics history to kline timestamps for chart overlay alignment
- **AutoTradingSidebar**: reorganized layout separating auto-trading and scalping controls
- **Comprehensive test suite**: 163 new tests covering SignalEngine (52), OrderBookManager (26), MetricsComputer (28), PositionEventBus (4), ExecutionEngine (24), constants (29)

### Changed
- **Scalping parameter optimization**: LARGE_TRADE_MULTIPLIER 5.0→4.0, MAX_SPREAD_PERCENT 0.05→0.03, MICRO_TRAILING_TICKS 3→8, SIGNAL_COOLDOWN_MS 5s→8s, CVD_DIVERGENCE_TP 0.4%→0.5%, MOMENTUM_BURST_MIN_IMBALANCE 0.3→0.4
- **DB defaults optimized for crypto scalping**: executionMode POST_ONLY→MARKET, positionSizePercent 1%→2%, maxConcurrentPositions 1→2, leverage 5x→3x
- **Scheduler uses SCALPING_DEFAULTS constants**: replaced hardcoded fallback values with centralized constant references
- **Sidebar layout reorganized**: trading sidebar split into auto-trading and scalping sections

### Fixed
- **Circuit breaker daily reset ordering**: `checkDailyReset()` now runs before trip status check in `evaluate()`, ensuring the circuit breaker properly clears at midnight UTC instead of staying permanently tripped
- **Position close events**: Binance futures user stream now emits PositionEventBus events on SL/TP fills, enabling scalping engine to track trade outcomes

## [0.66.0] - 2026-03-14

### Added
- **Close Position button**: closes position at market and cancels all orders (SL, TP, entries) for the symbol
- **Cancel Orders button**: cancels all pending entry orders (regular orders only, preserves SL/TP)
- **Enter key support**: ConfirmationDialog now supports pressing Enter to confirm for speed

### Changed
- **Reverse position flow**: sequential cancel → close → open instead of single 2x order, freeing margin between steps
- **QuickTradeToolbar layout**: moved GridOrderPopover and TrailingStopPopover to slider row; button row is now [Reverse] [Close] [Cancel] [Buy] [Sell]
- **Reverse button color**: changed from orange to blue
- **Toolbar spacing**: increased gaps and padding for better visual harmony

## [0.65.0] - 2026-03-14

### Performance
- **Order execution latency**: removed 300ms hard `setTimeout` delays in futures user stream, reduced backoff from 1000ms to 100ms per attempt — order round-trip reduced from ~1.5s to ~200ms
- **Wallet lookup cache**: in-memory 60s TTL cache replaces ~10 DB queries per order event in `BinanceFuturesUserStreamService`
- **Pyramid lock**: replaced spin-wait pattern with queue-based async mutex with 30s timeout and FIFO ordering
- **Price update batching**: `requestAnimationFrame`-based batching reduces WebSocket price store writes from 100/sec to ~60/sec (one per frame)
- **Sidebar price throttle**: reduced from 1000ms to 250ms for smoother real-time price display
- **Canvas layer invalidation**: kline updates no longer invalidate static background layer (grid, labels)
- **Incremental MA calculation**: detects append-only kline updates and reuses cached prefix instead of full recalculation
- **Drawing index cache**: binary search results cached per drawing, invalidated only when klines change
- **Strategy loader cache**: `loadAllCached()` with directory mtime check eliminates 105 file reads per cycle
- **Custom symbol N+1 fix**: batch query with in-memory grouping replaces N+1 per-symbol component queries
- **SMA sliding window**: O(n) single-pass instead of O(n*p) — 200x faster for period=200
- **FVG single-pass**: integrated gap detection and fill checking in one forward pass instead of O(n²)
- **klinesLatest polling**: reduced from 30s to 5min fallback (WebSocket already delivers real-time)
- **Vite code splitting**: `manualChunks` for vendor splitting (react, chakra, query, i18n, zustand)

### Added
- **`updatePriceBatch()`**: new price store method for batched WebSocket updates with single Zustand notification
- **Direction utilities**: `sideToDirection`, `directionToSide`, `sideToBias`, `biasToSide`, `directionToBias`, `biasToDirection` in `@marketmind/types`
- **EMA utility**: `emaMultiplier()` and `calculateEmaStep()` in `packages/indicators/src/utils/ema.ts`
- **Compound DB indexes**: `trade_executions_wallet_status_idx`, `trade_executions_wallet_closed_idx`, `custom_symbol_components_active_idx`
- **`shutdown()` method**: clean resource cleanup for `BinanceFuturesUserStreamService`

### Changed
- **getKlineClose deduplication**: replaced 41 local definitions across indicator files with single import from `@marketmind/types`
- **Kline mapper dedup**: `auto-trading-scheduler.ts` uses `mapDbKlinesReversed` instead of inline mapping
- **Strategy loader singleton**: setup-detection router uses shared `StrategyLoader` instance with `loadAllCached()`
- **Console.log cleanup**: 14 debug statements in `RealtimeTradingSyncContext` guarded with `import.meta.env.DEV`
- **Map cleanup**: hourly pruning of `recentlyRotatedWatchers` and `rotationPendingWatchers` in auto-trading scheduler

## [0.64.0] - 2026-03-14

### Fixed
- **Indicator X-coordinate alignment on zoom**: fixed 30 indicator renderers (Parabolic SAR, Supertrend, Ichimoku, Donchian, Keltner, HMA, DEMA, TEMA, WMA, FVG, Fibonacci, Liquidity Levels, Pivot Points, ROC, ADX, Aroon, MFI, TSI, Elder Ray, PPO, Vortex, AO, Klinger, CCI, Ultimate Osc, CMO, Williams %R, OBV, CMF, ATR) that drifted out of alignment with candles when zooming — root cause was using `effectiveWidth` (chartWidth - margin) instead of `chartWidth` for X position calculations
- **Drawing sync refactor**: extracted drawing sync logic to `drawingSyncManager` service, moved backend ID maps and hydration state to `drawingStore`, simplified `useBackendDrawings` hook to eliminate race conditions and stale ref issues

### Changed
- **Bollinger Bands enabled by default**: added to default active indicators alongside Volume and Parabolic SAR
- **Hardcoded margin values replaced**: replaced hardcoded `72` with `CHART_CONFIG.CHART_RIGHT_MARGIN` in Fibonacci, FVG, Liquidity Levels, and Pivot Points renderers

## [0.63.0] - 2026-03-13

### Added
- **Reverse position**: one-click position reversal (close + open opposite side) with confirmation dialog, supports both paper and live Binance futures
- **Trailing stop chart placement**: click on chart to set trailing stop activation price per symbol, with shield icon and dashed preview line
- **Trailing stop activation lines**: open positions show trailing stop activation level on chart with shield icon
- **Canvas icons module**: extracted `drawBotIcon` and `drawShieldIcon` to `canvasIcons.ts` for reuse across chart renderers
- **Trailing stop placement store**: Zustand store for chart-based TS activation placement mode
- **Order loading timeout**: loading spinners auto-clear after 15s to prevent stuck UI states

### Changed
- **Unified indicator engine**: moved `IndicatorEngine` to `services/indicator-engine/` with per-indicator caching (`singleCache`) — cross-strategy indicator deduplication
- **Unified detection entry point**: single `detectSetups()` function replaces per-strategy interpreter creation in signal-processor and setup-detection router
- **Shared IndicatorEngine in range detection**: `detectSetupsInRange` shares one engine across all candle iterations
- **Signal processor refactored**: replaced manual strategy loop with unified `detectSetups()` call
- **Screener uses IndicatorEngine**: `screener-service.ts` delegates to `IndicatorEngine.evaluateScreenerIndicator()` instead of standalone evaluator
- **Constants relocated**: `indicator-metadata.ts` and `screener-presets.ts` moved to `constants/` directory
- **Exit utils extracted**: `checkStopLossAndTakeProfit` and `applySlippage` extracted to shared `exitUtils.ts`, used by `ExitManager`
- **Default MA presets**: updated default moving average periods and visibility (EMA 7, 9, 21 visible by default)
- **Order loading map**: changed from `boolean` to `timestamp` for timeout-based cleanup
- **Order line icon system**: generalized from `isAutoTrade` boolean to `icon: 'bot' | 'shield' | null` for extensibility

### Removed
- **Pre-detection system**: deleted `SetupPreScanner` (236 lines) and `FilterPreValidator` (228 lines) — added latency without meaningful value
- **Enhanced scoring**: removed `getEnhancedSymbolScores()`, `pendingSetup`/`filterPassRate` weights from `OpportunityScoringService`
- **Standalone indicator evaluator**: deleted `screener/indicator-evaluator.ts` (302 lines), replaced by unified `IndicatorEngine`

---

## [0.62.0] - 2026-03-12

### Added
- **ToggleIconButton component**: new `ui/toggle-icon-button.tsx` — ghost-only toggle with `active` prop, replaces 26+ verbose toggle patterns
- **8 new UI wrappers**: `Badge`, `CloseButton`, `Link`, `Alert`, `Skeleton`, `Textarea`, `Menu`, `Image` — all following Chakra theming system
- **UI barrel export**: single canonical import path `@renderer/components/ui` for all 40+ components
- **UI Components Standardization Plan**: `docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`

### Changed
- **Blue button removal**: all solid blue buttons replaced — toggles use `variant="ghost"` with `color` prop, action buttons use `variant="outline"`
- **Import standardization**: ~100 files migrated from fragmented imports to single barrel path
- **BrlValue moved**: from `ui/` to `components/` (domain component, not pure UI)
- **UI internal imports**: changed to relative paths to avoid circular barrel dependencies
- **Documentation updated**: `CLAUDE.md`, `docs/UI_STYLE_GUIDE.md`, `ui/README.md` with full component catalog and theming rules

### Removed
- Legacy direct Chakra imports of interactive components outside `ui/` wrappers
- Obsolete fragmented import paths (`../ui/button`, `@/renderer/components/ui/slider`, etc.)

---

## [0.61.0] - 2026-03-12

### Added
- **Realized PnL Events**: all close paths (manual close, algo verify fallback, opportunity-cost stale close) now insert `realized_pnl_events` so daily P&L stays accurate
- **Untracked Reduce Order Handling**: BUY-against-SHORT and SELL-against-LONG fills from untracked exchange orders now trigger partial close (qty update + PnL recording) or full close with wallet balance update
- **Exchange Order Chart Visibility**: untracked exchange orders (not linked to any execution) now appear as draggable order lines on the chart with cancel and cancel+replace (drag) support
- **`totalWalletBalance` Column**: wallets schema extended with `total_wallet_balance`, synced from Binance account info for accurate exposure calculation
- **Audit Scripts**: `backfill-realized-pnl-events`, `cancel-orphan-orders`, `check-yesterday-pnl`, `find-ghost-trades`
- **UI Components**: `icon-button` and `separator` primitives

### Fixed
- **Daily P&L not updating**: 3 close paths were missing `realized_pnl_events` inserts — manual close, algo verify timeout fallback, and opportunity-cost stale close
- **Phantom opposite-side positions**: reduce orders (BUY against SHORT) no longer create phantom LONG pending executions — all create-pending paths (STOP_MARKET, TP_MARKET, LIMIT in both `trading.ts` and `futures-trading.ts`) now check for existing opposite-side position
- **Exposure % incorrect**: calculation now uses `totalWalletBalance` (without unrealized PnL) instead of `marginBalance` as denominator, matching Binance's actual exposure
- **Phantom SL/TP order lines on chart**: `trackedOrderIds` now collects IDs from ALL executions (not just those with `entryOrderId`), preventing SL/TP algo orders from appearing as orphan entries
- **SL/TP drag race condition**: exchange order queries now invalidate alongside execution data after SL/TP updates, preventing brief phantom order line flicker
- **Pending entry disappearing on chart drag**: fixed order drag handler for pending entries
- **Double-pyramid on STOP_MARKET algo entry fills**: prevented duplicate execution creation
- **`cancelAllOpenProtectionOrdersOnExchange` scope**: now only cancels `reduceOnly` orders

---

## [0.60.0] - 2026-03-11

### Added
- **Chart Drawing Tools**: pencil, line, rectangle, fibonacci retracement, and ruler tools with OHLC magnet snap; drawings persisted via backend (`chart_drawings` table + `drawing` tRPC router)
- **Drawing Store**: Zustand store for drawing tool state (active tool, magnet toggle, drawing lifecycle)
- **Chart Studies Package**: new `@marketmind/chart-studies` shared package for drawing types, hit-testing, and constants
- **Binance Script Rate Limiting**: shared `guardedCall` utility in `scripts/utils/binance-script-guard.ts` — all 10 trading scripts now use centralized rate limiting to prevent IP bans
- **Auto-trade Pyramid Merge (MARKET)**: `order-executor.ts` now merges MARKET pyramid orders into existing execution (weighted avg price, exchange-synced qty, cancel+replace SL/TP with total qty) instead of creating duplicate open executions

### Changed
- **Chart Tools Toolbar**: replaced measurement ruler/area toggles with drawing tool buttons (pencil, line, rectangle, fibonacci, ruler) and magnet toggle
- **OverlayLayer**: removed measurement area rendering code; simplified props
- **useChartState**: removed `MeasurementArea` type and related state
- **Quick trade price source**: `ChartCanvas.tsx` now uses real-time WebSocket price (`usePriceStore`) instead of last kline close for order placement accuracy

### Fixed
- **`cancelPendingEntryOrders` nuclear cancel** (Step 1): replaced `cancelAllSymbolOrders()` with targeted per-order cancellation — only cancels the specific pending execution's entry orders and protection orders, preserving unrelated orders
- **Ghost SL/TP on drag update** (Step 2): `updateStopLossOrder`/`updateTakeProfitOrder` now retry cancel once before creating replacement order, with explicit ghost risk logging
- **Partial close SL/TP qty stale** (Step 3): after partial close updates quantity, `scheduleDebouncedSlTpUpdate` is called to recreate SL/TP with reduced qty
- **Duplicate open executions on pyramid** (Step 4): auto-trade MARKET pyramids no longer create separate `tradeExecutions` rows — merge into primary execution with updated avg price and total qty
- **Reduce/partial-close orders invisible on chart**: removed `existingOpposite` guard that skipped `tradeExecution` creation for orders placed against an existing position — SELL orders to reduce a LONG (and vice versa) now appear on chart as pending order lines
- **LIMIT order auto-correction**: `trading.ts` detects LIMIT orders that would cross the spread (immediate fill) and auto-converts to STOP_MARKET for correct pending behavior
- **`cancelAllOpenProtectionOrdersOnExchange`**: new function cancels all exchange-side protection orders for a symbol without requiring specific order IDs — used in pyramid SL/TP replacement

---

## [0.59.0] - 2026-03-10

### Added
- **SL/TP Placement Buttons**: clickable SL/TP buttons on entry order lines — click to enter placement mode, click on chart to set price; replaces drag-from-entry interaction
- **Unified PnL Calculator**: centralized `calculatePnl` utility used across execution-manager, position-sync, and user-stream for consistent PnL calculation including funding
- **Pyramid Position Merge**: `mergeIntoExistingPosition` method consolidates pyramid fills with exchange-verified qty/price, replacing scattered inline merge logic
- **Sibling Execution Close**: manual close now finds and closes all open executions for the same symbol+side (unified position close)
- **Chart Viewport Persistence**: switching symbols preserves horizontal scroll position for easy cross-symbol comparison; vertical zoom resets automatically
- **Backfill Progress WebSocket**: scanner backfill progress now properly delivered via wallet room subscription
- **`resetForSymbolChange` (CanvasManager)**: new public method that resets vertical zoom and recalculates kline width without changing horizontal position

### Changed
- **Watcher/ranking limit**: increased from 100 to 200 (`AUTO_TRADING_CONFIG.TARGET_COUNT.MAX`); all hardcoded references now use the single source of truth
- **Backfill button text**: now dynamically shows the configured max (e.g., "Backfill Top 200") via i18n interpolation across all 4 locales
- **`getTopCoinsByMarketCap` limit**: now uses `AUTO_TRADING_CONFIG.TARGET_COUNT.MAX` instead of hardcoded 100
- **Portfolio PnL percent**: now accounts for leverage in unrealized PnL percentage calculation
- **Pyramid lock key**: scoped to `walletId:symbol` instead of just `symbol` to prevent cross-wallet lock collisions
- **Order drag**: removed drag-from-active-order to create SL/TP (replaced by SL/TP placement buttons)

### Fixed
- **Chart candle rendering on symbol switch**: candles appeared thin/spaced incorrectly after switching symbols due to missing `updateKlineWidth()` call
- **Backfill progress stuck at 0**: scanner tab wasn't joining the wallet WebSocket room, so progress events never arrived

## [0.57.0] - 2026-03-09

### Added
- **Grid Orders**: click-and-drag on chart to place multiple limit/stop orders at evenly-spaced price levels within a range; configurable order count (2–50), buy/sell side; grid icon button in quick trade toolbar (left-click toggles, right-click opens config)
- **Price Magnet (Snap)**: mouse snaps to adhesion points (round numbers, existing order entries, SL/TP levels) when drawing grid; configurable snap distance
- **Quick Trade Toolbar**: new floating toolbar at chart top-left with size presets (MIN, 0.5%–10%), slider, instant Buy/Sell buttons, grid orders, and trailing stop popover
- **Binance Rate Limiter & IP Ban Protection**: centralized `BinanceRateLimiter` class with ban detection (HTTP 418/429, error -1003), automatic cooldown, and `guardBinanceCall()` wrapper across all Binance API calls
- **Signal Suggestion Pre-Validation**: `validateSetupFilters()` checks direction, cooldown, filters, and existing positions before creating signal suggestions
- **Directional Order Line Colors**: SL/TP lines now use distinct colors per direction (long=green/red, short=orange/blue) for better visual clarity
- **Collapsible Portfolio Summary**: summary section can be collapsed to show only unrealized P&L; state persisted in preferences
- **Debounced SL/TP Refresh After Pyramid**: 3-second debounce prevents rapid SL/TP cancel/replace during consecutive pyramid fills
- **Pending Entry Cleanup**: automatically cancels pending entry orders when position closes

### Changed
- Trailing stop popover no longer requires an open position to display
- Removed `limit` parameter from active executions queries (fetch all)
- Shift+Alt order entry enabled by default
- Leverage/margin only set when no existing position for the symbol
- Chart constant renamed: `FUTURE_VIEWPORT_EXTENSION` → `INITIAL_FUTURE_EXTENSION`
- Startup audit caps reduced (50→10 executions, 7→3 days, 200→1500ms rate limit) to minimize API pressure
- `TOO_MANY_REQUESTS` added to non-retryable tRPC error codes

### Fixed
- Pending order line colors now use dedicated pending colors instead of reusing SL colors

## [0.56.0] - 2026-03-08

### Added
- **Semi-Assisted Trading Mode**: new `tradingMode` option (`auto` / `semi_assisted`) — in semi-assisted mode, signals generate suggestions that the user can accept or reject instead of auto-executing
- **Signal Suggestions**: new `signalSuggestions` table and full workflow — backend generates pending suggestions with entry/SL/TP/confidence/R:R, frontend displays them in real-time via WebSocket, user can accept (triggers execution) or reject
- **Session Scanner**: background service that scans crypto/stock market sessions every 5 minutes using screener presets, with 10-min result caching and WebSocket broadcast; new Scanner tab in sidebar with timeframe selector, preset categories, backfill, and live results grid
- **Trading Profile Overrides**: 56 new override columns on `trading_profiles` — each profile can now override any auto-trading config field (filters, Fibonacci params, trailing stop, risk management, position sizing, direction mode); redesigned ProfileEditorDialog with collapsible sections and override badges
- **Import Profile from Backtest**: new ImportProfileDialog to import profile configs from JSON (backtest optimization output)
- **Manual Position Size**: separate `manualPositionSizePercent` config (default 2.5%) for manual orders in OrderTicket, independent from auto-trade position size
- **Order Flash Store**: client-side visual feedback for recently-updated orders on chart
- **Active Chart Symbols hook**: `useActiveChartSymbols` tracks symbols displayed on chart via WebSocket for kline optimization
- **TradingView-style chart zoom**: removed `MAX_KLINE_WIDTH` cap so candle bodies scale proportionally at any zoom level; zoom-in limit reduced to 1 visible candle; wick width scales conservatively only at extreme zoom (100px+ body)
- **Auto-cancel orphans**: new `autoCancelOrphans` flag in auto-trading config

### Changed
- **Screener presets tuned**: broadened thresholds for Top Gainers/Losers (1% vs 5%), Oversold/Overbought (RSI 35/65 vs 30/70), Momentum Leaders (ADX 20 vs 25), Volume Surge (1.5x vs 2x), Bollinger Compression (width 0.12 vs 0.04)
- **Config field registry**: centralized field transformation logic in `config-field-registry.ts`
- **Profile applicator service**: `profile-applicator.ts` applies profile overrides to base auto-trading configs with null coalescing

### Fixed
- **Pyramid merge race condition**: per-symbol `pyramidLocks` mutex prevents concurrent pyramid merges on the same symbol (cancel+replace SL/TP, weighted avg update)
- **Position close notifications**: WebSocket `emitPositionClosed` on manual cancel/close with PnL data

### Database Migrations
- `0014`: `manual_position_size_percent` column (default 2.5%)
- `0015`: 56 profile override columns on `trading_profiles`
- `0016`: `trading_mode` on `auto_trading_config`, new `signal_suggestions` table
- `0017`: `session_scan_enabled` + `session_scan_markets` on `auto_trading_config`
- `0018`: `auto_cancel_orphans` flag on `auto_trading_config`

---

## [0.55.3] - 2026-03-04

### Fixed
- **Orphan orders on position close**: when SL or TP algo triggers, now calls `cancelAllFuturesAlgoOrders` after cancelling the opposite order to sweep any remaining algo orders for the symbol (e.g., old SL/TP from previous pyramid steps that weren't cleaned up)
- **Orphan order toasts**: `OrderSync` now only emits `ORPHAN_ORDERS` risk alerts for orphans without an active position on exchange; orphans with a position (harmless — leftover from pyramid race) are logged as warnings but no longer trigger user-facing toasts
- **Pending entry drag**: new entry order is now placed BEFORE cancelling the old one — previously, if Binance rejected the new order (e.g., "Order would immediately trigger"), the old order was already cancelled, causing the pending position to silently disappear from the chart; now the old order is only cancelled after the new one is confirmed
- **Trailing stop log spam**: reduced "Trade execution missing setupId" from `warn` to `trace` level for manual orders (those without a setup ID) — eliminates noisy log spam for manually-placed positions

---

## [0.55.2] - 2026-03-04

### Fixed
- **Nearest Swing stop placement**: `nearest_swing` mode was incorrectly calling `findSignificantSwingLow` which returns the lowest ZigZag structural pivot (same as the Fibonacci base swing), giving identical results to `fibo_target` mode; now calls `findMostRecentSwingLow` directly with a 20-candle lookback and fractal period of 2, correctly finding the most recent local pullback swing just before the entry

---

## [0.55.1] - 2026-03-04

### Fixed
- **Watcher cycle deadlock**: removed `processedThisCycle` guard from `queueWatcherProcessing` — when a single watcher was stuck in `pending` (e.g., kline backfill after rotation), all other watchers were blocked from re-queuing on subsequent candle closes, causing setup detection to silently stop while rotation continued normally
- **Backfill re-check**: newly rotated symbols in kline backfill state now schedule a re-check after 30s instead of waiting for the next candle close setInterval

---

## [0.55.0] - 2026-03-04

### Added
- **Initial Stop Placement Mode**: new setting in WatcherManager to choose between `Fibonacci Target` (stop at Fibonacci swing low/high — existing behavior) and `Nearest Swing` (stop at most recent local swing — tighter stops); available in auto-trading config and backtesting
- **Max Entry Level LONG/SHORT split**: separate sliders for max Fibonacci entry progress percent per direction (replaces the single unified control)
- **Data Maintenance tab**: new Settings tab with DB storage usage display and a `Clear Kline Data` action (with confirmation dialog)
- **Kline integrity detection**: `hasLocalIntegrityIssues()` checks for gaps and misalignments after DB fetch and triggers automatic repair

### Changed
- **Kline maintenance overhaul**: `getActivePairsWithSubscriptions()` now sources pairs from active watchers, stream subscriptions, and open/pending trade executions; `repairAll()` simplified
- **About tab**: auto-update section moved from General tab to About tab
- **Data tab**: uses `TradingTable` component with `px` padding on badges

### Fixed
- **Pyramid algo order orphans**: all exchange algo orders are cancelled before placing new ones on pyramid to prevent orphaned orders
- **Kline gap repair**: gaps are now repaired after cache invalidation and temporal alignment issues are detected and corrected
- **WebSocket reconnection gaps**: kline gaps introduced by WebSocket reconnections are detected and resolved
- **Futures manual order flow**: margin defaults, alerts, and UX corrections
- **Order flow**: portfolio position grouping, startup audit service corrections

---

## [0.54.0] - 2026-02-24

### Performance
- **DB Covering Index**: compound index `klines_lookup_idx` on `(symbol, interval, market_type, open_time)` reduces watcher cycle kline query from 2–5 s to <50 ms
- **Non-blocking Kline Prefetch**: signal processor now fires `prefetchKlinesAsync` and returns `pending` instead of blocking the watcher mutex for 10–30 s when klines are insufficient
- **Pre-warm Klines on Watcher Registration**: `startWatcher` fires `prefetchKlinesAsync` immediately when a watcher is added to the in-memory map, ensuring klines are ready before the first cycle
- **Version-Guarded Cache Invalidation**: `TrpcProvider` only clears the kline cache on a version change (via `sessionStorage`), eliminating the blank screen on every app reload
- **Socket Reconnection Cap**: `reconnectionAttempts` reduced from `Infinity` to `50` with a `reconnect_failed` handler to surface disconnection state
- **Parallel Order Executor Queries**: `activePositions` and `cooldownCheck` DB queries in order executor run concurrently with `Promise.all` (−100–150 ms per execution)
- **Fixed Double-Polling in RealtimeSync**: removed hardcoded `staleTime: 5000` overrides; queries now respect `QUERY_CONFIGS` values (1 min), eliminating unnecessary 5-second polling
- **Batched WebSocket Price Subscriptions**: replaced per-symbol `subscribe:prices` loop with single `subscribe:prices:batch` event on mount/reconnect, with matching batch handler in backend
- **Immer Middleware for PriceStore**: `updatePrice` and `cleanupStaleSymbols` use Immer draft mutations instead of spreading the entire `prices` object, eliminating cascading re-renders on price ticks
- **Parallel Backend Service Startup**: `binanceUserStream`, `binanceFuturesUserStream`, and `positionSync` services start concurrently (−2–5 s backend startup)
- **Parallel Prefetch on App Init**: `AppContent` fires parallel prefetches for `wallet.list` and `tradingProfiles.list` on mount, making data available before first chart render

### Added
- **UI Zoom Control**: toolbar zoom in/out/reset buttons and keyboard shortcuts (`Ctrl+Plus`, `Ctrl+Minus`, `Ctrl+0`) to scale the entire interface; persisted to preferences
- **Orders Dialog**: full-featured dialog showing up to 500 orders + 500 trade executions, with search by symbol, status filter, card/table view modes, and client-side pagination (25 per page)
- **Real Total Count**: sidebar Orders tab now shows the true database count via `getOrdersStats` instead of the local 50-item slice
- **View All Buttons**: two "View All Orders" buttons (top and bottom of sidebar list) to open the Orders Dialog
- **Backend `getOrdersStats`**: new tRPC procedure returning total orders and trade executions count per wallet
- **Backend search + offset**: `getOrders` and `getTradeExecutions` procedures now accept `search` (ilike on symbol) and `offset` parameters, with limit raised to 500
- **OrderTicket `positionSizePercent`**: position size can now be expressed as a percentage of available balance directly in the order ticket
- **Manual Order SL/TP**: stop loss and take profit fields exposed in manual order form

### Changed
- `OrderCard` and `OrdersTableContent` extracted as standalone shared components; `orderHelpers.ts` centralises shared helper functions (`getStatusColor`, `getStatusTranslationKey`, `formatDate`, `formatPrice`)

---

## [0.53.0] - 2026-02-23

### Added
- **FVG Filter**: Fair Value Gap filter for trade entry validation (`useFvgFilter`, `fvgFilterProximityPercent`) with proximity-based zone check and wick-touch allowance
- **Max Risk Per Stop**: new configuration field to cap risk per stop level
- **SL/TP Drag Toggles**: independent toggles in WatcherManager to enable/disable stop loss and take profit dragging on the chart
- **SL Tighten-Only Mode**: sub-toggle (visible when SL drag is enabled) that restricts SL movement to tightening only — moves SL closer to price to lock in profit or reduce risk; LONG SL can only move up, SHORT SL can only move down
- **FVG Rejection Setup**: backtesting setup for FVG rejection entries
- **Compare FVG Filter script**: new backtest script to compare strategies with/without FVG filter
- **Audit script**: `fix-missing-tp.ts` to surgically recreate only missing TP orders without touching valid SL orders

### Fixed
- **Fibonacci nearest mode**: swing detection now compares the two most recent ZigZag pivots and returns the one with the higher price (for highs) or lower price (for lows) — prevents a small pullback pivot from being used as the swing high/low when a larger apex is nearby
- **Stop placement**: stop loss now anchors at the correct apex swing high (closest significant top with offset), not at a shallow recent pivot in the middle of candles
- **SL drag validation**: stop loss can now be placed above entry price (profit-protecting SL) — previous validation incorrectly blocked SL moves past entry
- **FVG filter**: allow entry when previous candle wick touched the FVG zone
- **FVG renderer**: fixed viewport culling — all unfilled gaps now render regardless of creation index
- **IndicatorEngine FVG zones**: exposed per-index zone prices (`bullishTop/Bottom`, `bearishTop/Bottom`) for accurate filter checks
- **SL drag toggle fallthrough**: clicking a disabled SL/TP line no longer falls through to entry drag
- **Active Watchers accordion**: now collapsed by default

### Refactored
- Removed localStorage for preferences — all user preferences now persisted to backend DB via tRPC
- Moved grid, price line and crosshair toggles to settings modal with toolbar separators
- Enhanced trend filter logic
- Removed `disableTimeSync: true` from exchange clients

---

## [0.52.1] - 2026-02-20

### Fixed
- Trailing stop activation logic improvements
- Resolve 14 TypeScript errors in electron type-check (bracket notation for index signatures, unused import)

### Refactored
- Consolidate active strategies to single source of truth and optimize selection
- Optimize algorithmic bottlenecks, deduplicate backtesting engines, and unify registries

---

## [0.52.0] - 2026-02-18

### Added
- Optimized 1h timeframe defaults from full backtesting analysis

### Fixed
- Enforce all auto-trading config filters and invalidate cache on update
- Prevent trailing stop from recreating identical SL orders every cycle
- Handle already-cancelled orders gracefully in cancel functions
- Auto-close residual positions after SL/TP fill
- Position sync auto-closes unknown positions on exchange
- Position sync adopts unknown positions and closes dust
- Prevent floating point precision loss in formatQuantityForBinance
- Wallet balance correction in fix-trade-fees script
- Audit scripts with order ID matching and PnL-impact price thresholds
- Positions stream stability
- App icons updated

### Refactored
- Unified filter and config field registration with central registries (filter-registry.ts + config-field-registry.ts), reducing ~730 lines of boilerplate across 8 files

---

## [0.51.0] - 2026-02-15

### Added
- **Trailing Stop System**
  - Trailing stop functionality with popover and toolbar integration
  - Symbol-level trailing stop overrides
  - Trailing activation modes (immediate, threshold-based) for auto trading
  - Stop offset configuration (auto/fixed modes) with ATR-based adaptive offset
  - Stop-protected value calculation with translations (EN/PT/ES/FR)
  - Enhanced position monitoring and exit handling with fee calculations
- **Symbol Selector - Open Positions**
  - Assets with open positions now appear at the top of the symbol selector
  - Dedicated "Open Positions" section above popular symbols
  - Search results sort open-position symbols first with green dot indicator
- **Trading Filters & Strategies**
  - HTF Stochastic and Stochastic Recovery filters
  - Stochastic recovery filter in auto trading configuration
  - 9 new filters added to optimization grid
  - Direction mode configuration for strategies and filters
  - Quick validation mode for optimization
- **Analytics & Market Data**
  - AnalyticsModal component with UI store integration
  - Market screener store and related types
  - On-chain metrics: MVRV ratio and BTC production cost
  - DirectionBadge component for trading direction visualization
  - Effective capital calculation in analytics and wallet performance
- **Risk Management**
  - Risk management features and UI components
  - Max global exposure percent in auto trading configuration
- **Fibonacci Enhancements**
  - Fibonacci swing range configuration for backtesting
  - Hidden levels in fibonacci renderer and projection logic
  - Swing point extreme wick validation with enhanced projection logic
- **Utility Scripts**
  - Trade fee correction script for futures executions
  - Dust order management and position synchronization scripts
- **Testing**
  - Comprehensive unit tests for formatters, profile transformers, and retry logic
  - Enhanced ExitCalculator tests with additional scenarios and edge cases
  - Enhanced coverage for watcher-manager and result-manager
  - Integration test configuration improvements

### Changed
- Market type defaults to FUTURES across components and services
- Kline prefetch logic updated for improved data loading
- WatcherCardCompact and WatchersList components refactored for improved styling
- Slider.Root replaced with Slider component across multiple sections
- Short entry conditions removed from multiple strategies for simplification
- Pattern-123 strategy removed and related references cleaned up
- Gap check intervals updated to 2 hours for improved performance
- Backtest configuration handling optimized with improved simulation results logging
- marketType parameter added to setup detection and setup routers
- Import paths updated for consistency and readability

### Fixed
- `maxFibonacciEntryProgressPercent` now correctly passed to StrategyInterpreter in auto-trading
- Entry level column type fixed in optimization grid
- Deferred exit timeout adjusted for position monitoring
- Error logging enhanced with serialization for backtesting logic

---

## [0.50.0] - 2026-02-05

### Added
- **Exchange abstraction — Phase 6 (backend)**
  - BacktestEngine routing for multiple kline sources via `--exchange` flag
  - CLI `--exchange` and `--asset-class` flags for `validate` and `batch` backtest commands
  - Generic tiered commission utilities (`calculateTieredCommission`, `calculateRoundTripCommission`, `estimateCommissionRate`)
  - 17 new fee calculator tests, all 2662 backend tests passing
- **Order Book Integration** for Dynamic Symbol Rotation
  - `OrderBookAnalyzerService` with imbalance ratio and liquidity wall detection
  - Buying/selling pressure detection based on bid/ask volume ratios
  - Integration with Dynamic Symbol Rotation to filter symbols during high selling pressure
  - New tRPC endpoint `getOrderBookAnalysis` for real-time order book data
  - Order Book card in Market Indicators sidebar showing BTC pressure and imbalance
  - 14 new tests for order book analyzer service
- **Indicator History with Area Charts**
  - `indicator_history` TimescaleDB hypertable for storing historical indicator values
  - `IndicatorHistoryService` for saving and retrieving 31-day indicator history
  - Area charts for ADX Trend Strength and Altcoin Season Index
  - `saveIndicatorSnapshot` endpoint for manual/scheduled indicator snapshots
  - 90-day retention policy with automatic compression after 7 days
- **OPTIMIZATION_MASTER_PLAN completed** at 100% (v2.5.0)

### Changed
- `BacktestEngine` and `MultiWatcherBacktestEngine` accept `exchange` parameter for kline source routing
- `BacktestConfig` type extended with `exchange` and `assetClass` fields
- Dynamic Symbol Rotation now considers order book conditions
  - Reduces exposure during strong selling pressure (imbalance < 0.7)
  - Detects significant ask walls and adjusts rotation accordingly
- Market Indicators sidebar enhancements:
  - ADX and Altcoin Season now show 24h change badges
  - Historical area charts when data is available
  - Order Book analysis card with pressure and imbalance

### Removed
- **Frontend backtesting UI** removed (backtesting is now CLI-only)
  - Removed 14 frontend files: BacktestConfig, BacktestResults, BacktestingPanel, BacktestChart, EquityCurveChart, useBacktesting, useBacktestMetrics, useBacktestPlayback, TradeListTable
  - Removed backtesting tab from Settings dialog
  - Cleaned up related exports and translations

### Performance
- `detectSetupsInRange` now yields to event loop every 500 iterations (prevents blocking on 36K+ sync calls)
- `BacktestEngine.findIndex` replaced O(n) lookup with O(1) `klineIndexMap`
- `MultiWatcherBacktestEngine` O(n) `findIndex` replaced with O(1) Map in `buildUnifiedTimeline` and `checkAndClosePositions`
- Fixed exchange-adapter `subscribe()` race condition: async call is now properly awaited in watcher-manager

---

## [0.49.0] - 2026-01-23

### Added
- **Chart Layer Architecture** - New optimized rendering system
  - DataLayer, IndicatorLayer, and OverlayLayer with optimized rendering
  - useLayerCache and useRenderLoop hooks for better performance
  - Indicator caching and memoization hooks
- **Keyboard and Touch Navigation**
  - useKeyboardNavigation hook for keyboard interactions
  - useTouchGestures hook for touch device support
- **New UI Components**
  - CollapsibleSection, ConfirmationDialog, EmptyState
  - FormDialog and MetricCard components with tests
- **Property-Based Tests** for indicators
  - RSI, MACD, Bollinger Bands, and more
  - Comprehensive validation of indicator calculations
- **Positions Management** and trading execution features
- **Strategy Definition Types** with visualization interfaces

### Changed
- **Fibonacci Projection** now recalculates levels from saved swing points
  - Ensures new levels (like 88.6%) appear even for existing positions
  - Levels are always calculated using current `FIBONACCI_ALL_LEVELS`
- **Chart Toolbar** simplified and made vertical
  - Removed chart type toggle buttons (now in settings modal)
  - Tooltips aligned to the right
- **Auto-Trading System** refactored
  - Introduced WatcherManager and BtcStreamManager
  - Cache manager and utility functions for auto-trading
  - Market client factory for better abstraction
- **Chart Renderers** refactored to use centralized color constants
- **minRiskReward** settings now use default constants across components

### Fixed
- **Fibonacci 88.6% Level** now displays correctly on chart
- **P&L calculations** in auto-trading tests
- **Exposure calculations** refactored in tests
- **Logging verbosity** reduced in various services

---

## [0.48.0] - 2026-01-19

### Added
- **Pyramiding Feature** for auto-trading
  - Dynamic mode: adds to winning positions based on trend strength
  - Fibonacci mode: scales in at key retracement levels
  - Configurable max pyramid levels and position sizing
  - Minimum quantity validation to prevent dust orders
- **Auto Trading Logs Console** with real-time WebSocket integration
  - Live log streaming for debugging and monitoring
  - Filterable by log level and watcher
- **Capital Filtering** for dynamic symbol rotation
  - Skips symbols where capital is insufficient for minimum notional
  - Configurable leverage and exposure multiplier per profile
  - `getCapitalLimits` query for wallet capital analysis
- **Wallet Deposits/Withdrawals Tracking**
  - Total deposits and withdrawals display in wallet details
  - Historical balance tracking
- **Fibonacci Enhancements**
  - Extended target levels to include 2.618 extension
  - Fibonacci-based TP/SL recalculation for open trades
  - Dynamic max Fibonacci entry progress percent in rejection reasons
- **Shift/Alt Order Entry Toggle** in Chart Settings
  - Configure modifier key for one-click order placement
- **Quick Start Symbol Filtering**
  - `getFilteredSymbolsForQuickStart` query for enhanced symbol selection

### Changed
- **Dynamic Symbol Limit** increased from 25 to 50 (configurable up to 100)
- **AUTO_TRADING_CONFIG** centralized configuration for dynamic limits and validation
- **Min Notional Filter** refactored capital calculation methods
- **Futures Order Handling** improved OCO order logging and algo order handling
- **Leverage/Margin Error Handling** enhanced in AutoTradingScheduler
- **Breakeven and Progressive Targets** updated Fibonacci levels

### Fixed
- **Funding Rate Calculation** removed unnecessary multiplication causing incorrect values
- **Candle Tracking** added `lastProcessedCandleOpenTime` to ActiveWatcher for accurate tracking
- **Trigger Kline Open Time** fix for existing trades
- **Conditional Order Rejection** proper handling and risk alert emission

---

## [0.47.0] - 2026-01-17

### Added
- **Opportunity Cost Management** for auto-trading
  - Detects stale trades that tie up capital without meaningful price movement
  - Configurable max holding period (in bars based on entry timeframe)
  - Three action modes: Alert Only, Tighten Stop, Auto Close
  - Time-based progressive stop tightening for profitable trades
  - `entryInterval` tracking to count bars on the correct timeframe
  - Full UI controls in auto-trading modal with translations (EN, PT, ES, FR)
- **New exit reasons**: `TIME_STOP`, `STALE_TRADE`, `OPPORTUNITY_COST`
- **31 unit tests** for opportunity cost manager service

### Changed
- **Trade executions schema** - Added 7 new tracking fields for opportunity cost
- **Auto-trading config schema** - Added 7 new configuration fields
- **Position monitor** - Now checks opportunity cost on each cycle
- **Auto-trading scheduler** - Increments bar count on kline closes

---

## [0.46.0] - 2025-01-15

### Added
- **P&L vs Balance display** in portfolio panel with multi-language support (EN, PT, ES, FR)
- **Market events calendar** with EventIconManager and StaticMarketSessionProvider
  - Market open/close events for major exchanges (NYSE, NASDAQ, LSE, etc.)
  - Visual icons on time scale showing session boundaries
- **Unified logging infrastructure** with RotationLogBuffer
  - Structured rotation logging for dynamic symbol rotation
  - Configurable log levels per component

### Fixed
- **Chart viewport margin** - Candles no longer stick to price scale on load/realtime updates
  - Future space now preserved when new klines are added
- **Market event timezone calculation** - Events now display at correct times regardless of user timezone
  - Properly converts exchange timezone to local time

### Changed
- **Current price line** style from dashed to solid for better visibility
- **Trailing stop logic** - `shouldUpdateStopLoss` now uses percentage difference for more accurate calculations
- **Auto-trading scheduler** - Enhanced pending results handling and watcher status updates
- **Oscillator rendering** - Refactored to use centralized color constants

### Improved
- **Canvas rendering** - Added clipping to volume and indicator panels to prevent overflow into price scale
- **Logging verbosity** - Updated default log levels for cleaner output

---

## [0.45.0] - 2026-01-14

### Added
- **Parallel batch processing** for auto-trading watchers
  - Configurable batch size via `WATCHER_BATCH_SIZE` env var (default: 6)
  - Processes multiple watchers concurrently for improved performance
  - `VERBOSE_BATCH_LOGS=true` for detailed per-watcher logs
- **Professional CLI table logging** using cli-table3
  - Unicode box-drawing characters for aligned tables
  - ANSI colors for status indicators (green=success, yellow=skip, red=error)
  - Separate tables for watchers, detected setups, and errors
  - Colors automatically stripped when writing to log files
- **Per-timeframe rotation cycles** for dynamic symbol rotation
  - Separate rotation state per `${walletId}:${interval}` key
  - Independent cycles for different timeframes (e.g., 1h vs 4h watchers)
  - `getRotationCycles()` method to list all active cycles for a wallet

### Changed
- **Ranking cache** now keyed by `marketType` (SPOT/FUTURES)
  - Prevents incorrect cache hits between different market types
  - 10-minute TTL preserved per market type
- **Rotation interval** now derived from watcher interval via `getOptimalRotationInterval()`
  - Removed hardcoded '4h' interval in rotation triggers

### Improved
- **Performance** - 6x faster watcher processing through parallelization
- **Log readability** - Organized batch summaries with setup detection details
- **Memory efficiency** - Buffered logs per watcher, output after batch completes

---

## [0.44.0] - 2025-01-10

### Added
- **Cryptocurrency icons** next to all asset/symbol names throughout the app
  - New `CryptoIcon` component with multiple CDN fallbacks (spothq, atomiclabs, coincap)
  - Auto base asset extraction from trading pairs (e.g., BTCUSDT → BTC)
  - Fallback letter avatar when icon not found
  - Clickable icons when symbol name is also clickable
- **Auto-trade column** in Orders and Portfolio tables
  - Robot icon with tooltip in dedicated column (last column position)
  - AUTO badge in card/mobile views for orders and positions

### Changed
- **SymbolSelector badge** - Shortened "FUTURES" to "FUT" for compact display
- **Chart interaction model** - Orders, positions, SL/TP now only interactive via tag area
  - Hover, drag, and click only work on the colored tag (with X button)
  - Lines across the chart no longer trigger interactions
  - Improved precision when multiple order lines are close together
- **Auto-trade indicator** moved from symbol cell to dedicated column in tables

### Improved
- **Visual consistency** - Crypto icons in SymbolSelector, OrdersList, Portfolio, FuturesPositionsPanel, WatcherManager, BacktestResults, FuturesPositionInfo, AddWatcherDialog
- **Hitbox precision** - Order/SL/TP hitboxes now use exact tag dimensions instead of Y-tolerance

---

## [0.43.1] - 2025-01-09

### Changed
- **Unified swing point detection** across entire codebase
  - `ExitCalculator.ts` now uses `findSignificantSwingHigh/Low` instead of legacy implementations
  - Increased lookback from 50 to 100 bars in stop loss/take profit calculations
  - Consistent ZigZag ATR-based detection in all swing point operations

### Improved
- **Code consistency** - Single source of truth for swing point detection algorithm
- **Maintainability** - Eliminated duplicate swing point detection code
- **Test coverage** - Updated test mocks to use `importOriginal` pattern

---

## [0.43.0] - 2025-01-09

### Added
- **ZigZag-based swing point detection** with ATR filtering for Fibonacci projections
  - `findSignificantSwingHigh/Low` - Filters movements < ATR * 2.0 threshold
  - `findZigZagHighs/Lows` - Identifies significant pivots with 5-bar confirmation
  - Dynamic threshold using 14-period ATR or 3% fallback
- **Market structure analysis** for swing point validation
  - `detectMarketStructure` - Identifies HH, HL, LH, LL patterns
  - `validateSwingWithStructure` - Confirms swing points match market context
  - Detects uptrend/downtrend/ranging market conditions
- **Adaptive fractal fallback** with progressive periods (2→3→4→5→7→9 bars)
  - `findAdaptiveFractalHigh/Low` - Multi-period fractal detection
  - Automatic fallback when ZigZag detection fails

### Changed
- **Fibonacci projection algorithm** - 3-layer detection system:
  1. ZigZag ATR-based (primary) - Filters market noise
  2. Market structure validation (secondary) - Confirms HH/LL patterns
  3. Adaptive fractal fallback (tertiary) - Ensures robustness
- **Increased lookback period** from 50 to 100 bars for:
  - `calculateFibonacciProjection` default parameter
  - `ChartCanvas.tsx` Fibonacci rendering
  - `StrategyInterpreter.ts` FIBONACCI_LOOKBACK constant
- **Minimum klines requirement** from 10 to 20 bars for projection calculations

### Improved
- **Swing point accuracy** - Now identifies true swing highs/lows in strong trends
- **Noise filtering** - Ignores small price movements (< 2 * ATR)
- **Trend context** - Validates swing points are valid HH in uptrends, LL in downtrends
- **Robustness** - Multiple fallback mechanisms ensure swing point detection

### Technical Details
- **Research-based implementation** using industry best practices:
  - ZigZag indicator (LuxAlgo, PyQuantLab, ChartSchool)
  - Market structure (TradingView, XS, TradeZella)
  - Williams Fractals (Linn Software, Medium)
  - Fibonacci best practices 2025 (Mind Math Money, TIO Markets, LuxAlgo)
- **No breaking changes** - Public API maintained, internal improvements only
- **Test coverage** - All 885 indicator tests passing, 2087 frontend tests passing

---

## [0.40.0] - 2025-01-05

### Added
- **Active Watchers Section** in Portfolio tab displaying current watchers with sortable table
- **Auto Trading button** in watchers header to quickly open Trading Profiles modal
- **Kline prefetch helper** (`kline-prefetch.ts`) with deduplication and consistent error handling
- **Watchers table sort state** in UI store with migration v6

### Changed
- **Compact table design** - Reduced padding (px: 3→1.5, py: 2→1) and font sizes (xs→2xs)
- **Smaller badges** - Changed from `size="sm" px={2}` to `size="xs" px={1}` across all tables
- **Unified kline prefetch** - Refactored `kline.ts`, `auto-trading.ts`, and `auto-trading-scheduler.ts` to use centralized helper
- **Button tooltip** - Changed "Trading Profiles" to "Auto Trading" for clarity

### Fixed
- Kline backfill triggered on watcher creation (fetches REQUIRED_KLINES)

## [0.39.0] - 2025-12-31

### Changed

#### Code Consolidation - Major Refactoring
Complete codebase audit and consolidation across 4 phases (16 sub-phases):

**Backend Constants (`apps/backend/src/constants/index.ts`):**
- `TIME_MS` - Time constants (SECOND, MINUTE, HOUR, DAY, WEEK, MONTH)
- `INTERVAL_MS` - Trading interval mappings (1m, 5m, 15m, 1h, 4h, 1d, etc.)
- `UNIT_MS` - Unit abbreviations (m, h, d, w)
- `WEBSOCKET_CONFIG` - WebSocket settings (RECONNECT_DELAY_MS, PING_INTERVAL_MS, FETCH_TIMEOUT_MS)
- `QUERY_LIMITS` - Query pagination limits (DEFAULT_SMALL, DEFAULT_MEDIUM, MAX_*)
- `TRADE_STATUS` - Trade statuses (OPEN, PENDING, CLOSED, CANCELLED)
- `ACTIVE_TRADE_STATUSES` - Array of active statuses for filtering
- `ORDER_TYPE` - Order types (MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT, etc.)
- `MARKET_TYPE` - Market types (SPOT, FUTURES)
- `ORDER_SIDE` - Order sides (BUY, SELL)
- `POSITION_SIDE` - Position sides (LONG, SHORT)
- `EXIT_REASON` - Exit reasons (STOP_LOSS, TAKE_PROFIT, NONE)

**Frontend Constants (`apps/electron/src/shared/constants/`):**
- `QUERY_CONFIG` - React Query settings (STALE_TIME, REFETCH_INTERVAL, BACKUP_POLLING_INTERVAL)
- `MIN_UPDATE_INTERVAL_MS` - Minimum chart update interval
- `INTERVAL_MS_MAP` - Timeframe to milliseconds mapping

**Barrel Exports:**
- `apps/backend/src/db/index.ts` - Re-exports Drizzle operators (and, eq, desc, etc.)
- `apps/electron/src/renderer/hooks/index.ts` - Exports 60+ hooks including all worker hooks

**Utilities:**
- `apps/backend/src/utils/formatters.ts` - formatPrice, formatPercent, formatQuantity

### Removed
- Inline time calculations replaced with TIME_MS constants (15+ files)
- Inline query config replaced with QUERY_CONFIG (9 hooks)
- Inline WebSocket config replaced with WEBSOCKET_CONFIG (5 services)
- Inline formatPrice functions replaced with utils/formatters (2 services)
- Inline interval maps replaced with INTERVAL_MS_MAP (App.tsx)

### Stats
- Type-check passing (backend + electron)
- All tests passing
- 16 consolidation phases completed

---

## [0.38.1] - 2025-12-31

### Fixed

#### Chart-Sidebar Performance Independence
Complete decoupling of chart and sidebar rendering for zero-lag panning:

- **Viewport State Removal** - Removed unused viewport state from App.tsx that was causing full component tree re-renders during pan
- **PriceStore Pan Skip** - Skip priceStore updates during pan to prevent sidebar subscription triggers
- **Viewport Throttle Increase** - Changed viewport state update throttle from 16ms to 50ms
- **Hover Detection Skip** - Skip expensive hover detection calculations during pan operations
- **OrderTicket Memoization** - Wrapped OrderTicket component in React.memo with useMemo for price extraction
- **Sidebar Price Throttle** - Increased usePricesForSymbols throttle from 500ms to 1000ms
- **useChartData Dependencies** - Fixed useEffect dependency array to properly track params changes

### Changed

- Chart pan no longer triggers any sidebar re-renders
- Zero performance difference between sidebar open/closed during pan

### Stats
- 1,778 passing tests (1,751 + 27 browser)
- All type checks passing

---

## [0.37.0] - 2025-12-30

### Changed

#### Historical Data Configuration
- **REQUIRED_KLINES = 40,000** - Single point of adjustment for historical kline quantity
- **Frontend/Backend Consistency** - Both frontend and backend now use the same constant
- **Scalable Architecture** - System handles any quantity via batched API requests (1000/batch)

#### EMA Convergence
- **Full Precision** - EMA200 now has mathematically perfect convergence with 40k bars
- **Formula**: bars_needed = -log₁₀(tolerance) / log₁₀(1-α) ≈ 2,300 for EMA200
- **Margin of Safety** - 40,000 bars provides 17x the minimum required

#### Indicator Consistency
- **Unified Calculations** - All indicators on frontend match backend exactly
- **Shared Package** - Both use `@marketmind/indicators` (workspace:*)
- **No Data Slicing** - Full kline array passed to all indicator calculations

### Added
- **REQUIRED_KLINES constant** in both `apps/backend/src/constants/index.ts` and `apps/electron/src/renderer/constants/defaults.ts`

### Stats
- 2,759 passing tests (832 backend + 1,900 frontend + 27 browser)
- All type checks passing
- Historical coverage: ~4.5 years on 1h, ~18 years on 4h, ~109 years on 1d

---

## [0.36.0] - 2025-12-29

### Removed

#### Major Feature Cleanup
This release focuses the application on its core trading functionality by removing unused features:

- **ML Package** - Removed entire `@marketmind/ml` package (~50 files)
- **AI Integration** - Removed all AI providers (OpenAI, Anthropic, Gemini), chat sidebar, AI trading agent
- **Pattern Detection** - Removed frontend pattern detection (triangles, head-and-shoulders, support/resistance)
- **News & Calendar** - Removed news providers (CryptoPanic, NewsAPI) and calendar features
- **Market Context** - Removed market context filters and configuration

#### Files Removed
- `packages/ml/` - Machine learning package
- `apps/electron/src/renderer/services/ai/` - AI service providers
- `apps/electron/src/renderer/components/Chat/` - Chat sidebar components
- `apps/electron/src/renderer/components/News/` - News components
- `apps/electron/src/renderer/components/Calendar/` - Calendar components
- `apps/electron/src/renderer/utils/patternDetection/` - Pattern detection utilities
- `apps/backend/src/routers/ai-trading.ts` - AI trading router
- `apps/backend/src/routers/ml.ts` - ML router
- `apps/backend/src/services/ai-trading/` - AI trading services
- `packages/types/src/ai*.ts` - AI type definitions
- `packages/types/src/pattern.ts` - Pattern type definitions
- `packages/types/src/news.ts` - News type definitions
- `packages/types/src/calendar.ts` - Calendar type definitions
- `docs/AI_AUTO_TRADING.md`, `docs/ML_*.md`, `docs/NEWS.md` - Related documentation

### Added

- **ENABLED_STRATEGIES** - Centralized strategy list in `@marketmind/types` shared between frontend and backend

### Changed

- **Simplified UI** - Removed chat toggle, news toggle, pattern detection buttons from toolbar
- **Cleaner Settings** - Removed AI, Pattern Detection, News, Market Context tabs from settings
- **Updated Translations** - Cleaned all language files (EN, PT, ES, FR) removing unused keys
- **Reduced Dependencies** - Removed `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` packages

### What's Still Available
The core trading functionality remains fully operational:
- **17 Trading Strategies** - All Larry Williams setups (9.1-9.4) + 13 momentum/breakout strategies
- **Auto-Trading** - Algorithmic trading with real-time setup detection
- **Backtesting** - Full backtesting engine with optimization
- **Real-time Charts** - Advanced kline visualization with 25+ indicators
- **Binance Integration** - Spot and Futures trading support

### Stats
- 1,903 passing tests + 27 browser tests
- All type checks passing
- ~185 files removed, significantly reduced bundle size

---

## [0.35.2] - 2025-12-29

### Changed

#### Chart Rendering
- **Oscillator Line Width** - All oscillator lines now use 1px width for consistency (RSI, Stochastic, MACD, PPO, ADX, TSI, Aroon, Klinger, Vortex, etc.)
- **Zone Lines Consistency** - Unified zone line colors and dash patterns across all oscillators using shared `oscillatorRendering.ts` utility
- **Zone Fill** - All oscillators now use consistent zone fill between overbought/oversold levels
- **Navigation Buttons** - Fixed positioning of chart navigation buttons to consider all open oscillator panels via `getTotalPanelHeight()`
- **Kline Timer** - Fixed timer positioning to account for all open indicator panels

#### Trading
- **SL/TP Drag Preview** - Fixed order drag handler to update preview price correctly for stop loss and take profit
- **Trend Filter** - Enhanced trend filter fallback logic to consider strategy-specific requirements

### Removed
- **Level Labels** - Removed numeric level labels (0, 50, 100, etc.) from oscillator panels for cleaner UI

### Stats
- 2,864 passing tests + 27 browser tests
- All type checks passing

---

## [0.35.0] - 2025-12-28

### Added

#### Stop Loss Improvements
- **Pivot Prioritization** - Stop loss now prioritizes STRONG pivots with volume confirmation over simple swing highs/lows
- **Fallback Chain** - Smart fallback: STRONG+volume → STRONG → MEDIUM → swing → ATR-based
- **Increased Minimum SL** - MIN_ENTRY_STOP_SEPARATION_PERCENT increased from 0.5% to 0.75%

#### Fee Centralization
- **BINANCE_VIP_LEVELS** - Centralized VIP level definitions with commission mapping (0-9)
- **getVIPLevelFromCommission()** - Helper function to determine VIP level from commission rate

### Changed
- **TradeExecutor.ts** - Now imports MIN_NOTIONAL_VALUE from centralized BINANCE_FEES
- **BacktestConfig.tsx** - Uses BINANCE_DEFAULT_FEES.VIP_0_TAKER instead of hardcoded 0.1
- **TradingFeeService.ts** - Uses centralized getVIPLevelFromCommission()
- **ExitCalculator.ts** - New findPrioritizedPivotStop() method with analyzePivots integration

### Stats
- 4,900+ passing tests (backend + frontend + indicators + browser)
- All type checks passing

---

## [0.34.0] - 2025-12-28

### Added

#### Web Compatibility
- **Platform Adapter Pattern** - Abstract platform-specific functionality for Electron and Web builds
- **Web Storage Adapter** - tRPC-based API key storage with backend encryption for web platform
- **Web Update Adapter** - Service Worker-based update detection for PWA
- **Web Notification Adapter** - Web Notification API integration with permission handling
- **Web Window Adapter** - URL-based chart window routing (`/chart/:symbol/:timeframe`)
- **PWA Support** - Full Progressive Web App with offline caching and installability
- **API Keys Backend** - Secure API key storage via tRPC with AES-256-CBC encryption

#### Build System
- **Dual Build Targets** - Single codebase builds for both Electron and Web (`pnpm dev:web`, `pnpm build:web`)
- **Conditional Plugins** - Vite config with conditional Electron/PWA plugin loading
- **PWA Assets** - Auto-generated service worker, manifest, and icons

### Changed
- **Hook Refactoring** - All platform-specific hooks now use adapter pattern (`useSecureStorage`, `useAutoUpdate`, `useChartWindows`, `useNotification`, `useAIPatterns`)
- **AI Store** - Refactored to use platform adapter for cross-platform data persistence

### Database Schema Changes
- Added `api_keys` table for web-based API key storage with user association

### Stats
- 2,864 passing tests
- Electron and Web builds verified

---

## [0.33.0] - 2025-12-25

### Added

#### Futures Auto-Trading Enhancements
- **Futures User Stream WebSocket** - Real-time order and position updates via Binance WebSocket
- **Liquidation Price Monitoring** - Automatic detection of liquidation risk with 3-tier alerts (warning/danger/critical)
- **Real-Time Risk Alerts** - WebSocket-based alerts for liquidation risk, daily loss limit, max drawdown, and margin top-up
- **Margin Manager Service** - Automatic isolated margin top-up when margin ratio exceeds threshold
- **Max Drawdown Enforcement** - Blocks new positions when drawdown exceeds configured limit (default 15%)

#### Market Type Support
- **Watcher Market Type** - Visual indicator (SPOT/FUTURES badge) in Active Watchers list
- **Futures Watcher Creation** - Support for creating FUTURES watchers with proper market type persistence

#### Performance Optimizations
- **IndicatorCache** - Caches computed indicators during backtesting for 40-50% performance improvement
- **Early Stopping in Optimizer** - Stops optimization early when profit degrades
- **Lazy Loading** - Components loaded on demand for faster initial load
- **Throttled Updates** - Real-time updates throttled to max 10/second for smooth UI

#### Code Quality
- **Centralized generateId** - Single implementation in `utils/id.ts` with variants (entity, session, short)
- **Database Helpers** - `walletQueries` module for common database operations
- **Volume Utilities** - Shared `volumeUtils` in indicators package
- **BacktestEngine Modularization** - Split into TradeExecutor, ExitManager, FilterManager

#### Trading Features
- **Adaptive Cooldown** - Cooldown period adjusts based on market volatility
- **Pivot-Based Exits** - Dynamic TP/SL calculation based on pivot points
- **Enhanced Pivot Detection** - Volume confirmation and strength classification
- **Volatility-Based Adjustments** - Stop loss adjustments based on market volatility

### Changed
- **UI Improvements** - Reduced header and toolbar height for better layout
- **Error Handling** - Enhanced error handling and recovery mechanisms
- **Retry Logic** - Automatic retry for ticker price fetching

### Fixed
- **TypeScript Errors** - Resolved all remaining TypeScript errors across backend
- **Market Type Persistence** - Fixed watchers being saved as SPOT when FUTURES selected

### Database Schema Changes
- Added `maxDrawdownPercent` to `autoTradingConfig` (default: 15%)
- Added `marginTopUpEnabled`, `marginTopUpThreshold`, `marginTopUpPercent`, `marginTopUpMaxCount` to `autoTradingConfig`
- Added `marginTopUpCount` to `tradeExecutions`

---

## [0.32.0] - 2025-12-24

### Added
- ADX filter for auto trading and backtesting
- Measurement ruler and area controls to toolbar
- AI trading and conversation stores with state management

### Changed
- Enhanced exit calculations with volatility-based stop loss adjustments
- Updated DEFAULT_TRAILING_STOP_CONFIG thresholds

---

## [0.31.0] - 2025-12-23

### Added
- Complete backend infrastructure with Fastify 5.6.2 + tRPC 11.7.2
- PostgreSQL 17 + TimescaleDB 2.23.1 database
- Session-based authentication with Argon2 password hashing
- API routers: health, auth, wallet, trading endpoints
- Frontend hooks for backend integration

### Stats
- 1,864 passing tests
- 92.15% code coverage
- Complete multi-language support (EN, PT, ES, FR)
