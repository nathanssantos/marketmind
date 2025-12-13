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

2. **ML Model 1m Trained & Deployed ✅**
   - Dataset: 170,900 samples (6 symbols × 6 months)
   - Model location: `packages/ml/models/setup_classifier_1m.json`
   - Metrics: Accuracy 85.09%, Precision 45.77%, AUC 0.8287
   - Top features: setup_type_6 (17%), atr_percent (8%), avg_true_range_normalized (6.5%)

3. **Concatenation Script Created**
   - File: `packages/ml/scripts/concatenate_training.sh`
   - Combines all training CSVs with `interval` column
   - Output: `packages/ml/data/training_unified.csv`

4. **Training Config**
   - File: `packages/ml/data/training_unified-config.json`
   - 139 features including `interval_encoded`

5. **Trading System Infrastructure**
   - Pyramiding: `apps/backend/src/services/pyramiding.ts` (now configurable!)
   - Trailing Stop: `apps/backend/src/services/trailing-stop.ts`
   - Position Monitor: `apps/backend/src/services/position-monitor.ts`
   - Auto-Trading Scheduler: `apps/backend/src/services/auto-trading-scheduler.ts`

6. **Pyramiding Connected to Auto-Trading Scheduler**
   - Evaluates pyramid opportunities before new entries
   - Adjusts stop loss after pyramid entries
   - Lines 541-574, 661-694 in `auto-trading-scheduler.ts`

7. **ML-Based Position Sizing**
   - Position size = maxPositionSize × mlConfidence
   - Floor: 20% of maxPositionSize (prevents tiny positions)
   - Ceiling: 100% of maxPositionSize
   - File: `apps/backend/src/services/pyramiding.ts`

8. **Auto-Trading Connected to Real Execution**
   - File: `apps/backend/src/services/auto-trading-scheduler.ts`
   - Wallet types: `live`/`testnet` → real Binance orders, `paper` → DB only
   - MARKET orders for entries, STOP_LOSS_LIMIT for SL, LIMIT for TP
   - **Safety flag**: `ENABLE_LIVE_TRADING=false` in `.env` (default: false)

9. **Pyramiding Made Configurable**
   - `PyramidConfig` interface exported
   - `DEFAULT_PYRAMIDING_CONFIG` constant exported
   - Constructor accepts custom config
   - `updateConfig()` and `getConfig()` methods added

10. **Optimization Types Added**
    - `packages/types/src/backtesting.ts` now includes:
      - `PyramidingConfig`, `TrailingStopConfig`
      - `TimeframeThreshold`, `FullSystemOptimizationConfig`
      - `OptimizationResult`, `OptimizationResultEntry`
      - `WalkForwardResult`

11. **i18n Fixes for Trading Sidebar**
    - Fixed broken badges in `OrdersList.tsx` (status mapping)
    - Updated `Portfolio.tsx` to use `tradeExecutions` data
    - Added Analytics tab translations (EN/PT/ES/FR)
    - All performance/stats components now use i18n

12. **Full System Optimization Pipeline (Phase 9) ✅**
    - `TrailingStopService` made configurable with `DEFAULT_TRAILING_STOP_CONFIG`
    - `FullSystemOptimizer` service created with 3 presets (quick, balanced, thorough)
    - `optimize-full` CLI command added to backtest-runner
    - Per-timeframe ML thresholds in `packages/ml/src/constants/optimizedThresholds.ts`
    - Auto-trading scheduler now uses `getThresholdForTimeframe()` for ML filtering
    - Walk-forward validation integrated for robustness testing

13. **Test Coverage Improvements ✅**
    - Backend: 296 tests (pyramiding, risk-manager, trailing-stop pure functions)
    - ML Package: 43 tests (evaluation metrics, optimized thresholds)
    - Frontend: 1,794 tests (useBacktestMetrics, useDebounceCallback)
    - Indicators: 1,086 tests
    - **Total: 3,219 tests passing**

14. **Pure Function Extraction for Testability**
    - `pyramiding.ts`: 9 pure functions extracted
    - `risk-manager.ts`: 7 pure functions extracted
    - `trailing-stop.ts`: 6 pure functions extracted
    - `useBacktestMetrics.ts`: 10 pure functions extracted

### Pending Tasks (Priority Order)

1. **Re-train Unified Model with 1m data**
   - Now have all 8 timeframes: 1w, 1d, 4h, 1h, 30m, 15m, 5m, 1m
   - Run concatenation and train v3 model

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
| `packages/ml/models/setup_classifier_1m.json` | 1m ML model |
| `packages/types/src/backtesting.ts` | Optimization types |
| `packages/ml/scripts/concatenate_training.sh` | CSV concatenation script |
| `packages/ml/scripts/train_setup_classifier.py` | Model training script |
| `docs/OPTIMIZATION_IMPROVEMENTS_PLAN.md` | Optimization implementation (✅ complete) |
| `docs/TRADING_SYSTEM.md` | Trading system documentation |

---

## ML Models Summary

| Model | Timeframe | Samples | Accuracy | Precision | AUC |
|-------|-----------|---------|----------|-----------|-----|
| v1 | 1d only | 6,310 | 64.3% | 59.7% | 65.3% |
| v2 | Multi-TF (7) | 464,136 | 70.9% | 57.0% | 68.6% |
| 1m | 1m only | 170,900 | **85.09%** | 45.77% | **82.87%** |

**1m Model Top Features:**
1. `setup_type_6` - 17.15%
2. `atr_percent` - 8.03%
3. `avg_true_range_normalized` - 6.55%
4. `setup_confidence_original` - 6.04%
5. `take_profit_atr_multiple` - 5.70%

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

## Training Data Available

| Timeframe | File | Samples | Size |
|-----------|------|---------|------|
| 1w | training_1w.csv | ~4K | 763 KB |
| 1d | training_1d.csv | ~35K | 7.3 MB |
| 4h | training_4h.csv | ~150K | 37 MB |
| 1h | training_1h.csv | ~400K | 99 MB |
| 30m | training_30m.csv | ~530K | 132 MB |
| 15m | training_15m.csv | ~460K | 150 MB |
| 5m | training_5m.csv | ~730K | 182 MB |
| **1m** | **training_1m.csv** | **170,900** | **216 MB** |
| unified | training_unified.csv | 2.4M+ | 609 MB |

---

## Commands Reference

```bash
# Train 1m model (already done)
cd packages/ml && source venv/bin/activate
python scripts/train_setup_classifier.py \
  --config data/training_1m-config.json \
  --data data/training_1m.csv \
  --output models/setup_classifier_1m.onnx

# Train unified v3 model (next step)
cd packages/ml
./scripts/concatenate_training.sh  # Re-run to include 1m
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
1. Re-train unified model v3 with 1m data included (all 8 timeframes)
2. Run full system optimization with `optimize-full` CLI
3. Continue improving test coverage

Recent completions:
- 1m ML model trained (85% accuracy, 83% AUC)
- Test coverage improved to 3,219 tests
- Pure functions extracted from pyramiding, risk-manager, trailing-stop

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
