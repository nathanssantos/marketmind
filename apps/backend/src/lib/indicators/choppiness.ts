import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';
import { calculateATR } from './atr';

const DEFAULT_CHOPPINESS_PERIOD = 14;

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
