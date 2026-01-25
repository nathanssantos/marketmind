import { calculateChoppiness, CHOPPINESS_FILTER } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export { CHOPPINESS_FILTER };

export interface ChoppinessFilterResult {
  isAllowed: boolean;
  choppinessValue: number | null;
  isChoppy: boolean;
  isTrending: boolean;
  reason: string;
}

export const checkChoppinessCondition = (
  klines: Kline[],
  thresholdHigh: number = CHOPPINESS_FILTER.HIGH_THRESHOLD,
  thresholdLow: number = CHOPPINESS_FILTER.LOW_THRESHOLD,
  period: number = CHOPPINESS_FILTER.DEFAULT_PERIOD,
): ChoppinessFilterResult => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      choppinessValue: null,
      isChoppy: false,
      isTrending: false,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const choppinessValues = calculateChoppiness(klines, period);
  const lastValue = choppinessValues[choppinessValues.length - 1];

  if (lastValue === undefined || isNaN(lastValue)) {
    return {
      isAllowed: true,
      choppinessValue: null,
      isChoppy: false,
      isTrending: false,
      reason: 'Choppiness calculation returned invalid value - allowing trade (soft pass)',
    };
  }

  const isChoppy = lastValue > thresholdHigh;
  const isTrending = lastValue < thresholdLow;

  if (isChoppy) {
    return {
      isAllowed: false,
      choppinessValue: lastValue,
      isChoppy,
      isTrending,
      reason: `Trade blocked: CHOP=${lastValue.toFixed(2)} > ${thresholdHigh} (market is choppy/sideways)`,
    };
  }

  return {
    isAllowed: true,
    choppinessValue: lastValue,
    isChoppy,
    isTrending,
    reason: isTrending
      ? `Trade allowed: CHOP=${lastValue.toFixed(2)} < ${thresholdLow} (market is trending)`
      : `Trade allowed: CHOP=${lastValue.toFixed(2)} (market conditions acceptable)`,
  };
};
