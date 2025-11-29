import type { Candle, PivotPoint } from '@shared/types';

const DEFAULT_ZIGZAG_DEVIATION = 5;
const PERCENT_DIVISOR = 100;
const MIN_CANDLES = 3;
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
  candles: Candle[],
  current: Candle,
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

  if (current.high > extremePrice) {
    newExtremePrice = current.high;
    newExtremeIndex = i;
  }

  const drop = (newExtremePrice - current.low) / newExtremePrice;

  if (drop >= deviation / PERCENT_DIVISOR) {
    return {
      foundPivot: true,
      pivot: {
        index: newExtremeIndex,
        timestamp: candles[newExtremeIndex]?.timestamp ?? current.timestamp,
        price: newExtremePrice,
        type: 'high',
      },
      newExtremePrice: current.low,
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
  candles: Candle[],
  current: Candle,
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

  if (current.low < extremePrice) {
    newExtremePrice = current.low;
    newExtremeIndex = i;
  }

  const rise = (current.high - newExtremePrice) / newExtremePrice;

  if (rise >= deviation / PERCENT_DIVISOR) {
    return {
      foundPivot: true,
      pivot: {
        index: newExtremeIndex,
        timestamp: candles[newExtremeIndex]?.timestamp ?? current.timestamp,
        price: newExtremePrice,
        type: 'low',
      },
      newExtremePrice: current.high,
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
  candles: Candle[],
  deviation = DEFAULT_ZIGZAG_DEVIATION,
): ZigZagResult => {
  const highs: PivotPoint[] = [];
  const lows: PivotPoint[] = [];

  if (candles.length < MIN_CANDLES) {
    return { highs, lows, trend: 'neutral' };
  }

  const firstCandle = candles[0];
  const secondCandle = candles[1];

  if (!firstCandle || !secondCandle) {
    return { highs, lows, trend: 'neutral' };
  }

  const lastPivotType =
    firstCandle.close > secondCandle.close ? 'high' : 'low';
  let currentDirection: 'up' | 'down' =
    lastPivotType === 'high' ? 'down' : 'up';
  let extremePrice = firstCandle.close;
  let extremeIndex = 0;

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    if (!current) continue;

    if (currentDirection === 'up') {
      const result = processUpDirection(
        candles,
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
        candles,
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
