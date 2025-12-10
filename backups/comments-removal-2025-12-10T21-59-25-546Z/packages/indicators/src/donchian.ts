import type { Kline } from '@marketmind/types';

const DEFAULT_DONCHIAN_PERIOD = 20;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface DonchianResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export const calculateDonchian = (
  klines: Kline[],
  period = DEFAULT_DONCHIAN_PERIOD,
): DonchianResult => {
  const length = klines.length;

  if (length < period) {
    return {
      upper: Array(length).fill(null),
      middle: Array(length).fill(null),
      lower: Array(length).fill(null),
    };
  }

  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
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

    upper.push(highestHigh);
    lower.push(lowestLow);
    middle.push((highestHigh + lowestLow) / 2);
  }

  return { upper, middle, lower };
};
