import type { Kline } from '@marketmind/types';
import { calculateRSI } from './rsi';

export interface CumulativeRSIResult {
  values: (number | null)[];
  rsiValues: (number | null)[];
}

export const calculateCumulativeRSI = (
  klines: Kline[],
  rsiPeriod: number = 2,
  sumPeriod: number = 2
): CumulativeRSIResult => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + sumPeriod - 1) {
      values.push(null);
      continue;
    }

    let sum = 0;
    let hasNull = false;

    for (let j = 0; j < sumPeriod; j++) {
      const rsiValue = rsi.values[i - j];
      if (rsiValue === null || rsiValue === undefined) {
        hasNull = true;
        break;
      }
      sum += rsiValue;
    }

    if (hasNull) {
      values.push(null);
    } else {
      values.push(sum);
    }
  }

  return {
    values,
    rsiValues: rsi.values,
  };
};
