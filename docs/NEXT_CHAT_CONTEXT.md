# MarketMind - Context for Strategy Implementation Chat

## Quick Start

Copy this entire document and paste it in a new Claude Code chat to continue.

---

## Project Summary

MarketMind is an Electron-based trading application with:
- **105 trading strategies** in JSON format
- **Backtest engine** for strategy validation
- **Indicator library** in TypeScript

## Current Task

**Implement all missing indicators, oscillators, and detectors** required to run the 105 strategies.

## Key Locations

```
/apps/backend/strategies/builtin/     # 105 strategy JSON files
/packages/indicators/src/              # Indicator implementations
/apps/backend/src/services/backtest/   # Backtest engine
/docs/STRATEGY_IMPLEMENTATION_PLAN.md  # Full implementation plan
```

## What Needs To Be Done

### Missing Indicators (34 total, by priority)

**Sprint 1 - Core (Unlocks most strategies)**
1. ROC - Rate of Change
2. DEMA - Double EMA
3. TEMA - Triple EMA
4. WMA - Weighted MA
5. HMA - Hull MA
6. CMO - Chande Momentum

**Sprint 2 - Oscillators**
7. AO - Awesome Oscillator
8. PPO - Percentage Price Oscillator
9. TSI - True Strength Index
10. MFI - Money Flow Index
11. Ultimate Oscillator

**Sprint 3 - Trend**
12. Aroon (Up/Down)
13. DMI (+DI/-DI)
14. Vortex (VI+/VI-)
15. Parabolic SAR
16. Mass Index

**Sprint 4 - Volume**
17. CMF - Chaikin Money Flow
18. Klinger Volume Oscillator
19. Elder Ray (Bull/Bear Power)
20. Delta Volume

**Sprint 5 - Price Action**
21. Swing High/Low Detection
22. Fair Value Gap (FVG)
23. Candle Patterns (Hammer, Doji, Engulfing, etc.)
24. Gap Detection
25. Fibonacci Auto-levels
26. Pivot Points

**Sprint 6 - Crypto-Specific (Optional - need external data)**
27. Funding Rate
28. Open Interest
29. Liquidations
30. BTC Dominance
31. Relative Strength vs BTC

## Existing Indicators (Already Working)

```typescript
✅ RSI, EMA, SMA, ATR, MACD, Bollinger Bands
✅ Stochastic, StochRSI, ADX, CCI, OBV
✅ Williams %R, Supertrend, Percent B, VWAP
✅ Keltner Channel, Donchian Channel
✅ Highest, Lowest
```

## Commands

```bash
# Check existing indicators
ls packages/indicators/src/

# Run indicator tests
pnpm --filter @marketmind/indicators test

# List all strategies
ls apps/backend/strategies/builtin/ | wc -l

# View strategy requirements
cat apps/backend/strategies/builtin/roc-momentum-crypto.json

# Validate a strategy
pnpm --filter @marketmind/backend exec tsx src/cli/backtest-runner.ts validate \
  -s connors-rsi2-original --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-10-01
```

## Standard Interface for New Indicators

```typescript
// packages/indicators/src/roc.ts
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

## Request

Please implement all missing indicators following this order:
1. Read `/docs/STRATEGY_IMPLEMENTATION_PLAN.md` for full details
2. Check `/packages/indicators/src/` for existing implementations
3. Implement indicators starting with Sprint 1 (ROC, DEMA, TEMA, WMA, HMA, CMO)
4. Write tests for each indicator
5. Update the indicator registry/exports
6. Continue with subsequent sprints

Focus on:
- Matching TradingView calculations exactly
- Using proper TypeScript types
- Writing comprehensive tests
- Following existing code patterns

---

## Additional Context Files

Read these files first:
1. `/Users/nathan/Documents/dev/marketmind/CLAUDE.md` - Project conventions
2. `/docs/STRATEGY_IMPLEMENTATION_PLAN.md` - Full implementation plan
3. `/packages/indicators/src/index.ts` - Current exports
4. `/packages/indicators/src/rsi.ts` - Example implementation (with Wilder's Smoothing)

---

**Goal**: All 105 strategies should be able to run backtests after implementation is complete.
