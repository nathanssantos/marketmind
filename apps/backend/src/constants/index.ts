export const REQUIRED_KLINES = 40_000;

export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

export const INTERVAL_MS: Record<string, number> = {
  '1m': TIME_MS.MINUTE,
  '3m': 3 * TIME_MS.MINUTE,
  '5m': 5 * TIME_MS.MINUTE,
  '15m': 15 * TIME_MS.MINUTE,
  '30m': 30 * TIME_MS.MINUTE,
  '1h': TIME_MS.HOUR,
  '2h': 2 * TIME_MS.HOUR,
  '4h': 4 * TIME_MS.HOUR,
  '6h': 6 * TIME_MS.HOUR,
  '8h': 8 * TIME_MS.HOUR,
  '12h': 12 * TIME_MS.HOUR,
  '1d': TIME_MS.DAY,
  '3d': 3 * TIME_MS.DAY,
  '1w': TIME_MS.WEEK,
  '1M': TIME_MS.MONTH,
} as const;

export const UNIT_MS: Record<string, number> = {
  m: TIME_MS.MINUTE,
  h: TIME_MS.HOUR,
  d: TIME_MS.DAY,
  w: TIME_MS.WEEK,
} as const;

export const TRADING_CONFIG = {
  MIN_RISK_REWARD_RATIO: 1.25,
  SESSION_DURATION_MS: 30 * TIME_MS.DAY,
  DEFAULT_SLIPPAGE_PERCENT: 0.1,
  DEFAULT_COMMISSION_PERCENT: 0.1,
} as const;

export const WEBSOCKET_CONFIG = {
  RECONNECT_DELAY_MS: 5 * TIME_MS.SECOND,
  PING_INTERVAL_MS: 30 * TIME_MS.SECOND,
  FETCH_TIMEOUT_MS: 15 * TIME_MS.SECOND,
} as const;

export const DETECTOR_CONFIG = {
  VOLUME_LOOKBACK: 20,
  BASE_CONFIDENCE: 60,
  MAX_CONFIDENCE: 100,
} as const;

export const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'] as const;

export const FLOAT_COMPARISON = {
  EPSILON: 0.0000001,
} as const;

export const POSITION_SIZING = {
  DEFAULT_MIN_PERCENT: 1,
  DEFAULT_MAX_PERCENT: 100,
  DEFAULT_RISK_PER_TRADE: 2,
  DEFAULT_KELLY_FRACTION: 0.25,
  DEFAULT_WIN_RATE: 0.5,
  DEFAULT_AVG_WIN_PERCENT: 5,
  DEFAULT_AVG_LOSS_PERCENT: 2,
  DEFAULT_ATR_MULTIPLIER: 2.0,
  DEFAULT_FIXED_PERCENT: 10,
  DEFAULT_RISK_PERCENT: 0.02,

  VOLATILITY_TARGET: {
    BASELINE_POSITION: 50,
    TARGET_ATR_PERCENT: 2.0,
  },

  KELLY_BOUNDS: {
    MIN: 0.1,
    MAX: 0.5,
  },

  KELLY_ADJUSTMENTS: {
    SMALL: 0.05,
    MEDIUM: 0.1,
    LARGE: 0.15,
  },

  DRAWDOWN_THRESHOLDS: {
    MAX: 20,
    MIN: 5,
  },

  STRATEGY_EVALUATION: {
    MIN_WIN_RATE: 30,
    MIN_PROFIT_FACTOR: 1.5,
    MIN_KELLY: 0.35,
    MAX_KELLY: 0.65,
  },
} as const;

export const EXIT_CALCULATOR = {
  DEFAULT_MULTIPLIER: 2,
  DEFAULT_PERCENTAGE: 2,
  DEFAULT_DISTANCE_PERCENT: 0.02,
  DEFAULT_SWING_BUFFER_PERCENT: 0.5,
  MIN_SWING_BUFFER_ATR: 1,
  MIN_STOP_DISTANCE_PERCENT: 1,
  DEFAULT_STOP_LOOKBACK: 5,
  DEFAULT_ENTRY_LOOKBACK: 2,
  SWING_SKIP_RECENT: 2,
  MIN_ENTRY_STOP_SEPARATION_PERCENT: 0.75,
  BASE_CONFIDENCE: 60,
  VOLUME_CONFIRMATION_BONUS: 10,
  MAX_CONFIDENCE: 95,
  DEFAULT_MAX_CONFIDENCE: 100,
  MAX_LIMIT_ENTRY_DISTANCE_PERCENT: 0.5,
  DEFAULT_ENTRY_BUFFER_ATR: 0.3,
} as const;

export const BACKTEST_ENGINE = {
  INTERVAL_SECONDS: {
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
  },
  DEFAULT_INTERVAL_MS: 4 * TIME_MS.HOUR,
  EMA200_WARMUP_BARS: 250,
  MIN_NOTIONAL_VALUE: 10,
  MAX_BARS_IN_TRADE: 100,
  COOLDOWN_BARS: 10,
} as const;

export const TRAILING_STOP = {
  BREAKEVEN_THRESHOLD: 0.01,
  FEES_COVERAGE_THRESHOLD: 0.015,
  PEAK_PROFIT_FLOOR: 0.4,
  ATR_MULTIPLIER: 0.002,
  DEFAULT_ACTIVATION_PERCENT: 1.5,
  DEFAULT_TRAIL_PERCENT: 0.75,
} as const;

export const VOLATILITY = {
  HIGH_THRESHOLD: 3.0,
  POSITION_REDUCTION: 0.5,
  LOW_THRESHOLD: 1.0,
  NORMAL_RANGE: {
    MIN: 1.0,
    MAX: 3.0,
  },
} as const;

export const PIVOT_DETECTION = {
  DEFAULT_LOOKBACK: 5,
  DEFAULT_LOOKFORWARD: 2,
  MIN_PIVOT_DISTANCE_PERCENT: 0.5,
  VOLUME_CONFIRMATION_MULTIPLIER: 1.2,
  STRENGTH_THRESHOLDS: {
    WEAK: 0.3,
    MEDIUM: 0.6,
    STRONG: 0.8,
  },
} as const;

export const CONTEXT_AGGREGATOR = {
  DEFAULT_NEWS_LOOKBACK_HOURS: 24,
  DEFAULT_EVENTS_LOOKFORWARD_DAYS: 7,
  DEFAULT_FEAR_GREED_INDEX: 50,
  DEFAULT_BTC_DOMINANCE: 50,

  SENTIMENT_THRESHOLDS: {
    BULLISH: 60,
    BEARISH: 40,
  },

  SENTIMENT_WEIGHTS: {
    NEWS: 0.7,
    FEAR_INDEX: 0.3,
  },

  SENTIMENT_SCORE_THRESHOLDS: {
    BULLISH: 0.2,
    BEARISH: -0.2,
  },

  MAX_NEWS_ARTICLES: 10,
} as const;

export const RISK_MANAGER = {
  MAX_EXPOSURE_PERCENT: 100,
  PERCENT_DIVISOR: 100,
} as const;

export const QUERY_LIMITS = {
  DEFAULT_SMALL: 50,
  DEFAULT_MEDIUM: 100,
  DEFAULT_LARGE: 500,
  MAX_SMALL: 100,
  MAX_MEDIUM: 500,
  MAX_LARGE: 1000,
  MAX_HUGE: 2000,
} as const;

export const TRADE_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export const ACTIVE_TRADE_STATUSES = [TRADE_STATUS.OPEN, TRADE_STATUS.PENDING] as const;

export const ORDER_TYPE = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP_LOSS: 'STOP_LOSS',
  STOP_LOSS_LIMIT: 'STOP_LOSS_LIMIT',
  STOP_MARKET: 'STOP_MARKET',
  TAKE_PROFIT: 'TAKE_PROFIT',
  TAKE_PROFIT_MARKET: 'TAKE_PROFIT_MARKET',
  TAKE_PROFIT_LIMIT: 'TAKE_PROFIT_LIMIT',
  LIMIT_MAKER: 'LIMIT_MAKER',
} as const;

export const MARKET_TYPE = {
  SPOT: 'SPOT',
  FUTURES: 'FUTURES',
} as const;

export const ORDER_SIDE = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export const POSITION_SIDE = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

export const EXIT_REASON = {
  STOP_LOSS: 'STOP_LOSS',
  TAKE_PROFIT: 'TAKE_PROFIT',
  NONE: 'NONE',
} as const;

export { ADX_FILTER } from '../utils/adx-filter';

export type FloatComparisonConstants = typeof FLOAT_COMPARISON;
export type PositionSizingConstants = typeof POSITION_SIZING;
export type ExitCalculatorConstants = typeof EXIT_CALCULATOR;
export type BacktestEngineConstants = typeof BACKTEST_ENGINE;
export type TrailingStopConstants = typeof TRAILING_STOP;
export type VolatilityConstants = typeof VOLATILITY;
export type PivotDetectionConstants = typeof PIVOT_DETECTION;
export type ContextAggregatorConstants = typeof CONTEXT_AGGREGATOR;
export type RiskManagerConstants = typeof RISK_MANAGER;
export type QueryLimitsConstants = typeof QUERY_LIMITS;
export type TradeStatusConstants = typeof TRADE_STATUS;
export type TradeStatus = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];
export type MarketType = (typeof MARKET_TYPE)[keyof typeof MARKET_TYPE];
export type OrderSide = (typeof ORDER_SIDE)[keyof typeof ORDER_SIDE];
export type PositionSide = (typeof POSITION_SIDE)[keyof typeof POSITION_SIDE];
export type ExitReason = (typeof EXIT_REASON)[keyof typeof EXIT_REASON];
export type DetectorConfigConstants = typeof DETECTOR_CONFIG;
export type TradingConfigConstants = typeof TRADING_CONFIG;
export type WebsocketConfigConstants = typeof WEBSOCKET_CONFIG;
export type TimeMsConstants = typeof TIME_MS;
export type IntervalMsConstants = typeof INTERVAL_MS;
export type UnitMsConstants = typeof UNIT_MS;
