# Plan: End-to-End ML + Trading System Optimization Pipeline

## Overview

Pipeline completo de otimização que combina:
1. ML model training com dados consolidados multi-timeframe
2. Grid search nos parâmetros do sistema de trading (pyramiding, trailing stops)
3. Walk-forward validation para evitar overfitting
4. Calibração de thresholds ML por timeframe

## Prerequisites

- Training data já gerado: 1w, 1d, 4h, 1h, 30m, 15m, 5m, 1m
- 1m em geração (será o maior arquivo)
- Total estimado: ~1M+ samples

## Implementation Steps

### Phase 1: Data Consolidation
**Files:** `packages/ml/scripts/concatenate_training.sh`

1. Concatenar todos os CSVs mantendo header único
2. Adicionar coluna `interval` para identificar timeframe
3. Verificar integridade (sem NaN, linhas duplicadas)
4. Output: `training_unified.csv` (~500-600MB)

### Phase 2: Train Unified XGBoost Model
**Files:** `packages/ml/scripts/train_setup_classifier.py`

1. Train/test split temporal (80/20)
2. Walk-forward cross-validation (5 folds)
3. Export JSON model + ONNX
4. Salvar feature importance

### Phase 3: Create Optimization CLI Command
**Files:** `apps/backend/src/cli/commands/optimize-full-system.ts`

Novo comando que otimiza o sistema completo:

```bash
pnpm exec tsx src/cli/optimize-full-system.ts \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 --end 2024-10-01 \
  --preset balanced
```

### Phase 4: Grid Search Parameters

**ML Thresholds (por timeframe):**
- `mlMinProbability`: [0.03, 0.05, 0.07, 0.10]
- `mlMinConfidence`: [40, 50, 60, 70]

**Pyramiding:**
- `PYRAMID_PROFIT_THRESHOLD`: [0.005, 0.01, 0.015, 0.02]
- `PYRAMID_SCALE_FACTOR`: [0.6, 0.7, 0.8, 0.9]
- `PYRAMID_MAX_ENTRIES`: [3, 4, 5, 6]

**Trailing Stop:**
- `BREAKEVEN_PROFIT_THRESHOLD`: [0.003, 0.005, 0.007, 0.01]
- `MIN_TRAILING_DISTANCE_PERCENT`: [0.001, 0.002, 0.003]
- `SWING_LOOKBACK`: [2, 3, 4, 5]

**Position Sizing:**
- `maxPositionSize`: [30, 50, 70, 90]
- `maxConcurrentPositions`: [3, 5, 7]

### Phase 5: Walk-Forward Validation
**Files:** Extend `WalkForwardOptimizer.ts`

Config:
- Training window: 6 months
- Testing window: 2 months
- Step: 2 months
- Min windows: 3

Output:
- In-sample Sharpe
- Out-of-sample Sharpe
- Degradation %
- Robustness assessment

### Phase 6: Per-Timeframe ML Threshold Calibration

Criar tabela de thresholds otimizados:

```typescript
// packages/ml/src/constants/optimizedThresholds.ts
export const ML_THRESHOLDS_BY_TIMEFRAME = {
  '1m': { minProbability: 0.10, minConfidence: 70 },
  '5m': { minProbability: 0.08, minConfidence: 65 },
  '15m': { minProbability: 0.07, minConfidence: 60 },
  '30m': { minProbability: 0.06, minConfidence: 55 },
  '1h': { minProbability: 0.05, minConfidence: 50 },
  '4h': { minProbability: 0.05, minConfidence: 50 },
  '1d': { minProbability: 0.04, minConfidence: 45 },
  '1w': { minProbability: 0.03, minConfidence: 40 },
} as const;
```

### Phase 7: Integration with Auto-Trading Scheduler

Modificar `auto-trading-scheduler.ts` para usar thresholds calibrados:

```typescript
const threshold = ML_THRESHOLDS_BY_TIMEFRAME[watcher.interval];
if (mlPrediction.probability < threshold.minProbability) {
  log('⚠️ ML filtered out setup', { probability, threshold });
  return;
}
```

### Phase 8: Results Export & Visualization

Output files:
- `optimization_results.json` - Todos os resultados
- `best_params.json` - Melhores parâmetros
- `threshold_calibration.json` - Thresholds por timeframe
- `walkforward_report.md` - Relatório de validação

## Critical Files to Modify

| File | Changes |
|------|---------|
| `packages/ml/scripts/concatenate_training.sh` | New - concatena CSVs |
| `apps/backend/src/cli/commands/optimize-full-system.ts` | New - CLI command |
| `apps/backend/src/services/backtesting/FullSystemOptimizer.ts` | New - orchestrator |
| `packages/ml/src/constants/optimizedThresholds.ts` | New - threshold table |
| `apps/backend/src/services/pyramiding.ts` | Make constants configurable |
| `apps/backend/src/services/trailing-stop.ts` | Make constants configurable |
| `apps/backend/src/services/auto-trading-scheduler.ts` | Use calibrated thresholds |

## Expected Outcomes

1. **ML Model**: Unified model covering all timeframes
2. **Pyramiding Params**: Optimized per volatility profile
3. **Trailing Stop**: Calibrated for market structure
4. **ML Thresholds**: Per-timeframe calibration
5. **Validation**: Walk-forward proof of robustness

## Success Metrics

- Out-of-sample Sharpe > In-sample × 0.7 (max 30% degradation)
- Win rate improvement > 5% vs baseline
- Drawdown reduction > 10%
- Profit factor > 1.5

## Timeline Estimate

- Phase 1-2: Data + Model training (1-2 hours)
- Phase 3-5: CLI + Grid Search + Validation (3-4 hours)
- Phase 6-7: Threshold calibration + Integration (1-2 hours)
- Phase 8: Results export (30 min)

Total: ~6-8 hours of compute time
