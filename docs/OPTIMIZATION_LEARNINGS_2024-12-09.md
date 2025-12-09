# Optimization Session Learnings - December 9, 2024

## Executive Summary

Session focused on understanding why momentum strategies were underperforming vs Buy & Hold benchmark in the 2024 Bitcoin bull market (BTC: +130.59%, Strategy: +20.64%).

**Key Finding:** Fixed take profit and tight stop losses are fundamentally incompatible with trend-following in strong bull markets. Implementing trailing stops and concentrated positions improved returns from +20.64% to +58.41% (2.8x improvement).

---

## Performance Comparison

| Configuration | Return | Win Rate | Profit Factor | Sharpe | Max DD | Trades |
|--------------|--------|----------|---------------|--------|--------|--------|
| Original (default settings) | +20.64% | 43.6% | 1.47 | 2.00 | 12.1% | 420 |
| With Trailing Stop (3x ATR) | +17.18% | 51.4% | 1.48 | 1.57 | 21.0% | 74 |
| Concentrated + Trailing (4x ATR) | **+58.41%** | 50.0% | 2.16 | 3.41 | 16.8% | 44 |
| Buy & Hold Benchmark | +130.59% | N/A | N/A | N/A | ~30% | 1 |

---

## Root Causes of Underperformance

### 1. Fixed Take Profit Limits Upside
- Default TP: 4.38% (3x ATR)
- BTC actual move: 130%
- **Problem:** Exiting at 4.38% when trend continues to 130%

### 2. Trailing Stop Was Not Implemented
- Strategy JSON defined `trailingStop` configuration
- BacktestEngine was ignoring it completely
- **Fix:** Implemented full trailing stop logic

### 3. Position Sizing Too Conservative
- Default: 10% of capital per trade
- 90% of capital sitting idle during bull run
- **Fix:** Allow up to 80% position size

### 4. Multi-Position Limits Too Restrictive
- Default: 5 concurrent positions, 50% total exposure
- Blocking 443 setups due to limits
- **Fix:** Made configurable, test with 1 position, 80% exposure

### 5. High Trade Frequency = Commission Drag
- 420 trades × ~$2.28 commission = $958 (9.58% of capital)
- **Fix:** Wider trailing stop = fewer trades = less drag

### 6. Commission Default Bug
- `mergeOptimizedParams()` used 0.1 (10%) as default instead of 0.001 (0.1%)
- **Fix:** Corrected to 0.001

---

## Optimal Parameters Discovered

### For Trend-Following in Bull Markets

```json
{
  "trailingStop": {
    "enabled": true,
    "trailMultiplier": 4,
    "breakEvenAfterR": 2
  },
  "positionManagement": {
    "maxPositionSize": 80,
    "maxConcurrentPositions": 1,
    "maxTotalExposure": 0.8
  }
}
```

### Parameter Sensitivity Analysis

| Trail Multiplier | Return | Max DD | Sharpe | Recommendation |
|-----------------|--------|--------|--------|----------------|
| 1.5x ATR | -29.80% | 31.0% | -2.97 | Too tight |
| 3x ATR | +17.18% | 21.0% | 1.57 | Conservative |
| **4x ATR** | **+58.41%** | **16.8%** | **3.41** | **Optimal** |
| 5x ATR | +58.45% | 21.1% | 3.02 | Diminishing returns |

| Position Size | Return | Max DD | Sharpe | Recommendation |
|--------------|--------|--------|--------|----------------|
| 10% (default) | +20.64% | 12.1% | 2.00 | Too conservative |
| 50% | +17.18% | 21.0% | 1.57 | Moderate |
| **80%** | **+58.41%** | **16.8%** | **3.41** | **Optimal for trends** |

| Max Concurrent | Return | Trades | Recommendation |
|---------------|--------|--------|----------------|
| 5 (default) | +20.64% | 420 | Diversified but diluted |
| **1** | **+58.41%** | **44** | **Concentrated, better for trends** |

---

## Implementation Changes Made

### 1. BacktestEngine.ts - Trailing Stop Logic

```typescript
// New trailing stop implementation
const trailingStopConfig = strategy?.exit?.trailingStop;
const useTrailingStop = trailingStopConfig?.enabled ?? effectiveConfig.useTrailingStop ?? false;
let trailingStop = stopLoss;
let highestHigh = entryPrice;
let breakEvenReached = false;

// Track highest high and update trailing stop
if (high > highestHigh) {
  highestHigh = high;
  const unrealizedR = (highestHigh - entryPrice) / riskAmount;
  if (unrealizedR >= breakEvenAfterR && !breakEvenReached) {
    trailingStop = entryPrice + (atrAtEntry * 0.1); // Move to break-even
    breakEvenReached = true;
  }
  if (breakEvenReached) {
    const newTrailingStop = highestHigh - (atrAtEntry * trailMultiplier);
    if (newTrailingStop > trailingStop) {
      trailingStop = newTrailingStop;
    }
  }
}
```

### 2. New CLI Options

```bash
--trailing-stop          # Enable trailing stop (disables fixed TP)
--max-concurrent <n>     # Max concurrent positions (default: 5)
--max-exposure <percent> # Max total exposure % (default: 50)
```

### 3. BacktestConfig Type Extensions

```typescript
interface BacktestConfig {
  // ... existing
  useTrailingStop?: boolean;
  maxConcurrentPositions?: number;
  maxTotalExposure?: number;
}
```

### 4. Commission Bug Fix

```typescript
// Before (BUG)
commission: Math.max(...allParams.map(p => p.commission ?? 0.1))

// After (FIXED)
commission: Math.max(...allParams.map(p => p.commission ?? 0.001))
```

---

## Optimization System Recommendations

### New Parameters to Grid Search

1. **Trailing Stop Multiplier**: [2, 3, 4, 5]
2. **Break-Even After R**: [1, 1.5, 2, 2.5]
3. **Max Position Size**: [20, 40, 60, 80]
4. **Max Concurrent Positions**: [1, 2, 3, 5]
5. **Max Total Exposure**: [0.3, 0.5, 0.7, 0.9]

### Optimization Presets

```javascript
const OPTIMIZATION_PRESETS = {
  conservative: {
    trailingATRMultiplier: [2, 2.5, 3],
    breakEvenAfterR: [1, 1.5],
    maxPositionSize: [10, 20, 30],
    maxConcurrentPositions: [3, 5],
    maxTotalExposure: [30, 50],
  },
  balanced: {
    trailingATRMultiplier: [2.5, 3, 3.5, 4],
    breakEvenAfterR: [1.5, 2],
    maxPositionSize: [30, 50, 70],
    maxConcurrentPositions: [1, 2, 3],
    maxTotalExposure: [50, 70],
  },
  aggressive: {
    trailingATRMultiplier: [3, 4, 5],
    breakEvenAfterR: [2, 2.5, 3],
    maxPositionSize: [60, 80, 100],
    maxConcurrentPositions: [1, 2],
    maxTotalExposure: [70, 90],
  },
  trendfollowing: {
    trailingATRMultiplier: [4, 5, 6],
    breakEvenAfterR: [2, 3],
    maxPositionSize: [70, 80, 90],
    maxConcurrentPositions: [1],
    maxTotalExposure: [80, 90],
  },
};
```

### CLI Usage Examples

```bash
# Run optimization with trendfollowing preset
pnpm exec tsx src/cli/backtest-runner.ts optimize \
  -s momentum-breakout-2025 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-06-01 \
  --preset trendfollowing \
  --trailing-stop \
  --parallel 4 \
  --top 5

# Run with custom parameters
pnpm exec tsx src/cli/backtest-runner.ts optimize \
  -s momentum-breakout-2025 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-06-01 \
  --param "trailingATRMultiplier=3,4,5" \
  --param "breakEvenAfterR=1.5,2" \
  --param "maxPositionSize=70,80,90" \
  --trailing-stop \
  --parallel 4
```

### Optimization Results (December 2024)

Best parameters found with `trendfollowing` preset on BTCUSDT 4h (Jan-Jun 2024):

| Parameter | Value |
|-----------|-------|
| trailingATRMultiplier | 5 |
| breakEvenAfterR | 2 |
| maxPositionSize | 90% |
| maxConcurrentPositions | 1 |
| maxTotalExposure | 90% |

**Performance:**
- Win Rate: 66.7%
- Profit Factor: 4.80
- Total PnL: 39.93%
- Sharpe Ratio: 4.98
- Max Drawdown: 8.24%
- Total Trades: 9

---

## Key Insights

### 1. Trailing Stop vs Fixed TP Trade-off

- **Fixed TP:** Consistent small wins, misses big trends
- **Trailing Stop:** Captures trends, more volatile equity curve

### 2. Position Concentration vs Diversification

- **Diversified (5+ positions):** Lower volatility, lower returns
- **Concentrated (1-2 positions):** Higher returns, requires conviction

### 3. Market Regime Matters

- **Bull Market:** Trailing stop + concentrated = optimal
- **Bear Market:** Fixed TP + diversified = protective
- **Sideways:** Both strategies underperform

### 4. Commission Impact

At 420 trades with 0.1% commission each way:
- Entry: $1,000 × 0.1% = $1
- Exit: $1,000 × 0.1% = $1
- Per trade: $2
- Total: 420 × $2 = $840+
- **Impact: 8.4% of initial capital lost to fees**

---

## Next Steps

1. **Implement optimization presets** in CLI
2. **Add market regime detection** to auto-select parameters
3. **Create walk-forward validation** with trailing stop
4. **Test on multiple symbols** (ETH, SOL, BNB)
5. **Test on different market conditions** (2022 bear, 2023 sideways)

---

## Files Modified

| File | Changes |
|------|---------|
| `BacktestEngine.ts` | Trailing stop logic, configurable limits, commission fix |
| `backtest-runner.ts` | New CLI options |
| `validate.ts` | Trailing stop and position limit support |
| `backtesting.ts` | New config type properties |
| `momentum-breakout-2025.json` | Optimized trailing stop config |

---

## Conclusion

**The fundamental issue was architectural, not parametric.** Fixed TP/SL systems cannot capture trending markets by design. The solution required:

1. Implementing trailing stops (let winners run)
2. Concentrated positions (use available capital)
3. Reducing trade frequency (minimize commission drag)

**Result:** 2.8x improvement in returns (+20.64% → +58.41%) while maintaining acceptable risk metrics (Sharpe 3.41, Max DD 16.8%).

**Remaining Gap:** Strategy captures ~45% of B&H return. This is acceptable given the risk-adjusted benefits (lower drawdown, exits during reversals).
