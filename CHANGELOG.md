# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Filter validation enhanced for Interactive Brokers support
- Import paths updated for consistency and readability

### Fixed
- `maxFibonacciEntryProgressPercent` now correctly passed to StrategyInterpreter in auto-trading
- Entry level column type fixed in optimization grid
- Deferred exit timeout adjusted for position monitoring
- Error logging enhanced with serialization for backtesting logic

---

## [0.50.0] - 2026-02-05

### Added
- **Interactive Brokers - Phase 6 Completion (Backend)**
  - `IBFeeCalculator` with tiered commission support (TIER_1-4, LITE accounts)
  - `calculateTieredCommission`, `calculateRoundTripCommission`, `estimateCommissionRate` utilities
  - `smartBackfillIBKlines` service for IB historical data backfill with DB caching
  - BacktestEngine exchange routing: kline fetching routes to IB or Binance based on `--exchange` flag
  - CLI `--exchange` and `--asset-class` flags for `validate` and `batch` backtest commands
  - Integration test stubs for IB connection manager, stock client, kline stream, price stream (40 skipped)
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
- `IBStockClient.getAccountInfo()` now uses `estimateCommissionRate` instead of hardcoded commission rates
- `IBStockClient` accepts `accountType` parameter for fee calculation
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
- Fixed IB `subscribe()` race condition: async call is now properly awaited in watcher-manager

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
