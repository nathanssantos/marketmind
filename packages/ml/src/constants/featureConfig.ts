export const RSI_PERIODS = [2, 7, 14, 21] as const;
export const ATR_PERIODS = [7, 14, 21] as const;
export const EMA_PERIODS = [9, 21, 50, 200] as const;
export const SMA_PERIODS = [20, 50, 200] as const;

export const MACD_CONFIG = {
  fast: 12,
  slow: 26,
  signal: 9,
} as const;

export const BOLLINGER_CONFIG = {
  period: 20,
  stdDev: 2,
} as const;

export const STOCHASTIC_CONFIG = {
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3,
} as const;

export const ADX_PERIOD = 14;
export const CCI_PERIODS = [14, 20] as const;
export const MFI_PERIOD = 14;
export const ROC_PERIOD = 12;
export const WILLIAMS_R_PERIOD = 14;
export const OBV_SLOPE_PERIOD = 5;
export const VOLUME_SMA_PERIOD = 20;
export const MOMENTUM_PERIODS = [5, 10, 20] as const;
export const PRICE_CHANNEL_PERIOD = 20;

export const KELTNER_CONFIG = {
  emaPeriod: 20,
  atrPeriod: 10,
  multiplier: 2,
} as const;

export const TECHNICAL_FEATURE_NAMES = [
  'rsi_2', 'rsi_7', 'rsi_14', 'rsi_21', 'rsi_change_1', 'rsi_change_5',
  'macd_line', 'macd_signal', 'macd_histogram', 'macd_histogram_change', 'macd_crossover',
  'atr_7', 'atr_14', 'atr_21', 'atr_percent', 'bb_width', 'bb_position', 'bb_percent_b',
  'ema_9', 'ema_21', 'ema_50', 'ema_200', 'ema_9_21_cross', 'ema_50_200_cross',
  'price_vs_ema_9', 'price_vs_ema_21', 'price_vs_ema_50', 'price_vs_ema_200',
  'adx_value', 'adx_trend_strength', 'plus_di', 'minus_di', 'di_crossover',
  'stoch_k', 'stoch_d', 'stoch_crossover',
  'volume_sma_ratio', 'volume_change', 'obv_slope',
  'cci_14', 'cci_20', 'williams_r', 'mfi_14', 'roc_12',
  'keltner_upper', 'keltner_lower', 'keltner_position',
  'sma_20', 'sma_50', 'sma_200', 'price_vs_sma_20', 'price_vs_sma_50', 'price_vs_sma_200',
  'highest_high_20', 'lowest_low_20', 'price_channel_position',
  'avg_true_range_normalized', 'price_momentum_5', 'price_momentum_10', 'price_momentum_20',
  'candle_body_ratio', 'candle_upper_wick', 'candle_lower_wick',
  'is_doji', 'is_hammer', 'is_engulfing',
  'consecutive_green', 'consecutive_red',
] as const;

export const MARKET_FEATURE_NAMES = [
  'funding_rate', 'funding_rate_percentile', 'funding_rate_signal',
  'open_interest', 'open_interest_change_1h', 'open_interest_change_24h', 'oi_price_divergence',
  'taker_buy_ratio', 'delta_volume', 'delta_volume_cumulative_5', 'large_trade_count',
  'fear_greed_index', 'fear_greed_category', 'fear_greed_change_7d',
  'btc_dominance', 'btc_dominance_change_24h', 'btc_dominance_change_7d',
  'long_liquidations_24h', 'short_liquidations_24h', 'liquidation_ratio',
] as const;

export const TEMPORAL_FEATURE_NAMES = [
  'hour_sin', 'hour_cos', 'day_of_week_sin', 'day_of_week_cos',
  'day_of_month_sin', 'day_of_month_cos', 'month_sin', 'month_cos',
  'is_asian_session', 'is_european_session', 'is_us_session',
  'is_weekend', 'is_month_end', 'is_quarter_end',
  'halving_cycle_progress', 'days_from_halving', 'days_to_next_halving',
] as const;

export const SETUP_FEATURE_NAMES = [
  'setup_direction', 'setup_confidence_original', 'risk_reward_ratio',
  'volume_confirmation', 'indicator_confluence',
  'entry_vs_ema_9', 'entry_vs_ema_21', 'entry_vs_ema_200', 'entry_vs_atr',
  'stop_loss_atr_multiple', 'take_profit_atr_multiple',
  'bars_since_last_setup', 'recent_setup_win_rate',
] as const;

export const SETUP_TYPE_ENCODING_LENGTH = 20;

export const ALL_FEATURE_NAMES = [
  ...TECHNICAL_FEATURE_NAMES,
  ...MARKET_FEATURE_NAMES,
  ...TEMPORAL_FEATURE_NAMES,
  ...SETUP_FEATURE_NAMES,
] as const;

export const TOTAL_FEATURE_COUNT =
  TECHNICAL_FEATURE_NAMES.length +
  MARKET_FEATURE_NAMES.length +
  TEMPORAL_FEATURE_NAMES.length +
  SETUP_FEATURE_NAMES.length +
  SETUP_TYPE_ENCODING_LENGTH;

export const MARKET_SESSION_HOURS = {
  asian: { start: 0, end: 8 },
  european: { start: 7, end: 16 },
  us: { start: 13, end: 22 },
} as const;

export const BITCOIN_HALVINGS = [
  new Date('2012-11-28'),
  new Date('2016-07-09'),
  new Date('2020-05-11'),
  new Date('2024-04-20'),
] as const;

export const NEXT_HALVING_ESTIMATE = new Date('2028-04-01');
export const HALVING_CYCLE_BLOCKS = 210000;
export const AVERAGE_BLOCK_TIME_MINUTES = 10;

export const CANDLE_PATTERNS = {
  dojiThreshold: 0.1,
  hammerBodyRatio: 0.3,
  hammerWickRatio: 2,
  engulfingMinRatio: 1.1,
} as const;

export const ADX_TREND_THRESHOLDS = {
  weak: 20,
  moderate: 25,
  strong: 40,
  veryStrong: 50,
} as const;

export const FEAR_GREED_THRESHOLDS = {
  extremeFear: 25,
  fear: 45,
  neutral: 55,
  greed: 75,
  extremeGreed: 100,
} as const;
