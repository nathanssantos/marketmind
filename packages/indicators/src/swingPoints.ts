import type { Kline } from '@marketmind/types';
import { calculateATR } from './atr';

const DEFAULT_SWING_LOOKBACK = 5;
const DEFAULT_FRACTAL_BARS = 2;
const DEFAULT_ATR_MULTIPLIER = 2.0;
const DEFAULT_PERCENT_THRESHOLD = 3.0;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

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

  let highestPrice = -Infinity;
  let highestIndex = -1;
  for (let i = endIndex; i >= startIndex; i--) {
    const kline = klines[i];
    if (!kline) continue;
    const high = getKlineHigh(kline);
    if (high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) return null;
  const kline = klines[highestIndex]!;
  return {
    index: highestIndex,
    type: 'high',
    price: highestPrice,
    timestamp: Number(kline.openTime),
  };
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

  let lowestPrice = Infinity;
  let lowestIndex = -1;
  for (let i = endIndex; i >= startIndex; i--) {
    const kline = klines[i];
    if (!kline) continue;
    const low = getKlineLow(kline);
    if (low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) return null;
  const kline = klines[lowestIndex]!;
  return {
    index: lowestIndex,
    type: 'low',
    price: lowestPrice,
    timestamp: Number(kline.openTime),
  };
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

  let highestPrice = -Infinity;
  let highestIndex = -1;
  for (let i = startIndex; i <= endIndex; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const high = getKlineHigh(kline);
    if (high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) return null;
  const kline = klines[highestIndex]!;
  return {
    index: highestIndex,
    type: 'high',
    price: highestPrice,
    timestamp: Number(kline.openTime),
  };
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

  let lowestPrice = Infinity;
  let lowestIndex = -1;
  for (let i = startIndex; i <= endIndex; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const low = getKlineLow(kline);
    if (low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) return null;
  const kline = klines[lowestIndex]!;
  return {
    index: lowestIndex,
    type: 'low',
    price: lowestPrice,
    timestamp: Number(kline.openTime),
  };
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

  let highestPrice = -Infinity;
  let highestIndex = -1;

  for (let i = afterIndex + 1; i <= endIndex; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const high = getKlineHigh(kline);
    if (high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) return null;
  const kline = klines[highestIndex]!;
  return {
    index: highestIndex,
    type: 'high',
    price: highestPrice,
    timestamp: Number(kline.openTime),
  };
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

  let lowestPrice = Infinity;
  let lowestIndex = -1;

  for (let i = afterIndex + 1; i <= endIndex; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const low = getKlineLow(kline);
    if (low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) return null;
  const kline = klines[lowestIndex]!;
  return {
    index: lowestIndex,
    type: 'low',
    price: lowestPrice,
    timestamp: Number(kline.openTime),
  };
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

export interface MarketStructure {
  type: 'uptrend' | 'downtrend' | 'ranging';
  higherHighs: SwingPoint[];
  higherLows: SwingPoint[];
  lowerHighs: SwingPoint[];
  lowerLows: SwingPoint[];
  breakOfStructure: boolean;
}

const isPivotHigh = (
  klines: Kline[],
  index: number,
  period: number = 5,
): boolean => {
  const leftBars = Math.floor(period / 2);
  const rightBars = Math.floor(period / 2);

  if (index < leftBars || index >= klines.length - rightBars) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerHigh = getKlineHigh(centerKline);

  for (let i = 1; i <= leftBars; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineHigh(leftKline) >= centerHigh) return false;
  }

  for (let i = 1; i <= rightBars; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineHigh(rightKline) >= centerHigh) return false;
  }

  return true;
};

const isPivotLow = (
  klines: Kline[],
  index: number,
  period: number = 5,
): boolean => {
  const leftBars = Math.floor(period / 2);
  const rightBars = Math.floor(period / 2);

  if (index < leftBars || index >= klines.length - rightBars) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerLow = getKlineLow(centerKline);

  for (let i = 1; i <= leftBars; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineLow(leftKline) <= centerLow) return false;
  }

  for (let i = 1; i <= rightBars; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineLow(rightKline) <= centerLow) return false;
  }

  return true;
};

const findRecentLow = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null => {
  let lowestPrice = Infinity;
  let lowestIndex = -1;

  for (let i = startIndex; i <= endIndex && i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const low = getKlineLow(kline);
    if (low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) return null;

  const kline = klines[lowestIndex]!;
  return {
    index: lowestIndex,
    type: 'low',
    price: lowestPrice,
    timestamp: Number(kline.openTime),
  };
};

const findRecentHigh = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null => {
  let highestPrice = -Infinity;
  let highestIndex = -1;

  for (let i = startIndex; i <= endIndex && i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const high = getKlineHigh(kline);
    if (high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) return null;

  const kline = klines[highestIndex]!;
  return {
    index: highestIndex,
    type: 'high',
    price: highestPrice,
    timestamp: Number(kline.openTime),
  };
};

const findZigZagHighs = (
  klines: Kline[],
  currentIndex: number,
  lookback: number,
  minSwingSize: number,
): SwingPoint[] => {
  const highs: SwingPoint[] = [];
  const startIndex = Math.max(0, currentIndex - lookback);

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotHigh(klines, i, 5)) {
      const kline = klines[i]!;
      const high = getKlineHigh(kline);

      const recentLow = findRecentLow(klines, Math.max(0, i - lookback), i);
      if (recentLow && (high - recentLow.price) >= minSwingSize) {
        highs.push({
          index: i,
          type: 'high',
          price: high,
          timestamp: Number(kline.openTime),
        });
      }
    }
  }

  return highs;
};

const findZigZagLows = (
  klines: Kline[],
  currentIndex: number,
  lookback: number,
  minSwingSize: number,
): SwingPoint[] => {
  const lows: SwingPoint[] = [];
  const startIndex = Math.max(0, currentIndex - lookback);

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotLow(klines, i, 5)) {
      const kline = klines[i]!;
      const low = getKlineLow(kline);

      const recentHigh = findRecentHigh(klines, Math.max(0, i - lookback), i);
      if (recentHigh && (recentHigh.price - low) >= minSwingSize) {
        lows.push({
          index: i,
          type: 'low',
          price: low,
          timestamp: Number(kline.openTime),
        });
      }
    }
  }

  return lows;
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

  let minSwingSize: number;

  if (useATR) {
    const atrValues = calculateATR(klines.slice(0, currentIndex + 1), 14);
    const currentATR = atrValues[atrValues.length - 1];
    if (!currentATR || isNaN(currentATR)) {
      const closePrice = getKlineClose(klines[currentIndex]!);
      minSwingSize = closePrice * (percentThreshold / 100);
    } else {
      minSwingSize = currentATR * atrMultiplier;
    }
  } else {
    const closePrice = getKlineClose(klines[currentIndex]!);
    minSwingSize = closePrice * (percentThreshold / 100);
  }

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

  let minSwingSize: number;

  if (useATR) {
    const atrValues = calculateATR(klines.slice(0, currentIndex + 1), 14);
    const currentATR = atrValues[atrValues.length - 1];
    if (!currentATR || isNaN(currentATR)) {
      const closePrice = getKlineClose(klines[currentIndex]!);
      minSwingSize = closePrice * (percentThreshold / 100);
    } else {
      minSwingSize = currentATR * atrMultiplier;
    }
  } else {
    const closePrice = getKlineClose(klines[currentIndex]!);
    minSwingSize = closePrice * (percentThreshold / 100);
  }

  const significantLows = findZigZagLows(klines, currentIndex, lookback, minSwingSize);

  if (significantLows.length === 0) return null;

  return significantLows.sort((a, b) => a.price - b.price)[0]!;
};

export const detectMarketStructure = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): MarketStructure => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const allSwingPoints: SwingPoint[] = [];

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotHigh(klines, i, 5)) {
      const kline = klines[i]!;
      allSwingPoints.push({
        index: i,
        type: 'high',
        price: getKlineHigh(kline),
        timestamp: Number(kline.openTime),
      });
    }
    if (isPivotLow(klines, i, 5)) {
      const kline = klines[i]!;
      allSwingPoints.push({
        index: i,
        type: 'low',
        price: getKlineLow(kline),
        timestamp: Number(kline.openTime),
      });
    }
  }

  allSwingPoints.sort((a, b) => a.index - b.index);

  const higherHighs: SwingPoint[] = [];
  const higherLows: SwingPoint[] = [];
  const lowerHighs: SwingPoint[] = [];
  const lowerLows: SwingPoint[] = [];

  const highs = allSwingPoints.filter(p => p.type === 'high');
  const lows = allSwingPoints.filter(p => p.type === 'low');

  for (let i = 1; i < highs.length; i++) {
    if (highs[i]!.price > highs[i - 1]!.price) higherHighs.push(highs[i]!);
    else if (highs[i]!.price < highs[i - 1]!.price) lowerHighs.push(highs[i]!);
  }

  for (let i = 1; i < lows.length; i++) {
    if (lows[i]!.price > lows[i - 1]!.price) higherLows.push(lows[i]!);
    else if (lows[i]!.price < lows[i - 1]!.price) lowerLows.push(lows[i]!);
  }

  let type: 'uptrend' | 'downtrend' | 'ranging' = 'ranging';

  if (higherHighs.length >= 2 && higherLows.length >= 2) {
    type = 'uptrend';
  } else if (lowerHighs.length >= 2 && lowerLows.length >= 2) {
    type = 'downtrend';
  }

  const breakOfStructure = false;

  return {
    type,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    breakOfStructure,
  };
};

export const validateSwingWithStructure = (
  klines: Kline[],
  swingPoint: SwingPoint,
  lookback: number = 100,
): { valid: boolean; reason: string } => {
  const structure = detectMarketStructure(klines, swingPoint.index, lookback);

  if (swingPoint.type === 'high') {
    const isHigherHigh = structure.higherHighs.some(
      hh => hh.price <= swingPoint.price && hh.index < swingPoint.index
    );

    return {
      valid: isHigherHigh || structure.type === 'uptrend',
      reason: isHigherHigh
        ? 'confirmed_higher_high'
        : structure.type === 'uptrend'
          ? 'uptrend_structure'
          : 'not_higher_high'
    };
  }

  const isLowerLow = structure.lowerLows.some(
    ll => ll.price >= swingPoint.price && ll.index < swingPoint.index
  );

  return {
    valid: isLowerLow || structure.type === 'downtrend',
    reason: isLowerLow
      ? 'confirmed_lower_low'
      : structure.type === 'downtrend'
        ? 'downtrend_structure'
        : 'not_lower_low'
  };
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
