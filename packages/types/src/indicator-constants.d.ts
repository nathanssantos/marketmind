export declare const INDICATOR_PERIODS: {
    readonly RSI_DEFAULT: 14;
    readonly ADX_DEFAULT: 14;
    readonly ATR_DEFAULT: 14;
    readonly EMA_FAST: 9;
    readonly EMA_MEDIUM: 20;
    readonly EMA_SLOW: 50;
    readonly EMA_TREND: 200;
    readonly MACD_FAST: 12;
    readonly MACD_SLOW: 26;
    readonly MACD_SIGNAL: 9;
    readonly VOLUME_LOOKBACK: 20;
    readonly STOCHASTIC_K: 14;
    readonly STOCHASTIC_D: 3;
    readonly STOCHASTIC_SMOOTH: 3;
    readonly BOLLINGER_PERIOD: 20;
    readonly BOLLINGER_STD_DEV: 2;
};
export declare const FILTER_THRESHOLDS: {
    readonly ADX_TREND: 20;
    readonly ADX_MIN: 25;
    readonly ADX_STRONG: 40;
    readonly ADX_VERY_STRONG: 45;
    readonly RSI_OVERBOUGHT: 70;
    readonly RSI_OVERSOLD: 30;
    readonly RSI_NEUTRAL_HIGH: 60;
    readonly RSI_NEUTRAL_LOW: 40;
    readonly STOCHASTIC_OVERBOUGHT: 80;
    readonly STOCHASTIC_OVERSOLD: 20;
    readonly CORRELATION_HIGH: 0.7;
    readonly CORRELATION_LOW: 0.3;
    readonly CORRELATION_NEGATIVE: -0.3;
    readonly VOLUME_SPIKE_MULTIPLIER: 1.5;
    readonly VOLUME_CONFIRMATION_MULTIPLIER: 1.2;
    readonly VERY_HIGH_VOLATILITY_ATR: 4;
};
export type IndicatorPeriodsConstants = typeof INDICATOR_PERIODS;
export type FilterThresholdsConstants = typeof FILTER_THRESHOLDS;
//# sourceMappingURL=indicator-constants.d.ts.map