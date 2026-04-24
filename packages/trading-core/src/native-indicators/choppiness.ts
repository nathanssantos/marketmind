import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow, getKlineClose } from '@marketmind/types';

const DEFAULT_CHOPPINESS_PERIOD = 14;

export interface ChoppinessResult {
  values: (number | null)[];
}

export const calculateChoppiness = (
  klines: Kline[],
  period: number = DEFAULT_CHOPPINESS_PERIOD,
): ChoppinessResult => {
  const length = klines.length;
  if (length === 0 || period <= 1) return { values: [] };

  const tr: number[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const k = klines[i]!;
    const high = getKlineHigh(k);
    const low = getKlineLow(k);
    if (i === 0) {
      tr[i] = high - low;
      continue;
    }
    const prevClose = getKlineClose(klines[i - 1]!);
    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }

  const values: (number | null)[] = new Array(length);
  const log10Period = Math.log10(period);

  for (let i = 0; i < length; i++) {
    if (i < period - 1) {
      values[i] = null;
      continue;
    }
    let sumTr = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      sumTr += tr[j]!;
      const k = klines[j]!;
      const high = getKlineHigh(k);
      const low = getKlineLow(k);
      if (high > highest) highest = high;
      if (low < lowest) lowest = low;
    }
    const range = highest - lowest;
    if (range <= 0 || sumTr <= 0) {
      values[i] = null;
      continue;
    }
    values[i] = (100 * Math.log10(sumTr / range)) / log10Period;
  }

  return { values };
};
