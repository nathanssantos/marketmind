# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
