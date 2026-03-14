# PLAN-05: Algorithm Optimization (Shared Packages)

## Context
The shared indicator packages contain performance-critical code that runs on every kline update. SMA uses a naive O(n*p) inner loop instead of O(n) sliding window. FVG fill detection uses O(n^2) nested loops instead of O(n) single pass. Additionally, 35 files duplicate `getKlineClose` definitions that already exist in `@marketmind/types`. These optimizations directly impact both frontend chart rendering speed and backend backtest throughput.

## Branch
`perf/algorithm-optimization`

---

## 1. SMA sliding window — O(n) instead of O(n*p)

### File: `packages/indicators/src/movingAverages.ts`

### Current (lines 5-29):
```typescript
export const calculateSMA = (klines: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];
  const result: (number | null)[] = [];
  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      const kline = klines[i - j];
      if (!kline) continue;
      sum += getKlineClose(kline);
    }
    result.push(sum / period);
  }
  return result;
};
```

### Complexity: O(n * p) where n = kline count, p = period
For 20K klines with period 200: 4,000,000 iterations

### Optimized (sliding window):
```typescript
export const calculateSMA = (klines: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];

  const result: (number | null)[] = new Array(klines.length);
  let windowSum = 0;

  for (let i = 0; i < klines.length; i++) {
    windowSum += getKlineClose(klines[i]!);

    if (i >= period) {
      windowSum -= getKlineClose(klines[i - period]!);
    }

    if (i < period - 1) {
      result[i] = null;
    } else {
      result[i] = windowSum / period;
    }
  }

  return result;
};
```

### Complexity: O(n) — single pass
For 20K klines with period 200: 20,000 iterations (200x faster)

### Key changes
- Pre-allocate result array (avoids dynamic resizing)
- Single loop with running sum
- Subtract outgoing element instead of re-summing entire window
- Removed `!kline` guard since klines array should never have holes

### Test impact
All existing SMA tests must pass with identical results. The only change is computational approach, not output.

---

## 2. FVG fill detection — O(n) single pass instead of O(n^2)

### File: `packages/indicators/src/fvg.ts`

### Current (lines 72-87):
```typescript
for (const gap of gaps) {
  for (let i = gap.index + 2; i < klines.length; i++) {
    const high = getKlineHigh(klines[i]!);
    const low = getKlineLow(klines[i]!);
    if (gap.type === 'bullish' && low <= gap.low) {
      gap.filled = true;
      break;
    }
    if (gap.type === 'bearish' && high >= gap.high) {
      gap.filled = true;
      break;
    }
  }
}
```

### Complexity: O(g * n) worst case, where g = gap count
With 500 gaps in 20K klines: up to 10,000,000 iterations

### Optimized (integrated single-pass):

Replace the entire `calculateFVG` function:
```typescript
export const calculateFVG = (klines: Kline[]): FVGResult => {
  if (klines.length < 3) {
    return { gaps: [], bullishFVG: [], bearishFVG: [] };
  }

  const gaps: FairValueGap[] = [];
  const bullishFVG: (FairValueGap | null)[] = new Array(klines.length).fill(null);
  const bearishFVG: (FairValueGap | null)[] = new Array(klines.length).fill(null);
  const unfilledGaps: FairValueGap[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < 2) continue;

    const k1 = klines[i - 2]!;
    const k3 = klines[i]!;
    const k2 = klines[i - 1]!;

    const k1High = getKlineHigh(k1);
    const k1Low = getKlineLow(k1);
    const k3High = getKlineHigh(k3);
    const k3Low = getKlineLow(k3);

    // Check fill for existing unfilled gaps using current candle
    const currentHigh = k3High;
    const currentLow = k3Low;
    for (let g = unfilledGaps.length - 1; g >= 0; g--) {
      const gap = unfilledGaps[g]!;
      if (gap.type === 'bullish' && currentLow <= gap.low) {
        gap.filled = true;
        unfilledGaps.splice(g, 1);
      } else if (gap.type === 'bearish' && currentHigh >= gap.high) {
        gap.filled = true;
        unfilledGaps.splice(g, 1);
      }
    }

    // Detect new gaps
    if (k3Low > k1High) {
      const gap: FairValueGap = {
        index: i - 1,
        type: 'bullish',
        high: k3Low,
        low: k1High,
        filled: false,
        timestamp: k2.openTime,
      };
      gaps.push(gap);
      unfilledGaps.push(gap);
      bullishFVG[i - 1] = gap;
    }

    if (k3High < k1Low) {
      const gap: FairValueGap = {
        index: i - 1,
        type: 'bearish',
        high: k1Low,
        low: k3High,
        filled: false,
        timestamp: k2.openTime,
      };
      gaps.push(gap);
      unfilledGaps.push(gap);
      bearishFVG[i - 1] = gap;
    }
  }

  return { gaps, bullishFVG, bearishFVG };
};
```

### Complexity: O(n * g_avg) where g_avg = average number of concurrent unfilled gaps
In practice, g_avg << n (typically 10-50 unfilled gaps at any time), so effectively O(n)

### Key changes
- Gap detection and fill checking happen in the same forward pass
- `unfilledGaps` array shrinks as gaps get filled (removed from tracking)
- No backward iteration over all klines per gap
- Pre-allocate arrays with `.fill(null)` instead of `.push(null)` in loop

### Subtle difference
Gaps are now checked for fill starting from the candle AFTER the gap's k3 (index + 1), not index + 2. This is because the current candle (i) is already at index gap.index + 2 or later by the time we check. The `for` loop at `g` checks the current `klines[i]` against all unfilled gaps from previous iterations, which correctly matches the original behavior since gaps detected at index `i-1` are only added to `unfilledGaps` AFTER the fill check.

---

## 3. Deduplicate `getKlineClose` across 35 indicator files

### Source of truth: `packages/types/src/klineUtils.ts`

### Verify canonical definitions exist:
```typescript
// packages/types/src/klineUtils.ts
export const getKlineOpen = (kline: Kline): number => parseFloat(kline.open);
export const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
export const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
export const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
export const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);
```

### Verify export from package entry:
```typescript
// packages/types/src/index.ts — must export these
export { getKlineOpen, getKlineHigh, getKlineLow, getKlineClose, getKlineVolume } from './klineUtils';
```

### Files to update (34 files in packages/indicators/src/):
For each file, replace local definition with import:

**Before (each file):**
```typescript
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
```

**After:**
```typescript
import { getKlineClose } from '@marketmind/types';
```

### Files with multiple kline accessors (also replace `getKlineHigh`, `getKlineLow`, `getKlineOpen`):
- `fvg.ts` (getKlineHigh, getKlineLow)
- `swingPoints.ts` (getKlineHigh, getKlineLow)
- `atr.ts` (getKlineHigh, getKlineLow, getKlineClose)
- `stochastic.ts` (getKlineHigh, getKlineLow, getKlineClose)
- `bollingerBands.ts` (getKlineClose)
- `rsi.ts` (getKlineClose)
- And ~28 more files

### Approach
1. Verify `@marketmind/types` exports exist and match signatures
2. Run a batch find-and-replace per accessor function
3. Run `pnpm --filter @marketmind/indicators test` after each batch
4. Verify no test regressions

### Risk
- If `@marketmind/types` Kline type uses `string` for price fields (which it does based on the `parseFloat` calls), the accessor signatures must match exactly
- If any indicator file uses a slightly different accessor (e.g., `Number(kline.close)` vs `parseFloat(kline.close)`), verify the behavior is identical

---

## 4. Deduplicate position sizing

### Files:
- `packages/trading-core/src/positionSizing/simple.ts` — `roundQuantity`, `calculateRiskBasedPositionSize`
- `packages/risk/src/positionSizing.ts` — identical functions

### Solution
Keep the canonical version in `@marketmind/risk` (position sizing is a risk concept).

**In `packages/trading-core/src/positionSizing/simple.ts`:**
Replace with re-export:
```typescript
export { roundQuantity, calculateRiskBasedPositionSize } from '@marketmind/risk';
```

Or if `trading-core` shouldn't depend on `risk`, move both to `@marketmind/types` or `@marketmind/utils`.

### Check dependency direction first:
- Does `trading-core` already depend on `risk`? → Re-export from risk
- Does `risk` depend on `trading-core`? → Move canonical to `trading-core`, re-export from risk
- Neither depends on the other? → Move to `@marketmind/utils`, both re-export

---

## 5. EMA multiplier extraction (minor)

### Pattern found in 9 files:
```typescript
const multiplier = 2 / (period + 1);
```

### Solution
Add to `packages/indicators/src/utils/ema.ts`:
```typescript
export const emaMultiplier = (period: number): number => 2 / (period + 1);

export const calculateEmaStep = (currentValue: number, previousEma: number, multiplier: number): number =>
  (currentValue - previousEma) * multiplier + previousEma;
```

Replace in all 9 files:
- `movingAverages.ts`
- `dema.ts`
- `tema.ts`
- `tsi.ts`
- `ppo.ts`
- `klinger.ts`
- `elderRay.ts`
- `massIndex.ts`
- `trendCore.ts`

### Impact: Minimal performance gain, but reduces magic numbers and ensures consistency.

---

## Verification

```bash
# Run indicator tests (722 tests)
pnpm --filter @marketmind/indicators test

# Run all package tests
pnpm --filter @marketmind/trading-core test
pnpm --filter @marketmind/risk test
pnpm --filter @marketmind/types test

# Type check all packages
pnpm --filter @marketmind/indicators type-check
pnpm --filter @marketmind/trading-core type-check
pnpm --filter @marketmind/risk type-check

# Benchmark (manual):
# 1. Add console.time('sma-20k') before/after calculateSMA(20000 klines, 200)
# 2. Compare old vs new: expect 100-200x speedup
# 3. Add console.time('fvg-20k') before/after calculateFVG(20000 klines)
# 4. Compare old vs new: expect 10-50x speedup depending on gap density
```

## Files Modified
- `packages/indicators/src/movingAverages.ts` (SMA sliding window)
- `packages/indicators/src/fvg.ts` (FVG single-pass)
- `packages/indicators/src/*.ts` (~34 files, getKlineClose dedup)
- `packages/trading-core/src/positionSizing/simple.ts` (re-export from risk)
- `packages/indicators/src/utils/ema.ts` (new, EMA utility)
