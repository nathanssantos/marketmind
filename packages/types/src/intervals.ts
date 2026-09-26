import type { TimeInterval } from './kline';

export const TIME_MS = {
  SECOND: 1_000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  WEEK: 604_800_000,
  MONTH: 2_592_000_000,
  YEAR: 31_536_000_000,
} as const;

export const INTERVAL_MS: Record<TimeInterval, number> = {
  '1s': TIME_MS.SECOND,
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
  '1y': TIME_MS.YEAR,
};

export const INTERVAL_MINUTES: Record<TimeInterval, number> = {
  '1s': 1 / 60,
  '1m': 1,
  '3m': 3,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '6h': 360,
  '8h': 480,
  '12h': 720,
  '1d': 1_440,
  '3d': 4_320,
  '1w': 10_080,
  '1M': 43_200,
  '1y': 525_600,
};

export const ALL_INTERVALS: TimeInterval[] = [
  '1s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
  '1y',
];

export const UI_INTERVALS: TimeInterval[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
  '1y',
];

export const BINANCE_NATIVE_INTERVALS: TimeInterval[] = [
  '1s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
];

export const BACKTEST_TIMEFRAMES: TimeInterval[] = [
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
];

export const OPTIMIZATION_TIMEFRAMES: TimeInterval[] = [
  '1h',
  '2h',
  '4h',
];

export const BATCH_BACKTEST_TIMEFRAMES: TimeInterval[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
  '1w',
];

export const SCALPING_INTERVALS: TimeInterval[] = ['1s', '1m', '5m'];

export type TimeMsConstants = typeof TIME_MS;
export type IntervalMsConstants = typeof INTERVAL_MS;
export type IntervalMinutesConstants = typeof INTERVAL_MINUTES;

const DAYS_PER_WEEK = 7;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;
const CALENDAR_INTERVALS = new Set<TimeInterval>(['1M', '1y']);

export const alignToIntervalStart = (time: number, interval: TimeInterval): number => {
  const date = new Date(time);
  if (interval === '1M') return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (interval === '1y') return Date.UTC(date.getUTCFullYear(), 0, 1);
  if (interval === '1w') {
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const daysSinceMonday = (date.getUTCDay() + DAYS_FROM_MONDAY_TO_SUNDAY) % DAYS_PER_WEEK;
    return dayStart - daysSinceMonday * TIME_MS.DAY;
  }
  const intervalMs = INTERVAL_MS[interval];
  return Math.floor(time / intervalMs) * intervalMs;
};

export const getNextOpenTime = (openTime: number, interval: TimeInterval): number => {
  const date = new Date(openTime);
  if (interval === '1M') return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  if (interval === '1y') return Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  return openTime + INTERVAL_MS[interval];
};

export const getPreviousOpenTime = (openTime: number, interval: TimeInterval): number =>
  alignToIntervalStart(openTime - 1, interval);

export const countOpenTimesBetween = (fromOpenTime: number, toOpenTimeExclusive: number, interval: TimeInterval): number => {
  if (toOpenTimeExclusive <= fromOpenTime) return 0;
  if (!CALENDAR_INTERVALS.has(interval)) return Math.floor((toOpenTimeExclusive - fromOpenTime) / INTERVAL_MS[interval]);
  let count = 0;
  for (let cursor = fromOpenTime; cursor < toOpenTimeExclusive; cursor = getNextOpenTime(cursor, interval)) count += 1;
  return count;
};
