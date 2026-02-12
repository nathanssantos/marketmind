# Backtesting Service

The backtesting service provides comprehensive strategy testing capabilities for MarketMind.

## Architecture

```
backtesting/
├── BacktestEngine.ts           # Main backtest execution engine
├── MultiWatcherBacktestEngine.ts # Multi-symbol/timeframe backtesting
├── FilterManager.ts            # Entry filter management
├── TradeExecutor.ts            # Trade execution and position sizing
├── ExitManager.ts              # Exit logic and stop/take-profit handling
├── IndicatorCache.ts           # Performance optimization for indicators
├── configLoader.ts             # Configuration loading from database
└── README.md                   # This file
```

## Filter Parameters

All filter defaults are centralized in `@marketmind/types/filter-defaults.ts` to ensure consistency between backtesting and auto-trading.

### Entry Filters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useTrendFilter` | `false` | Enable EMA-based trend direction filter |
| `trendFilterPeriod` | `21` | EMA period for trend filter |
| `useStochasticFilter` | `false` | Enable Stochastic RSI overbought/oversold filter |
| `useMomentumTimingFilter` | `true` | Enable momentum-based entry timing |
| `useAdxFilter` | `false` | Enable ADX trend strength filter |

### Market Context Filters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useMtfFilter` | `true` | Multi-timeframe trend confirmation |
| `useBtcCorrelationFilter` | `true` | BTC correlation check for altcoins |
| `useMarketRegimeFilter` | `true` | Market regime detection (trending/ranging) |
| `useVolumeFilter` | `false` | Volume confirmation filter |
| `useFundingFilter` | `true` | Funding rate check (FUTURES only) |

### Confluence Scoring

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useConfluenceScoring` | `true` | Enable multi-factor confluence scoring |
| `confluenceMinScore` | `60` | Minimum score required (0-100) |

### Volatility & Session Filters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useChoppinessFilter` | `false` | Skip trades when Choppiness Index > threshold (choppy market) |
| `choppinessThresholdHigh` | `61.8` | Upper threshold - above this = choppy, skip trade |
| `choppinessThresholdLow` | `38.2` | Lower threshold - below this = trending, allow trade |
| `choppinessPeriod` | `14` | Choppiness Index calculation period |
| `useSessionFilter` | `false` | Trade only during high-volume hours (EU-US overlap) |
| `sessionStartUtc` | `13` | Session start hour (UTC) |
| `sessionEndUtc` | `16` | Session end hour (UTC) |
| `useBollingerSqueezeFilter` | `false` | Wait for Bollinger Band squeeze before entry |
| `bollingerSqueezeThreshold` | `0.1` | Squeeze threshold (bandwidth ratio) |
| `bollingerSqueezePeriod` | `20` | Bollinger Band period |
| `bollingerSqueezeStdDev` | `2.0` | Standard deviation multiplier |
| `useVwapFilter` | `false` | LONG above VWAP only, SHORT below VWAP only |
| `useSuperTrendFilter` | `false` | Trade only in SuperTrend direction |
| `superTrendPeriod` | `10` | SuperTrend calculation period |
| `superTrendMultiplier` | `3.0` | ATR multiplier for SuperTrend |

### Risk Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `positionSizePercent` | `10` | Position size as percentage of capital |
| `minRiskRewardRatioLong` | `1.0` | Minimum R:R for LONG trades |
| `minRiskRewardRatioShort` | `0.8` | Minimum R:R for SHORT trades |

### Cooldown

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useCooldown` | `true` | Enable cooldown between trades |
| `cooldownMinutes` | `15` | Minutes between trades on same symbol |

## Usage

### Filter Optimization Script

Find the best filter combinations for your strategy:

```bash
cd apps/backend
npx tsx src/cli/optimize-complete.ts \
  --start=2025-01-01 \
  --end=2026-01-01 \
  --timeframes=4h
```

Options:
- `--symbol`: Symbol to test (default: BTCUSDT)
- `--start`: Start date (YYYY-MM-DD)
- `--end`: End date (YYYY-MM-DD)
- `--timeframes`: Comma-separated timeframes (e.g., 30m,1h,4h,1d)
- `--capital`: Initial capital (default: 10000)
- `--leverage`: Leverage multiplier (default: 10)

The script tests 32 filter combinations and outputs:
- Top 20 configurations ranked by P&L
- Best configuration per timeframe
- LONG vs SHORT performance analysis
- Recommended production configuration

### CLI Script

```bash
cd apps/backend
pnpm optimize:full              # Full 3-stage optimization
pnpm backtest:optimize          # CLI parameter optimization
pnpm backtest:validate          # Validate strategy parameters
```

### Programmatic Usage

```typescript
import { BacktestEngine } from './services/backtesting/BacktestEngine';
import { FILTER_DEFAULTS } from '@marketmind/types';

const engine = new BacktestEngine();

const result = await engine.run({
  symbol: 'BTCUSDT',
  interval: '4h',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  initialCapital: 10000,
  marketType: 'FUTURES',
  setupTypes: ['rsi-oversold-bounce', 'momentum-breakout-2025'],

  // Override specific filters
  useTrendFilter: true,
  trendFilterPeriod: 21,
  useMtfFilter: false,  // Disable for faster backtests
  useBtcCorrelationFilter: false,
});
```

### Multi-Watcher Backtest

```typescript
import { MultiWatcherBacktestEngine } from './services/backtesting/MultiWatcherBacktestEngine';
import { buildMultiWatcherConfigFromWatchers } from './services/backtesting/configLoader';

const config = buildMultiWatcherConfigFromWatchers(
  [
    { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES', setupTypes: ['rsi-oversold-bounce'] },
    { symbol: 'ETHUSDT', interval: '4h', marketType: 'FUTURES', setupTypes: ['momentum-breakout-2025'] },
  ],
  {
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    useMtfFilter: false,
    useBtcCorrelationFilter: false,
  }
);

const engine = new MultiWatcherBacktestEngine();
const result = await engine.run(config);
```

## Configuration Loading

### From Auto-Trading Config

```typescript
import { loadMultiWatcherConfigFromAutoTrading } from './services/backtesting/configLoader';

const config = await loadMultiWatcherConfigFromAutoTrading(walletId, {
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  initialCapital: 10000,
});
```

### Manual Configuration

```typescript
import { buildMultiWatcherConfigFromWatchers } from './services/backtesting/configLoader';
import { FILTER_DEFAULTS } from '@marketmind/types';

const config = buildMultiWatcherConfigFromWatchers(watchers, {
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  initialCapital: 10000,
  // All filters default to FILTER_DEFAULTS values
});
```

## Performance Tips

1. **Disable heavy filters for initial testing:**
   ```typescript
   useMtfFilter: false,
   useBtcCorrelationFilter: false,
   ```

2. **Reduce timeframes for faster iteration:**
   - Use `['1h', '4h', '1d']` instead of all timeframes

3. **Limit date range:**
   - Start with 6-12 months before running multi-year backtests

4. **Use specific strategies:**
   - Test 2-3 strategies at a time rather than all 106

## Output Structure

```typescript
interface BacktestResult {
  id: string;
  config: BacktestConfig;
  trades: TradeResult[];
  metrics: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
    profitFactor: number;
    sharpeRatio: number;
  };
  equityCurve: EquityPoint[];
  status: 'COMPLETED' | 'FAILED';
}
```

## Centralized Defaults

All default values are defined in `@marketmind/types/filter-defaults.ts`:

```typescript
import { FILTER_DEFAULTS } from '@marketmind/types';

// Access individual defaults
console.log(FILTER_DEFAULTS.useTrendFilter);      // false
console.log(FILTER_DEFAULTS.confluenceMinScore);  // 60
console.log(FILTER_DEFAULTS.positionSizePercent); // 10
```

This ensures consistency between:
- BacktestEngine
- MultiWatcherBacktestEngine
- configLoader
- Auto-trading configuration
- Database schema defaults

## Filter Descriptions

### Choppiness Index Filter
The Choppiness Index measures market "choppiness" (sideways/ranging vs trending):
- **CHOP > 61.8**: Market is choppy/ranging → Skip trade
- **CHOP < 38.2**: Market is trending → Allow trade
- Formula: `100 × LOG10(Σ ATR(14)) / (MAX(high,14) - MIN(low,14))`

### Session Filter
Trades only during the EU-US market overlap (highest volume period):
- Default: 13:00-16:00 UTC
- This period has ~31% higher volume than average
- Avoid Monday 08:00-10:00 UTC (lowest volatility)

### Bollinger Squeeze Filter
Detects low volatility "squeeze" conditions before breakouts:
- Squeeze = Bollinger Band width is very narrow
- Wait for squeeze expansion to confirm entry direction
- Combines well with volume confirmation

### VWAP Filter
Volume-Weighted Average Price alignment:
- LONG: Only if price is above VWAP (institutional buying pressure)
- SHORT: Only if price is below VWAP (institutional selling pressure)

### SuperTrend Filter
ATR-based trend following indicator:
- Provides clear trend direction (up/down)
- LONG: Only if SuperTrend is bullish
- SHORT: Only if SuperTrend is bearish
- Default: Period=10, Multiplier=3.0
