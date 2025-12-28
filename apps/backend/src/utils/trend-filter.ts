import { calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export const TREND_FILTER = {
  DEFAULT_PERIOD: 200,
  MIN_KLINES_REQUIRED: 200,
} as const;

export interface TrendFilterResult {
  isAllowed: boolean;
  ema: number | null;
  currentPrice: number | null;
  isBullish: boolean;
  isBearish: boolean;
  reason: string;
}

export const checkTrendCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  period: number = TREND_FILTER.DEFAULT_PERIOD
): TrendFilterResult => {
  if (klines.length < TREND_FILTER.MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      ema: null,
      currentPrice: null,
      isBullish: false,
      isBearish: false,
      reason: `Insufficient klines for trend filter (${klines.length} < ${TREND_FILTER.MIN_KLINES_REQUIRED})`,
    };
  }

  const emaValues = calculateEMA(klines, period);
  const lastEma = emaValues[emaValues.length - 1];

  if (lastEma === null || lastEma === undefined) {
    return {
      isAllowed: true,
      ema: null,
      currentPrice: null,
      isBullish: false,
      isBearish: false,
      reason: 'EMA calculation returned null',
    };
  }

  const lastKline = klines[klines.length - 1];
  if (!lastKline) {
    return {
      isAllowed: true,
      ema: lastEma,
      currentPrice: null,
      isBullish: false,
      isBearish: false,
      reason: 'No kline data available',
    };
  }

  const currentPrice = parseFloat(lastKline.close);
  const isBullish = currentPrice > lastEma;
  const isBearish = currentPrice < lastEma;

  if (direction === 'LONG') {
    if (!isBullish) {
      return {
        isAllowed: false,
        ema: lastEma,
        currentPrice,
        isBullish,
        isBearish,
        reason: `LONG blocked: price ${currentPrice.toFixed(2)} below EMA${period} ${lastEma.toFixed(2)} (bearish trend)`,
      };
    }
    return {
      isAllowed: true,
      ema: lastEma,
      currentPrice,
      isBullish,
      isBearish,
      reason: `LONG allowed: price ${currentPrice.toFixed(2)} above EMA${period} ${lastEma.toFixed(2)} (bullish trend)`,
    };
  }

  if (direction === 'SHORT') {
    if (!isBearish) {
      return {
        isAllowed: false,
        ema: lastEma,
        currentPrice,
        isBullish,
        isBearish,
        reason: `SHORT blocked: price ${currentPrice.toFixed(2)} above EMA${period} ${lastEma.toFixed(2)} (bullish trend)`,
      };
    }
    return {
      isAllowed: true,
      ema: lastEma,
      currentPrice,
      isBullish,
      isBearish,
      reason: `SHORT allowed: price ${currentPrice.toFixed(2)} below EMA${period} ${lastEma.toFixed(2)} (bearish trend)`,
    };
  }

  return {
    isAllowed: true,
    ema: lastEma,
    currentPrice,
    isBullish,
    isBearish,
    reason: 'Unknown direction',
  };
};
