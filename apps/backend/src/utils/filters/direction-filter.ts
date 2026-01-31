import { calculateEMA } from '@marketmind/indicators';
import type {
  DirectionFilterConfig,
  DirectionFilterResult,
  Kline,
  MarketDirection,
} from '@marketmind/types';

const EMA_PERIOD = 200;
const MIN_KLINES_REQUIRED = 210;
const SLOPE_LOOKBACK = 20;
const SLOPE_THRESHOLD = 0.001;

export const DIRECTION_FILTER = {
  EMA_PERIOD,
  MIN_KLINES_REQUIRED,
  SLOPE_LOOKBACK,
  SLOPE_THRESHOLD,
} as const;

export type { DirectionFilterConfig, DirectionFilterResult, MarketDirection };

const getKlineClose = (kline: Kline | undefined): number => {
  if (!kline) return 0;
  return typeof kline.close === 'string' ? parseFloat(kline.close) : kline.close;
};

const calculateSlope = (emaValues: (number | null)[], lookback: number): number | null => {
  const validValues = emaValues.filter((v): v is number => v !== null && !isNaN(v));
  if (validValues.length < lookback) return null;

  const recentValues = validValues.slice(-lookback);
  const firstValue = recentValues[0];
  const lastValue = recentValues[recentValues.length - 1];

  if (firstValue === undefined || lastValue === undefined || firstValue === 0) return null;

  return (lastValue - firstValue) / firstValue;
};

const getMarketDirection = (
  currentPrice: number,
  ema200: number,
  slope: number | null
): MarketDirection => {
  const priceAboveEma = currentPrice > ema200;
  const priceBelowEma = currentPrice < ema200;

  const slopePositive = slope !== null && slope > SLOPE_THRESHOLD;
  const slopeNegative = slope !== null && slope < -SLOPE_THRESHOLD;

  if (priceAboveEma && slopePositive) return 'BULLISH';
  if (priceBelowEma && slopeNegative) return 'BEARISH';
  if (priceAboveEma && !slopeNegative) return 'BULLISH';
  if (priceBelowEma && !slopePositive) return 'BEARISH';

  return 'NEUTRAL';
};

export const checkDirectionFilter = (
  klines: Kline[],
  tradeDirection: 'LONG' | 'SHORT',
  config: DirectionFilterConfig = {}
): DirectionFilterResult => {
  const { enableLongInBearMarket = false, enableShortInBullMarket = false } = config;

  if (klines.length < MIN_KLINES_REQUIRED) {
    const currentPrice = getKlineClose(klines[klines.length - 1]);
    return {
      isAllowed: true,
      direction: 'NEUTRAL',
      ema200: null,
      ema200Slope: null,
      currentPrice,
      priceVsEma200Percent: null,
      reason: `Insufficient klines (${klines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`,
    };
  }

  const emaValues = calculateEMA(klines, EMA_PERIOD);
  const lastIndex = klines.length - 1;
  const ema200 = emaValues[lastIndex];
  const currentPrice = getKlineClose(klines[lastIndex]);

  if (ema200 === null || ema200 === undefined || isNaN(ema200) || ema200 === 0) {
    return {
      isAllowed: true,
      direction: 'NEUTRAL',
      ema200: null,
      ema200Slope: null,
      currentPrice,
      priceVsEma200Percent: null,
      reason: 'EMA200 calculation incomplete - allowing trade (soft pass)',
    };
  }

  const ema200Slope = calculateSlope(emaValues, SLOPE_LOOKBACK);
  const priceVsEma200Percent = ((currentPrice - ema200) / ema200) * 100;
  const marketDirection = getMarketDirection(currentPrice, ema200, ema200Slope);

  let isAllowed = true;
  let reason = '';

  if (tradeDirection === 'LONG' && marketDirection === 'BEARISH') {
    if (enableLongInBearMarket) {
      isAllowed = true;
      reason = `LONG allowed in BEARISH market (override enabled). Price ${priceVsEma200Percent.toFixed(1)}% vs EMA200`;
    } else {
      isAllowed = false;
      reason = `LONG blocked: Market is BEARISH (price ${priceVsEma200Percent.toFixed(1)}% below EMA200)`;
    }
  } else if (tradeDirection === 'SHORT' && marketDirection === 'BULLISH') {
    if (enableShortInBullMarket) {
      isAllowed = true;
      reason = `SHORT allowed in BULLISH market (override enabled). Price ${priceVsEma200Percent.toFixed(1)}% vs EMA200`;
    } else {
      isAllowed = false;
      reason = `SHORT blocked: Market is BULLISH (price ${priceVsEma200Percent.toFixed(1)}% above EMA200)`;
    }
  } else {
    reason = `${tradeDirection} allowed: Market is ${marketDirection} (price ${priceVsEma200Percent.toFixed(1)}% vs EMA200)`;
  }

  return {
    isAllowed,
    direction: marketDirection,
    ema200,
    ema200Slope,
    currentPrice,
    priceVsEma200Percent,
    reason,
  };
};
