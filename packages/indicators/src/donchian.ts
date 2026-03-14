import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_DONCHIAN_PERIOD = 20;

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

  const upper: (number | null)[] = new Array(length);
  const middle: (number | null)[] = new Array(length);
  const lower: (number | null)[] = new Array(length);

  for (let i = 0; i < period - 1; i++) {
    upper[i] = null;
    middle[i] = null;
    lower[i] = null;
  }

  for (let i = period - 1; i < length; i++) {
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

    upper[i] = highestHigh;
    lower[i] = lowestLow;
    middle[i] = (highestHigh + lowestLow) / 2;
  }

  return { upper, middle, lower };
};
