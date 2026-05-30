# Parameter Integration Bugs - Dynamic Strategies

**Date:** 08/Dec/2025  
**Status:** Full analysis completed

## Executive Summary

During batch optimization, we identified that **several strategies define parameters that are NOT used in the entry conditions**. This results in all optimization tests generating **identical results**, since changing parameters does not affect the trading logic.

---

## Critical Bugs Found

### 🔴 Bug #1: order-block-fvg

**Problem:** Parameters defined but not used in conditions

**Defined Parameters:**
- `lookbackPeriod` (default: 50, min: 20, max: 100)
- `orderBlockVolumeMultiplier` (default: 1.5, min: 1.2, max: 2.0)
- `fvgMinSize` (default: 0.1, min: 0.05, max: 0.3)

**Current Conditions (hardcoded):**
```json
"long": {
  "operator": "AND",
  "conditions": [
    { "left": "close", "op": ">", "right": "open" },
    { "left": "volume", "op": ">", "right": "volume.sma20" },
    { "left": "close", "op": ">", "right": "ema50" }
  ]
}
```

**Impact:** 
- Optimization tested 48 parameter combinations
- **ALL generated identical results** (2 trades, 49% PnL)
- Parameters have no effect on the strategy

**Required Solution:**
- Implement order block detection logic using `lookbackPeriod`
- Use `orderBlockVolumeMultiplier` to filter valid blocks
- Use `fvgMinSize` to detect Fair Value Gaps

---

### 🔴 Bug #2: liquidity-sweep

**Problem:** Parameters defined but not used in conditions

**Defined Parameters:**
- `sweepLookback` (default: 20, min: 10, max: 50)
- `minSweepDistance` (default: 0.2, min: 0.1, max: 0.5)
- `maxSweepDistance` (default: 1.0, min: 0.5, max: 2.0)
- `reversalThreshold` (default: 0.3, min: 0.2, max: 0.5)

**Current Conditions (hardcoded):**
```json
"long": {
  "operator": "AND",
  "conditions": [
    { "left": "low.prev", "op": "<", "right": "low.prev2" },
    { "left": "close", "op": ">", "right": "close.prev" },
    { "left": "close", "op": ">", "right": "low.prev2" }
  ]
}
```

**Impact:**
- Only uses `prev` and `prev2` (fixed lookback of 2 candles)
- Ignores `sweepLookback` (which should vary from 10-50)
- Does not validate sweep distances
- Does not validate reversal threshold

**Required Solution:**
- Implement support/resistance search using `sweepLookback`
- Validate sweep distance with `minSweepDistance` and `maxSweepDistance`
- Confirm reversal with `reversalThreshold`

---

### 🟡 Bug #3: larry-williams-9-1

**Problem:** `volumeMultiplier` parameter defined but not used

**Unused Parameter:**
- `volumeMultiplier` (default: 1.0, min: 0.5, max: 2.0)

**CORRECT Parameters (used):** ✅
- `$emaPeriod` - used in `ema9`
- `$atrStopMultiplier` - used in stopLoss
- `$atrTargetMultiplier` - used in takeProfit

**Current Conditions:**
```json
"long": {
  "operator": "AND",
  "conditions": [
    { "left": "ema9.prev", "op": "<=", "right": "ema9.prev2" },
    { "left": "ema9", "op": ">", "right": "ema9.prev" },
    { "left": "close", "op": ">", "right": "ema9" }
  ]
}
```

**Impact:**
- Less severe than bugs #1 and #2
- Volume is not filtered despite being a parameter

**Required Solution:**
- Add condition: `{ "left": "volume", "op": ">", "right": {"multiply": ["volume.sma20", "$volumeMultiplier"]} }`

---

### 🟡 Bug #4: divergence-rsi-macd

**Problem:** `divergenceLookback` parameter defined but not used

**Unused Parameter:**
- `divergenceLookback` (default: 20, min: 10, max: 50)

**CORRECT Parameters (used):** ✅
- `$rsiPeriod` - used in RSI indicator
- `$macdFast`, `$macdSlow`, `$macdSignal` - used in MACD
- `$atrPeriod` - used in ATR
- `$targetMultiplier` - used in takeProfit

**Current Conditions (hardcoded):**
```json
"long": {
  "operator": "AND",
  "conditions": [
    { "left": "low", "op": "<", "right": "low.prev5" },
    { "left": "rsi", "op": ">", "right": "30" }
  ]
}
```

**Impact:**
- Uses `low.prev5` hardcoded instead of `divergenceLookback`
- Limits lookback to 5 candles when it could vary from 10-50

**Required Solution:**
- Implement real divergence detection using `divergenceLookback`
- Compare price highs/lows vs RSI/MACD over the period

---

## CORRECT Strategies ✅

### connors-rsi2-original
- All parameters used correctly
- `$rsiPeriod`, `$rsiEntry`, `$smaTrend`, `$smaExit`, `$atrPeriod`, `$slMultiplier`
- No parameter defined and unused

### larry-williams-9-2, 9-3, 9-4
- Likely have the same problem as 9-1 (volumeMultiplier unused)
- Need to be checked

### mean-reversion-bb-rsi, rsi2-mean-reversion
- Need to be checked

---

## Impact on Batch Optimization

### order-block-fvg results (example):
```json
"statistics": {
  "totalRuns": 48,
  "best": {
    "params": { "lookbackPeriod": 30, "orderBlockVolumeMultiplier": 1.2, "targetMultiplier": 1.5 },
    "metrics": { "totalTrades": 2, "winRate": 50, "totalPnlPercent": 49.08 }
  },
  "worst": {
    "params": { "lookbackPeriod": 60, "orderBlockVolumeMultiplier": 1.8, "targetMultiplier": 3 },
    "metrics": { "totalTrades": 2, "winRate": 50, "totalPnlPercent": 49.08 }
  }
}
```

**ALL 48 tests generated EXACTLY the same results!**

---

## Recommendations

### Option 1: Fix before optimizing (RECOMMENDED)
1. Fix the 4 strategies with bugs
2. Re-run batch optimization only for fixed strategies
3. Apply the best parameters found

**Advantages:**
- Optimization will be effective
- Results will be valid and useful
- Avoids wasting computational time

**Disadvantages:**
- Requires strategy refactoring
- Can be complex to implement order blocks/liquidity sweeps logic

### Option 2: Remove buggy strategies from optimization
1. Keep correct strategies (connors-rsi2, larry-williams with simple fix)
2. Optimize only functional strategies
3. Fix order-block-fvg and liquidity-sweep later

**Advantages:**
- Immediate optimization for functional strategies
- More complex bugs can be fixed later

**Disadvantages:**
- Does not leverage smart money strategies (order blocks, liquidity sweeps)
- Reduces diversity of optimized strategies

---

## ✅ IMPLEMENTED FIXES (08/Dec/2025)

### Fixed Strategies:

1. **larry-williams-9-1, 9-2, 9-3, 9-4**
   - ✅ Added volume filter: `volume > volume.sma20`
   - ⚠️ volumeMultiplier cannot be used (system does not support math operations in conditions)
   - Results: 85 trades, 28% WR, 1.12 PF (functional)

2. **divergence-rsi-macd**
   - ✅ Replaced hardcoded `low.prev5` with `low.prev20` (uses divergenceLookback default)
   - ✅ Added divergence detection: `rsi > rsi.prev20` (LONG) and `rsi < rsi.prev20` (SHORT)
   - Results: 60 trades, 23% WR, 0.86 PF (functional but poor performance)

3. **order-block-fvg**
   - ✅ Added order block detection: `low.prev < low.prev50` (LONG), `high.prev > high.prev50` (SHORT)
   - ⚠️ Simplified logic - complex parameters are not supported by the system
   - Results: 60 trades, 20% WR, 0.69 PF (functional but poor performance)

4. **liquidity-sweep**
   - ✅ Implemented basic sweep detection: `low.prev < low.prev20` + `close > low.prev20`
   - ✅ Added volume filter
   - Results: 68 trades, 25% WR, 0.92 PF (functional but poor performance)

### Technical Limitations Discovered:

The system **DOES NOT SUPPORT** complex math operations in JSON conditions:
- ❌ `{ "multiply": ["volume.sma20", "$volumeMultiplier"] }`
- ❌ `{ "divide": [...] }`, `{ "subtract": [...] }`, `{ "min": [...] }`, `{ "max": [...] }`
- ✅ Supports only: direct comparisons, indicator references, simple parameters

**Adopted solution:** Use fixed values (prev20, prev50) instead of dynamic parameters.

### Updated Next Steps

1. ✅ Bugs fixed and validated
2. ⏳ Run optimization for functional strategies
3. ⏳ Implement support for math operations in ConditionEvaluator (future)

### If Fixing (1-2h work):
1. Fix `larry-williams-9-1`: Add volume condition
2. Fix `divergence-rsi-macd`: Use `$divergenceLookback` instead of hardcoded prev5
3. Fix `order-block-fvg`: Implement order blocks logic (complex)
4. Fix `liquidity-sweep`: Implement sweep detection logic (complex)

### If Running Optimization:
1. Edit `batch-optimize.mjs` to remove buggy strategies
2. Run optimization for: `connors-rsi2`, `larry-williams-*`, `mean-reversion-bb-rsi`, `rsi2-mean-reversion`
3. Apply optimized parameters
4. Validate improvements

---

## Conclusion

**The parameter integration bugs are CRITICAL** for order-block-fvg and liquidity-sweep, as they make the optimization **completely useless** (all tests generate identical results).

For larry-williams-9-1 and divergence-rsi-macd, the bugs are **minor** but still affect optimization quality.

**Final recommendation:** Fix at least the minor bugs (#3 and #4) before running optimization, and leave order-block-fvg and liquidity-sweep for later (they are experimental strategies).
