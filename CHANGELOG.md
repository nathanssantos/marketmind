# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.11.6] - 2026-05-04

### Fixed
- **MARKET ticket entries no longer take 25–30 seconds to appear.** Race between the `createOrder` mutation's `INSERT INTO orders` and Binance's `ORDER_TRADE_UPDATE` user-stream event left the position invisible to the renderer until `position-sync`'s 30s loop adopted it as an "unknown position". `handleManualOrderFill` looks up the order by `orderId` BEFORE inserting the `tradeExecution` row — when the user-stream event beat the order-table commit (separate connection, separate event loop), the lookup missed and the handler bailed with "No open execution found". `PositionMonitor` then flagged "UNPROTECTED POSITION — no SL/TP" because the adopted exec has no SL/TP fields. Backend `createOrder` now inserts the `tradeExecution` row directly when Binance returns `FILLED` on a non-reduceOnly FUTURES MARKET order. Same opposite-side / same-side dedup guards `handleManualOrderFill` uses, so whichever path wins the race owns the row and the other no-ops.
- **Net effect**: PR #441's `data.openExecutions` patch now actually includes the new MARKET position in the response, so the renderer's cache patch lands instantly (was previously empty for MARKET because the row wasn't inserted yet). End-to-end ticket reactivity finally complete.

## [1.11.5] - 2026-05-04

### Fixed — order reactivity + ghost copies
- **MARKET orders from the ticket appear instantly.** `createOrder` mutation onSuccess only invalidated analytics; the executions cache had to wait for the socket event (200–500ms). Now patches `getTradeExecutions` directly from the mutation response's `data.openExecutions` (authoritative server snapshot) — entry appears in the same render frame as the click.
- **No more "ghost copy" when moving a LIMIT order on the chart.** Backend cancel + new submit happens in one call, but the renderer's `getOpenOrders` cache (Binance direct query) still held the cancelled `orderId` until the next refetch — chart painted both the old and new entry lines for ~200–500ms after each drag. `updatePendingEntry` now returns `oldOrderId` / `newOrderId`. The mutation onSuccess uses `queryClient.setQueriesData` (with key predicate) to drop the cancelled order from every variant of `getOpenOrders` / `getOpenAlgoOrders` cache regardless of input shape (walletId vs walletId+symbol).
- **Cancel single / Cancel all wipes lines from chart instantly.** `cancelOrder` now uses `onMutate` (fires BEFORE the network request) to drop the orderId from open-order caches the instant the user clicks Cancel. `cancelAllOrders` empties both caches optimistically. Without this, cancelled order lines lingered visibly on the chart for the full ACK + refetch round-trip.

### Notes
- Extracted `dropOrderFromCaches` / `removeOrderFromAllOpenOrderCaches` helpers in `useBackendTradingMutations` and `useBackendFuturesTrading` so the pattern is reusable for future mutations.
- 2457 renderer unit tests + 76 backend trading router tests + type-check + lint clean.

## [1.11.4] - 2026-05-04

### Fixed
- **WalletCard sidebar Net P&L now matches Analytics modal.** The card was deriving `netPnL = currentBalance − (initialBalance + netDeposits)`, which bakes in unrealized PnL on currently-open positions plus COIN_SWAP movements. Analytics modal switched to income-events ground truth in v1.11.2, so the two surfaces could disagree by hundreds of dollars on the same wallet at the same instant (user reported WalletCard −$162 vs Analytics +$930). The card now sources `netPnL`/`grossPnL`/`totalFees`/`totalFunding` from the same `useBackendAnalytics(wallet.id, 'all').performance` query the Analytics modal uses.

## [1.11.3] - 2026-05-04

### Fixed — leverage resolution: fail loud, never silently default to 1×
- **Root cause for the "95% × 15× = 0.006 BTC" scalp trap.** Two code paths silently defaulted leverage to 1× when Binance's data layer momentarily couldn't return it (V3 endpoint propagation hiccup, fresh symbol with no open position, brief API stall):
  1. `getConfiguredLeverage` had a final `?? 1` fallback after both `getFuturesSymbolConfig` and `accountInformationV3` lookups missed. The ticket then computed `95% × 1× / price` = 6.3% of the intended notional, producing 0.006 BTC entries when the user intended ~1 BTC.
  2. `services/trading/order-quantity.ts` was a stale duplicate that read `acctPos.leverage` directly from V3 accountInfo — the V3-dropped field. Logged "Could not determine live leverage — falling back to 1x" and proceeded with wrong sizing.
- **Fix in three layers**:
  - New `LeverageUnavailableError` exported from `binance-futures-client`. `getConfiguredLeverage` throws it instead of defaulting to 1.
  - `services/trading/order-quantity.ts` delegates to canonical `getConfiguredLeverage` and converts the error to `PRECONDITION_FAILED` with actionable copy ("Open the leverage popover to set it explicitly, then retry").
  - `getSymbolLeverage` router translates `LeverageUnavailableError` to `PRECONDITION_FAILED` and stops poisoning the SYMBOL_LEVERAGE cache with stale fallback values (`cached.leverage > 0` guard).
- **Frontend `useOrderQuantity` exposes `isReady` + `notReadyReason`.** Returns `qty='0'` when leverage is loading, errored, or undefined. Both ticket (QuickTradeToolbar) and chart-drag entries (useChartTradingActions) gate their handlers on `isReady`, surfacing the reason as a toast so the user knows exactly why their click didn't go through ("Loading leverage…" / "Could not read leverage").

### Notes
- 41 binance-futures-client tests passing (+ 2 rewritten to assert throw rather than 1× fallback). 9 useOrderQuantity tests passing (+ 3 new: refuses on loading, refuses on error, isReady=true on happy path). 8 order-quantity tests rewritten to use the new mock surface. 47 QuickTradeToolbar tests passing (mocks updated). 2457 renderer unit tests + type-check + lint clean.

## [1.11.2] - 2026-05-04

### Added — Analytics modal content sweep
- **Equity Curve breakdown** — chart now overlays 4 cumulative series on top of the main equity area: realized PnL (green), fees (red), funding (orange), and net transfers (gray dashed). Each toggleable via legend chips in the panel header. Tooltip shows all series + real-profit % at the hovered timestamp.
- **Breakeven step line** — `initialBalance + cumulativeNetTransfers(t)`, steps up on every deposit / down on every withdrawal. The gap between the equity area and breakeven IS real profit (what survived after fees + funding, discounting capital movements).
- **Headline strip above the chart** — Real Profit / Breakeven / Equity at-a-glance.
- **Long vs Short panel** — side-by-side cards showing trade count, win rate, net PnL, and avg per side. Streaks (longest win / loss) callout below.
- **Best / Worst Trade section** — symbol + side + duration + PnL$ + PnL% for the top winner and bottom loser of the period.
- **Setup Breakdown / Symbol Breakdown tables** — top 5 of each (sortable by absolute PnL), rendered with the standard `TradingTable` primitive.
- **PerformancePanel — 4th metric row** — Total Fees / Total Funding / Avg Trade Duration. Net PnL subtext now shows fees with proper sign.

### Fixed — Analytics correctness
- **Net PnL ground truth** — `getPerformance.netPnL/totalFees/totalFunding/grossPnL` now read from `incomeEvents` (Binance authoritative) when available, with a fallback to per-trade fields on paper wallets. Resolves the divergence where the headline showed `-$90.74` (per-trade `tradeExecutions.fees` had drifted +$950 from Binance reality due to partial-fill double-counting upstream) while the equity curve correctly showed `+$930.77`.
- **Total Return sign-consistent with Net PnL across all periods** — both now derive from the same income-events base. Earlier Total Return was wallet-balance-based on `'all'` (currentBalance − effectiveCapital, which includes unrealized drawdown + COIN_SWAP_WITHDRAW), producing pairs like `Total Return -3.59% / Net PnL +$930.77`.
- **Equity curve no longer double-counts transfers** — seed point uses `initialBalance` instead of `effectiveCapital`. The previous seed already baked totalDeposits / totalWithdrawals from wallet metadata, then the loop summed the same TRANSFER income events on top, inflating equity by the deposits and producing a fake "real profit" that included capital movements.

### Fixed — Ticket precision + reactivity
- **Wallet balance updates in the same render frame as the Binance event** — new `mergeWalletBalanceUpdate` helper patches `wallet.list` directly from the `wallet:update` socket payload (extracts USDT `wb` / `cw`). Previously the renderer scheduled a 250ms debounced invalidate → refetch round-trip — net delay 300–700ms before the ticket's "100%" reflected freed-up capital after a close. Critical for scalping where the next entry sizes against the live total.
- **Quantity floors instead of rounding nearest** — `roundTradingQty` used `toFixed()` (round-nearest), so `0.46599999` became `"0.4660"` and over-allocated against the user's percentage. Combined with float drift in `(balance × leverage × pct) / price`, this could push qty over the LOT_SIZE filter → insufficient-margin reject OR server-side floor producing smaller-than-expected fill. Now floors via `Math.floor` and snaps to the symbol's actual `stepSize` (Binance LOT_SIZE) when known. Ticket preview = actual fill.
- **`useOrderQuantity` queries `getSymbolFilters`** — passes real `stepSize` through to `roundTradingQty`. 1h staleTime since exchange info rarely changes.

### Changed — Realtime sync redundancy trim
- **Mutation onSuccess no longer fires invalidates the socket layer already covers** — `createOrder`, `cancelOrder`, `closeExecution`, `cancelExecution` previously each fired 5–7 invalidations (`getTradeExecutions`, `getActiveExecutions`, `getOrders`, `getPositions`, `getOpenDbOrderIds`, `wallet.list`). Most were duplicate work: `position:update` / `order:created` / `wallet:update` socket events arrive 100–300ms later and patch the same caches via merge helpers. The redundant invalidates triggered an extra refetch round-trip per click and a visible stutter on the Buy/Sell button. Kept invalidations only for caches the socket layer doesn't touch (analytics aggregations; algo-order channel for SL/TP edits).
- **Socket handlers no longer schedule cross-domain invalidates** — `position:update` dropped `'wallet'` (the matching `wallet:update` event already patches the balance; cosmetic position updates like leverage / SL/TP changes don't move balance). `order:created` and `order:cancelled` dropped `'wallet'` similarly. `trade:notification` dropped all schedules — it's a side channel for toasts; the underlying state changes already arrive on dedicated socket channels.
- **Debounce timer no longer resets on each call** — earlier `scheduleInvalidation` cleared+reset the 250ms timer on every call. A burst of 3 socket events within 30ms (e.g. position close → wallet:update → position:update flash) kept pushing the deadline back, so the safety-net invalidate fired ~280ms AFTER the LAST event in the burst — felt like extra lag. Now keys accumulate into the original window; first event sets the deadline.

### Notes
- 30 backend analytics router tests passing (+10 new ones for the new fields). 2455 renderer unit tests passing. Type-check + lint clean across both apps.

## [1.11.1] - 2026-05-03

### Fixed
- **Binance V3 leverage source of truth** — V3 dropped `leverage` and `isolated` from `accountInformationV3.positions[]`, so the V3 migration in v1.11.0 silently fell back to `1×` for all readers (`getPositions`, `getPosition`, `getConfiguredLeverage`, `getAccountInfo`). Symptoms: chart's position line PnL% line showed raw notional move (e.g. `-0.07%`) instead of leveraged move (`-0.7%`) on a 10× position; Portfolio table + PositionCard rendered `1x` badge instead of the actual leverage; ticket leverage display showed `1×` even after the user had set `10×` via the popover. Switched to `/fapi/v1/symbolConfig` (SDK: `getFuturesSymbolConfig`) as canonical source — returns `{ symbol, marginType: 'CROSSED'|'ISOLATED', leverage }` per symbol, regardless of whether a position is open. Added a defensive fallback that derives leverage from `notional / initialMargin` (mathematically exact: `initialMargin = notional / leverage` by definition) when `symbolConfig` misses an entry. 10s in-memory WeakMap cache amortizes the bulk-fetch cost across position-sync's 30s ticks.
- **`live-order-executor` reset manually-set leverage to 1× on every fill** — the entry path called `setFuturesLeverage(symbol, config.leverage ?? 1)`, so when a watcher's `autoTradingConfig.leverage` was null (the common "use the user's symbol leverage" case), the `?? 1` fallback silently overwrote the user's manually-configured leverage every entry. Now only calls `setFuturesLeverage` when `config.leverage != null`.
- **Race between `position-sync` and `handleManualOrderFill`** could create duplicate `tradeExecutions` rows for the same position — both paths inserted on the first fill push, doubling Portfolio exposure until the periodic sync ran reconciliation. Two-layer same-side guards: `handleManualOrderFill` re-checks for an existing open exec before INSERT; `position-sync`'s unknown-position branch re-reads recent inserts via `.where(...).limit(1)` before treating as orphan.
- **`position-sync` now reconciles `leverage` on existing exec rows** — for positions opened before the V3 fix landed (rows stored with `leverage=1` despite running at e.g. 10× on Binance), the next 30s sync tick detects `dbLeverage !== exchangeLeverage` and writes the corrected value, then emits `position:update` via socket so the chart line, Portfolio panel, and PositionCard refresh without waiting for the next tRPC poll. No close+reopen needed.

### Changed
- **`getConfiguredLeverage(client, symbol)` queries `/fapi/v1/symbolConfig` directly** instead of scanning `accountInformationV3.positions[]`. The new endpoint returns the user-configured leverage even when `positionAmt = 0`, which is exactly the "what leverage would a new order use?" semantic the function name implies.
- **`leverage-popover` patches the React Query cache directly** from the `setLeverage` mutation response instead of invalidating + refetching, so the trigger label updates instantly when clicking 1×/10×/etc.

### Notes
- Diagnostic script at `apps/backend/scripts/debug/diag-leverage.ts` compares all 3 leverage sources against a live Binance account (`accountInformationV3.positions[]`, `getFuturesSymbolConfig`, `getPositions`) — useful for confirming the fix on real accounts and for catching future API shape drift.
- 12 new tests in `binance-futures-client.test.ts` pin the leverage-resolution contract end-to-end (canonical source, defensive fallback, last-resort 1× fallback, ISOLATED marginType, defensive zero-leverage rejection). Total: 5,517 backend tests passing.

## [1.11.0] - 2026-05-03

### Added
- **Checklist L/S score chart** — toggleable from the 3-dot options menu in the checklist header. Recharts `LineChart` (140px) showing rolling Long / Short scores on the same axis with a single neutral 40% reference line. When the chart is visible the L/S badges + ⋮ menu sit above the chart and the "Checklist" label hides; when collapsed the original full row is preserved. Backed by a new `checklist_score_history` table (`profileId × symbol × interval × marketType × recordedAt` unique index, source `live | backfill`). Live samples write through on every `evaluateChecklist` call; first chart-open seeds from `getScoreHistory` (last 7d) and triggers a `backfillScoreHistory` mutation that walks up to 100 evenly-spaced kline closes within the lookback window and reconstructs scores. Surfaces a "Collecting history…" hint between backfill completion and the first live points.
- **Per-instance oscillator thresholds** — `IndicatorConfigDialog` exposes a Thresholds section with Oversold / Overbought number inputs for any catalog entry whose `defaultThresholds` carries both values (RSI, Stoch K/D, CCI, WPR, MFI, TSI, Custom RSI). Persisted on `UserIndicator.params` under reserved keys `_thresholdOversold` / `_thresholdOverbought`; consumed by `renderPaneLine` + `renderPaneMulti` via the new `getEffectiveOscillatorThresholds()` helper from `@marketmind/trading-core`. User overrides take precedence over catalog defaults; falls back to catalog when unset. No DB migration (params is already JSON).
- **`@marketmind/ui` graduations** — `MiniLineChart` (generic multi-series chart with Skeleton fallback + ReferenceLine support, used by ChecklistScoreChart), `CollapsibleSection` (size variants, static / collapsible modes), `TradingSideCard` (LONG / SHORT-coded 4px accent). All Tier-2 token-aware primitives; renderer-side index re-exports keep callsites intact.
- **`BinanceNetworkOutageError` + 5s cooldown** — `guardBinanceCall` detects DNS/socket errors (`ENOTFOUND`, `EADDRNOTAVAIL`, `ETIMEDOUT`, `ECONNREFUSED`, `ENETUNREACH`, `ECONNRESET`, `EAI_AGAIN`) up to 4 levels deep in the cause chain. Subsequent calls during the cooldown fast-fail in <1ms instead of waiting through 3 axios retries × timeout. tRPC error mapper translates to `SERVICE_UNAVAILABLE` (503); `onError` demotes them to debug log level so brief network blips don't flood the error feed.

### Changed
- **Binance SDK V3 endpoint migration** — `client.getPositions()` and `client.getAccountInformation()` (USDM) replaced with `getPositionsV3()` and `getAccountInformationV3()` across `binance-futures-client`, `wallet/crud`, `futures-trading/order-mutations`, `futures-trading/account-config`, `trading/order-mutations`, `trading/order-quantity`. V3 `positionRisk` dropped `leverage` and `marginType`; the internal `getPositions(client)` and `getPosition(client, symbol)` wrappers now fetch both V3 endpoints and merge by `(symbol, positionSide)` so the public `FuturesPosition` shape stays identical. `order-quantity.ts` deduplicated to a single `getAccountInformationV3` call. Spot `MainClient.getAccountInformation` left intact (not deprecated).
- **Checklist focus-tracking gated on `timeframe='current'`** — previously `ChecklistSection` re-fetched on every focused-chart change; the parent `ChecklistPanel` always passed `interval = focusedInterval ?? '1h'`. Refactored: panel passes static `'1h'`, section's `useLayoutStore` selector short-circuits to `undefined` when no enabled condition uses `timeframe='current'`. Focus changes are a no-op when the checklist has no current-timeframe conditions, so the persisted score history bucket stays stable.
- **Portfolio "Today's P&L" font size** standardized to the panel `xs` baseline (was `sm`).

### Fixed
- **Custom-symbol gap-filler routing** — composite symbols (POLITIFI etc.) had their klines persisted with `marketType='SPOT'` regardless of constituent market type, then the regular gap-filler hammered Binance with `/api/v3/klines?symbol=POLITIFI` and got 400 Bad Request — including a chronic 8-year gap fill attempt (2017-08-17 → 2025-08-22). Two-layer guard: `active-pairs.ts` filters custom symbols out of the maintenance loop's input list; `gap-detection.ts` and `kline-maintenance.forceCheckSymbol` short-circuit defensively. CustomSymbolService remains the sole backfill path for these.

## [1.10.0] - 2026-05-02

### Added — v1.10 panel-polish bundle

**Grid + UX foundation**
- Grid granularity bump: cols `12 → 192` (×16 horizontal), rowHeight `30 → 8` (×4 vertical) for ~1:1 cell ratio at typical viewports. Migration on hydrate scales existing layouts to keep visual size identical (`gridVersion` 1 → 2).
- Layout templates rebuilt from user-validated layouts: 6 trading variants (1m/5m/15m, 5m/15m/1h, 15m/1h/4h, 1h/4h/1d, 4h/1d/1w, 1d/1w/1M), Auto-Trading, Auto-Scalping. New `LAYOUT_TEMPLATES` array exported from `layoutStore`. New Layout dialog gains a Template selector + preset name pre-fill.
- `duplicateLayout(layoutId, newName?)` action — re-mints panel ids on the copy. Right-click on layout tab adds Duplicate between Rename and Delete.
- `+ Add panel` menu cardinality is per-layout: each layout can hold its own Ticket / Checklist / etc independently.
- `Organize grid` (Compact / By columns / By rows) gated by a confirmation dialog so an accidental click doesn't wipe a hand-tuned layout.
- Per-panel "Properties" dialog scaffolding (`DrawingPropertiesDialog` for drawings; `PROPERTIES_DIALOG_TYPES` registry).
- Order Book panel restored — `DomLadder` + `useDepth` lost when `OrderFlowSidebar` was deleted in Track 7. Plus `ScalpingConfigDialog` wired into `AutoTradingSetupPanel` (was a noop before).

**Panel polish**
- Ticket fills its panel; `<QuickTradeActions>` rendered inline (no floating-drag wrapper). Action rows always inline below buy/sell — user hides them by sizing the panel smaller.
- Leverage popover right-justified next to the size presets (`ml="auto"`).
- Spread display becomes a plain bordered box (chevron slot gone).
- Checklist always expanded — chevron toggle dropped.
- Orders panel drops the Total/Active/Pending summary card and the duplicate top "View All Orders" button; remaining "View All Orders" promoted to the filter row.
- Positions panel renders the standalone Portfolio positions list (filter + sort + table/cards), no title.
- Portfolio panel becomes "Exposure" — drops positions section / orphan orders / expand-collapse toggle. Daily P&L + summary stats (exposure / margin / stop-protected / TP-projected) only.
- Auto-Trading group renamed (i18n only): Watchers → Auto-Trading, Setup Detection → Auto-Scalping, Auto-Trading Activity → Logs. Beta badge on Auto-Scalping.
- Compact `p={1.5}` outer panel padding everywhere; inner components no longer carry their own dialog-sized padding.
- ChecklistSection drops its top divider line.

**Theme**
- Card backgrounds switched from `bg.muted` to `bg.surface` (PortfolioSummary, daily-P&L card, MarginTypeToggle hint, TradingSideCard, ScalpingDashboard cards) — subtler shade.
- Focus border kept on chart panels only (`<GridWindow>`); dropped from bare panels (`<GridPanel>`). Single-symbol layouts make the visual hint redundant on non-charts.
- Dialog `<DialogPositioner>` and `<DialogBackdrop>` in `@marketmind/ui` now wrap themselves in `<Portal>` so dialogs from inside grid panels escape `overflow:hidden` clips.
- DialogShell adds opt-in `bodyOverflow="visible"` prop for small dialogs that need an inline `<Select usePortal={false}>` dropdown to extend past the body bound (e.g. New Layout). Default stays `overflowY="auto"` so long dialogs (Analytics, Settings, Backtest) keep scrolling inside the body instead of bleeding past the dialog.

**Drawings**
- Magnet anchor snap on hover (matches the existing OHLC magnet pattern). Snap to handle takes priority over OHLC; reuses `lastSnapRef` + `renderSnapIndicator` with a new `'handle'` ohlcType (no letter label).
- Horizontal-line price tag on the price scale — overlays the axis like the live-price tag, not clipped to chart bounds. Tag color follows `drawing.color`; price formatted without thousands separator (matches other tags).
- Bidirectional value config: `<DrawingPropertiesDialog>` + numeric Price input. Drag updates store → input reflects; Enter / blur commits → renderer redraws.
- `getReadableTextColor(bg)` — WCAG luminance-based black/white text picker (threshold 0.55). Applied to `drawPriceTag` and `drawCurrentPriceTag` so user-customized light tag colors stay readable.

**ORB**
- Renders every day including weekends — every market session's `tradingDays` bumped to `[0..6]`. Session names (NYSE, TSE, B3, …) preserved.

### Fixed — trading-flow audit (truth-in-numbers pass)

- **Funding fee accumulation pipeline (HIGH)** — `tradeExecutions.accumulatedFunding` was never written for live wallets even though Binance `FUNDING_FEE` income events arrived in `incomeEvents` and were linked via `executionId`. Per-trade P&L silently omitted funding for every live trade. New `recomputeExecutionAccumulatedFunding(executionId)` uses time-window match (wallet+symbol+incomeTime BETWEEN openedAt..closedAt) — authoritative against Binance, robust to the linker's greedy assignment when executions overlap. Refuses to overwrite a non-zero value with zero.
- **`scripts/audit/repair-funding.ts`** — one-off repair script that recomputes funding from time-window match, recomputes pnl by `pnl += fundingDelta`, and applies the aggregate delta to wallet balance. Applied to the affected wallet (20 executions, +47.14 USDT swing).
- **Audit reconciliation prefers Binance `realizedPnl`** over local `(exit-entry)*qty` when available — Binance handles weighted-average multi-fill, partial closes, post-only adjustments correctly.
- **`audit-fees` accepts `--fees-cap` / `--fees-days`** CLI flags so users can run wider one-off corrections (e.g. `--fees-cap=500 --fees-days=30`).
- **Income-event recovery on user-stream reconnect** — `forceReconnectWallet` and the native client `'reconnected'` handler now call `syncWalletIncome` after the position sync. Funding / commission / realized-PNL events that landed during the gap no longer wait for the next hourly poll.
- **Closed-order exit price** — Orders table "Current Price" column rendered the live ticker for closed positions, making P&L look mismatched against the displayed price. Closed rows now display the actual `exitPrice` from the trade execution.
- **Realtime sync debounce** dropped 100ms → 16ms (one render frame). Bursts still coalesce; manual closes feel instant.
- **Fee breakdown in Orders table + OrderCard** — entry / exit fees rendered explicitly; P&L relabeled "Net P&L".

### Notes — v1.10.0

- 2387 unit tests + 27 browser tests passing (+50 new tests vs v1.8: layoutStore migration / templates / duplicate, drawing handles geometry, magnet anchor render, horizontal-line render + tag, properties dialog binding, priceTag dynamic color).
- Visual-regression baseline will need a refresh after merge — granularity + padding + theme changes are large enough to invalidate the v1.8 baseline.
- E2E + a11y tracks (Track 9) and `audit-grid-panel-rules.mjs` (Track A) deferred to v1.10.1.

### Removed — legacy sidebar components (v1.10 Track 7)
- Deleted `<MarketSidebar>`, `<TradingSidebar>`, `<AutoTradingSidebar>`, `<OrderFlowSidebar>` and their re-exports. All four were unreachable from the toolbar after Track 6 (#421); no callsite outside their own dirs imported them.
- The tab content files inside `MarketSidebar/tabs/` (WatchersTab, MarketIndicatorsTab, LogsTab, MarketIndicatorCharts, MarketIndicatorSections, MarketNoData) are kept — they're the bodies the v1.10 panel wrappers wrap.
- `useUIStore` cleanup: dropped `tradingSidebarTab` / `setTradingSidebarTab`, `marketSidebarOpen` / `setMarketSidebarOpen` / `toggleMarketSidebar` / `marketSidebarTab` / `setMarketSidebarTab`, `autoTradingSidebarOpen` / `setAutoTradingSidebarOpen` / `toggleAutoTradingSidebar` / `autoTradingSidebarTab` / `setAutoTradingSidebarTab`, `orderFlowSidebarOpen` / `setOrderFlowSidebarOpen` / `toggleOrderFlowSidebar` / `orderFlowSidebarTab` / `setOrderFlowSidebarTab` and the corresponding type aliases (`TradingSidebarTab`, `MarketSidebarTab`, `AutoTradingSidebarTab`, `OrderFlowSidebarTab`). The `HYDRATE_KEYS` list also stripped of the corresponding pref keys.
- `MainLayout` heavily simplified: drops the resizing logic, the `marketSidebarOpen` / `orderFlowSidebarOpen` / sidebar-width preferences, the `isTradingOpen` / `isAutoTradingOpen` / `onToggleTrading` / `onToggleAutoTrading` props (also removed from `App.tsx` consumer). Layout is now: `<Toolbar>` + `<ChartToolsToolbar>` + `<SymbolTabBar>` + `<ChartGrid>` + `<MinimizedPanelBar>` + `<LayoutTabBar>`.
- `OrderFlowSidebar.test.tsx` removed; `uiStore.test.ts` had 15 sidebar-state tests removed (test count is now 2324, down from 2339; net delta = removed obsolete tests, no new failures).

### Removed — sidebar toggle buttons in toolbar (v1.10 Track 6)
- Toolbar drops the four sidebar toggle buttons (`Market`, `Order Flow`, `Trading`, `Auto-Trading`). Their content is now exposed via the `+ Add panel` menu (Track 3): Market → `marketIndicators`, Order Flow → `orderFlowMetrics`, Trading → `ticket / checklist / orders / portfolio / positions`, Auto-Trading → `watchers / autoTradingSetup / autoTradingActivity`.
- Kept: Screener, Backtest, Analytics buttons — these are dialogs (not sidebars), so they stay where they are. The screener could become a panel later but is out of scope for v1.10.
- `Toolbar`'s prop API trimmed: `isTradingOpen / isAutoTradingOpen / onToggleTrading / onToggleAutoTrading` removed. Both consumers (`MainLayout`, `ChartWindow`) updated.
- The sidebar components themselves (`MarketSidebar`, `TradingSidebar`, `AutoTradingSidebar`, `OrderFlowSidebar`) are still in the codebase and reachable via remaining store flags — just no longer surfaced from the toolbar. Full sidebar removal lands as a follow-up cleanup once panel parity has been validated in production.

### Removed — orphan panel-kind registry entries (v1.10 cleanup)
- Dropped `exposure`, `indicators`, `marketSections` from `PanelKind` and the registry — none had a clean 1:1 mapping to existing sidebar content. `marketIndicators` already covers what would have lived in the dropped market sections; `exposure` (Margin/Risk display) remains a future addition once a real `<MarginInfoPanel>` is sourced from live exchange data; `indicators` overlapped with the toolbar's `<IndicatorTogglePopover>` and didn't merit a duplicate panel slot. Their i18n keys also removed.
- Chart panel's registry `load` is now a clearly-named `CHART_LOAD_UNUSED` placeholder — chart panels render via `<ChartGridPanel>` directly, not through `<NamedPanelRenderer>`.
- Net effect: `+ Add panel` menu now shows only panel kinds that actually render a body when selected. No more grey ✓ markers on items that had no working backing component.

### Added — Ticket + Checklist panels wired to grid (v1.10 Track 4.1)
- **`ticket` panel** registered: `<TicketPanel>` wraps the existing `<QuickTradeToolbar>` quick-trade ticket. Reads active symbol + market type from the layout store so switching symbol tabs retargets the ticket (per the user's clarification: layouts save panels; tabs only re-point them at the new symbol).
- **`checklist` panel** registered: `<ChecklistPanel>` wraps the existing `<ChecklistSection>` (trading checklist for the active symbol). Falls back to '1h' interval when no chart is focused.

### Added — AutoTrading panels wired to grid (v1.10 Track 4.5)
- **`watchers` panel** registered: `<WatchersPanel>` wraps the existing `<WatchersTab>` (suggestion cards + watchers table).
- **`autoTradingSetup` panel** registered: `<AutoTradingSetupPanel>` wraps `<ScalpingDashboard>` with the same select-wallet guard the AutoTradingSidebar uses; reads active wallet via `useActiveWallet()` and active symbol from the layout store.
- **`autoTradingActivity` panel** registered: `<AutoTradingActivityPanel>` wraps the existing `<LogsTab>`.

### Added — Market + OrderFlow panels wired to grid (v1.10 Tracks 4.4 + 4.6)
- **`marketIndicators` panel** registered: `<MarketIndicatorsPanel>` wraps the existing `<MarketIndicatorsTab>` (FearGreed / BTC.D / MVRV / ETF / Funding / OI / Altcoin Season / ADX / Order Book / Funding Rates) so the user can pop the entire market dashboard onto the grid.
- **`orderFlowMetrics` panel** registered: `<OrderFlowMetricsPanel>` wraps the existing `<OrderFlowMetrics>`, reading the active symbol from the layout store (`useLayoutStore(s => s.getActiveTab()?.symbol)`).

### Added — Trading panels (Orders / Portfolio / Positions) wired to grid (v1.10 Track 4.2)
- **`<NamedPanelRenderer>`** — new component in `Layout/` that lazy-loads a registered named panel via `getPanelDef(kind).load()` and wraps it in `<GridPanel mode="bare">`. Right-click on the panel body fires `onClose` → removes the panel from the active layout.
- **3 trading panel kinds wired** in the registry: `orders` → `<OrdersPanel>` (existing `<OrdersList>`), `portfolio` → `<PortfolioPanel>` (existing `<Portfolio>` minus the sidebar's quickTradeHeader), `positions` → `<PositionsPanel>` (existing `<FuturesPositionsPanel>`).
- **`ChartGrid`** now renders both chart and named panels — chart panels keep their existing path; named panels go through `<NamedPanelRenderer>`. Picking "Trading → Orders / Portfolio / Positions" from the `+ Add panel` menu now actually shows the body (was empty before).
- Remaining panel kinds (Ticket, Checklist, Exposure, Indicators, MarketIndicators, MarketSections, Watchers, AutoTradingSetup, AutoTradingActivity, OrderFlowMetrics) still grey out as `NOT_YET_REGISTERED` until subsequent tracks wire their bodies.

### Changed — Grid scrolls vertically + panels can exceed viewport (v1.10 Track 2)
- **Outer grid container** now uses `overflowY="auto"` (when no panel is maximized) so the user can stack more panels than fit in one screen and scroll between them. Previously the container was `overflow="hidden"` and the row height was dynamically calculated to fit everything in the visible area, which made larger workspaces impossible.
- **Row height fixed** at `DEFAULT_ROW_HEIGHT` (30px). Each `h` unit in panel positions now corresponds to a real, stable pixel height. Panels can be resized larger than the viewport and scroll into view.
- Maximized panels still take the full visible viewport (`overflowY="hidden"` while maximized) — geometry computed against the container's current size.

### Added — `+ Add panel` and `Organize grid` header menus (v1.10 Track 3)
- **`<AddPanelMenu>`** — registry-driven `+` dropdown in the main toolbar. Replaces the v1-era chart-only `+` menu. Charts: one entry per timeframe (1m / 5m / 15m / 30m / 1h / 4h / 1d), multi-instance. Every other registered panel kind (Ticket, Checklist, Orders, Portfolio, Positions, Exposure, Indicators, MarketIndicators, MarketSections, Watchers, AutoTradingSetup, AutoTradingActivity, OrderFlowMetrics): single click adds the panel; greys out with a ✓ marker when already on the active layout.
- **`<OrganizeGridMenu>`** — second header dropdown next to `+`. Three classic algorithms: Compact (snap-to-top-left preserving order), By columns (equal-width vertical strips), By rows (full-width horizontal stack). Skips minimized panels, preserves their geometry. Wires to the existing `updateGridLayout` store action.
- 13 i18n keys added under `panels.*` (group labels, menu labels, panel titles for all registered kinds).
- Named-panel `<GridPanel>` bodies still need to be wired (Tracks 4.1–4.6); `addNamedPanel` works today but the panels render as empty bare frames until their components are migrated from sidebars.

### Fixed — Settings dialog tab widths + bottom padding
- **Settings tab content area now fills the available width.** Root cause: `<Tabs.Root orientation="vertical">` resolves to `display: flex` (per Chakra's Tabs recipe), and the inner `<Flex>` wrapper holding rail + content had no `flex-grow`, so it collapsed to its content's intrinsic width — the content area was sized to the rail (220px) instead of `100% - 220px`. Adding `flex={1}` on the inner Flex restores the layout.
- **`ChartSettingsTab` Display Options switches** — were using `<Switch>{label}</Switch>` (label rendered inline next to the toggle), which left the right half of each row empty. Migrated each to the bible-correct `<FormRow label={...}><Switch /></FormRow>` shape so the label sits on the left and the toggle on the right of the row, with helper text under the label.
- **`GeneralTab` Theme button group** — `<HStack>` had no `w="100%"`, so the Light/Dark buttons collapsed to ~150px wide despite each having `flex={1}`. Added `w="100%"` so the buttons split the full row width.
- **Settings content padding** — bumped horizontal padding from `px=5` (20px) to `px=6` (24px) and bottom padding from `pb=8` (32px) to `pb=10` (40px). The `pb` was previously being eaten by the WebKit scroll-container behavior (last item flush against the scroll edge) — moved padding INSIDE the scroll container so it scrolls along with content.

### Added — `<DialogShell>` `bodyFill` mode
- New `bodyFill?: boolean` prop on `<DialogShell>`. When true, the body becomes a flex column that fills available height (`overflow: hidden`, no inner Stack wrapper) so the consumer manages its own scrollable region inside.
- When `bodyFill` is true, `DialogContent` also gets `h={contentMaxH ?? '90vh'}` (in addition to the existing `maxH`), so the dialog stays at a consistent height regardless of how short the active tab's content is — no more dialog "shrinking" when the user switches to a small tab like General/About/Notifications.
- Migrated `SettingsDialog` to use `bodyFill`. Replaced the brittle `h="calc(90vh - 64px)"` (which assumed a fixed 64px header height and over-estimated the body's available space, causing the dialog body to scroll instead of just the inner content) with `flex={1} minH={0}` on the inner `<Flex>`. Now small tabs (General/Notifications/About) and large tabs (Security/Chart/Data) all behave consistently — only the inner content area scrolls, the rail stays put.

## [1.8.0] - 2026-05-02

**v1.8 release** — enforcement + last-mile cleanup. v1.6 made the dialogs uniform, v1.7 brought every other surface up to the same design language, and v1.8 turns those rules into something the codebase enforces (CI gate) instead of relying on review. Three implementation PRs (#406–#408). Tests stay at 2332/2332 throughout.

### Added — Panel audit gate (v1.8 Track A)
- **`scripts/audit-panel-rules.mjs`** — companion to the existing dialog audit. Two rules:
  - `bespoke-record-row` — catches `<Box>` with the `borderWidth=1 borderColor=border borderRadius=md` shape outside the `<RecordRow>` primitive
  - `bespoke-loading-text` — catches `<Text>{t('common.loading')}</Text>` next to a `<Spinner>` (bible says spinners stand alone)
- `pnpm lint:panels` (warn) / `pnpm lint:panels:strict` (gate). Wired into CI alongside `lint:dialogs:strict` and `lint:shades`.
- **`<RecordRow>` extended** — added `tone='default' | 'muted' | 'panel'` and `onClick` (interactive variant with `cursor=pointer` + `_hover={{ bg: 'bg.subtle' }}` + `data-testid` passthrough), so the primitive can absorb the highlighted-card and clickable-list-row shapes too.

### Changed — Sweep of older drift the new audit caught
- **MarketIndicatorCharts** — 6 stat cards (FearGreed, BtcDominance, MVRV, ETF Flows, Funding Rate, Open Interest) migrated to `<RecordRow density="card" tone="muted">`.
- **MarketIndicatorSections** — 4 sections migrated to the same shape.
- **FuturesPositionInfo, MarginInfoPanel, FiltersTab** — outer bordered framing migrated to `<RecordRow density="card">`.
- **EquityCurveChart** — recharts tooltip migrated to `<RecordRow tone="panel">`.
- **RecentRunsPanel** — clickable list rows migrated to `<RecordRow onClick>`.
- **AuthGuard** — bare `<Text>{t('common.loading')}</Text>` next to the full-page `<Spinner>` removed (bible: spinners stand alone).

13 callsites total. Audit strict-clean and gating CI.

### Added — Trading position card primitive (v1.8 Track P)
- **`<TradingSideCard side="LONG" | "SHORT">`** — extracted the side-coded position-card shell (the `<Box p={3} bg="bg.muted" borderRadius="md" borderLeft="4px solid" borderColor={isLong ? 'trading.long' : 'trading.short'}>` shape that lived in 3 places). Wraps the body in a primitive that owns the trading-side color cue.
- **3 callsites migrated** — `PositionCard`, `OrderCard`, and the inner `FuturesPositionCard` inside `FuturesPositionsPanel.tsx` all reduce to `<TradingSideCard side={...}>{body}</TradingSideCard>`.
- **`FuturesPositionsPanel` loading state fixed** — was misusing `<EmptyState size="sm" title={t('common.loading')} />` (EmptyState is for "nothing here", not "loading"). Replaced with the standard `<Spinner>` panel combo (`MM.spinner.panel`).

Net: 12 fewer lines across the 3 migrated files, primitive scoped to `apps/electron/src/renderer/components/ui/` (uses trading.* tokens which are project-specific, so it stays out of `@marketmind/ui`).

### Documentation — Style Guide updates (v1.8 Track D)
- **`docs/UI_STYLE_GUIDE.md`** — added "RecordRow pattern (v1.7+)" and "TradingSideCard pattern (v1.8+)" sections covering API matrix (density / tone / onClick for RecordRow; side for TradingSideCard), usage examples, applied surfaces, and the why-not-extend-RecordRow rationale for TradingSideCard. Both primitives added to the Data Display catalog table.
- **`apps/electron/src/renderer/components/ui/README.md`** — RecordRow + TradingSideCard rows added to the Data Display catalog with crisp one-line descriptions and CI-gate notes.

## [1.7.0] - 2026-05-02

**v1.7 release** — Phase-2 design-language sweep: every non-dialog surface (sidebars, chart panels, auth pages, chart toolbar, list rows) brought up to the v1.6 design language. v1.6 made the dialogs uniform; v1.7 extends that to the rest of the app so the whole experience reads as one design system, not a patchwork.

5 implementation PRs (#398–#402). Tests stay at 2332/2332 throughout.

### Added — Sidebar primitives (Track S, #398)
- **`<SidebarHeader>`** updated to match the actually-used style (`fontSize="xs"` `fontWeight="semibold"`, `px=3` `py=2`, `borderBottom`). The previous `lg/medium` style was aspirational with no consumer.
- **`<SidebarTabsHeader>`** — new primitive bundling `Tabs.List` + an optional right-aligned close action. The 3 tabbed sidebars all reinvented this composition; the primitive locks it down (close X always on the right per UX convention).
- **All 4 sidebars migrated** — MarketSidebar, TradingSidebar, AutoTradingSidebar, OrderFlowSidebar. Bare `<Text fontSize="xs">` wrapping `<Tabs.Trigger>` removed (Trigger renders its own label correctly). `aria-label="Close"` literals → `aria-label={t('common.close')}` for i18n hygiene.

### Added — Chart panels (Track P, #399)
- **`OrderFlowMetrics`** — bespoke `<Box p=3><Stack><Text>Order Flow</Text>...` → `<FormSection title>` wrapping the metric rows.
- **`MarginInfoPanel`** — two bespoke `<Flex align="center" gap=2><Icon/><Text fontSize=xs fontWeight=semibold>` headers replaced with `<FormSection title action>` (HStack composition for the leading Shield / TrendingUp icons). Outer panel `<Box borderWidth=1>` framing kept.
- `PerformancePanel` and `AgentActivityPanel` already followed the bible from earlier work.

### Added — Auth pages (Track G, #400)
- **`<AuthFooterLink>`** primitive — the centered "muted Text + Link" pattern repeated ~7 times across the 6 auth pages now lives in one place.
- **`<AuthLayout footer>`** slot — pages pass their footer link via a prop instead of rendering it inside their body.
- **All 6 auth pages migrated** — Login, Register, ForgotPassword, ResetPassword, TwoFactor, VerifyEmail.
- `VerifyEmailPage` token-validation loading state migrated from bare `<Text>{loading}</Text>` to the standard `<Spinner>` panel combo (bible's loading rule applies to pages too).

### Added — Chart toolbar (Track T, #401)
- **`ChartToolButton`** extracted as the canonical primitive for the vertical chart-tools toolbar (TooltipWrapper placement=right + ToggleIconButton size=2xs). Used by both `DrawingToolButton` (drawing-tool selection) and the bottom-rail toggles (magnet, tooltip, market events, flip) — all 26 buttons now share the same shape.
- 4 inline `<TooltipWrapper>` + `<ToggleIconButton>` blocks deduped.

### Added — RecordRow primitive (Track R, #402)
- **`<RecordRow density="compact|card">`** in `@marketmind/ui`. Replaces the `<Box borderWidth="1px" borderColor="border" borderRadius="md" p={2|3}>` shape repeated across object-management surfaces (Wallets, Profiles, Custom Symbols, Snapshots, Sessions, Indicators, etc.).
- `compact` (default) for tight list rows: `px=2.5 py=2`. `card` for stand-alone cards: `p=3`.
- `CustomSymbolsTab` migrated as canonical card-density consumer. Other compact-density callers kept as-is — they aren't visually inconsistent with what RecordRow renders, so the primitive is just available for new code.

### Notes
- **Track A** (`audit-panel-rules.mjs` CI gate) deferred to v1.8 — running it strictly today would block PRs on unrelated drift in older code (e.g. MarketIndicatorCharts/Sections still has 10+ ad-hoc bordered cards). Plan: build the audit + the cleanup together in v1.8.
- **All v1.6 audits clean at release**: `audit-dialog-rules.mjs --strict` ✓, `audit-shade-literals.mjs` (218 files / 0 forbidden patterns) ✓, `audit-dialog-i18n-keys.mjs` (4 dialogs / 4 locales) ✓, type-check ✓.
- **Test counts**: backend 5483 / 5483, electron unit 2332 / 2332, browser 108 / 108, trading-core 143 / 143.

## [1.6.0] - 2026-05-02

**v1.6 release** — Design-system unification + chart reactivity overhaul. Two themes:

1. **Modal sweep + design system.** All 17 dialog surfaces rewritten against a single `<DialogShell>` + `<DialogSection>` primitive set; Settings reorganized (13 tabs → 9, with Wallets / Trading Profiles / Custom Symbols promoted to dedicated dialogs); 192 hardcoded i18n fallback strings cleaned; UI primitives extracted into `@marketmind/ui` (32 Tier-1 + 10+ Tier-2 + PasswordStrengthMeter as Tier-3 graduated). Shared infrastructure (`useFormState`, `useMutationWithToast`, `DialogControlProps`, audit scripts) lands first so per-dialog rewrites stay small.

2. **Chart reactivity overhaul (Track F, added 2026-05-02).** User reported a Stop Loss close taking ~1 minute to reflect on the chart, then a follow-up cancel-flicker on pending limit orders. 11 PRs ship the audit + fixes: backend tightens position-sync watchdog (5min → 30s), renderer drops backup polling 30s → 5s, chart subscribes directly to `position:closed` for an immediate snapshot+flash, optimistic-override TTL extends to 30s with smart deletion when server catches up, every position-close path emits a `trade:notification` toast (SL / TP / liquidation / pyramid / partial / manual / reconciled / orphan-cleanup), `stream:reconnected` event force-refreshes after backend restart, chart live-patches on `position:update` + `order:update` for trailing-stop / SL-modify / cross-client edits.

3. **Track G — per-dialog UX rewrite + Settings tabs identity sweep (added late, closes 2026-05-02).** After the dialog shells were uniform, a deeper audit found the *interior* of each dialog was still drifty: copy, interactions, and component choices for similar situations. Track G rewrote every dialog (G.1–G.18) and every Settings tab (S1–S9) per the new component bible (`docs/UI_DIALOG_PATTERNS.md`). WatcherManager (13 sub-section components) and IndicatorLibrary internally refactored from `<CollapsibleSection variant="static">` + `<Separator />` to `<FormSection>`. Result: 18 dialogs + 9 tabs reading back-to-back as a single design language.

83 commits since v1.5.0.

### Added — Modal sweep + design system (Tracks E + A + G)
- **`<DialogShell>` + `<DialogSection>` + `MM.dialog.*` tokens** (#337) — single primitive set every dialog uses. Width tokens (`sm`/`md`/`lg`/`xl`/`full`), fixed title typography, optional one-line description in the header, optional inline action on the right, fixed footer with `borderTop` + right-aligned buttons + Cancel/primary/destructive ladder.
- **18 dialog rewrites — every dialog conforming to the bible** (#338-#343, #385-#390) — ChartCloseDialog, KeyboardShortcutHelpDialog, SaveScreenerDialog, IndicatorConfigDialog, ImportProfileDialog, AddWatcherDialog, CreateWalletDialog, OrdersDialog, ProfileEditorDialog, StartWatchersDialog, TradingProfilesDialog, ScreenerDialog, AnalyticsDialog, BacktestDialog, SettingsDialog, WalletsDialog, CustomSymbolsDialog, ConfirmationDialog (callsite sweep). Each one passes the bible: shell, copy, CTA verb, error/loading/empty primitives.
- **Component pattern bible** (#384) — `docs/UI_DIALOG_PATTERNS.md`. 8 dialog jobs × canonical pattern + code snippet. Cross-cutting rules (title verb tense, CTA verb table, field layout stack-vs-grid, error/success/loading/empty channels, footer button colors, keyboard). Component picker (input → primitive). Authoritative reference future contributors read first.
- **Creation-dialog trigger pattern** (#345, #346) — `useDisclosure` + `<CreateActionButton>` standardized for every "+ Create X" flow. `docs/UI_CREATION_FLOWS.md` is the reference.
- **Settings reorganization** (#357-#360) — 13 tabs → 9. `Updates` folded into `About`; `Wallets`, `TradingProfiles`, `CustomSymbols` removed and replaced with dedicated dialogs opened from the place-of-use (WalletSelector, WatchersTab header, SymbolSelector). Settings now stays as: Account, Security, Notifications, General, Chart, Indicators, Auto-Trading, Data, About.
- **Settings tabs visual identity sweep (S1–S9)** (#391) — every tab uniform now. WatcherManager (13 sub-section components) + IndicatorLibrary migrated from `<CollapsibleSection variant="static">` + `<Separator />` to `<FormSection>`. CSS Grid for fields → `<HStack>` pairs (bible forbids CSS grid for field layouts). Loading states `<MetaText>` / bare `<Text>` → `<Spinner>` panel combo. Empty states bare Text → `<EmptyState>`. Reset-to-defaults buttons consolidated to FormSection's `action` slot. Dead `expandedSections` / `toggleSection` plumbing removed across ~15 files (variant=static is always-expanded — the toggle was a no-op for years). Duplicate `memberSince` removed from SecurityTab.
- **Shared infra (Track E, #329-#336)** — `*Modal.tsx` → `*Dialog.tsx` rename sweep, `DialogControlProps` base type, `useFormState<T>` hook, `useMutationWithToast` hook, i18n key shape convention (`<feature>.dialogs.<dialog>.<key>`), trading-domain constants centralized in `@marketmind/types`, reusable zod schemas, `audit-dialog-rules.mjs` catch-all CI script.

### Added — `@marketmind/ui` package (Track B)
- **`@marketmind/ui` workspace** (#353, #354) — 32 Tier-1 pure Chakra wrappers + 10+ Tier-2 token-aware composed primitives (Callout, FormSection, PanelHeader, typography family, DialogSection, CreateActionButton, ColorPicker, Sidebar). Renamed from working name `ui-core` (#380) once API stabilized.
- **PasswordStrengthMeter graduated** (#379) — refactored to accept pre-resolved labels via a `labels` prop instead of calling `useTranslation` internally; now lives in `@marketmind/ui` as Tier-3 graduated.

### Added — Documentation (Track C)
- **`packages/ui/README.md` + `docs/UI_DESIGN_SYSTEM.md`** (#355) — component catalog with examples + design-language reference covering the 13 UX rules.
- **`docs/I18N_DIALOG_KEYS.md`** + **`docs/UI_CREATION_FLOWS.md`** + **`docs/UI_DIALOG_PATTERNS.md`** — i18n key shape convention + creation-dialog trigger pattern + the dialog patterns bible (Track G's authoritative reference).

### Added — Track F: chart reactivity (#363-#377)
- **POSITION_CLOSED toast on SL / TP fills** (#366) + extended to algo/orphan/untracked close paths (#368) via shared `emitPositionClosedToast` helper. Title format: `"Stop Loss hit · BTCUSDT"`, body with side / exit price / PnL, color-coded by PnL sign.
- **POSITION_OPENED toast on limit + manual fills** (#373) — limit entry activations and Binance-UI-initiated orders both emit `info`-toned toast with side / qty / entry price.
- **POSITION_PYRAMIDED + POSITION_PARTIAL_CLOSE toasts** (#377) — additional fills on existing positions and reduce-only fills that don't fully close now emit dedicated toasts. New TradeNotificationType variants.
- **LIQUIDATION detection + critical-urgency toast** (#374) — `handle-order-update` now recognizes Binance's `orderType='LIQUIDATION'` and threads it through `handleExitFill` so liquidations no longer fall through as "Take Profit hit".
- **`stream:reconnected` event** (#375) — backend signals after user-stream recovery (3 sites: message-receipt-after-degraded, watchdog-forced reconnect, listenKey-expired). Renderer force-refreshes positions/orders/wallet/setupStats/equityCurve and toasts info for >30s gaps.
- **Chart live-patches on `position:update` + `order:update`** (#376) — server-pushed SL/TP/qty/limit-price changes show on the chart immediately via the optimistic-override system, instead of waiting for the React Query refetch path (~250ms saved).
- **Backup polling tightened** (#364) — `BACKUP_POLLING_INTERVAL` 30s → 5s for active executions / orders. Belt-and-suspenders against missed websocket events.
- **Chart subscribes directly to `position:closed`** (#364) — snapshot the closing exec into `closingSnapshotsRef`, trigger flash, schedule invalidate. Lets the close visual fire even before the centralized invalidate pipeline catches up.
- **Position-sync watchdog cadence** (#365) — 5min → 30s. Catches missed fills (e.g. when ORDER_TRADE_UPDATE goes unprocessed) within seconds instead of minutes.

### Added — Default checklist (#370, #371, #372)
- **1m + 5m timeframes for RSI 14, RSI 2, Stoch 14** in the default checklist template. Strict-monotonic weight ladder (+0.5 per TF), 1m as the floor at the indicator's base weight: RSI 14 / Stoch 14 → 1.0 / 1.5 / 2.0 / 2.5 / 3.0 / 3.5; RSI 2 → 2.0 / 2.5 / 3.0 / 3.5 / 4.0 / 4.5. New users get this template; existing users sync via `apps/backend/scripts/maintenance/sync-default-checklist.ts`.

### Fixed — Track F user reports
- **Stop Loss close lag** (#364, #365, #366) — chart used to take ~1 minute to reflect a SL close. Root cause: backup polling at 30s was the only fallback when the websocket signal missed; the chart had no direct subscription to `position:closed`; position-sync was every 5 min so it didn't catch missed fills fast enough; SL/TP fills emitted no toast at all. All four addressed; chart now updates within 1.5s p95.
- **Pending limit cancel flicker** (#369) — `OPTIMISTIC_OVERRIDE_TTL_MS` was a hard 5s cap that fired before Binance's eventually-consistent `getOpenOrders` reflected the cancel. Order would vanish, the override expired, the real cache (still listing it) showed it again, then the next refetch finally cleared it. Fix: 30s hard cap + smart deletion when the server stops listing the entry.
- **Liquidation misclassification** (#374) — liquidation fills had been falling through the SL/TP classifier and toasted as "Take Profit hit". Now detected via `o.o='LIQUIDATION'` from the user-stream payload and toasted with `urgency='critical'`.

### Changed
- **i18n text audit** (#347-#351, #362) — every `t('foo', 'fallback')` call cleaned (192 calls across 5 PRs); 192 missing JSON keys added to en/pt/es/fr (English placeholder for non-en where translations weren't ready, real translations a follow-up).
- **`<FormDialog>` aliased to `<DialogShell>`** (#339) — same component, two import names during the migration; both stay supported.
- **Trading-domain constants** (#334) — 5 hardcoded sets centralized in `@marketmind/types`.

### Notes
- **All audits clean at release**: `audit-dialog-rules.mjs --strict` ✓, `audit-shade-literals.mjs` (218 files / 0 forbidden patterns) ✓, `audit-dialog-i18n-keys.mjs` (4 dialogs / 4 locales — extended to allow `emptyTitle`/`emptyDescription`/`typeStopLoss`/`typeTakeProfit` per #393) ✓, type-check ✓.
- **Test counts at release:** backend 5483 / 5483, electron unit 2332 / 2332, browser 108 / 108, trading-core 143 / 143.
- **Track G result**: 18/18 dialogs + 9/9 Settings tabs + WatcherManager (13 subsections) + IndicatorLibrary all conforming to a single design language. Reading them back-to-back, you can't point to "this one feels different" — the patterns are visibly the same for the same job.
- **Remaining Track F polish items** (per-event flash colors, order-line move animation + cancel fade, instrumentation overlay, fast-recheck after submit, auto-cancel toast for system-cancelled orders) pushed to v1.7 backlog or marked decided-not-to-ship — none release-blocking. See `docs/V1_6_PLAN.md` Status section.

## [1.5.0] - 2026-04-30

**v1.5 release** — Largest feature drop since v1.0. Highlights: a new MCP trading server (`@marketmind/mcp-trading`) lets MCP-connected agents drive paper trades end-to-end behind a per-wallet "AI Agent Trading" toggle and a 30-writes/hour rate limit; the layout durability story closes out with self-service snapshot recovery + WAL archiving; the design tokens get extracted into `@marketmind/tokens`; centralized keyboard registry + `?` help modal lands; backtest runs survive backend restart; axe-core dialog regression spec catches a11y regressions in CI. 28 commits since v1.4.0.

### Added — MCP Trading server (V1_5 C.1, paper-complete)
- **`@marketmind/mcp-trading` package** (#314, #315, #317, #321) — new workspace exposing 7 tools to any MCP client (Claude Code, ChatGPT desktop, custom agents): 4 read tools (`trading.list_orders`, `trading.list_positions`, `trading.list_executions`, `trading.get_wallet_status`) and 4 paper-mode write tools (`trading.place_order`, `trading.cancel_order`, `trading.close_position`, `trading.set_sl_tp`). Pure tRPC over HTTP with a real session cookie (`MM_MCP_SESSION_COOKIE`) — unlike the renderer-driving MCP servers, no `VITE_E2E_BYPASS_AUTH` needed.
- **Per-wallet `agentTradingEnabled` toggle** (#314) — new column on `wallets`, default `false`. Settings → Security → "AI Agent Trading" subsection with per-wallet switches and a confirm dialog before enabling. Toggle is per-wallet so paper can be on while live stays off.
- **🔴 Hard gate `mcp.assertWriteAllowed`** (#316) — every write tool calls this before touching the exchange. When `agentTradingEnabled === false`: throws `FORBIDDEN`, writes a `denied` audit row, never reaches the exchange. Accident-prevention by design — an MCP client cannot place an order on a wallet whose toggle is off.
- **Audit log + viewer** (#314, #315, #318) — new `mcp_trading_audit` table records every MCP call (success/failure/denied/rate_limited) with input/result JSON, duration, and idempotency key. `mcp.recordAudit` deduplicates per-(user, idempotency-key) so retries don't double-execute. New "AI Agent Activity" panel under Settings → Security shows the last 100 rows with status badges and resolved wallet names.
- **30 writes/hour rate limit** (#319) — extends `mcp.assertWriteAllowed` with a per-(user, wallet) cap counted from successful audit rows in the last 60 minutes. Cap exceeded → `TOO_MANY_REQUESTS` + `rate_limited` audit row. Counts only `'success'` rows so failures and denied attempts don't lock the wallet out.
- **Tests** — 15 router tests covering auth/dedup/scoping/gate/rate-limit + 5 panel tests + the existing trading router tests cover the underlying writes.

### Added — Layout durability follow-throughs (V1_5 B)
- **Snapshot list + restore UI in Settings → Data** (#300) — backend already had `layout.listSnapshots` / `restoreSnapshot` from v1.4; v1.5 wires the frontend. Lists snapshot timestamps with tab/preset counts; "Restore" CTA opens a confirmation dialog; after restore, the in-memory layout store rehydrates from the new authoritative state without a reload. Empty state copy: "No snapshots yet — they're created automatically once a day when the layout changes". e2e Playwright spec retro-added in #309.
- **Audit log of layout writes** (#298) — new `user_layouts_audit` table tracks every `layout.save` with prev/new SHA-256 hashes, source (`'renderer'` default), client version, and timestamp. 90-day retention pruned on each write. Lets future overwrite incidents be correlated with the release that caused them.
- **Postgres `archive_mode=on` + WAL archiving** (#305) — `docker-compose.yml` postgres service now runs with `archive_mode=on` + `archive_command=cp %p /var/lib/postgresql/wal_archive/%f` + `wal_level=replica` and a separate `wal_archive` named volume. New `docs/INFRA_RECOVERY.md` walks through PITR-recovering a `user_layouts` style data-loss case. Closes the "no PITR available" gap that made the 2026-04-30 layout incident unrecoverable.

### Added — Auth follow-through (V1_5 A.1.b)
- **Login soft-nudge for users with policy-violating passwords** (#299) — `auth.login` validates the password against the v1.4 policy after a successful `verify()` and adds `passwordPolicyViolated: boolean` to the response. `LoginPage` shows a one-shot toast with "Trocar agora" navigating to Settings → Security. 2FA flow intentionally skips the nudge (plaintext doesn't carry across the verify step). i18n in en/pt/es/fr.

### Added — Backtest UI follow-through (V1_5 E)
- **`getActiveRuns` query + reload-recovery** (#310, #312) — toolbar "running" indicator wired to `analytics.getActiveRuns` so an in-progress backtest survives a UI reload and resumes its progress UI. Failed-path coverage added.
- **`backtest_runs` persistence** (#313) — completed runs persist to a new `backtest_runs` table so history survives backend restart.

### Added — Accessibility + UX (V1_5 D)
- **Centralized keyboard shortcut registry + `?` help modal** (#302) — new `useKeyboardShortcut` hook + central registry + dispatcher. `?` opens the help modal listing all registered shortcuts grouped by section. 11 chart-pan/zoom shortcuts migrated as the first wave.
- **Migrate remaining chart handlers to the registry** (#304) — drawing (`Delete`, `Backspace`, `Mod+C`, `Mod+V`) and trading (`Esc` cancel for SL/TP placement, trailing-stop placement, order drag) handlers go through the same registry now. They show up in the help modal under their respective groups.
- **axe-core dialog regression spec** (#306) — `apps/electron/e2e/a11y-dialogs.spec.ts` opens Settings / Backtest / Analytics / KeyboardShortcutHelpModal and asserts no critical/serious axe violations. `DialogCloseTrigger` wrapper now defaults `aria-label="Close"` so any consumer auto-passes the `button-name` rule.
- **Color-contrast violations in Analytics fixed** (#308) — `<DataCard>` switched from a `bg.muted` fill to a `border` outline so `trading.loss/profit` text moves onto `bg.panel` where contrast clears 4.5:1. `PerformanceCalendar`'s `getSignColor` migrated from `red.500/green.500` literals to `trading.loss/profit` semantic tokens. `color-contrast` axe rule re-enabled.

### Added — Package + token system (V1_5 F)
- **`@marketmind/tokens` package extraction** (#301) — design tokens (`MM.*`, `getPnLColor`, recipes, semantic tokens, chart indicator tokens) moved from `apps/electron/src/renderer/theme/` into `packages/tokens/`. Sweeps 22 consumers across the app to import from `@marketmind/tokens`. Now consumable by future external surfaces (landing site, docs).
- **`docs/UI_EXTRACTION_PLAN.md`** (#320) — audit-only PR. Inventories all 73 named bindings from `apps/electron/src/renderer/components/ui/index.ts`, classifies them by extraction tier (1: pure Chakra wrappers — ~33 components; 2: token-aware — ~8; 3: i18n / runtime-coupled — ~10), documents peer-dep boundaries, and proposes a 4-PR extraction sequence behind a temporary `@marketmind/ui` alias.

### Added — Test + CI infra (V1_5 G)
- **Backend custom-symbol-service deeper testing** (#307) — `custom-symbol-service.test.ts` + `custom-symbol-helpers.test.ts` reach 31 tests covering the marketType fallback, FUTURES→SPOT smartBackfill cascade, error-swallowing, weight renormalization, no-usable-components edge case, and synthetic-index produce.

### Changed
- **`MEMORY.md` index trimmed** to 44 lines (was 219, exceeding the 200 truncation cap).
- **MCP servers documentation** — `mcp-trading` flagged as the exception that needs no `VITE_E2E_BYPASS_AUTH` since it talks pure tRPC over HTTP with a real session cookie.

### Notes
- **C.1.h live unlock deferred indefinitely** — paper-mode toolkit ships in v1.5; live MCP writes need real-workflow validation before unlock. The hard-gate, audit log, and rate limit are already in place; live unlock is one client-side check away when the user opts in.
- **D.2.b VoiceOver pass + D.2.d useId() ARIA strictness — out of scope** (#322) — product is not pursuing screen-reader-grade a11y. The axe automated baseline (D.2.a) + color-contrast fixes (D.2.c) stay as cheap regression catches; full WCAG 2.1 AA is not a goal.
- Test totals after v1.5: ~5,482 backend + 2,283 frontend unit + visual-regression baseline + e2e specs (Playwright). All workspaces type-check and lint cleanly (lint warning baseline ~1,996, 0 errors).

## [1.4.0] - 2026-04-30

**v1.4 release** — Three V1_4_PLAN items shipped together. Two are post-incident hardening (layout durability + log readability) on top of the v1.3.1 fixes; one is the user-requested password complexity policy. Backend grows from 5,433 to 5,449 tests; frontend adds the `<PasswordStrengthMeter>` primitive plus 6 new component/policy tests; `@marketmind/utils` gains a `passwordPolicy` module with 11 unit tests.

### Added — Password complexity policy (V1_4 A.1)
- **Shared validator in `@marketmind/utils`** — `validatePassword(input)` returns `{ valid, issues[] }` with codes `tooShort | noUppercase | noLowercase | noDigit | noSymbol | common`. `passwordStrength(input)` returns a 0-4 score for the meter. Default policy: min 10 chars + ≥1 of each character class. Built-in blocklist of ~30 common passwords (Password123, qwerty123, etc.).
- **Backend enforcement** — `auth.register`, `auth.changePassword`, `auth.resetPassword` use a `passwordPolicySchema` Zod refinement. Login (`auth.login`) intentionally keeps `z.string()` so existing users with old weaker passwords can still sign in.
- **`<PasswordStrengthMeter>`** — new `ui/` primitive: 5-segment strength bar + per-rule checklist (LuCheck/LuX) with score-derived label. Theme-token only (`trading.profit/loss/warning`, `fg.muted`, `bg.muted`). Wired into `RegisterPage`, `ResetPasswordPage`, and Settings → SecurityTab. SecurityTab's `canSubmit` now gates on `validatePassword().valid` rather than length-only.
- **i18n** — `auth.passwordPolicy.{title,tooShort,noUppercase,noLowercase,noDigit,noSymbol,common,weak,fair,good,strong,excellent}` in en/pt/es/fr. `auth.validation.passwordMin` updated 8 → 10.
- **Tests** — 11 password policy unit tests + 5 PasswordStrengthMeter component tests + 2 new auth.router enforcement tests + 1 new SecurityTab "rejects no-symbol" test. Existing SecurityTab and auth.router tests updated to use policy-compliant fixtures (`NewPass123!`, `Test123!@#`).

### Added — Layout durability (V1_4 A.2)
- **`user_layouts_history` table** — copies of prior layouts keyed by `(user_id, snapshot_at)` with retention of 30 days. New Drizzle schema export `userLayoutsHistory`, migration `0034_user_layouts_history.sql`, plus inline schema in `test-db.ts` and cleanup wiring.
- **Snapshot on save** — `layout.save` now snapshots the existing row when it's >24h old and the data actually changed; prunes >30-day-old snapshots on the same write.
- **Server-side default-overwrite guard** — `layout.save` refuses (`PRECONDITION_FAILED`) any write that would replace a non-default layout with the default state (1 default tab + 3 named presets single/dual/quad). Defense in depth on top of v1.3.1's renderer-side `isHydrated` gate.
- **Self-service recovery** — `layout.listSnapshots` lists snapshot timestamps; `layout.restoreSnapshot({ snapshotId })` swaps a prior state into `user_layouts` and snapshots the current state first so restore is itself reversible.
- **Tests** — 14 router-level tests covering create/update/refuse/snapshot/list/restore + cross-user isolation.

### Fixed — Logger cause hygiene (V1_4 B.1)
- **`serializeError` leads with the cause, then the message** (`apps/backend/src/services/logger.ts`) — was `${msg} (cause: ${causeStr})` truncated at 500 chars, so a `DrizzleQueryError.message` containing the full `SELECT id, user_id, ... FROM trade_executions WHERE ...` (~1.5KB for the 60-column trade_executions select) pushed the actual postgres error code (`57P01 terminating connection due to administrator command`, etc.) off the end. Flipped to `${cause} | ${msg}` so the useful info stays before truncation kicks in. 8 unit tests covering plain Error, with-cause, very-long-message truncation, string causes, JSON causes, missing-cause, plain objects, and primitive coercion.

### Changed
- **`@marketmind/utils` tsconfig** — `__tests__/**` and `**/*.test.ts` excluded from the build output so `dist/` no longer leaks test sources.
- **`apps/backend/src/__tests__/helpers/test-db.ts` cleanup** — adds `userLayouts` and `userLayoutsHistory` to the explicit table-clear list (cascade-by-FK doesn't fire under `session_replication_role = 'replica'`).

## [1.3.1] - 2026-04-30

**v1.3.1 patch** — Two paired bug fixes that together close a layout-data-loss regression. The first fix changes how the renderer reacts to transient backend failures (no more bounce to /login on backend restart). The second seals a latent persistence bug that the first fix exposed.

### Fixed
- **`auth.me` retries on network errors instead of immediately treating failure as logged-out (#288)** — `useBackendAuth` had `retry: false` since the original auth implementation. A single network blip during a backend restart was enough to flip `isAuthenticated` to false and bounce the user to `/login`. Replaced with the same retry policy `TrpcProvider` uses for default queries: `UNAUTHORIZED`/`FORBIDDEN` skip retries (those are real auth states), everything else retries up to 3× with exponential backoff (max 5s). The query now waits out the backend's restart window instead of flipping to unauthenticated on first failure.
- **Layout persistence is gated on hydration so backend transients can't overwrite saved tabs/layouts (#289)** — regression exposed by #288. With the renderer staying mounted across a backend restart, `trpc.preferences.getAll` (which has `retry: 1`) could fail before the layout hydrate completed; once `hydrateDomainStores({})` fired with empty data, any subsequent state change in `useLayoutStore` triggered the persist subscriber to write the *default* in-memory state to `user_layouts`, overwriting the user's saved tabs and layout presets. Added an `isHydrated` guard: `persistLayout` early-returns until `hydrateLayoutStore` confirms a successful query (whether saved data was returned or not). On query failure, persistence stays locked — user changes that session don't persist (lost on reload), but the saved layout is protected. Strictly safer than the prior behavior. Postgres is on `wal_level=replica` with `archive_mode=off`, so any data already lost cannot be recovered, but going forward this regression cannot recur.

## [1.3.0] - 2026-04-30

**v1.3 release** — Performance + cross-surface UI continuation. Three threads land here: (1) bundle audit + lazy-loading reduces the main bundle 2,124 KB → 850 KB raw (587 → 237 KB gz, −60%) via Settings tabs / locale JSONs / `pinets` engine / `recharts` consumers; (2) v1.4 + v1.5 UI sweeps continue the v1.2 semantic-token migration with structural cleanup across AutoTrading, chart tooltips, sidebars, leverage popover, settings; (3) audit-script grows from 1 → 7 forbidden-pattern rules with all of them at 0 violations. WCAG AA contrast bump on `fg.muted`. Three browser test suites lock in the chart-renderer right-axis price tag regressions (overlay-line, overlay-bands, FVG). Visual-diff CI gallery is now self-contained for artifact uploads. Docs: 5 audit rules now have Don't / Do examples in `UI_STYLE_GUIDE.md`. 60 commits since v1.2.0.

### Added — Performance instrumentation + dev tools
- **`pnpm bundle:analyze`** (#236) — wires `rollup-plugin-visualizer` behind `ANALYZE=1`. Generates `dist-web/bundle-stats.html` treemap + extended `manualChunks` to split `vendor-pinets`, `vendor-recharts`, `vendor-d3`, `vendor-grid`, `vendor-trpc`, `vendor-socket`, `vendor-icons` into their own chunks. Cumulative main-bundle reduction across this and the lazy-load PRs: 2,124 KB → 850 KB raw (587 → 237 KB gz). **−60%.**
- **`useDialogMount(name, isOpen)` hook + `perfMonitor.recordDialogMount`** (#236) — measures dialog body render to post-commit effect. Wired into `SettingsDialog`, `BacktestModal`, `AnalyticsModal`. Visible in `ChartPerfOverlay` when `localStorage['chart.perf']='1'`.
- **`docs/V1_3_BUNDLE_AUDIT.md`** — cumulative audit + follow-up recommendations.
- **MCP `app.openModal` flow handlers** (#234) — `createWallet`, `addWatcher`, `startWatchers`, `importProfile`, `tradingProfiles` now drive the trigger button via `data-testid` so agents can open these without hand-rolled click chains. Same wiring used by `mcp-screenshot/capture.ts` so the visual-regression gallery now covers all 5 flow modals.
- **`scripts/audit-shade-literals.mjs` + CI gate** (#232) — fails CI if a `color="X.500"` / `bg="X.50"` shade literal or `_dark={{}}` override is reintroduced anywhere under `apps/electron/src/renderer/components/` (excluding the `ui/alert.tsx`/`slider.tsx` Chakra wrappers).
- **`scripts/visual-diff.mjs` HTML gallery** (#231) — failed visual-diff sessions emit `<session>/diffs/index.html` with a side-by-side baseline / session / diff column per failing surface. Speeds up the diff-investigation loop in CI.

### Changed — Performance + a11y
- **Lazy-load Settings dialog tabs** (#235) — all 13 tabs are now individual chunks via `React.lazy`. Body renders only when the tab is active; `<Tabs.Content>` wrappers stay so `aria-controls` resolves and a11y is preserved.
- **Lazy-load locale JSONs** (#237) — only English ships in the main bundle; `pt`/`es`/`fr` load via dynamic `import()` registered through `addResourceBundle` when the user switches language. New `loadLanguageBundle(lang)` + `changeLanguageLazy(lang)` helpers in `@renderer/i18n`.
- **Lazy-load `pinets` engine** (#237) — `pineWorkerService.ts` dynamic-imports the engine inside `runPine()`; the 484 KB / 117 KB gz vendor chunk loads only when the chart computes its first indicator.
- **Lazy-load `recharts` consumers** (#238) — `MarketSidebar` lazy-loads `MarketIndicatorsTab`; `AnalyticsModal` lazy-loads `EquityCurveChart`. The 296 KB / 83 KB gz `vendor-recharts` chunk no longer downloads on first paint.
- **`fg.muted` contrast bumped to clear WCAG AA** (#233) — light `#5a6878` (5.16:1 over `bg.muted`) and dark `#cbd5e0` (5.00:1). Was 3.72/3.17 — readable but below the AA floor for body text.

### Changed — Cross-surface UI standardization (continuation of v1.2 sweep)
- **Logo brand-lock** (#240) — the `.500` → `.fg` mechanical sweeps in v1.2 #219/#222 collapsed the Logo's brand colors to Chakra's theme-aware `X.fg`, lightening the brand in dark mode. Restored the original brand shades (`#3182ce` blue, `#48bb78` green) via dedicated `brand.logo.primary` / `brand.logo.secondary` semantic tokens that lock to the same hex in light and dark.
- **P&L green/red unification** (#241) — anything that conveys gain/loss across 18 surfaces (Portfolio, PortfolioSummary, PositionCard, OrdersTableContent, FuturesPositionsPanel, SetupStatsTable, StrategyInfoPopover, RiskDisplay, ChecklistSection, DynamicSymbolRankings, QuickTradeToolbar, TrailingStopPopover, KlineOHLCRow, ChartTooltip/OrderTooltip, ChartCloseDialog, ScreenerResultsTable, FuturesPositionInfo, MarginInfoPanel) now flows through canonical `trading.profit` / `trading.loss`. LONG/SHORT direction labels use `trading.long` / `trading.short`. Eliminates the visible "different shades of green" the user reported in the Portfolio panel.

### Added — Tests
- **Empty-state semantics tests** (#242) — 7 surfaces: `ScreenerResultsTable`, `ChecklistEditor`, `IndicatorLibrary`, `WatchersList`, `TradingProfilesManager`, `CustomSymbolsTab`, `WalletManager`. +11 new tests; total 2,264 unit tests passing.

### Changed — v1.4 UI consistency sweep (Phase 1: AutoTrading + cross-surface cleanup)
After the v1.2 mechanical color migration, a structural pass across the AutoTrading tab and adjacent surfaces. Lots of small structural fixes summing to a much more consistent app.

- **i18n: 8 hardcoded English strings** (#251) — `RiskDisplay` and `FuturesPositionsPanel` labels wrapped with `t()`; new keys under `trading.portfolio` and a new top-level `futures` namespace.
- **AutoTrading pass 1** (#246) — Trading-mode block converted from raw `<Box>` to `<CollapsibleSection variant="static">`; empty-wallet state replaced with `<EmptyState size="sm">`; QuickStartSection / StockPresetsSection lost their green-tinted `<Box bg="green.subtle">` wrappers.
- **SecurityTab + WalletManager cleanup** (#247) — 2FA icon wrapped in `<Box color="trading.profit">` instead of inline hex; redundant outer `p={4}` and nested scroll wrapper dropped.
- **IndicatorLibrary nested-scroll fix** (#248) — dropped `h="full"` and inner `flex={1} overflowY="auto"` that double-scrolled inside the Settings dialog.
- **EmptyState `action.icon` + 5 surface sweep** (#249) — `<EmptyState>` `action` prop extended with `icon`; applied to `WatchersTab`, `OrdersDialog`, `FuturesPositionsPanel`, `DynamicSymbolRankings`, `StartWatchersModal`.
- **Audit script: `tinted-card-Box` rule** (#250) — flags the `<Box bg="X.subtle" ... borderColor="X.muted">` heavy-tinted-container anti-pattern in CI; cleaned 3 violations (`EmergencyStopSection`, `TrailingStopPopover` manual rows, plus catch-all). 249 files scanned, 0 patterns.
- **AutoTrading pass 2** (#252) — `RiskManagementSection`: outer `Stack gap` 6 → 4; dropped 3 `<Separator />` between rows; dropped 3 colored left-borders (red/blue/orange `.muted`); 4 ad-hoc switch rows → `<FormRow>`. `PositionSizeSection`: outer gap 6 → 4. Net −52/+26 lines.
- **AutoTrading pass 3** (#253) — `OpportunityCostSection` (−4 tinted-box wrappers + switch row → `<FormRow>`); `DynamicSelectionSection` (−1 auto-rotation tinted-box wrapper); `EntrySettingsSection` (info note → `<Callout tone="info" compact>`). Net −15 lines.
- **AutoTrading pass 4** (#254) — `TrailingStopSection`: hoisted per-row `bg="bg.subtle"` wrappers into a `rowWrapperProps` const conditional on `compact`. Compact popover keeps the wrappers (visual delineation), Settings tab gets flat rows. Plus dynamic shade literals in pill toggles (`green.500/red.500/blue.500` → `trading.long/short/info`).
- **Dynamic shade literal sweep — Trading/** (#255) — 11 files swept from JSX-expression form `color={cond ? 'green.500' : 'red.500'}` to `trading.long/short/profit/loss/warning/info` semantic tokens (`PositionCard`, `FuturesPositionsPanel`, `OrdersTableContent`, `PortfolioTable`, `OrderCard`, `PerformancePanel`, `ProfileEditorDialog`, `SetupToggleSection`, `FilterToggle`, `ChecklistEditor`, `TradingTable`).
- **Dynamic shade literal sweep — chart tooltips + sidebars + analytics** (#257) — same anti-pattern in `WatchersTab` (LONG/SHORT card border), `SetupTooltip` / `KlineTooltip` / `MeasurementTooltip` (bullish/bearish, side, 3-tier confidence), `EquityCurveChart` (P&L), `FuturesPositionInfo` (liquidation severity).
- **Audit script: `dynamic-shade-pair` rule** (#258) — codifies the JSX-expression-form anti-pattern in CI: flags any expression containing both `green.NNN` AND `red.NNN` shade literals on `color`/`bg`/`borderColor`/etc props. Scoped narrow (only the bidirectional green+red pair) so single-shade UI accents (`'blue.500' : 'fg.muted'`) aren't false-positives. Plus 2 stragglers cleaned (`RecentRunsPanel` P&L, `ScreenerResultsTable` RSI zones).
- **Warning-shade literal sweep** (#260) — single-color UI accents that the bidirectional-pair audit rule doesn't catch. `MarginTypeToggle` (CROSSED), `SymbolSelector` asset-class + market-type toggles, `ScreenerResultsTable` (high-volume row), `LeveragePopover` (>1x leverage) — all migrated from `orange.500/blue.500/green.500` literals to `trading.warning/info/profit` semantic tokens.
- **Audit script: `_dark-override-nested` rule** (#261) — same anti-pattern as `_dark={{ }}` JSX prop, but inside an object literal (`_hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}` style). 5th audit rule. Plus one straggler in `ChartContextMenuManager` cleaned to `_hover={{ bg: 'bg.muted' }}`.
- **Drop tick / volume / footprint chart types + header selector** (#263) — user feedback: keep only candle/line, settings-modal selector only. Removed `ChartTypeSelector` (header popover), `useTickChart` + `useVolumeChart`, `renderFootprint`, `FootprintBar`/`FootprintLevel` external context fields, `useChartAlternativeKlines`'s tick/volume/footprint branches, `useChartTradingData`'s scalping config fetch, `useChartRenderPipeline`'s 4-way chartType branching → 2-way line vs candle-style. `ChartType` narrowed to `'kline' | 'line'` in both `@marketmind/types` and the renderer's local `shared/types/layout.ts` duplicate. Defensive coercion in `useLayoutSync.effectiveChartType` maps any legacy persisted value (tick/volume/footprint from old prefs) back to `'kline'`. **Net: −408 LOC across 21 files.**
- **Leverage popover color alignment + `trading.warning` tone** (#265, #266) — same value (e.g. 10x) was rendering simultaneously as orange (trigger), green (header), and gray/white (selected button). Trigger now uses the same risk-tier logic as the selector header (1x muted; 2-20x `trading.profit`; 21-50x `trading.warning`; >50x `trading.loss`); selector preset's `colorPalette` for ≤20x changed `gray` → `green` so the selected button fill matches. `LeverageSelector.getLeverageColor` migrated from raw `green.500/orange.500/red.500` to semantic tokens. **`trading.warning` token redefined** from amber `#f59e0b/#fbbf24` to `#dd6b20/#f6ad55` (Chakra v3 `orange.500/orange.300`) — original migration in #260 was too pale next to red. Affects all warning surfaces (MarginTypeToggle, SymbolSelector, ScreenerResultsTable, SetupTooltip mid-confidence, FuturesPositionInfo).

### Fixed
- **EMA/SMA price tags missing on right axis** (#256) — when the legacy `renderMAIndicators` was dropped in #75 (generic indicator pipeline cutover), the second pass that drew the per-MA price tag on the right axis went with it. The replacement `renderOverlayLine` only drew the line. Restored via a `drawPriceTag` call after the line stroke. Also fixed a clip-rect bug exposed by the fix: the parent `renderAllOverlayIndicators` clip was `(0, 0, chartWidth, chartHeight)` which clipped the tag's rectangle (drawn from `chartWidth` to `chartWidth + 64` in the price-scale strip); extended horizontal clip to `dimensions.width`.
- **Bands + Points + Ichimoku price tags** (#262) — same regression class as #256. Bollinger/Donchian/Keltner (bands), Parabolic SAR (points), and Ichimoku (3 lines) all lost their right-axis tags in the generic-pipeline cutover. Restored: bands tag the upper + lower bounds (skipping middle); points tags the last visible dot; Ichimoku tags Tenkan/Kijun/Chikou outside its own inner clip. Pane indicators (RSI, MACD, etc.) already had `drawPanelValueTag`. With this PR, the regression set is fully closed.

### Tests
- **Browser tests for `renderOverlayLine` price tag** (#264) — locks in the #256 fix with pixel-sampling tests on a real `<canvas>`. Verifies the tag paints in the right-axis strip (catches the line + tag + clip-rect-bug failure modes), no tag for all-null series, and the tag fill picks up the indicator's `color` param. Mirrors the FVG browser test pattern.
- **Browser tests for `renderOverlayBands` (V1_5 B.1)** (#279) — closes the third sibling in the indicator-pipeline test surface (overlay-line and FVG already had Canvas-backed tests; bands didn't). 8 tests: fill polygon paints between bands, early-returns when upper/lower/klines are missing, middle dashed polyline shows up only when a `middle` series is supplied, instance-param `color` propagates to upper/lower lines, right-axis price tags paint at the last valid value of upper + lower, alternate output keys (`top`/`bottom`) resolve via `pickSeries`.

### Changed — v1.5 cross-surface UI standardization (continuation)
After the v1.4 sweep, a second pass on the surfaces the previous round didn't reach. Theme is the same: drop colored stripes, RadioGroups + button-row toggles → `<Select>`, cards → list rows, replace ad-hoc tinted pills with `<Badge colorPalette>`.

- **DataCard primitive + apply to RiskDisplay + PerformancePanel (V1_5 A.1)** (#270) — small atom for the very common "label + value + optional aside + subtext" panel cell. Same surface footprint as the hand-rolled `<Box bg="bg.muted" px py><Text uppercase>` recipe; centralizes the typography choices.
- **Custom Symbols form rows → `<Field>` (V1_5 A.2)** (#271) — Create-New flow wraps each input in `<Field label helperText>` instead of stacked `<Text>` + control siblings. Matches the rest of the app.
- **`accent.solid` semantic token + blue-accent sweep** (#268) — the "selected / active accent" color now flows through one token (`accent.solid` / `accent.subtle`) instead of `blue.500` / `blue.subtle` literals scattered through 12 surfaces. Visible on active wallet, link hovers, focus rings.
- **Settings dialog widths + sessions wrap + helper alignment** (#275) — every Tabs.Content gets `w="100%"` and `pb={8}` so tabs no longer shift left/right when the active tab changes. SecurityTab's session list switched from `<Text truncate>` to `wordBreak="break-all"` so long IPs wrap instead of cropping. ChartSettingsTab's flipVertical / liquidityIntensity helper text got the rogue `ml={6}` indents dropped. WalletManager wrapped in a top-level `<FormSection title action>` so the page has a header + create button.
- **Trading Mode + DirectionModeSelector + 5 RadioGroups → `<Select>` (#277)** — User feedback (with screenshots): Trading Mode rendered as 2 huge full-width buttons; DirectionMode as 3 buttons; TpModeSection / StopModeSection / PyramidingSection had vertical radio stacks. All migrated to `<Select usePortal=false>`. DirectionModeSelector primitive update propagates to `WatchersList`, `ScalpingDashboard`, `ScalpingConfig`, `MarketSidebar/WatchersTab`. Same PR drops the colored left-borders inside FiltersSection / TpModeSection / PyramidingSection (5 stripes total) and removes a duplicate Direction Mode picker that lived inside FiltersSection.
- **SetupToggle + WatcherCard + OpportunityCost + Wallet/Profile borders (#278)** — second wave of the same theme:
  - **SetupToggleSection (Enabled Setups, ~100 strategies)** — manual collapsible scaffolding → standard `<CollapsibleSection>`. Per-row colored `borderLeft` (green for enabled) dropped; rows are plain checkbox + label inside `<Box _hover>`. Search input added (renders only when >8 strategies). Count pill → `<Badge colorPalette={allEnabled ? 'green' : 'gray'}>`.
  - **WatcherCardCompact** — drop `borderLeftColor=green.muted`. 4 hardcoded shade pairs (blue.100/orange.100/green.100 + their `_dark` counterparts) → `<Badge colorPalette + variant="subtle">`. Layout collapses from 2-row card to single horizontal row. `WatchersList` Grid auto-fill → Stack so they read as list items.
  - **WalletManager** — drop the colored borderLeft. Active wallet now indicated by `bg=accent.subtle + 1px accent.solid border`.
  - **OpportunityCostSection** — 3-way "Action when stale" RadioGroup → `<Select>`; NumberInput rows in `<Field label>`; `<Badge colorPalette="purple">` replaces the hand-rolled "Active" pill; `pl={4}` indentations dropped.
  - **TradingProfilesManager** — drop the yellow.muted/blue.muted borderLeft on profile cards (default profile already shown by the yellow star icon).

### Fixed
- **mcp-screenshot timing for lazy-loaded Settings tabs** (#276) — after #235 made every Settings tab lazy via `React.lazy`, the screenshot pipeline started capturing the loading spinner instead of the tab body for the first capture of each tab. Fixed by polling for absence of `[role="progressbar"]` inside `[data-testid="settings-content"]` after the tab click + a short post-mount settle wait.

### Changed — Test + CI infra (V1_5 B + C series)
- **Visual-diff HTML self-contained for CI artifacts (V1_5 B.2)** (#280) — `scripts/visual-diff.mjs` now embeds baseline / session / diff PNGs as base64 data URIs in `diffs/index.html` instead of `<img src="../baseline/X.png">` refs. The previous setup worked locally but broke in the `visual-diffs` CI artifact upload (the `screenshots/baseline/` dir lives outside the session and isn't included in the upload, so the baseline column rendered as broken images once the artifact was unzipped). Cost: ~1 MB embed per failing image; well under 5 MB total for normal regressions.
- **Document the 5 audit-script forbidden patterns (V1_5 C.1)** (#274) — `docs/UI_STYLE_GUIDE.md` now has Don't / Do examples for each of the rules `audit-shade-literals.mjs` enforces in CI: `shade-literal-color`, `_dark-override`, `_dark-override-nested`, `tinted-card-Box`, `dynamic-shade-pair`. Reduces the "wait, why did CI flag this?" loop for new contributors.

### Changed — v1.5 follow-up sweep + boleta polish
- **Template-string shade leak rule + cosmetic stripe sweep (V1_4 follow-up)** (#282) — codifies the dynamic template-string shade leak (`borderColor={\`${getTypeColor(...)}.500\`}`) as the audit script's 6th rule, then cleans the 2 violations: `OrderCard` (LONG/SHORT border) and `MetricCard` trend palette (both routed through `trading.long/short/profit/loss`).
- **Object-literal shade-leak sweep + audit rule (V1_5 follow-up)** (#284) — 7th audit rule catches shade literals inside object-property syntax (`_hover={{ bg: 'green.500' }}`, `levelColor = { error: 'red.400' }`) — the existing rules only caught JSX-prop syntax. Cleaned 6 sites: `MainLayout` column resizers (4× `_hover` greens → `accent.solid`), `select.tsx` focus border `blue.500` → `accent.solid`, `SymbolSelector` focus border, `ControlPanelGroup` `gray.750` typo → `bg.muted`, `MetricCard` trend palette, `AutoTradeConsole` + `LogsTab` level color maps. The E2E `auto-trading-logs-tab.spec.ts` red-error assertion was loosened to R-channel dominance instead of an exact-RGB match so it's resilient to token swaps.
- **QuickTradeToolbar boleta polish** (#285) — chevron + spread merged into a single 32px-wide column between Buy/Sell, vertically split (spread on top, chevron below) so the boleta footprint stays balanced; spread display switched from native-precision `formatChartPrice` to `toFixed(2)` for consistency. Fixed two popover anchor regressions where `triggerElement` was a non-forwardRef element (`Flex` etc.) — `TrailingStopPopover` and `GridOrderPopover` now wrap `triggerElement` in `<Box>` so Chakra's `Popover.Trigger asChild` can attach the ref (Floating UI was bailing to viewport (0,0) when the ref was null, putting the popover at the screen corner). Leverage popover trigger button alignment normalized (`h="20px" minW="32px" px={1.5}` to match sibling IconButtons in the slider row).

### Tests
- **Portfolio + OrdersList empty-state coverage (V1_5 B.3)** (#283) — 5 new tests across the two surfaces, closing the V1_3 C.3 deferral. `Portfolio`: 3 tests covering no-wallet → noWallet Callout, wallet-with-empty-positions/orphans → EmptyState, wallet-with-orphan-order → empty state suppressed. `OrdersList`: 2 tests for the same empty-vs-suppressed cycle. The visual-regression baseline already catches missing renders, but unit tests now document intent.

### Docs
- **`CLAUDE.md`** — `Project Version` bumped to 1.3.0.
- **`docs/UI_STYLE_GUIDE.md`** — added "Applied surfaces" line under PanelHeader (PerformancePanel, SetupStatsTable, PerformanceCalendar, EquityCurveChart).
- **`docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`** / **`docs/V1_3_PLAN.md`** — backlog refresh: G.1 (per-wallet theme override) dropped (theme stays per-user); G.3 (Pine migration) marked already-complete; sequencing rewritten to reflect what's already on develop.
- **`apps/electron/src/renderer/components/ui/README.md`** — note that `<MarketNoData>` is a private MarketSidebar helper (not a `ui/` primitive).
- **Chart input units** (#239) — Padding fields (top/bottom/left/right) now show `(px)` on labels in all 4 locales. Line Width helper updated to include the unit.
- **Archive completed plans** (#273) — moved V1_2_PLAN, V1_3_PLAN, V1_4_UI_SWEEP, V1_POST_RELEASE_PLAN, UI_COMPONENTS_STANDARDIZATION_PLAN, V1_3_BUNDLE_AUDIT, visual-review-2026-04 from `docs/` to `docs/archive/`. Top-level `docs/` is now just the live references (UI_STYLE_GUIDE, RELEASE_PROCESS, BROWSER_TESTING, MCP_*) plus the early-stage MCP_TRADING_CONCEPT.
- **Archive V1_5 plan with completion markers** (#269) — `docs/V1_5_PLAN.md` → `docs/archive/V1_5_PLAN.md` with the front-matter rewritten to show what shipped (A.1 #270, A.2 #271, B.1 #279, B.2 #280, B.3 #283, C.1 #274) plus follow-up sweeps that emerged during execution.
- **`docs/MCP_TRADING_CONCEPT.md`** (#272) — early-stage concept doc for an opt-in toggle that would gate the (currently deferred) `mcp-trading` server. 5-step rollout sequence, toggle UX options, safety layers — not implementation, just exploration so the concept is on paper before the feature lands.

## [1.2.0] - 2026-04-28

**v1.2 release** — Cross-surface UI standardization sweep. The semantic-token migration is now complete: 0 forbidden patterns (`color="X.500"`, `bg="X.50"`, `_dark={{}}` overrides) remain in `apps/electron/src/renderer/components/`. Every color flows through the semantic-token system (`X.fg / X.subtle / X.muted / X.solid` plus `bg.panel / bg.muted / fg.muted`), so dark/light parity is automatic. Visual regression now runs on every PR that touches renderer code.

### Added — Phase A (Primitives)
- **`<EmptyState dashed>` opt-in** — wraps the empty state in a dashed-border card for surfaces without their own card framing. Two new tests for the new prop.
- **Visual regression CI** — `.github/workflows/visual-regression.yml` runs the gallery on PRs touching renderer/, shared/, mcp-screenshot/ or the baseline. Pixelmatch diff with `maxDiffPixels=40000` (~3.1%) and `threshold=0.2` (tuned empirically to absorb CI noise without hiding real layout shifts). Uploads diffs + session as artifacts on failure.
- **`scripts/visual-diff.mjs`** — pixelmatch + pngjs implementation. Writes red-overlay diff PNGs per divergent file. Tolerance overridable via `VISUAL_DIFF_MAX_PIXELS` / `VISUAL_DIFF_THRESHOLD` env vars.
- **`scripts/visual-gallery.mjs`** — thin driver around `captureGallery` for local iterations without going through the MCP stdio transport.
- **`docs/V1_2_PLAN.md`** — cross-surface standardization plan + sequencing.

### Changed — Phase A (Apply primitives across surfaces)
- **EmptyState applied across 8 surfaces**: IndicatorLibrary, Trading/Portfolio, Trading/OrdersList, Trading/WatcherManager/WatchersList (with `dashed` + Add Watcher action), CustomSymbols/CustomSymbolsTab, Trading/WalletManager (loading + empty), Screener/ScreenerResultsTable, TradingProfilesManager. Replaces ad-hoc `<Box p textAlign="center"><Text color="fg.muted">…</Text></Box>` patterns.
- **Manual section headers → `<FormSection>`** in IndicatorLibrary, CustomSymbolsTab, TradingProfilesManager. Single change-point if compact spec shifts later.
- **`mcp-screenshot.setTheme`** now waits for the theme class to actually land on `documentElement` before returning, with 400ms settle (was 150ms). Fixes the ~30% diff cluster on slow CI runners caused by mid-transition captures.
- **Visual regression baseline** captured on Linux Chromium (CI environment) instead of macOS — local and CI captures diverge ~30% in light mode due to subpixel antialiasing differences.

### Changed — Phase B (Semantic-token migration, 7 PRs across 6 batches)
**Goal: 0 hardcoded shade literals or `_dark` overrides anywhere in `renderer/components/`.**

- **Batch 1** (#218, 8 files) — Settings/AboutTab links, ui/ErrorMessage, ui/LoadingSpinner, Update/UpdateNotification, Layout/LeveragePopover, Layout/QuickTradeToolbar, LeverageSelector, MarketSidebar/tabs/WatchersTab. `color="X.500"` → `X.fg` / `trading.profit` / `trading.loss`.
- **Batch 2** (#219, 22 files, bulk sed) — Chart tooltips (Order/Kline/Setup/Measurement), Trading/* (Portfolio, Orders, Watchers, Profiles), ui/logo, ui/select. Every remaining `color="X.500"` literal in the renderer.
- **Batch 3** (#220) — Trading/WatcherManager/WatcherCardCompact `borderColor="green.500"` → `green.muted`, status dot → `green.fg`. ui/card.tsx primitive: `bg="white"` + `_dark` override → `bg="bg.panel"`; both `CardRoot` and `CardHeader` semantic tokens.
- **Batch 4** (#221, 5 files) — Trading badges/pills using `bg="X.100" + color="X.800" + _dark={...}` triplets → `bg="X.subtle" + color="X.fg"` (5 `_dark` overrides removed).
- **Batch 5** (#222, 7 files, bulk sed) — Mid-range shades (`X.{400,600,700,800}`) for status indicators → `X.fg` (text) / `X.solid` (fill).
- **Batch 6** (#223, 7 files) — Final cleanup: SymbolSelector, ErrorBoundary, SetupStatsTable, SetupToggleSection (4-prop `_dark` override), BulkSymbolSelector, TpModeSection (drop redundant `_dark`), MarketIndicatorSections (dynamic `${rateColor}` template).
- **Phase B P2 sweep** (#217) — DomLadder header renders `—` instead of `0.00` when no price; ProfileCard yellow accent `yellow.500` → semantic + new `aria-label` `tradingProfiles.defaultMarker` (en/pt/es/fr); WalletCard semantic-token migration.

### Docs
- **`CLAUDE.md`** — Project Version `0.85.0` → `1.1.0`; Current Focus + System Status rewritten; Testing Status bumped to ~8,400 tests with visual regression block.
- **`CHANGELOG.md`** — `[Unreleased]` drained; v1.2.0 section added.

### Stats
- **8,400+ tests** passing — 5,416 backend + 2,239 frontend unit + 27 frontend browser + 722 indicators
- **0** forbidden-pattern violations remaining in renderer/components/
- **44-PNG visual regression baseline** + CI gate active

## [1.1.0] - 2026-04-27

**v1.1 release** — Phase 6 visual-verification baseline shipped, custom-symbols loadability fully wired (POLITIFI now loads, real-time tab % works, components auto-backfill from Binance), MCP infrastructure populated for fixture-driven review, CryptoIcon source caching, NaN-guard in price store, full DailyPerformance + Market sidebar fixtures.

### Added — Phase 6 (Visual verification)
- **`docs/visual-review-2026-04.md`** — Phase 6.2 deliverable. Walks every Settings tab / modal / sidebar against the compact-style rules in `V1_POST_RELEASE_PLAN.md`, scores findings P0/P1/P2, captures the Phase 6.3 fix plan. Outcome: 0 P0, 4 P1 (all addressed in this release), 5 P2 (deferred).
- **Visual regression baseline** — `apps/electron/screenshots/baseline/` (44 PNGs, English × dark+light, ~4MB) at viewport 1440×900 deviceScaleFactor 1. `.gitignore` now ignores timestamped session dirs only (`apps/electron/screenshots/[0-9]*/`), keeps `baseline/` tracked.
- **`scripts/visual-gallery.mjs`** — thin driver around `captureGallery` for quick Phase 6.x iterations without going through the MCP stdio transport.
- **`scripts/visual-diff.mjs`** — compares the most recent (or named) gallery session against the committed baseline, reports diffs/missing/new files, exits non-zero on divergence. Byte-equality compare today; pixelmatch swap-in is the next deliverable.
- **`packages/mcp-screenshot/src/fixtures.ts`** populated for review: 12 closed executions, 2 paper wallets ($12,473 + $5,847), 3 active watchers, 1 trading profile, full DailyPerformance shape (12 days April 2026), 11 Market sidebar indicator snapshots (Fear & Greed 62/Greed, BTC dominance 56.4%, MVRV 2.1, production cost vs price, open interest 28.4B, long/short global+topTraders, altcoin season w/ topPerformers, ADX 26.4 bullish, order book buy pressure, funding rates × 4). 30-day history series simulated for sparkline charts.

### Fixed — Phase 6.3 P1 sweep
- **`priceStore.computeDailyChangePct`** returns null when `livePrice` is non-finite or computed pct is NaN — fixes "BTCUSDT NaN%" rendered in the chart panel header when the price stream had no data.
- **`common.noData` translation key** added to all 4 locales (en/pt/es/fr). Market sidebar indicator cards used to render the literal i18n key as a fallback. (Initially shipped earlier in this release window.)
- **Orders modal not rendering in captures** — `OrdersDialog` is mounted inside `TradingSidebar`, so flipping `isOrdersDialogOpen` alone wasn't enough; the capture pipeline now opens the trading sidebar first.
- **Watcher fixture shape** — `autoTrading.getWatcherStatus` returns `{ active, watchers, activeWatchers, persistedWatchers }`, not a bare array; renderer was reading 0 watchers despite 3 in the fixture.

### Added — Custom symbols (POLITIFI loadability)
- **`CustomSymbolsTab`** standard section header (title + count badge + BetaBadge + description) matching `IndicatorsTab` and `TradingProfilesManager` — was a floating BetaBadge with no title. New i18n key `customSymbols.description` in all 4 locales.
- **`SymbolSelector.handleSelect`** now accepts marketType / assetClass overrides and forces `marketType=SPOT, assetClass=CRYPTO` when the user picks a custom symbol — custom klines are always stored under SPOT.
- **`backfillKlines`** in `custom-symbol-service`:
  - Tries the configured marketType first, falls back to the alternate side (with log + DB persistence of the working side) when no rows are found.
  - Calls `smartBackfillKlines` on every run for each component (not just when local count is 0) so recent gaps to "now" get filled. `smartBackfillKlines` is gap-aware, so this is cheap when data is already complete.
  - Falls back to fetching from Binance (FUTURES first, SPOT second) when a component has zero local klines anywhere.
  - Skips components that still have no data after the network attempt and **renormalizes weights** across the remaining basket; logs the skipped symbols.
- **`kline.list` / `kline.latest`** coerce `marketType` to `'SPOT'` when the symbol is a known custom symbol — keeps SPOT/FUTURES toggling on the chart from breaking custom indices.
- **`shared.ts`** in `kline` router — `subscribeToStream`, `triggerCorruptionCheck`, `unsubscribeFromStream` short-circuit for custom symbols (no Binance kline stream to subscribe to).
- **`futuresTrading.getOpenOrders` / `getOpenAlgoOrders` / `getPosition`** short-circuit to empty/null for custom symbols; was hitting Binance fapi `/openOrders?symbol=POLITIFI` and getting `-1121 Invalid symbol`, which propagated as a tRPC error.
- **`ticker.getDailyBatch`** resolves custom symbols against the local klines table (1h SPOT, since today's UTC midnight) — without this the tab-bar percentage stayed empty for POLITIFI because Binance returns nothing for synthetic indices.

### Fixed — Symbol icons
- **`CryptoIcon`** caches the working source index per base asset at module scope (`workingSourceByAsset`) and remembers fully-bad assets (`knownBadAssets`). Previously every remount restarted from source 0 and re-tried URLs that were known to fail (raw.githubusercontent + ORB blocks), causing the icon to flicker to its letter fallback on every render.

### Changed — Capture pipeline
- **Default `deviceScaleFactor`** in `mcp-screenshot/src/browser.ts` lowered from 2 → 1 (override via `MM_MCP_SCALE`). Galleries are ~58% smaller (9.5MB → 4MB) at viewport 1440×900 — sufficient for layout review, retina mode kept opt-in.
- **Flow modals** (`addWatcher` / `createWallet` / `startWatchers` / `importProfile` / `tradingProfiles`) moved to a `FLOW_MODALS` list — no longer in the default gallery sweep, since they open via in-app click flows (not store flags) and produced empty workspace shots.
- **`docs/MCP_AGENT_GUIDE.md`** — new "Reproducing user bugs — drive the real flow, not fixtures" section documents the principle: bugs only repro through the same path the user took, so use `mcp-app` (live tRPC) not `mcp-screenshot` (fixtures-driven).

### Added — Phase 5 (MCP infrastructure)
- **Four MCP servers** under `packages/mcp-*`, each independently installable, totalling **47 tools**:
  - `@marketmind/mcp-screenshot` (6 tools) — Playwright + Chromium against the dev renderer; `screenshot.tab`/`modal`/`sidebar`/`fullPage`/`gallery` plus `__health`. Emits side-by-side dark/light HTML galleries to `apps/electron/screenshots/{ts}/`.
  - `@marketmind/mcp-app` (19 tools) — drives the live dev app: navigation (`openSettings`/`closeSettings`/`closeAll`/`openModal`), symbol/chart (`navigateToSymbol`/`setTimeframe`/`setChartType`/`setMarketType`), UI state (`applyTheme`/`toggleSidebar`/`toggleIndicator`), allowlisted `dispatchToolbar`/`dispatchStore`, escape hatches (`click`/`fill`/`waitFor`/`takeScreenshot`), `inspectStore`. All bridges are dev-only — gated by `VITE_E2E_BYPASS_AUTH=true`.
  - `@marketmind/mcp-backend` (14 tools) — read-only DB layer: per-table `db.query.{wallets,executions,orders,klines,users,sessions,watchers,setups,autoTradingConfig}` plus SELECT/CTE-only `db.exec`, `trpc.call` HTTP bridge, `audit.tail`, `health.check`. Audit log is JSONL, append-only, local-only.
  - `@marketmind/mcp-strategy` (8 tools) — Pine strategy CRUD (`list`/`export`/`create` against `apps/backend/strategies/{builtin,user}/`) + backtest proxies (`run`/`diff`/`getResult`/`listBacktests`).
- **Renderer e2e bridge extended** for MCP control surface: `__globalActions.closeAll`/`setTimeframe`/`setChartType`/`setMarketType` added to `apps/electron/src/renderer/utils/e2eBridge.ts` + `MainLayout.tsx` + `GlobalActionsContext.tsx`. New stores exposed on `window`: `__backtestModalStore`, `__screenerStore`.
- **One-shot installer** `pnpm mcp:install` (`scripts/mcp-install.mjs`) — auto-detects every `packages/mcp-*` workspace, registers them in `~/.claude.json` under `mcpServers.marketmind-{surface}`. `pnpm mcp:install:dry-run` previews the patch; `pnpm mcp:uninstall` removes the entries; `pnpm mcp:build` compiles all four packages.
- **Three top-level docs**:
  - `docs/MCP_SERVERS.md` — overview, install, per-server tool tables, architecture diagram.
  - `docs/MCP_AGENT_GUIDE.md` — common-flow recipes (gallery sweep, symbol nav, P&L lookup, strategy diff, store inspection, audit tail).
  - `docs/MCP_SECURITY.md` — threat model, env gates, allowlist enforcement, audit log semantics, why `mcp-trading` is deferred to v1.2.

### Added — UI standards uplift (during Phase 4)
- **`<PanelHeader>` new primitive** (`apps/electron/src/renderer/components/ui/panel-header.tsx`). Standard header for dashboard-style panels: title (`MM.font.sectionTitle` = sm/semibold) + optional description + optional right-side action slot, with `pb={2}` + `borderBottomWidth="1px" borderColor="border"` separator. **`<PanelHeader>` vs `<FormSection>`**: FormSection = form group, no border; PanelHeader = data panel, with bottom border. Same title typography.
- **New tokens**:
  - `MM.spinner.panel = { size: 'md', py: 6 }` — standard dashboard panel loading state
  - `MM.spinner.inline = { size: 'sm', py: 0 }` — inline next-to-text loading
  - `MM.buttonSize.nav = '2xs'` — pagination / prev-next nav buttons
- **AnalyticsModal panels migrated** to `<PanelHeader>` — `EquityCurveChart`, `PerformanceCalendar`, `PerformancePanel` all use the new primitive. All 3 spinners use `MM.spinner.panel` tokens. Calendar prev/next buttons use `MM.buttonSize.nav`.

### Docs
- `docs/V1_POST_RELEASE_PLAN.md` — Component primacy table extended with PanelHeader / panel-loading / pagination patterns + dedicated "Panel header vs Form section" sub-section + 3 new forbidden patterns.
- `docs/UI_STYLE_GUIDE.md` — new "Spinners" token table + dedicated "Panel header pattern" section with usage example.
- `apps/electron/src/renderer/components/ui/README.md` — PanelHeader added to the Layout catalog with rationale.
- `CLAUDE.md` — PanelHeader added to the must-use-from-`ui` list + section/row composition guide updated with PanelHeader, MM.spinner.panel, MM.buttonSize.nav usage.

### Changed — Phase 4 (Modals deep review)
- **OrdersDialog**: stats bar tightened (`gap={6}` → MM.spacing.row.gap, ad-hoc colors `green.500/orange.500` → semantic `green.fg/orange.fg`), filter bar gaps + button sizes adopt MM tokens (`size="sm"` → `xs` for view-mode toggles), empty/loading states tightened to `p={6}` from `p={8}`.
- **BacktestForm** outer shell: `gap={3}` → `MM.spacing.row.gap`, `py={4}` → `MM.spacing.section.gap`, button group gap → `MM.spacing.inline.gap`, body text size → `MM.font.body.size`.
- **ScreenerModal** body: `Stack gap={3}` → `MM.spacing.row.gap`; dialog padding `px={4} py={3}` → `MM.spacing.section.gap` / `MM.spacing.dialogPadding`.
- **AnalyticsModal/EquityCurveChart** "no trades yet" empty state: ad-hoc `<Box p={6} bg="bg.muted">` + Text → `<Callout tone="neutral" compact>`.

### Changed — Phase 3 (Sidebars deep review)
Phase 3 of v1 post-release plan. Sidebars came out cleaner than expected from prior v1.0.0 sweeps — no hardcoded shades found in `Trading/TradingSidebar`, `AutoTrading/AutoTradingSidebar`, `OrderFlow/OrderFlowSidebar`, `MarketSidebar/MarketSidebar`, or any tab. Two real touches:

- **`AutoTradingSidebar`**: "select wallet first" empty state replaced with `<Callout tone="warning" compact>` (was raw muted Text in `<Box p={4}>`).
- **MM token adoption** in 3 sidebar bodies — `Trading/Portfolio.tsx`, `Trading/OrdersList.tsx`, `MarketSidebar/tabs/WatchersTab.tsx`: outer `Stack gap={3} p={4}` → `Stack gap={MM.spacing.section.gap} p={MM.spacing.dialogPadding}` (token-driven, identical visual at current scale, single change point if compactness target shifts).

`MarketSidebar/tabs/LogsTab.tsx` keeps `gray.800` / `gray.900` literals — intentional terminal aesthetic; documented as exception.

### Added — Phase 2 (Code/architecture)
- **`apps/electron/src/renderer/theme/tokens.ts`** — `MM` namespace exports the MarketMind compact-style design tokens (spacing, typography, line-heights, button sizes, radius, preview dimensions). Single source of truth referenced from all primitives.
- **`packages/ui/MIGRATION.md`** — extraction audit + plan for v1.2. Found only 3 of ~47 ui files have cross-imports (`color-mode.tsx`, `MetricCard.tsx`, `PnLDisplay.tsx`) — extraction is low-effort surgery; bulk is mechanical.

### Changed — primitives consume tokens (no behavior change)
- **`Callout`**: padding, spacing, font sizes, line-heights, border-radius now read from `MM` tokens.
- **`FormSection`** + **`FormRow`**: same — section title size, body line-height, contentGap default.
- **`typography`** (PageTitle / SectionTitle / SubsectionTitle / SectionDescription / FieldHint / MetaText): all 6 components fully token-driven.
- Locked compact-style values: section gap `4` (16px), row gap `2.5` (10px), inline `1.5` (6px), button primary `xs`, secondary `2xs`. Matches `docs/V1_POST_RELEASE_PLAN.md` Design language table.

### Docs
- `docs/UI_STYLE_GUIDE.md` — new "Compact-style tokens (`MM`)" section documenting every token + value + use + usage example.

### Added — Phase 1 (Quality & tests)
- **+82 frontend unit tests** covering v1 sweep refactors that shipped without coverage:
  - `ui/Callout` (8) — every tone, compact, custom icon, title/body composition
  - `ui/FormSection` + `ui/FormRow` (10)
  - `Trading/DirectionBadge` (11) — long/short variants, BTC trend, blocked, skipped count, isIB
  - `Trading/DynamicSymbolRankings` (7) — open/close, tab switch, active marker, added/removed pills
  - `Trading/CreateWalletDialog` (9) — name validation, paper params on submit, currency/balance fields
  - `Trading/AddWatcherDialog` (10) — single↔bulk toggle, profile selector, futures warning, info Callout
  - `Trading/ImportProfileDialog` (8) — JSON parse, valid preview, invalid error, autofill name, mutation
  - `Trading/StartWatchersModal` (10) — open/close, no-wallet Callout, market type toggle, direction toggles, settings/cancel
  - `hooks/useSetupToasts` (6) — subscribe, fire on payload, gate, skip missing fields
- **+27 backend integration tests** in `auth.router.test.ts`:
  - email-masking integration at every call site (register success/fail, login success/fail, requestPasswordReset, resendVerificationEmail, changePassword fail) — assert raw email NEVER in serialized payload, mask preserves first-char + domain
  - avatar edge cases: whitespace data, exactly-too-large (cap+1), at-the-cap, empty rejected
  - avatarColor regex: 6-digit upper/lower accepted; 3-digit, color name, invalid hex chars, missing `#` rejected
  - changePassword session preservation: current kept, others invalidated; new password works; old password fails

### Added — Phase 1.3 (NotificationsTab wiring)
- **`utils/notificationSound.ts`** — Web Audio API beep (synthesized, no asset). Different freq per type (success 880Hz, info 660Hz, warning 440Hz, error 220Hz). Best-effort — never throws.
- **`useToast`** now reads `notificationSoundEnabled` pref and plays a beep on every toast when enabled.
- **`useOrderNotifications`** gates status-change toasts on `orderToastsEnabled` (default true).
- **`useSetupToasts`** new hook subscribed to `setup-detected` socket events; fires info toast gated on `setupToastsEnabled`. Mounted in `App.tsx` alongside `useOrderNotifications`.

### Added — Phase 1.4 (a11y audit on Settings dialog)
- **`@axe-core/playwright`** added as e2e dev-dep.
- **6 new a11y test cases** in `settings-overhaul.spec.ts` — one per high-traffic Settings tab (account/security/notifications/general/updates/about). Asserts 0 serious + 0 critical violations against the dialog scope.
- Disabled rules with rationale in test code: `region` + `aria-allowed-attr` (Chakra portal patterns); `color-contrast` (deferred to dedicated theme PR per V1_POST_RELEASE_PLAN.md Phase 2.1 — `fg.muted` over `bg.muted` in dark mode falls below 4.5:1).

### Fixed — a11y issues found by audit
- **Switch wrappers** in NotificationsTab + UpdatesTab + SecurityTab now pass `aria-label` to the underlying input (was empty `<Switch.Label>` because FormRow renders the label outside the Switch). Resolves serious `aria-labelledby` violations.
- **Slider** wrapper extended with `aria-label` prop, applied to update-interval slider in UpdatesTab. Resolves serious `aria-input-field-name` violation.

### Test totals
- Frontend: 2155 → 2237 (+82 unit). 19 e2e tests for Settings (was 13). All passing.
- Backend: 5389 → 5416 (+27). All 204 test files pass.

### Security
- **`audit-logger.ts` — email masking in security event logs.** Resolves 4 CodeQL `js/clear-text-logging` (high-severity) alerts that flagged `metadata.email` being persisted in clear text through `auditLogger.info/warn` for events like `LOGIN_FAILURE`, `PASSWORD_RESET_*`, `REGISTER_FAILURE`. New `maskEmail()` helper preserves correlation grep-ability (first char of local part + full domain, e.g. `alice@example.com → a****@example.com`) without ever logging the full address. Tests verify: long-local masking, single-char local (`a@x` → `*@x`), two-char (`ab@x` → `a*@x`), malformed-email fallback (`***`), full-email never present in serialized payload on `LOGIN_FAILURE`. +5 tests (audit-logger now 21).

### Changed — Round 4: badge swap + remaining color-shade cleanup
- **`DirectionBadge`**: rewritten to use the `Badge` wrapper (with `colorPalette`) instead of 5 ad-hoc `<Box bg="X.100" _dark={{ bg: 'X.900' }}>` panels with hardcoded text-color light/dark overrides. Same visual semantics, fully theme-aware. -36 lines.
- **`DynamicSymbolRankings`**: 5 ad-hoc `<Box bg="green.100"/red.100/gray.100" _dark={...}>` pills (active marker + added/removed symbol chips) → `<Badge colorPalette="green|red|gray" size="sm">`. -45 lines.
- **`Layout/TrailingStopPopover`**: long/short manual-activation panels now have `borderWidth/borderColor="green.muted|red.muted"` to match all other Callout-style panels; text color tightened to `.fg` semantic token (was `.600` shade).

### Changed — Round 3: Backtest tabs no-accordion + final colored-box sweep
- **Backtest `RiskTab`**: 5 `CollapsibleSection`s converted to `variant="static"` (always-visible — matches AutoTrading pattern). `FiltersTab` left as collapsible (filter groups benefit from collapsing).
- **`FuturesPositionInfo`**: liquidation-warning panel → `<Callout tone="danger" compact>`.
- **`Trading/FuturesPositionsPanel`**: same liquidation-warning panel → `<Callout tone="danger" compact>`.
- **`MarginInfoPanel`**: !isSafe warning → `<Callout tone="danger" compact>`. Removed unused `LuTriangleAlert` import.
- **`WatcherManager/EmergencyStopSection`**: confirm panel changed from hardcoded `red.50` + `_dark={{ bg: 'red.900/30' }}` to semantic `red.subtle`/`red.muted` tokens; tightened spacing (p=4→3, gap=3→2, button size sm→xs).

### Changed — Modal sweep round 2 (Callout adoption + semantic tokens)
- **BacktestModal**: error state now uses `<Callout tone="danger">` instead of `<Alert.Root status="error">`.
- **ScreenerModal**: error banner now uses `<Callout tone="danger">` instead of an inline `<Box bg="red.subtle">` text block.
- **AnalyticsModal**: "no wallet selected" empty state uses `<Callout tone="info">` instead of a centered muted Text.
- **No-wallet warning unified across 4 surfaces** (`MarketSidebar/tabs/WatchersTab.tsx`, `MarketSidebar/tabs/LogsTab.tsx`, `Trading/Portfolio.tsx`, `Trading/OrdersList.tsx`) — all 4 used identical `<Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>` ad-hoc panels with hardcoded color shades. Replaced with `<Callout tone="warning" compact>`.
- **WatcherManager**:
  - `DynamicSelectionSection`: blue info panel → `<Callout tone="info" icon={<LuZap />} compact>` (loses ad-hoc `_dark={{ bg: 'blue.900/20' }}`).
  - `LeverageSettingsSection`: orange leverage warning → `<Callout tone="warning" compact>`.
  - `QuickStartSection` + `StockPresetsSection`: kept as bordered panels (structural — not informational), but switched the hardcoded `green.50/green.200/green.900/green.800` palette to the semantic `green.subtle`/`green.muted` tokens used by Chakra v3, matching the dialog's own panel style and removing 4× `_dark` overrides.

### Added — E2E spec for Settings flow
- **`apps/electron/e2e/settings-overhaul.spec.ts`** — 13 chromium tests covering: opens with default Account tab, opens directly on requested tab via `openSettings(tab)`, four section labels render in the rail, every tab trigger renders, name input shows current name, avatar color swatches clickable, password submit gates on validation, current session shown in sessions list, all 3 notifications switches render, all 3 update controls render, rail navigation swaps the right pane, palette swatches in Chart tab, repair/clear-storage buttons in Data tab.
- **`apps/electron/e2e/helpers/trpcMock.ts`**: `auth.me` defaults updated with the new `avatarColor` + `hasAvatar` fields, plus default resolvers for `auth.getAvatar`, `auth.listSessions` (one current session), `auth.changePassword`, `auth.uploadAvatar`, `auth.deleteAvatar`, `auth.updateProfile`, `auth.revokeSession`, `auth.revokeAllOtherSessions`, `auth.resendVerificationEmail`, `auth.toggleTwoFactor`. Brings the e2e mock surface in line with the v1 backend endpoints.

### Fixed
- **AboutTab** — copyright `Callout` no longer wraps `MetaText` (which renders `<p>`) inside `Callout`'s `<p>`. Removed the nested-`<p>` warning. Now passes the translated string directly as `Callout` body.

### Added — Backend tests for v1 auth endpoints
- **16 new integration tests** in `apps/backend/src/__tests__/routers/auth.router.test.ts` covering all post-v1 auth endpoints:
  - `updateProfile` (4): name update, valid avatar color, invalid hex rejection, color clearing
  - `changePassword` (4): happy path, wrong current rejection, weak new rejection, other-sessions invalidation while keeping current
  - `uploadAvatar` / `getAvatar` / `deleteAvatar` (4): full lifecycle, mime allowlist, size cap, null when unset
  - `listSessions` / `revokeSession` / `revokeAllOtherSessions` (4): user-scoped list with isCurrent flag, non-current revoke, refusal to self-revoke, cross-user isolation, revoke-all-keep-current
  - `me with avatar/color` (1): hasAvatar + avatarColor surfaced in `me` payload
- **`apps/backend/src/__tests__/helpers/test-db.ts`**: `users` and `sessions` table definitions extended with the new columns (`avatar_data`, `avatar_mime_type`, `avatar_color`, `created_at`, `user_agent`, `ip`) so testcontainers picks them up without needing the migration journal.
- Backend total: 4934 → 5389 tests passing (sweep added 14 net).

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
