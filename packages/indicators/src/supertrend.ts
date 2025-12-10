import type { Kline } from '@marketmind/types';
import { calculateATR } from './atr';

const DEFAULT_PERIOD = 10;
const DEFAULT_MULTIPLIER = 3;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface SupertrendResult {
  trend: ('up' | 'down' | null)[];
  value: (number | null)[];
}

export const calculateSupertrend = (
  klines: Kline[],
  period = DEFAULT_PERIOD,
  multiplier = DEFAULT_MULTIPLIER,
): SupertrendResult => {
  const length = klines.length;

  if (length < period) {
    return {
      trend: Array(length).fill(null),
      value: Array(length).fill(null),
    };
  }

  const atrValues = calculateATR(klines, period);

  const trend: ('up' | 'down' | null)[] = [];
  const value: (number | null)[] = [];

  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  const finalUpperBand: number[] = [];
  const finalLowerBand: number[] = [];

  for (let i = 0; i < length; i++) {
    const current = klines[i];
    const atr = atrValues[i];

    if (!current || atr === undefined || isNaN(atr)) {
      upperBand.push(NaN);
      lowerBand.push(NaN);
      finalUpperBand.push(NaN);
      finalLowerBand.push(NaN);
      trend.push(null);
      value.push(null);
      continue;
    }

    const hl2 = (getKlineHigh(current) + getKlineLow(current)) / 2;
    const basicUpperBand = hl2 + multiplier * atr;
    const basicLowerBand = hl2 - multiplier * atr;

    upperBand.push(basicUpperBand);
    lowerBand.push(basicLowerBand);

    if (i === 0) {
      finalUpperBand.push(basicUpperBand);
      finalLowerBand.push(basicLowerBand);
      trend.push('up');
      value.push(basicLowerBand);
      continue;
    }

    const prevClose = getKlineClose(klines[i - 1]!);
    const prevFinalUpperBand = finalUpperBand[i - 1]!;
    const prevFinalLowerBand = finalLowerBand[i - 1]!;

    const currentFinalUpperBand =
      basicUpperBand < prevFinalUpperBand || prevClose > prevFinalUpperBand
        ? basicUpperBand
        : prevFinalUpperBand;

    const currentFinalLowerBand =
      basicLowerBand > prevFinalLowerBand || prevClose < prevFinalLowerBand
        ? basicLowerBand
        : prevFinalLowerBand;

    finalUpperBand.push(currentFinalUpperBand);
    finalLowerBand.push(currentFinalLowerBand);

    const close = getKlineClose(current);
    const prevTrend = trend[i - 1];

    let currentTrend: 'up' | 'down';
    let currentValue: number;

    if (prevTrend === 'up') {
      if (close < currentFinalLowerBand) {
        currentTrend = 'down';
        currentValue = currentFinalUpperBand;
      } else {
        currentTrend = 'up';
        currentValue = currentFinalLowerBand;
      }
    } else if (prevTrend === 'down') {
      if (close > currentFinalUpperBand) {
        currentTrend = 'up';
        currentValue = currentFinalLowerBand;
      } else {
        currentTrend = 'down';
        currentValue = currentFinalUpperBand;
      }
    } else {
      currentTrend = close > hl2 ? 'up' : 'down';
      currentValue = currentTrend === 'up' ? currentFinalLowerBand : currentFinalUpperBand;
    }

    trend.push(currentTrend);
    value.push(currentValue);
  }

  return { trend, value };
};
