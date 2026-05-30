# Trailing Stop Optimization System

This is the **main optimization system** for MarketMind, used to find the best trailing stop parameters.

## Overview

The system tests combinations of trailing stop parameters for LONG and SHORT independently, using granular historical data (5m) to simulate real trailing stop behavior.

## Basic Usage

```bash
# Quick mode (25 combinations, validation)
pnpm tsx src/cli/optimize-trailing-stop.ts --quick-test

# Medium mode (82,944 combinations, recommended)
pnpm tsx src/cli/optimize-trailing-stop.ts --mode=medium

# Full mode (millions of combinations, slow)
pnpm tsx src/cli/optimize-trailing-stop.ts --mode=full
```

## CLI Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--symbol` | BTCUSDT | Trading pair |
| `--start` | 2023-01-01 | Start date |
| `--end` | 2026-01-31 | End date |
| `--mode` | medium | Mode: quick, medium, full |
| `--quick-test` | false | Alias for --mode=quick |
| `--top-n` | 20 | Number of top results |
| `--verbose` | false | Detailed logging |

## Optimization Modes

### Quick (Validation)
- **Combinations:** 25
- **Time:** ~1 minute
- **Use:** Validate that the system works

### Medium (Recommended)
- **Combinations:** 82,944 (288 × 288)
- **Time:** ~80 minutes (3 years)
- **Parameters:**
  - Activation: 70-120% (step 10)
  - Distance: 20-50% (step 10)
  - ATR Multiplier: 1.5-3.0 (step 0.5)
  - Breakeven: 0.5-1.5% (step 0.5)

### Full (Exhaustive)
- **Combinations:** 25M+
- **Time:** ~20+ hours
- **Use:** Exhaustive search

## Optimized Parameters

### Per Direction (independent LONG/SHORT)

| Parameter | Description | Range |
|-----------|-------------|-------|
| `activationPercent` | % of TP to activate trailing | 50-150% |
| `distancePercent` | Trailing distance after activation | 10-60% |
| `atrMultiplier` | ATR multiplier for calculation | 1.0-4.0 |
| `breakevenProfitThreshold` | Threshold to move SL to breakeven | 0.5-3.0% |

## Score Metrics

The system uses a composite score to rank combinations:

```
Score = PnL × 0.4 + Sharpe × 1000 × 0.4 - MaxDD × 10000 × 0.2
```

- **PnL (40%):** Total profit/loss
- **Sharpe (40%):** Risk-adjusted return
- **Max Drawdown (20%):** Penalty for high drawdown

## Output

The system generates:
1. **Top N results** with full configs
2. **Best config JSON** ready to copy
3. **Trailing statistics:** activations and exits

## Related Files

```
apps/backend/src/
├── cli/
│   ├── optimize-trailing-stop.ts    # Main CLI
│   ├── validate-trailing-backtest.ts # Validation
│   └── shared-backtest-config.ts    # Shared config
└── services/backtesting/trailing-stop-backtest/
    ├── index.ts                     # Exports
    ├── types.ts                     # Types
    ├── SafeLogger.ts               # Output control
    ├── GranularPriceIndex.ts       # 5m price index
    └── TrailingStopSimulator.ts    # Core simulator
```

## Performance

| Data | Combinations | Estimated Time |
|------|-------------|----------------|
| 1 month | 82,944 | ~20 min |
| 6 months | 82,944 | ~40 min |
| 3 years | 82,944 | ~80 min |

### Future Optimizations
- [ ] Parallelization with worker threads
- [ ] Cache for computed indicators
- [ ] Early exit for poor combinations
- [ ] Kline streaming (reduce memory)

## Example Result

```json
{
  "trailingStopEnabled": true,
  "useAdaptiveTrailing": true,
  "long": {
    "activationPercent": 80,
    "distancePercent": 40,
    "atrMultiplier": 1.5,
    "breakevenProfitThreshold": 0.5
  },
  "short": {
    "activationPercent": 80,
    "distancePercent": 30,
    "atrMultiplier": 1.5,
    "breakevenProfitThreshold": 0.5
  }
}
```

## Testing the 106 Strategies

The system has **106 strategies** in `strategies/builtin/*.json`. After finding the optimal trailing stop config:

### Workflow

```
1. Trailing Stop Optimization (current)
   └── Find best LONG/SHORT config

2. Strategy Screening
   └── Test all 106 with optimal config
   └── Filter: PnL > 0, Trades > 50, WinRate > 40%
   └── Result: ~30 strategies

3. Ranking
   └── Score = PnL×0.3 + Sharpe×0.4 + (1-DD)×0.3
   └── Validate with Walk-Forward
   └── Result: Top 15 strategies

4. Individual Optimization
   └── Optimize specific params per strategy
   └── Test filter combinations
   └── Validate with Monte Carlo
```

### CLI (TODO)

```bash
# Test all strategies
pnpm tsx src/cli/test-all-strategies.ts \
  --symbol BTCUSDT \
  --interval 2h \
  --start 2023-01-01 \
  --end 2026-01-31

# Optimize specific strategy
pnpm tsx src/cli/optimize-strategy.ts \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT
```

### Categories

| Category | Examples | ~Count |
|----------|----------|--------|
| Larry Williams | 9.1, 9.2, 9.3, 9.4 | 4 |
| Momentum | momentum-breakout-2025 | 15 |
| Mean Reversion | rsi-oversold-bounce | 12 |
| Trend Following | ema-crossover, supertrend | 20 |
| Breakout | range-breakout, keltner | 15 |
| Pattern | engulfing, three-bar | 10 |
| Divergence | rsi-divergence, macd | 8 |
| Volume/Order Flow | whale-accumulation | 10 |
| Other | scalping, grid-trading | 12 |

---

## Next Steps

1. ✅ Trailing stop optimization (running)
2. [ ] Test 106 strategies with optimal config
3. [ ] Select top 15-20 strategies
4. [ ] Individually optimize selected strategies
5. [ ] Apply best config as system default
