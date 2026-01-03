import type { Kline } from '@marketmind/types';

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);

export interface OBVResult {
  values: number[];
  sma: (number | null)[];
}

export const calculateOBV = (
  klines: Kline[],
  smaPeriod?: number,
): OBVResult => {
  if (klines.length === 0) {
    return { values: [], sma: [] };
  }

  const values: number[] = [];
  let obv = 0;

  for (let i = 0; i < klines.length; i++) {
    const current = klines[i];
    if (!current) continue;

    if (i === 0) {
      obv = getKlineVolume(current);
    } else {
      const prev = klines[i - 1];
      if (!prev) continue;

      const currentClose = getKlineClose(current);
      const prevClose = getKlineClose(prev);
      const volume = getKlineVolume(current);

      if (currentClose > prevClose) {
        obv += volume;
      } else if (currentClose < prevClose) {
        obv -= volume;
      }
    }

    values.push(obv);
  }

  if (!smaPeriod || smaPeriod <= 0) {
    return { values, sma: [] };
  }

  const sma: (number | null)[] = new Array(values.length);

  for (let i = 0; i < smaPeriod - 1; i++) {
    sma[i] = null;
  }

  for (let i = smaPeriod - 1; i < values.length; i++) {
    let sum = 0;
    const startIdx = i - smaPeriod + 1;
    for (let j = startIdx; j <= i; j++) {
      sum += values[j]!;
    }
    sma[i] = sum / smaPeriod;
  }

  return { values, sma };
};
