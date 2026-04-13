import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';
import {
  findRecentHigh,
  findRecentLow,
  findZigZagHighs,
  findZigZagLows,
  calculateMinSwingSize,
} from './swingPointHelpers';

export { type MarketStructure, detectMarketStructure, validateSwingWithStructure } from './swingPointStructure';

const DEFAULT_SWING_LOOKBACK = 5;
const DEFAULT_FRACTAL_BARS = 2;
const DEFAULT_ATR_MULTIPLIER = 2.0;
const DEFAULT_PERCENT_THRESHOLD = 3.0;

export interface SwingPoint {
  index: number;
  type: 'high' | 'low';
  price: number;
  timestamp: number;
}

export interface SwingPointsResult {
  swingHighs: (number | null)[];
  swingLows: (number | null)[];
  swingPoints: SwingPoint[];
}

export interface SwingPointConfig {
  lookback?: number;
  fractalBarsLeft?: number;
  fractalBarsRight?: number;
}

export const SWING_POINT_DEFAULTS = {
  LOOKBACK: DEFAULT_SWING_LOOKBACK,
  FRACTAL_BARS_LEFT: DEFAULT_FRACTAL_BARS,
  FRACTAL_BARS_RIGHT: DEFAULT_FRACTAL_BARS,
} as const;

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

export const findSwingHighAfter = (
  klines: Kline[],
  afterIndex: number,
  endIndex: number,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  if (endIndex - afterIndex < 1) return null;

  const fractalHighs = findAllFractalHighs(klines, afterIndex + 1, endIndex, fractalBars, fractalBars);

  if (fractalHighs.length > 0) {
    return fractalHighs.sort((a, b) => b.price - a.price)[0]!;
  }

  return findRecentHigh(klines, afterIndex + 1, endIndex);
};

export const findSwingLowAfter = (
  klines: Kline[],
  afterIndex: number,
  endIndex: number,
  fractalBars: number = DEFAULT_FRACTAL_BARS
): SwingPoint | null => {
  if (endIndex - afterIndex < 1) return null;

  const fractalLows = findAllFractalLows(klines, afterIndex + 1, endIndex, fractalBars, fractalBars);

  if (fractalLows.length > 0) {
    return fractalLows.sort((a, b) => a.price - b.price)[0]!;
  }

  return findRecentLow(klines, afterIndex + 1, endIndex);
};

export const calculateSwingPoints = (
  klines: Kline[],
  lookback: number = DEFAULT_SWING_LOOKBACK,
): SwingPointsResult => {
  if (klines.length === 0 || lookback <= 0) {
    return { swingHighs: [], swingLows: [], swingPoints: [] };
  }

  const swingHighs: (number | null)[] = [];
  const swingLows: (number | null)[] = [];
  const swingPoints: SwingPoint[] = [];

  for (let i = 0; i < klines.length; i++) {
    swingHighs.push(null);
    swingLows.push(null);

    if (i < lookback || i >= klines.length - lookback) {
      continue;
    }

    const currentKline = klines[i]!;
    const currentHigh = getKlineHigh(currentKline);
    const currentLow = getKlineLow(currentKline);

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (getKlineHigh(klines[i - j]!) >= currentHigh) isSwingHigh = false;
      if (getKlineHigh(klines[i + j]!) >= currentHigh) isSwingHigh = false;
      if (getKlineLow(klines[i - j]!) <= currentLow) isSwingLow = false;
      if (getKlineLow(klines[i + j]!) <= currentLow) isSwingLow = false;
    }

    if (isSwingHigh) {
      swingHighs[i] = currentHigh;
      swingPoints.push({
        index: i,
        type: 'high',
        price: currentHigh,
        timestamp: currentKline.openTime,
      });
    }

    if (isSwingLow) {
      swingLows[i] = currentLow;
      swingPoints.push({
        index: i,
        type: 'low',
        price: currentLow,
        timestamp: currentKline.openTime,
      });
    }
  }

  swingPoints.sort((a, b) => a.index - b.index);

  return { swingHighs, swingLows, swingPoints };
};

export const calculateSwingHighLowLevels = (
  klines: Kline[],
  lookback: number = DEFAULT_SWING_LOOKBACK,
  maxLevels: number = 10,
): { resistanceLevels: number[]; supportLevels: number[] } => {
  const { swingPoints } = calculateSwingPoints(klines, lookback);

  const highPrices = swingPoints.filter((p) => p.type === 'high').map((p) => p.price);
  const lowPrices = swingPoints.filter((p) => p.type === 'low').map((p) => p.price);

  const resistanceLevels = highPrices.slice(-maxLevels).sort((a, b) => b - a);
  const supportLevels = lowPrices.slice(-maxLevels).sort((a, b) => a - b);

  return { resistanceLevels, supportLevels };
};

export const findAdaptiveFractalHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);

  for (const period of [2, 3, 4, 5, 7, 9]) {
    const fractals = findAllFractalHighs(klines, startIndex, currentIndex, period, period);

    if (fractals.length > 0) {
      return fractals.sort((a, b) => b.price - a.price)[0]!;
    }
  }

  return findRecentHigh(klines, startIndex, currentIndex);
};

export const findAdaptiveFractalLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);

  for (const period of [2, 3, 4, 5, 7, 9]) {
    const fractals = findAllFractalLows(klines, startIndex, currentIndex, period, period);

    if (fractals.length > 0) {
      return fractals.sort((a, b) => a.price - b.price)[0]!;
    }
  }

  return findRecentLow(klines, startIndex, currentIndex);
};

export const findSignificantSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
  atrMultiplier: number = DEFAULT_ATR_MULTIPLIER,
  percentThreshold: number = DEFAULT_PERCENT_THRESHOLD,
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
  atrMultiplier: number = DEFAULT_ATR_MULTIPLIER,
  percentThreshold: number = DEFAULT_PERCENT_THRESHOLD,
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
  atrMultiplier: number = DEFAULT_ATR_MULTIPLIER,
  percentThreshold: number = DEFAULT_PERCENT_THRESHOLD,
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
  atrMultiplier: number = DEFAULT_ATR_MULTIPLIER,
  percentThreshold: number = DEFAULT_PERCENT_THRESHOLD,
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

export const findNearestFractalHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);

  for (const period of [2, 3, 4, 5, 7, 9]) {
    const fractals = findAllFractalHighs(klines, startIndex, currentIndex, period, period);

    if (fractals.length > 0) {
      return fractals.sort((a, b) => b.index - a.index)[0]!;
    }
  }

  return findRecentHigh(klines, startIndex, currentIndex);
};

export const findNearestFractalLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): SwingPoint | null => {
  const startIndex = Math.max(0, currentIndex - lookback);

  for (const period of [2, 3, 4, 5, 7, 9]) {
    const fractals = findAllFractalLows(klines, startIndex, currentIndex, period, period);

    if (fractals.length > 0) {
      return fractals.sort((a, b) => b.index - a.index)[0]!;
    }
  }

  return findRecentLow(klines, startIndex, currentIndex);
};
