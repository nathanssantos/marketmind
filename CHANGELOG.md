# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.50.0] - 2026-02-01

### Added
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
- Dynamic Symbol Rotation now considers order book conditions
  - Reduces exposure during strong selling pressure (imbalance < 0.7)
  - Detects significant ask walls and adjusts rotation accordingly
- Market Indicators sidebar enhancements:
  - ADX and Altcoin Season now show 24h change badges
  - Historical area charts when data is available
  - Order Book analysis card with pressure and imbalance

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
