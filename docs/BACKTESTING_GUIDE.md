# Backtesting System - User Guide

**Status:** ✅ Complete
**Version:** 0.33.0
**Date:** November 30, 2024

---

## 📋 Overview

The backtesting system allows you to test trading strategies against historical market data using the setup detection algorithms. It simulates trades based on detected setups and provides comprehensive performance metrics.

---

## 🎯 Features

### Configuration Options
- **Symbol & Interval**: Test on any available market data
- **Date Range**: Specify start and end dates for the backtest period
- **Capital Management**:
  - Initial capital amount
  - Maximum position size (% of capital per trade)
  - Commission rate (%)
- **Risk Management**:
  - Stop Loss percentage
  - Take Profit percentage
  - Minimum setup confidence threshold

### Metrics Calculated
- **Performance**: Total PnL, Final Equity, Max Drawdown, Sharpe Ratio
- **Trading Stats**: Total trades, Win rate, Profit factor
- **Win/Loss Analysis**: Avg win/loss, Largest win/loss, Avg PnL per trade
- **Costs**: Total commission paid
- **Equity Curve**: Visual representation of account growth over time

---

## 🚀 How to Use

### 1. Access the Backtesting Panel

The BacktestingPanel component can be integrated into your trading interface:

```tsx
import { BacktestingPanel } from '@renderer/components/Trading/BacktestingPanel';

<BacktestingPanel />
```

### 2. Configure Your Backtest

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

### 3. View Results

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

---

## 💡 Best Practices

### Data Requirements

1. **Sufficient Data**: Ensure you have enough historical klines
   ```bash
   # Check available data
   SELECT COUNT(*), MIN(open_time), MAX(open_time)
   FROM klines
   WHERE symbol = 'BTCUSDT' AND interval = '1h';
   ```

2. **Data Quality**: Verify no gaps in your data
   - Missing klines can affect results
   - Use the kline backfill feature if needed

### Strategy Testing

1. **Start Conservative**:
   - Lower position sizes (5-10%)
   - Tighter stop losses initially
   - Higher confidence thresholds (70%+)

2. **Parameter Optimization**:
   - Test different stop loss levels
   - Vary take profit targets
   - Adjust confidence thresholds
   - Try different setup types

3. **Validation**:
   - Test on multiple time periods
   - Try different market conditions (bull/bear)
   - Use out-of-sample testing

4. **Avoid Overfitting**:
   - Don't optimize for one specific period
   - Keep parameters simple and logical
   - Test on unseen data

---

## 🔧 Technical Details

### Backend Implementation

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
