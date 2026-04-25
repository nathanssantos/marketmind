import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { HtfTrend, Interval, Kline, MtfFilterResult, PositionSide } from '@marketmind/types';

const pineService = new PineIndicatorService();

const EMA_SHORT_PERIOD = 50;
const EMA_LONG_PERIOD = 200;
const MIN_KLINES_FOR_EMA200 = 250;

export const MTF_FILTER = {
  EMA_SHORT_PERIOD,
  EMA_LONG_PERIOD,
  MIN_KLINES_FOR_EMA200,
} as const;

export type { HtfTrend, MtfFilterResult };

const HTF_MAPPING: Record<string, Interval> = {
  '1m': '15m',
  '3m': '15m',
  '5m': '1h',
  '15m': '4h',
  '30m': '4h',
  '1h': '4h',
  '2h': '4h',
  '4h': '1d',
  '6h': '1d',
  '8h': '1d',
  '12h': '1d',
  '1d': '1w',
  '3d': '1w',
  '1w': '1M',
};

export const getHigherTimeframe = (tradingInterval: string): Interval | null => {
  return HTF_MAPPING[tradingInterval] ?? null;
};

export const checkMtfCondition = async (
  htfKlines: Kline[],
  direction: PositionSide,
  htfInterval: string
): Promise<MtfFilterResult> => {
  if (htfKlines.length < MIN_KLINES_FOR_EMA200) {
    return {
      isAllowed: true,
      htfTrend: 'NEUTRAL',
      htfInterval,
      ema50: null,
      ema200: null,
      price: null,
      goldenCross: false,
      deathCross: false,
      priceAboveEma50: false,
      priceAboveEma200: false,
      reason: `Insufficient HTF klines (${htfKlines.length} < ${MIN_KLINES_FOR_EMA200}) - allowing trade (soft pass)`,
    };
  }

  const [ema50Values, ema200Values] = await Promise.all([
    pineService.compute('ema', htfKlines, { period: EMA_SHORT_PERIOD }),
    pineService.compute('ema', htfKlines, { period: EMA_LONG_PERIOD }),
  ]);

  const lastIndex = htfKlines.length - 1;
  const ema50 = ema50Values[lastIndex] ?? null;
  const ema200 = ema200Values[lastIndex] ?? null;
  const lastKline = htfKlines[lastIndex];

  if (!lastKline || ema50 === null || ema200 === null) {
    return {
      isAllowed: true,
      htfTrend: 'NEUTRAL',
      htfInterval,
      ema50,
      ema200,
      price: lastKline ? parseFloat(String(lastKline.close)) : null,
      goldenCross: false,
      deathCross: false,
      priceAboveEma50: false,
      priceAboveEma200: false,
      reason: 'HTF EMA calculation incomplete - allowing trade (soft pass)',
    };
  }

  const price = parseFloat(String(lastKline.close));
  const goldenCross = ema50 > ema200;
  const deathCross = ema50 < ema200;
  const priceAboveEma50 = price > ema50;
  const priceAboveEma200 = price > ema200;

  let htfTrend: HtfTrend = 'NEUTRAL';
  if (goldenCross && priceAboveEma50) {
    htfTrend = 'BULLISH';
  } else if (deathCross && !priceAboveEma50) {
    htfTrend = 'BEARISH';
  } else if (goldenCross) {
    htfTrend = 'BULLISH';
  } else if (deathCross) {
    htfTrend = 'BEARISH';
  }

  const formatPrice = (p: number) => p.toFixed(2);

  if (direction === 'LONG') {
    if (htfTrend === 'BEARISH') {
      return {
        isAllowed: false,
        htfTrend,
        htfInterval,
        ema50,
        ema200,
        price,
        goldenCross,
        deathCross,
        priceAboveEma50,
        priceAboveEma200,
        reason: `LONG blocked: HTF (${htfInterval}) bearish - EMA50 (${formatPrice(ema50)}) < EMA200 (${formatPrice(ema200)}), price ${formatPrice(price)}`,
      };
    }
    return {
      isAllowed: true,
      htfTrend,
      htfInterval,
      ema50,
      ema200,
      price,
      goldenCross,
      deathCross,
      priceAboveEma50,
      priceAboveEma200,
      reason: `LONG allowed: HTF (${htfInterval}) ${htfTrend.toLowerCase()} - EMA50 (${formatPrice(ema50)}) vs EMA200 (${formatPrice(ema200)}), price ${formatPrice(price)}`,
    };
  }

  if (direction === 'SHORT') {
    if (htfTrend === 'BULLISH') {
      return {
        isAllowed: false,
        htfTrend,
        htfInterval,
        ema50,
        ema200,
        price,
        goldenCross,
        deathCross,
        priceAboveEma50,
        priceAboveEma200,
        reason: `SHORT blocked: HTF (${htfInterval}) bullish - EMA50 (${formatPrice(ema50)}) > EMA200 (${formatPrice(ema200)}), price ${formatPrice(price)}`,
      };
    }
    return {
      isAllowed: true,
      htfTrend,
      htfInterval,
      ema50,
      ema200,
      price,
      goldenCross,
      deathCross,
      priceAboveEma50,
      priceAboveEma200,
      reason: `SHORT allowed: HTF (${htfInterval}) ${htfTrend.toLowerCase()} - EMA50 (${formatPrice(ema50)}) vs EMA200 (${formatPrice(ema200)}), price ${formatPrice(price)}`,
    };
  }

  return {
    isAllowed: true,
    htfTrend,
    htfInterval,
    ema50,
    ema200,
    price,
    goldenCross,
    deathCross,
    priceAboveEma50,
    priceAboveEma200,
    reason: 'Unknown direction - allowing trade',
  };
};
