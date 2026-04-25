import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { DirectionFilterConfig, DirectionFilterResult, Kline, MarketDirection, PositionSide } from '@marketmind/types';

const pineService = new PineIndicatorService();

const EMA_PERIOD = 200;
const MIN_KLINES_REQUIRED = 212;
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

export const checkDirectionFilter = async (
  klines: Kline[],
  tradeDirection: PositionSide,
  config: DirectionFilterConfig = {}
): Promise<DirectionFilterResult> => {
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

  const emaValues = await pineService.compute('ema', klines, { period: EMA_PERIOD });
  const lastIndex = klines.length - 1;

  const prevIndex = lastIndex - 1;
  const ema200 = emaValues[prevIndex] ?? null;
  const currentPrice = getKlineClose(klines[prevIndex]);
  const openPrice = (() => {
    const k = klines[prevIndex];
    if (!k) return currentPrice;
    return typeof k.open === 'string' ? parseFloat(k.open) : (k.open as number);
  })();

  if (ema200 === null || isNaN(ema200) || ema200 === 0) {
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

  const openAbove = openPrice > ema200;
  const closeAbove = currentPrice > ema200;
  const confirmedAbove = openAbove && closeAbove;
  const confirmedBelow = !openAbove && !closeAbove;
  const confirmedDirection: MarketDirection = confirmedAbove ? 'BULLISH' : confirmedBelow ? 'BEARISH' : 'NEUTRAL';
  const marketDirection = confirmedDirection !== 'NEUTRAL'
    ? getMarketDirection(currentPrice, ema200, ema200Slope)
    : ('NEUTRAL' as MarketDirection);
  const effectiveDirection: MarketDirection = confirmedDirection === 'NEUTRAL' ? 'NEUTRAL' : marketDirection;

  let isAllowed = true;
  let reason: string;

  if (tradeDirection === 'LONG' && effectiveDirection === 'BEARISH') {
    if (enableLongInBearMarket) {
      isAllowed = true;
      reason = `LONG allowed in BEARISH market (override enabled). Price ${priceVsEma200Percent.toFixed(1)}% vs EMA200`;
    } else {
      isAllowed = false;
      reason = `LONG blocked: Market is BEARISH (price ${priceVsEma200Percent.toFixed(1)}% below EMA200)`;
    }
  } else if (tradeDirection === 'SHORT' && effectiveDirection === 'BULLISH') {
    if (enableShortInBullMarket) {
      isAllowed = true;
      reason = `SHORT allowed in BULLISH market (override enabled). Price ${priceVsEma200Percent.toFixed(1)}% vs EMA200`;
    } else {
      isAllowed = false;
      reason = `SHORT blocked: Market is BULLISH (price ${priceVsEma200Percent.toFixed(1)}% above EMA200)`;
    }
  } else if (effectiveDirection === 'NEUTRAL') {
    isAllowed = false;
    reason = `${tradeDirection} blocked: EMA200 crossover candle not yet confirmed (prev candle crossed EMA200, wait for one candle to open and close entirely above/below)`;
  } else {
    reason = `${tradeDirection} allowed: Market is ${effectiveDirection} (price ${priceVsEma200Percent.toFixed(1)}% vs EMA200)`;
  }

  return {
    isAllowed,
    direction: effectiveDirection,
    ema200,
    ema200Slope,
    currentPrice,
    priceVsEma200Percent,
    reason,
  };
};
