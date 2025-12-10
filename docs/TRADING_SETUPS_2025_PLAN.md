# Implementation Plan: 2025 Trading Setups & New Indicators

## Overview

Based on research into 2025 algorithmic trading strategies, this plan adds new technical indicators and creates modern trading strategies that leverage them.

---

## Phase 1: New Indicators (packages/indicators)

### 1.1 ADX (Average Directional Index) - Trend Strength
**File:** `packages/indicators/src/adx.ts`

```typescript
interface ADXResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}
```
- Measures trend strength (0-100)
- Used for filtering trending vs ranging markets
- Required params: `period` (default: 14)

### 1.2 OBV (On-Balance Volume) - Volume Confirmation
**File:** `packages/indicators/src/obv.ts`

```typescript
interface OBVResult {
  values: number[];
  sma: (number | null)[];
}
```
- Cumulative volume indicator
- Confirms price movements with volume
- Required params: `smaPeriod` (optional, for OBV SMA)

### 1.3 Williams %R - Momentum Oscillator
**File:** `packages/indicators/src/williamsR.ts`

```typescript
type WilliamsRResult = (number | null)[];
```
- Range: -100 to 0
- -80 to -100: Oversold
- -20 to 0: Overbought
- Required params: `period` (default: 14)

### 1.4 CCI (Commodity Channel Index) - Trend/Momentum
**File:** `packages/indicators/src/cci.ts`

```typescript
type CCIResult = (number | null)[];
```
- Oscillates around 0
- +100/-100 thresholds for overbought/oversold
- Required params: `period` (default: 20)

### 1.5 MFI (Money Flow Index) - Volume-Weighted RSI
**File:** `packages/indicators/src/mfi.ts`

```typescript
type MFIResult = (number | null)[];
```
- Range: 0-100 (like RSI but with volume)
- 80+: Overbought, 20-: Oversold
- Required params: `period` (default: 14)

### 1.6 Donchian Channel - Breakout Detection
**File:** `packages/indicators/src/donchian.ts`

```typescript
interface DonchianResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}
```
- Upper: N-period highest high
- Lower: N-period lowest low
- Middle: Average of upper and lower
- Required params: `period` (default: 20)

### 1.7 Keltner Channel - Volatility Bands
**File:** `packages/indicators/src/keltner.ts`

```typescript
interface KeltnerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}
```
- Based on EMA and ATR
- Required params: `emaPeriod` (20), `atrPeriod` (10), `multiplier` (2)

### 1.8 Supertrend - Trend Following
**File:** `packages/indicators/src/supertrend.ts`

```typescript
interface SupertrendResult {
  trend: ('up' | 'down' | null)[];
  value: (number | null)[];
}
```
- Combines ATR with price for trend direction
- Required params: `period` (10), `multiplier` (3)

---

## Phase 2: Update Type Definitions

### 2.1 Update IndicatorType (packages/types/src/strategyDefinition.ts)

Add new indicator types:
```typescript
export type IndicatorType =
  | 'sma' | 'ema' | 'rsi' | 'macd' | 'bollingerBands'
  | 'atr' | 'stochastic' | 'vwap' | 'pivotPoints'
  // New indicators
  | 'adx' | 'obv' | 'williamsR' | 'cci' | 'mfi'
  | 'donchian' | 'keltner' | 'supertrend';
```

---

## Phase 3: Update IndicatorEngine

### 3.1 Add imports (apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts)

Import and add cases for all new indicators in `computeIndicator()` method.

---

## Phase 4: Update StrategyLoader Validation

### 4.1 Add new indicator types to validation (StrategyLoader.ts)

Update `SUPPORTED_INDICATOR_TYPES` array.

---

## Phase 5: New Trading Strategies (JSON files)

### 5.1 Donchian Breakout Strategy
**File:** `apps/backend/strategies/builtin/donchian-breakout.json`
- Entry: Price breaks above upper/below lower Donchian channel
- Filter: ADX > 25 (trending market)
- Stop: ATR-based
- Target: 2:1 risk-reward

### 5.2 Keltner Squeeze Breakout
**File:** `apps/backend/strategies/builtin/keltner-squeeze.json`
- Entry: Bollinger Bands inside Keltner Channel (squeeze), then breakout
- Requires both BB and Keltner indicators
- High probability breakout setup

### 5.3 Triple Confirmation Mean Reversion
**File:** `apps/backend/strategies/builtin/triple-confirmation-reversal.json`
- Entry: RSI oversold + MFI oversold + Price at BB lower
- Volume-confirmed reversals
- Conservative approach with 3 confirmations

### 5.4 ADX Trend Filter + EMA Crossover
**File:** `apps/backend/strategies/builtin/adx-ema-trend.json`
- Entry: EMA crossover when ADX > 25
- Filters out false signals in ranging markets
- 2025 refinement of classic EMA crossover

### 5.5 Supertrend Trend Following
**File:** `apps/backend/strategies/builtin/supertrend-follow.json`
- Entry: Supertrend flip
- Trails with Supertrend value
- Simple but effective trend following

### 5.6 Williams %R Momentum Strategy
**File:** `apps/backend/strategies/builtin/williams-momentum.json`
- Entry: Williams %R crosses from oversold/overbought
- Confirmation: Volume above SMA
- Quick momentum trades

### 5.7 OBV Divergence Strategy
**File:** `apps/backend/strategies/builtin/obv-divergence.json`
- Entry: Price makes new high/low but OBV doesn't confirm
- Classic divergence trading
- Early reversal detection

### 5.8 CCI Trend Rider
**File:** `apps/backend/strategies/builtin/cci-trend-rider.json`
- Entry: CCI crosses above +100 (strong trend) or below -100
- Rides strong trends
- Exit when CCI returns to zero

---

## Phase 6: Tests for New Indicators

### 6.1 Create test files in `packages/indicators/src/`
- `adx.test.ts`
- `obv.test.ts`
- `williamsR.test.ts`
- `cci.test.ts`
- `mfi.test.ts`
- `donchian.test.ts`
- `keltner.test.ts`
- `supertrend.test.ts`

Each test file should cover:
- Correct calculation with known values
- Edge cases (insufficient data, zero values)
- Return type validation

---

## Files to Modify

### New Files:
1. `packages/indicators/src/adx.ts`
2. `packages/indicators/src/obv.ts`
3. `packages/indicators/src/williamsR.ts`
4. `packages/indicators/src/cci.ts`
5. `packages/indicators/src/mfi.ts`
6. `packages/indicators/src/donchian.ts`
7. `packages/indicators/src/keltner.ts`
8. `packages/indicators/src/supertrend.ts`
9. `packages/indicators/src/adx.test.ts`
10. `packages/indicators/src/obv.test.ts`
11. `packages/indicators/src/williamsR.test.ts`
12. `packages/indicators/src/cci.test.ts`
13. `packages/indicators/src/mfi.test.ts`
14. `packages/indicators/src/donchian.test.ts`
15. `packages/indicators/src/keltner.test.ts`
16. `packages/indicators/src/supertrend.test.ts`
17. `apps/backend/strategies/builtin/donchian-breakout.json`
18. `apps/backend/strategies/builtin/keltner-squeeze.json`
19. `apps/backend/strategies/builtin/triple-confirmation-reversal.json`
20. `apps/backend/strategies/builtin/adx-ema-trend.json`
21. `apps/backend/strategies/builtin/supertrend-follow.json`
22. `apps/backend/strategies/builtin/williams-momentum.json`
23. `apps/backend/strategies/builtin/obv-divergence.json`
24. `apps/backend/strategies/builtin/cci-trend-rider.json`

### Modified Files:
1. `packages/indicators/src/index.ts` - Export new indicators
2. `packages/types/src/strategyDefinition.ts` - Add new IndicatorType values
3. `apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts` - Add computation cases
4. `apps/backend/src/services/setup-detection/dynamic/StrategyLoader.ts` - Update validation
5. `apps/backend/strategies/README.md` - Document new indicators

---

## Implementation Order

1. **Indicators first** - Create all 8 new indicator files with tests
2. **Update exports** - Add to packages/indicators/src/index.ts
3. **Update types** - Add to IndicatorType union
4. **Update engine** - Add cases to IndicatorEngine.computeIndicator()
5. **Update loader** - Add to SUPPORTED_INDICATOR_TYPES
6. **Create strategies** - 8 new JSON strategy files
7. **Update README** - Document new indicators and strategies
8. **Run tests** - Ensure all pass

---

## Estimated Effort

- **8 new indicators**: ~2 hours (well-documented formulas)
- **8 test files**: ~1 hour
- **Type/Engine updates**: ~30 minutes
- **8 JSON strategies**: ~1 hour
- **Documentation**: ~30 minutes

**Total: ~5 hours**
