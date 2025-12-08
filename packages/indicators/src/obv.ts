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

  const sma: (number | null)[] = [];

  if (smaPeriod && smaPeriod > 0) {
    for (let i = 0; i < values.length; i++) {
      if (i < smaPeriod - 1) {
        sma.push(null);
      } else {
        const slice = values.slice(i - smaPeriod + 1, i + 1);
        const sum = slice.reduce((acc, val) => acc + val, 0);
        sma.push(sum / smaPeriod);
      }
    }
  }

  return { values, sma };
};
