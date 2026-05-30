# 🚀 Quick Start - Backtesting CLI

5-minute guide to get started with the backtesting system.

## 1️⃣ Test Your First Strategy (30 seconds)

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000
```

**What happens:**
- ✅ Fetches historical data from Binance (BTCUSDT, 1 hour, Nov 2024)
- ✅ Simulates trades with Setup 9.1
- ✅ Calculates metrics (win rate, profit factor, Sharpe ratio, etc.)
- ✅ Shows automatic interpretation of results
- ✅ Saves result as JSON

**Expected output:**
```
╔═══════════════════════════════════════════════╗
║        BACKTEST VALIDATION - SETUP91          ║
╠═══════════════════════════════════════════════╣
║ Symbol: BTCUSDT                               ║
║ Interval: 1h                                  ║
║ Period: 2024-11-01 → 2024-12-01              ║
║ Capital: $1,000.00                            ║
╚═══════════════════════════════════════════════╝

BACKTEST RESULTS:
Total Trades: 34
Win Rate: 35.29%
Profit Factor: 1.43
Total PnL: +2.12%
Max Drawdown: -1.69%
Sharpe Ratio: 2.55

✓ RECOMMENDATION: Strategy needs optimization before live trading.

✔ Result saved to: results/validations/setup91_BTCUSDT_1h_*.json
```

---

## 2️⃣ Optimize Parameters (2 minutes)

Find the best parameters automatically:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-10-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --param minConfidence=60,70,80 \
  --parallel 4
```

**What happens:**
- ✅ Tests **27 combinations** of parameters (3×3×3)
- ✅ Runs 4 backtests in parallel
- ✅ Shows the top 10 best results
- ✅ Recommends the best configuration

**Expected output:**
```
╔═══════════════════════════════════════════════╗
║         TOP 10 RESULTS (sorted by PnL)        ║
╠═══╦═════╦════╦════╦═══════╦══════╦══════╦═════╣
║ # ║ SL% ║TP% ║ MC ║Trades ║Win%  ║ PnL% ║  PF ║
╠═══╬═════╬════╬════╬═══════╬══════╬══════╬═════╣
║ 1 ║ 2.0 ║ 6  ║ 70 ║   47  ║ 61.7 ║28.75 ║2.58 ║
║ 2 ║ 1.5 ║ 6  ║ 70 ║   52  ║ 59.6 ║26.50 ║2.41 ║
║ 3 ║ 2.0 ║ 7  ║ 70 ║   41  ║ 63.4 ║25.80 ║2.72 ║
...

✓ BEST: SL=2%, TP=6%, MC=70 → PnL=+28.75%
✔ Results saved to: results/optimizations/setup91_BTCUSDT_*.json
```

---

## 3️⃣ Compare Multiple Results (10 seconds)

Compare BTC vs ETH:

```bash
# Test ETH
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol ETHUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000

# Compare BTC vs ETH
npm run backtest:compare -- \
  results/validations/setup91_BTCUSDT_*.json \
  results/validations/setup91_ETHUSDT_*.json
```

**Output:**
```
┌─────────┬─────────┬──────┬────────┬──────┬─────┬──────┐
│Strategy │ Symbol  │ Int. │ Trades │Win % │ PF  │ PnL% │
├─────────┼─────────┼──────┼────────┼──────┼─────┼──────┤
│ setup91 │ BTCUSDT │  1h  │   34   │ 35.3 │ 1.43│ +2.12│
│ setup91 │ ETHUSDT │  1h  │   42   │ 23.8 │ 0.77│ -1.65│
└─────────┴─────────┴──────┴────────┴──────┴─────┴──────┘

BEST RESULTS:
✓ Highest PnL: setup91 (BTCUSDT 1h): +2.12%
✓ Highest Win Rate: setup91 (BTCUSDT 1h): 35.3%
```

---

## 4️⃣ Validate Robustness with Walk-Forward (3 minutes)

Avoid overfitting by validating on out-of-sample periods:

```bash
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-06-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --training-months 3 \
  --testing-months 1 \
  --step-months 1
```

**Output:**
```
╔═══════════════════════════════════════════════╗
║    WALK-FORWARD ANALYSIS - SETUP91            ║
╠═══════════════════════════════════════════════╣
║ Created 3 walk-forward windows                ║
╚═══════════════════════════════════════════════╝

AGGREGATED METRICS:
Total Trades: 89
Overall Win Rate: 58.4%
Overall Profit Factor: 2.12

Sharpe Ratio Analysis:
Avg In-Sample Sharpe: 1.85
Avg Out-of-Sample Sharpe: 1.62
Degradation: 12.4%

Robustness Assessment:
✓ Strategy is ROBUST
  Performance degradation is acceptable (<30%)

✔ Results saved to: results/walkforward/setup91_BTCUSDT_4h_wf_*.json
```

---

## 5️⃣ Monte Carlo Analysis (1 minute)

Assess the statistical significance of results:

```bash
npm run backtest:montecarlo -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-10-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --simulations 1000
```

**What happens:**
- ✅ Runs the initial backtest
- ✅ Shuffles the trade order 1000 times
- ✅ Calculates the statistical distribution of results
- ✅ Provides confidence intervals (95%)
- ✅ Estimates probabilities for different scenarios

**Expected output:**
```
╔═══════════════════════════════════════════════╗
║    MONTE CARLO SIMULATION - SETUP91           ║
╠═══════════════════════════════════════════════╣
║ Simulations: 1,000                            ║
║ Confidence Level: 95%                         ║
╚═══════════════════════════════════════════════╝

ORIGINAL BACKTEST RESULTS:
Final Equity: $1,287.45 (+28.75%)
Total Trades: 47
Win Rate: 61.70%
Profit Factor: 2.58
Sharpe Ratio: 1.82

MONTE CARLO STATISTICS:
Mean Final Equity: $1,285.22
Median Final Equity: $1,284.50
Std Dev: $18.45

95% CONFIDENCE INTERVALS:
Final Equity: [$1,250.12, $1,320.88]
Total Return: [+25.01%, +32.09%]
Max Drawdown: [-3.2%, -11.8%]
Sharpe Ratio: [1.65, 1.98]

PROBABILITIES:
Profitable: 92.5%
Drawdown > 10%: 15.3%
Drawdown > 20%: 2.1%
Return > 20%: 78.4%

SCENARIOS:
Worst Case: $1,215.33 (+21.53%)
Median Case: $1,284.50 (+28.45%)
Best Case: $1,358.92 (+35.89%)

ASSESSMENT:
✓ Statistically significant results
✓ High probability of profit (92.5%)
✓ Low probability of large drawdowns
✓ Even worst case is profitable

✔ Results saved to: results/montecarlo/setup91_BTCUSDT_4h_mc_*.json
```

---

## 6️⃣ Export to CSV (5 seconds)

Analyze in Excel/Google Sheets:

```bash
npm run backtest:export -- \
  results/validations/setup91_BTCUSDT_*.json \
  --verbose
```

**Output:**
```
CSV generated with:
- 34 individual trades (entry, exit, PnL)
- Final metrics (win rate, profit factor, etc.)
- Saved to: results/comparisons/*.csv

Preview:
Trade,Type,Entry Date,Entry Price,Exit Price,PnL ($),PnL (%)
1,SHORT,2024-11-03,68018.00,69378.36,-2.00,-2.20
2,SHORT,2024-11-04,68662.39,70035.64,-2.00,-2.20
3,LONG,2024-11-04,67920.01,71995.21,5.97,5.80
...
```

---

## 🎯 Next Steps

### Option A: Test Other Strategies

```bash
# Setup 9.2 (pullback/retest)
npm run backtest:validate -- --strategy setup92 --symbol BTCUSDT --interval 4h ...

# Breakout Retest
npm run backtest:validate -- --strategy breakoutRetest --symbol BTCUSDT --interval 1h ...

# Bull Trap (SHORT reversal)
npm run backtest:validate -- --strategy bullTrap --symbol BTCUSDT --interval 1h ...
```

**Available strategies (8):**
- `setup91`, `setup92`, `setup93`, `setup94`
- `pattern123`, `bullTrap`, `bearTrap`, `breakoutRetest`

### Option B: Test Other Symbols

```bash
# Ethereum
--symbol ETHUSDT

# Solana
--symbol SOLUSDT

# Binance Coin
--symbol BNBUSDT

# Others
--symbol ADAUSDT  # Cardano
--symbol DOGEUSDT # Dogecoin
--symbol XRPUSDT  # Ripple
```

### Option C: Test Other Timeframes

```bash
# Scalping (15 minutes)
--interval 15m

# Day trading (1 hour)
--interval 1h

# Swing trading (4 hours or 1 day)
--interval 4h
--interval 1d
```

---

## 🛠️ Useful Commands

### Show full help
```bash
npm run backtest -- --help
npm run backtest:validate -- --help
npm run backtest:optimize -- --help
```

### List saved results
```bash
ls -lh results/validations/
ls -lh results/optimizations/
ls -lh results/walkforward/
ls -lh results/montecarlo/
ls -lh results/comparisons/
```

### View a specific result
```bash
cat results/validations/setup91_BTCUSDT_*.json | jq '.metrics'
```

---

## 📖 Full Documentation

For full details, see:
- **[CLI.md](./CLI.md)** - Complete documentation with all parameters and examples

---

## 💡 Quick Tips

1. **Start with short periods** (1 month) for quick tests
2. **Use --verbose** to see individual trades
3. **Optimize in parallel** with `--parallel 4` for speed
4. **Filter results** with `--min-win-rate 50 --min-profit-factor 1.5`
5. **Always compare** BTC, ETH, and SOL to see which performs best

---

## ⚠️ Warnings

- ❌ Past results ≠ future results
- ❌ Always test with paper trading first
- ❌ Real commissions: 0.1% (spot) or 0.02-0.04% (maker/taker)
- ❌ Slippage is not included in backtests

---

**Ready! In 5 minutes you're already running professional backtests! 🚀📈**

For more examples, see [CLI.md](./CLI.md)
