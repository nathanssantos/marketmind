import { calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export const TREND_FILTER = {
  FAST_PERIOD: 100,
  SLOW_PERIOD: 200,
  MIN_KLINES_REQUIRED: 250,
} as const;

export interface TrendFilterResult {
  isAllowed: boolean;
  ema100: number | null;
  ema200: number | null;
  isBullish: boolean;
  isBearish: boolean;
  reason: string;
}

export const checkTrendCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): TrendFilterResult => {
  if (klines.length < TREND_FILTER.MIN_KLINES_REQUIRED) {
    return {
      isAllowed: false,
      ema100: null,
      ema200: null,
      isBullish: false,
      isBearish: false,
      reason: `Insufficient klines for trend filter (${klines.length} < ${TREND_FILTER.MIN_KLINES_REQUIRED}) - blocking for safety`,
    };
  }

  const ema100Values = calculateEMA(klines, TREND_FILTER.FAST_PERIOD);
  const ema200Values = calculateEMA(klines, TREND_FILTER.SLOW_PERIOD);
  const confirmationIndex = klines.length - 2;
  const ema100 = ema100Values[confirmationIndex];
  const ema200 = ema200Values[confirmationIndex];

  if (ema100 === null || ema100 === undefined || ema200 === null || ema200 === undefined) {
    return {
      isAllowed: false,
      ema100: ema100 ?? null,
      ema200: ema200 ?? null,
      isBullish: false,
      isBearish: false,
      reason: 'EMA calculation returned null - blocking trade for safety',
    };
  }

  const isBullish = ema100 > ema200;
  const isBearish = ema100 < ema200;

  if (direction === 'LONG') {
    if (!isBullish) {
      return {
        isAllowed: false,
        ema100,
        ema200,
        isBullish,
        isBearish,
        reason: `LONG blocked: EMA100 (${ema100.toFixed(2)}) below EMA200 (${ema200.toFixed(2)}) - bearish trend`,
      };
    }
    return {
      isAllowed: true,
      ema100,
      ema200,
      isBullish,
      isBearish,
      reason: `LONG allowed: EMA100 (${ema100.toFixed(2)}) above EMA200 (${ema200.toFixed(2)}) - bullish trend`,
    };
  }

  if (direction === 'SHORT') {
    if (!isBearish) {
      return {
        isAllowed: false,
        ema100,
        ema200,
        isBullish,
        isBearish,
        reason: `SHORT blocked: EMA100 (${ema100.toFixed(2)}) above EMA200 (${ema200.toFixed(2)}) - bullish trend`,
      };
    }
    return {
      isAllowed: true,
      ema100,
      ema200,
      isBullish,
      isBearish,
      reason: `SHORT allowed: EMA100 (${ema100.toFixed(2)}) below EMA200 (${ema200.toFixed(2)}) - bearish trend`,
    };
  }

  return {
    isAllowed: true,
    ema100,
    ema200,
    isBullish,
    isBearish,
    reason: 'Unknown direction',
  };
};
