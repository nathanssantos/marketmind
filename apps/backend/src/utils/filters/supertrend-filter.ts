import { calculateSupertrend } from '@marketmind/indicators';
import type { Kline, SupertrendFilterResult, SupertrendTrend } from '@marketmind/types';

const DEFAULT_PERIOD = 10;
const DEFAULT_MULTIPLIER = 3;

export const SUPERTREND_FILTER = {
  DEFAULT_PERIOD,
  DEFAULT_MULTIPLIER,
} as const;

export type { SupertrendFilterResult, SupertrendTrend };

export const checkSupertrendCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  period: number = DEFAULT_PERIOD,
  multiplier: number = DEFAULT_MULTIPLIER,
): SupertrendFilterResult => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      trend: null,
      value: null,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const result = calculateSupertrend(klines, period, multiplier);
  const lastIndex = result.trend.length - 1;
  const trend = result.trend[lastIndex] ?? null;
  const value = result.value[lastIndex];

  if (trend === null) {
    return {
      isAllowed: true,
      trend: null,
      value: value ?? null,
      reason: 'SuperTrend trend not yet determined - allowing trade (soft pass)',
    };
  }

  if (direction === 'LONG') {
    if (trend === 'down') {
      return {
        isAllowed: false,
        trend,
        value: value ?? null,
        reason: `LONG blocked: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bearish trend active`,
      };
    }
    return {
      isAllowed: true,
      trend,
      value: value ?? null,
      reason: `LONG allowed: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bullish trend active`,
    };
  }

  if (direction === 'SHORT') {
    if (trend === 'up') {
      return {
        isAllowed: false,
        trend,
        value: value ?? null,
        reason: `SHORT blocked: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bullish trend active`,
      };
    }
    return {
      isAllowed: true,
      trend,
      value: value ?? null,
      reason: `SHORT allowed: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bearish trend active`,
    };
  }

  return {
    isAllowed: true,
    trend,
    value: value ?? null,
    reason: 'Unknown direction',
  };
};
