# MarketMind ML Features Documentation

**Status:** Reference documentation for Machine Learning integration
**Updated:** 2025-12-10

## Overview

This document catalogs all available features for ML model training, including technical indicators, market microstructure data, and contextual features.

---

## Technical Indicators (55 total)

Available from `@marketmind/indicators`:

### Trend Indicators
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `adx` | Average Directional Index | period (14) |
| `aroon` | Aroon Up/Down | period (25) |
| `dmi` | Directional Movement Index | period (14) |
| `ichimoku` | Ichimoku Cloud | conversionPeriod, basePeriod, spanPeriod |
| `macd` | MACD | fastPeriod, slowPeriod, signalPeriod |
| `parabolicSar` | Parabolic SAR | step, maxStep |
| `supertrend` | SuperTrend | period, multiplier |
| `vortex` | Vortex Indicator | period (14) |

### Momentum Indicators
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `ao` | Awesome Oscillator | fastPeriod (5), slowPeriod (34) |
| `cci` | Commodity Channel Index | period (20) |
| `cmo` | Chande Momentum Oscillator | period (9) |
| `cumulativeRsi` | Cumulative RSI | period (2-3) |
| `elderRay` | Elder Ray Bull/Bear Power | emaPeriod (13) |
| `ibs` | Internal Bar Strength | - |
| `massIndex` | Mass Index | emaPeriod, sumPeriod |
| `mfi` | Money Flow Index | period (14) |
| `ppo` | Percentage Price Oscillator | fastPeriod, slowPeriod |
| `roc` | Rate of Change | period (12) |
| `rsi` | Relative Strength Index | period (14) |
| `stochRsi` | Stochastic RSI | rsiPeriod, stochPeriod, kPeriod, dPeriod |
| `stochastic` | Stochastic Oscillator | kPeriod, dPeriod, slowing |
| `tsi` | True Strength Index | longPeriod, shortPeriod |
| `ultimateOscillator` | Ultimate Oscillator | period1, period2, period3 |
| `williamsR` | Williams %R | period (14) |

### Volatility Indicators
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `atr` | Average True Range | period (14) |
| `bollingerBands` | Bollinger Bands | period (20), stdDev (2) |
| `donchian` | Donchian Channel | period (20) |
| `keltner` | Keltner Channel | emaPeriod, atrPeriod, multiplier |
| `percentB` | Percent B (BB position) | period, stdDev |

### Volume Indicators
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `cmf` | Chaikin Money Flow | period (21) |
| `deltaVolume` | Delta Volume | - |
| `klinger` | Klinger Volume Oscillator | shortPeriod, longPeriod |
| `obv` | On Balance Volume | - |
| `vwap` | Volume Weighted Average Price | - |

### Moving Averages
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `movingAverages` | SMA, EMA, WMA | period |
| `dema` | Double Exponential MA | period |
| `hma` | Hull Moving Average | period |
| `tema` | Triple Exponential MA | period |
| `wma` | Weighted Moving Average | period |

### Support/Resistance
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `fibonacci` | Fibonacci Retracement | - |
| `floorPivots` | Floor Pivot Points | - |
| `liquidityLevels` | Liquidity Levels | - |
| `pivotPoints` | Standard Pivot Points | - |
| `swingPoints` | Swing High/Low Points | lookbackPeriod |

### Pattern Detection
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `candlePatterns` | Candle Pattern Detection | - |
| `fvg` | Fair Value Gap | - |
| `gapDetection` | Gap Detection | minGapPercent |
| `nDayHighLow` | N-Day High/Low | period |
| `nr7` | NR7 (Narrow Range 7) | - |

### Market Metrics
| Indicator | Description | Parameters |
|-----------|-------------|------------|
| `btcDominance` | BTC Dominance | - |
| `fundingRate` | Perpetual Funding Rate | - |
| `halvingCycle` | BTC Halving Cycle Position | - |
| `liquidations` | Liquidation Data | - |
| `openInterest` | Open Interest | - |
| `relativeStrength` | Relative Strength vs Index | basePeriod |

---

## Market Microstructure Features

Available from backend services:

### Order Flow
- Taker Buy/Sell Ratio
- Delta Volume (Buy - Sell)
- Large Trade Detection
- Order Book Imbalance

### Derivatives Data
- Funding Rate (perpetuals)
- Open Interest
- Liquidation Levels
- Long/Short Ratio

### Market Depth
- Bid/Ask Spread
- Order Book Depth
- Liquidity Levels
- Support/Resistance Zones

---

## Contextual Features

Available from `ContextAggregator`:

### Sentiment
| Feature | Source | Update Frequency |
|---------|--------|------------------|
| Fear & Greed Index | alternative.me | Daily |
| News Sentiment | Aggregated | Real-time |
| Social Sentiment | (future) | - |

### Market Context
| Feature | Source | Update Frequency |
|---------|--------|------------------|
| BTC Dominance | CoinGecko | Hourly |
| Market Cap Total | CoinGecko | Hourly |
| Funding Rate | Binance Futures | 8 hours |
| Open Interest | Binance Futures | Real-time |

### Calendar Events
| Feature | Source | Update Frequency |
|---------|--------|------------------|
| Economic Events | (future) | Daily |
| Crypto Events | (future) | Daily |
| Halving Countdown | Calculated | Daily |

---

## Temporal Features

### Time-Based
- Hour of Day (0-23)
- Day of Week (0-6)
- Month (1-12)
- Is Weekend (boolean)
- Is Asian/European/US Session (boolean)

### Cyclical Encoding
```typescript
const hourSin = Math.sin(2 * Math.PI * hour / 24);
const hourCos = Math.cos(2 * Math.PI * hour / 24);
const dayOfWeekSin = Math.sin(2 * Math.PI * dayOfWeek / 7);
const dayOfWeekCos = Math.cos(2 * Math.PI * dayOfWeek / 7);
```

---

## Label Features (Targets)

### For Classification
| Label | Description | Calculation |
|-------|-------------|-------------|
| `direction` | Price direction | 1 if close[t+n] > close[t], else 0 |
| `hitTakeProfit` | TP hit within window | Boolean |
| `hitStopLoss` | SL hit within window | Boolean |
| `setupSuccess` | Setup was profitable | Boolean |

### For Regression
| Label | Description | Calculation |
|-------|-------------|-------------|
| `returns` | Future returns | (close[t+n] - close[t]) / close[t] |
| `maxDrawdown` | Maximum adverse excursion | min(low[t:t+n]) / close[t] - 1 |
| `maxGain` | Maximum favorable excursion | max(high[t:t+n]) / close[t] - 1 |
| `pnlPercent` | Trade PnL percentage | Actual trade result |

---

## Feature Engineering Best Practices

### Normalization
```typescript
// Z-score normalization
const normalized = (value - mean) / stdDev;

// Min-Max scaling (0-1)
const scaled = (value - min) / (max - min);

// For bounded indicators (RSI, Stoch)
const normalized = value / 100;
```

### Lag Features
```typescript
// Create lagged features for time series
const laggedFeatures = [
  rsi,           // t
  rsi_lag1,      // t-1
  rsi_lag5,      // t-5
  rsi_lag10,     // t-10
];
```

### Derived Features
```typescript
// Rate of change
const rsiChange = rsi - rsi_lag1;
const rsiChangePercent = (rsi - rsi_lag1) / rsi_lag1;

// Moving averages of indicators
const rsiSMA = calculateSMA(rsiValues, 5);

// Cross-overs
const macdCrossUp = macd > macdSignal && macd_lag1 <= macdSignal_lag1;
```

---

## Database Views for ML

### Training Data View
```sql
CREATE VIEW ml_training_data AS
SELECT
  k.symbol,
  k.interval,
  k.open_time,
  k.open, k.high, k.low, k.close, k.volume,

  -- Future labels (calculated)
  LEAD(k.close, 1) OVER (PARTITION BY k.symbol ORDER BY k.open_time) as close_next,
  LEAD(k.close, 5) OVER (PARTITION BY k.symbol ORDER BY k.open_time) as close_5,

  -- Setup outcomes
  sd.setup_type,
  sd.confidence,
  sd.direction,

  -- Trade results
  t.pnl_percent,
  t.status

FROM klines k
LEFT JOIN setup_detections sd ON k.symbol = sd.symbol
  AND k.open_time = sd.detected_at
LEFT JOIN positions t ON sd.id = t.setup_id
WHERE k.open_time >= NOW() - INTERVAL '1 year';
```

---

## Next Steps

1. **Feature Store**: Implement centralized feature computation
2. **Data Pipeline**: Set up automated feature extraction
3. **Model Training**: XGBoost/LightGBM for setup selection
4. **Backtesting Integration**: ML predictions as strategy signals
5. **Online Learning**: Continuous model updates

---

## References

- [packages/indicators/README.md](../packages/indicators/README.md) - Indicator implementations
- [BACKTESTING_GUIDE.md](./BACKTESTING_GUIDE.md) - Backtesting system
- [REFACTORING_PLAN_2025.md](./REFACTORING_PLAN_2025.md) - ML preparation roadmap
