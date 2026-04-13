import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

export interface NR7Result {
  isNR7: boolean[];
  ranges: (number | null)[];
  minRange: (number | null)[];
}

export const calculateNR7 = (klines: Kline[], period: number = 7): NR7Result => {
  const isNR7: boolean[] = [];
  const ranges: (number | null)[] = [];
  const minRange: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) {
      isNR7.push(false);
      ranges.push(null);
      minRange.push(null);
      continue;
    }
    const currentRange = getKlineHigh(kline) - getKlineLow(kline);
    ranges.push(currentRange);

    if (i < period - 1) {
      isNR7.push(false);
      minRange.push(null);
      continue;
    }

    let isNarrowest = true;
    let minRangeValue = currentRange;

    for (let j = i - period + 1; j < i; j++) {
      const prevKline = klines[j];
      if (!prevKline) continue;
      const prevRange = getKlineHigh(prevKline) - getKlineLow(prevKline);
      if (prevRange < minRangeValue) {
        minRangeValue = prevRange;
      }
      if (prevRange <= currentRange) {
        isNarrowest = false;
      }
    }

    isNR7.push(isNarrowest);
    minRange.push(minRangeValue);
  }

  return { isNR7, ranges, minRange };
};
