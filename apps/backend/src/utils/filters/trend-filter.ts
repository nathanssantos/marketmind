import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline } from '@marketmind/types';

const pineService = new PineIndicatorService();

const DEFAULT_EMA_PERIOD = 21;

export const TREND_FILTER = {
  EMA_PERIOD: DEFAULT_EMA_PERIOD,
} as const;

export interface TrendDetectionResult {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isClearTrend: boolean;
  strength: number;
  method: string;
  details: {
    price: number;
    ema?: { value: number; period: number; pricePosition: 'above' | 'below' | 'crossing' };
  };
}

export interface TrendFilterResult {
  isAllowed: boolean;
  ema21: number | null;
  price: number | null;
  isBullish: boolean;
  isBearish: boolean;
  reason: string;
  trendResult?: TrendDetectionResult;
}

export const checkTrendCondition = async (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  emaPeriod: number = TREND_FILTER.EMA_PERIOD,
): Promise<TrendFilterResult> => {
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

  const slicedKlines = klines.slice(0, confirmationIndex + 1);
  const emaValues = await pineService.compute('ema', slicedKlines, { period: emaPeriod });

  const lastEmaValue = emaValues[emaValues.length - 1] ?? null;

  const price = parseFloat(String(confirmationKline.close));
  const openPrice = parseFloat(String(confirmationKline.open));

  const ema21 = lastEmaValue;

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
    };
  }

  const trendResult: TrendDetectionResult = (() => {
    const recentKlines = slicedKlines.slice(-1);
    const recentEma = emaValues.slice(-1);
    const allAbove = recentKlines.every((k, i) => {
      const emaVal = recentEma[i];
      return emaVal !== null && emaVal !== undefined && parseFloat(String(k.close)) > emaVal;
    });
    const allBelow = recentKlines.every((k, i) => {
      const emaVal = recentEma[i];
      return emaVal !== null && emaVal !== undefined && parseFloat(String(k.close)) < emaVal;
    });
    const pricePosition: 'above' | 'below' | 'crossing' = allAbove ? 'above' : allBelow ? 'below' : 'crossing';
    const dir: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = allAbove ? 'BULLISH' : allBelow ? 'BEARISH' : 'NEUTRAL';
    const emaDistance = Math.abs(price - ema21) / ema21 * 100;
    const strength = Math.min(100, emaDistance * 20);
    return {
      direction: dir,
      isClearTrend: pricePosition !== 'crossing',
      strength,
      method: 'ema',
      details: { price, ema: { value: ema21, period: emaPeriod, pricePosition } },
    };
  })();

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
