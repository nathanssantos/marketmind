import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_MASS_PERIOD = 25;
const DEFAULT_EMA_PERIOD = 9;

export interface MassIndexResult {
  values: (number | null)[];
}

export const calculateMassIndex = (
  klines: Kline[],
  massPeriod: number = DEFAULT_MASS_PERIOD,
  emaPeriod: number = DEFAULT_EMA_PERIOD,
): MassIndexResult => {
  if (klines.length === 0 || massPeriod <= 0 || emaPeriod <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];
  const ranges = klines.map((k) => getKlineHigh(k) - getKlineLow(k));

  const singleEMA: number[] = [];
  const doubleEMA: number[] = [];
  const multiplier = 2 / (emaPeriod + 1);

  for (let i = 0; i < ranges.length; i++) {
    if (i === 0) {
      singleEMA.push(ranges[i]!);
    } else {
      const prev = singleEMA[i - 1]!;
      singleEMA.push((ranges[i]! - prev) * multiplier + prev);
    }
  }

  for (let i = 0; i < singleEMA.length; i++) {
    if (i === 0) {
      doubleEMA.push(singleEMA[i]!);
    } else {
      const prev = doubleEMA[i - 1]!;
      doubleEMA.push((singleEMA[i]! - prev) * multiplier + prev);
    }
  }

  const minWarmup = massPeriod + emaPeriod - 1;

  for (let i = 0; i < klines.length; i++) {
    if (i < minWarmup) {
      values.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - massPeriod + 1; j <= i; j++) {
      const dEMA = doubleEMA[j]!;
      if (dEMA === 0) continue;
      sum += singleEMA[j]! / dEMA;
    }

    values.push(sum);
  }

  return { values };
};
