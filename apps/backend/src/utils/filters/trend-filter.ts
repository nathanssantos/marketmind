import { detectTrendByEMA, type TrendDetectionResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const DEFAULT_EMA_PERIOD = 21;

export const TREND_FILTER = {
  EMA_PERIOD: DEFAULT_EMA_PERIOD,
} as const;

export interface TrendFilterResult {
  isAllowed: boolean;
  ema21: number | null;
  price: number | null;
  isBullish: boolean;
  isBearish: boolean;
  reason: string;
  trendResult?: TrendDetectionResult;
}

export const checkTrendCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  emaPeriod: number = TREND_FILTER.EMA_PERIOD,
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

  const confirmationIndex = klines.length - 2;
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

  const trendResult = detectTrendByEMA(klines.slice(0, confirmationIndex + 1), emaPeriod, 1);

  const ema21 = trendResult.details.ema?.value ?? null;
  const price = parseFloat(String(confirmationKline.close));
  const isBullish = ema21 !== null && price > ema21;
  const isBearish = ema21 !== null && price < ema21;

  if (ema21 === null) {
    return {
      isAllowed: false,
      ema21: null,
      price,
      isBullish: false,
      isBearish: false,
      reason: 'EMA calculation returned null - blocking trade for safety',
      trendResult,
    };
  }

  const formatPrice = (p: number) => p.toFixed(2);
  let isAllowed: boolean;
  let reason: string;

  if (direction === 'LONG') {
    isAllowed = isBullish;
    reason = isAllowed
      ? `LONG allowed: price (${formatPrice(price)}) above EMA${emaPeriod} (${formatPrice(ema21)}) - bullish trend`
      : `LONG blocked: price (${formatPrice(price)}) below EMA${emaPeriod} (${formatPrice(ema21)}) - bearish trend`;
  } else if (direction === 'SHORT') {
    isAllowed = isBearish;
    reason = isAllowed
      ? `SHORT allowed: price (${formatPrice(price)}) below EMA${emaPeriod} (${formatPrice(ema21)}) - bearish trend`
      : `SHORT blocked: price (${formatPrice(price)}) above EMA${emaPeriod} (${formatPrice(ema21)}) - bullish trend`;
  } else {
    isAllowed = true;
    reason = 'Unknown direction';
  }

  return {
    isAllowed,
    ema21,
    price,
    isBullish,
    isBearish,
    reason,
    trendResult,
  };
};
