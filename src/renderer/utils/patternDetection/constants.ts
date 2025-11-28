/* eslint-disable no-magic-numbers */
export const PATTERN_DETECTION_CONFIG = {
  PIVOT_LOOKBACK_DEFAULT: 5,
  PIVOT_LOOKAHEAD_DEFAULT: 5,
  PIVOT_LOOKBACK_MIN: 3,
  PIVOT_LOOKBACK_MAX: 10,
  
  PRICE_TOLERANCE_PERCENT: 1.5,
  TIME_TOLERANCE_CANDLES: 5,
  
  MIN_TOUCHES_SUPPORT: 2,
  MIN_TOUCHES_RESISTANCE: 2,
  STRONG_LEVEL_TOUCHES: 5,
  
  MIN_PIVOTS_TRENDLINE: 2,
  PREFERRED_PIVOTS_TRENDLINE: 3,
  MAX_TRENDLINE_DEVIATION: 0.04,
  
  MIN_CHANNEL_TOUCHES: 4,
  PARALLEL_TOLERANCE: 0.2,
  
  SHOULDER_HEIGHT_TOLERANCE: 0.08,
  DOUBLE_TOP_TOLERANCE: 0.05,
  TRIPLE_TOP_TOLERANCE: 0.08,
  
  VOLUME_SPIKE_THRESHOLD: 1.5,
  VOLUME_PERIOD: 20,
  
  MIN_CONFIDENCE_THRESHOLD: 0.3,
  HIGH_CONFIDENCE_THRESHOLD: 0.65,
  
  MIN_PATTERN_FORMATION_CANDLES: 10,
  IDEAL_PATTERN_FORMATION_CANDLES: 50,
  MIN_PATTERN_PRICE_RANGE_PERCENT: 3,
  
  GAP_MIN_PERCENT: 0.5,
  
  FIBONACCI_LEVELS: [0.236, 0.382, 0.5, 0.618, 0.786],
  FIBONACCI_EXTENSION_LEVELS: [1.272, 1.618, 2.0, 2.618],
  FIBONACCI_TOLERANCE: 0.01,
  
  MAX_PATTERNS_PER_TYPE: 5,
  DETECTION_DEBOUNCE_MS: 500,
} as const;

export const PATTERN_RELIABILITY_WEIGHTS: Record<string, number> = {
  'head-and-shoulders': 0.89,
  'inverse-head-and-shoulders': 0.89,
  'double-bottom': 0.88,
  'triple-bottom': 0.87,
  'triangle-descending': 0.87,
  'double-top': 0.85,
  'triple-top': 0.85,
  'triangle-ascending': 0.83,
  'support': 0.80,
  'resistance': 0.80,
  'trendline-bullish': 0.75,
  'trendline-bearish': 0.75,
  'triangle-symmetrical': 0.70,
  'flag-bullish': 0.68,
  'flag-bearish': 0.68,
  'pennant': 0.68,
  'wedge-rising': 0.65,
  'wedge-falling': 0.65,
  'channel-ascending': 0.70,
  'channel-descending': 0.70,
  'channel-horizontal': 0.70,
  'cup-and-handle': 0.75,
  'rounding-bottom': 0.72,
  'fibonacci-retracement': 0.65,
  'fibonacci-extension': 0.60,
  'gap-common': 0.40,
  'gap-breakaway': 0.55,
  'gap-runaway': 0.50,
  'gap-exhaustion': 0.45,
  'liquidity-zone': 0.70,
  'sell-zone': 0.70,
  'buy-zone': 0.70,
  'accumulation-zone': 0.70,
} as const;

export const IMPORTANCE_WEIGHTS = {
  PATTERN_RELIABILITY: 0.30,
  FORMATION_PERIOD: 0.25,
  CONFIDENCE: 0.20,
  VOLUME_CONFIRMATION: 0.15,
  PRICE_MOVEMENT: 0.05,
  RECENCY: 0.05,
} as const;

export const IMPORTANCE_NORMALIZATION = {
  FORMATION_PERIOD_MAX_CANDLES: 200,
  FORMATION_PERIOD_BASE_DIVISOR: 5,
  FORMATION_PERIOD_LOG_BASE: 40,
  PRICE_MOVEMENT_MAX_PERCENT: 20,
  PRICE_MOVEMENT_MIN_PERCENT: 1,
  PRICE_MOVEMENT_MIN_SCORE: 0.1,
  RECENCY_MAX_CANDLES: 100,
  RECENCY_MIN_SCORE: 0.1,
  DEFAULT_RELIABILITY: 0.5,
  DEFAULT_CONFIDENCE: 0.5,
} as const;
