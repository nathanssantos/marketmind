import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline, PositionSide, SupertrendFilterResult, SupertrendTrend } from '@marketmind/types';

const pineService = new PineIndicatorService();

const DEFAULT_PERIOD = 10;
const DEFAULT_MULTIPLIER = 3;

export const SUPERTREND_FILTER = {
  DEFAULT_PERIOD,
  DEFAULT_MULTIPLIER,
} as const;

export type { SupertrendFilterResult, SupertrendTrend };

export const checkSupertrendCondition = async (
  klines: Kline[],
  direction: PositionSide,
  period: number = DEFAULT_PERIOD,
  multiplier: number = DEFAULT_MULTIPLIER,
): Promise<SupertrendFilterResult> => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      trend: null,
      value: null,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const result = await pineService.computeMulti('supertrend', klines, { period, multiplier });
  const trendValues = result['direction'] ?? [];
  const valueValues = result['value'] ?? [];

  const lastIndex = trendValues.length - 1;
  const directionValue = trendValues[lastIndex] ?? null;
  const value = valueValues[lastIndex] ?? null;

  const trend: SupertrendTrend | null = directionValue === null
    ? null
    : directionValue < 0 ? 'up' : 'down';

  if (trend === null) {
    return {
      isAllowed: true,
      trend: null,
      value,
      reason: 'SuperTrend trend not yet determined - allowing trade (soft pass)',
    };
  }

  if (direction === 'LONG') {
    if (trend === 'down') {
      return {
        isAllowed: false,
        trend,
        value,
        reason: `LONG blocked: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bearish trend active`,
      };
    }
    return {
      isAllowed: true,
      trend,
      value,
      reason: `LONG allowed: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bullish trend active`,
    };
  }

  if (direction === 'SHORT') {
    if (trend === 'up') {
      return {
        isAllowed: false,
        trend,
        value,
        reason: `SHORT blocked: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bullish trend active`,
      };
    }
    return {
      isAllowed: true,
      trend,
      value,
      reason: `SHORT allowed: SuperTrend=${trend} at ${value?.toFixed(2) ?? 'N/A'} - bearish trend active`,
    };
  }

  return {
    isAllowed: true,
    trend,
    value,
    reason: 'Unknown direction',
  };
};
