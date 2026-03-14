import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';
import { calculateWMAFromValues } from './wma';

const DEFAULT_HMA_PERIOD = 20;

export interface HMAResult {
  values: (number | null)[];
}

export const calculateHMA = (klines: Kline[], period: number = DEFAULT_HMA_PERIOD): HMAResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const closes = klines.map(getKlineClose);
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  const wmaHalf = calculateWMAFromValues(closes, halfPeriod);
  const wmaFull = calculateWMAFromValues(closes, period);

  const rawHma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const half = wmaHalf[i];
    const full = wmaFull[i];

    if (half === null || half === undefined || full === null || full === undefined) {
      rawHma.push(NaN);
    } else {
      rawHma.push(2 * half - full);
    }
  }

  const hmaFinal = calculateWMAFromValues(
    rawHma.map((v) => (Number.isNaN(v) ? 0 : v)),
    sqrtPeriod,
  );

  const values: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    const halfVal = wmaHalf[i];
    const fullVal = wmaFull[i];
    const finalVal = hmaFinal[i];

    const rawHmaVal = rawHma[i];
    if (halfVal === null || halfVal === undefined || fullVal === null || fullVal === undefined || finalVal === null || finalVal === undefined || rawHmaVal === undefined || Number.isNaN(rawHmaVal)) {
      values.push(null);
    } else {
      values.push(finalVal);
    }
  }

  return { values };
};
