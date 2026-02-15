import type { Interval, Kline, StochasticFilterResult } from '@marketmind/types';
import { checkStochasticCondition } from './stochastic-filter';
import { checkStochasticRecoveryCondition } from './stochastic-recovery-filter';

export const STOCHASTIC_HTF_MAPPING: Record<string, Interval> = {
  '1m': '3m',
  '3m': '5m',
  '5m': '15m',
  '15m': '30m',
  '30m': '1h',
  '1h': '2h',
  '2h': '4h',
  '4h': '6h',
  '6h': '8h',
  '8h': '12h',
  '12h': '1d',
  '1d': '3d',
  '3d': '1w',
  '1w': '1M',
};

export const getOneStepAboveTimeframe = (interval: string): Interval | null =>
  STOCHASTIC_HTF_MAPPING[interval] ?? null;

export const findHtfKlineIndex = (htfKlines: Kline[], timestamp: number): number => {
  let bestIndex = -1;
  for (let i = 0; i < htfKlines.length; i++) {
    if (htfKlines[i]!.openTime <= timestamp) bestIndex = i;
    else break;
  }
  return bestIndex;
};

export const checkStochasticHtfCondition = (
  htfKlines: Kline[],
  setupTimestamp: number,
  direction: 'LONG' | 'SHORT'
): StochasticFilterResult => {
  const htfIndex = findHtfKlineIndex(htfKlines, setupTimestamp);
  if (htfIndex < 0) {
    return {
      isAllowed: true,
      currentK: null,
      currentD: null,
      isOversold: false,
      isOverbought: false,
      reason: 'HTF kline not found for timestamp - soft pass',
    };
  }

  const slicedKlines = htfKlines.slice(0, htfIndex + 1);
  const result = checkStochasticCondition(slicedKlines, direction);

  return {
    ...result,
    reason: result.reason.replace(/^(LONG|SHORT) (allowed|blocked):/, '$1 $2 (HTF):'),
  };
};

export const checkStochasticRecoveryHtfCondition = (
  htfKlines: Kline[],
  setupTimestamp: number,
  direction: 'LONG' | 'SHORT'
): StochasticFilterResult => {
  const htfIndex = findHtfKlineIndex(htfKlines, setupTimestamp);
  if (htfIndex < 0) {
    return {
      isAllowed: true,
      currentK: null,
      currentD: null,
      isOversold: false,
      isOverbought: false,
      reason: 'HTF kline not found for timestamp - soft pass',
    };
  }

  const slicedKlines = htfKlines.slice(0, htfIndex + 1);
  const result = checkStochasticRecoveryCondition(slicedKlines, direction);

  return {
    ...result,
    reason: result.reason.replace(/^(LONG|SHORT) (allowed|blocked):/, '$1 $2 (HTF):'),
  };
};
