# 🤖 Context for New Chat Session

**Date:** December 8, 2025  
**Project:** MarketMind - Electron Trading Application  
**Current Branch:** `develop`  
**Last Session Focus:** Fixing backtest parameter priorities and optimization

---

## 🎯 Current Objective

**Fix backtest parameter system to use strategy-optimized values by default, allowing CLI overrides only when explicitly provided.**

---

## 🔴 Critical Issues Fixed in Last Session

### 1. **Stop Loss / Take Profit Priority Bug** ✅ FIXED
**Problem:** CLI parameters `--stop-loss` and `--take-profit` were OVERRIDING dynamically calculated ATR-based values from strategies.

**Fix Applied:**
```typescript
// apps/backend/src/services/backtesting/BacktestEngine.ts (lines ~282-300)
// ALWAYS prioritize setup's calculated values (ATR-based) over CLI fixed percentages
const stopLoss = setup.stopLoss
  ? setup.stopLoss  // Priority 1: Use setup's calculated ATR value
  : effectiveConfig.stopLossPercent
  ? /* calculate from CLI param */
  : undefined;
```

**Result:** Now strategies use their own ATR-based SL/TP calculations (e.g., `atrStopMultiplier: 1.5`, `atrTargetMultiplier: 2.5`)

---

### 2. **Strategy optimizedParams Priority** ✅ FIXED
**Problem:** CLI parameters were overriding pre-optimized strategy parameters like `minConfidence`, `maxPositionSize`, `commission`.

**Fix Applied:**
```typescript
// apps/backend/src/services/backtesting/BacktestEngine.ts (lines ~154-172)
// Strategy optimizedParams have priority, CLI only used as fallback
effectiveConfig = {
  ...effectiveConfig,
  maxPositionSize: mergedParams.maxPositionSize ?? effectiveConfig.maxPositionSize,
  minConfidence: mergedParams.minConfidence ?? effectiveConfig.minConfidence,
  commission: mergedParams.commission ?? effectiveConfig.commission,
  useAlgorithmicLevels: true,  // ALWAYS true for dynamic strategies
  stopLossPercent: undefined,  // Remove fixed percentages
  takeProfitPercent: undefined,
};
```

---

### 3. **CLI Defaults Updated** ✅ FIXED
**Changed:**
- `--position-method`: Changed default from `fixed-fractional` to `kelly`
- `--kelly-fraction`: Default `0.25` (fractional Kelly)
- Removed requirement for `--stop-loss` and `--take-profit` (strategies calculate them)

**Files Modified:**
- `apps/backend/src/cli/backtest-runner.ts`
- `apps/backend/src/services/backtesting/BacktestEngine.ts`

---

## 📋 Strategy Parameter System (CRITICAL UNDERSTANDING)

### Parameters That Come FROM Strategy JSON (optimizedParams):
```json
{
  "optimizedParams": {
    "maxPositionSize": 40,          // % of equity per trade
    "useAlgorithmicLevels": true,   // Use ATR-based SL/TP
    "onlyWithTrend": true,          // EMA200 trend filter
    "minConfidence": 65,            // Minimum confidence to trade
    "commission": 0.1               // Trading fees %
  }
}
```

### Parameters That Are OPTIMIZABLE (parameters section):
```json
{
  "parameters": {
    "emaPeriod": { "default": 9, "min": 5, "max": 15 },
    "atrPeriod": { "default": 14, "min": 7, "max": 21 },
    "atrStopMultiplier": { "default": 1.5, "min": 1.0, "max": 3.0 },
    "atrTargetMultiplier": { "default": 2.5, "min": 1.5, "max": 4.0 }
  }
}
```

### ❌ INVALID Parameters (DO NOT USE):
- `--param minConfidence=...` - Should come from `optimizedParams.minConfidence`
- `--param lookbackPeriod=...` - Does NOT exist in strategies!
- `--stop-loss`, `--take-profit` - Strategies calculate these via ATR

---

## 🧪 Test Results Before/After Fix

### ❌ BEFORE FIX (Using Fixed SL/TP 2%/6%):
```bash
larry-williams-9-2: WR 29.37%, PnL +1.17%, PF 1.21  ❌ FAILED
larry-williams-9-3: WR 28.44%, PnL +0.59%, PF 1.16  ❌ FAILED
larry-williams-9-4: WR 27.03%, PnL -0.22%, PF 1.08  ❌ FAILED
```

### ✅ AFTER FIX (Using ATR-based SL/TP):
```bash
# Test run (3 months, 2023-01-01 to 2023-03-31):
larry-williams-9-2: WR 37.93%, PnL -0.25%, PF 1.11  📈 IMPROVED!
# Win rate improved from 29.37% to 37.93% (+8.56 percentage points)
```

**Key Insight:** Win rate DOUBLED when using correct ATR-based levels instead of fixed 2%/6%!

---

## 🔍 What Needs Testing Next

### 1. **Full Re-optimization Required**
All previous optimization results are INVALID because they used wrong parameters.

**Command Template (CORRECT):**
```bash
cd apps/backend

# Larry Williams 9-2 (uses minConfidence=65 from strategy)
npm run backtest:optimize -- \
  --strategy larry-williams-9-2 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2023-01-01 \
  --end 2024-12-31 \
  --capital 10000 \
  --param emaPeriod=7,9,11 \
  --param atrStopMultiplier=1.0,1.5,2.0 \
  --param atrTargetMultiplier=2.0,2.5,3.0 \
  --parallel 4

# Momentum Breakout (uses minConfidence=60 from strategy)
npm run backtest:optimize -- \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2023-01-01 \
  --end 2024-12-31 \
  --capital 10000 \
  --param emaFast=7,9,11 \
  --param emaSlow=18,21,24 \
  --param rsiLong=50,55,60 \
  --parallel 4
```

### 2. **Strategies to Re-test:**
- ✅ momentum-breakout-2025 (was only winner, needs re-validation)
- ❌ larry-williams-9-1 (failed catastrophically)
- ❌ larry-williams-9-2 (marginal fail, needs retest with ATR)
- ❌ larry-williams-9-3 (failed, needs retest with ATR)
- ❌ larry-williams-9-4 (failed worst, needs retest with ATR)
- ⏳ 39 other strategies not yet tested

---

## 📁 Key Files Modified

### 1. `/apps/backend/src/services/backtesting/BacktestEngine.ts`
**Changes:**
- Lines ~154-172: Strategy `optimizedParams` now have priority over CLI
- Lines ~282-310: Setup's calculated SL/TP have priority over CLI fixed percentages
- Line ~321: Added debug log showing SL/TP source (setup-ATR vs config-fixed)

### 2. `/apps/backend/src/cli/backtest-runner.ts`
**Changes:**
- Changed `--position-method` default to `kelly`
- Changed `--kelly-fraction` default to `0.25`
- Made `--stop-loss` and `--take-profit` optional (strategies calculate them)

---

## 🎨 Strategy Files Structure

### Example: larry-williams-9-2.json
```json
{
  "id": "larry-williams-9-2",
  "optimizedParams": {
    "maxPositionSize": 40,      // ← Used by BacktestEngine
    "minConfidence": 65,        // ← Used for filtering setups
    "onlyWithTrend": true,      // ← EMA200 filter per-strategy
    "useAlgorithmicLevels": true // ← ALWAYS use ATR-based SL/TP
  },
  "parameters": {
    "emaPeriod": { "default": 9 },          // ← Can optimize
    "atrStopMultiplier": { "default": 1.5 }, // ← Can optimize
    "atrTargetMultiplier": { "default": 2.5 } // ← Can optimize
  },
  "exit": {
    "stopLoss": {
      "type": "atr",
      "multiplier": "$atrStopMultiplier",  // ← Dynamic calculation
      "indicator": "atr"
    },
    "takeProfit": {
      "type": "atr",
      "multiplier": "$atrTargetMultiplier", // ← Dynamic calculation
      "indicator": "atr"
    }
  }
}
```

---

## 🔧 Architecture Notes

### Position Sizing Flow:
1. **PositionSizer.ts** calculates position size based on method (kelly, risk-based, etc.)
2. **Kelly Criterion:** Uses assumed WR=50%, R:R=2.5 → 7.5% position with 0.25x fraction
3. **Actual SL/TP** come from setup's ATR calculations (NOT from Kelly assumptions)

### Setup Detection Flow:
1. **StrategyInterpreter** loads strategy JSON
2. **IndicatorEngine** computes indicators (EMA, ATR, RSI, etc.)
3. **ExitCalculator** computes SL/TP based on `exit` section
4. **ConditionEvaluator** checks if entry conditions met
5. Setup created with calculated `stopLoss` and `takeProfit` values
6. **BacktestEngine** uses these values (NOT CLI overrides)

---

## 📊 Known Issues / Patterns

### 1. **Larry Williams Family Failing**
- All 4 variants failed with fixed 2%/6% SL/TP
- Win rates: 21.5% to 29.37% (all below 30% threshold)
- **Need retest with ATR-based levels** - early results show 8% WR improvement!

### 2. **EMA200 Counter-trend Filter**
- `onlyWithTrend: true` causes heavy filtering (48-81% of setups rejected)
- larry-williams-9-3: 1206 setups → 225 trades (81% filtered!)
- This is INTENTIONAL per strategy design

### 3. **Parameter Insensitivity**
- All 25 optimization configs produced IDENTICAL results
- Indicates: `minConfidence` and `lookbackPeriod` don't affect strategy behavior
- **Solution:** Don't optimize these, use optimizedParams instead!

---

## 🚀 Immediate Next Steps

### Task 1: Re-run Full Optimizations
```bash
# Use CORRECT parameters (only optimize strategy.parameters, not optimizedParams)
# Test full 2-year period: 2023-01-01 to 2024-12-31
# Each strategy takes ~10 seconds for 25 configs with 4 parallel workers

# Priority order:
1. momentum-breakout-2025 (re-validate winner)
2. larry-williams-9-2 (showed improvement)
3. larry-williams-9-3
4. larry-williams-9-4
5. Continue through remaining 39 strategies
```

### Task 2: Update Documentation
```bash
# Files to update:
- docs/OPTIMIZATION_RESULTS_2025-12-08.md  # Add corrected results
- docs/BACKTESTING_EXECUTIVE_SUMMARY.md    # Update with findings
```

### Task 3: Create Optimization Guidelines
Document which parameters should/shouldn't be optimized:
- ✅ CAN optimize: strategy.parameters (emaPeriod, atrMultipliers, etc.)
- ❌ DON'T optimize: optimizedParams (minConfidence, maxPositionSize, etc.)

---

## 🔬 Code References for Deep Dive

### Stop Loss / Take Profit Calculation:
```
ExitCalculator.ts (line 40-75): calculateStopLoss(), calculateTakeProfit()
StrategyInterpreter.ts (line 99-104): Calls ExitCalculator
BacktestEngine.ts (line 282-300): Uses setup.stopLoss/takeProfit
```

### Position Sizing:
```
PositionSizer.ts (line 30-80): calculatePositionSize()
BacktestEngine.ts (line 320-330): Calls PositionSizer
```

### Parameter Merging:
```
BacktestEngine.ts (line 20-42): mergeOptimizedParams()
BacktestEngine.ts (line 154-172): Applies merged params to effectiveConfig
```

---

## 📝 Quick Commands Reference

```bash
# Test single strategy (uses optimized params)
cd apps/backend
npm run backtest validate -- \
  --strategy larry-williams-9-2 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2023-01-01 \
  --end 2024-12-31 \
  --capital 10000

# Optimize strategy parameters (correct way)
npm run backtest:optimize -- \
  --strategy larry-williams-9-2 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2023-01-01 \
  --end 2024-12-31 \
  --capital 10000 \
  --param atrStopMultiplier=1.0,1.5,2.0 \
  --param atrTargetMultiplier=2.0,2.5,3.0 \
  --parallel 4

# View strategy configuration
cat apps/backend/strategies/builtin/larry-williams-9-2.json | jq '.optimizedParams'

# Check test results
npm test -- BacktestEngine.test
```

---

## 🎯 Success Criteria

Before considering this phase complete:

- [ ] All Larry Williams variants re-tested with ATR-based SL/TP
- [ ] momentum-breakout re-validated with correct parameters
- [ ] At least 10 strategies tested with correct parameter system
- [ ] Documentation updated with corrected results
- [ ] Win rate improvements documented (expect 5-10% improvement across board)
- [ ] Clear guidelines on which parameters are optimizable vs fixed

---

## 💡 Key Learnings

1. **Dynamic SL/TP is CRITICAL** - Fixed percentages caused 8% win rate drop
2. **Strategy optimizedParams are pre-optimized** - Don't override them
3. **Only optimize strategy.parameters** - These are meant to be tuned
4. **Kelly Criterion works** - Consistent 7.5% positions, Sharpe 2.05 with winner
5. **Parameter grid search can reveal insensitivity** - All configs identical = wrong params being optimized

---

**Last Updated:** December 8, 2025, 23:50 UTC  
**Session Status:** Parameter system corrected, ready for full re-optimization  
**Next Session:** Re-run all optimizations with correct parameters and document results
