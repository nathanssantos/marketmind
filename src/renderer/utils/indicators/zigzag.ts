import type { Kline, PivotPoint } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@shared/utils';

const DEFAULT_ZIGZAG_DEVIATION = 5;
const PERCENT_DIVISOR = 100;
const MIN_KLINES = 3;
const MIN_PIVOTS_FOR_TREND = 2;

export interface ZigZagResult {
  highs: PivotPoint[];
  lows: PivotPoint[];
  trend: 'up' | 'down' | 'neutral';
}

const determineTrend = (
  highs: PivotPoint[],
  lows: PivotPoint[],
): 'up' | 'down' | 'neutral' => {
  if (highs.length < MIN_PIVOTS_FOR_TREND || lows.length < MIN_PIVOTS_FOR_TREND) {
    return 'neutral';
  }

  const recentHighs = highs.slice(-MIN_PIVOTS_FOR_TREND);
  const recentLows = lows.slice(-MIN_PIVOTS_FOR_TREND);

  const lastHigh = recentHighs[1];
  const prevHigh = recentHighs[0];
  const lastLow = recentLows[1];
  const prevLow = recentLows[0];

  if (!lastHigh || !prevHigh || !lastLow || !prevLow) return 'neutral';

  const higherHighs = lastHigh.price > prevHigh.price;
  const higherLows = lastLow.price > prevLow.price;
  const lowerHighs = lastHigh.price < prevHigh.price;
  const lowerLows = lastLow.price < prevLow.price;

  if (higherHighs && higherLows) return 'up';
  if (lowerHighs && lowerLows) return 'down';
  return 'neutral';
};

const processUpDirection = (
  klines: Kline[],
  current: Kline,
  i: number,
  extremePrice: number,
  extremeIndex: number,
  deviation: number,
): {
  foundPivot: boolean;
  pivot?: PivotPoint;
  newExtremePrice: number;
  newExtremeIndex: number;
} => {
  let newExtremePrice = extremePrice;
  let newExtremeIndex = extremeIndex;

  if (getKlineHigh(current) > extremePrice) {
    newExtremePrice = getKlineHigh(current);
    newExtremeIndex = i;
  }

  const drop = (newExtremePrice - getKlineLow(current)) / newExtremePrice;

  if (drop >= deviation / PERCENT_DIVISOR) {
    return {
      foundPivot: true,
      pivot: {
        index: newExtremeIndex,
        openTime: klines[newExtremeIndex]?.openTime ?? current.openTime,
        price: newExtremePrice,
        type: 'high',
      },
      newExtremePrice: getKlineLow(current),
      newExtremeIndex: i,
    };
  }

  return {
    foundPivot: false,
    newExtremePrice,
    newExtremeIndex,
  };
};

const processDownDirection = (
  klines: Kline[],
  current: Kline,
  i: number,
  extremePrice: number,
  extremeIndex: number,
  deviation: number,
): {
  foundPivot: boolean;
  pivot?: PivotPoint;
  newExtremePrice: number;
  newExtremeIndex: number;
} => {
  let newExtremePrice = extremePrice;
  let newExtremeIndex = extremeIndex;

  if (getKlineLow(current) < extremePrice) {
    newExtremePrice = getKlineLow(current);
    newExtremeIndex = i;
  }

  const rise = (getKlineHigh(current) - newExtremePrice) / newExtremePrice;

  if (rise >= deviation / PERCENT_DIVISOR) {
    return {
      foundPivot: true,
      pivot: {
        index: newExtremeIndex,
        openTime: klines[newExtremeIndex]?.openTime ?? current.openTime,
        price: newExtremePrice,
        type: 'low',
      },
      newExtremePrice: getKlineHigh(current),
      newExtremeIndex: i,
    };
  }

  return {
    foundPivot: false,
    newExtremePrice,
    newExtremeIndex,
  };
};

export const calculateZigZag = (
  klines: Kline[],
  deviation = DEFAULT_ZIGZAG_DEVIATION,
): ZigZagResult => {
  const highs: PivotPoint[] = [];
  const lows: PivotPoint[] = [];

  if (klines.length < MIN_KLINES) {
    return { highs, lows, trend: 'neutral' };
  }

  const firstKline = klines[0];
  const secondKline = klines[1];

  if (!firstKline || !secondKline) {
    return { highs, lows, trend: 'neutral' };
  }

  const lastPivotType =
    getKlineClose(firstKline) > getKlineClose(secondKline) ? 'high' : 'low';
  let currentDirection: 'up' | 'down' =
    lastPivotType === 'high' ? 'down' : 'up';
  let extremePrice = getKlineClose(firstKline);
  let extremeIndex = 0;

  for (let i = 1; i < klines.length; i++) {
    const current = klines[i];
    if (!current) continue;

    if (currentDirection === 'up') {
      const result = processUpDirection(
        klines,
        current,
        i,
        extremePrice,
        extremeIndex,
        deviation,
      );

      if (result.foundPivot && result.pivot) {
        highs.push(result.pivot);
        currentDirection = 'down';
      }

      extremePrice = result.newExtremePrice;
      extremeIndex = result.newExtremeIndex;
    } else {
      const result = processDownDirection(
        klines,
        current,
        i,
        extremePrice,
        extremeIndex,
        deviation,
      );

      if (result.foundPivot && result.pivot) {
        lows.push(result.pivot);
        currentDirection = 'up';
      }

      extremePrice = result.newExtremePrice;
      extremeIndex = result.newExtremeIndex;
    }
  }

  const trend = determineTrend(highs, lows);

  return { highs, lows, trend };
};
