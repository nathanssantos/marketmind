# Next Chat Prompt - MarketMind

## Context

The **OPTIMIZATION_MASTER_PLAN.md** is now **100% complete (v2.5.0)**.

## What's Been Completed

1. **Enhanced Opportunity Scoring** - SetupPreScanner + FilterPreValidator integration
2. **ADX Trend Strength Filter** - BTC ADX check to skip choppy markets (ADX < 20)
3. **Altcoin Season Index** - Detects ALT_SEASON/BTC_SEASON/NEUTRAL based on alt performance vs BTC
4. **Order Book Integration** - Imbalance ratio, liquidity walls, pressure detection
5. **Indicator History** - TimescaleDB hypertable with 31-day history and area charts
6. **tRPC Endpoints** - `getAltcoinSeasonIndex`, `getBtcAdxTrendStrength`, `getOrderBookAnalysis`, `saveIndicatorSnapshot`
7. **UI Display** - Market Indicators sidebar with area charts for ADX and Altcoin Season
8. **12h Default Timeframe** - Now the default for Quick Start
9. **All Tests Passing** - 4,792 tests (2,433 backend + 2,332 frontend + 27 browser)

## Key Files

- `docs/OPTIMIZATION_MASTER_PLAN.md` - Completed master plan
- `apps/backend/src/services/dynamic-symbol-rotation.ts` - Main rotation service with all filters
- `apps/backend/src/services/order-book-analyzer.ts` - Order book analysis
- `apps/backend/src/services/indicator-history.ts` - Historical indicator data storage
- `apps/backend/src/services/altcoin-season-index.ts` - Altcoin season detection
- `apps/backend/src/routers/auto-trading.ts` - tRPC endpoints
- `apps/backend/src/db/schema.ts` - Database schema with indicator_history table
- `apps/electron/src/renderer/components/MarketSidebar/tabs/MarketIndicatorsTab.tsx` - UI with charts

## Commands

```bash
# Run all tests
pnpm test

# Run backend only
pnpm --filter @marketmind/backend test

# Run frontend only
pnpm --filter @marketmind/electron test

# Type check
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
```

## Performance Review Complete (v2.5.1)

Comprehensive performance review completed with the following improvements:

1. **Reusable Cache Utilities** - Created `SimpleCache<T>` and `KeyedCache<T>` abstractions in `apps/backend/src/utils/cache.ts`
2. **Centralized Indicator Constants** - Created `apps/backend/src/constants/indicators.ts` with:
   - `INDICATOR_CACHE` - Cache TTLs for all indicator services
   - `ALTCOIN_SEASON` - Thresholds, counts, and defaults
   - `ORDER_BOOK` - Depth limits, wall thresholds, valid limits
   - `ADX_TREND` - Trend strength thresholds
   - `INDICATOR_HISTORY` - Days, record limits, retention
   - `ROTATION_FILTERS` - All reduction percentages and thresholds
   - `BTC_KLINE_QUERY` - Centralized BTC symbol and query limit
3. **Consolidated BTC Kline Queries** - Dynamic symbol rotation now fetches BTC klines once and reuses for both correlation filter and ADX check
4. **Refactored Services** - Updated `altcoin-season-index.ts`, `order-book-analyzer.ts`, `indicator-history.ts`, `indicator-scheduler.ts`, and `dynamic-symbol-rotation.ts` to use new utilities and constants

## Next Steps

Potential future enhancements:

1. **Order Book Velocity** - Track rate of order book changes over time
2. **WebSocket Order Book Stream** - Real-time order book updates via WebSocket
3. **Multi-Symbol Order Book Analysis** - Batch analysis for portfolio overview
