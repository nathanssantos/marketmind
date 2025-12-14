export const ML_VERSION = '0.2.0';

export * from './types';
export * from './constants';
export * from './features';
export * from './training';
export * from './inference';
export * from './models';
export * from './evaluation';

export type {
  TechnicalFeatureSet,
  MarketFeatureSet,
  TemporalFeatureSet,
  SetupFeatureSet,
  MLFeatureVector,
  NormalizedFeatureVector,
  MarketContext,
  PredictionResult,
  ModelInfo,
  ModelMetrics,
  ClassificationMetrics,
  TradingMetrics,
  TradeOutcome,
  TrainingDataset,
  NormalizationParams,
  FeatureNormalizationConfig,
  MLModelType,
  MLModelStatus,
  ThresholdConfig,
} from './types';

export { DEFAULT_THRESHOLDS } from './types';

export {
  TechnicalFeatures,
  MarketFeatures,
  TemporalFeatures,
  SetupFeatures,
  Normalizer,
  LabelGenerator,
  FeatureExtractor,
} from './features';

export type { FeatureConfig } from './features';

export {
  RSI_PERIODS,
  ATR_PERIODS,
  EMA_PERIODS,
  SMA_PERIODS,
  MACD_CONFIG,
  BOLLINGER_CONFIG,
  STOCHASTIC_CONFIG,
  ADX_PERIOD,
  TECHNICAL_FEATURE_NAMES,
  MARKET_FEATURE_NAMES,
  TEMPORAL_FEATURE_NAMES,
  SETUP_FEATURE_NAMES,
  ALL_FEATURE_NAMES,
  TOTAL_FEATURE_COUNT,
} from './constants/featureConfig';

export {
  MODEL_TYPES,
  DEFAULT_MODEL_CONFIG,
  INFERENCE_CONFIG,
  TRAINING_CONFIG,
  XGBOOST_DEFAULTS,
  LIGHTGBM_DEFAULTS,
  NORMALIZATION_CONFIG,
  EVALUATION_THRESHOLDS,
  MODEL_REGISTRY_CONFIG,
  ONNX_CONFIG,
  FEATURE_CACHE_CONFIG,
  DRIFT_DETECTION_CONFIG,
} from './constants/modelConfig';

export {
  ML_THRESHOLDS_BY_TIMEFRAME,
  getThresholdForTimeframe,
  updateThresholdForTimeframe,
  setThresholdsFromOptimization,
  getAllThresholds,
  OPTIMIZED_STRATEGY_CONFIGS,
  getOptimizedConfigsForStrategy,
  getOptimizedConfigsForSymbol,
  getOptimizedConfigsForInterval,
  getOptimizedConfigsByTier,
  getOptimizedConfig,
  isOptimizedCombination,
} from './constants/optimizedThresholds';

export type { OptimizedStrategyConfig } from './constants/optimizedThresholds';

export {
  DatasetBuilder,
  TrainingConfigBuilder,
  createDefaultTrainingConfig,
  createConservativeTrainingConfig,
  DEFAULT_XGBOOST_CONFIG,
  DEFAULT_LIGHTGBM_CONFIG,
  CONSERVATIVE_XGBOOST_CONFIG,
  AGGRESSIVE_XGBOOST_CONFIG,
} from './training';

export type {
  DatasetConfig,
  BacktestResult,
  TrainingConfig,
  XGBoostConfig,
  LightGBMConfig,
} from './training';

export {
  InferenceEngine,
  XGBoostInferenceEngine,
  BatchPredictor,
  RealtimePredictor,
} from './inference';

export type {
  InferenceEngineConfig,
  XGBoostInferenceConfig,
  BatchPredictorConfig,
  BatchPredictionInput,
  BatchPredictionResult,
  RealtimePredictorConfig,
  EnhancedSetup,
} from './inference';

export { ModelRegistry, ModelLoader } from './models';

export type {
  RegisteredModel,
  ModelRegistryConfig,
  ModelManifest,
  ModelLoaderConfig,
} from './models';

export {
  ClassificationEvaluator,
  TradingMetricsEvaluator,
  BacktestMLEvaluator,
  DEFAULT_EVALUATION_CONFIG,
  calculateAccuracy,
  calculatePrecision,
  calculateRecall,
  calculateF1Score,
} from './evaluation';

export type {
  ClassificationReport,
  ROCPoint,
  BacktestEvaluationConfig,
  BacktestEvaluationInput,
  BacktestEvaluationResult,
  SetupWithPrediction,
  EvaluationResult,
  ConfusionMatrix,
} from './evaluation';
