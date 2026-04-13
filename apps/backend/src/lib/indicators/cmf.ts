import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@marketmind/types';

const DEFAULT_CMF_PERIOD = 20;

export interface CMFResult {
  values: (number | null)[];
}

export const calculateCMF = (klines: Kline[], period: number = DEFAULT_CMF_PERIOD): CMFResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];
  const mfv: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i]!;
    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);
    const close = getKlineClose(kline);
    const volume = getKlineVolume(kline);

    const range = high - low;
    const mfMultiplier = range === 0 ? 0 : ((close - low) - (high - close)) / range;
    mfv.push(mfMultiplier * volume);
  }

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      values.push(null);
      continue;
    }

    let sumMFV = 0;
    let sumVolume = 0;

    for (let j = i - period + 1; j <= i; j++) {
      sumMFV += mfv[j]!;
      sumVolume += getKlineVolume(klines[j]!);
    }

    if (sumVolume === 0) {
      values.push(null);
    } else {
      values.push(sumMFV / sumVolume);
    }
  }

  return { values };
};
