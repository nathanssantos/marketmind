import type { Kline } from '@marketmind/types';

const DEFAULT_CMO_PERIOD = 14;

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface CMOResult {
  values: (number | null)[];
}

export const calculateCMO = (klines: Kline[], period: number = DEFAULT_CMO_PERIOD): CMOResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    let sumUp = 0;
    let sumDown = 0;

    for (let j = 0; j < period; j++) {
      const current = klines[i - j];
      const previous = klines[i - j - 1];

      if (!current || !previous) continue;

      const change = getKlineClose(current) - getKlineClose(previous);

      if (change > 0) {
        sumUp += change;
      } else {
        sumDown += Math.abs(change);
      }
    }

    const totalChange = sumUp + sumDown;

    if (totalChange === 0) {
      values.push(0);
      continue;
    }

    const cmo = ((sumUp - sumDown) / totalChange) * 100;
    values.push(cmo);
  }

  return { values };
};
