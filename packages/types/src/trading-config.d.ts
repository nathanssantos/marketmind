export declare const TRADING_DEFAULTS: {
    readonly MIN_RISK_REWARD_RATIO: 1;
    readonly EXPOSURE_MULTIPLIER: 1.75;
    readonly MAX_POSITION_SIZE_PERCENT: 10;
    readonly DAILY_LOSS_LIMIT_PERCENT: 5;
    readonly COOLDOWN_MINUTES: 15;
    readonly MAX_CONCURRENT_POSITIONS: 3;
    readonly INITIAL_CAPITAL: 10000;
    readonly MIN_TRADE_VALUE_USD: 1;
    readonly SLIPPAGE_PERCENT: 0.1;
    readonly SESSION_DURATION_MS: number;
};
export declare const CAPITAL_RULES: {
    readonly MAX_POSITION_CAPITAL_RATIO: 5;
    readonly SAFETY_MARGIN: 1.1;
    readonly MIN_NOTIONAL_FUTURES: 5;
    readonly MIN_NOTIONAL_SPOT: 10;
};
export declare const TRAILING_STOP_CONFIG: {
    readonly BREAKEVEN_THRESHOLD: 0.01;
    readonly FEES_COVERAGE_THRESHOLD: 0.015;
    readonly PEAK_PROFIT_FLOOR: 0.4;
    readonly ATR_MULTIPLIER: 0.002;
    readonly DEFAULT_ACTIVATION_PERCENT: 1.5;
    readonly DEFAULT_TRAIL_PERCENT: 0.75;
    readonly TP_THRESHOLD_FOR_BREAKEVEN: 0.5;
    readonly TP_THRESHOLD_FOR_ADVANCED: 0.7;
    readonly MIN_STOP_CHANGE_ABSOLUTE: 0.005;
    readonly STOP_OFFSET_LONG: 0.99;
    readonly STOP_OFFSET_LONG_TIGHT: 0.98;
    readonly STOP_OFFSET_SHORT: 1.01;
    readonly STOP_OFFSET_SHORT_TIGHT: 1.02;
    readonly NEAR_BREAKEVEN_THRESHOLD: 0.995;
    readonly FIBO_BREAKEVEN_LEVEL: 1.272;
    readonly FIBO_PROGRESSIVE_LEVEL: 1.272;
    readonly TP_PROGRESS_THRESHOLD_LONG: 1.0;
    readonly TP_PROGRESS_THRESHOLD_SHORT: 0.886;
};
export declare const OPPORTUNITY_COST_CONFIG: {
    readonly DEFAULT_MAX_HOLDING_PERIOD_BARS: 20;
    readonly DEFAULT_STALE_THRESHOLD_PERCENT: 0.5;
    readonly DEFAULT_TIGHTEN_AFTER_BARS: 10;
    readonly DEFAULT_TIGHTEN_PERCENT_PER_BAR: 5;
    readonly MAX_LOCK_PERCENT: 80;
    readonly ALERT_COOLDOWN_MS: 3600000;
    readonly STALE_TRADE_ACTIONS: {
        readonly ALERT_ONLY: "ALERT_ONLY";
        readonly TIGHTEN_STOP: "TIGHTEN_STOP";
        readonly AUTO_CLOSE: "AUTO_CLOSE";
    };
};
export declare const BACKTEST_ENGINE_CONFIG: {
    readonly INTERVAL_SECONDS: {
        readonly MINUTE: 60;
        readonly HOUR: 3600;
        readonly DAY: 86400;
        readonly WEEK: 604800;
    };
    readonly DEFAULT_INTERVAL_MS: number;
    readonly EMA200_WARMUP_BARS: 250;
    readonly MIN_NOTIONAL_VALUE: 10;
    readonly MAX_BARS_IN_TRADE: 100;
    readonly COOLDOWN_BARS: 10;
};
export declare const POSITION_SIZING_CONFIG: {
    readonly DEFAULT_MIN_PERCENT: 1;
    readonly DEFAULT_MAX_PERCENT: 100;
    readonly DEFAULT_RISK_PER_TRADE: 2;
    readonly DEFAULT_KELLY_FRACTION: 0.25;
    readonly DEFAULT_WIN_RATE: 0.5;
    readonly DEFAULT_AVG_WIN_PERCENT: 5;
    readonly DEFAULT_AVG_LOSS_PERCENT: 2;
    readonly DEFAULT_ATR_MULTIPLIER: 2;
    readonly DEFAULT_FIXED_PERCENT: 10;
    readonly DEFAULT_RISK_PERCENT: 0.02;
    readonly VOLATILITY_TARGET: {
        readonly BASELINE_POSITION: 50;
        readonly TARGET_ATR_PERCENT: 2;
    };
    readonly KELLY_BOUNDS: {
        readonly MIN: 0.1;
        readonly MAX: 0.5;
    };
    readonly KELLY_ADJUSTMENTS: {
        readonly SMALL: 0.05;
        readonly MEDIUM: 0.1;
        readonly LARGE: 0.15;
    };
    readonly DRAWDOWN_THRESHOLDS: {
        readonly MAX: 20;
        readonly MIN: 5;
    };
    readonly STRATEGY_EVALUATION: {
        readonly MIN_WIN_RATE: 30;
        readonly MIN_PROFIT_FACTOR: 1.5;
        readonly MIN_KELLY: 0.35;
        readonly MAX_KELLY: 0.65;
    };
};
export declare const EXIT_CALCULATOR_CONFIG: {
    readonly DEFAULT_MULTIPLIER: 2;
    readonly DEFAULT_PERCENTAGE: 2;
    readonly DEFAULT_DISTANCE_PERCENT: 0.02;
    readonly DEFAULT_SWING_BUFFER_PERCENT: 0.5;
    readonly MIN_SWING_BUFFER_ATR: 1;
    readonly MIN_STOP_DISTANCE_PERCENT: 1;
    readonly DEFAULT_STOP_LOOKBACK: 5;
    readonly DEFAULT_ENTRY_LOOKBACK: 2;
    readonly SWING_SKIP_RECENT: 3;
    readonly MIN_ENTRY_STOP_SEPARATION_PERCENT: 0.75;
    readonly BASE_CONFIDENCE: 60;
    readonly VOLUME_CONFIRMATION_BONUS: 10;
    readonly MAX_CONFIDENCE: 95;
    readonly DEFAULT_MAX_CONFIDENCE: 100;
    readonly MAX_LIMIT_ENTRY_DISTANCE_PERCENT: 0.5;
    readonly DEFAULT_ENTRY_BUFFER_ATR: 0.3;
    readonly MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT: 78.6;
};
export declare const VOLATILITY_CONFIG: {
    readonly HIGH_THRESHOLD: 3;
    readonly POSITION_REDUCTION: 0.5;
    readonly LOW_THRESHOLD: 1;
    readonly NORMAL_RANGE: {
        readonly MIN: 1;
        readonly MAX: 3;
    };
};
export declare const PIVOT_DETECTION_CONFIG: {
    readonly DEFAULT_LOOKBACK: 5;
    readonly DEFAULT_LOOKFORWARD: 2;
    readonly MIN_PIVOT_DISTANCE_PERCENT: 0.5;
    readonly VOLUME_CONFIRMATION_MULTIPLIER: 1.2;
    readonly STRENGTH_THRESHOLDS: {
        readonly WEAK: 0.3;
        readonly MEDIUM: 0.6;
        readonly STRONG: 0.8;
    };
};
export declare const DETECTOR_CONFIG: {
    readonly VOLUME_LOOKBACK: 20;
    readonly BASE_CONFIDENCE: 60;
    readonly MAX_CONFIDENCE: 100;
};
export declare const WEBSOCKET_CONFIG: {
    readonly RECONNECT_DELAY_MS: number;
    readonly PING_INTERVAL_MS: number;
    readonly FETCH_TIMEOUT_MS: number;
};
export declare const QUERY_LIMITS: {
    readonly DEFAULT_SMALL: 50;
    readonly DEFAULT_MEDIUM: 100;
    readonly DEFAULT_LARGE: 500;
    readonly MAX_SMALL: 100;
    readonly MAX_MEDIUM: 500;
    readonly MAX_LARGE: 1000;
    readonly MAX_HUGE: 2000;
};
export declare const RISK_MANAGER_CONFIG: {
    readonly MAX_EXPOSURE_PERCENT: 100;
    readonly PERCENT_DIVISOR: 100;
};
export declare const FLOAT_COMPARISON: {
    readonly EPSILON: 1e-7;
};
export declare const CONTEXT_AGGREGATOR_CONFIG: {
    readonly DEFAULT_NEWS_LOOKBACK_HOURS: 24;
    readonly DEFAULT_EVENTS_LOOKFORWARD_DAYS: 7;
    readonly DEFAULT_FEAR_GREED_INDEX: 50;
    readonly DEFAULT_BTC_DOMINANCE: 50;
    readonly SENTIMENT_THRESHOLDS: {
        readonly BULLISH: 60;
        readonly BEARISH: 40;
    };
    readonly SENTIMENT_WEIGHTS: {
        readonly NEWS: 0.7;
        readonly FEAR_INDEX: 0.3;
    };
    readonly SENTIMENT_SCORE_THRESHOLDS: {
        readonly BULLISH: 0.2;
        readonly BEARISH: -0.2;
    };
    readonly MAX_NEWS_ARTICLES: 10;
};
export declare const AUTO_TRADING_CONFIG: {
    readonly TARGET_COUNT: {
        readonly MIN: 1;
        readonly MAX: 100;
        readonly DEFAULT: 10;
    };
    readonly LEVERAGE: {
        readonly MIN: 1;
        readonly MAX: 125;
        readonly DEFAULT: 1;
    };
    readonly CONCURRENT_POSITIONS: {
        readonly MIN: 1;
        readonly MAX: 20;
        readonly DEFAULT: 3;
    };
    readonly PYRAMID_ENTRIES: {
        readonly MIN: 1;
        readonly MAX: 10;
        readonly DEFAULT: 5;
    };
    readonly HOLDING_PERIOD_BARS: {
        readonly MIN: 5;
        readonly MAX: 100;
        readonly DEFAULT: 20;
    };
    readonly TIGHTEN_AFTER_BARS: {
        readonly MIN: 1;
        readonly MAX: 50;
        readonly DEFAULT: 10;
    };
    readonly ADX_THRESHOLD: {
        readonly MIN: 10;
        readonly MAX: 50;
        readonly DEFAULT: 25;
    };
    readonly RSI_BOUNDS: {
        readonly LOWER: {
            readonly MIN: 20;
            readonly MAX: 50;
            readonly DEFAULT: 30;
        };
        readonly UPPER: {
            readonly MIN: 50;
            readonly MAX: 80;
            readonly DEFAULT: 70;
        };
    };
    readonly SYMBOL_FETCH_MULTIPLIER: 2;
    readonly MIN_SYMBOL_FETCH: 100;
};
export type AutoTradingConfigConstants = typeof AUTO_TRADING_CONFIG;
export declare const STABLECOINS: readonly ["USDT", "USDC", "BUSD", "DAI", "TUSD"];
export declare const FIBONACCI_TARGET_LEVELS: readonly ["auto", "1", "1.272", "1.618", "2", "2.618"];
export type FibonacciTargetLevel = (typeof FIBONACCI_TARGET_LEVELS)[number];
export declare const BACKTEST_DEFAULTS: {
    readonly LEVERAGE: 2;
    readonly MIN_CONFIDENCE: 50;
    readonly TRAILING_STOP_ATR_MULTIPLIER: 2;
};
export declare const KLINE_CONFIG: {
    readonly ABSOLUTE_MINIMUM: 2000;
    readonly REQUIRED_FOR_BACKTEST: 40000;
    readonly COOLDOWN_GAP_CHECK_MS: number;
    readonly COOLDOWN_CORRUPTION_CHECK_MS: number;
    readonly CORRUPTION_CHECK_COUNT: 1000;
    readonly API_VALIDATION_RECENT_COUNT: 1000;
};
export declare const TRADE_STATUS: {
    readonly OPEN: "open";
    readonly PENDING: "pending";
    readonly CLOSED: "closed";
    readonly CANCELLED: "cancelled";
};
export declare const ACTIVE_TRADE_STATUSES: readonly ["open", "pending"];
export declare const ORDER_TYPE: {
    readonly MARKET: "MARKET";
    readonly LIMIT: "LIMIT";
    readonly STOP_LOSS: "STOP_LOSS";
    readonly STOP_LOSS_LIMIT: "STOP_LOSS_LIMIT";
    readonly STOP_MARKET: "STOP_MARKET";
    readonly TAKE_PROFIT: "TAKE_PROFIT";
    readonly TAKE_PROFIT_MARKET: "TAKE_PROFIT_MARKET";
    readonly TAKE_PROFIT_LIMIT: "TAKE_PROFIT_LIMIT";
    readonly LIMIT_MAKER: "LIMIT_MAKER";
};
export declare const MARKET_TYPE: {
    readonly SPOT: "SPOT";
    readonly FUTURES: "FUTURES";
};
export declare const ORDER_SIDE: {
    readonly BUY: "BUY";
    readonly SELL: "SELL";
};
export declare const POSITION_SIDE: {
    readonly LONG: "LONG";
    readonly SHORT: "SHORT";
};
export declare const EXIT_REASON: {
    readonly STOP_LOSS: "STOP_LOSS";
    readonly TAKE_PROFIT: "TAKE_PROFIT";
    readonly NONE: "NONE";
    readonly TIME_STOP: "TIME_STOP";
    readonly STALE_TRADE: "STALE_TRADE";
    readonly OPPORTUNITY_COST: "OPPORTUNITY_COST";
    readonly SL_CREATION_FAILED: "SL_CREATION_FAILED";
    readonly COMPENSATION_CLOSE: "COMPENSATION_CLOSE";
};
export declare const PROTECTION_CONFIG: {
    readonly UNPROTECTED_ALERT_COOLDOWN_MS: number;
    readonly EMERGENCY_SL_PERCENT: 0.05;
    readonly COMPENSATION_RETRY_ATTEMPTS: 2;
    readonly COMPENSATION_RETRY_DELAY_MS: 500;
};
export declare const RISK_ALERT_TYPES: {
    readonly LIQUIDATION_RISK: "LIQUIDATION_RISK";
    readonly DAILY_LOSS_LIMIT: "DAILY_LOSS_LIMIT";
    readonly MAX_DRAWDOWN: "MAX_DRAWDOWN";
    readonly POSITION_CLOSED: "POSITION_CLOSED";
    readonly MARGIN_TOP_UP: "MARGIN_TOP_UP";
    readonly UNKNOWN_POSITION: "UNKNOWN_POSITION";
    readonly ORDER_REJECTED: "ORDER_REJECTED";
    readonly ORPHAN_ORDERS: "ORPHAN_ORDERS";
    readonly ORDER_MISMATCH: "ORDER_MISMATCH";
    readonly UNPROTECTED_POSITION: "UNPROTECTED_POSITION";
};
export declare const RISK_ALERT_LEVELS: {
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly DANGER: "danger";
    readonly CRITICAL: "critical";
};
export type TradeStatusValue = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];
export type OrderTypeValue = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];
export type MarketTypeValue = (typeof MARKET_TYPE)[keyof typeof MARKET_TYPE];
export type OrderSideValue = (typeof ORDER_SIDE)[keyof typeof ORDER_SIDE];
export type PositionSideValue = (typeof POSITION_SIDE)[keyof typeof POSITION_SIDE];
export type ExitReasonValue = (typeof EXIT_REASON)[keyof typeof EXIT_REASON];
export type TradingDefaultsConstants = typeof TRADING_DEFAULTS;
export type TrailingStopConfigConstants = typeof TRAILING_STOP_CONFIG;
export type OpportunityCostConfigConstants = typeof OPPORTUNITY_COST_CONFIG;
export type StaleTradeAction = (typeof OPPORTUNITY_COST_CONFIG.STALE_TRADE_ACTIONS)[keyof typeof OPPORTUNITY_COST_CONFIG.STALE_TRADE_ACTIONS];
export type BacktestEngineConfigConstants = typeof BACKTEST_ENGINE_CONFIG;
export type PositionSizingConfigConstants = typeof POSITION_SIZING_CONFIG;
export type ExitCalculatorConfigConstants = typeof EXIT_CALCULATOR_CONFIG;
export type VolatilityConfigConstants = typeof VOLATILITY_CONFIG;
export type PivotDetectionConfigConstants = typeof PIVOT_DETECTION_CONFIG;
export type DetectorConfigConstants = typeof DETECTOR_CONFIG;
export type WebsocketConfigConstants = typeof WEBSOCKET_CONFIG;
export type QueryLimitsConstants = typeof QUERY_LIMITS;
export type RiskManagerConfigConstants = typeof RISK_MANAGER_CONFIG;
export type FloatComparisonConstants = typeof FLOAT_COMPARISON;
export type ContextAggregatorConfigConstants = typeof CONTEXT_AGGREGATOR_CONFIG;
export type KlineConfigConstants = typeof KLINE_CONFIG;
export type ProtectionConfigConstants = typeof PROTECTION_CONFIG;
export type RiskAlertType = (typeof RISK_ALERT_TYPES)[keyof typeof RISK_ALERT_TYPES];
export type RiskAlertLevel = (typeof RISK_ALERT_LEVELS)[keyof typeof RISK_ALERT_LEVELS];
//# sourceMappingURL=trading-config.d.ts.map