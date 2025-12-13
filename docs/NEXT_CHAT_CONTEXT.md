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
   - Pyramiding: `apps/backend/src/services/pyramiding.ts` (now configurable!)
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

7. **Auto-Trading Connected to Real Execution**
   - File: `apps/backend/src/services/auto-trading-scheduler.ts`
   - Wallet types: `live`/`testnet` → real Binance orders, `paper` → DB only
   - MARKET orders for entries, STOP_LOSS_LIMIT for SL, LIMIT for TP
   - **Safety flag**: `ENABLE_LIVE_TRADING=false` in `.env` (default: false)

8. **Pyramiding Made Configurable**
   - `PyramidConfig` interface exported
   - `DEFAULT_PYRAMIDING_CONFIG` constant exported
   - Constructor accepts custom config
   - `updateConfig()` and `getConfig()` methods added

9. **Optimization Types Added**
   - `packages/types/src/backtesting.ts` now includes:
     - `PyramidingConfig`, `TrailingStopConfig`
     - `TimeframeThreshold`, `FullSystemOptimizationConfig`
     - `OptimizationResult`, `OptimizationResultEntry`
     - `WalkForwardResult`

10. **i18n Fixes for Trading Sidebar**
    - Fixed broken badges in `OrdersList.tsx` (status mapping)
    - Updated `Portfolio.tsx` to use `tradeExecutions` data
    - Added Analytics tab translations (EN/PT/ES/FR)
    - All performance/stats components now use i18n

11. **Full System Optimization Pipeline (Phase 9) ✅**
    - `TrailingStopService` made configurable with `DEFAULT_TRAILING_STOP_CONFIG`
    - `FullSystemOptimizer` service created with 3 presets (quick, balanced, thorough)
    - `optimize-full` CLI command added to backtest-runner
    - Per-timeframe ML thresholds in `packages/ml/src/constants/optimizedThresholds.ts`
    - Auto-trading scheduler now uses `getThresholdForTimeframe()` for ML filtering
    - Walk-forward validation integrated for robustness testing

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

2. **Run Full System Optimization**
   - Use new `optimize-full` CLI command
   - Example: `pnpm exec tsx src/cli/backtest-runner.ts optimize-full -s setup91 --symbol BTCUSDT -i 1h --start 2024-01-01 --end 2024-10-01 --preset balanced`
   - Run per-timeframe threshold calibration
   - Save optimized params to config files

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/backend/models/manifest.json` | ML model registry (v1 & v2) |
| `apps/backend/src/services/auto-trading-scheduler.ts` | Main trading orchestrator |
| `apps/backend/src/services/auto-trading.ts` | Has `executeBinanceOrder()` |
| `apps/backend/src/services/pyramiding.ts` | Position scaling logic + ML-based sizing |
| `apps/backend/src/services/trailing-stop.ts` | Trailing stop logic (configurable) |
| `apps/backend/src/services/backtesting/FullSystemOptimizer.ts` | Full system optimization orchestrator |
| `apps/backend/src/cli/commands/optimize-full-system.ts` | CLI for full system optimization |
| `packages/ml/src/constants/optimizedThresholds.ts` | Per-timeframe ML thresholds |
| `packages/types/src/backtesting.ts` | Optimization types |
| `packages/ml/scripts/concatenate_training.sh` | CSV concatenation script |
| `packages/ml/scripts/train_setup_classifier.py` | Model training script |
| `docs/OPTIMIZATION_IMPROVEMENTS_PLAN.md` | Optimization implementation (✅ complete) |
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
pyramidSize = baseQuantity × config.scaleFactor × mlConfidence
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

## Optimization System Status

### What Already Exists
- **BacktestOptimizer** - Grid search with parallel workers
- **WalkForwardOptimizer** - Walk-forward validation (6mo train, 2mo test)
- **ParameterGenerator** - Parameter combination generation
- **optimize.ts CLI** - Grid search command with presets

### What Needs to Be Built
- **TrailingStopService** - Configurable trailing stop params
- **FullSystemOptimizer** - Orchestrates ML + pyramiding + trailing stop optimization
- **optimize-full-system CLI** - New command for full system optimization
- **Per-timeframe ML thresholds** - Calibrated thresholds by interval

### Parameter Grid (Balanced Preset)
```
ML Thresholds: [0.03, 0.05, 0.07, 0.10] = 4 values
Pyramiding:
  - profitThreshold: [0.005, 0.01, 0.015]
  - scaleFactor: [0.7, 0.8, 0.9]
  - maxEntries: [3, 5]
Trailing:
  - breakevenThreshold: [0.003, 0.005, 0.007]
  - minDistance: [0.001, 0.002]

Total: 4 × 3 × 3 × 2 × 3 × 2 = 432 combinations
```

---

## Binance Integration Status

- **Fully Implemented**:
  - Spot trading, order placement, paper trading, testnet
  - Position monitoring with automatic SL/TP execution
  - Auto-trading with real order execution
  - Manual position/execution close with real Binance orders
  - Full portfolio fetch (all assets with USDT valuation)
- **Live Trading Flow**: Setup detected → ML filter → Risk validation → MARKET entry → SL/TP orders
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
2. Continue Phase 9: Full System Optimization Pipeline
   - Create TrailingStopService with configurable params
   - Create FullSystemOptimizer service
   - Create optimize-full-system CLI command
   - Add per-timeframe ML threshold constants

Reference docs:
- docs/OPTIMIZATION_IMPROVEMENTS_PLAN.md (implementation details)
- docs/OPTIMIZATION_PIPELINE_PLAN.md (8-phase design)
- docs/ML_IMPLEMENTATION_PLAN.md (Phase 9)

Branch: main
```

---

## Additional Context Files

Read these files first:
1. `/CLAUDE.md` - Project conventions
2. `/docs/TRADING_SYSTEM.md` - Trading system architecture
3. `/docs/OPTIMIZATION_IMPROVEMENTS_PLAN.md` - Current optimization plan
4. `/docs/OPTIMIZATION_PIPELINE_PLAN.md` - Original pipeline design
5. `/apps/backend/src/services/auto-trading-scheduler.ts` - Main scheduler
6. `/apps/backend/src/services/pyramiding.ts` - Position sizing + pyramiding
7. `/packages/types/src/backtesting.ts` - Optimization types
