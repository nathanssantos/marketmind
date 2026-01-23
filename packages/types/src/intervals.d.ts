import type { TimeInterval } from './kline';
export declare const TIME_MS: {
    readonly SECOND: 1000;
    readonly MINUTE: 60000;
    readonly HOUR: 3600000;
    readonly DAY: 86400000;
    readonly WEEK: 604800000;
    readonly MONTH: 2592000000;
    readonly YEAR: 31536000000;
};
export declare const INTERVAL_MS: Record<TimeInterval, number>;
export declare const INTERVAL_MINUTES: Record<TimeInterval, number>;
export declare const ALL_INTERVALS: TimeInterval[];
export declare const UI_INTERVALS: TimeInterval[];
export declare const BINANCE_NATIVE_INTERVALS: TimeInterval[];
export type TimeMsConstants = typeof TIME_MS;
export type IntervalMsConstants = typeof INTERVAL_MS;
export type IntervalMinutesConstants = typeof INTERVAL_MINUTES;
//# sourceMappingURL=intervals.d.ts.map