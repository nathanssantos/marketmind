# 🧪 Testing and Validation Guide - MarketMind Strategies

## 📊 Quick Commands

### Optimize (full 3-stage pipeline)
```bash
pnpm optimize:full
```
**What it does:**
- Stage 1: Sensitivity sweep on parameters (Fibonacci targets, entry progress, R:R)
- Stage 2: Cross-product of the top Stage 1 combinations
- Stage 3: Trailing stop optimization on the best configs
- Supports resume (SIGINT/SIGTERM saves progress)

**Output:** `/tmp/prod-parity-optimization-run/` (summary.txt, optimal-config.json, CSVs)

---

## 🎯 Individual Tests

### Validate a specific strategy
```bash
npm run backtest:validate -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --optimized
```

### Optimize parameters for a strategy
```bash
npm run backtest:optimize -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param rsiEntry=5,10,15,20 \
  --param rsiExit=50,60,70,80 \
  --parallel 4 \
  --top 10 \
  --sort-by profitFactor
```

### Walk-Forward Analysis
```bash
npm run backtest:walkforward -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2023-01-01 \
  --end 2024-12-01 \
  --train-period 180 \
  --test-period 30
```

### Monte Carlo Simulation
```bash
npm run backtest:montecarlo -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --simulations 1000
```

---

## 📁 Results Structure

```
results/
├── bulk-validation-2024-12-09/
│   ├── connors-rsi2-original_BTCUSDT_1d_2024.json
│   ├── larry-williams-9-1_BTCUSDT_1d_2024.json
│   ├── ...
│   └── summary.txt                    # ← Top 10 ranking
├── optimizations/
│   ├── connors-rsi2-original_opt_*.json
│   └── ...
└── validations/
    └── ...
```

---

## 📈 Key Metrics

### What to look at in the results:

1. **Total Trades** - Minimum 20-30 to be statistically meaningful
2. **Win Rate** - Ideal 40-60%
3. **Profit Factor** - Minimum 1.5, ideal >2.0
4. **Total PnL %** - Total return
5. **Max Drawdown %** - Maximum risk (ideal <20%)
6. **Sharpe Ratio** - Risk-adjusted return (ideal >1.0)

### Warning Flags:
- ⚠️ **0 trades** = Conditions are too restrictive
- ⚠️ **Win rate <30%** = Problem with the strategy
- ⚠️ **Profit Factor <1.0** = Losing money
- ⚠️ **Max DD >30%** = Risk is too high

---

## 🔧 Troubleshooting

### "Failed to load strategy"
- Check that the indicator exists in the IndicatorEngine
- Verify indicator names (case-sensitive)
- See `STRATEGY_VALIDATION_FIXES.md`

### "0 trades detected"
- Parameters are too restrictive
- Test period is too short
- Try adjusting thresholds (RSI, confidence, etc.)

### Timeout errors
- Increase timeout in the script (line 40)
- Reduce the test period
- Use a larger interval (1d instead of 1h)

---

## ✅ Pre-Run Checklist

- [ ] Backend compiled (`npm run build`)
- [ ] Environment variables configured (`.env`)
- [ ] Strategies active (`status: "active"`)
- [ ] Sufficient disk space (~500MB for all results)
- [ ] Stable internet connection (to fetch Binance data)

---

## 🚀 Recommended Workflow

1. **Full optimization:**
   ```bash
   pnpm optimize:full
   ```
   - Runs 3 stages automatically
   - Analyzes sensitivity, cross-product, and trailing stop
   - Generates optimal-config.json with the best parameters

2. **Individual optimization:**
   ```bash
   pnpm backtest:optimize -- -s connors-rsi2-original ...
   ```

3. **Validation:**
   ```bash
   pnpm backtest:validate -- -s top-strategy ...
   ```

4. **Robustness analysis:**
   ```bash
   pnpm backtest:walkforward -- -s top-strategy ...
   pnpm backtest:montecarlo -- -s top-strategy ...
   ```

---

**Last updated:** December 9, 2025
**Active strategies:** 72
**Status:** ✅ Production-ready
