import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';
import {
  findRecentHigh,
  findRecentLow,
  findZigZagHighs,
  findZigZagLows,
  calculateMinSwingSize,
} from './swingPointHelpers';

const DEFAULT_SWING_LOOKBACK = 5;
const DEFAULT_FRACTAL_BARS = 2;

export interface SwingPoint {
  index: number;
  type: 'high' | 'low';
  price: number;
  timestamp: number;
}

export const isFractalHigh = (
  klines: Kline[],
  index: number,
  barsLeft: number = DEFAULT_FRACTAL_BARS,
  barsRight: number = DEFAULT_FRACTAL_BARS
): boolean => {
  if (index < barsLeft || index >= klines.length - barsRight) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerHigh = getKlineHigh(centerKline);

  for (let i = 1; i <= barsLeft; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineHigh(leftKline) >= centerHigh) return false;
  }

  for (let i = 1; i <= barsRight; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineHigh(rightKline) >= centerHigh) return false;
  }

  return true;
};

export const isFractalLow = (
  klines: Kline[],
  index: number,
  barsLeft: number = DEFAULT_FRACTAL_BARS,
  barsRight: number = DEFAULT_FRACTAL_BARS
): boolean => {
  if (index < barsLeft || index >= klines.length - barsRight) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerLow = getKlineLow(centerKline);

  for (let i = 1; i <= barsLeft; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineLow(leftKline) <= centerLow) return false;
  }

  for (let i = 1; i <= barsRight; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineLow(rightKline) <= centerLow) return false;
  }

  return true;
};

export const findAllFractalHighs = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
  barsLeft: number = DEFAULT_FRACTAL_BARS,
  barsRight: number = DEFAULT_FRACTAL_BARS
): SwingPoint[] => {
  const fractals: SwingPoint[] = [];

  for (let i = Math.max(startIndex, barsLeft); i <= Math.min(endIndex, klines.length - 1 - barsRight); i++) {
    if (isFractalHigh(klines, i, barsLeft, barsRight)) {
      const kline = klines[i]!;
      fractals.push({
        index: i,
        type: 'high',
        price: getKlineHigh(kline),
        timestamp: Number(kline.openTime),
      });
    }
  }

  return fractals;
};

export const findAllFractalLows = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
  barsLeft: number = DEFAULT_FRACTAL_BARS,
  barsRight: number = DEFAULT_FRACTAL_BARS
): SwingPoint[] => {
  const fractals: SwingPoint[] = [];

  for (let i = Math.max(startIndex, barsLeft); i <= Math.min(endIndex, klines.length - 1 - barsRight); i++) {
    if (isFractalLow(klines, i, barsLeft, barsRight)) {
      const kline = klines[i]!;
      fractals.push({
        index: i,
        type: 'low',
        price: getKlineLow(kline),
        timestamp: Number(kline.openTime),
      });
    }
  }

  return fractals;
};

export const findMostRecentSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = DEFAULT_SWING_LOOKBACK,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  const fractalHighs = findAllFractalHighs(klines, startIndex, endIndex, fractalBars, fractalBars);

  if (fractalHighs.length > 0) {
    return fractalHighs.sort((a, b) => b.index - a.index)[0]!;
  }

  return findRecentHigh(klines, endIndex, startIndex);
};

export const findMostRecentSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = DEFAULT_SWING_LOOKBACK,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  const fractalLows = findAllFractalLows(klines, startIndex, endIndex, fractalBars, fractalBars);

  if (fractalLows.length > 0) {
    return fractalLows.sort((a, b) => b.index - a.index)[0]!;
  }

  return findRecentLow(klines, startIndex, endIndex);
};

export const findHighestSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = DEFAULT_SWING_LOOKBACK,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  const fractalHighs = findAllFractalHighs(klines, startIndex, endIndex, fractalBars, fractalBars);

  if (fractalHighs.length > 0) {
    return fractalHighs.sort((a, b) => b.price - a.price)[0]!;
  }

  return findRecentHigh(klines, startIndex, endIndex);
};

export const findLowestSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = DEFAULT_SWING_LOOKBACK,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  const fractalLows = findAllFractalLows(klines, startIndex, endIndex, fractalBars, fractalBars);

  if (fractalLows.length > 0) {
    return fractalLows.sort((a, b) => a.price - b.price)[0]!;
  }

  return findRecentLow(klines, startIndex, endIndex);
};

export const findSignificantSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
  atrMultiplier: number = 2.0,
  percentThreshold: number = 3.0,
  useATR: boolean = true,
): SwingPoint | null => {
  if (klines.length < 20 || currentIndex < 20) return null;

  const minSwingSize = calculateMinSwingSize(klines, currentIndex, atrMultiplier, percentThreshold, useATR);
  const significantHighs = findZigZagHighs(klines, currentIndex, lookback, minSwingSize);

  if (significantHighs.length === 0) return null;

  return significantHighs.sort((a, b) => b.price - a.price)[0]!;
};

export const findSignificantSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
  atrMultiplier: number = 2.0,
  percentThreshold: number = 3.0,
  useATR: boolean = true,
): SwingPoint | null => {
  if (klines.length < 20 || currentIndex < 20) return null;

  const minSwingSize = calculateMinSwingSize(klines, currentIndex, atrMultiplier, percentThreshold, useATR);
  const significantLows = findZigZagLows(klines, currentIndex, lookback, minSwingSize);

  if (significantLows.length === 0) return null;

  return significantLows.sort((a, b) => a.price - b.price)[0]!;
};

export const findNearestSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
  atrMultiplier: number = 2.0,
  percentThreshold: number = 3.0,
  useATR: boolean = true,
): SwingPoint | null => {
  if (klines.length < 20 || currentIndex < 20) return null;

  const minSwingSize = calculateMinSwingSize(klines, currentIndex, atrMultiplier, percentThreshold, useATR);
  const significantHighs = findZigZagHighs(klines, currentIndex, lookback, minSwingSize);

  if (significantHighs.length === 0) return null;

  const byRecency = significantHighs.sort((a, b) => b.index - a.index);
  const h1 = byRecency[0]!;
  const h2 = byRecency[1];

  if (h2 && h2.price > h1.price) return h2;
  return h1;
};

export const findNearestSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
  atrMultiplier: number = 2.0,
  percentThreshold: number = 3.0,
  useATR: boolean = true,
): SwingPoint | null => {
  if (klines.length < 20 || currentIndex < 20) return null;

  const minSwingSize = calculateMinSwingSize(klines, currentIndex, atrMultiplier, percentThreshold, useATR);
  const significantLows = findZigZagLows(klines, currentIndex, lookback, minSwingSize);

  if (significantLows.length === 0) return null;

  const byRecency = significantLows.sort((a, b) => b.index - a.index);
  const l1 = byRecency[0]!;
  const l2 = byRecency[1];

  if (l2 && l2.price < l1.price) return l2;
  return l1;
};
