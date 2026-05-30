# Dynamic Strategy System

This system lets you define trading strategies in declarative JSON files, eliminating the need for hardcoded TypeScript classes.

## Directory Structure

```
strategies/
├── builtin/           # Strategies shipped with the system
│   ├── ema-crossover.json
│   ├── mean-reversion-bb-rsi.json
│   ├── rsi-oversold-bounce.json
│   └── macd-divergence.json
├── community/         # Downloaded/shared strategies
└── custom/            # User-created strategies
```

## Definition Format

### Basic Structure

```json
{
  "id": "my-strategy",
  "name": "Strategy Name",
  "version": "1.0.0",
  "description": "Description of what the strategy does",
  "author": "Your Name",
  "tags": ["trend-following", "momentum"],

  "parameters": { ... },
  "indicators": { ... },
  "entry": { ... },
  "exit": { ... },
  "confidence": { ... },
  "filters": { ... }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case) |
| `name` | string | Human-readable name |
| `version` | string | Semantic version (e.g. 1.0.0) |
| `parameters` | object | Configurable parameters |
| `indicators` | object | Technical indicators used |
| `entry` | object | Entry conditions |
| `exit` | object | Stop loss and take profit configuration |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Detailed description |
| `author` | string | Strategy author |
| `tags` | string[] | Tags for categorization |
| `confidence` | object | Confidence calculation |
| `filters` | object | Minimum filters |

---

## Parameters

Define parameters that can be optimized or adjusted by the user:

```json
"parameters": {
  "emaPeriod": {
    "default": 20,
    "min": 5,
    "max": 50,
    "step": 1,
    "description": "EMA period"
  },
  "atrMultiplier": {
    "default": 2.0,
    "min": 1.0,
    "max": 4.0,
    "step": 0.5,
    "description": "ATR multiplier for the stop"
  }
}
```

Use `$parameterName` to reference values in other sections:

```json
"indicators": {
  "ema": {
    "type": "ema",
    "params": { "period": "$emaPeriod" }
  }
}
```

---

## Indicators

### Supported Types

| Type | Description | Parameters |
|------|-------------|------------|
| `sma` | Simple Moving Average | `period` |
| `ema` | Exponential Moving Average | `period` |
| `rsi` | Relative Strength Index | `period` |
| `macd` | MACD | `fastPeriod`, `slowPeriod`, `signalPeriod` |
| `bollingerBands` | Bollinger Bands | `period`, `stdDev` |
| `atr` | Average True Range | `period` |
| `stochastic` | Stochastic | `kPeriod`, `dPeriod` |
| `vwap` | Volume Weighted Average Price | - |
| `pivotPoints` | Pivot Points | `lookback` |
| `adx` | Average Directional Index | `period` |
| `obv` | On-Balance Volume | `smaPeriod` (optional) |
| `williamsR` | Williams %R | `period` |
| `cci` | Commodity Channel Index | `period` |
| `mfi` | Money Flow Index | `period` |
| `donchian` | Donchian Channel | `period` |
| `keltner` | Keltner Channel | `emaPeriod`, `atrPeriod`, `multiplier` |
| `supertrend` | Supertrend | `period`, `multiplier` |

### Example

```json
"indicators": {
  "emaFast": {
    "type": "ema",
    "params": { "period": 9 }
  },
  "emaSlow": {
    "type": "ema",
    "params": { "period": 21 }
  },
  "bb": {
    "type": "bollingerBands",
    "params": { "period": 20, "stdDev": 2 }
  },
  "rsi": {
    "type": "rsi",
    "params": { "period": "$rsiPeriod" }
  }
}
```

### Accessing Values

- Simple indicator: `"rsi"`, `"emaFast"`, `"williamsR"`, `"cci"`, `"mfi"`
- Composite indicator: `"bb.upper"`, `"bb.middle"`, `"bb.lower"`
- MACD: `"macd.macd"`, `"macd.signal"`, `"macd.histogram"`
- ADX: `"adx.adx"`, `"adx.plusDI"`, `"adx.minusDI"`
- OBV: `"obv.obv"`, `"obv.sma"`
- Donchian: `"donchian.upper"`, `"donchian.middle"`, `"donchian.lower"`
- Keltner: `"keltner.upper"`, `"keltner.middle"`, `"keltner.lower"`
- Supertrend: `"supertrend.trend"` (1=up, -1=down), `"supertrend.value"`
- Price: `"close"`, `"open"`, `"high"`, `"low"`
- Volume: `"volume"`, `"volume.sma20"`

### Historical Values (Previous)

Use the suffix `.prev`, `.prev2`, `.prev3`, etc. to access values from earlier candles:

- `"close.prev"` - Close of the previous candle (offset 1)
- `"close.prev2"` - Close from 2 candles ago
- `"ema9.prev"` - EMA9 of the previous candle
- `"rsi.prev3"` - RSI from 3 candles ago
- `"bb.upper.prev"` - Upper Bollinger band of the previous candle
- `"high.prev5"` - High from 5 candles ago

**Examples:**

```json
// EMA turn: EMA was falling, now it is rising
{
  "left": "ema9.prev",
  "op": "<=",
  "right": "ema9.prev2"
},
{
  "left": "ema9",
  "op": ">",
  "right": "ema9.prev"
}

// Price closed below the previous low (pullback)
{
  "left": "close",
  "op": "<",
  "right": "low.prev"
}

// RSI crossed above 30 coming from below
{
  "left": "rsi.prev",
  "op": "<",
  "right": 30
},
{
  "left": "rsi",
  "op": ">",
  "right": 30
}
```

---

## Entry Conditions

### Structure

```json
"entry": {
  "long": {
    "operator": "AND",
    "conditions": [
      { "left": "...", "op": "...", "right": "..." }
    ]
  },
  "short": {
    "operator": "AND",
    "conditions": [
      { "left": "...", "op": "...", "right": "..." }
    ]
  }
}
```

### Comparison Operators

| Operator | Description |
|----------|-------------|
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `==` | Equal |
| `!=` | Not equal |
| `crossover` | Crossed up |
| `crossunder` | Crossed down |

### Logical Operators

- `"operator": "AND"` - All conditions must be true
- `"operator": "OR"` - At least one condition must be true

### Examples

```json
// EMA Crossover
{
  "left": "emaFast",
  "op": "crossover",
  "right": "emaSlow"
}

// RSI Oversold
{
  "left": "rsi",
  "op": "<=",
  "right": 30
}

// Price below the lower Bollinger band
{
  "left": "close",
  "op": "<=",
  "right": "bb.lower"
}

// Using a parameter
{
  "left": "rsi",
  "op": "<=",
  "right": "$rsiOversold"
}
```

---

## Exit Configuration

### Stop Loss / Take Profit Types

| Type | Description | Fields |
|------|-------------|--------|
| `atr` | ATR-based | `multiplier`, `indicator` |
| `percent` | Percentage of price | `value` |
| `fixed` | Absolute value | `value` |
| `indicator` | Indicator value | `value` |
| `riskReward` | Multiple of risk | `multiplier` |

### Examples

```json
"exit": {
  // ATR-based Stop Loss
  "stopLoss": {
    "type": "atr",
    "multiplier": 2,
    "indicator": "atr"
  },

  // Take Profit at 2x the risk
  "takeProfit": {
    "type": "riskReward",
    "multiplier": 2
  }
}
```

```json
"exit": {
  // Percentage Stop Loss
  "stopLoss": {
    "type": "percent",
    "value": 2
  },

  // Take Profit at the Bollinger midline
  "takeProfit": {
    "type": "indicator",
    "value": "bb.middle"
  }
}
```

---

## Confidence Calculation

Defines how the setup confidence is calculated:

```json
"confidence": {
  "base": 60,
  "bonuses": [
    {
      "condition": { "left": "rsi", "op": "<", "right": 25 },
      "bonus": 15,
      "description": "RSI extremely oversold"
    },
    {
      "condition": { "left": "volume", "op": ">", "right": "volume.sma20" },
      "bonus": 10,
      "description": "Volume above average"
    }
  ],
  "max": 95
}
```

---

## Filters

Defines minimum criteria to accept a setup:

```json
"filters": {
  "minConfidence": 65,
  "minRiskReward": 1.5
}
```

---

## Complete Examples

### EMA Crossover

```json
{
  "id": "ema-crossover",
  "name": "EMA Crossover",
  "version": "1.0.0",
  "description": "Long when the fast EMA crosses above the slow EMA",
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

### Mean Reversion (Bollinger + RSI)

```json
{
  "id": "mean-reversion-bb-rsi",
  "name": "Mean Reversion (Bollinger + RSI)",
  "version": "1.0.0",
  "description": "Long when price touches the lower band + RSI oversold",
  "tags": ["mean-reversion", "bollinger-bands", "rsi"],

  "parameters": {
    "bbPeriod": { "default": 20, "min": 10, "max": 50, "step": 5 },
    "bbStdDev": { "default": 2, "min": 1.5, "max": 3, "step": 0.5 },
    "rsiPeriod": { "default": 14, "min": 7, "max": 21, "step": 1 },
    "rsiOversold": { "default": 30, "min": 20, "max": 40, "step": 5 },
    "rsiOverbought": { "default": 70, "min": 60, "max": 80, "step": 5 }
  },

  "indicators": {
    "bb": { "type": "bollingerBands", "params": { "period": "$bbPeriod", "stdDev": "$bbStdDev" } },
    "rsi": { "type": "rsi", "params": { "period": "$rsiPeriod" } },
    "atr": { "type": "atr", "params": { "period": 14 } }
  },

  "entry": {
    "long": {
      "operator": "AND",
      "conditions": [
        { "left": "close", "op": "<=", "right": "bb.lower" },
        { "left": "rsi", "op": "<=", "right": "$rsiOversold" }
      ]
    },
    "short": {
      "operator": "AND",
      "conditions": [
        { "left": "close", "op": ">=", "right": "bb.upper" },
        { "left": "rsi", "op": ">=", "right": "$rsiOverbought" }
      ]
    }
  },

  "exit": {
    "stopLoss": { "type": "atr", "multiplier": 2, "indicator": "atr" },
    "takeProfit": { "type": "indicator", "value": "bb.middle" }
  },

  "confidence": {
    "base": 60,
    "bonuses": [
      { "condition": { "left": "rsi", "op": "<", "right": 25 }, "bonus": 10 },
      { "condition": { "left": "volume", "op": ">", "right": "volume.sma20" }, "bonus": 10 }
    ],
    "max": 95
  },

  "filters": {
    "minConfidence": 65,
    "minRiskReward": 1.5
  }
}
```

---

## Programmatic Usage

### Loading Strategies

```typescript
import { StrategyLoader } from './services/setup-detection/dynamic';

const loader = new StrategyLoader([
  './strategies/builtin',
  './strategies/custom'
]);

// Load all
const strategies = await loader.loadAll();

// Load a specific one
const strategy = await loader.loadStrategy('./strategies/custom/my-strategy.json');

// Load from a string (copy/paste)
const strategyJson = '{ "id": "...", ... }';
const strategy = loader.loadFromString(strategyJson);
```

### Using with SetupDetectionService

```typescript
import { SetupDetectionService } from './services/setup-detection';

const service = new SetupDetectionService({
  enableLegacyDetectors: true,
  strategyDirectory: './strategies/builtin',
  dynamicStrategies: []
});

// Load strategies from a directory
await service.loadStrategiesFromDirectory('./strategies/custom');

// Load a specific strategy
await service.loadStrategy('./strategies/my-strategy.json');

// Unload a strategy
service.unloadStrategy('my-strategy');
```

### Hot Reload

```typescript
loader.watchForChanges((strategies) => {
  console.log('Strategies reloaded:', strategies.map(s => s.id));
});

// To stop watching
loader.stopWatching();
```

---

## Validation

The system validates automatically:

- Required fields present
- ID format (kebab-case)
- Valid indicator types
- Condition structure
- Exit level types

Validation errors prevent loading and are reported in detail.

---

## Tips

1. **Start simple** - Begin with a few conditions and add complexity gradually
2. **Use parameters** - Makes optimization and tuning easier
3. **Test with backtesting** - Validate the strategy before using it in production
4. **Document** - Use `description` in parameters and confidence conditions
5. **Versioning** - Bump the version when making significant changes
