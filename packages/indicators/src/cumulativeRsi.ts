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

export const calculateRSIConsecutiveDrops = (
  klines: Kline[],
  rsiPeriod: number = 2,
  consecutiveDays: number = 3
): boolean[] => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + consecutiveDays) {
      result.push(false);
      continue;
    }

    let allDropping = true;

    for (let j = 0; j < consecutiveDays; j++) {
      const current = rsi.values[i - j];
      const prev = rsi.values[i - j - 1];

      if (current === null || current === undefined || prev === null || prev === undefined || current >= prev) {
        allDropping = false;
        break;
      }
    }

    result.push(allDropping);
  }

  return result;
};

export const calculateR3Entry = (
  klines: Kline[],
  rsiPeriod: number = 2
): boolean[] => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const consecutiveDrops = calculateRSIConsecutiveDrops(klines, rsiPeriod, 3);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + 3) {
      result.push(false);
      continue;
    }

    const currentRSI = rsi.values[i];
    const firstDropRSI = rsi.values[i - 2];
    const consecutiveDrop = consecutiveDrops[i];

    if (
      consecutiveDrop &&
      currentRSI !== null &&
      currentRSI !== undefined &&
      firstDropRSI !== null &&
      firstDropRSI !== undefined &&
      currentRSI < 10 &&
      firstDropRSI < 60
    ) {
      result.push(true);
    } else {
      result.push(false);
    }
  }

  return result;
};
