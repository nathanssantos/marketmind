# Architecture: PineScript Strategy System

> Design document and architectural decisions

## Executive Summary

All 106 trading strategies are defined as PineScript v5 files (`.pine`), executed at runtime by the PineTS engine. This enables:
- TradingView-compatible syntax — traders can reuse existing knowledge
- Add/remove strategies without changing application code
- Community sharing via copy/paste of `.pine` files
- Full backtesting support with the same runtime used in live trading

---

## Format Decision: PineScript v5

### Research

| Format | Pros | Cons |
|--------|------|------|
| **PineScript v5** | Industry standard (TradingView), largest community, expressive | Requires PineTS runtime |
| **JSON declarative** | Simple validation, easy UI forms | Limited expressiveness, no conditionals |
| **TypeScript classes** | Full language power | Requires recompilation, not shareable |

### Decision: PineScript v5 via PineTS

Reasons:
1. **Industry standard** — same language used by millions on TradingView
2. **Expressive** — supports conditionals, math, crossover/crossunder natively
3. **Shareable** — traders can exchange `.pine` files directly
4. **PineTS runtime** — TypeScript-native execution, no external dependencies
5. **35+ indicators** — SMA, EMA, RSI, ATR, MACD, BB, Stochastic, Supertrend, DMI, and more

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BacktestEngine                       │
│               (no changes needed)                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SetupDetectionService                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │           StrategyInterpreter ×106                  ││
│  │                    ▲                                 ││
│  │                    │                                 ││
│  │            StrategyLoader                            ││
│  │                    ▲                                 ││
│  │           strategies/*.pine                          ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ PineTS Runtime   │  │ PineIndicatorService         │ │
│  │ (executes .pine) │  │ (shared indicator cache)     │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### 1. StrategyLoader (`dynamic/StrategyLoader.ts`)

Responsible for:
- Loading `.pine` files from the `strategies/builtin/` directory
- Parsing metadata headers (`@id`, `@name`, `@version`, `@tags`, etc.)
- Parsing PineScript `input.*` declarations as strategy parameters
- Validating strategy structure

```typescript
const loader = new StrategyLoader(['./strategies/builtin']);
const strategies = await loader.loadAll();
```

### 2. StrategyInterpreter (`dynamic/StrategyInterpreter.ts`)

Responsible for:
- Executing PineScript via PineTS runtime
- Reading output plots: `signal`, `stopLoss`, `takeProfit`, `confidence`, `exitSignal`
- Producing `TradingSetup` compatible with BacktestEngine

### 3. PineIndicatorService (`services/pine/PineIndicatorService.ts`)

Single-source indicator computation using PineTS. Replaces the old `@marketmind/indicators` package.

Supported indicators (35+):

| Type | Function | Output |
|------|----------|--------|
| `sma` | `ta.sma()` | `number[]` |
| `ema` | `ta.ema()` | `number[]` |
| `rsi` | `ta.rsi()` | `number[]` |
| `atr` | `ta.atr()` | `number[]` |
| `hma` | `ta.hma()` | `number[]` |
| `wma` | `ta.wma()` | `number[]` |
| `cci` | `ta.cci()` | `number[]` |
| `mfi` | `ta.mfi()` | `number[]` |
| `roc` | `ta.roc()` | `number[]` |
| `cmo` | `ta.cmo()` | `number[]` |
| `vwap` | `ta.vwap()` | `number[]` |
| `obv` | `ta.obv()` | `number[]` |
| `wpr` | `ta.wpr()` | `number[]` |
| `tsi` | `ta.tsi()` | `number[]` |
| `sar` | `ta.sar()` | `number[]` |
| `highest` | `ta.highest()` | `number[]` |
| `lowest` | `ta.lowest()` | `number[]` |
| `bb` | `ta.bb()` | `{ upper, middle, lower }` |
| `macd` | `ta.macd()` | `{ macd, signal, histogram }` |
| `stoch` | `ta.stoch()` | `{ k, d }` |
| `kc` | `ta.kc()` | `{ upper, middle, lower }` |
| `supertrend` | `ta.supertrend()` | `{ value, direction }` |
| `dmi` | `ta.dmi()` | `{ plus, minus, adx }` |

### 4. PineIndicatorCache (`services/pine/PineIndicatorCache.ts`)

Caching layer for batch backtesting performance. Precomputes indicators once per kline dataset, shared across multiple strategy evaluations via `FilterManager`.

---

## PineScript File Format

Each `.pine` file follows this structure:

```pine
// @id strategy-id
// @name Strategy Display Name
// @version 1.0.0
// @description Brief description of the strategy
// @author MarketMind
// @tags tag1,tag2,tag3
// @strategyType TREND_FOLLOWING
// @momentumType BREAKOUT
// @param paramName Description of the parameter

//@version=5
indicator('Strategy Name', overlay=true)

// Parameters (parsed as strategy inputs)
fastPeriod = input.int(9, 'fastPeriod', minval=5, maxval=21, step=1)
atrMultiplier = input.float(1.5, 'atrMultiplier', minval=1, maxval=3, step=0.25)

// Indicator computation
emaFast = ta.ema(close, fastPeriod)
emaSlow = ta.ema(close, slowPeriod)
atr = ta.atr(14)

// Entry signals
longEntry = ta.crossover(emaFast, emaSlow)
shortEntry = ta.crossunder(emaFast, emaSlow)

// Confidence calculation
confValue = math.min(65 + (volume > ta.sma(volume, 20) ? 10 : 0), 90)

// Exit levels
sl = longEntry ? close - atr * atrMultiplier : shortEntry ? close + atr * atrMultiplier : na
tp = longEntry ? close + math.abs(close - sl) * rrMultiplier : shortEntry ? close - math.abs(sl - close) * rrMultiplier : na

// Required output plots (read by StrategyInterpreter)
sig = longEntry ? 1 : shortEntry ? -1 : 0
plot(sig, 'signal', display=display.none)
plot(sl, 'stopLoss', display=display.none)
plot(tp, 'takeProfit', display=display.none)
plot(confValue, 'confidence', display=display.none)
plot(0, 'exitSignal', display=display.none)
```

### Required Output Plots

| Plot Name | Values | Purpose |
|-----------|--------|---------|
| `signal` | `1` (long), `-1` (short), `0` (none) | Entry signal direction |
| `stopLoss` | Price level or `na` | Stop loss price |
| `takeProfit` | Price level or `na` | Take profit price |
| `confidence` | `0`–`100` | Signal confidence score |
| `exitSignal` | `1` (exit long), `-1` (exit short), `0` (none) | Exit signal |

### Metadata Headers

| Header | Required | Description |
|--------|----------|-------------|
| `@id` | Yes | Unique kebab-case identifier |
| `@name` | Yes | Display name |
| `@version` | Yes | Semver version |
| `@description` | No | Strategy description |
| `@author` | No | Author name |
| `@tags` | No | Comma-separated tags |
| `@strategyType` | No | TREND_FOLLOWING, MEAN_REVERSION, BREAKOUT, etc. |
| `@momentumType` | No | BREAKOUT, REVERSAL, CONTINUATION |
| `@param` | No | Parameter name + description |

---

## Directory Structure

```
apps/backend/
├── strategies/
│   ├── README.md              # Usage documentation
│   ├── ARCHITECTURE.md        # This file
│   └── builtin/               # 106 PineScript v5 strategies
│       ├── ema-crossover.pine
│       ├── macd-divergence.pine
│       ├── rsi-oversold-bounce.pine
│       └── ...
│
├── src/services/
│   ├── setup-detection/
│   │   ├── SetupDetectionService.ts
│   │   └── dynamic/
│   │       ├── StrategyLoader.ts
│   │       ├── StrategyInterpreter.ts
│   │       ├── IndicatorEngine.ts
│   │       ├── ConditionEvaluator.ts
│   │       └── ExitCalculator.ts
│   │
│   └── pine/
│       ├── PineIndicatorService.ts   # Single-source indicator computation
│       └── PineIndicatorCache.ts     # Shared cache for batch backtesting
```

---

## Execution Flow

```
1. StrategyLoader.loadAll()
   └── Reads .pine files from builtin/
   └── Parses metadata headers and input declarations
   └── Returns parsed strategy definitions

2. SetupDetectionService.loadStrategies()
   └── Calls StrategyLoader
   └── Creates StrategyInterpreter for each strategy
   └── Adds to detector array

3. SetupDetectionService.detectSetups(klines)
   └── For each StrategyInterpreter:
       └── Execute PineScript via PineTS runtime
       └── Read output plots (signal, stopLoss, takeProfit, confidence, exitSignal)
   └── Returns TradingSetup[]

4. StrategyInterpreter.detect(klines, index)
   └── PineTS executes the .pine script against kline data
   └── Reads plot values at the target index
   └── If signal != 0:
       └── Builds TradingSetup with SL/TP/confidence
       └── Returns TradingSetup
```

---

## Compatibility

### BacktestEngine
- **No changes needed** — receives `TradingSetup[]` as always
- Does not know if setup came from PineScript or any other source

### PineIndicatorCache + FilterManager
- `PineIndicatorCache` precomputes indicators once per kline dataset
- `FilterManager` uses cached indicators for filter evaluation during batch backtesting
- Avoids redundant computation when testing multiple parameter combinations

### SetupType
- Accepts `string` to support dynamic strategy IDs
- `type SetupType = BuiltinSetupType | string`

---

## Extensibility

### Adding a new strategy

1. Create a `.pine` file in `strategies/builtin/`
2. Follow the metadata header format (`@id`, `@name`, `@version`, etc.)
3. Define parameters via `input.int()` / `input.float()`
4. Compute indicators and entry/exit logic
5. Output required plots (`signal`, `stopLoss`, `takeProfit`, `confidence`, `exitSignal`)

### Adding a new indicator to PineIndicatorService

1. Add the compute method in `PineIndicatorService`
2. Register in `PineIndicatorCache.precompute()` (single or multi type)
3. Available for use in all `.pine` strategies via `ta.*` functions

---

## Future Roadmap

1. **Strategy editor UI** — in-app PineScript editor with syntax highlighting
2. **Strategy marketplace** — share strategies between users
3. **Custom user strategies** — `strategies/custom/` directory for user-created files
4. **Parameter auto-optimization** — genetic algorithm-based parameter tuning via backtesting
5. **Strategy versioning** — git-like history for strategy modifications
