# MarketMind Backtesting CLI

Command-line system for validating, optimizing, and analyzing trading strategies through backtesting with real historical Binance data.

## 📋 Table of Contents

- [Installation](#installation)
- [Available Commands](#available-commands)
- [Quick Start](#quick-start)
- [Practical Examples](#practical-examples)
- [Available Strategies](#available-strategies)
- [Parameters and Options](#parameters-and-options)
- [Results and Metrics](#results-and-metrics)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Installation

Dependencies are already installed. To verify the CLI is working:

```bash
npm run backtest -- --help
```

## 📌 Available Commands

| Command | Description | NPM Shortcut |
|---------|-------------|--------------|
| `validate` | Validate a strategy with a detailed backtest | `npm run backtest:validate` |
| `optimize` | Optimize parameters via grid search | `npm run backtest:optimize` |
| `walkforward` | Walk-forward analysis to validate strategy robustness | `npm run backtest:walkforward` |
| `montecarlo` | Monte Carlo simulation for statistical analysis | `npm run backtest:montecarlo` |
| `sensitivity` | Parameter sensitivity analysis to detect over-optimization | `npm run backtest:sensitivity` |
| `compare` | Compare multiple backtest results | `npm run backtest:compare` |
| `export` | Export results to CSV | `npm run backtest:export` |

---

## ⚡ Quick Start

### 1. Validate a strategy

Test a strategy with specific parameters:

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --min-confidence 70
```

**Output:**
- Total trades executed
- Win rate, profit factor, Sharpe ratio
- Max drawdown and commissions
- Automatic interpretation of results
- JSON file automatically saved to `results/validations/`

### 2. Optimize parameters

Find the best parameters via grid search:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --param minConfidence=60,70,80 \
  --parallel 4 \
  --top 10
```

**Output:**
- Tests all combinations (27 in the example above)
- Parallel execution (4 workers)
- Top 10 best results in a table
- Aggregated statistics (average win rate, PnL, etc.)
- Automatic recommendation of the best configuration
- JSON file saved to `results/optimizations/`

### 3. Compare results

Compare multiple backtests side by side:

```bash
npm run backtest:compare -- \
  results/validations/setup91_BTCUSDT_*.json \
  results/validations/setup91_ETHUSDT_*.json
```

**Output:**
- Comparison table with all metrics
- Identification of best performers
- Ranking by different metrics

### 4. Walk-Forward Analysis

Validate strategy robustness while avoiding overfitting:

```bash
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1,2,3 \
  --param takeProfitPercent=4,6,8 \
  --training-months 6 \
  --testing-months 2 \
  --step-months 2
```

**What happens:**
- Splits data into windows (6 months training + 2 months testing)
- Optimizes parameters in the training period
- Validates in the testing period (out-of-sample)
- Slides the window and repeats
- Calculates performance degradation

**Output:**
- Aggregated metrics (in-sample vs out-of-sample)
- Performance degradation (threshold: 30%)
- Robustness assessment (ROBUST or NOT ROBUST)
- Recommendation based on stability

### 5. Export to CSV

Export results for analysis in Excel/Sheets:

```bash
npm run backtest:export -- \
  results/validations/setup91_BTCUSDT_*.json \
  --output my-analysis.csv \
  --verbose
```

**Output:**
- CSV with all individual trades
- Summary with final metrics
- Terminal preview (with --verbose)

---

## 📊 Practical Examples

### Example 1: Quick Test (1 month)

Quick validation with 1 month of data:

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --min-confidence 70
```

### Example 2: Full Optimization (full year)

Grid search with the entire year's data:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1,1.5,2,2.5,3 \
  --param takeProfitPercent=4,5,6,7,8 \
  --param minConfidence=50,60,70,80 \
  --parallel 4 \
  --sort-by totalPnlPercent \
  --min-win-rate 50 \
  --min-profit-factor 1.5 \
  --top 5
```

This will test **5 × 5 × 4 = 100 combinations** and filter only those with win rate >50% and profit factor >1.5.

### Example 3: Multi-Symbol

Test the same strategy on multiple pairs:

```bash
# BTC
npm run backtest:validate -- \
  --strategy setup91 --symbol BTCUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# ETH
npm run backtest:validate -- \
  --strategy setup91 --symbol ETHUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# SOL
npm run backtest:validate -- \
  --strategy setup91 --symbol SOLUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# Compare results
npm run backtest:compare -- results/validations/setup91_*USDT_4h_*.json
```

### Example 4: Timeframe Comparison

Compare the same strategy across different timeframes:

```bash
# 1 hour
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 1h --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# 4 hours
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 4h --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# 1 day
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 1d --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# Compare
npm run backtest:compare -- results/validations/setup91_BTCUSDT_*.json
```

### Example 5: Full Walk-Forward Analysis

Professional robustness validation avoiding overfitting:

```bash
# Step 1: Run walk-forward analysis
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --training-months 6 \
  --testing-months 2 \
  --step-months 2 \
  --verbose
```

**What happens:**
1. Creates sliding windows:
   - Window 1: Jan-Jun (training) + Jul-Aug (testing)
   - Window 2: Mar-Aug (training) + Sep-Oct (testing)
   - Window 3: May-Oct (training) + Nov-Dec (testing)

2. For each window:
   - Optimizes 9 combinations (3×3) in the training period
   - Selects the best parameters
   - Validates in the testing period (out-of-sample)

3. Calculates aggregated metrics:
   - Average in-sample vs out-of-sample Sharpe Ratio
   - Performance degradation
   - Strategy robustness

**Interpreting results:**

- **Degradation < 15%**: ✓ Excellent stability
- **Degradation 15-30%**: ⚠ Acceptable stability
- **Degradation > 30%**: ✗ Overfitting detected

**When to use Walk-Forward:**
- Before putting a strategy into production
- To validate optimized parameters
- To detect overfitting
- To assess temporal robustness

### 6. Monte Carlo Simulation

Statistical analysis via Monte Carlo simulation:

```bash
npm run backtest:montecarlo -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --simulations 1000 \
  --confidence-level 0.95
```

**What happens:**
- Runs the initial backtest
- Shuffles the trade order 1000 times (Fisher-Yates shuffle)
- Calculates the distribution of possible outcomes
- Provides confidence intervals (95%)
- Estimates probabilities for specific scenarios

**Output:**
- Statistics (mean, median, standard deviation)
- Confidence intervals for equity, drawdown, return
- Probabilities (profit, drawdowns >10/20/30%, returns >10/20/50%)
- Scenarios: worst case, best case, median
- Statistical significance assessment

**Interpretation:**
- **Probability of Profit > 80%**: ✓ Statistically significant
- **95% CI does not include zero**: ✓ Robust results
- **Worst case still profitable**: ✓ Excellent consistency
- **Very high Std Dev**: ⚠ High variability

**When to use Monte Carlo:**
- To assess the statistical significance of results
- To estimate probabilities of different scenarios
- To calculate confidence intervals
- For strategy stress testing

### 7. Sensitivity Analysis

Detect over-optimization by analyzing parameter sensitivity:

```bash
npm run backtest:sensitivity -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1,1.5,2,2.5,3 \
  --param takeProfitPercent=4,5,6,7,8 \
  --metric sharpeRatio
```

**What happens:**
- Tests all parameter combinations
- Analyzes the sensitivity of each parameter individually
- Classifies sensitivity (LOW, MEDIUM, HIGH, CRITICAL)
- Identifies stable performance regions (plateaus)
- Automatically detects over-optimization

**Output:**
- **Analysis by Parameter**: Sensitivity, max deviation, avg deviation
- **Recommended Range**: Range of stable values
- **Over-Optimization Detection**: Alert if parameters are over-optimized
- **Optimal Plateau**: Stable high-performance region
- **Robustness Score**: 0-100 (the higher, the more robust)
- **2D Heatmap**: If testing exactly 2 parameters

**Sensitivity interpretation:**
- **LOW (<10% deviation)**: ✓ Robust parameter, safe to use
- **MEDIUM (10-25%)**: ⚠ Moderate sensitivity, use with care
- **HIGH (25-50%)**: ⚠⚠ High sensitivity, overfitting risk
- **CRITICAL (>50%)**: ✗ Over-optimized parameter, DO NOT use

**Robustness Score:**
- **80-100**: ✓ Excellent - strategy is production-ready
- **60-79**: ⚠ Acceptable - validate with walk-forward
- **<60**: ✗ Over-optimized - re-optimize with wider ranges

**When to use Sensitivity:**
- After parameter optimization
- To validate chosen parameters
- To identify critical vs robust parameters
- Before putting a strategy into production

---

## 🎯 Available Strategies

| Strategy | CLI Name | Type | Ideal Timeframe |
|----------|----------|------|-----------------|
| Setup 9.1 | `setup91` | Trend Pullback (LONG) | 1h, 4h |
| Setup 9.2 | `setup92` | Pullback/Retest (LONG) | 4h, 1d |
| Setup 9.3 | `setup93` | Breakout + Continuation | 1h, 4h |
| Setup 9.4 | `setup94` | Support/Resistance Bounce | 4h, 1d |
| Pattern 1-2-3 | `pattern123` | Classical Swing Pattern | 4h, 1d |
| Bull Trap | `bullTrap` | Reversal SHORT | 1h, 4h |
| Bear Trap | `bearTrap` | Reversal LONG | 1h, 4h |
| Breakout Retest | `breakoutRetest` | Momentum + Retest | 1h, 4h |

---

## ⚙️ Parameters and Options

### Command: `validate`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--strategy` | ✅ | - | Strategy name (e.g. setup91) |
| `--symbol` | ✅ | - | Trading pair (e.g. BTCUSDT, ETHUSDT) |
| `--interval` | ✅ | - | Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.) |
| `--start` | ✅ | - | Start date (YYYY-MM-DD) |
| `--end` | ✅ | - | End date (YYYY-MM-DD) |
| `--capital` | ❌ | 1000 | Initial capital in USD |
| `--stop-loss` | ❌ | 2 | Stop loss in % |
| `--take-profit` | ❌ | 6 | Take profit in % |
| `--min-confidence` | ❌ | 70 | Minimum setup confidence (0-100) |
| `--max-position` | ❌ | 10 | Maximum position size (% of capital) |
| `--commission` | ❌ | 0.1 | Commission per trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Use SL/TP calculated by the strategy |
| `--only-with-trend` | ❌ | true | Only trades aligned with EMA200 |
| `--verbose` | ❌ | false | Show detailed trade-by-trade logs |

### Command: `optimize`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--strategy` | ✅ | - | Strategy name |
| `--symbol` | ✅ | - | Trading pair |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Start date |
| `--end` | ✅ | - | End date |
| `--param` | ✅ | - | Parameter to optimize (format: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Initial capital |
| `--parallel` | ❌ | 4 | Number of parallel workers (1-16) |
| `--sort-by` | ❌ | totalPnlPercent | Metric to sort results by |
| `--top` | ❌ | 10 | Number of top results to display |
| `--min-win-rate` | ❌ | - | Filter by minimum win rate (%) |
| `--min-profit-factor` | ❌ | - | Filter by minimum profit factor |

**Example with multiple --param:**
```bash
--param stopLossPercent=1,2,3 \
--param takeProfitPercent=4,6,8 \
--param minConfidence=60,70,80
```
This will test **3 × 3 × 3 = 27 combinations**.

### Command: `walkforward`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--strategy` | ✅ | - | Strategy name |
| `--symbol` | ✅ | - | Trading pair |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Start date |
| `--end` | ✅ | - | End date |
| `--param` | ✅ | - | Parameter to optimize (format: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Initial capital |
| `--training-months` | ❌ | 6 | Training window size (months) |
| `--testing-months` | ❌ | 2 | Testing window size (months) |
| `--step-months` | ❌ | 2 | Step to advance windows (months) |
| `--verbose` | ❌ | false | Show detailed logs for all windows |

### Command: `montecarlo`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--strategy` | ✅ | - | Strategy name |
| `--symbol` | ✅ | - | Trading pair |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Start date |
| `--end` | ✅ | - | End date |
| `--capital` | ❌ | 1000 | Initial capital in USD |
| `--stop-loss` | ❌ | 2 | Stop loss in % |
| `--take-profit` | ❌ | 6 | Take profit in % |
| `--min-confidence` | ❌ | 70 | Minimum setup confidence (0-100) |
| `--max-position` | ❌ | 10 | Maximum position size (% of capital) |
| `--commission` | ❌ | 0.1 | Commission per trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Use SL/TP calculated by the strategy |
| `--only-with-trend` | ❌ | true | Only trades aligned with EMA200 |
| `--simulations` | ❌ | 1000 | Number of Monte Carlo simulations (100-100000) |
| `--confidence-level` | ❌ | 0.95 | Confidence level (0.80-0.99) |
| `--verbose` | ❌ | false | Show detailed logs |

### Command: `sensitivity`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--strategy` | ✅ | - | Strategy name |
| `--symbol` | ✅ | - | Trading pair |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Start date |
| `--end` | ✅ | - | End date |
| `--param` | ✅ | - | Parameter to analyze (format: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Initial capital in USD |
| `--min-confidence` | ❌ | 70 | Minimum setup confidence (0-100) |
| `--max-position` | ❌ | 10 | Maximum position size (% of capital) |
| `--commission` | ❌ | 0.1 | Commission per trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Use SL/TP calculated by the strategy |
| `--only-with-trend` | ❌ | true | Only trades aligned with EMA200 |
| `--metric` | ❌ | sharpeRatio | Metric to analyze (sharpeRatio, totalReturn, profitFactor, winRate) |
| `--verbose` | ❌ | false | Show detailed results per parameter |

**Example with multiple --param:**
```bash
--param stopLossPercent=1,1.5,2,2.5,3 \
--param takeProfitPercent=4,5,6,7,8
```
This will test **5 × 5 = 25 combinations** and analyze the sensitivity of each parameter.

### Command: `compare`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `<files...>` | ✅ | - | JSON files to compare (minimum 2) |
| `--verbose` | ❌ | false | Show detailed logs |

### Command: `export`

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `<file>` | ✅ | - | JSON file to export |
| `--output` | ❌ | auto | Output CSV path |
| `--verbose` | ❌ | false | Show CSV preview |

---

## 📈 Results and Metrics

### Calculated Metrics

| Metric | Description | Good Value |
|--------|-------------|------------|
| **Total Trades** | Number of trades executed | >30 (statistical validation) |
| **Win Rate** | % of winning trades | >55% |
| **Profit Factor** | (Total gains) / (Total losses) | >2.0 |
| **Total PnL** | Total profit/loss (%) | >20% per year |
| **Sharpe Ratio** | Risk-adjusted return | >1.5 |
| **Max Drawdown** | Largest drop from peak (%) | <20% |
| **Avg Trade Duration** | Average trade duration | Varies by strategy |
| **Total Commission** | Commissions paid | The lower, the better |

### Automatic Interpretation

The CLI provides automatic interpretation of results:

```
✓ POSITIVES:
  • Excellent win rate (61.7%)
  • Excellent profit factor (2.58)
  • Good Sharpe ratio (1.82)
  • Low max drawdown (1.69%)
  • Good sample size (47 trades)

⚠ AREAS FOR IMPROVEMENT:
  (none in this case)

✓ RECOMMENDATION: Strategy shows promise! Consider parameter optimization.
```

### Saved Results Structure

Results are automatically saved to:

```
results/
├── validations/              # validate results
│   ├── setup91_BTCUSDT_1h_2024-12-07T00-22-57.json
│   └── setup91_ETHUSDT_1h_2024-12-07T00-23-06.json
├── optimizations/            # optimize results
│   └── setup91_BTCUSDT_4h_2024-12-07T01-15-30.json
├── walkforward/              # walk-forward analysis results
│   └── setup91_BTCUSDT_4h_wf_2024-12-07T02-30-15.json
├── montecarlo/               # Monte Carlo simulation results
│   └── setup91_BTCUSDT_4h_mc_2024-12-07T03-45-22.json
├── sensitivity/              # sensitivity analysis results
│   └── setup91_BTCUSDT_4h_sensitivity_2024-12-07T04-20-33.json
└── comparisons/              # exported CSVs
    └── setup91_BTCUSDT_1h_2024-12-07T00-22-57.csv
```

---

## 🔧 Troubleshooting

### Error: "Symbol must end with USDT"

**Cause:** Invalid symbol (e.g. BTC, BTCUSD)

**Solution:** Use symbols ending with USDT (e.g. BTCUSDT, ETHUSDT, SOLUSDT)

### Error: "Start date must be before end date"

**Cause:** Dates are in the wrong order

**Solution:** Verify that `--start` is earlier than `--end`

### Error: "Risk/Reward ratio is below recommended minimum"

**Cause:** Take profit is too low relative to stop loss

**Solution:**
- Increase `--take-profit` or decrease `--stop-loss`
- Or use `--use-algorithmic-levels` to let the strategy calculate SL/TP

### Warning: "Grid search will test X combinations. This may take a long time."

**Cause:** Too many parameter combinations

**Solution:**
- Reduce the number of values in each `--param`
- Start with a coarse grid, then refine
- Increase `--parallel` (up to 8)

### Error: "File not found"

**Cause:** Result file does not exist

**Solution:** Check the file path (use `ls results/validations/`)

---

## 💡 Tips and Best Practices

### 1. Recommended Iterative Workflow

```bash
# 1. Quick test (1 month)
npm run backtest:validate -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-11-01 --end 2024-12-01

# 2. If results are promising, optimize (coarse grid)
npm run backtest:optimize -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --param stopLossPercent=1,2,3 \
  --param takeProfitPercent=4,6,8 \
  --parallel 4 --top 5

# 3. Refine the best region
npm run backtest:optimize -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --param stopLossPercent=1.5,1.75,2,2.25,2.5 \
  --param takeProfitPercent=5.5,6,6.5 \
  --parallel 4 --top 3

# 4. Validate on other symbols
npm run backtest:validate -- \
  --strategy setup91 --symbol ETHUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --stop-loss 2 --take-profit 6
```

### 2. Test Periods

- **Quick test**: 1 month (Nov 2024)
- **Validation**: 6 months (Jul-Dec 2024)
- **Full optimization**: Full year (2024)
- **Out-of-sample**: Last 3 months (Oct-Dec 2024)

### 3. Quality Filters

Use filters to find only viable strategies:

```bash
--min-win-rate 50 \
--min-profit-factor 1.5
```

### 4. Parallelization

- **1-2 workers**: Slower CPU
- **4 workers**: Recommended default
- **8 workers**: For powerful CPUs
- **>8 workers**: Generally does not improve performance

---

## 📚 Additional Resources

- **Source code**: `/apps/backend/src/cli/`
- **Results**: `/apps/backend/results/`
- **Strategies**: `/apps/backend/src/services/setup-detection/`

---

## 🚨 Important Warnings

1. **Past results do not guarantee future results**
2. **Always test with paper trading before using real capital**
3. **Binance commissions**: 0.1% for spot (default), 0.02-0.04% for Maker/Taker
4. **Slippage is not included** in backtests (real markets may have slippage)
5. **Minimum position size**: Binance has minimum order requirements (e.g. $10-20 USD)

---

## 📞 Support

If you encounter issues or have questions, check:
1. This document (CLI.md)
2. Error logs (with `--verbose`)
3. Source files in `/apps/backend/src/cli/`

Happy backtesting! 📈🚀
