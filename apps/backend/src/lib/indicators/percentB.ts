import type { Kline } from '@marketmind/types';
import { calculateBollingerBandsArray } from './bollingerBands';

export interface PercentBResult {
  values: (number | null)[];
}

export const calculatePercentBSeries = (
  klines: Kline[],
  period: number = 20,
  stdDev: number = 2
): PercentBResult => {
  const bbArray = calculateBollingerBandsArray(klines, period, stdDev);
  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const bb = bbArray[i];

    if (!kline || bb === null || bb === undefined) {
      values.push(null);
      continue;
    }

    const close = parseFloat(kline.close);
    const bandwidth = bb.upper - bb.lower;

    if (bandwidth === 0 || isNaN(bandwidth)) {
      values.push(0.5);
      continue;
    }

    const percentB = (close - bb.lower) / bandwidth;

    if (isNaN(percentB)) {
      values.push(null);
      continue;
    }

    values.push(percentB);
  }

  return { values };
};
