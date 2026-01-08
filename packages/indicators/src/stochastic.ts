import type { Kline } from '@marketmind/types';

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

const calculatePureSMA = (values: (number | null)[], period: number): (number | null)[] => {
  const len = values.length;
  if (period <= 0 || len === 0) {
    return [];
  }

  const result: (number | null)[] = new Array(len);

  for (let i = 0; i < len; i++) {
    if (i < period - 1) {
      result[i] = null;
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const val = values[j];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    }

    result[i] = count === period ? sum / period : null;
  }

  return result;
};

export const calculateStochastic = (
  klines: Kline[],
  kPeriod: number = 14,
  kSmoothing: number = 3,
  dPeriod: number = 3
): StochasticResult => {
  if (klines.length === 0 || kPeriod <= 0 || kSmoothing <= 0 || dPeriod <= 0) {
    return { k: [], d: [] };
  }

  const len = klines.length;
  const fastK: (number | null)[] = new Array(len);

  for (let i = 0; i < kPeriod - 1 && i < len; i++) {
    fastK[i] = null;
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
      fastK[i] = null;
      continue;
    }
    const currentClose = getKlineClose(currentKline);

    if (highestHigh === lowestLow) {
      fastK[i] = 50;
      continue;
    }

    fastK[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  const slowK = calculatePureSMA(fastK, kSmoothing);
  const slowD = calculatePureSMA(slowK, dPeriod);

  return { k: slowK, d: slowD };
};

export interface StochasticConfig {
  kPeriod: number;
  kSmoothing: number;
  dPeriod: number;
  enabled: boolean;
  kColor: string;
  dColor: string;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticConfig = {
  kPeriod: 14,
  kSmoothing: 3,
  dPeriod: 3,
  enabled: false,
  kColor: '#2196f3',
  dColor: '#ff5722',
  overboughtLevel: 80,
  oversoldLevel: 20,
};
