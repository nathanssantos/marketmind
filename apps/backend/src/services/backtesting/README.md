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

### Risk Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `exposureMultiplier` | `1.5` | Max exposure as multiple of initial capital |
| `minRiskRewardRatioLong` | `1.0` | Minimum R:R for LONG trades |
| `minRiskRewardRatioShort` | `0.8` | Minimum R:R for SHORT trades |

### Cooldown

| Parameter | Default | Description |
|-----------|---------|-------------|
| `useCooldown` | `true` | Enable cooldown between trades |
| `cooldownMinutes` | `15` | Minutes between trades on same symbol |

## Usage

### CLI Script

```bash
cd apps/backend
npx tsx scripts/run-systematic-backtest.ts
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
console.log(FILTER_DEFAULTS.exposureMultiplier);  // 1.5
```

This ensures consistency between:
- BacktestEngine
- MultiWatcherBacktestEngine
- configLoader
- Auto-trading configuration
- Database schema defaults
