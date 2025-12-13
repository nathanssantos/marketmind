# Optimization System Improvements Plan

**Status:** 🔄 In Progress
**Created:** 2025-12-13
**Related:** [ML_IMPLEMENTATION_PLAN.md](./ML_IMPLEMENTATION_PLAN.md) Phase 9

---

## Overview

This plan details improvements to the existing optimization system to create a comprehensive pipeline that combines:
1. **ML Threshold Calibration** - Per-timeframe optimization of model probability thresholds
2. **Pyramiding Optimization** - Grid search on pyramid entry parameters
3. **Trailing Stop Tuning** - Optimize breakeven and trailing distance settings
4. **Walk-Forward Validation** - Prevent overfitting with out-of-sample testing

---

## Current System Analysis

### What Already Exists

| Component | File | Status |
|-----------|------|--------|
| BacktestOptimizer | `apps/backend/src/services/backtesting/BacktestOptimizer.ts` | ✅ Complete |
| WalkForwardOptimizer | `apps/backend/src/services/backtesting/WalkForwardOptimizer.ts` | ✅ Complete |
| ParameterGenerator | `apps/backend/src/services/backtesting/ParameterGenerator.ts` | ✅ Complete |
| optimize CLI | `apps/backend/src/cli/commands/optimize.ts` | ✅ Complete |
| PyramidingService | `apps/backend/src/services/pyramiding.ts` | ✅ Configurable |
| Trailing stop logic | `apps/backend/src/services/auto-trading-scheduler.ts` | 🟡 Hardcoded |

### Existing Presets (optimize.ts)

```typescript
{
  conservative: {
    trailingATRMultiplier: [2, 2.5, 3],
    breakEvenAfterR: [1, 1.5],
    maxPositionSize: [10, 20, 30],
    maxConcurrentPositions: [3, 5],
    maxTotalExposure: [30, 50],
  },
  balanced: {
    trailingATRMultiplier: [2.5, 3, 3.5, 4],
    breakEvenAfterR: [1.5, 2],
    maxPositionSize: [30, 50, 70],
    maxConcurrentPositions: [1, 2, 3],
    maxTotalExposure: [50, 70],
  },
  aggressive: {
    trailingATRMultiplier: [3, 4, 5],
    breakEvenAfterR: [2, 2.5, 3],
    maxPositionSize: [60, 80, 100],
    maxConcurrentPositions: [1, 2],
    maxTotalExposure: [70, 90],
  },
}
```

---

## Implementation Plan

### Phase 1: Make Constants Configurable ✅

**File:** `apps/backend/src/services/pyramiding.ts`

- [x] Export `PyramidConfig` interface
- [x] Export `DEFAULT_PYRAMIDING_CONFIG` constant
- [x] Add `updateConfig()` and `getConfig()` methods to service
- [x] Replace hardcoded constants with configurable values

**File:** `packages/types/src/backtesting.ts`

- [x] Add `PyramidingConfig` type
- [x] Add `TrailingStopConfig` type
- [x] Add `TimeframeThreshold` type
- [x] Add `FullSystemOptimizationConfig` type
- [x] Add `OptimizationResult` and related types

### Phase 2: Create Trailing Stop Service

**File:** `apps/backend/src/services/trailing-stop.ts` (New)

```typescript
export interface TrailingStopConfig {
  breakevenProfitThreshold: number;   // default 0.005 (0.5%)
  minTrailingDistancePercent: number; // default 0.002 (0.2%)
  swingLookback: number;              // default 3
  useATRMultiplier: boolean;          // default false
  atrMultiplier: number;              // default 2.5
}

export const DEFAULT_TRAILING_STOP_CONFIG: TrailingStopConfig = {
  breakevenProfitThreshold: 0.005,
  minTrailingDistancePercent: 0.002,
  swingLookback: 3,
  useATRMultiplier: false,
  atrMultiplier: 2.5,
};
```

### Phase 3: Create FullSystemOptimizer Service

**File:** `apps/backend/src/services/backtesting/FullSystemOptimizer.ts` (New)

Orchestrates the full optimization pipeline:

1. Generate parameter combinations
2. Run grid search with BacktestOptimizer
3. Validate top N results with WalkForwardOptimizer
4. Return robust parameter sets with degradation metrics

```typescript
class FullSystemOptimizer {
  async optimize(config: FullSystemOptimizationConfig): Promise<OptimizationResult>;
  async generateCombinations(config: FullSystemOptimizationConfig): Combination[];
  async runGridSearch(combinations: Combination[]): OptimizationResultEntry[];
  async validateWithWalkForward(topResults: OptimizationResultEntry[]): WalkForwardResult[];
  async calibrateThresholds(interval: string): TimeframeThreshold;
}
```

### Phase 4: Create CLI Command

**File:** `apps/backend/src/cli/commands/optimize-full-system.ts` (New)

```bash
pnpm exec tsx src/cli/backtest-runner.ts optimize-full \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-10-01 \
  --preset balanced \
  --parallel 4 \
  --export results/
```

**Presets:**

| Preset | Combinations | Walk-Forward | Top N |
|--------|--------------|--------------|-------|
| quick | 64 | No | - |
| balanced | 256-432 | Yes | 10 |
| thorough | 1024 | Yes | 20 |

### Phase 5: Per-Timeframe ML Threshold Constants

**File:** `packages/ml/src/constants/optimizedThresholds.ts` (New)

```typescript
export const ML_THRESHOLDS_BY_TIMEFRAME: Record<string, TimeframeThreshold> = {
  '1m':  { minProbability: 0.10, minConfidence: 70 },
  '5m':  { minProbability: 0.08, minConfidence: 65 },
  '15m': { minProbability: 0.07, minConfidence: 60 },
  '30m': { minProbability: 0.06, minConfidence: 55 },
  '1h':  { minProbability: 0.05, minConfidence: 50 },
  '4h':  { minProbability: 0.05, minConfidence: 50 },
  '1d':  { minProbability: 0.04, minConfidence: 45 },
  '1w':  { minProbability: 0.03, minConfidence: 40 },
};

export const getThresholdForTimeframe = (interval: string): TimeframeThreshold => {
  return ML_THRESHOLDS_BY_TIMEFRAME[interval] || ML_THRESHOLDS_BY_TIMEFRAME['1h'];
};
```

### Phase 6: Integration with Auto-Trading

**File:** `apps/backend/src/services/auto-trading-scheduler.ts`

Modify ML filtering to use calibrated thresholds:

```typescript
import { getThresholdForTimeframe } from '@marketmind/ml';

// In processSetup():
const threshold = getThresholdForTimeframe(watcher.interval);
if (mlPrediction.probability < threshold.minProbability) {
  logger.info({ probability: mlPrediction.probability, threshold }, 'ML filtered out setup');
  return;
}
```

---

## Parameter Grid (Balanced Preset)

### ML Thresholds
- `mlMinProbability`: [0.03, 0.05, 0.07, 0.10] = 4 values

### Pyramiding
- `profitThreshold`: [0.005, 0.01, 0.015] = 3 values
- `scaleFactor`: [0.7, 0.8, 0.9] = 3 values
- `maxEntries`: [3, 5] = 2 values

### Trailing Stop
- `breakevenThreshold`: [0.003, 0.005, 0.007] = 3 values
- `minDistance`: [0.001, 0.002] = 2 values

**Total Combinations:** 4 × 3 × 3 × 2 × 3 × 2 = **432**

---

## Walk-Forward Configuration

| Parameter | Value |
|-----------|-------|
| Training Window | 6 months |
| Testing Window | 2 months |
| Step Size | 2 months |
| Minimum Windows | 3 |
| Max Degradation | 30% |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Out-of-sample Sharpe | > In-sample × 0.7 |
| Win rate improvement | > 5% vs baseline |
| Drawdown reduction | > 10% |
| Profit factor | > 1.5 |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/services/pyramiding.ts` | ✅ Modified | Made constants configurable |
| `packages/types/src/backtesting.ts` | ✅ Modified | Added optimization types |
| `apps/backend/src/services/trailing-stop.ts` | ⏳ Create | Configurable trailing stop service |
| `apps/backend/src/services/backtesting/FullSystemOptimizer.ts` | ⏳ Create | Orchestrator service |
| `apps/backend/src/cli/commands/optimize-full-system.ts` | ⏳ Create | CLI command |
| `packages/ml/src/constants/optimizedThresholds.ts` | ⏳ Create | Per-timeframe thresholds |
| `apps/backend/src/services/auto-trading-scheduler.ts` | ⏳ Modify | Use calibrated thresholds |

---

## Output Files

When optimization completes, generate:

```
apps/backend/optimization-results/
├── optimization_results.json      # All results with metrics
├── best_params.json               # Top 5 robust parameter sets
├── threshold_calibration.json     # Per-timeframe thresholds
└── walkforward_report.md          # Validation summary
```

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Configurable constants | ✅ Done |
| Phase 2: Trailing stop service | 30 min |
| Phase 3: FullSystemOptimizer | 2 hours |
| Phase 4: CLI command | 1 hour |
| Phase 5: Threshold calibration | 30 min |
| Phase 6: Integration | 30 min |
| Testing & validation | 1 hour |

**Total Implementation:** ~6 hours
**Optimization Runtime:** 6-8 hours compute

---

## References

- [OPTIMIZATION_PIPELINE_PLAN.md](./OPTIMIZATION_PIPELINE_PLAN.md) - Original 8-phase plan
- [ML_IMPLEMENTATION_PLAN.md](./ML_IMPLEMENTATION_PLAN.md) - ML integration plan (Phase 9)
- [BacktestOptimizer.ts](../apps/backend/src/services/backtesting/BacktestOptimizer.ts) - Existing grid search
- [WalkForwardOptimizer.ts](../apps/backend/src/services/backtesting/WalkForwardOptimizer.ts) - Walk-forward validation
