# Backtesting System - Complete Guide

**Status:** ✅ Production Ready
**Version:** 0.34.0
**Date:** December 8, 2025

---

## 📋 Overview

The MarketMind backtesting system is a professional-grade tool for testing trading strategies against historical market data. It features advanced position sizing methods, comprehensive performance metrics, CLI optimization tools, and full integration with dynamic setup detection.

---

## 🎯 Core Features

### 1. Position Sizing Methods (NEW ✨)

The system now includes **4 professional position sizing algorithms**:

#### **Risk-Based Sizing**
- Size positions based on % of capital willing to risk per trade
- Formula: `Position = (Equity × RiskPercent) / StopLossPercent`
- Default: 2% risk per trade
- Best for: Conservative traders with defined risk tolerance

#### **Kelly Criterion**
- Optimal sizing based on statistical edge
- Formula: `K = (W × R - L) / R` where W=WinRate, R=RewardRisk ratio, L=LossRate
- Uses fractional Kelly (default 0.25x) for safety
- Assumes conservative 50% win rate if no history
- Best for: Maximum growth while managing risk

#### **Volatility-Based Sizing**
- Adjusts position size based on market volatility (ATR)
- Reduces size in high volatility, increases in low volatility
- Best for: Adapting to changing market conditions

#### **Fixed-Fractional** (Default)
- Simple % of total equity per trade
- Backward compatible with existing configs
- Best for: Simplicity and consistency

### 2. Advanced Configuration Options

- **Symbol & Interval**: Any Binance-supported market
- **Date Range**: Precise start/end dates for backtesting period
- **Capital Management**:
  - Initial capital amount
  - Position sizing method selection
  - Risk per trade (for risk-based method)
  - Kelly fraction (for Kelly Criterion)
  - Maximum position size limit
  - Commission rate (%)
- **Risk Management**:
  - Stop Loss percentage
  - Take Profit percentage
  - Minimum setup confidence threshold
- **Strategy Filters**:
  - Specific strategies or all available
  - Algorithmic level detection toggle
  - Trend filter (only with-trend setups)

### 3. Comprehensive Metrics

- **Performance**: Total PnL, Final Equity, Max Drawdown, Sharpe Ratio
- **Trading Stats**: Total trades, Win rate, Profit factor
- **Win/Loss Analysis**: Avg win/loss, Largest win/loss, Avg PnL per trade
- **Position Sizing**: Method used, average position size, risk amounts
- **Costs**: Total commission paid
- **Equity Curve**: Visual representation of account growth over time

---

## 🚀 How to Use

### Option A: CLI Commands (Recommended for Advanced Users)

#### Validate Command

Test a strategy with specific parameters:

```bash
# Basic validation
npm run backtest:validate -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31

# With position sizing
npm run backtest:validate -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --position-method kelly \
  --kelly-fraction 0.25 \
  --risk-per-trade 2

# With all options
npm run backtest:validate -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --capital 10000 \
  --stop-loss-percent 3 \
  --take-profit-percent 6 \
  --min-confidence 70 \
  --max-position 25 \
  --position-method risk-based \
  --risk-per-trade 2 \
  --commission 0.1 \
  --verbose
```

**Position Sizing Options:**
- `--position-method <method>`: Choose sizing method
  - `fixed-fractional` (default)
  - `risk-based` (requires --risk-per-trade)
  - `kelly` (requires --kelly-fraction)
  - `volatility-based`
- `--risk-per-trade <percent>`: Risk % per trade (default: 2)
- `--kelly-fraction <fraction>`: Kelly multiplier 0-1 (default: 0.25)

#### Optimize Command

Find optimal parameters through grid search:

```bash
# Basic optimization
npm run backtest:optimize -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --param minConfidence:60:70:80 \
  --param lookbackPeriod:5:10:15:20

# With position sizing
npm run backtest:optimize -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --param minConfidence:60:70:80 \
  --param lookbackPeriod:10:20:30 \
  --position-method kelly \
  --kelly-fraction 0.25 \
  --stop-loss-percent 5 \
  --take-profit-percent 10 \
  --sort-by sharpeRatio \
  --top 5

# Parallel processing
npm run backtest:optimize -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1d \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --param minConfidence:50:60:70:80:90 \
  --param lookbackPeriod:5:10:15:20:25:30 \
  --parallel 4 \
  --min-win-rate 35 \
  --min-profit-factor 1.5 \
  --verbose
```

**Optimization Options:**
- `--param <name:val1:val2:...>`: Define parameter grid
- `--sort-by <metric>`: Sort results by metric (totalPnL, sharpeRatio, winRate, etc.)
- `--top <n>`: Show top N results
- `--parallel <workers>`: Number of parallel workers (default: CPU cores)
- `--min-win-rate <percent>`: Filter results by minimum win rate
- `--min-profit-factor <value>`: Filter results by minimum profit factor

### Option B: Frontend UI (User-Friendly)

#### 1. Access the Backtesting Panel

The BacktestingPanel component can be integrated into your trading interface:

```tsx
import { BacktestingPanel } from '@renderer/components/Trading/BacktestingPanel';

<BacktestingPanel />
```

#### 2. Configure Your Backtest

**Tab: "Configure"**

1. **Date Range**: Select start and end dates
   - Ensure you have kline data for this period in your database

2. **Capital Settings**:
   - Initial Capital: Starting amount (default: 10,000 USDT)
   - Max Position Size: % of capital per trade (default: 10%)
   - Commission: Trading fee per side (default: 0.1%)

3. **Risk Parameters**:
   - Min Confidence: Only trade setups above this confidence level (default: 70%)
   - Stop Loss %: Automatic stop loss distance (default: 2%)
   - Take Profit %: Automatic take profit target (default: 4%)

4. **Run**: Click "Run Backtest" to start simulation

#### 3. View Results

**Tab: "Results"**

After completion, view:

1. **Configuration Summary**: Your backtest parameters
2. **Performance Metrics**: Overall profitability and risk metrics
3. **Trading Statistics**: Win rate, trade count, profit factor
4. **Win/Loss Analysis**: Detailed breakdown of profitable vs losing trades
5. **Equity Curve Chart**: Visual representation of:
   - Equity progression over time
   - Initial capital baseline
   - Drawdown periods (shown in red)
6. **Recent Trades**: Last 10 trades with entry/exit details
7. **Duration**: How long the backtest took to run

### 4. Manage Backtests

- **View History**: List of all completed backtests
- **Select Result**: Click any backtest to view full details
- **Delete**: Remove old backtests you no longer need
- **New Backtest**: Return to configuration to run another test

---

## 📊 Understanding the Results

### Equity Curve Chart

The chart displays three key elements:

1. **Equity Line (Blue Area)**:
   - Shows your account balance over time
   - Area fill indicates growth/decline visually

2. **Initial Capital Line (Dashed)**:
   - Baseline reference
   - Shows if you're above/below starting capital

3. **Drawdown Area (Red)**:
   - Displayed on right Y-axis
   - Shows periods of decline from peak equity
   - Helps identify risky periods

### Key Metrics Explained

**Sharpe Ratio**:
- Measures risk-adjusted returns
- Formula: `(Return - RiskFreeRate) / StdDev(Returns)`
- Higher is better (>1 is good, >2 is excellent)
- Accounts for volatility in returns

**Profit Factor**:
- Total wins ÷ Total losses
- Must be >1 to be profitable
- 2.0+ indicates strong performance

**Max Drawdown**:
- Largest peak-to-trough decline
- Important for risk assessment
- Lower is better (less capital at risk)

**Win Rate**:
- Percentage of profitable trades
- 50%+ is generally good
- Not the only important metric (consider R:R)

### Position Sizing Impact

**Example Comparison (Same Strategy, Different Sizing):**

| Method | Position Size | Win Rate | Total PnL | Max DD | Sharpe |
|--------|--------------|----------|-----------|--------|--------|
| Fixed 10% | 10% | 36.9% | 8.65% | 3.87% | 1.32 |
| Fixed 25% | 25% | 36.9% | 21.63% | 9.68% | 1.32 |
| Risk-Based 2% | Variable | 36.9% | 18.45% | 7.21% | 1.45 |
| Kelly 0.25x | Variable | 36.9% | 24.12% | 8.93% | 1.58 |

**Key Insights:**
- Higher position sizes = Higher returns BUT higher drawdown
- Kelly Criterion balances growth with risk management
- Risk-based provides consistent risk per trade
- Choose method based on your risk tolerance

---

## 💡 Best Practices

### Data Requirements

1. **Sufficient Data**: Ensure you have enough historical klines
   ```bash
   # Check available data in database
   SELECT COUNT(*), MIN(open_time), MAX(open_time)
   FROM klines
   WHERE symbol = 'BTCUSDT' AND interval = '1d';
   ```

2. **Data Quality**: Verify no gaps in your data
   - Missing klines can affect results
   - Use the kline backfill feature if needed

### Position Sizing Selection Guide

**When to use Fixed-Fractional:**
- Simple, consistent approach
- Good for beginners
- Predictable position sizes

**When to use Risk-Based:**
- Want consistent risk per trade
- Have defined risk tolerance (e.g., never risk >2%)
- Positions auto-adjust based on stop loss distance

**When to use Kelly Criterion:**
- Want mathematically optimal growth
- Have reliable win rate and R:R data
- Accept higher volatility for max returns
- ALWAYS use fractional Kelly (0.25x recommended)

**When to use Volatility-Based:**
- Want to adapt to market conditions
- Reduce exposure in choppy markets
- Increase size in stable trends

### Strategy Testing Workflow

1. **Initial Test (Conservative)**:
   ```bash
   npm run backtest:validate -- \
     --strategy YOUR_STRATEGY \
     --symbol BTCUSDT \
     --interval 1d \
     --start-date 2024-01-01 \
     --end-date 2024-12-31 \
     --position-method fixed-fractional \
     --max-position 10 \
     --stop-loss-percent 3 \
     --take-profit-percent 6
   ```

2. **Parameter Optimization**:
   ```bash
   npm run backtest:optimize -- \
     --strategy YOUR_STRATEGY \
     --symbol BTCUSDT \
     --interval 1d \
     --start-date 2024-01-01 \
     --end-date 2024-12-31 \
     --param minConfidence:50:60:70:80 \
     --param lookbackPeriod:5:10:15:20 \
     --parallel 4 \
     --sort-by sharpeRatio \
     --top 10
   ```

3. **Test with Kelly Criterion**:
   ```bash
   npm run backtest:validate -- \
     --strategy YOUR_STRATEGY \
     --symbol BTCUSDT \
     --interval 1d \
     --start-date 2024-01-01 \
     --end-date 2024-12-31 \
     --position-method kelly \
     --kelly-fraction 0.25 \
     # Use optimized parameters from step 2
   ```

4. **Validation**:
   - Test on different time periods
   - Try different market conditions (bull/bear/sideways)
   - Use out-of-sample data for final validation

### Avoiding Common Pitfalls

❌ **Don't:**
- Optimize on the same data you'll validate on
- Use full Kelly (always use fractional, 0.25x recommended)
- Ignore commission costs
- Backtest on insufficient data (<100 trades)
- Over-optimize parameters (keep it simple)

✅ **Do:**
- Use walk-forward analysis
- Test multiple position sizing methods
- Include realistic commission rates
- Validate on out-of-sample data
- Keep strategies simple and logical

---

## 🔧 Technical Implementation

---

## 🔧 Technical Implementation

### Architecture

```
apps/backend/src/services/backtesting/
├── BacktestEngine.ts          # Core backtesting execution
├── BacktestOptimizer.ts       # Grid search parameter optimization
├── ParameterGenerator.ts      # Parameter combination generator
├── ResultManager.ts           # Results persistence & retrieval
├── PositionSizer.ts          # Position sizing calculator (NEW)
└── __tests__/
    └── BacktestEngine.test.ts # 25 comprehensive tests
```

### Core Components

#### 1. BacktestEngine
**File:** `apps/backend/src/services/backtesting/BacktestEngine.ts`

**Responsibilities:**
- Execute backtest simulations
- Manage trade execution logic
- Calculate performance metrics
- Generate equity curves
- Integrate position sizing

**Key Methods:**
- `run(config)`: Execute complete backtest
- `calculateMetrics(trades)`: Compute performance stats
- `generateEquityCurve(trades)`: Build equity progression

**Performance:**
- Handles 1000+ candles in <100ms
- Supports parallel execution
- Pre-fetched klines for efficiency

#### 2. PositionSizer (NEW)
**File:** `apps/backend/src/services/backtesting/PositionSizer.ts`

**Responsibilities:**
- Calculate optimal position sizes
- Implement 4 sizing algorithms
- Apply safety constraints
- Provide sizing rationale

**Key Methods:**
- `calculatePositionSize()`: Main entry point
- `calculateRiskBased()`: Risk % based sizing
- `calculateKelly()`: Kelly Criterion with fractional safety
- `calculateVolatilityBased()`: ATR-adjusted sizing

**Implementation Details:**
```typescript
interface PositionSizingConfig {
  method: 'risk-based' | 'kelly' | 'volatility' | 'fixed-fractional';
  riskPerTrade?: number;        // Default: 2%
  kellyFraction?: number;        // Default: 0.25
  minPositionPercent?: number;   // Default: 1%
  maxPositionPercent?: number;   // Default: 100%
}

// Kelly Criterion Formula
K = (W × R - L) / R
where:
  W = Win Rate (decimal)
  R = Avg Win / Avg Loss (reward/risk ratio)
  L = Loss Rate (1 - W)
  
Adjusted = K × kellyFraction  // Safety factor
```

**Safety Features:**
- Assumes conservative 50% win rate if no history
- Fractional Kelly reduces risk (default 0.25x)
- Min/max constraints prevent extreme positions
- Validates all inputs

#### 3. BacktestOptimizer
**File:** `apps/backend/src/services/backtesting/BacktestOptimizer.ts`

**Responsibilities:**
- Grid search parameter optimization
- Parallel execution management
- Result filtering and sorting
- Performance profiling

**Key Methods:**
- `optimize(baseConfig, paramGrid)`: Run optimization
- `sortResults(results, sortBy)`: Rank results by metric
- `filterResults(results, filters)`: Apply performance filters

**Optimization Features:**
- Parallel worker pool (configurable)
- Progress tracking with CLI progress bar
- Configurable sorting (PnL, Sharpe, Win Rate, etc.)
- Min win rate and profit factor filters

#### 4. CLI Commands
**Files:**
- `apps/backend/src/cli/commands/validate.ts`
- `apps/backend/src/cli/commands/optimize.ts`
- `apps/backend/src/cli/backtest-runner.ts`

**Validate Command:**
```typescript
interface ValidateOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  stopLoss: string;
  takeProfit: string;
  minConfidence: string;
  maxPosition: string;
  positionMethod: string;      // NEW
  riskPerTrade: string;         // NEW
  kellyFraction: string;        // NEW
  commission: string;
  useAlgorithmicLevels: boolean;
  withTrend: boolean;
  optimized: boolean;
  verbose: boolean;
}
```

**Optimize Command:**
```typescript
interface OptimizeOptions extends ValidateOptions {
  param: string[];              // Parameter grid definitions
  sortBy: string;               // Sorting metric
  top: string;                  // Top N results to show
  parallel: string;             // Number of workers
  minWinRate?: string;          // Filter threshold
  minProfitFactor?: string;     // Filter threshold
}
```

### Data Flow

```
1. User Input (CLI/UI)
   ↓
2. Config Validation
   ↓
3. Kline Data Fetch (from DB or API)
   ↓
4. Setup Detection (Dynamic strategies)
   ↓
5. Position Sizing Calculation (NEW)
   ↓
6. Trade Simulation
   ↓
7. Metrics Calculation
   ↓
8. Results Storage/Display
```

### Database Schema

**Backtests Table:**
```sql
CREATE TABLE backtests (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  config JSONB NOT NULL,
  results JSONB NOT NULL,
  duration_ms INTEGER,
  user_id INTEGER REFERENCES users(id)
);

CREATE INDEX idx_backtests_created_at ON backtests(created_at DESC);
CREATE INDEX idx_backtests_user_id ON backtests(user_id);
```

### Testing Coverage

**Test Suite:** 151 tests passing (100% success rate)
- BacktestEngine: 25 tests
- StrategyLoader: 27 tests  
- Kline Historical: 6 tests
- Kline Sync: 5 tests
- Setup Router: 10 tests
- Encryption: 4 tests
- Validation: 6 tests
- Integration tests: 68 tests

**Coverage Areas:**
- ✅ Metrics calculation (Sharpe, PF, Drawdown)
- ✅ Trade execution logic
- ✅ Commission calculations
- ✅ Edge cases (no trades, all losses, etc.)
- ✅ Different intervals (15m, 1h, 4h, 1d)
- ✅ Large datasets (1000+ candles)
- ✅ Pre-fetched kline reuse
- ✅ Position sizing methods (NEW)

### Performance Benchmarks

**Backtest Execution:**
- 200 candles: ~50-100ms
- 500 candles: ~100-200ms
- 1000 candles: ~200-400ms

**Optimization:**
- 9 combinations (3×3 grid): ~1-2 seconds
- 25 combinations (5×5 grid): ~3-5 seconds
- 100 combinations (10×10 grid): ~10-15 seconds
- With 4 parallel workers: 60-70% faster

**Memory Usage:**
- Base: ~50MB
- With 1000 candles: ~100MB
- During optimization (4 workers): ~200-300MB

---

## 📈 Advanced Topics

### Walk-Forward Analysis

For robust strategy validation:

```bash
# Train period: 2023
npm run backtest:optimize -- \
  --strategy YOUR_STRATEGY \
  --start-date 2023-01-01 \
  --end-date 2023-12-31 \
  --param minConfidence:60:70:80 \
  # ... record best parameters

# Test period: 2024 (out-of-sample)
npm run backtest:validate -- \
  --strategy YOUR_STRATEGY \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  # ... use parameters from training
```

### Monte Carlo Simulation

For statistical confidence:

1. Run backtest multiple times with randomized entry timing
2. Analyze distribution of outcomes
3. Calculate confidence intervals
4. Identify worst-case scenarios

### Kelly Criterion Deep Dive

**Full Kelly vs Fractional Kelly:**

| Approach | Growth Rate | Volatility | Drawdown Risk |
|----------|-------------|------------|---------------|
| Full Kelly (1.0x) | Maximum | Very High | Severe |
| Half Kelly (0.5x) | 75% of max | Medium | Moderate |
| Quarter Kelly (0.25x) | 50% of max | Low | Mild |

**Recommended:** Always use fractional Kelly (0.25x default)

**Why?**
- Win rate and R:R estimates are never perfect
- Full Kelly can lead to severe drawdowns
- Quarter Kelly provides 50% of optimal growth with much lower risk
- More robust to estimation errors

### Position Sizing Comparison Tool

Create a script to compare all methods:

```bash
#!/bin/bash
# compare-position-sizing.sh

STRATEGY="momentum-breakout-2025"
SYMBOL="BTCUSDT"
INTERVAL="1d"
START="2024-01-01"
END="2024-12-31"

echo "Testing Fixed-Fractional 10%..."
npm run backtest:validate -- --strategy $STRATEGY --symbol $SYMBOL \
  --interval $INTERVAL --start-date $START --end-date $END \
  --position-method fixed-fractional --max-position 10

echo "Testing Risk-Based 2%..."
npm run backtest:validate -- --strategy $STRATEGY --symbol $SYMBOL \
  --interval $INTERVAL --start-date $START --end-date $END \
  --position-method risk-based --risk-per-trade 2

echo "Testing Kelly 0.25x..."
npm run backtest:validate -- --strategy $STRATEGY --symbol $SYMBOL \
  --interval $INTERVAL --start-date $START --end-date $END \
  --position-method kelly --kelly-fraction 0.25

echo "Comparison complete!"
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Insufficient kline data"**
- Solution: Backfill historical data
```bash
npm run backfill:klines -- --symbol BTCUSDT --interval 1d --days 365
```

**2. "No setups detected"**
- Check: minConfidence threshold (try lowering)
- Check: Date range has valid market data
- Check: Strategy is enabled and configured

**3. "Position sizing returns NaN"**
- Check: stopLoss and takeProfit are valid percentages
- Check: equity > 0
- Check: entryPrice > 0

**4. Optimization taking too long**
- Reduce parameter grid size
- Increase parallel workers
- Use smaller date range for initial tests

**5. Out of memory during optimization**
- Reduce parallel workers
- Close other applications
- Use smaller parameter grids

---

## 📚 Further Reading

### External Resources
- **Kelly Criterion**: [Wikipedia Article](https://en.wikipedia.org/wiki/Kelly_criterion)
- **Position Sizing**: "The Mathematics of Money Management" by Ralph Vince
- **Backtesting**: "Evidence-Based Technical Analysis" by David Aronson
- **Risk Management**: "Trade Your Way to Financial Freedom" by Van K. Tharp

### Internal Documentation
- `docs/SETUP_DETECTION_GUIDE.md` - Setup detection algorithms
- `docs/TRADING_SETUPS_2025_PLAN.md` - Available trading setups
- `docs/ADVANCED_RISK_MANAGEMENT_GUIDE.md` - Risk management strategies

---

## 📝 Changelog

### v0.34.0 (December 8, 2025)
- ✨ **NEW:** Added 4 professional position sizing methods
- ✨ **NEW:** Kelly Criterion with fractional Kelly safety
- ✨ **NEW:** Risk-based sizing for consistent risk per trade
- ✨ **NEW:** Volatility-based sizing with ATR integration
- 🔧 CLI: Added `--position-method`, `--risk-per-trade`, `--kelly-fraction` options
- 🔧 Enhanced validate and optimize commands with position sizing
- 📝 Complete documentation update with examples
- ✅ 151 tests passing (100% success rate)

### v0.33.0 (November 30, 2024)
- ✨ Added CLI optimization command
- 🔧 Improved parallel execution
- 📊 Enhanced result filtering

### v0.32.0 (November 2024)
- 🎨 Updated UI with better charts
- 🔧 Performance optimizations
- 📝 Documentation improvements

---

## 🤝 Contributing

When adding new features to the backtesting system:

1. Add tests to `BacktestEngine.test.ts`
2. Update this documentation
3. Follow position sizing patterns for new algorithms
4. Ensure all 151 tests pass
5. Update CHANGELOG.md

---

**Last Updated:** December 8, 2025  
**Maintainer:** MarketMind Development Team  
**Status:** ✅ Production Ready with Advanced Position Sizing

**File**: `apps/backend/src/routers/backtest.ts`

The backtest engine:
1. Fetches historical klines from database
2. Runs setup detection on all data
3. Filters setups by confidence and type
4. Simulates trade execution with realistic fills
5. Tracks equity, drawdown, and all metrics
6. Returns comprehensive results

### Storage

- Results stored **in-memory** (Map)
- Not persisted to database (for now)
- Restarting backend clears results
- Optional: Can be moved to DB later

### Performance

- Typical backtest duration: 100-500ms
- Depends on data size and setup count
- Runs synchronously (blocking)
- For very large datasets, consider running offline

---

## 📈 Example Use Cases

### 1. Strategy Validation

Test if your manual trading strategy would be profitable:
```
Symbol: BTCUSDT
Interval: 1h
Period: Last 3 months
Initial Capital: $10,000
Position Size: 10%
Stop Loss: 2%
Take Profit: 4%
```

### 2. Parameter Optimization

Find optimal stop loss level:
```
Run 5 backtests with:
- SL: 1%, 2%, 3%, 4%, 5%
- Keep all other params constant
- Compare Sharpe Ratio and Max Drawdown
```

### 3. Setup Type Comparison

Which setup performs best?
```
Run separate backtests for:
- Setup 9.1 only
- Setup 9.2 only
- Pattern 1-2-3 only
- All setups combined
```

---

## 🚨 Limitations

### Current Limitations

1. **No Slippage**: Trades execute at exact prices
2. **No Market Impact**: Large orders don't move price
3. **Perfect Fills**: All orders assume immediate fill
4. **Fixed Commission**: Doesn't account for maker/taker differences
5. **No Margin**: Only spot trading simulation
6. **No Partial Fills**: Orders execute fully or not at all

### Future Enhancements

- [ ] Advanced order types (OCO, trailing stop)
- [ ] Monte Carlo simulation for confidence intervals
- [ ] Walk-forward analysis
- [ ] Parameter optimization grid search
- [ ] Export results to CSV/JSON
- [ ] Comparison of multiple backtests
- [ ] Database persistence of results
- [ ] Real-time progress updates via WebSocket

---

## 🔗 Related Documentation

- [Backend Integration Status](./BACKEND_INTEGRATION_STATUS.md)
- [Trading Migration Summary](./TRADING_MIGRATION_SUMMARY.md)
- [Setup Detection Guide](./SETUP_DETECTION.md)

---

## 📝 API Reference

### useBacktesting Hook

```typescript
const {
  // Data
  backtests: BacktestSummary[],

  // Loading states
  isLoadingBacktests: boolean,
  isRunningBacktest: boolean,
  isDeletingBacktest: boolean,

  // Functions
  runBacktest: (config: BacktestConfig) => Promise<BacktestResult>,
  getBacktestResult: (id: string) => Promise<BacktestResult | null>,
  deleteBacktest: (id: string) => Promise<void>,

  // Errors
  runBacktestError: Error | null,
  deleteBacktestError: Error | null,
} = useBacktesting();
```

### BacktestConfig Type

```typescript
interface BacktestConfig {
  symbol: string;
  interval: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  initialCapital: number;
  setupTypes?: string[]; // Optional: filter specific setups
  minConfidence?: number; // 0-100
  stopLossPercent?: number;
  takeProfitPercent?: number;
  maxPositionSize?: number; // 0-100 (% of capital)
  commission?: number; // 0-1 (e.g., 0.001 = 0.1%)
}
```

---

**Last Updated:** November 30, 2024
**Maintained by:** MarketMind Development Team
**Status:** Production Ready ✅
