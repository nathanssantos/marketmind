import type { Kline } from '@marketmind/types';

const DEFAULT_ROC_PERIOD = 12;

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface ROCResult {
  values: (number | null)[];
}

export const calculateROC = (klines: Kline[], period: number = DEFAULT_ROC_PERIOD): ROCResult => {
  if (klines.length === 0 || period <= 0) {
    return { values: [] };
  }

  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    const currentKline = klines[i];
    const pastKline = klines[i - period];

    if (!currentKline || !pastKline) {
      values.push(null);
      continue;
    }

    const currentClose = getKlineClose(currentKline);
    const pastClose = getKlineClose(pastKline);

    if (pastClose === 0) {
      values.push(null);
      continue;
    }

    const roc = ((currentClose - pastClose) / pastClose) * 100;
    values.push(roc);
  }

  return { values };
};

export const calculateMomentum = (klines: Kline[], period: number = DEFAULT_ROC_PERIOD): (number | null)[] => {
  if (klines.length === 0 || period <= 0) {
    return [];
  }

  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    const currentKline = klines[i];
    const pastKline = klines[i - period];

    if (!currentKline || !pastKline) {
      values.push(null);
      continue;
    }

    const momentum = getKlineClose(currentKline) - getKlineClose(pastKline);
    values.push(momentum);
  }

  return values;
};
