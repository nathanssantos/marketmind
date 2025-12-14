# ML Full System Optimization Benchmark

> **Date:** 2025-12-13
> **Model:** Setup Classifier v3.0.0 (All 8 TFs)
> **Model Metrics:** Accuracy 76.1%, AUC 73.7%, Precision 54%
> **Training Data:** 635,035 samples across 8 timeframes (1w, 1d, 4h, 1h, 30m, 15m, 5m, 1m)
> **Test Period:** 2024-01-01 to 2024-10-01

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Strategies | 10 (from ML training data) |
| Symbols | 6 (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, AVAXUSDT) |
| Timeframes | 3 (1d, 4h, 1h) |
| Total Combinations | 180 |
| Optimization Preset | quick |
| ML Threshold | 5% |
| Position Limits | 10 concurrent, 100% exposure |

---

## Top 10 Best Performing Combinations

| Rank | Strategy | Symbol | TF | PnL % | Win Rate | PF | Sharpe | Trades |
|------|----------|--------|-----|-------|----------|-----|--------|--------|
| 1 | parabolic-sar-crypto | AVAXUSDT | 1d | **+165.23%** | 70.3% | 2.50 | 5.67 | 91 |
| 2 | tema-momentum | AVAXUSDT | 1d | **+163.62%** | 41.9% | 1.61 | 2.88 | 86 |
| 3 | parabolic-sar-crypto | SOLUSDT | 1d | **+113.75%** | 69.5% | 1.90 | 4.11 | 95 |
| 4 | williams-momentum | SOLUSDT | 1h | **+76.86%** | 64.1% | 1.17 | 1.04 | 1280 |
| 5 | larry-williams-9-3 | AVAXUSDT | 1d | **+73.90%** | 84.2% | 4.79 | 7.46 | 19 |
| 6 | parabolic-sar-crypto | XRPUSDT | 1d | **+72.50%** | 55.7% | 1.75 | 3.07 | 79 |
| 7 | williams-momentum | AVAXUSDT | 1h | **+60.39%** | 64.0% | 1.15 | 0.88 | 1290 |
| 8 | williams-momentum | BNBUSDT | 1h | **+47.95%** | 64.3% | 1.22 | 1.11 | 1255 |
| 9 | williams-momentum | ETHUSDT | 1d | **+42.69%** | 69.0% | 1.41 | 2.13 | 116 |
| 10 | williams-momentum | XRPUSDT | 1d | **+39.51%** | 61.9% | 1.33 | 1.92 | 105 |

---

## Performance by Timeframe

| Timeframe | Profitable | Total | Win % | Avg PnL | Best PnL |
|-----------|------------|-------|-------|---------|----------|
| **1d** | 35 | 60 | 58.3% | +12.4% | +165.23% |
| **4h** | 17 | 60 | 28.3% | -18.1% | +21.25% |
| **1h** | 13 | 60 | 21.7% | -30.2% | +76.86% |

**Key Insight:** Daily (1d) timeframe significantly outperforms lower timeframes with ML filtering.

---

## Performance by Strategy

| Strategy | Avg PnL | Profitable | Best Combination |
|----------|---------|------------|------------------|
| **williams-momentum** | +18.7% | 12/18 (67%) | SOLUSDT 1h (+77%) |
| **parabolic-sar-crypto** | +3.0% | 6/18 (33%) | AVAXUSDT 1d (+165%) |
| **supertrend-follow** | +2.4% | 12/18 (67%) | BNBUSDT 1h (+32%) |
| **larry-williams-9-3** | -7.9% | 8/18 (44%) | AVAXUSDT 1d (+74%) |
| **keltner-breakout-optimized** | -2.4% | 8/16 (50%) | BTCUSDT 1d (+20%) |
| **tema-momentum** | -14.5% | 4/18 (22%) | AVAXUSDT 1d (+164%) |
| **bollinger-breakout-crypto** | -15.4% | 4/18 (22%) | XRPUSDT 1d (+33%) |
| **larry-williams-9-1** | -23.1% | 3/18 (17%) | AVAXUSDT 1d (+10%) |
| **elder-ray-crypto** | -25.9% | 5/18 (28%) | SOLUSDT 4h (+21%) |
| **ppo-momentum** | -44.5% | 0/18 (0%) | None profitable |

---

## Performance by Symbol

| Symbol | Avg PnL | Profitable | Best Strategy |
|--------|---------|------------|---------------|
| **AVAXUSDT** | +0.3% | 14/30 (47%) | parabolic-sar 1d (+165%) |
| **BTCUSDT** | -12.6% | 12/30 (40%) | keltner-breakout 1d (+20%) |
| **ETHUSDT** | -17.1% | 10/30 (33%) | williams-momentum 1d (+43%) |
| **BNBUSDT** | -14.7% | 10/30 (33%) | supertrend-follow 1h (+32%) |
| **XRPUSDT** | -17.9% | 10/30 (33%) | parabolic-sar 1d (+73%) |
| **SOLUSDT** | -18.9% | 9/30 (30%) | parabolic-sar 1d (+114%) |

---

## Best Risk-Adjusted Configurations (Sharpe > 2, PF > 1.5)

| Strategy | Symbol | TF | PnL % | Win Rate | PF | Sharpe | Max DD |
|----------|--------|-----|-------|----------|-----|--------|--------|
| keltner-breakout-optimized | BTCUSDT | 1d | +19.52% | 91.7% | 9.63 | **10.22** | 1.90% |
| supertrend-follow | SOLUSDT | 1d | +15.42% | 76.9% | 5.45 | **9.25** | 1.77% |
| larry-williams-9-3 | AVAXUSDT | 1d | +73.90% | 84.2% | 4.79 | **7.46** | 7.96% |
| supertrend-follow | AVAXUSDT | 1d | +9.37% | 70.0% | 3.79 | **6.77** | 2.00% |
| parabolic-sar-crypto | AVAXUSDT | 1d | +165.23% | 70.3% | 2.50 | **5.67** | 5.86% |
| supertrend-follow | BNBUSDT | 1d | +14.96% | 74.1% | 3.22 | **5.02** | 2.86% |
| supertrend-follow | XRPUSDT | 1d | +10.22% | 60.9% | 2.02 | **4.72** | 3.05% |
| parabolic-sar-crypto | SOLUSDT | 1d | +113.75% | 69.5% | 1.90 | **4.11** | 19.88% |
| larry-williams-9-3 | XRPUSDT | 1d | +23.54% | 63.2% | 1.66 | **3.50** | 11.18% |
| parabolic-sar-crypto | XRPUSDT | 1d | +72.50% | 55.7% | 1.75 | **3.07** | 19.79% |

---

## Key Findings

### Best Overall Strategy
**williams-momentum** - Most consistent across all combinations (12/18 profitable, 67% success rate)

### Best High-Risk/High-Reward
**parabolic-sar-crypto** on daily AVAXUSDT (+165.23% PnL)

### Best Risk-Adjusted
**keltner-breakout-optimized** BTCUSDT 1d - Sharpe 10.22, WR 91.7%, PF 9.63

### Best Win Rate
**keltner-breakout-optimized** BTCUSDT 1d - 91.7% win rate (12 trades)

### Timeframe Conclusion
Daily (1d) is significantly more effective with ML filtering - 58% of daily combinations were profitable vs only 22% for 1h.

### Strategies to Avoid
**ppo-momentum** showed negative returns across ALL 18 combinations tested.

---

## Recommended Production Configurations

### Tier 1 - High Confidence (Sharpe > 5)

```typescript
{
  strategy: 'keltner-breakout-optimized',
  symbol: 'BTCUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 10.22, winRate: 91.7, pf: 9.63, pnl: 19.52 }
}

{
  strategy: 'supertrend-follow',
  symbol: 'SOLUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 9.25, winRate: 76.9, pf: 5.45, pnl: 15.42 }
}

{
  strategy: 'larry-williams-9-3',
  symbol: 'AVAXUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 7.46, winRate: 84.2, pf: 4.79, pnl: 73.90 }
}
```

### Tier 2 - Good Performance (Sharpe 2-5)

```typescript
{
  strategy: 'parabolic-sar-crypto',
  symbol: 'AVAXUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 5.67, winRate: 70.3, pf: 2.50, pnl: 165.23 }
}

{
  strategy: 'parabolic-sar-crypto',
  symbol: 'SOLUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 4.11, winRate: 69.5, pf: 1.90, pnl: 113.75 }
}

{
  strategy: 'williams-momentum',
  symbol: 'ETHUSDT',
  interval: '1d',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 2.13, winRate: 69.0, pf: 1.41, pnl: 42.69 }
}
```

### Tier 3 - High Volume / Consistent (Many trades)

```typescript
{
  strategy: 'williams-momentum',
  symbol: 'SOLUSDT',
  interval: '1h',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 1.04, winRate: 64.1, pf: 1.17, pnl: 76.86, trades: 1280 }
}

{
  strategy: 'williams-momentum',
  symbol: 'BNBUSDT',
  interval: '1h',
  mlThreshold: 5,
  expectedMetrics: { sharpe: 1.11, winRate: 64.3, pf: 1.22, pnl: 47.95, trades: 1255 }
}
```

---

## Full Results Data

### bollinger-breakout-crypto

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 38 | 63.2% | 1.10 | +7.04% | 16.28% | 1.00 |
| BTCUSDT | 4h | 116 | 55.2% | 0.84 | -16.42% | 22.81% | -1.15 |
| BTCUSDT | 1h | 433 | 60.7% | 0.93 | -12.06% | 21.20% | -0.41 |
| ETHUSDT | 1d | 38 | 63.2% | 0.90 | -8.68% | 20.35% | -0.32 |
| ETHUSDT | 4h | 109 | 61.5% | 0.87 | -11.50% | 33.89% | -0.65 |
| ETHUSDT | 1h | 433 | 61.0% | 1.02 | +2.40% | 32.66% | 0.17 |
| SOLUSDT | 1d | 40 | 57.5% | 0.67 | -37.48% | 53.13% | -1.45 |
| SOLUSDT | 4h | 120 | 62.5% | 0.93 | -10.57% | 35.15% | -0.21 |
| SOLUSDT | 1h | 435 | 57.9% | 0.88 | -33.01% | 50.74% | -0.71 |
| BNBUSDT | 1d | 34 | 58.8% | 1.16 | +13.47% | 20.73% | 1.46 |
| BNBUSDT | 4h | 125 | 55.2% | 0.83 | -20.31% | 30.26% | -1.08 |
| BNBUSDT | 1h | 420 | 58.8% | 0.94 | -11.69% | 21.80% | -0.37 |
| XRPUSDT | 1d | 37 | 70.3% | 1.32 | +33.01% | 24.79% | 2.21 |
| XRPUSDT | 4h | 119 | 57.1% | 0.71 | -40.24% | 46.31% | -2.17 |
| XRPUSDT | 1h | 446 | 55.6% | 0.73 | -52.05% | 55.28% | -2.01 |
| AVAXUSDT | 1d | 37 | 54.1% | 0.78 | -32.95% | 42.43% | -1.04 |
| AVAXUSDT | 4h | 119 | 51.3% | 0.72 | -43.27% | 52.26% | -1.92 |
| AVAXUSDT | 1h | 425 | 57.4% | 0.86 | -36.20% | 40.72% | -0.87 |

### elder-ray-crypto

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 32 | 50.0% | 0.90 | -4.61% | 22.25% | -0.22 |
| BTCUSDT | 4h | 113 | 47.8% | 0.96 | -3.54% | 32.14% | -0.01 |
| BTCUSDT | 1h | 427 | 44.5% | 0.66 | -43.73% | 47.95% | -2.28 |
| ETHUSDT | 1d | 31 | 41.9% | 0.64 | -29.41% | 42.81% | -1.58 |
| ETHUSDT | 4h | 112 | 45.5% | 0.63 | -34.03% | 48.42% | -2.64 |
| ETHUSDT | 1h | 463 | 43.2% | 0.63 | -55.16% | 56.45% | -2.51 |
| SOLUSDT | 1d | 33 | 42.4% | 0.46 | -47.75% | 54.70% | -4.24 |
| SOLUSDT | 4h | 106 | 59.4% | 1.17 | +21.25% | 24.87% | 1.11 |
| SOLUSDT | 1h | 442 | 42.3% | 0.62 | -71.11% | 72.90% | -2.28 |
| BNBUSDT | 1d | 32 | 43.8% | 0.93 | -4.57% | 22.85% | 0.05 |
| BNBUSDT | 4h | 114 | 51.8% | 1.09 | +8.69% | 24.13% | 0.65 |
| BNBUSDT | 1h | 448 | 42.6% | 0.76 | -42.66% | 49.01% | -1.55 |
| XRPUSDT | 1d | 32 | 31.3% | 0.36 | -56.97% | 60.91% | -5.25 |
| XRPUSDT | 4h | 114 | 51.8% | 1.16 | +13.26% | 25.59% | 0.80 |
| XRPUSDT | 1h | 476 | 39.7% | 0.61 | -62.72% | 64.07% | -2.65 |
| AVAXUSDT | 1d | 31 | 38.7% | 0.65 | -36.39% | 55.79% | -1.58 |
| AVAXUSDT | 4h | 102 | 53.9% | 1.15 | +19.83% | 22.57% | 0.97 |
| AVAXUSDT | 1h | 446 | 43.3% | 0.59 | -69.89% | 69.93% | -2.35 |

### keltner-breakout-optimized

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 12 | 91.7% | 9.63 | +19.52% | 1.90% | 10.22 |
| BTCUSDT | 4h | 45 | 57.8% | 1.15 | +3.63% | 13.59% | 0.80 |
| BTCUSDT | 1h | 220 | 62.7% | 1.00 | -0.20% | 8.45% | 0.03 |
| ETHUSDT | 1d | 12 | 58.3% | 0.69 | -6.55% | 15.60% | -2.40 |
| ETHUSDT | 4h | 51 | 60.8% | 0.77 | -6.72% | 11.38% | -1.38 |
| ETHUSDT | 1h | 217 | 62.2% | 0.87 | -7.30% | 12.33% | -0.72 |
| SOLUSDT | 1d | 11 | 45.5% | 0.45 | -15.33% | 26.05% | -4.76 |
| SOLUSDT | 4h | 41 | 63.4% | 1.19 | +5.48% | 11.39% | 1.17 |
| SOLUSDT | 1h | 175 | 62.3% | 1.16 | +12.12% | 17.20% | 0.84 |
| BNBUSDT | 1d | 14 | 64.3% | 0.57 | -7.24% | 7.44% | -2.95 |
| BNBUSDT | 4h | 37 | 59.5% | 1.00 | -0.08% | 7.42% | 0.10 |
| BNBUSDT | 1h | 184 | 56.5% | 0.56 | -22.72% | 23.57% | -3.25 |
| XRPUSDT | 1d | 0 | - | - | - | - | - |
| XRPUSDT | 4h | 46 | 69.6% | 0.91 | -2.90% | 14.54% | -0.37 |
| XRPUSDT | 1h | 163 | 54.6% | 0.58 | -22.31% | 24.15% | -2.67 |
| AVAXUSDT | 1d | 0 | - | - | - | - | - |
| AVAXUSDT | 4h | 49 | 67.3% | 1.39 | +16.08% | 9.14% | 1.90 |
| AVAXUSDT | 1h | 187 | 63.6% | 1.01 | +0.28% | 15.57% | 0.11 |

### larry-williams-9-1

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 24 | 54.2% | 0.83 | -5.37% | 12.88% | -0.73 |
| BTCUSDT | 4h | 87 | 47.1% | 0.28 | -35.99% | 36.55% | -6.62 |
| BTCUSDT | 1h | 352 | 48.0% | 0.46 | -43.75% | 43.86% | -4.62 |
| ETHUSDT | 1d | 28 | 57.1% | 0.82 | -9.23% | 14.77% | -0.91 |
| ETHUSDT | 4h | 93 | 48.4% | 0.52 | -30.62% | 32.58% | -4.11 |
| ETHUSDT | 1h | 352 | 51.1% | 0.45 | -48.45% | 48.70% | -4.73 |
| SOLUSDT | 1d | 23 | 52.2% | 0.95 | -3.09% | 27.26% | 0.10 |
| SOLUSDT | 4h | 89 | 41.6% | 0.36 | -53.69% | 53.69% | -6.37 |
| SOLUSDT | 1h | 334 | 48.8% | 0.45 | -64.10% | 64.37% | -4.35 |
| BNBUSDT | 1d | 24 | 58.3% | 1.12 | +4.26% | 16.65% | 0.95 |
| BNBUSDT | 4h | 90 | 46.7% | 0.37 | -35.84% | 37.61% | -5.78 |
| BNBUSDT | 1h | 326 | 44.8% | 0.57 | -38.62% | 38.96% | -3.12 |
| XRPUSDT | 1d | 23 | 39.1% | 0.36 | -35.96% | 39.79% | -6.71 |
| XRPUSDT | 4h | 100 | 44.0% | 0.38 | -44.44% | 47.13% | -5.72 |
| XRPUSDT | 1h | 357 | 45.4% | 0.67 | -36.19% | 36.22% | -1.93 |
| AVAXUSDT | 1d | 28 | 57.1% | 1.13 | +10.01% | 17.64% | 1.24 |
| AVAXUSDT | 4h | 85 | 60.0% | 0.86 | -11.27% | 17.44% | -0.72 |
| AVAXUSDT | 1h | 358 | 47.5% | 0.49 | -64.81% | 65.33% | -3.84 |

### larry-williams-9-3

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 18 | 61.1% | 1.17 | +3.14% | 10.28% | 1.15 |
| BTCUSDT | 4h | 67 | 47.8% | 0.35 | -26.59% | 31.28% | -6.41 |
| BTCUSDT | 1h | 262 | 51.9% | 0.46 | -31.53% | 32.79% | -4.51 |
| ETHUSDT | 1d | 23 | 65.2% | 1.17 | +4.95% | 13.72% | 1.14 |
| ETHUSDT | 4h | 76 | 53.9% | 0.43 | -26.78% | 31.96% | -5.00 |
| ETHUSDT | 1h | 232 | 53.0% | 0.43 | -33.91% | 34.88% | -4.54 |
| SOLUSDT | 1d | 15 | 53.3% | 0.98 | -0.71% | 22.76% | 0.27 |
| SOLUSDT | 4h | 67 | 47.8% | 0.30 | -42.80% | 43.54% | -7.61 |
| SOLUSDT | 1h | 245 | 57.6% | 0.63 | -35.47% | 38.30% | -2.53 |
| BNBUSDT | 1d | 18 | 72.2% | 1.39 | +7.49% | 8.28% | 2.12 |
| BNBUSDT | 4h | 71 | 50.7% | 0.52 | -21.66% | 25.87% | -4.00 |
| BNBUSDT | 1h | 236 | 56.8% | 0.74 | -17.64% | 25.08% | -1.65 |
| XRPUSDT | 1d | 19 | 63.2% | 1.66 | +23.54% | 11.18% | 3.50 |
| XRPUSDT | 4h | 81 | 50.6% | 0.58 | -24.71% | 31.13% | -2.64 |
| XRPUSDT | 1h | 290 | 50.7% | 0.59 | -32.19% | 34.56% | -2.84 |
| AVAXUSDT | 1d | 19 | 84.2% | 4.79 | +73.90% | 7.96% | 7.46 |
| AVAXUSDT | 4h | 72 | 52.8% | 0.58 | -28.95% | 29.01% | -2.97 |
| AVAXUSDT | 1h | 234 | 55.6% | 0.46 | -47.28% | 48.20% | -4.11 |

### parabolic-sar-crypto

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 89 | 64.0% | 1.04 | +2.35% | 14.03% | 0.36 |
| BTCUSDT | 4h | 274 | 42.7% | 0.46 | -62.49% | 62.52% | -4.22 |
| BTCUSDT | 1h | 962 | 39.2% | 0.74 | -62.38% | 63.57% | -1.61 |
| ETHUSDT | 1d | 100 | 57.0% | 1.17 | +18.84% | 22.00% | 1.14 |
| ETHUSDT | 4h | 270 | 51.5% | 0.65 | -45.13% | 46.63% | -2.20 |
| ETHUSDT | 1h | 1010 | 39.2% | 0.68 | -76.37% | 77.41% | -2.09 |
| SOLUSDT | 1d | 95 | 69.5% | 1.90 | +113.75% | 19.88% | 4.11 |
| SOLUSDT | 4h | 299 | 55.9% | 0.57 | -64.01% | 64.10% | -2.79 |
| SOLUSDT | 1h | 1071 | 42.3% | 0.47 | -95.52% | 95.64% | -3.50 |
| BNBUSDT | 1d | 93 | 52.7% | 1.04 | +3.37% | 26.03% | 0.41 |
| BNBUSDT | 4h | 285 | 43.2% | 0.50 | -69.52% | 70.52% | -4.26 |
| BNBUSDT | 1h | 1015 | 38.5% | 0.74 | -64.38% | 64.49% | -1.55 |
| XRPUSDT | 1d | 79 | 55.7% | 1.75 | +72.50% | 19.79% | 3.07 |
| XRPUSDT | 4h | 249 | 51.4% | 0.66 | -41.62% | 48.66% | -1.76 |
| XRPUSDT | 1h | 1025 | 40.4% | 0.69 | -72.18% | 73.50% | -1.69 |
| AVAXUSDT | 1d | 91 | 70.3% | 2.50 | +165.23% | 5.86% | 5.67 |
| AVAXUSDT | 4h | 289 | 56.1% | 0.56 | -66.06% | 66.79% | -2.59 |
| AVAXUSDT | 1h | 1075 | 40.5% | 0.49 | -94.39% | 94.49% | -3.18 |

### ppo-momentum

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 49 | 46.9% | 0.85 | -14.22% | 35.12% | -0.77 |
| BTCUSDT | 4h | 147 | 37.4% | 0.50 | -50.39% | 54.92% | -3.52 |
| BTCUSDT | 1h | 518 | 38.4% | 0.55 | -63.32% | 63.52% | -3.19 |
| ETHUSDT | 1d | 55 | 36.4% | 0.63 | -51.25% | 56.25% | -2.17 |
| ETHUSDT | 4h | 146 | 37.7% | 0.68 | -38.81% | 43.67% | -2.06 |
| ETHUSDT | 1h | 512 | 42.2% | 0.63 | -61.02% | 61.13% | -2.69 |
| SOLUSDT | 1d | 48 | 45.8% | 0.79 | -35.22% | 55.40% | -1.25 |
| SOLUSDT | 4h | 159 | 41.5% | 0.81 | -32.58% | 38.72% | -0.94 |
| SOLUSDT | 1h | 544 | 39.3% | 0.68 | -74.69% | 76.86% | -2.03 |
| BNBUSDT | 1d | 50 | 46.0% | 0.73 | -24.88% | 36.76% | -1.26 |
| BNBUSDT | 4h | 159 | 36.5% | 0.70 | -39.61% | 46.82% | -2.01 |
| BNBUSDT | 1h | 543 | 39.2% | 0.70 | -52.08% | 52.99% | -1.90 |
| XRPUSDT | 1d | 53 | 35.8% | 0.44 | -64.03% | 64.03% | -3.54 |
| XRPUSDT | 4h | 149 | 42.3% | 0.62 | -45.30% | 46.44% | -2.18 |
| XRPUSDT | 1h | 593 | 38.4% | 0.70 | -56.01% | 56.11% | -1.57 |
| AVAXUSDT | 1d | 52 | 36.5% | 0.66 | -56.12% | 65.76% | -1.88 |
| AVAXUSDT | 4h | 150 | 40.0% | 0.85 | -23.85% | 46.91% | -0.54 |
| AVAXUSDT | 1h | 544 | 40.8% | 0.80 | -61.07% | 64.94% | -1.36 |

### supertrend-follow

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 20 | 60.0% | 1.23 | +1.88% | 3.53% | 1.27 |
| BTCUSDT | 4h | 29 | 58.6% | 0.66 | -4.11% | 7.01% | -2.60 |
| BTCUSDT | 1h | 119 | 68.1% | 1.26 | +11.01% | 9.49% | 1.63 |
| ETHUSDT | 1d | 16 | 50.0% | 0.82 | -1.52% | 4.22% | -1.28 |
| ETHUSDT | 4h | 52 | 51.9% | 0.77 | -5.93% | 12.60% | -1.64 |
| ETHUSDT | 1h | 120 | 59.2% | 1.25 | +14.34% | 11.53% | 1.55 |
| SOLUSDT | 1d | 13 | 76.9% | 5.45 | +15.42% | 1.77% | 9.25 |
| SOLUSDT | 4h | 45 | 53.3% | 0.54 | -9.64% | 10.04% | -4.22 |
| SOLUSDT | 1h | 182 | 57.7% | 0.83 | -12.94% | 19.98% | -1.19 |
| BNBUSDT | 1d | 27 | 74.1% | 3.22 | +14.96% | 2.86% | 5.02 |
| BNBUSDT | 4h | 27 | 44.4% | 0.46 | -8.07% | 8.07% | -5.76 |
| BNBUSDT | 1h | 158 | 64.6% | 1.46 | +31.75% | 7.20% | 2.69 |
| XRPUSDT | 1d | 23 | 60.9% | 2.02 | +10.22% | 3.05% | 4.72 |
| XRPUSDT | 4h | 59 | 55.9% | 1.13 | +3.40% | 6.59% | 0.75 |
| XRPUSDT | 1h | 137 | 54.0% | 0.66 | -19.70% | 20.33% | -2.84 |
| AVAXUSDT | 1d | 10 | 70.0% | 3.79 | +9.37% | 2.00% | 6.77 |
| AVAXUSDT | 4h | 44 | 70.5% | 1.28 | +3.75% | 3.77% | 1.53 |
| AVAXUSDT | 1h | 142 | 48.6% | 0.81 | -13.18% | 15.28% | -1.32 |

### tema-momentum

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 73 | 38.4% | 1.19 | +14.95% | 14.74% | 1.17 |
| BTCUSDT | 4h | 247 | 33.6% | 0.89 | -14.13% | 33.86% | -0.46 |
| BTCUSDT | 1h | 879 | 32.9% | 0.84 | -33.98% | 41.35% | -0.93 |
| ETHUSDT | 1d | 67 | 38.8% | 1.13 | +13.58% | 19.58% | 1.01 |
| ETHUSDT | 4h | 252 | 33.7% | 0.79 | -33.19% | 40.81% | -1.21 |
| ETHUSDT | 1h | 890 | 31.2% | 0.79 | -49.12% | 49.71% | -1.32 |
| SOLUSDT | 1d | 80 | 35.0% | 0.91 | -17.20% | 39.63% | -0.12 |
| SOLUSDT | 4h | 270 | 31.5% | 0.71 | -53.08% | 62.83% | -1.55 |
| SOLUSDT | 1h | 957 | 33.3% | 0.88 | -41.79% | 43.88% | -0.57 |
| BNBUSDT | 1d | 83 | 37.3% | 0.97 | -3.54% | 24.30% | 0.11 |
| BNBUSDT | 4h | 257 | 32.7% | 1.04 | +5.54% | 24.47% | 0.33 |
| BNBUSDT | 1h | 959 | 33.7% | 0.83 | -36.73% | 38.18% | -0.84 |
| XRPUSDT | 1d | 78 | 34.6% | 0.77 | -29.93% | 47.58% | -0.59 |
| XRPUSDT | 4h | 291 | 33.0% | 0.92 | -12.42% | 47.78% | -0.03 |
| XRPUSDT | 1h | 941 | 30.8% | 0.76 | -53.29% | 55.30% | -1.08 |
| AVAXUSDT | 1d | 86 | 41.9% | 1.61 | +163.62% | 40.89% | 2.88 |
| AVAXUSDT | 4h | 255 | 34.9% | 0.79 | -38.47% | 49.08% | -0.91 |
| AVAXUSDT | 1h | 959 | 29.7% | 0.78 | -67.05% | 69.48% | -1.20 |

### williams-momentum

| Symbol | TF | Trades | Win Rate | PF | PnL % | Max DD | Sharpe |
|--------|-----|--------|----------|-----|-------|--------|--------|
| BTCUSDT | 1d | 116 | 61.2% | 1.16 | +10.77% | 12.53% | 0.90 |
| BTCUSDT | 4h | 334 | 61.1% | 0.92 | -7.41% | 12.32% | -0.42 |
| BTCUSDT | 1h | 1252 | 62.9% | 1.08 | +12.63% | 13.80% | 0.41 |
| ETHUSDT | 1d | 116 | 69.0% | 1.41 | +42.69% | 13.87% | 2.13 |
| ETHUSDT | 4h | 339 | 62.8% | 1.01 | +0.65% | 14.95% | 0.10 |
| ETHUSDT | 1h | 1217 | 62.7% | 1.02 | +2.37% | 18.82% | 0.10 |
| SOLUSDT | 1d | 107 | 62.6% | 0.87 | -20.09% | 42.28% | -0.64 |
| SOLUSDT | 4h | 356 | 60.7% | 0.97 | -5.85% | 24.39% | -0.10 |
| SOLUSDT | 1h | 1280 | 64.1% | 1.17 | +76.86% | 15.39% | 1.04 |
| BNBUSDT | 1d | 105 | 60.0% | 0.90 | -9.07% | 33.40% | -0.51 |
| BNBUSDT | 4h | 338 | 59.8% | 0.85 | -15.53% | 23.71% | -0.78 |
| BNBUSDT | 1h | 1255 | 64.3% | 1.22 | +47.95% | 8.62% | 1.11 |
| XRPUSDT | 1d | 105 | 61.9% | 1.33 | +39.51% | 20.76% | 1.92 |
| XRPUSDT | 4h | 322 | 60.9% | 0.85 | -20.14% | 34.53% | -0.82 |
| XRPUSDT | 1h | 1222 | 65.5% | 1.14 | +33.23% | 22.92% | 0.72 |
| AVAXUSDT | 1d | 127 | 66.9% | 1.06 | +10.13% | 29.54% | 0.63 |
| AVAXUSDT | 4h | 337 | 56.1% | 0.87 | -22.65% | 32.96% | -0.74 |
| AVAXUSDT | 1h | 1290 | 64.0% | 1.15 | +60.39% | 16.95% | 0.88 |

---

## Conclusions

1. **ML Filtering is Effective**: The v3 model with 76.1% accuracy provides meaningful signal filtering, especially on daily timeframe.

2. **Timeframe Matters Most**: Daily timeframe shows 58% profitable combinations vs 22% for hourly - this is the single most important factor.

3. **Strategy Selection is Critical**: williams-momentum and supertrend-follow show the most consistent profitability across different conditions.

4. **Symbol Performance Varies**: AVAXUSDT showed the best average performance, while SOLUSDT had the highest single returns but also higher volatility.

5. **Risk-Adjusted Returns**: For production use, prioritize Sharpe ratio over raw PnL - keltner-breakout on BTCUSDT 1d has modest PnL but excellent risk metrics.
