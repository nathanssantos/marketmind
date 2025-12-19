# Plan: Fix Auto-Trading Entry/Stop/Target System

**Date:** 2025-12-19
**Status:** ✅ Completed

---

## Summary of Issues

### Issue 1: Entry and Stop Loss Use Same Swing Point
Recent commits (`b5e6b3a`, `ea79c8f`) broke the entry/stop calculation:
- **Entry** (LONG): min(lows) of last 2 candles
- **Stop Loss** (LONG): min(lows) of last 2 candles - (ATR × 0.1)
- Result: Entry and SL are nearly identical (only 0.1 ATR apart)

### Issue 2: Pending Order Hover Shows Orange/Undefined
In `useOrderLinesRenderer.ts` line 667-670:
```typescript
const position: PositionData = hoveredPosition;  // GroupedPosition cast
const isLong = position.type === 'long';  // position.type is UNDEFINED!
```
`GroupedPosition` has `netQuantity`, not `type` field → always renders as SHORT (orange).

### Issue 3: Tiny Targets on 1h Timeframe
With entry/SL so close (0.1%), the R:R calculation produces tiny targets.

---

## Files to Modify

### Backend - Entry/Stop Logic
1. `apps/backend/src/services/setup-detection/dynamic/ExitCalculator.ts`
2. `apps/backend/src/services/setup-detection/dynamic/StrategyInterpreter.ts`
3. `apps/backend/src/constants/index.ts`
4. `packages/types/src/strategyDefinition.ts`

### Strategy Definitions
5. `apps/backend/strategies/builtin/*.json` (all with swingHighLow stopLoss)

### Frontend - Chart Rendering
6. `apps/electron/src/renderer/components/Chart/useOrderLinesRenderer.ts`

---

## Implementation Steps

### Step 1: Fix Hover Bug (Quick Win)
**File:** `useOrderLinesRenderer.ts` line 670

```typescript
// BEFORE (broken):
const isLong = position.type === 'long';

// AFTER (fixed):
const isLong = hoveredPosition.netQuantity > 0;
```

Also fix the `PositionData` assignment to properly derive type from netQuantity.

### Step 2: Add Type Definition for Prior Swing Lookback
**File:** `packages/types/src/strategyDefinition.ts`

Add to `ExitLevel` interface:
```typescript
priorSwingLookback?: number;  // Lookback for finding PRIOR swing (different from entry)
```

### Step 3: Update Constants
**File:** `apps/backend/src/constants/index.ts`

```typescript
export const EXIT_CALCULATOR = {
  // ... existing
  MIN_SWING_BUFFER_ATR: 0.3,              // Minimum ATR buffer (was 0.1)
  DEFAULT_STOP_LOOKBACK: 5,               // Default lookback for SL swing
  MIN_ENTRY_STOP_SEPARATION_PERCENT: 0.5, // Minimum separation required
} as const;
```

### Step 4: Fix ExitCalculator.calculateSwingHighLowStop()
**File:** `ExitCalculator.ts`

Key changes:
1. Use `priorSwingLookback` if configured (default 5, not 2)
2. Enforce minimum buffer of 0.3 ATR (not 0.1)
3. Find swing point that is DIFFERENT from entry swing

```typescript
private calculateSwingHighLowStop(exit: ExitLevel, context: ExitContext): number {
  const lookback = exit.priorSwingLookback ?? exit.lookback ?? 5;  // Default 5, not 2

  // Enforce minimum buffer
  const configuredBuffer = this.resolveOperand(exit.buffer, context) ?? 0.3;
  const buffer = Math.max(configuredBuffer, 0.3);  // Min 0.3 ATR

  // ... find swing point with wider lookback
}
```

### Step 5: Add Validation in StrategyInterpreter
**File:** `StrategyInterpreter.ts`

After calculating entry and stop:
```typescript
const entryStopSeparation = Math.abs(entryPrice - stopLoss) / entryPrice;
if (entryStopSeparation < 0.005) {  // 0.5% minimum
  logger.warn('Entry and stop are too close - setup rejected');
  return { setup: null, confidence: 0 };
}
```

### Step 6: Update Strategy JSON Files
**Example:** `parabolic-sar-crypto.json`

```json
// BEFORE (broken):
"entryPrice": { "type": "swingHighLow", "lookback": 2 },
"stopLoss": { "type": "swingHighLow", "lookback": 2, "buffer": 0.1 }

// AFTER (fixed):
"entryPrice": { "type": "swingHighLow", "lookback": 1 },  // Signal candle only
"stopLoss": { "type": "swingHighLow", "lookback": 5, "buffer": 0.3 }  // Prior swing
```

Apply similar changes to all strategies using swingHighLow for both entry and stop.

---

## Correct Entry/Stop Logic (Reference)

### For LONG Positions:
1. **Signal**: Setup conditions met on candle close
2. **Entry**: Place LIMIT order at LOW of signal candle (or recent swing low with lookback 1-2)
3. **Stop Loss**: Place below a PRIOR swing low (lookback 5-10) with ATR × 0.3 buffer
4. **Take Profit**: Entry + (Risk × R:R multiplier)

### For SHORT Positions:
1. **Signal**: Setup conditions met on candle close
2. **Entry**: Place LIMIT order at HIGH of signal candle (or recent swing high with lookback 1-2)
3. **Stop Loss**: Place above a PRIOR swing high (lookback 5-10) with ATR × 0.3 buffer
4. **Take Profit**: Entry - (Risk × R:R multiplier)

### Key Principle:
**Entry and Stop Loss must use DIFFERENT swing points.** Entry uses the immediate pullback level (signal candle), while Stop Loss uses a prior structure level for invalidation.

---

## Verification Steps

1. Run existing tests to ensure no regressions
2. Test pending order creation - verify entry/SL are properly separated
3. Test chart rendering - verify pending orders show correct color (green for LONG)
4. Test R:R validation - verify proper risk/reward ratios
5. Backtest affected strategies to confirm improved performance

---

## Risk Mitigation

- `priorSwingLookback` field is optional - existing strategies work with defaults
- Minimum buffer enforcement prevents dangerous tight stops
- Validation layer rejects setups with insufficient separation
- Extensive logging for debugging

---

## Commits That Caused The Issue

1. `ea79c8f` (Dec 19, 14:03) - Added swingHighLow stop loss calculation
2. `b5e6b3a` (Dec 19, 14:17) - Added swingHighLow entry price calculation

Both used the same lookback (2) causing entry and SL to reference the same swing point.
