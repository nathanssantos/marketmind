import type { FibonacciResolverInput, FibonacciResolverResult } from './types';

const LEVEL_TOLERANCE = 0.001;
const FALLBACK_LEVEL = 1.618;

export const resolveFibonacciTarget = (input: FibonacciResolverInput): FibonacciResolverResult => {
  const { fibonacciProjection, entryPrice, direction, targetLevel, targetLevelLong, targetLevelShort } = input;

  if (!fibonacciProjection?.levels || fibonacciProjection.levels.length === 0) {
    return {
      price: null,
      level: null,
      source: 'none',
    };
  }

  const { levels, primaryLevel } = fibonacciProjection;

  const directionSpecificLevel = direction === 'LONG' ? targetLevelLong : targetLevelShort;
  const resolvedLevel = directionSpecificLevel ?? targetLevel ?? 'auto';

  const effectiveTargetLevel = resolvedLevel === 'auto'
    ? primaryLevel
    : parseFloat(resolvedLevel);

  const targetLevelData = levels.find(
    (l) => Math.abs(l.level - effectiveTargetLevel) < LEVEL_TOLERANCE
  );

  if (targetLevelData) {
    const isValidTarget = direction === 'LONG'
      ? targetLevelData.price > entryPrice
      : targetLevelData.price < entryPrice;

    if (isValidTarget) {
      return {
        price: targetLevelData.price,
        level: targetLevelData.level,
        source: 'fibonacci',
      };
    }
  }

  const level1618 = levels.find(
    (l) => Math.abs(l.level - FALLBACK_LEVEL) < LEVEL_TOLERANCE
  );

  if (level1618) {
    const isValidFallback = direction === 'LONG'
      ? level1618.price > entryPrice
      : level1618.price < entryPrice;

    if (isValidFallback) {
      return {
        price: level1618.price,
        level: level1618.level,
        source: 'fallback-1.618',
      };
    }
  }

  return {
    price: null,
    level: null,
    source: 'none',
  };
};

export const FIBONACCI_DEFAULTS = {
  LEVEL_TOLERANCE,
  FALLBACK_LEVEL,
} as const;
