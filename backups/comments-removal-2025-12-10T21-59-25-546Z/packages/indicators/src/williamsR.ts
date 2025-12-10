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

  const result: WilliamsRResult = [];

  for (let i = 0; i < length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    const current = klines[i];
    if (!current) {
      result.push(null);
      continue;
    }

    const slice = klines.slice(i - period + 1, i + 1);

    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (const kline of slice) {
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      if (high > highestHigh) highestHigh = high;
      if (low < lowestLow) lowestLow = low;
    }

    const close = getKlineClose(current);
    const range = highestHigh - lowestLow;

    if (range === 0) {
      result.push(0);
    } else {
      const williamsR = ((highestHigh - close) / range) * -100;
      result.push(williamsR);
    }
  }

  return result;
};
