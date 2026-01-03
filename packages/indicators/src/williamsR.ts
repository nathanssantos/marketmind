import type { Kline } from '@marketmind/types';

const DEFAULT_WILLIAMS_PERIOD = 14;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export type WilliamsRResult = (number | null)[];

export const calculateWilliamsR = (
  klines: Kline[],
  period = DEFAULT_WILLIAMS_PERIOD,
): WilliamsRResult => {
  const length = klines.length;

  if (length < period) {
    return Array(length).fill(null);
  }

  const result: WilliamsRResult = new Array(length);

  for (let i = 0; i < period - 1; i++) {
    result[i] = null;
  }

  for (let i = period - 1; i < length; i++) {
    const current = klines[i];
    if (!current) {
      result[i] = null;
      continue;
    }

    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    const startIdx = i - period + 1;

    for (let j = startIdx; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      if (high > highestHigh) highestHigh = high;
      if (low < lowestLow) lowestLow = low;
    }

    const close = getKlineClose(current);
    const range = highestHigh - lowestLow;

    if (range === 0) {
      result[i] = 0;
    } else {
      result[i] = ((highestHigh - close) / range) * -100;
    }
  }

  return result;
};
