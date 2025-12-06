# 📊 Advanced Risk Management & Position Control Guide

**MarketMind v0.31.0+**

Complete guide for using advanced risk management features in backtesting and live trading.

---

## 🎯 Overview

MarketMind includes three powerful systems for managing risk and optimizing position sizing:

1. **Kelly Criterion** - Optimal position sizing based on statistical edge
2. **ATR-Based Trailing Stop** - Dynamic stop loss that follows price movements
3. **Partial Exits** - Scaled exits to lock in profits at multiple levels

All features are fully accessible via the **Backtesting Dialog** UI - no code changes required!

---

## 💰 Kelly Criterion Position Sizing

### What is Kelly Criterion?

Kelly Criterion is a mathematical formula that calculates the optimal position size based on:
- **Win Rate**: Percentage of winning trades
- **Average Win**: Average profit per winning trade
- **Average Loss**: Average loss per losing trade

**Formula**: `Kelly % = (W * R - L) / R`
- W = Win probability
- L = Loss probability (1 - W)
- R = Average Win / Average Loss ratio

### How to Use

1. Open **Toolbar → Backtesting**
2. Scroll to **💰 Risk Management (Kelly Criterion)** section
3. Enable **"Enable Kelly Criterion Position Sizing"** checkbox
4. Select a **Risk Profile**:
   - **Conservative**: ¼ Kelly (safest, 0.25 fraction)
   - **Moderate**: ½ Kelly (balanced, 0.5 fraction)
   - **Aggressive**: Full Kelly (maximum growth, 1.0 fraction)
5. Optionally fine-tune the **Kelly Fraction** slider

### Risk Profiles Explained

```typescript
Conservative (¼ Kelly - Recommended)
├─ Lowest volatility
├─ Minimal drawdown risk
├─ Best for beginners
└─ Still grows capital efficiently

Moderate (½ Kelly - Default)
├─ Balanced risk/reward
├─ Moderate drawdowns
├─ Good for most traders
└─ Optimal long-term growth

Aggressive (Full Kelly)
├─ Maximum growth rate
├─ High volatility
├─ Large drawdowns possible
└─ Only for experienced traders
```

### Example Configuration

```
Enable Kelly Criterion: ✓
Risk Profile: Moderate
Kelly Fraction: 0.50

Result: Position size auto-adjusts based on:
- Recent win rate: 58%
- Average win/loss ratio: 2.1
- Current account volatility
- Portfolio heat level
```

### When to Use Kelly

✅ **Best For:**
- Strategies with proven edge (>50% win rate)
- Consistent risk/reward ratios
- Long-term capital growth
- Multiple uncorrelated strategies

❌ **Avoid When:**
- New/unproven strategies
- Highly variable win rates
- Few historical trades (<30)
- High market uncertainty

---

## 📈 ATR-Based Trailing Stop

### What is ATR Trailing Stop?

Uses **Average True Range (ATR)** to set dynamic stop losses that:
- Adapt to market volatility
- Protect profits as price moves favorably
- Move to break-even after target profit
- Never move against the position

### How to Use

1. Open **Toolbar → Backtesting**
2. Scroll to **📈 ATR-Based Trailing Stop** section
3. Enable **"Enable Trailing Stop"** checkbox
4. Configure parameters:

### Parameters Explained

**Initial Stop ATR Multiplier** (Default: 2.0)
```
Entry Price: $50,000
ATR(14): $500
Initial Stop Multiplier: 2.0
→ Stop Loss: $50,000 - ($500 × 2.0) = $49,000
```
- Higher value = Wider initial stop (less likely to be stopped out)
- Lower value = Tighter initial stop (more aggressive)

**Trailing ATR Multiplier** (Default: 1.5)
```
Current Price: $52,000
ATR(14): $500
Trailing Multiplier: 1.5
→ Stop trails at: $52,000 - ($500 × 1.5) = $51,250
```
- Distance maintained as stop follows price up
- Adjusts automatically with volatility changes

**Break-Even After (R-Multiple)** (Default: 1.0)
```
Entry: $50,000
Initial Stop: $49,000
Risk (1R): $1,000
Break-Even After: 1.0R

When Price Reaches: $51,000 (1R profit)
→ Stop moves to: $50,000 + 0.1% buffer = $50,050
```
- Protects capital after reaching profit target
- Guarantees risk-free trade from that point

**Break-Even Buffer (%)** (Default: 0.1%)
```
Entry Price: $50,000
Buffer: 0.1%
→ Break-Even Stop: $50,050 (slightly above entry)
```
- Small buffer to avoid accidental stop-outs at break-even
- Accounts for spread and slippage

### Example Configuration

```
Enable Trailing Stop: ✓
Initial Stop ATR Multiplier: 2.0
Trailing ATR Multiplier: 1.5
Break-Even After: 1.0 R
Break-Even Buffer: 0.1%

Trade Flow:
1. Enter LONG at $50,000
2. ATR = $500
3. Initial stop: $49,000 (2.0 × $500 below entry)
4. Price moves to $51,000 (+1R profit)
5. Stop moves to break-even: $50,050
6. Price continues to $53,000
7. Stop trails at: $52,250 (1.5 × $500 below price)
8. Locked in profit: $2,200+ guaranteed
```

### Best Practices

✅ **Volatile Markets**: Use larger ATR multipliers (2.5-3.0)
✅ **Trending Markets**: Use tighter trailing (1.0-1.5 ATR)
✅ **Range-Bound**: Disable trailing, use fixed stops
✅ **Swing Trading**: Break-even at 1.5-2.0R
✅ **Day Trading**: Break-even at 0.5-1.0R

---

## 🎯 Partial Exits (Scale Out)

### What are Partial Exits?

A strategy to **take profits at multiple price levels** while letting remaining position run:
- Lock in partial profits at predefined R-multiples
- Reduce position risk as trade progresses
- Let winners run with smaller position

### How to Use

1. Open **Toolbar → Backtesting**
2. Scroll to **🎯 Partial Exits (Scale Out)** section
3. Enable **"Enable Partial Exits"** checkbox
4. Configure exit levels:

### Exit Levels Explained

**First Exit Level** (Default: 33% at 1.5R)
```
Position Size: 1.0 BTC
Entry: $50,000
Risk: $1,000 (1R)
Target: 1.5R = $51,500

At $51,500:
→ Sell 33% (0.33 BTC)
→ Lock in: $1,500 profit on 1/3 of position
→ Remaining: 0.67 BTC
```

**Second Exit Level** (Default: 33% at 2.5R)
```
Remaining: 0.67 BTC
Target: 2.5R = $52,500

At $52,500:
→ Sell 33% (0.33 BTC more)
→ Lock in: $2,500 profit on another 1/3
→ Remaining: 0.34 BTC (trails with stop)
```

**Remaining Position** (34% trails)
```
Final 34% (0.34 BTC):
→ Trails with ATR-based stop
→ No fixed target
→ Rides trend until stopped out
→ Maximum profit potential
```

### Lock Profits After First Exit

```
☑ Lock Profits After First Exit

When first partial exit triggers:
→ Move stop loss to break-even
→ Guarantees profit on entire trade
→ Risk-free position from that point
```

### Example Configurations

**Aggressive (Lock Quick Profits)**
```
First Exit:  50% at 1.0R
Second Exit: 30% at 2.0R
Remaining:   20% trails
Lock After First: ✓

Best for: Choppy markets, lower win rate strategies
```

**Moderate (Balanced)**
```
First Exit:  33% at 1.5R
Second Exit: 33% at 2.5R
Remaining:   34% trails
Lock After First: ✓

Best for: Most strategies, default recommendation
```

**Conservative (Let Winners Run)**
```
First Exit:  25% at 2.0R
Second Exit: 25% at 3.0R
Remaining:   50% trails
Lock After First: ✗

Best for: Strong trends, high win rate strategies
```

### Best Practices

✅ **Total Must Equal 100%**: Exit percentages are auto-calculated
✅ **Ascending R-Multiples**: Second exit should be > first exit
✅ **Lock Profits in Choppy Markets**: Protect gains early
✅ **Let Run in Trends**: Keep larger portion trailing
✅ **Test Different Combinations**: Backtest to find optimal levels

---

## 🔧 Complete Configuration Example

### Recommended Settings for Swing Trading

```
📊 Market & Setup
├─ Symbol: BTCUSDT
├─ Interval: 1h
├─ Setups: Setup 9.2, 9.3, 9.4 enabled
└─ Min Confidence: 70%

💰 Risk Management
├─ Kelly Criterion: ✓ Enabled
├─ Risk Profile: Moderate
├─ Kelly Fraction: 0.50
└─ Max Position: 10% (fallback)

📈 Trailing Stop
├─ Enabled: ✓
├─ Initial Stop ATR: 2.0
├─ Trailing ATR: 1.5
├─ Break-Even After: 1.0R
└─ Break-Even Buffer: 0.1%

🎯 Partial Exits
├─ Enabled: ✓
├─ First Exit: 33% at 1.5R
├─ Second Exit: 33% at 2.5R
├─ Remaining: 34% trails
└─ Lock After First: ✓

⚙️ Other Settings
├─ Algorithmic SL/TP: ✓
├─ Only With Trend: ✓
├─ Commission: 0.1%
└─ Min Profit: 2%
```

### Expected Results

```
Win Rate: 55-65%
Avg Win: 2.8R
Avg Loss: 0.9R
Profit Factor: 2.1+
Max Drawdown: 8-12%
```

---

## 📊 Testing Your Configuration

### Step-by-Step Backtest

1. **Configure Settings** (as shown above)
2. **Select Date Range**: Last 3-6 months for meaningful data
3. **Click "Run Backtest"**
4. **Review Results**:
   - Total Trades: Should be 20+ for statistical significance
   - Win Rate: Target 55%+
   - Profit Factor: Target 1.5+
   - Max Drawdown: Monitor tolerance
5. **Iterate**: Adjust parameters and re-test

### What to Optimize

**If Win Rate Too Low (<50%)**
- ✓ Increase min confidence
- ✓ Enable "Only With Trend"
- ✓ Reduce number of setups

**If Drawdown Too High (>15%)**
- ✓ Use Conservative Kelly (¼)
- ✓ Enable partial exits
- ✓ Tighten initial stop (lower ATR multiplier)

**If Missing Big Moves**
- ✓ Use looser trailing stop (higher ATR)
- ✓ Reduce partial exit percentages
- ✓ Don't lock profits after first exit

**If Too Many Small Losses**
- ✓ Increase break-even trigger (1.5-2.0R)
- ✓ Widen initial stop (higher ATR)
- ✓ Increase min profit threshold

---

## 🚀 Advanced Tips

### Combining All Three Systems

```
Kelly Criterion: Dynamic position sizing
     ↓
ATR Trailing Stop: Dynamic risk management
     ↓
Partial Exits: Dynamic profit taking
     ↓
Result: Fully automated, adaptive trading system
```

### Portfolio Heat Management

When using Kelly Criterion with **Portfolio Heat Tracker**:
```
Max Portfolio Heat: 20%
Current Heat: 12% (60% of max)
Kelly Recommendation: $2,500 position
→ Adjusted Size: $2,500 × 0.6 = $1,500
```
- Auto-reduces position size when portfolio heat is high
- Prevents overexposure during losing streaks
- Built-in drawdown protection

### Volatility Adjustment

Kelly + Volatility-Adjusted Sizing:
```
Base Kelly: $5,000
Current ATR: $800 (High volatility)
Historical ATR: $500
Volatility Ratio: 1.6 (60% higher than normal)
→ Adjusted Size: $5,000 ÷ 1.6 = $3,125
```
- Automatically reduces size in volatile markets
- Increases size in stable markets
- Prevents overtrading during high volatility

---

## 📖 References

### Academic Papers
- Kelly, J. L. (1956) "A New Interpretation of Information Rate"
- Thorp, E. O. (1997) "The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market"
- Wilder, J. W. (1978) "New Concepts in Technical Trading Systems" (ATR)

### Implementation Files
- `RiskManagementService.ts` - Kelly Criterion orchestrator
- `KellyCriterionCalculator.ts` - Kelly formula implementation
- `VolatilityAdjustedKelly.ts` - ATR-based position sizing
- `PortfolioHeatTracker.ts` - Portfolio risk monitoring
- `TrailingStopManager.ts` - ATR-based trailing stops
- `PartialExitManager.ts` - Scaled profit taking
- `PositionManager.ts` - Orchestrates all position controls

### Related Documentation
- `BACKTESTING_GUIDE.md` - Complete backtesting workflow
- `BACKTESTING_ADVANCED.md` - Walk-forward optimization, Monte Carlo
- `RISK_OPTIMIZATION.md` - Risk parameter tuning strategies
- `ALGORITHMIC_TRADING_ENHANCEMENT_PLAN.md` - Full implementation roadmap

---

## ❓ FAQ

**Q: Should I use Kelly Criterion for all strategies?**
A: No. Only use Kelly when you have:
- 30+ historical trades to analyze
- Consistent win rate (not too variable)
- Proven edge (>50% win rate with positive expectancy)

**Q: What's better - Full Kelly or Quarter Kelly?**
A: Quarter Kelly is recommended for most traders. Full Kelly maximizes growth but with 4x the volatility.

**Q: Can I use partial exits without Kelly or trailing stops?**
A: Yes! All three systems are independent. Mix and match as needed.

**Q: How do I know if my ATR multipliers are correct?**
A: Backtest! Compare different values. Optimal settings vary by market and strategy.

**Q: What if my remaining % doesn't equal 34%?**
A: Total must equal 100%. UI auto-calculates remaining % from your exit levels.

**Q: Does this work for live trading or just backtesting?**
A: Currently backtesting only. Live trading integration is planned for future release.

---

**Last Updated**: December 2024  
**Version**: 0.31.0  
**Status**: Production Ready ✅
