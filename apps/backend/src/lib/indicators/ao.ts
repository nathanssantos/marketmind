import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_FAST_PERIOD = 5;
const DEFAULT_SLOW_PERIOD = 34;

export interface AOResult {
  values: (number | null)[];
}

const calculateSMAFromValues = (values: number[], period: number, endIndex: number): number | null => {
  if (endIndex < period - 1) return null;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    const val = values[endIndex - i];
    if (val === undefined) return null;
    sum += val;
  }
  return sum / period;
};

export const calculateAO = (
  klines: Kline[],
  fastPeriod: number = DEFAULT_FAST_PERIOD,
  slowPeriod: number = DEFAULT_SLOW_PERIOD,
): AOResult => {
  if (klines.length === 0 || fastPeriod <= 0 || slowPeriod <= 0 || fastPeriod >= slowPeriod) {
    return { values: [] };
  }

  const medianPrices = klines.map((k) => (getKlineHigh(k) + getKlineLow(k)) / 2);
  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < slowPeriod - 1) {
      values.push(null);
      continue;
    }

    const fastSMA = calculateSMAFromValues(medianPrices, fastPeriod, i);
    const slowSMA = calculateSMAFromValues(medianPrices, slowPeriod, i);

    if (fastSMA === null || slowSMA === null) {
      values.push(null);
      continue;
    }

    values.push(fastSMA - slowSMA);
  }

  return { values };
};
