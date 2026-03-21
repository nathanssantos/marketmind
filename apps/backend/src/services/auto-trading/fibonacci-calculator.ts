import { calculateADX, calculateFibonacciProjection, calculateTimeframeLookback } from '@marketmind/indicators';
import type { FibLevel, Kline, TimeInterval } from '@marketmind/types';
import { FILTER_THRESHOLDS } from '@marketmind/types';
import { TIME_MS, UNIT_MS } from '../../constants';
import { log } from './utils';

export const getIntervalMs = (interval: string): number => {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
  const unitMs = UNIT_MS[match[2]];
  if (!unitMs) return 4 * TIME_MS.HOUR;
  return parseInt(match[1]) * unitMs;
};

export const getAdxBasedFibonacciLevel = (klines: Kline[], _direction: 'LONG' | 'SHORT'): number => {
  const { ADX_MIN, ADX_STRONG, ADX_VERY_STRONG } = FILTER_THRESHOLDS;
  const MIN_KLINES_FOR_ADX = 35;

  if (klines.length < MIN_KLINES_FOR_ADX) {
    log('! Insufficient klines for ADX calculation, using default level', {
      klinesCount: klines.length,
      required: MIN_KLINES_FOR_ADX,
    });
    return 1.272;
  }

  const adxResult = calculateADX(klines, 14);
  const adx = adxResult.adx[adxResult.adx.length - 1];

  if (adx == null) {
    log('! ADX calculation returned null, using default level');
    return 1.272;
  }

  let targetLevel: number;

  if (adx >= ADX_VERY_STRONG) targetLevel = 2.0;
  else if (adx >= ADX_STRONG) targetLevel = 1.618;
  else if (adx >= ADX_MIN) targetLevel = 1.382;
  else targetLevel = 1.272;

  log('> ADX-based Fibonacci level selected', {
    adx: adx.toFixed(2),
    targetLevel,
    thresholds: { ADX_MIN, ADX_STRONG, ADX_VERY_STRONG },
  });

  return targetLevel;
};

export const calculateFibonacciTakeProfit = (
  klines: Kline[],
  _entryPrice: number,
  direction: 'LONG' | 'SHORT',
  fibonacciTargetLevel: FibLevel = '2',
  interval: string = '4h',
  swingRange: 'extended' | 'nearest' = 'nearest'
): number | null => {
  const currentIndex = klines.length - 1;
  const lookback = calculateTimeframeLookback(interval as TimeInterval);
  const projection = calculateFibonacciProjection(klines, currentIndex, lookback, direction, swingRange);

  if (!projection || projection.levels.length === 0) {
    log('! Fibonacci projection failed', {
      klinesCount: klines.length,
      currentIndex,
      direction,
      hasProjection: !!projection,
      levelsCount: projection?.levels?.length ?? 0,
    });
    return null;
  }

  log('Fibonacci projection', {
    swingHigh: projection.swingHigh?.price,
    swingLow: projection.swingLow?.price,
    range: projection.range,
    direction,
    lookback,
    interval,
    swingRange,
  });

  const targetLevel = fibonacciTargetLevel === 'auto'
    ? getAdxBasedFibonacciLevel(klines, direction)
    : parseFloat(fibonacciTargetLevel);

  const targetLevelData = projection.levels.find(
    (l) => Math.abs(l.level - targetLevel) < 0.001
  );

  if (targetLevelData) {
    log('Fibonacci TP calculated', {
      targetLevel,
      targetPrice: targetLevelData.price,
    });
    return targetLevelData.price;
  }

  log('! Target level not found, using 161.8%', {
    targetLevel,
    availableLevels: projection.levels.map(l => l.level),
  });

  const level1618 = projection.levels.find((l) => Math.abs(l.level - 1.618) < 0.001);
  return level1618?.price ?? null;
};
