# Backtest Results - December 2024

## Summary

After extensive backtesting of 12 setup detectors on BTCUSDT 4h (Jan-Dec 2024), only **3 strategies showed positive returns**. The others were removed from the codebase.

## Profitable Strategies (KEPT)

| Strategy | Trades | Win Rate | Total PnL | Sharpe | Profit Factor | Max DD |
|----------|--------|----------|-----------|--------|---------------|--------|
| **pattern123** | 70 | 42.86% | **+7.06%** | 5.00 | 1.63 | 2.83% |
| **bearTrap** | 88 | 35.23% | **+3.53%** | 2.61 | 1.22 | 3.17% |
| **meanReversion** | 35 | 31.43% | **+1.34%** | 2.03 | 1.39 | 1.40% |

## Removed Strategies (NEGATIVE)

| Strategy | Trades | Win Rate | Total PnL | Sharpe | Status |
|----------|--------|----------|-----------|--------|--------|
| setup91 | 52 | 30.77% | -7.44% | -5.53 | REMOVED |
| setup92 | 37 | 32.43% | -6.18% | -4.32 | REMOVED |
| setup93 | 44 | 31.82% | -5.84% | -3.43 | REMOVED |
| setup94 | 40 | 30.00% | -8.57% | -6.50 | REMOVED |
| bullTrap | 94 | 31.91% | -1.23% | -0.79 | REMOVED |
| breakoutRetest | 75 | 26.67% | -7.27% | -5.78 | REMOVED |
| divergence | 95 | 28.42% | -4.37% | -5.98 | REMOVED |
| pinInside | 0 | - | 0% | - | REMOVED (no signals) |
| vwapEmaCross | 103 | 36.89% | -7.56% | -6.48 | REMOVED |

## Test Configuration

```
Symbol: BTCUSDT
Interval: 4h
Period: 2024-01-01 to 2024-12-01
Initial Capital: $1,000
Max Position Size: 10%
Commission: 0.1%
Trend Filter: EMA200 (counter-trend trades skipped)
SL/TP: Algorithmic levels from setup detection
```

## Current Codebase State

### Active Detectors (3)
- `Pattern123Detector` - 123 reversal pattern
- `BearTrapDetector` - Counter-trend LONG on bear traps
- `MeanReversionDetector` - Bollinger Bands + RSI

### Removed Detectors (9)
- Setup91Detector, Setup92Detector, Setup93Detector, Setup94Detector
- BullTrapDetector, BreakoutRetestDetector
- DivergenceDetector, PinInsideDetector, VWAPEMACrossDetector

### Files Modified
- `apps/backend/src/services/setup-detection/SetupDetectionService.ts`
- `apps/backend/src/services/backtesting/BacktestEngine.ts`
- `apps/backend/src/cli/utils/validators.ts`
- `packages/types/src/setupConfig.ts`
- `packages/types/src/tradingSetup.ts`

## Running Backtests

```bash
# Validate a strategy
pnpm backtest:validate -s pattern123 --symbol BTCUSDT --interval 4h --start 2024-01-01 --end 2024-12-01 --capital 1000 --max-position 10 --commission 0.1 --use-algorithmic-levels

# Available strategies: pattern123, bearTrap, meanReversion
```

## Next Steps

1. **Optimize pattern123** - Best performer, room for parameter tuning
2. **Test on other pairs** - ETH, SOL, etc.
3. **Test on other timeframes** - 1h, 1d
4. **Combine strategies** - Portfolio approach with all 3
