import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { ChoppinessFilterResult, Kline } from '@marketmind/types';

const pineService = new PineIndicatorService();

const DEFAULT_CHOPPINESS_PERIOD = 14;
const HIGH_THRESHOLD = 61.8;
const LOW_THRESHOLD = 38.2;

export const CHOPPINESS_FILTER = {
  DEFAULT_PERIOD: DEFAULT_CHOPPINESS_PERIOD,
  HIGH_THRESHOLD,
  LOW_THRESHOLD,
} as const;

export type { ChoppinessFilterResult };

const computeChoppiness = async (
  klines: Kline[],
  period: number
): Promise<(number | null)[]> => {
  if (klines.length === 0) return [];
  if (klines.length < period) return Array(klines.length).fill(null);

  const [atrValues, highestValues, lowestValues] = await Promise.all([
    pineService.compute('atr', klines, { period: 1 }),
    pineService.compute('highest', klines, { period }),
    pineService.compute('lowest', klines, { period }),
  ]);

  const result: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let atrSum = 0;
    let validAtrCount = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const atr = atrValues[j];
      if (atr !== null && atr !== undefined && !isNaN(atr)) {
        atrSum += atr;
        validAtrCount++;
      }
    }

    const highest = highestValues[i];
    const lowest = lowestValues[i];

    if (highest === null || lowest === null || highest === undefined || lowest === undefined) {
      result.push(null);
      continue;
    }

    const range = highest - lowest;

    if (range === 0 || validAtrCount < period) {
      result.push(null);
      continue;
    }

    const choppiness = 100 * Math.log10(atrSum / range) / Math.log10(period);
    result.push(choppiness);
  }

  return result;
};

export const checkChoppinessCondition = async (
  klines: Kline[],
  thresholdHigh: number = CHOPPINESS_FILTER.HIGH_THRESHOLD,
  thresholdLow: number = CHOPPINESS_FILTER.LOW_THRESHOLD,
  period: number = CHOPPINESS_FILTER.DEFAULT_PERIOD,
): Promise<ChoppinessFilterResult> => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      choppinessValue: null,
      isChoppy: false,
      isTrending: false,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const choppinessValues = await computeChoppiness(klines, period);
  const lastValue = choppinessValues[choppinessValues.length - 1];

  if (lastValue === undefined || lastValue === null || isNaN(lastValue)) {
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
