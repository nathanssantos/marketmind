import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

export interface IBSResult {
  values: (number | null)[];
}

export const calculateIBS = (klines: Kline[]): IBSResult => {
  const values: (number | null)[] = [];

  for (const kline of klines) {
    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);
    const close = getKlineClose(kline);

    const range = high - low;

    if (range === 0) {
      values.push(0.5);
      continue;
    }

    const ibs = (close - low) / range;
    values.push(ibs);
  }

  return { values };
};
