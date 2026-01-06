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

export const FIBONACCI_EXTENSION_LEVELS = [1.272, 1.618, 2, 2.618, 3.618, 4.236] as const;

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

const findSwingLow = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): { price: number; localIndex: number; timestamp: number } | null => {
  if (endIndex - startIndex < 3) return null;

  let lowestPrice = Infinity;
  let lowestIndex = -1;

  for (let i = startIndex + 1; i < endIndex - 1; i++) {
    const kline = klines[i];
    if (!kline) continue;

    const prevKline = klines[i - 1];
    const nextKline = klines[i + 1];
    if (!prevKline || !nextKline) continue;

    const low = getKlineLow(kline);
    const prevLow = getKlineLow(prevKline);
    const nextLow = getKlineLow(nextKline);

    if (low <= prevLow && low <= nextLow && low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) {
    for (let i = startIndex; i <= endIndex; i++) {
      const kline = klines[i];
      if (!kline) continue;
      const low = getKlineLow(kline);
      if (low < lowestPrice) {
        lowestPrice = low;
        lowestIndex = i;
      }
    }
  }

  if (lowestIndex === -1) return null;

  const kline = klines[lowestIndex];
  return {
    price: lowestPrice,
    localIndex: lowestIndex,
    timestamp: kline ? Number(kline.openTime) : 0,
  };
};

const findSwingHigh = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): { price: number; localIndex: number; timestamp: number } | null => {
  if (endIndex - startIndex < 3) return null;

  let highestPrice = -Infinity;
  let highestIndex = -1;

  for (let i = startIndex + 1; i < endIndex - 1; i++) {
    const kline = klines[i];
    if (!kline) continue;

    const prevKline = klines[i - 1];
    const nextKline = klines[i + 1];
    if (!prevKline || !nextKline) continue;

    const high = getKlineHigh(kline);
    const prevHigh = getKlineHigh(prevKline);
    const nextHigh = getKlineHigh(nextKline);

    if (high >= prevHigh && high >= nextHigh && high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) {
    for (let i = startIndex; i <= endIndex; i++) {
      const kline = klines[i];
      if (!kline) continue;
      const high = getKlineHigh(kline);
      if (high > highestPrice) {
        highestPrice = high;
        highestIndex = i;
      }
    }
  }

  if (highestIndex === -1) return null;

  const kline = klines[highestIndex];
  return {
    price: highestPrice,
    localIndex: highestIndex,
    timestamp: kline ? Number(kline.openTime) : 0,
  };
};

export const calculateFibonacciProjection = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 50,
  direction: 'LONG' | 'SHORT',
): FibonacciProjectionResult | null => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const endIndex = currentIndex;

  if (endIndex - startIndex < 10) return null;

  const swingLowResult = findSwingLow(klines, startIndex, endIndex);
  const swingHighResult = findSwingHigh(klines, startIndex, endIndex);

  if (!swingLowResult || !swingHighResult) return null;

  const swingLow: SwingPointWithIndex = {
    price: swingLowResult.price,
    index: swingLowResult.localIndex,
    timestamp: swingLowResult.timestamp,
  };

  const swingHigh: SwingPointWithIndex = {
    price: swingHighResult.price,
    index: swingHighResult.localIndex,
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
