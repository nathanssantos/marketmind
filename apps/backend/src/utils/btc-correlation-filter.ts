import { calculateEMA, calculateMACD } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const EMA_PERIOD = 21;
const MIN_KLINES_REQUIRED = 30;

export const BTC_CORRELATION_FILTER = {
  EMA_PERIOD,
  MIN_KLINES_REQUIRED,
  BTC_PAIRS: ['BTCUSDT', 'BTCBUSD', 'BTCUSDC', 'BTCFDUSD'],
} as const;

export type BtcTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface BtcCorrelationResult {
  isAllowed: boolean;
  btcTrend: BtcTrend;
  btcEma21: number | null;
  btcPrice: number | null;
  btcMacdHistogram: number | null;
  isAltcoin: boolean;
  reason: string;
}

export const isBtcPair = (symbol: string): boolean => {
  return (BTC_CORRELATION_FILTER.BTC_PAIRS as readonly string[]).includes(symbol);
};

export const checkBtcCorrelation = (
  btcKlines: Kline[],
  direction: 'LONG' | 'SHORT',
  tradingSymbol: string
): BtcCorrelationResult => {
  const isAltcoin = !isBtcPair(tradingSymbol);

  if (!isAltcoin) {
    return {
      isAllowed: true,
      btcTrend: 'NEUTRAL',
      btcEma21: null,
      btcPrice: null,
      btcMacdHistogram: null,
      isAltcoin: false,
      reason: 'BTC pair - correlation filter not applicable',
    };
  }

  if (btcKlines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      btcTrend: 'NEUTRAL',
      btcEma21: null,
      btcPrice: null,
      btcMacdHistogram: null,
      isAltcoin: true,
      reason: `Insufficient BTC klines (${btcKlines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`,
    };
  }

  const ema21Values = calculateEMA(btcKlines, EMA_PERIOD);
  const macdResult = calculateMACD(btcKlines);

  const lastIndex = btcKlines.length - 1;
  const btcEma21 = ema21Values[lastIndex];
  const btcMacdHistogram = macdResult.histogram[lastIndex];
  const lastKline = btcKlines[lastIndex];

  if (!lastKline || btcEma21 === null || btcEma21 === undefined) {
    return {
      isAllowed: true,
      btcTrend: 'NEUTRAL',
      btcEma21: btcEma21 ?? null,
      btcPrice: lastKline ? parseFloat(String(lastKline.close)) : null,
      btcMacdHistogram: isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null,
      isAltcoin: true,
      reason: 'BTC EMA calculation incomplete - allowing trade (soft pass)',
    };
  }

  const btcPrice = parseFloat(String(lastKline.close));
  const priceAboveEma = btcPrice > btcEma21;
  const macdBullish = !isNaN(btcMacdHistogram ?? NaN) && (btcMacdHistogram ?? 0) > 0;
  const macdBearish = !isNaN(btcMacdHistogram ?? NaN) && (btcMacdHistogram ?? 0) < 0;

  let btcTrend: BtcTrend = 'NEUTRAL';
  if (priceAboveEma && macdBullish) {
    btcTrend = 'BULLISH';
  } else if (!priceAboveEma && macdBearish) {
    btcTrend = 'BEARISH';
  } else if (priceAboveEma) {
    btcTrend = 'BULLISH';
  } else if (!priceAboveEma) {
    btcTrend = 'BEARISH';
  }

  const formatPrice = (p: number) => p.toFixed(2);

  if (direction === 'LONG' && btcTrend === 'BEARISH') {
    return {
      isAllowed: false,
      btcTrend,
      btcEma21,
      btcPrice,
      btcMacdHistogram: isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null,
      isAltcoin: true,
      reason: `LONG blocked: BTC bearish - price (${formatPrice(btcPrice)}) below EMA21 (${formatPrice(btcEma21)})`,
    };
  }

  if (direction === 'SHORT' && btcTrend === 'BULLISH') {
    return {
      isAllowed: false,
      btcTrend,
      btcEma21,
      btcPrice,
      btcMacdHistogram: isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null,
      isAltcoin: true,
      reason: `SHORT blocked: BTC bullish - price (${formatPrice(btcPrice)}) above EMA21 (${formatPrice(btcEma21)})`,
    };
  }

  return {
    isAllowed: true,
    btcTrend,
    btcEma21,
    btcPrice,
    btcMacdHistogram: isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null,
    isAltcoin: true,
    reason: `Trade allowed: BTC ${btcTrend.toLowerCase()} aligns with ${direction} direction`,
  };
};
