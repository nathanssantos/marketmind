import { calculateStochastic } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export interface StochasticFilterResult {
  isAllowed: boolean;
  currentK: number | null;
  hadOversold: boolean;
  hadOverbought: boolean;
  oversoldMoreRecent: boolean;
  overboughtMoreRecent: boolean;
  reason: string;
}

export const STOCHASTIC_FILTER = {
  PERIOD: 14,
  SMOOTHING: 3,
  OVERSOLD_THRESHOLD: 20,
  OVERBOUGHT_THRESHOLD: 80,
  LOOKBACK_BUFFER: 10,
} as const;

export const checkStochasticCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): StochasticFilterResult => {
  const { PERIOD, SMOOTHING, OVERSOLD_THRESHOLD, OVERBOUGHT_THRESHOLD } = STOCHASTIC_FILTER;

  if (klines.length < PERIOD + 1) {
    return {
      isAllowed: true,
      currentK: null,
      hadOversold: false,
      hadOverbought: false,
      oversoldMoreRecent: false,
      overboughtMoreRecent: false,
      reason: 'Insufficient klines for calculation',
    };
  }

  const stochResult = calculateStochastic(klines, PERIOD, SMOOTHING);
  const currentK = stochResult.k[stochResult.k.length - 1];

  if (currentK === null || currentK === undefined) {
    return {
      isAllowed: true,
      currentK: null,
      hadOversold: false,
      hadOverbought: false,
      oversoldMoreRecent: false,
      overboughtMoreRecent: false,
      reason: 'Stochastic calculation returned null',
    };
  }

  let lastOversoldIndex = -1;
  let lastOverboughtIndex = -1;

  for (let i = 0; i < stochResult.k.length; i += 1) {
    const k = stochResult.k[i];
    if (k === null || k === undefined) continue;

    if (k < OVERSOLD_THRESHOLD) lastOversoldIndex = i;
    if (k > OVERBOUGHT_THRESHOLD) lastOverboughtIndex = i;
  }

  const hadOversold = lastOversoldIndex >= 0;
  const hadOverbought = lastOverboughtIndex >= 0;
  const oversoldMoreRecent = lastOversoldIndex > lastOverboughtIndex;
  const overboughtMoreRecent = lastOverboughtIndex > lastOversoldIndex;

  const isLongAllowed = direction === 'LONG' && hadOversold && (!hadOverbought || oversoldMoreRecent);
  const isShortAllowed = direction === 'SHORT' && hadOverbought && (!hadOversold || overboughtMoreRecent);
  const isAllowed = isLongAllowed || isShortAllowed;

  let reason: string;
  if (isAllowed) {
    reason = direction === 'LONG'
      ? `K was in oversold and hasn't crossed to overbought yet (current K: ${currentK.toFixed(2)})`
      : `K was in overbought and hasn't crossed to oversold yet (current K: ${currentK.toFixed(2)})`;
  } else {
    if (direction === 'LONG') {
      reason = hadOversold
        ? `K crossed to overbought after being oversold`
        : `K never reached oversold zone (< ${OVERSOLD_THRESHOLD})`;
    } else {
      reason = hadOverbought
        ? `K crossed to oversold after being overbought`
        : `K never reached overbought zone (> ${OVERBOUGHT_THRESHOLD})`;
    }
  }

  return {
    isAllowed,
    currentK,
    hadOversold,
    hadOverbought,
    oversoldMoreRecent,
    overboughtMoreRecent,
    reason,
  };
};
