import { calculateStochastic } from '@marketmind/indicators';
import type { Kline, StochasticFilterResult } from '@marketmind/types';
import { STOCHASTIC_FILTER } from './stochastic-filter';

export const STOCHASTIC_RECOVERY = {
  MIDPOINT_THRESHOLD: 50,
} as const;

export const checkStochasticRecoveryCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): StochasticFilterResult => {
  const { K_PERIOD, K_SMOOTHING, D_PERIOD, OVERSOLD_THRESHOLD, OVERBOUGHT_THRESHOLD } =
    STOCHASTIC_FILTER;
  const { MIDPOINT_THRESHOLD } = STOCHASTIC_RECOVERY;

  const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

  if (klines.length < minRequired) {
    return {
      isAllowed: true,
      currentK: null,
      currentD: null,
      isOversold: false,
      isOverbought: false,
      reason: `Insufficient klines for Stochastic Recovery calculation (${klines.length} < ${minRequired}) - soft pass`,
    };
  }

  const stochResult = calculateStochastic(klines, K_PERIOD, K_SMOOTHING, D_PERIOD);
  const lastIndex = stochResult.k.length - 1;
  const currentK = stochResult.k[lastIndex];
  const currentD = stochResult.d[lastIndex];

  if (currentK === null || currentK === undefined) {
    return {
      isAllowed: true,
      currentK: null,
      currentD: null,
      isOversold: false,
      isOverbought: false,
      reason: 'Stochastic Recovery calculation returned null - soft pass',
    };
  }

  const isOversold = currentK < OVERSOLD_THRESHOLD;
  const isOverbought = currentK > OVERBOUGHT_THRESHOLD;

  let isAllowed = false;
  let reason: string;

  if (direction === 'LONG') {
    if (currentK >= MIDPOINT_THRESHOLD) {
      isAllowed = false;
      reason = `LONG blocked: Slow Stoch K (${currentK.toFixed(2)}) already crossed midpoint (≥ ${MIDPOINT_THRESHOLD})`;
    } else {
      const wentBelowOversold = scanBackwardForExtreme(stochResult.k, lastIndex, 'below', OVERSOLD_THRESHOLD, MIDPOINT_THRESHOLD);
      if (wentBelowOversold) {
        isAllowed = true;
        reason = `LONG allowed: Slow Stoch K (${currentK.toFixed(2)}) recovering from oversold, below midpoint (${MIDPOINT_THRESHOLD})`;
      } else {
        isAllowed = false;
        reason = `LONG blocked: Slow Stoch K (${currentK.toFixed(2)}) never went below ${OVERSOLD_THRESHOLD} in recent history`;
      }
    }
  } else {
    if (currentK <= MIDPOINT_THRESHOLD) {
      isAllowed = false;
      reason = `SHORT blocked: Slow Stoch K (${currentK.toFixed(2)}) already crossed midpoint (≤ ${MIDPOINT_THRESHOLD})`;
    } else {
      const wentAboveOverbought = scanBackwardForExtreme(stochResult.k, lastIndex, 'above', OVERBOUGHT_THRESHOLD, MIDPOINT_THRESHOLD);
      if (wentAboveOverbought) {
        isAllowed = true;
        reason = `SHORT allowed: Slow Stoch K (${currentK.toFixed(2)}) recovering from overbought, above midpoint (${MIDPOINT_THRESHOLD})`;
      } else {
        isAllowed = false;
        reason = `SHORT blocked: Slow Stoch K (${currentK.toFixed(2)}) never went above ${OVERBOUGHT_THRESHOLD} in recent history`;
      }
    }
  }

  return {
    isAllowed,
    currentK,
    currentD: currentD ?? null,
    isOversold,
    isOverbought,
    reason,
  };
};

const scanBackwardForExtreme = (
  kValues: (number | null)[],
  startIndex: number,
  extremeDirection: 'below' | 'above',
  extremeThreshold: number,
  midpointThreshold: number
): boolean => {
  let foundExtreme = false;

  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const k = kValues[i];
    if (k === null || k === undefined) continue;

    if (extremeDirection === 'below') {
      if (k >= midpointThreshold) {
        if (foundExtreme) return false;
        foundExtreme = false;
      }
      if (k < extremeThreshold) return true;
    } else {
      if (k <= midpointThreshold) {
        if (foundExtreme) return false;
        foundExtreme = false;
      }
      if (k > extremeThreshold) return true;
    }
  }

  return false;
};
