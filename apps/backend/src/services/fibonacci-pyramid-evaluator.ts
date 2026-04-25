import type { PositionSide } from '@marketmind/types';
import {
  FIBONACCI_TARGET_VALUES,
  type FibonacciTargetLevelNumeric,
} from '@marketmind/fibonacci';
import { logger } from './logger';

export type FiboLevel = FibonacciTargetLevelNumeric;

export interface FiboPyramidConfig {
  enabledLevels: FiboLevel[];
  leverage: number;
  leverageAware: boolean;
  baseScaleFactor: number;
}

export interface FiboPyramidEvaluation {
  canPyramid: boolean;
  triggerLevel: FiboLevel | null;
  nextLevel: FiboLevel | null;
  priceAtLevel: number | null;
  distanceToNextPercent: number | null;
  reason: string;
}

export interface TriggeredFiboState {
  symbol: string;
  direction: PositionSide;
  entryPrice: number;
  triggeredLevels: Set<FiboLevel>;
}

const FIBO_LEVEL_VALUES = FIBONACCI_TARGET_VALUES;

const triggeredFiboStateMap = new Map<string, TriggeredFiboState>();

const getStateKey = (symbol: string, direction: PositionSide): string => {
  return `${symbol}-${direction}`;
};

export const initializeFiboState = (
  symbol: string,
  direction: PositionSide,
  entryPrice: number
): void => {
  const key = getStateKey(symbol, direction);
  triggeredFiboStateMap.set(key, {
    symbol,
    direction,
    entryPrice,
    triggeredLevels: new Set(),
  });
};

export const clearFiboState = (symbol: string, direction: PositionSide): void => {
  const key = getStateKey(symbol, direction);
  triggeredFiboStateMap.delete(key);
};

export const getFiboState = (
  symbol: string,
  direction: PositionSide
): TriggeredFiboState | undefined => {
  const key = getStateKey(symbol, direction);
  return triggeredFiboStateMap.get(key);
};

export const calculateFiboTargetPrice = (
  entryPrice: number,
  stopLoss: number,
  direction: PositionSide,
  fiboLevel: FiboLevel
): number => {
  const risk = Math.abs(entryPrice - stopLoss);
  const multiplier = FIBO_LEVEL_VALUES[fiboLevel];

  return direction === 'LONG'
    ? entryPrice + risk * multiplier
    : entryPrice - risk * multiplier;
};

export const evaluateFiboPyramidTrigger = (
  symbol: string,
  direction: PositionSide,
  entryPrice: number,
  stopLoss: number,
  currentPrice: number,
  config: FiboPyramidConfig
): FiboPyramidEvaluation => {
  const key = getStateKey(symbol, direction);
  let state = triggeredFiboStateMap.get(key);

  if (!state) {
    state = {
      symbol,
      direction,
      entryPrice,
      triggeredLevels: new Set(),
    };
    triggeredFiboStateMap.set(key, state);
  }

  const sortedLevels = [...config.enabledLevels].sort(
    (a, b) => FIBO_LEVEL_VALUES[a] - FIBO_LEVEL_VALUES[b]
  );

  const untriggeredLevels = sortedLevels.filter(
    (level) => !state.triggeredLevels.has(level)
  );

  if (untriggeredLevels.length === 0) {
    return {
      canPyramid: false,
      triggerLevel: null,
      nextLevel: null,
      priceAtLevel: null,
      distanceToNextPercent: null,
      reason: 'All enabled Fibonacci levels have been triggered',
    };
  }

  const inProfit = direction === 'LONG'
    ? currentPrice > entryPrice
    : currentPrice < entryPrice;

  if (!inProfit) {
    const nextLevel = untriggeredLevels[0] ?? null;
    const nextLevelPrice = nextLevel
      ? calculateFiboTargetPrice(entryPrice, stopLoss, direction, nextLevel)
      : null;

    return {
      canPyramid: false,
      triggerLevel: null,
      nextLevel,
      priceAtLevel: nextLevelPrice,
      distanceToNextPercent: nextLevelPrice
        ? Math.abs((nextLevelPrice - currentPrice) / currentPrice) * 100
        : null,
      reason: 'Position not in profit',
    };
  }

  let triggeredLevel: FiboLevel | null = null;

  for (const level of untriggeredLevels) {
    const levelPrice = calculateFiboTargetPrice(entryPrice, stopLoss, direction, level);

    const levelReached = direction === 'LONG'
      ? currentPrice >= levelPrice
      : currentPrice <= levelPrice;

    if (levelReached) {
      triggeredLevel = level;
      state.triggeredLevels.add(level);

      logger.info({
        symbol,
        direction,
        level,
        levelPrice: levelPrice.toFixed(4),
        currentPrice: currentPrice.toFixed(4),
      }, '[FiboPyramid] Fibonacci level triggered');
    }
  }

  if (triggeredLevel) {
    const remainingLevels = untriggeredLevels.filter(
      (l) => !state.triggeredLevels.has(l)
    );
    const nextLevel = remainingLevels[0] ?? null;
    const nextLevelPrice = nextLevel
      ? calculateFiboTargetPrice(entryPrice, stopLoss, direction, nextLevel)
      : null;

    return {
      canPyramid: true,
      triggerLevel: triggeredLevel,
      nextLevel,
      priceAtLevel: calculateFiboTargetPrice(entryPrice, stopLoss, direction, triggeredLevel),
      distanceToNextPercent: nextLevelPrice
        ? Math.abs((nextLevelPrice - currentPrice) / currentPrice) * 100
        : null,
      reason: `Fibonacci ${triggeredLevel} level reached`,
    };
  }

  const nextLevel = untriggeredLevels[0] ?? null;
  const nextLevelPrice = nextLevel
    ? calculateFiboTargetPrice(entryPrice, stopLoss, direction, nextLevel)
    : null;

  return {
    canPyramid: false,
    triggerLevel: null,
    nextLevel,
    priceAtLevel: nextLevelPrice,
    distanceToNextPercent: nextLevelPrice
      ? Math.abs((nextLevelPrice - currentPrice) / currentPrice) * 100
      : null,
    reason: `Waiting for Fibonacci ${nextLevel} level (${nextLevelPrice?.toFixed(4) ?? 'N/A'})`,
  };
};

export const getFiboLevelsWithPrices = (
  entryPrice: number,
  stopLoss: number,
  direction: PositionSide,
  enabledLevels: FiboLevel[]
): Array<{ level: FiboLevel; price: number; percentFromEntry: number }> => {
  return enabledLevels.map((level) => {
    const price = calculateFiboTargetPrice(entryPrice, stopLoss, direction, level);
    const percentFromEntry = Math.abs((price - entryPrice) / entryPrice) * 100;

    return { level, price, percentFromEntry };
  });
};

export const getTriggeredLevelsCount = (
  symbol: string,
  direction: PositionSide
): number => {
  const state = getFiboState(symbol, direction);
  return state?.triggeredLevels.size ?? 0;
};

export const resetAllFiboStates = (): void => {
  triggeredFiboStateMap.clear();
};
