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
  if (klines.length < 3) {
    return {
      isAllowed: false,
      ema21: null,
      price: null,
      isBullish: false,
      isBearish: false,
      reason: `Insufficient klines for trend filter (${klines.length} < 3) - blocking for safety`,
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
  const openPrice = parseFloat(String(confirmationKline.open));

  // The confirmation candle (klines[-2]) must have OPENED and CLOSED entirely above/below EMA.
  // A candle that opened below and closed above is the crossover candle itself — not a confirmed breakout.
  // This works correctly for both crypto (open = prev close) and stocks (gaps possible).
  const isBullish = ema21 !== null && openPrice > ema21 && price > ema21;
  const isBearish = ema21 !== null && openPrice < ema21 && price < ema21;

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
      ? `LONG allowed: confirmation candle opened (${formatPrice(openPrice)}) and closed (${formatPrice(price)}) above EMA${emaPeriod} (${formatPrice(ema21)}) - breakout confirmed`
      : `LONG blocked: confirmation candle did not open and close entirely above EMA${emaPeriod} (${formatPrice(ema21)}) - no confirmed breakout`;
  } else if (direction === 'SHORT') {
    isAllowed = isBearish;
    reason = isAllowed
      ? `SHORT allowed: confirmation candle opened (${formatPrice(openPrice)}) and closed (${formatPrice(price)}) below EMA${emaPeriod} (${formatPrice(ema21)}) - breakout confirmed`
      : `SHORT blocked: confirmation candle did not open and close entirely below EMA${emaPeriod} (${formatPrice(ema21)}) - no confirmed breakout`;
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
