import { calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export const TREND_FILTER = {
  DEFAULT_PERIOD: 200,
  MIN_KLINES_REQUIRED: 200,
} as const;

export interface TrendFilterResult {
  isAllowed: boolean;
  ema: number | null;
  confirmationClose: number | null;
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
      confirmationClose: null,
      isBullish: false,
      isBearish: false,
      reason: `Insufficient klines for trend filter (${klines.length} < ${TREND_FILTER.MIN_KLINES_REQUIRED})`,
    };
  }

  const emaValues = calculateEMA(klines, period);
  const confirmationIndex = klines.length - 2;
  const confirmationEma = emaValues[confirmationIndex];

  if (confirmationEma === null || confirmationEma === undefined) {
    return {
      isAllowed: true,
      ema: null,
      confirmationClose: null,
      isBullish: false,
      isBearish: false,
      reason: 'EMA calculation returned null',
    };
  }

  const confirmationCandle = klines[confirmationIndex];
  if (!confirmationCandle) {
    return {
      isAllowed: true,
      ema: confirmationEma,
      confirmationClose: null,
      isBullish: false,
      isBearish: false,
      reason: 'No confirmation candle available',
    };
  }

  const confirmationClose = parseFloat(confirmationCandle.close);
  const isBullish = confirmationClose > confirmationEma;
  const isBearish = confirmationClose < confirmationEma;

  if (direction === 'LONG') {
    if (!isBullish) {
      return {
        isAllowed: false,
        ema: confirmationEma,
        confirmationClose,
        isBullish,
        isBearish,
        reason: `LONG blocked: confirmation close ${confirmationClose.toFixed(2)} below EMA${period} ${confirmationEma.toFixed(2)} (bearish trend)`,
      };
    }
    return {
      isAllowed: true,
      ema: confirmationEma,
      confirmationClose,
      isBullish,
      isBearish,
      reason: `LONG allowed: confirmation close ${confirmationClose.toFixed(2)} above EMA${period} ${confirmationEma.toFixed(2)} (bullish trend)`,
    };
  }

  if (direction === 'SHORT') {
    if (!isBearish) {
      return {
        isAllowed: false,
        ema: confirmationEma,
        confirmationClose,
        isBullish,
        isBearish,
        reason: `SHORT blocked: confirmation close ${confirmationClose.toFixed(2)} above EMA${period} ${confirmationEma.toFixed(2)} (bullish trend)`,
      };
    }
    return {
      isAllowed: true,
      ema: confirmationEma,
      confirmationClose,
      isBullish,
      isBearish,
      reason: `SHORT allowed: confirmation close ${confirmationClose.toFixed(2)} below EMA${period} ${confirmationEma.toFixed(2)} (bearish trend)`,
    };
  }

  return {
    isAllowed: true,
    ema: confirmationEma,
    confirmationClose,
    isBullish,
    isBearish,
    reason: 'Unknown direction',
  };
};
