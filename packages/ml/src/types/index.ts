export interface TechnicalFeatureSet {
  rsi_2: number;
  rsi_7: number;
  rsi_14: number;
  rsi_21: number;
  rsi_change_1: number;
  rsi_change_5: number;

  macd_line: number;
  macd_signal: number;
  macd_histogram: number;
  macd_histogram_change: number;
  macd_crossover: number;

  atr_7: number;
  atr_14: number;
  atr_21: number;
  atr_percent: number;
  bb_width: number;
  bb_position: number;
  bb_percent_b: number;

  ema_9: number;
  ema_21: number;
  ema_50: number;
  ema_200: number;
  ema_9_21_cross: number;
  ema_50_200_cross: number;
  price_vs_ema_9: number;
  price_vs_ema_21: number;
  price_vs_ema_50: number;
  price_vs_ema_200: number;

  adx_value: number;
  adx_trend_strength: number;
  plus_di: number;
  minus_di: number;
  di_crossover: number;

  stoch_k: number;
  stoch_d: number;
  stoch_crossover: number;

  volume_sma_ratio: number;
  volume_change: number;
  obv_slope: number;

  cci_14: number;
  cci_20: number;
  williams_r: number;
  mfi_14: number;
  roc_12: number;

  keltner_upper: number;
  keltner_lower: number;
  keltner_position: number;

  sma_20: number;
  sma_50: number;
  sma_200: number;
  price_vs_sma_20: number;
  price_vs_sma_50: number;
  price_vs_sma_200: number;

  highest_high_20: number;
  lowest_low_20: number;
  price_channel_position: number;

  avg_true_range_normalized: number;
  price_momentum_5: number;
  price_momentum_10: number;
  price_momentum_20: number;

  candle_body_ratio: number;
  candle_upper_wick: number;
  candle_lower_wick: number;
  is_doji: number;
  is_hammer: number;
  is_engulfing: number;

  consecutive_green: number;
  consecutive_red: number;
}

export interface MarketFeatureSet {
  funding_rate: number;
  funding_rate_percentile: number;
  funding_rate_signal: number;

  open_interest: number;
  open_interest_change_1h: number;
  open_interest_change_24h: number;
  oi_price_divergence: number;

  taker_buy_ratio: number;
  delta_volume: number;
  delta_volume_cumulative_5: number;
  large_trade_count: number;

  fear_greed_index: number;
  fear_greed_category: number;
  fear_greed_change_7d: number;

  btc_dominance: number;
  btc_dominance_change_24h: number;
  btc_dominance_change_7d: number;

  long_liquidations_24h: number;
  short_liquidations_24h: number;
  liquidation_ratio: number;
}

export interface TemporalFeatureSet {
  hour_sin: number;
  hour_cos: number;
  day_of_week_sin: number;
  day_of_week_cos: number;
  day_of_month_sin: number;
  day_of_month_cos: number;
  month_sin: number;
  month_cos: number;

  is_asian_session: number;
  is_european_session: number;
  is_us_session: number;
  is_weekend: number;
  is_month_end: number;
  is_quarter_end: number;

  halving_cycle_progress: number;
  days_from_halving: number;
  days_to_next_halving: number;
}

export interface SetupFeatureSet {
  setup_type_encoded: number[];
  setup_direction: number;
  setup_confidence_original: number;
  risk_reward_ratio: number;
  volume_confirmation: number;
  indicator_confluence: number;

  entry_vs_ema_9: number;
  entry_vs_ema_21: number;
  entry_vs_ema_200: number;
  entry_vs_atr: number;
  stop_loss_atr_multiple: number;
  take_profit_atr_multiple: number;

  bars_since_last_setup: number;
  recent_setup_win_rate: number;
}

export interface MLFeatureVector {
  technical: TechnicalFeatureSet;
  market: MarketFeatureSet;
  temporal: TemporalFeatureSet;
  setup: SetupFeatureSet;
}

export interface NormalizedFeatureVector {
  features: Float32Array;
  featureNames: string[];
  timestamp: number;
}

export interface MarketContext {
  fundingRate?: number;
  openInterest?: number;
  openInterestChange1h?: number;
  openInterestChange24h?: number;
  fearGreedIndex?: number;
  btcDominance?: number;
  btcDominanceChange24h?: number;
  btcDominanceChange7d?: number;
  longLiquidations24h?: number;
  shortLiquidations24h?: number;
  takerBuyRatio?: number;
}

export interface PredictionResult {
  probability: number;
  confidence: number;
  label: number;
  latencyMs: number;
}

export interface ModelInfo {
  path: string;
  featureNames: string[];
  featureCount: number;
  isInitialized: boolean;
  version?: string;
  trainedAt?: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
}

export interface ClassificationMetrics extends ModelMetrics {
  confusionMatrix: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
}

export interface TradingMetrics {
  signalAccuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;

  mlEnhancedSharpe: number;
  baselineSharpe: number;
  sharpeImprovement: number;

  mlEnhancedWinRate: number;
  baselineWinRate: number;
  winRateImprovement: number;

  mlEnhancedProfitFactor: number;
  baselineProfitFactor: number;
  profitFactorImprovement: number;

  tradesFiltered: number;
  tradesAccepted: number;
  filteringRate: number;
}

export interface TradeOutcome {
  setupId: string;
  isWinner: boolean;
  pnlPercent: number;
  holdingBars: number;
  exitReason: 'take_profit' | 'stop_loss' | 'time_exit' | 'signal_exit';
}

export interface TrainingDataset {
  features: Float32Array[];
  labels: number[];
  timestamps: number[];
  setupIds: string[];
  setupTypes: string[];
  symbols: string[];
  featureNames: string[];
  metadata: {
    totalSamples: number;
    positiveCount: number;
    negativeCount: number;
    symbolDistribution: Record<string, number>;
    setupTypeDistribution: Record<string, number>;
  };
}

export interface NormalizationParams {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface FeatureNormalizationConfig {
  method: 'z-score' | 'min-max' | 'robust';
  params: Record<string, NormalizationParams>;
}

export type MLModelType = 'setup-classifier' | 'confidence-enhancer';
export type MLModelStatus = 'active' | 'archived' | 'training';

export interface ThresholdConfig {
  minProbability: number;
  minConfidence: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  minProbability: 0.5,
  minConfidence: 50,
};
