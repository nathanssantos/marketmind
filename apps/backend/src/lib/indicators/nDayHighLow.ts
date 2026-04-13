import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

export interface NDayHighLowResult {
  isNDayHigh: boolean[];
  isNDayLow: boolean[];
  highestClose: (number | null)[];
  lowestClose: (number | null)[];
  highestHigh: (number | null)[];
  lowestLow: (number | null)[];
}

export const calculateNDayHighLow = (
  klines: Kline[],
  period: number = 7
): NDayHighLowResult => {
  const isNDayHigh: boolean[] = [];
  const isNDayLow: boolean[] = [];
  const highestClose: (number | null)[] = [];
  const lowestClose: (number | null)[] = [];
  const highestHigh: (number | null)[] = [];
  const lowestLow: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      isNDayHigh.push(false);
      isNDayLow.push(false);
      highestClose.push(null);
      lowestClose.push(null);
      highestHigh.push(null);
      lowestLow.push(null);
      continue;
    }

    const currentKline = klines[i];
    if (!currentKline) {
      isNDayHigh.push(false);
      isNDayLow.push(false);
      highestClose.push(null);
      lowestClose.push(null);
      highestHigh.push(null);
      lowestLow.push(null);
      continue;
    }
    const currentClose = getKlineClose(currentKline);

    let maxClose = -Infinity;
    let minClose = Infinity;
    let maxHigh = -Infinity;
    let minLow = Infinity;

    for (let j = i - period + 1; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      const close = getKlineClose(kline);
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);

      if (close > maxClose) maxClose = close;
      if (close < minClose) minClose = close;
      if (high > maxHigh) maxHigh = high;
      if (low < minLow) minLow = low;
    }

    isNDayHigh.push(currentClose >= maxClose);
    isNDayLow.push(currentClose <= minClose);
    highestClose.push(maxClose);
    lowestClose.push(minClose);
    highestHigh.push(maxHigh);
    lowestLow.push(minLow);
  }

  return {
    isNDayHigh,
    isNDayLow,
    highestClose,
    lowestClose,
    highestHigh,
    lowestLow,
  };
};
