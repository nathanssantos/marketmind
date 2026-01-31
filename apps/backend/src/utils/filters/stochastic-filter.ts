import { calculateStochastic } from '@marketmind/indicators';
import type { Kline, StochasticFilterResult } from '@marketmind/types';

export type { StochasticFilterResult };

export const STOCHASTIC_FILTER = {
  K_PERIOD: 14,
  K_SMOOTHING: 3,
  D_PERIOD: 3,
  OVERSOLD_THRESHOLD: 20,
  OVERBOUGHT_THRESHOLD: 80,
} as const;

export const checkStochasticCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): StochasticFilterResult => {
  const { K_PERIOD, K_SMOOTHING, D_PERIOD, OVERSOLD_THRESHOLD, OVERBOUGHT_THRESHOLD } =
    STOCHASTIC_FILTER;

  const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

  if (klines.length < minRequired) {
    return {
      isAllowed: true,
      currentK: null,
      currentD: null,
      isOversold: false,
      isOverbought: false,
      reason: `Insufficient klines for Slow Stochastic calculation (${klines.length} < ${minRequired}) - soft pass`,
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
      reason: 'Slow Stochastic calculation returned null - soft pass',
    };
  }

  const isOversold = currentK < OVERSOLD_THRESHOLD;
  const isOverbought = currentK > OVERBOUGHT_THRESHOLD;

  const isLongAllowed = direction === 'LONG' && !isOverbought;
  const isShortAllowed = direction === 'SHORT' && !isOversold;
  const isAllowed = isLongAllowed || isShortAllowed;

  let reason: string;
  if (direction === 'LONG') {
    reason = isAllowed
      ? `LONG allowed: Slow Stoch K (${currentK.toFixed(2)}) is not overbought (≤ ${OVERBOUGHT_THRESHOLD})`
      : `LONG blocked: Slow Stoch K (${currentK.toFixed(2)}) is overbought (> ${OVERBOUGHT_THRESHOLD})`;
  } else {
    reason = isAllowed
      ? `SHORT allowed: Slow Stoch K (${currentK.toFixed(2)}) is not oversold (≥ ${OVERSOLD_THRESHOLD})`
      : `SHORT blocked: Slow Stoch K (${currentK.toFixed(2)}) is oversold (< ${OVERSOLD_THRESHOLD})`;
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
