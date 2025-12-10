import type { Kline } from '@marketmind/types';

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
