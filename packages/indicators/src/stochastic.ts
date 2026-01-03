import type { Kline } from '@marketmind/types';

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export const calculateStochastic = (
  klines: Kline[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult => {
  if (klines.length === 0 || kPeriod <= 0 || dPeriod <= 0) {
    return { k: [], d: [] };
  }

  const len = klines.length;
  const k: (number | null)[] = new Array(len);

  for (let i = 0; i < kPeriod - 1 && i < len; i++) {
    k[i] = null;
  }

  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    const startIdx = i - kPeriod + 1;

    for (let j = startIdx; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      if (high > highestHigh) highestHigh = high;
      if (low < lowestLow) lowestLow = low;
    }

    const currentKline = klines[i];
    if (!currentKline) {
      k[i] = null;
      continue;
    }
    const currentClose = getKlineClose(currentKline);

    if (highestHigh === lowestLow) {
      k[i] = 50;
      continue;
    }

    k[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  const d = calculateSMA(k, dPeriod);

  return { k, d };
};

const calculateSMA = (values: (number | null)[], period: number): (number | null)[] => {
  const len = values.length;
  if (period <= 0 || len === 0) {
    return [];
  }

  const result: (number | null)[] = new Array(len);
  const multiplier = 2 / (period + 1);

  let firstValidIndex = -1;
  for (let i = 0; i < len; i++) {
    if (values[i] !== null) {
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) {
    for (let i = 0; i < len; i++) result[i] = null;
    return result;
  }

  for (let i = 0; i < firstValidIndex; i++) {
    result[i] = null;
  }

  for (let i = firstValidIndex; i < len; i++) {
    const validValuesCount = i - firstValidIndex + 1;

    if (validValuesCount < period) {
      result[i] = null;
      continue;
    }

    if (validValuesCount === period) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < period; j++) {
        const val = values[firstValidIndex + j];
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      }
      result[i] = count > 0 ? sum / count : null;
      continue;
    }

    const previousEMA = result[i - 1];
    const currentValue = values[i];

    if (previousEMA === null || previousEMA === undefined || currentValue === null || currentValue === undefined) {
      result[i] = null;
      continue;
    }

    result[i] = (currentValue - previousEMA) * multiplier + previousEMA;
  }

  return result;
};

export interface StochasticConfig {
  kPeriod: number;
  dPeriod: number;
  enabled: boolean;
  kColor: string;
  dColor: string;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticConfig = {
  kPeriod: 14,
  dPeriod: 9,
  enabled: false,
  kColor: '#2196f3',
  dColor: '#ff5722',
  overboughtLevel: 80,
  oversoldLevel: 20,
};
