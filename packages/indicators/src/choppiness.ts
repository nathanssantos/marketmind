import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';
import { calculateATR } from './atr';

const DEFAULT_CHOPPINESS_PERIOD = 14;
const HIGH_THRESHOLD = 61.8;
const LOW_THRESHOLD = 38.2;

export const CHOPPINESS_FILTER = {
  DEFAULT_PERIOD: DEFAULT_CHOPPINESS_PERIOD,
  HIGH_THRESHOLD,
  LOW_THRESHOLD,
} as const;

export interface ChoppinessResult {
  value: number | null;
  isChoppy: boolean;
  isTrending: boolean;
}

export const calculateChoppiness = (
  klines: Kline[],
  period = DEFAULT_CHOPPINESS_PERIOD,
): number[] => {
  if (klines.length === 0) return [];
  if (klines.length < period) return Array(klines.length).fill(NaN);

  const atrValues = calculateATR(klines, 1);
  const result: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    let atrSum = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    let validAtrCount = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;

      const atr = atrValues[j];
      if (atr !== undefined && !isNaN(atr)) {
        atrSum += atr;
        validAtrCount++;
      }

      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);

      if (high > highest) highest = high;
      if (low < lowest) lowest = low;
    }

    const range = highest - lowest;

    if (range === 0 || validAtrCount < period) {
      result.push(NaN);
      continue;
    }

    const choppiness = 100 * Math.log10(atrSum / range) / Math.log10(period);
    result.push(choppiness);
  }

  return result;
};

export const getChoppinessResult = (
  klines: Kline[],
  period = DEFAULT_CHOPPINESS_PERIOD,
  highThreshold = HIGH_THRESHOLD,
  lowThreshold = LOW_THRESHOLD,
): ChoppinessResult => {
  const choppinessValues = calculateChoppiness(klines, period);
  const lastValue = choppinessValues[choppinessValues.length - 1];

  if (lastValue === undefined || isNaN(lastValue)) {
    return { value: null, isChoppy: false, isTrending: false };
  }

  return {
    value: lastValue,
    isChoppy: lastValue > highThreshold,
    isTrending: lastValue < lowThreshold,
  };
};
