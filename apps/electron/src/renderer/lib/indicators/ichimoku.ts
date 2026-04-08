import type { Kline } from '@marketmind/types';

export interface IchimokuResult {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

const calculateAverage = (high: number, low: number): number => {
  return (high + low) / 2;
};

const getHighestHigh = (klines: Kline[], startIdx: number, period: number): number => {
  let highest = -Infinity;
  for (let i = Math.max(0, startIdx - period + 1); i <= startIdx; i++) {
    const high = parseFloat(klines[i]!.high);
    if (high > highest) highest = high;
  }
  return highest;
};

const getLowestLow = (klines: Kline[], startIdx: number, period: number): number => {
  let lowest = Infinity;
  for (let i = Math.max(0, startIdx - period + 1); i <= startIdx; i++) {
    const low = parseFloat(klines[i]!.low);
    if (low < lowest) lowest = low;
  }
  return lowest;
};

export const calculateIchimoku = (
  klines: Kline[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
  displacement: number = 26
): IchimokuResult => {
  const len = klines.length;
  const tenkan: (number | null)[] = new Array(len).fill(null);
  const kijun: (number | null)[] = new Array(len).fill(null);
  const senkouA: (number | null)[] = new Array(len).fill(null);
  const senkouB: (number | null)[] = new Array(len).fill(null);
  const chikou: (number | null)[] = new Array(len).fill(null);

  if (len === 0) {
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }

  for (let i = tenkanPeriod - 1; i < len; i++) {
    const highestHigh = getHighestHigh(klines, i, tenkanPeriod);
    const lowestLow = getLowestLow(klines, i, tenkanPeriod);
    tenkan[i] = calculateAverage(highestHigh, lowestLow);
  }

  for (let i = kijunPeriod - 1; i < len; i++) {
    const highestHigh = getHighestHigh(klines, i, kijunPeriod);
    const lowestLow = getLowestLow(klines, i, kijunPeriod);
    kijun[i] = calculateAverage(highestHigh, lowestLow);
  }

  for (let i = kijunPeriod - 1; i < len; i++) {
    if (tenkan[i] !== null && kijun[i] !== null) {
      const futureIdx = i + displacement;
      if (futureIdx < len) {
        senkouA[futureIdx] = (tenkan[i]! + kijun[i]!) / 2;
      }
    }
  }

  for (let i = senkouBPeriod - 1; i < len; i++) {
    const highestHigh = getHighestHigh(klines, i, senkouBPeriod);
    const lowestLow = getLowestLow(klines, i, senkouBPeriod);
    const futureIdx = i + displacement;
    if (futureIdx < len) {
      senkouB[futureIdx] = calculateAverage(highestHigh, lowestLow);
    }
  }

  for (let i = 0; i < len - displacement; i++) {
    chikou[i] = parseFloat(klines[i + displacement]!.close);
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
};
