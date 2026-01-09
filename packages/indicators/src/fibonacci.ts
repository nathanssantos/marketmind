import type { Kline } from '@marketmind/types';
import {
    findHighestSwingHigh,
    findLowestSwingLow,
    findSwingHighAfter,
    findSwingLowAfter,
    SWING_POINT_DEFAULTS,
} from './swingPoints';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618] as const;

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

export interface FibonacciResult {
  levels: FibonacciLevel[];
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
}

export const calculateFibonacciRetracement = (
  swingHigh: number,
  swingLow: number,
  direction: 'up' | 'down' = 'up',
): FibonacciLevel[] => {
  const range = swingHigh - swingLow;

  return FIBONACCI_LEVELS.map((level) => {
    const price =
      direction === 'up' ? swingHigh - range * level : swingLow + range * level;

    return {
      level,
      price,
      label: `${(level * 100).toFixed(1)}%`,
    };
  });
};

export const calculateAutoFibonacci = (
  klines: Kline[],
  lookback: number = 50,
): FibonacciResult | null => {
  if (klines.length < lookback) {
    return null;
  }

  const recentKlines = klines.slice(-lookback);

  let highestIndex = 0;
  let lowestIndex = 0;
  let highestValue = getKlineHigh(recentKlines[0]!);
  let lowestValue = getKlineLow(recentKlines[0]!);

  for (let i = 1; i < recentKlines.length; i++) {
    const high = getKlineHigh(recentKlines[i]!);
    const low = getKlineLow(recentKlines[i]!);

    if (high > highestValue) {
      highestValue = high;
      highestIndex = i;
    }

    if (low < lowestValue) {
      lowestValue = low;
      lowestIndex = i;
    }
  }

  const direction = highestIndex > lowestIndex ? 'up' : 'down';
  const levels = calculateFibonacciRetracement(highestValue, lowestValue, direction);

  return {
    levels,
    swingHigh: highestValue,
    swingLow: lowestValue,
    direction,
  };
};

export const calculateFibonacciExtension = (
  point1: number,
  point2: number,
  point3: number,
): FibonacciLevel[] => {
  const range = Math.abs(point2 - point1);
  const direction = point2 > point1 ? 'up' : 'down';

  const extensionLevels = [1, 1.272, 1.618, 2, 2.618, 3.618, 4.236];

  return extensionLevels.map((level) => {
    const price = direction === 'up' ? point3 + range * (level - 1) : point3 - range * (level - 1);

    return {
      level,
      price,
      label: `${(level * 100).toFixed(1)}%`,
    };
  });
};

export const FIBONACCI_EXTENSION_LEVELS = [1.272, 1.618, 2] as const;

export interface SwingPointWithIndex {
  price: number;
  index: number;
  timestamp: number;
}

export interface FibonacciProjectionResult {
  levels: FibonacciLevel[];
  swingLow: SwingPointWithIndex;
  swingHigh: SwingPointWithIndex;
  direction: 'up' | 'down';
  range: number;
}

export const calculateFibonacciProjection = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 50,
  direction: 'LONG' | 'SHORT',
): FibonacciProjectionResult | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  if (endIndex - startIndex < 10) return null;

  const fractalBars = SWING_POINT_DEFAULTS.FRACTAL_BARS_LEFT;

  let swingLowResult: { price: number; index: number; timestamp: number } | null = null;
  let swingHighResult: { price: number; index: number; timestamp: number } | null = null;

  if (direction === 'LONG') {
    const highResult = findHighestSwingHigh(klines, endIndex, lookback, fractalBars);
    if (!highResult) return null;
    swingHighResult = { price: highResult.price, index: highResult.index, timestamp: highResult.timestamp };

    const lowResult = findSwingLowAfter(klines, swingHighResult.index, endIndex, fractalBars);
    if (!lowResult) return null;
    swingLowResult = { price: lowResult.price, index: lowResult.index, timestamp: lowResult.timestamp };
  } else {
    const lowResult = findLowestSwingLow(klines, endIndex, lookback, fractalBars);
    if (!lowResult) return null;
    swingLowResult = { price: lowResult.price, index: lowResult.index, timestamp: lowResult.timestamp };

    const highResult = findSwingHighAfter(klines, swingLowResult.index, endIndex, fractalBars);
    if (!highResult) return null;
    swingHighResult = { price: highResult.price, index: highResult.index, timestamp: highResult.timestamp };
  }

  const swingLow: SwingPointWithIndex = {
    price: swingLowResult.price,
    index: swingLowResult.index,
    timestamp: swingLowResult.timestamp,
  };

  const swingHigh: SwingPointWithIndex = {
    price: swingHighResult.price,
    index: swingHighResult.index,
    timestamp: swingHighResult.timestamp,
  };

  const range = swingHigh.price - swingLow.price;

  if (range <= 0) return null;

  const levels: FibonacciLevel[] = FIBONACCI_EXTENSION_LEVELS.map((level) => {
    const extensionAmount = range * (level - 1);
    const price =
      direction === 'LONG'
        ? swingHigh.price + extensionAmount
        : swingLow.price - extensionAmount;

    return {
      level,
      price,
      label: `${(level * 100).toFixed(1)}%`,
    };
  });

  const fibDirection = swingHigh.index > swingLow.index ? 'up' : 'down';

  return {
    levels,
    swingLow,
    swingHigh,
    direction: fibDirection,
    range,
  };
};
