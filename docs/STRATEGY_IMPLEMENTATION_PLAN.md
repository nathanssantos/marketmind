# Strategy Implementation Plan - MarketMind

## Overview

This document provides context for implementing and testing the 105 trading strategies in MarketMind. The goal is to create all necessary infrastructure (indicators, oscillators, detectors, etc.) to run each strategy properly.

## Current Status

### Strategies Created: 105
Location: `/apps/backend/strategies/builtin/*.json`

### Existing Indicators (Already Implemented)
Location: `/packages/indicators/src/`

```
✅ RSI (rsi.ts) - Fixed with Wilder's Smoothing
✅ EMA (ema.ts)
✅ SMA (sma.ts)
✅ ATR (atr.ts)
✅ MACD (macd.ts)
✅ Bollinger Bands (bollingerBands.ts)
✅ Stochastic (stochastic.ts)
✅ StochRSI (stochRsi.ts)
✅ ADX (adx.ts)
✅ CCI (cci.ts)
✅ OBV (obv.ts)
✅ Williams %R (williamsR.ts)
✅ Supertrend (supertrend.ts)
✅ Percent B (percentB.ts)
✅ VWAP (vwap.ts)
✅ Keltner Channel (keltnerChannel.ts)
✅ Donchian Channel (donchianChannel.ts)
✅ Highest/Lowest (highest.ts, lowest.ts)
```

## Missing Indicators To Implement

### Priority 1 - Core Indicators (Required by Many Strategies)

```typescript
// 1. DEMA - Double Exponential Moving Average
// Used by: dema-crossover-crypto
// Formula: DEMA = 2 * EMA(price, period) - EMA(EMA(price, period), period)

// 2. TEMA - Triple Exponential Moving Average
// Used by: tema-momentum
// Formula: TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))

// 3. HMA - Hull Moving Average
// Used by: hull-ma-trend
// Formula: HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))

// 4. WMA - Weighted Moving Average (dependency for HMA)
// Formula: WMA = sum(price * weight) / sum(weights)

// 5. TSI - True Strength Index
// Used by: tsi-momentum
// Formula: TSI = 100 * EMA(EMA(momentum)) / EMA(EMA(abs(momentum)))

// 6. ROC - Rate of Change
// Used by: roc-momentum-crypto, momentum-rotation
// Formula: ROC = ((price - price[n]) / price[n]) * 100

// 7. Momentum (simple)
// Used by: volatility-contraction
// Formula: Momentum = price - price[n]
```

### Priority 2 - Oscillators

```typescript
// 8. CMO - Chande Momentum Oscillator
// Used by: chande-momentum-crypto
// Range: -100 to +100

// 9. AO - Awesome Oscillator
// Used by: awesome-oscillator-crypto
// Formula: AO = SMA(HL/2, 5) - SMA(HL/2, 34)

// 10. PPO - Percentage Price Oscillator
// Used by: ppo-momentum
// Formula: PPO = ((EMA_fast - EMA_slow) / EMA_slow) * 100

// 11. Ultimate Oscillator
// Used by: ultimate-oscillator-crypto
// Multi-timeframe: 7, 14, 28 periods

// 12. MFI - Money Flow Index
// Used by: mfi-divergence
// Formula: RSI with volume weighting
```

### Priority 3 - Trend Indicators

```typescript
// 13. Aroon (Up/Down/Oscillator)
// Used by: aroon-trend-crypto
// Aroon Up = ((period - days since highest high) / period) * 100

// 14. DMI - Directional Movement Index (+DI, -DI, ADX)
// Used by: dmi-adx-trend
// Note: ADX already exists, need +DI/-DI separately

// 15. Vortex Indicator (VI+, VI-)
// Used by: vortex-indicator
// Measures positive/negative trend movement

// 16. Parabolic SAR
// Used by: parabolic-sar-crypto
// Stop and Reverse system

// 17. Mass Index
// Used by: mass-index-reversal
// Predicts trend reversals via range expansion
```

### Priority 4 - Volume Indicators

```typescript
// 18. CMF - Chaikin Money Flow
// Used by: chaikin-money-flow
// Accumulation/Distribution with volume

// 19. Klinger Volume Oscillator
// Used by: klinger-oscillator
// Long-term money flow

// 20. Elder Ray (Bull/Bear Power)
// Used by: elder-ray-crypto
// Bull Power = High - EMA, Bear Power = Low - EMA

// 21. Delta Volume
// Used by: order-flow-imbalance
// Buy vs Sell volume estimation
```

### Priority 5 - Price Action / Patterns

```typescript
// 22. Swing High/Low Detection
// Used by: market-structure-break
// Identifies pivot points

// 23. Fair Value Gap (FVG)
// Used by: fair-value-gap
// Detects imbalances/gaps

// 24. Candle Patterns
// Used by: hammer-doji, engulfing-pattern, morning-star, marubozu-momentum
// Hammer, Doji, Engulfing, Morning Star, Marubozu

// 25. Gap Detection
// Used by: gap-fill-crypto
// Identifies price gaps

// 26. Fibonacci Retracement
// Used by: fibonacci-retracement
// Auto-calculates fib levels from swing points
```

### Priority 6 - Support/Resistance

```typescript
// 27. Pivot Points (Standard, Fibonacci, Woodie)
// Used by: pivot-points-crypto
// Classic floor trader pivots

// 28. Liquidity Levels
// Used by: liquidity-sweep
// Identifies liquidity zones
```

### Priority 7 - Crypto-Specific (May Require External Data)

```typescript
// 29. Funding Rate
// Used by: funding-rate-arbitrage
// Requires exchange API data

// 30. Open Interest
// Used by: open-interest-divergence
// Requires futures market data

// 31. Liquidations
// Used by: liquidation-cascade
// Requires exchange liquidation data

// 32. BTC Dominance
// Used by: altcoin-season
// Requires market cap data

// 33. Relative Strength (vs BTC)
// Used by: altcoin-season
// Compare asset performance vs BTC

// 34. Halving Cycle
// Used by: bitcoin-halving-cycle
// Tracks Bitcoin halving dates
```

## Implementation Order

### Phase 1: Core Mathematical Indicators
1. WMA (dependency)
2. DEMA
3. TEMA
4. HMA
5. ROC
6. Momentum (simple)

### Phase 2: Oscillators
7. CMO
8. AO (Awesome Oscillator)
9. PPO
10. TSI
11. Ultimate Oscillator
12. MFI

### Phase 3: Trend Indicators
13. Aroon
14. DMI (+DI/-DI)
15. Vortex
16. Parabolic SAR
17. Mass Index

### Phase 4: Volume Indicators
18. CMF
19. Klinger
20. Elder Ray
21. Delta Volume

### Phase 5: Price Action
22. Swing Points
23. FVG
24. Candle Patterns
25. Gap Detection
26. Fibonacci Auto

### Phase 6: Support/Resistance
27. Pivot Points
28. Liquidity Levels

### Phase 7: Crypto-Specific (Optional/External Data)
29-34. Funding Rate, OI, Liquidations, etc.

## File Structure for New Indicators

```
packages/indicators/src/
├── index.ts              # Export all indicators
├── types.ts              # Shared types
│
├── moving-averages/
│   ├── wma.ts           # Weighted MA
│   ├── dema.ts          # Double EMA
│   ├── tema.ts          # Triple EMA
│   └── hma.ts           # Hull MA
│
├── oscillators/
│   ├── cmo.ts           # Chande Momentum
│   ├── ao.ts            # Awesome Oscillator
│   ├── ppo.ts           # Percentage Price
│   ├── tsi.ts           # True Strength Index
│   ├── uo.ts            # Ultimate Oscillator
│   └── mfi.ts           # Money Flow Index
│
├── trend/
│   ├── aroon.ts         # Aroon Up/Down
│   ├── dmi.ts           # DMI +/-
│   ├── vortex.ts        # Vortex Indicator
│   ├── psar.ts          # Parabolic SAR
│   └── massIndex.ts     # Mass Index
│
├── volume/
│   ├── cmf.ts           # Chaikin Money Flow
│   ├── klinger.ts       # Klinger Volume
│   ├── elderRay.ts      # Elder Ray
│   └── deltaVolume.ts   # Delta Volume
│
├── price-action/
│   ├── swingPoints.ts   # Swing High/Low
│   ├── fvg.ts           # Fair Value Gap
│   ├── candlePatterns.ts # Candle Patterns
│   ├── gaps.ts          # Gap Detection
│   └── fibonacci.ts     # Fibonacci Auto
│
└── levels/
    ├── pivotPoints.ts   # Pivot Points
    └── liquidity.ts     # Liquidity Levels
```

## Indicator Interface Standard

```typescript
// All indicators should follow this pattern:

interface IndicatorInput {
  high: number[];
  low: number[];
  close: number[];
  open?: number[];
  volume?: number[];
}

interface IndicatorParams {
  period?: number;
  [key: string]: unknown;
}

interface IndicatorResult {
  values: number[];
  // Additional outputs as needed
}

// Example implementation:
export const calculateROC = (
  closes: number[],
  period: number = 12
): number[] => {
  const result: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      const roc = ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
      result.push(roc);
    }
  }

  return result;
};
```

## Testing Requirements

### Unit Tests for Each Indicator
Location: `/packages/indicators/src/__tests__/`

```typescript
// Example test structure:
describe('ROC - Rate of Change', () => {
  it('should calculate ROC correctly', () => {
    const closes = [100, 102, 105, 103, 108, 110, 112];
    const result = calculateROC(closes, 3);

    // ROC[3] = ((103 - 100) / 100) * 100 = 3%
    expect(result[3]).toBeCloseTo(3, 2);
  });

  it('should return NaN for insufficient data', () => {
    const closes = [100, 102, 105];
    const result = calculateROC(closes, 5);

    expect(result.every(v => isNaN(v))).toBe(true);
  });

  it('should match TradingView values', () => {
    // Compare with known TradingView output
    const testData = loadTestData('BTCUSDT_1D');
    const result = calculateROC(testData.closes, 12);

    // Verify against expected values
    expect(result[50]).toBeCloseTo(expectedValues[50], 1);
  });
});
```

### Integration Tests
Location: `/apps/backend/src/__tests__/strategies/`

```typescript
// Test strategy execution with real data
describe('Strategy: ROC Momentum Crypto', () => {
  it('should generate valid signals', async () => {
    const strategy = loadStrategy('roc-momentum-crypto');
    const data = await fetchTestData('BTCUSDT', '1d', 100);

    const signals = await executeStrategy(strategy, data);

    expect(signals).toBeDefined();
    expect(signals.length).toBeGreaterThan(0);
  });

  it('should respect entry conditions', async () => {
    // Verify ROC crossover 0 generates long signal
  });
});
```

## Backtest Validation

### Benchmark Command
```bash
# Run benchmark validation for all strategies
pnpm --filter @marketmind/backend exec tsx src/cli/backtest-runner.ts benchmark

# Validate specific strategy
pnpm --filter @marketmind/backend exec tsx src/cli/backtest-runner.ts validate \
  -s roc-momentum-crypto \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-10-01
```

### Expected Metrics
For each strategy, validate:
- Win Rate: Within ±10% of reference (if available)
- Profit Factor: > 1.0 minimum
- Max Drawdown: < 50%
- Number of Trades: Reasonable for timeframe

## Strategy Categories Summary

| Category | Count | Key Indicators Needed |
|----------|-------|----------------------|
| Trend Following | 25 | EMA, DEMA, TEMA, HMA, Aroon, DMI |
| Mean Reversion | 15 | RSI, BB, Stoch, CMO |
| Momentum | 20 | ROC, TSI, AO, PPO |
| Breakout | 12 | Donchian, ATR, Volume |
| Candlestick | 8 | Candle Pattern Detection |
| Volume-Based | 10 | MFI, CMF, Klinger, OBV |
| Smart Money | 6 | FVG, Swing Points, Liquidity |
| Scalping | 4 | Fast RSI, VWAP, EMA |
| Crypto-Specific | 8 | Funding, OI, BTC Dom |

## Commands to Start

```bash
# 1. Check existing indicators
ls -la packages/indicators/src/

# 2. Run existing indicator tests
pnpm --filter @marketmind/indicators test

# 3. Check strategy parser
cat apps/backend/src/services/strategy/

# 4. List all strategies
ls apps/backend/strategies/builtin/ | wc -l

# 5. View a strategy
cat apps/backend/strategies/builtin/roc-momentum-crypto.json
```

## Key Files to Review

1. **Indicator implementations**: `/packages/indicators/src/*.ts`
2. **Strategy parser**: `/apps/backend/src/services/strategy/strategyParser.ts`
3. **Backtest engine**: `/apps/backend/src/services/backtest/BacktestEngine.ts`
4. **Condition evaluator**: `/apps/backend/src/services/strategy/conditionEvaluator.ts`
5. **Indicator registry**: `/apps/backend/src/services/indicators/indicatorRegistry.ts`

## Priority Implementation Order

### Sprint 1 (High Priority - Unlocks Most Strategies)
1. ✅ ROC (simple, many strategies use it)
2. ✅ DEMA
3. ✅ TEMA
4. ✅ WMA + HMA
5. ✅ CMO

### Sprint 2 (Medium Priority)
6. AO (Awesome Oscillator)
7. PPO
8. TSI
9. Aroon
10. Vortex

### Sprint 3 (Lower Priority)
11. MFI
12. Ultimate Oscillator
13. CMF
14. Klinger
15. Mass Index

### Sprint 4 (Price Action)
16. Candle Patterns
17. Swing Points
18. FVG
19. Pivot Points
20. Parabolic SAR

### Sprint 5 (External Data - Optional)
21. Funding Rate API
22. Open Interest API
23. Liquidations API
24. BTC Dominance API

## Notes for Next Session

1. Start by auditing existing indicators in `/packages/indicators/src/`
2. Verify which indicators are already implemented but may be missing from export
3. Create the folder structure for new indicators
4. Implement indicators in order of priority (most strategies unlocked first)
5. Write tests for each indicator comparing to TradingView values
6. Update strategy parser to recognize new indicators
7. Run backtest validation after each indicator is added

## Contact

For questions about specific strategies, review the JSON files:
```bash
cat apps/backend/strategies/builtin/<strategy-id>.json
```

Each strategy file contains:
- `indicators` section: Which indicators are required
- `entry`/`exit` sections: Conditions that need to be evaluated
- `parameters`: Configurable values

---

**Document Version**: 1.0
**Created**: December 2024
**Total Strategies**: 105
**Indicators Needed**: ~34
