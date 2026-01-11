import { calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const EMA_PERIOD = 21;

export const TREND_FILTER = {
  EMA_PERIOD,
} as const;

export interface TrendFilterResult {
  isAllowed: boolean;
  ema21: number | null;
  price: number | null;
  isBullish: boolean;
  isBearish: boolean;
  reason: string;
}

export const checkTrendCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): TrendFilterResult => {
  if (klines.length < 2) {
    return {
      isAllowed: false,
      ema21: null,
      price: null,
      isBullish: false,
      isBearish: false,
      reason: `Insufficient klines for trend filter (${klines.length} < 2) - blocking for safety`,
    };
  }

  const ema21Values = calculateEMA(klines, TREND_FILTER.EMA_PERIOD);
  const confirmationIndex = klines.length - 2;
  const ema21 = ema21Values[confirmationIndex];
  const confirmationKline = klines[confirmationIndex];

  if (!confirmationKline) {
    return {
      isAllowed: false,
      ema21: null,
      price: null,
      isBullish: false,
      isBearish: false,
      reason: 'Confirmation kline not found - blocking trade for safety',
    };
  }

  const price = parseFloat(String(confirmationKline.close));

  if (ema21 === null || ema21 === undefined) {
    return {
      isAllowed: false,
      ema21: ema21 ?? null,
      price,
      isBullish: false,
      isBearish: false,
      reason: 'EMA calculation returned null - blocking trade for safety',
    };
  }

  const isBullish = price > ema21;
  const isBearish = price < ema21;

  if (direction === 'LONG') {
    if (!isBullish) {
      return {
        isAllowed: false,
        ema21,
        price,
        isBullish,
        isBearish,
        reason: `LONG blocked: price (${price.toFixed(2)}) below EMA21 (${ema21.toFixed(2)}) - bearish trend`,
      };
    }
    return {
      isAllowed: true,
      ema21,
      price,
      isBullish,
      isBearish,
      reason: `LONG allowed: price (${price.toFixed(2)}) above EMA21 (${ema21.toFixed(2)}) - bullish trend`,
    };
  }

  if (direction === 'SHORT') {
    if (!isBearish) {
      return {
        isAllowed: false,
        ema21,
        price,
        isBullish,
        isBearish,
        reason: `SHORT blocked: price (${price.toFixed(2)}) above EMA21 (${ema21.toFixed(2)}) - bullish trend`,
      };
    }
    return {
      isAllowed: true,
      ema21,
      price,
      isBullish,
      isBearish,
      reason: `SHORT allowed: price (${price.toFixed(2)}) below EMA21 (${ema21.toFixed(2)}) - bearish trend`,
    };
  }

  return {
    isAllowed: true,
    ema21,
    price,
    isBullish,
    isBearish,
    reason: 'Unknown direction',
  };
};
