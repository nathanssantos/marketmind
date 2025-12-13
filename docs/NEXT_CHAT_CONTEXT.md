# MarketMind - Context for New Chat

## Quick Start

Copy this entire document and paste it in a new Claude Code chat to continue.

---

## Current State (2025-12-13)

### Completed Tasks

1. **ML Model v2 Trained & Deployed**
   - Unified dataset: 464,136 samples across 7 timeframes (1w, 1d, 4h, 1h, 30m, 15m, 5m)
   - Model location: `apps/backend/models/setup-classifier-v2.json`
   - Metrics: Accuracy 70.9%, Precision 57%, AUC 0.686
   - Missing 1m data (still generating)

2. **Concatenation Script Created**
   - File: `packages/ml/scripts/concatenate_training.sh`
   - Combines all training CSVs with `interval` column
   - Output: `packages/ml/data/training_unified.csv`

3. **Training Config**
   - File: `packages/ml/data/training_unified-config.json`
   - 139 features including `interval_encoded`

4. **Trading System Infrastructure**
   - Pyramiding: `apps/backend/src/services/pyramiding.ts`
   - Trailing Stop: `apps/backend/src/services/trailing-stop.ts`
   - Position Monitor: `apps/backend/src/services/position-monitor.ts`
   - Auto-Trading Scheduler: `apps/backend/src/services/auto-trading-scheduler.ts`

5. **Pyramiding Connected to Auto-Trading Scheduler**
   - Evaluates pyramid opportunities before new entries
   - Adjusts stop loss after pyramid entries
   - Lines 541-574, 661-694 in `auto-trading-scheduler.ts`

6. **ML-Based Position Sizing**
   - Position size = maxPositionSize × mlConfidence
   - Floor: 20% of maxPositionSize (prevents tiny positions)
   - Ceiling: 100% of maxPositionSize
   - File: `apps/backend/src/services/pyramiding.ts`

7. **maxPositionSize Updated to 50%**
   - Database updated: `auto_trading_config.max_position_size = 50`
   - Position sizes now range from 10% to 50% based on ML confidence

8. **Auto-Trading Connected to Real Execution**
   - File: `apps/backend/src/services/auto-trading-scheduler.ts`
   - Wallet types: `live`/`testnet` → real Binance orders, `paper` → DB only
   - MARKET orders for entries, STOP_LOSS_LIMIT for SL, LIMIT for TP
   - Stores actual fill price/quantity from Binance in `trade_executions`
   - **Safety flag**: `ENABLE_LIVE_TRADING=false` in `.env` disables real orders (default: false)

9. **Complete Binance Integration**
   - `closeTradeExecution` - executes MARKET exit order on Binance (live/testnet)
   - `closePosition` - executes MARKET exit order on Binance (live/testnet)
   - `getPortfolio` - fetches all assets from Binance, calculates total value in USDT
   - All endpoints respect `ENABLE_LIVE_TRADING` flag

### In Progress

**1m Training Data Generation**
```bash
# Check if still running:
ps aux | grep backtest-runner | grep -v grep

# Check if file created:
ls -la packages/ml/data/training_1m.csv
```

When 1m completes:
```bash
cd packages/ml
./scripts/concatenate_training.sh
source .venv/bin/activate
python scripts/train_setup_classifier.py \
  --config data/training_unified-config.json \
  --data data/training_unified.csv \
  --output models/setup-classifier-v3.onnx \
  --importance models/feature_importance.json

# Copy to backend
cp models/setup-classifier-v3.json ../../apps/backend/models/
# Update apps/backend/models/manifest.json to include v3
```

### Pending Tasks (Priority Order)

1. **Re-train with 1m data** (when generation completes)
   - Expected: ~1M+ samples
   - Will improve model coverage for short timeframes

2. **✅ Connect Auto-Trading to Real Execution** (COMPLETED)
   - Auto-trading scheduler now executes real Binance orders for `live` and `testnet` wallets
   - Paper wallets (`paper` type) continue with DB-only simulation
   - Entry orders placed as MARKET orders for immediate execution
   - Stop loss and take profit orders automatically placed after entry
   - `entryOrderId` stored in `trade_executions` table
   - Actual fill price and quantity from Binance used (not setup estimates)

3. **Phase 9: Full System Optimization** (from OPTIMIZATION_PIPELINE_PLAN.md)
   - Grid search on pyramiding/trailing stop parameters
   - Walk-forward validation
   - Per-timeframe ML threshold calibration

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/backend/models/manifest.json` | ML model registry (v1 & v2) |
| `apps/backend/src/services/auto-trading-scheduler.ts` | Main trading orchestrator |
| `apps/backend/src/services/auto-trading.ts` | Has `executeBinanceOrder()` |
| `apps/backend/src/services/pyramiding.ts` | Position scaling logic + ML-based sizing |
| `apps/backend/src/services/trailing-stop.ts` | Trailing stop logic |
| `packages/ml/scripts/concatenate_training.sh` | CSV concatenation script |
| `packages/ml/scripts/train_setup_classifier.py` | Model training script |
| `docs/OPTIMIZATION_PIPELINE_PLAN.md` | Full optimization pipeline plan |
| `docs/TRADING_SYSTEM.md` | Trading system documentation |

---

## Position Sizing Logic

Current formula in `pyramiding.ts`:

```typescript
// Initial position (no existing entries)
baseSizePercent = maxPositionSize × mlConfidence
baseSizePercent = Math.max(baseSizePercent, maxPositionSize × 0.2)  // Floor 20%
baseSizePercent = Math.min(baseSizePercent, maxPositionSize)       // Ceiling 100%

// Pyramid entries
pyramidSize = baseQuantity × PYRAMID_SCALE_FACTOR × mlConfidence
pyramidSize = Math.max(pyramidSize, baseQuantity × 0.2)            // Floor 20%
```

| ML Confidence | Position Size (max 50%) |
|---------------|-------------------------|
| 100% | 50% of wallet |
| 80% | 40% of wallet |
| 60% | 30% of wallet |
| 40% | 20% of wallet |
| 20% | 10% of wallet (floor) |

---

## Recent Fixes Applied

1. **Position Grouping by Direction** - Fixed SL/TP visualization for LONG vs SHORT
   - `useOrderLinesRenderer.ts`: Changed grouping key to `${symbol}-${direction}`

2. **Opposite Direction Prevention** - Blocks opening LONG when SHORT exists (One-Way Mode)
   - `auto-trading-scheduler.ts`: Added check before opening new positions

3. **Pyramiding Integration** - Connected pyramiding service to auto-trading scheduler
   - Evaluates if pyramid is possible before creating new entries
   - Adjusts stop loss to breakeven after pyramid entries

4. **ML-Driven Position Sizing** - Replaced fixed multiplier tiers with ML confidence
   - Position size scales directly with model confidence

---

## Binance Integration Status

- **Fully Implemented**:
  - Spot trading, order placement, paper trading, testnet
  - Position monitoring with automatic SL/TP execution
  - Auto-trading with real order execution
  - Manual position/execution close with real Binance orders
  - Full portfolio fetch (all assets with USDT valuation)
- **Live Trading Flow**: Setup detected → ML filter → Risk validation → MARKET entry order → SL/TP orders
- **Safety**: All real execution controlled by `ENABLE_LIVE_TRADING` env flag (default: false)
- **Not Implemented**: Futures, OCO orders, margin trading

---

## Model Comparison

| Métrica | v1 (1d only) | v2 (Multi-TF) |
|---------|-------------|---------------|
| Accuracy | 64.3% | **70.9%** |
| Precision | 59.7% | 57.0% |
| Recall | 31.9% | 19.0% |
| AUC | 65.3% | **68.6%** |
| Samples | 6,310 | **464,136** |

v2 is more conservative (lower recall) but better discrimination (higher AUC).

---

## Database Configuration

```sql
-- Current auto_trading_config
SELECT * FROM auto_trading_config;

-- Key values:
-- max_position_size: 50 (%)
-- max_concurrent_positions: 3
```

---

## Commands Reference

```bash
# Check training status
ps aux | grep backtest-runner

# Run concatenation
cd packages/ml && ./scripts/concatenate_training.sh

# Train model
cd packages/ml && source .venv/bin/activate
python scripts/train_setup_classifier.py \
  --config data/training_unified-config.json \
  --data data/training_unified.csv \
  --output models/setup-classifier-v3.onnx

# Copy model to backend
cp packages/ml/models/setup-classifier-v3.json apps/backend/models/

# Run backend
cd apps/backend && pnpm dev

# Run frontend
cd apps/electron && pnpm dev

# Run tests
pnpm test

# Database access
psql "postgresql://marketmind:marketmind123@localhost:5432/marketmind"
```

---

## Starting Prompt for Next Chat

```
Continuing MarketMind development. See docs/NEXT_CHAT_CONTEXT.md for full context.

Current priorities:
1. Check if 1m training data is complete and retrain model if so
2. Connect auto-trading scheduler to real order execution
3. Implement full system optimization pipeline

Reference: docs/OPTIMIZATION_PIPELINE_PLAN.md

Branch: main
```

---

## Additional Context Files

Read these files first:
1. `/CLAUDE.md` - Project conventions
2. `/docs/TRADING_SYSTEM.md` - Trading system architecture
3. `/docs/OPTIMIZATION_PIPELINE_PLAN.md` - Optimization pipeline plan
4. `/apps/backend/src/services/auto-trading-scheduler.ts` - Main scheduler
5. `/apps/backend/src/services/pyramiding.ts` - Position sizing + pyramiding
6. `/apps/backend/src/services/auto-trading.ts` - Order execution methods
