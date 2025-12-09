# Optimization Results Summary - December 9, 2024

## Test Period
- Symbol: BTCUSDT
- Period: Jan 1, 2024 - Oct 1, 2024
- Timeframes: 1d and 4h

---

## TOP PERFORMING STRATEGIES

### Tier 1: Excellent Results (>50% PnL)

| Strategy | Timeframe | PnL% | Win Rate | Profit Factor | Sharpe | Best Parameters |
|----------|-----------|------|----------|---------------|--------|-----------------|
| **momentum-breakout-2025** | 4h | 82.41% | 57.9% | 4.86 | 5.75 | ATR×5, BE@3R, 80% pos, 90% exp |
| **ema-crossover** | 4h | 63.33% | 80.0% | 12.88 | 9.54 | ATR×6, BE@2R, 90% pos, 90% exp |
| **nr7-breakout** | 4h | 61.35% | 54.5% | 4.80 | 5.93 | ATR×5, BE@2R, 90% pos, 90% exp |

### Tier 2: Good Results (30-50% PnL)

| Strategy | Timeframe | PnL% | Win Rate | Profit Factor | Sharpe | Best Parameters |
|----------|-----------|------|----------|---------------|--------|-----------------|
| **order-block-fvg** | 4h | 47.98% | 50.0% | 2.56 | 3.67 | ATR×5, BE@3R, 80% pos, 90% exp |
| **trend-pullback-2025** | 4h | 45.78% | 46.2% | 2.23 | 3.68 | ATR×6, BE@3R, 80% pos, 80% exp |
| **triple-ema-confluence** | 4h | 40.48% | 44.8% | 2.05 | 4.01 | ATR×4, BE@3R, 80% pos, 80% exp |
| **vwap-pullback** | 4h | 36.19% | 50.0% | 3.01 | 5.77 | ATR×4, BE@3R, 90% pos, 90% exp |
| **bear-trap** | 4h | 34.58% | 38.5% | 1.63 | 2.63 | ATR×2.5, BE@1.5R, 70% pos, 70% exp |
| **donchian-breakout** | 4h | 32.64% | 41.4% | 1.80 | 2.40 | ATR×5, BE@2R, 80% pos, 80% exp |
| **triple-confirmation-reversal** | 4h | 31.81% | 16.7% | 3.37 | 4.55 | ATR×5, BE@2R, 90% pos, 90% exp |

### Tier 3: Moderate Results (10-30% PnL)

| Strategy | Timeframe | PnL% | Win Rate | Profit Factor | Sharpe | Best Parameters |
|----------|-----------|------|----------|---------------|--------|-----------------|
| keltner-breakout-optimized | 1d | 20.12% | 44.4% | 2.00 | 3.85 | ATR×5, BE@2R, 90% pos, 90% exp |
| divergence-rsi-macd | 4h | 15.58% | 40.0% | 1.42 | 1.70 | ATR×2.5, BE@1.5R, 50% pos, 50% exp |
| 7day-momentum-crypto | 4h | 15.79% | 60.0% | 4.51 | 5.12 | ATR×5, BE@2R, 90% pos, 90% exp |
| breakout-retest | 4h | 14.19% | 60.0% | 5.35 | 9.65 | ATR×4, BE@2R, 90% pos, 90% exp |
| pin-inside-combo | 4h | 13.98% | 50.0% | 8.95 | 8.79 | ATR×5, BE@2R, 90% pos, 90% exp |
| liquidity-sweep | 4h | 13.43% | 38.1% | 1.33 | 1.13 | ATR×6, BE@2R, 90% pos, 90% exp |
| connors-rsi2-original | 1d | 12.81% | 70.5% | 1.54 | 1.99 | ATR×2.5, BE@1.5R, 70% pos, 70% exp |
| rsi-oversold-bounce | 1d | 10.99% | 73.3% | 1.92 | 4.08 | ATR×2.5, BE@1.5R, 50% pos, 50% exp |
| enhanced-trend-following | 4h | 10.44% | 46.7% | 1.76 | 2.22 | ATR×5, BE@3R, 80% pos, 80% exp |

### Tier 4: Marginal/Poor Results (<10% PnL or negative)

| Strategy | Timeframe | PnL% | Issue |
|----------|-----------|------|-------|
| pattern-123-reversal | 4h | 8.93% | Low win rate (26.7%) |
| supertrend-follow | 4h | 4.58% | Low win rate (33.3%) |
| larry-williams-9-4 | 4h | 3.68% | Few trades (5) |
| rsi-divergence-trend | 4h | 1.42% | Low returns |
| larry-williams-9-2 | 4h | 0.05% | Break-even |
| mean-reversion-bb-rsi | 1d | 0.00% | No trades |
| rsi2-mean-reversion | 1d | -8.17% | Negative |
| cci-optimized-daily | 1d | -3.34% | Negative |
| larry-williams-9-1 | 1d | -20.66% | Significant loss |
| larry-williams-9-3 | 4h | -10.57% | Significant loss |
| williams-momentum | 1d | -5.96% | Negative |
| adx-ema-trend | 1d | -12.09% | No trades in bull period |
| bull-trap | 4h | -8.07% | No trades in bull period |
| keltner-squeeze | 4h | -13.55% | Poor performance |

---

## OPTIMAL PARAMETERS BY STRATEGY TYPE

### Trend-Following (Bull Market)
Best for capturing strong trends:
```
trailingATRMultiplier: 5-6
breakEvenAfterR: 2-3
maxPositionSize: 80-90%
maxConcurrentPositions: 1
maxTotalExposure: 80-90%
```

### Mean-Reversion
Best for range-bound/sideways markets:
```
trailingATRMultiplier: 2.5-3
breakEvenAfterR: 1.5-2
maxPositionSize: 50-70%
maxConcurrentPositions: 1-3
maxTotalExposure: 50-70%
```

---

## KEY INSIGHTS

### 1. Trailing Stop Multiplier Impact
- **Tight (2-3x ATR)**: Better for mean-reversion, worse for trends
- **Wide (5-6x ATR)**: Captures more of the trend, reduces trade frequency

### 2. Break-Even Timing
- **Early (1.5R)**: Protects profits faster, may exit winners too soon
- **Late (3R)**: Lets winners run longer, accepts more drawdown

### 3. Position Concentration
- **Single position (maxConcurrent=1)**: Best for trending markets
- **Multiple positions**: Better for diversification in uncertain conditions

### 4. Exposure Levels
- **High (80-90%)**: Maximizes returns in trending markets
- **Conservative (50-70%)**: Reduces drawdown in volatile conditions

---

## RECOMMENDATIONS

### For Bull Markets (like 2024)
Use these strategies:
1. **momentum-breakout-2025** (82.41% return)
2. **ema-crossover** (63.33% return)
3. **nr7-breakout** (61.35% return)
4. **order-block-fvg** (47.98% return)

Configuration:
- `trendfollowing` preset
- `--trailing-stop` enabled
- High position size (80-90%)
- Single concurrent position

### For Uncertain/Sideways Markets
Use these strategies:
1. **connors-rsi2-original** (70.5% win rate)
2. **rsi-oversold-bounce** (73.3% win rate)
3. **divergence-rsi-macd** (consistent 15% return)

Configuration:
- `balanced` preset
- Moderate position size (50-70%)
- Allow 2-3 concurrent positions

---

## CLI Command Examples

### Run Best Strategy
```bash
pnpm exec tsx src/cli/backtest-runner.ts validate \
  -s momentum-breakout-2025 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-10-01 \
  --trailing-stop \
  --max-position 80 \
  --max-concurrent 1 \
  --max-exposure 90
```

### Run Optimization
```bash
pnpm exec tsx src/cli/backtest-runner.ts optimize \
  -s momentum-breakout-2025 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-10-01 \
  --preset trendfollowing \
  --trailing-stop \
  --parallel 4 \
  --top 5
```

---

## Files Generated

All optimization results saved to:
`/apps/backend/results/optimizations/`

Format: `{strategy}_{symbol}_{interval}_{timestamp}.json`
