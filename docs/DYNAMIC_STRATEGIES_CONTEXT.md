# Dynamic Strategies System - Chat Context

> Use this document when starting a new Claude Code session to continue work on the dynamic trading strategies system.

---

## Quick Start

Copy and paste this to start a new chat:

```
Working on MarketMind's Dynamic Strategies System.

Context: docs/DYNAMIC_STRATEGIES_CONTEXT.md
Architecture: apps/backend/strategies/ARCHITECTURE.md
Usage Guide: apps/backend/strategies/README.md

Current Status: [describe what you need]
```

---

## System Overview

The Dynamic Strategies System allows defining trading strategies in JSON files instead of hardcoded TypeScript classes. This enables:

- Add/remove strategies without code changes
- Users can copy/paste strategies from the internet
- Backtesting works seamlessly with dynamic strategies
- Parameter optimization via JSON configuration

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BacktestEngine                       │
│               (NO CHANGES NEEDED)                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SetupDetectionService                      │
│          (supports both legacy + dynamic)               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Legacy Detectors │    │    Dynamic Interpreters    │ │
│  │ (TypeScript)     │    │      (JSON-based)          │ │
│  │                  │    │                             │ │
│  │ Pattern123       │    │  StrategyInterpreter ×N    │ │
│  │ BearTrap         │    │         ▲                   │ │
│  │ MeanReversion    │    │         │                   │ │
│  └─────────────────┘    │   StrategyLoader            │ │
│                          │         ▲                   │ │
│                          │    strategies/*.json        │ │
│                          └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files

### Types (packages/types)

| File | Description |
|------|-------------|
| `src/strategyDefinition.ts` | StrategyDefinition, Condition, IndicatorDefinition types |
| `src/tradingSetup.ts` | SetupType now accepts dynamic string IDs |
| `src/index.ts` | Exports all strategy types |

### Dynamic Engine (apps/backend/src/services/setup-detection/dynamic/)

| File | Description |
|------|-------------|
| `StrategyLoader.ts` | Loads JSON files, validates against schema |
| `StrategyInterpreter.ts` | Extends BaseSetupDetector, produces TradingSetup |
| `IndicatorEngine.ts` | Computes indicators from JSON definitions |
| `ConditionEvaluator.ts` | Evaluates entry conditions (AND/OR, crossover) |
| `ExitCalculator.ts` | Calculates stop loss and take profit |
| `index.ts` | Exports all dynamic components |

### Strategy Files (apps/backend/strategies/)

| Directory | Description |
|-----------|-------------|
| `builtin/` | Built-in strategies shipped with the app |
| `community/` | Downloaded/shared strategies |
| `custom/` | User-created strategies |

### Documentation

| File | Description |
|------|-------------|
| `strategies/README.md` | User guide for creating strategies |
| `strategies/ARCHITECTURE.md` | Technical architecture decisions |

---

## Supported Indicators

| JSON Type | Function | Output |
|-----------|----------|--------|
| `sma` | calculateSMA() | `number[]` |
| `ema` | calculateEMA() | `number[]` |
| `rsi` | calculateRSI() | `number[]` |
| `macd` | calculateMACD() | `{ macd, signal, histogram }` |
| `bollingerBands` | calculateBollingerBandsArray() | `{ upper, middle, lower }[]` |
| `atr` | calculateATR() | `number[]` |
| `stochastic` | calculateStochastic() | `{ k, d }[]` |
| `vwap` | calculateVWAP() | `number[]` |
| `pivotPoints` | findPivotPoints() | pivot array |

---

## Condition Operators

| Operator | Description |
|----------|-------------|
| `>`, `<`, `>=`, `<=`, `==`, `!=` | Numeric comparison |
| `crossover` | Crossed above |
| `crossunder` | Crossed below |

---

## Exit Types

| Type | Description |
|------|-------------|
| `atr` | ATR multiple |
| `percent` | Price percentage |
| `fixed` | Absolute value |
| `indicator` | Indicator value |
| `riskReward` | Stop loss multiple |

---

## JSON Strategy Example

```json
{
  "id": "ema-crossover",
  "name": "EMA Crossover",
  "version": "1.0.0",
  "description": "Long when fast EMA crosses above slow EMA",
  "tags": ["trend-following", "ema", "crossover"],

  "parameters": {
    "fastPeriod": { "default": 9, "min": 5, "max": 21, "step": 1 },
    "slowPeriod": { "default": 21, "min": 15, "max": 50, "step": 1 },
    "atrMultiplier": { "default": 1.5, "min": 1, "max": 3, "step": 0.25 }
  },

  "indicators": {
    "emaFast": { "type": "ema", "params": { "period": "$fastPeriod" } },
    "emaSlow": { "type": "ema", "params": { "period": "$slowPeriod" } },
    "atr": { "type": "atr", "params": { "period": 14 } }
  },

  "entry": {
    "long": {
      "operator": "AND",
      "conditions": [
        { "left": "emaFast", "op": "crossover", "right": "emaSlow" }
      ]
    },
    "short": {
      "operator": "AND",
      "conditions": [
        { "left": "emaFast", "op": "crossunder", "right": "emaSlow" }
      ]
    }
  },

  "exit": {
    "stopLoss": { "type": "atr", "multiplier": "$atrMultiplier", "indicator": "atr" },
    "takeProfit": { "type": "riskReward", "multiplier": 2 }
  },

  "filters": {
    "minConfidence": 60,
    "minRiskReward": 1.5
  }
}
```

---

## Implementation Status

### Completed

- [x] Type definitions (`packages/types/src/strategyDefinition.ts`)
- [x] IndicatorEngine - computes indicators from JSON
- [x] ConditionEvaluator - evaluates entry conditions
- [x] ExitCalculator - calculates SL/TP
- [x] StrategyInterpreter - extends BaseSetupDetector
- [x] StrategyLoader - loads and validates JSON files
- [x] Documentation (README.md, ARCHITECTURE.md)
- [x] Integration with SetupDetectionService
- [x] Builtin JSON strategies (ema-crossover, mean-reversion-bb-rsi, rsi-oversold-bounce, macd-divergence)
- [x] Unit tests for dynamic components (64+ tests)
- [x] BacktestEngine integration testing

### Pending

- [ ] Hot-reload support (watch for file changes)
- [ ] CLI commands for strategy management
- [ ] Frontend UI for strategy management

---

## Common Tasks

### Add a new indicator type

1. Add type to `IndicatorType` in `strategyDefinition.ts`
2. Add case in `IndicatorEngine.computeIndicator()`
3. Add to valid types list in `StrategyLoader.validateIndicators()`

### Add a new condition operator

1. Add to `ComparisonOperator` in `strategyDefinition.ts`
2. Implement logic in `ConditionEvaluator.evaluateCondition()`

### Add a new exit type

1. Add to `ExitLevelType` in `strategyDefinition.ts`
2. Implement in `ExitCalculator.calculateLevel()`
3. Add to valid types in `StrategyLoader.validateExitLevel()`

### Create a new strategy

1. Create JSON file in `strategies/custom/`
2. Follow schema from README.md
3. Load with `StrategyLoader.loadStrategy(path)`

---

## Development Commands

```bash
# Build types package
pnpm --filter @marketmind/types build

# Type check backend
pnpm --filter @marketmind/backend type-check

# Run backend tests
pnpm --filter @marketmind/backend test

# Run backtest with dynamic strategies
pnpm --filter @marketmind/backend backtest:run
```

---

## Troubleshooting

### TypeScript errors with index signatures

Use bracket notation for accessing properties:

```typescript
// Wrong
resolvedParams.period

// Correct
resolvedParams['period']
```

### Strategy not loading

1. Check JSON syntax is valid
2. Verify required fields: id, name, version, parameters, indicators, entry, exit
3. Check indicator types are supported
4. Verify condition operators are valid

### Indicator values are null

- Ensure enough klines for indicator period (e.g., 20 klines for SMA 20)
- Check parameter references (`$paramName`) resolve correctly

---

## Related Documentation

- [ARCHITECTURE.md](../apps/backend/strategies/ARCHITECTURE.md) - Design decisions
- [README.md](../apps/backend/strategies/README.md) - User guide
- [CLAUDE.md](../CLAUDE.md) - Project-wide AI context
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Overall roadmap
