import type { Kline } from '@marketmind/types';

const DEFAULT_WMA_PERIOD = 20;

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface WMAResult {
  values: (number | null)[];
}

export const calculateWMA = (klines: Kline[], period: number = DEFAULT_WMA_PERIOD): WMAResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      values.push(null);
      continue;
    }

    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      const kline = klines[i - j];
      if (!kline) {
        values.push(null);
        break;
      }
      const weight = period - j;
      weightedSum += getKlineClose(kline) * weight;
    }

    if (values.length === i) {
      values.push(weightedSum / denominator);
    }
  }

  return { values };
};

export const calculateWMAFromValues = (values: number[], period: number): (number | null)[] => {
  if (values.length === 0 || period <= 0) {
    return [];
  }

  const result: (number | null)[] = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      const weight = period - j;
      weightedSum += (values[i - j] ?? 0) * weight;
    }

    result.push(weightedSum / denominator);
  }

  return result;
};
