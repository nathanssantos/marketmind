export const MODEL_TYPES = ['setup-classifier', 'confidence-enhancer'] as const;

export const DEFAULT_MODEL_CONFIG = {
  setupClassifier: {
    name: 'setup-classifier',
    version: 'v1',
    type: 'setup-classifier' as const,
    threshold: 0.5,
    confidenceWeight: 0.4,
  },
  confidenceEnhancer: {
    name: 'confidence-enhancer',
    version: 'v1',
    type: 'confidence-enhancer' as const,
    blendWeight: 0.4,
  },
} as const;

export const INFERENCE_CONFIG = {
  maxLatencyMs: 50,
  warmupIterations: 3,
  batchSize: 100,
  memoryLimitMB: 100,
} as const;

export const TRAINING_CONFIG = {
  defaultSplit: 0.8,
  cvFolds: 5,
  earlyStoppingRounds: 50,
  randomSeed: 42,
} as const;

export const XGBOOST_DEFAULTS = {
  nEstimators: 500,
  maxDepth: 6,
  learningRate: 0.1,
  subsample: 0.8,
  colsampleBytree: 0.8,
  minChildWeight: 1,
  regAlpha: 0,
  regLambda: 1,
} as const;

export const LIGHTGBM_DEFAULTS = {
  nEstimators: 500,
  maxDepth: 6,
  learningRate: 0.1,
  subsample: 0.8,
  colsampleBytree: 0.8,
  minChildSamples: 20,
  regAlpha: 0,
  regLambda: 0,
} as const;

export const NORMALIZATION_CONFIG = {
  defaultMethod: 'z-score' as const,
  clipOutliers: true,
  outlierStdThreshold: 5,
  minVariance: 1e-6,
} as const;

export const EVALUATION_THRESHOLDS = {
  minAccuracy: 0.65,
  minPrecision: 0.60,
  minRecall: 0.55,
  minF1: 0.55,
  minAUC: 0.65,
  winRateImprovementTarget: 0.05,
  sharpeImprovementTarget: 0.1,
} as const;

export const MODEL_REGISTRY_CONFIG = {
  maxModelsPerType: 10,
  autoArchiveAfterDays: 90,
  minEvaluationSamples: 100,
} as const;

export const ONNX_CONFIG = {
  opsetVersion: 15,
  executionProviders: ['cpu'] as const,
  graphOptimizationLevel: 'all' as const,
  enableCpuMemArena: true,
  enableMemPattern: true,
} as const;

export const FEATURE_CACHE_CONFIG = {
  defaultTTLMinutes: 60,
  maxCacheSize: 10000,
  cleanupIntervalMinutes: 15,
} as const;

export const DRIFT_DETECTION_CONFIG = {
  windowSize: 1000,
  psiThreshold: 0.2,
  ksTestPValue: 0.05,
  checkIntervalHours: 24,
} as const;
