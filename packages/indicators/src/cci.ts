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

  const typicalPrices: number[] = klines.map(getTypicalPrice);
  const result: CCIResult = [];

  for (let i = 0; i < length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    const slice = typicalPrices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((acc, val) => acc + val, 0) / period;

    const meanDeviation = slice.reduce((acc, val) => acc + Math.abs(val - sma), 0) / period;

    if (meanDeviation === 0) {
      result.push(0);
    } else {
      const tp = typicalPrices[i];
      if (tp === undefined) {
        result.push(null);
        continue;
      }
      const cci = (tp - sma) / (CCI_CONSTANT * meanDeviation);
      result.push(cci);
    }
  }

  return result;
};
