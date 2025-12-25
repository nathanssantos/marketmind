# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
