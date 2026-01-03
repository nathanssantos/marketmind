import type { Kline } from '@marketmind/types';

const DEFAULT_CCI_PERIOD = 20;
const CCI_CONSTANT = 0.015;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

const getTypicalPrice = (kline: Kline): number => {
  return (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / 3;
};

export type CCIResult = (number | null)[];

export const calculateCCI = (
  klines: Kline[],
  period = DEFAULT_CCI_PERIOD,
): CCIResult => {
  const length = klines.length;

  if (length < period) {
    return Array(length).fill(null);
  }

  const typicalPrices: number[] = new Array(length);
  for (let i = 0; i < length; i++) {
    typicalPrices[i] = getTypicalPrice(klines[i]!);
  }

  const result: CCIResult = new Array(length);

  for (let i = 0; i < period - 1; i++) {
    result[i] = null;
  }

  for (let i = period - 1; i < length; i++) {
    let sum = 0;
    const startIdx = i - period + 1;

    for (let j = startIdx; j <= i; j++) {
      sum += typicalPrices[j]!;
    }
    const sma = sum / period;

    let meanDeviationSum = 0;
    for (let j = startIdx; j <= i; j++) {
      meanDeviationSum += Math.abs(typicalPrices[j]! - sma);
    }
    const meanDeviation = meanDeviationSum / period;

    if (meanDeviation === 0) {
      result[i] = 0;
    } else {
      const tp = typicalPrices[i];
      if (tp === undefined) {
        result[i] = null;
        continue;
      }
      result[i] = (tp - sma) / (CCI_CONSTANT * meanDeviation);
    }
  }

  return result;
};
