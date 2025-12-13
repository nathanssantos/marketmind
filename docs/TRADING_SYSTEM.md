# MarketMind Trading System

## Overview

MarketMind is an automated trading system that combines technical analysis setup detection with machine learning filtering to execute trades on cryptocurrency markets via Binance.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Binance API    │────▶│  Kline Storage   │────▶│ Setup Detection │
│  (Real-time)    │     │  (TimescaleDB)   │     │  (Strategies)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Trade Exec     │◀────│  Risk Manager    │◀────│   ML Filter     │
│  (Binance)      │     │  (Validation)    │     │   (XGBoost)     │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Position       │────▶│  Trailing Stop   │
│  Monitor        │     │  Service         │
└─────────────────┘     └──────────────────┘
```

## Core Components

### 1. Setup Detection

The system uses JSON-defined strategies located in `apps/backend/strategies/builtin/`. Each strategy defines:

- **Entry conditions**: Technical indicator thresholds
- **Exit conditions**: Stop loss and take profit rules
- **Position sizing**: Max allocation percentage

**Supported setups include:**
- Larry Williams 9.1-9.4 (EMA pullbacks)
- Keltner/Bollinger breakouts
- RSI mean reversion
- MACD divergence
- And 40+ more strategies

### 2. ML Filtering (XGBoost)

Before executing any setup, the ML model evaluates the probability of success:

```
Features (50+):
├── Price action (momentum, volatility, range)
├── Technical indicators (RSI, MACD, BB, ATR)
├── Volume metrics (relative volume, VWAP)
├── Market structure (trend, swing points)
└── Pattern-specific features
```

**Model outputs:**
- Probability score (0-1)
- Trades with probability < 5% are filtered out
- Higher confidence = larger position size

### 3. Position Sizing (Pyramiding)

The system uses dynamic position sizing based on:

**Initial Entry:**
- Base: 40% of maxPositionSize
- ML confidence >= 80%: 60%
- ML confidence >= 70%: 50%
- ML confidence < 50%: 30%

**Pyramid Entries (adding to winners):**
- Requires position > 1% profit
- Minimum 0.5% distance from last entry
- Each pyramid = 80% of previous size
- Maximum 5 entries per position
- ML confidence > 75% adds 20% boost

### 4. Position Groups

Multiple entries on the same symbol/direction are treated as a single position:

**Consolidated Stop Loss:**
- LONG: Uses highest SL (most protective)
- SHORT: Uses lowest SL (most protective)

**Consolidated Take Profit:**
- LONG: Uses lowest TP (nearest target)
- SHORT: Uses highest TP (nearest target)

### 5. Trailing Stop

When position moves in profit:

1. **Breakeven trigger**: At 0.5% profit, SL moves to entry + 0.1%
2. **Swing-based trailing**: Uses recent swing lows (LONG) or highs (SHORT)
3. **Never moves against**: SL only tightens, never loosens

```
LONG Example:
Entry: 100,000
Breakeven SL: 100,100 (at 0.5% profit)
Swing trail: Latest swing low - 0.2% buffer
Final SL: Max(breakeven, swing_trail)
```

### 6. Risk Management

**Pre-trade validation:**
- Max concurrent positions (default: 3)
- Max position size (default: 10% of balance)
- Daily loss limit (default: 5%)
- Total exposure limit

**Trade viability:**
- Minimum R:R ratio check
- Fee impact calculation
- Slippage consideration

## Data Flow

### Setup Detection Flow

```
1. Kline received from Binance WebSocket
2. Strategy interpreter evaluates conditions
3. If setup detected → ML model scores it
4. If probability > threshold → Risk validation
5. If valid → Calculate dynamic position size
6. Execute trade on Binance
7. Store execution in database
```

### Position Monitoring Flow

```
1. Every 60 seconds:
   ├── Fetch all open executions
   ├── Group by symbol + side
   ├── Update trailing stops
   └── Check consolidated SL/TP

2. If SL/TP triggered:
   ├── Execute exit order
   ├── Update wallet balance
   └── Record PnL
```

## Database Schema

**Key tables:**
- `trade_executions`: Open/closed positions
- `setup_detections`: Detected setups
- `auto_trading_config`: User settings
- `klines`: Historical price data (TimescaleDB)
- `ml_predictions`: Model predictions for analysis

## Configuration

### Auto-Trading Config

```typescript
{
  isEnabled: boolean,
  maxConcurrentPositions: 3,
  maxPositionSize: "10",      // % of balance
  dailyLossLimit: "5",        // % of balance
  positionSizing: "percentage" | "kelly" | "fixed",
  enabledSetupTypes: ["larry-williams-9-1", ...]
}
```

### Strategy Definition

```json
{
  "name": "larry-williams-9-1",
  "timeframes": ["1h", "4h", "1d"],
  "conditions": {
    "entry": {
      "trend": "above_ema21",
      "pullback": "close_below_ema9",
      "rsi": { "min": 30, "max": 50 }
    },
    "exit": {
      "stopLoss": "swing_low",
      "takeProfit": "2R"
    }
  }
}
```

## ML Training

### Data Generation

```bash
pnpm exec tsx src/cli/backtest-runner.ts generate-training \
  --symbols BTCUSDT,ETHUSDT,SOLUSDT \
  --intervals 1m,5m,15m,30m,1h,4h,1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --output training.csv
```

### Model Training

```bash
python scripts/train_setup_classifier.py \
  --data packages/ml/data/training_unified.csv \
  --output packages/ml/models/
```

### Evaluation Metrics

- Accuracy, Precision, Recall, F1
- ROC-AUC for probability calibration
- Backtest PnL improvement over baseline

## Performance Optimizations

1. **Kline caching**: Recent data in memory
2. **Price cache**: 5-second TTL for current prices
3. **Batch queries**: Group DB operations
4. **Indicator caching**: Pre-computed values

## Paper vs Live Trading

The system supports both modes:

- **Paper**: Simulates trades, no actual orders
- **Live**: Executes real orders on Binance

Mode is determined by wallet type in database.

## Monitoring

Logs written to `apps/backend/logs/auto-trading.log`:

```
[2024-12-13T13:45:00.000Z] 📊 Setup detected {type: "larry-williams-9-1", symbol: "BTCUSDT"}
[2024-12-13T13:45:00.100Z] 🤖 ML score {probability: 0.72, confidence: "high"}
[2024-12-13T13:45:00.200Z] 💰 Dynamic position sizing {sizePercent: 5.5, reason: "Initial entry"}
[2024-12-13T13:45:00.300Z] ✅ Trade executed {id: "exec-123", quantity: 0.001}
```

## Key Files

| File | Purpose |
|------|---------|
| `auto-trading-scheduler.ts` | Main orchestrator |
| `pyramiding.ts` | Dynamic position sizing |
| `position-monitor.ts` | SL/TP monitoring |
| `trailing-stop.ts` | Trailing stop logic |
| `risk-manager.ts` | Risk validation |
| `ml/index.ts` | ML model integration |

## Safety Features

1. **Duplicate prevention**: No same setup + symbol twice
2. **Max exposure limits**: Hard caps on allocation
3. **Daily loss circuit breaker**: Stops trading at limit
4. **Consolidate exits**: All entries exit together
5. **Paper mode testing**: Full simulation before live
