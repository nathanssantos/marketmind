# @marketmind/ml

Machine Learning package for MarketMind trading predictions.

## Status

**🚧 Placeholder Package** - Structure only, implementation pending.

## Structure

```
packages/ml/
├── src/
│   ├── index.ts           # Package exports
│   ├── models/            # ML model definitions
│   ├── training/          # Training pipelines
│   ├── evaluation/        # Model evaluation
│   └── deployment/        # Model serving
├── package.json
├── tsconfig.json
└── README.md
```

## Planned Features

### Models
- XGBoost for setup selection
- LightGBM for price direction prediction
- Random Forest for feature importance
- Ensemble methods

### Training
- Automated feature extraction from `@marketmind/indicators`
- Cross-validation with time-series split
- Hyperparameter optimization
- Walk-forward training

### Evaluation
- Classification metrics (accuracy, precision, recall, F1)
- Regression metrics (RMSE, MAE, R²)
- Backtesting integration
- A/B testing framework

### Deployment
- Model versioning and registry
- Real-time prediction API
- Model monitoring and drift detection
- Automated retraining triggers

## Dependencies

- `@marketmind/types` - Shared type definitions
- `@marketmind/indicators` - Technical indicators for features

## Usage (Future)

```typescript
import { trainModel, predict } from '@marketmind/ml';

// Train a model
const model = await trainModel({
  features: ['rsi', 'macd', 'volume'],
  target: 'direction',
  modelType: 'xgboost',
});

// Make predictions
const prediction = await predict(model, currentFeatures);
```

## Documentation

See [ML_FEATURES.md](../../docs/ML_FEATURES.md) for available features.
