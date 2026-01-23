import { FIBONACCI_RETRACEMENT_LEVELS, FIBONACCI_ALL_LEVELS, formatFibonacciLabel } from './levels';
import type { FibonacciLevelData, SwingPointWithIndex } from './types';

export const calculateFibonacciRetracement = (
  swingHigh: number,
  swingLow: number,
  direction: 'up' | 'down' = 'up',
): FibonacciLevelData[] => {
  const range = swingHigh - swingLow;

  return FIBONACCI_RETRACEMENT_LEVELS.map((level) => {
    const price =
      direction === 'up' ? swingHigh - range * level : swingLow + range * level;

    return {
      level,
      price,
      label: formatFibonacciLabel(level),
    };
  });
};

export const calculateFibonacciExtension = (
  point1: number,
  point2: number,
  point3: number,
): FibonacciLevelData[] => {
  const range = Math.abs(point2 - point1);
  const direction = point2 > point1 ? 'up' : 'down';

  const extensionLevels = [1, 1.272, 1.618, 2, 2.618, 3.618, 4.236];

  return extensionLevels.map((level) => {
    const price = direction === 'up' ? point3 + range * (level - 1) : point3 - range * (level - 1);

    return {
      level,
      price,
      label: formatFibonacciLabel(level),
    };
  });
};

export const calculateProjectionLevels = (
  swingLow: SwingPointWithIndex,
  swingHigh: SwingPointWithIndex,
  direction: 'LONG' | 'SHORT',
): FibonacciLevelData[] => {
  const range = swingHigh.price - swingLow.price;

  if (range <= 0) return [];

  return FIBONACCI_ALL_LEVELS.map((level) => {
    let price: number;

    if (level <= 1) {
      price = direction === 'LONG'
        ? swingLow.price + range * level
        : swingHigh.price - range * level;
    } else {
      const extensionAmount = range * (level - 1);
      price = direction === 'LONG'
        ? swingHigh.price + extensionAmount
        : swingLow.price - extensionAmount;
    }

    return {
      level,
      price,
      label: formatFibonacciLabel(level),
    };
  });
};
