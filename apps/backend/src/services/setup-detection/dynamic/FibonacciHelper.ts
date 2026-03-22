import { calculateFibonacciProjection, selectDynamicFibonacciLevel } from '@marketmind/indicators';
import type {
  ComputedIndicators,
  FibonacciProjectionData,
  Kline,
  SetupDirection,
  TimeInterval,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';

import { logger } from '../../logger';
import type { IndicatorEngine } from './IndicatorEngine';

const DEFAULT_FIBONACCI_LOOKBACK = 100;
const DEFAULT_FIBONACCI_LEVEL = 1.618;

export const calculateFibonacciProjectionData = (
  klines: Kline[],
  currentIndex: number,
  direction: SetupDirection,
  indicators: ComputedIndicators,
  interval: TimeInterval | undefined,
  fibonacciSwingRange: 'extended' | 'nearest',
  indicatorEngine: IndicatorEngine,
  silent: boolean
): FibonacciProjectionData | undefined => {
  const lookback = interval ?? DEFAULT_FIBONACCI_LOOKBACK;
  const projection = calculateFibonacciProjection(klines, currentIndex, lookback, direction, fibonacciSwingRange);
  if (!projection) return undefined;

  const primaryLevel = selectPrimaryFibonacciLevel(
    klines, currentIndex, indicators, indicatorEngine, silent
  );

  return {
    swingLow: {
      price: projection.swingLow.price,
      index: projection.swingLow.index,
      timestamp: projection.swingLow.timestamp,
    },
    swingHigh: {
      price: projection.swingHigh.price,
      index: projection.swingHigh.index,
      timestamp: projection.swingHigh.timestamp,
    },
    levels: projection.levels.map(l => ({
      level: l.level,
      price: l.price,
      label: l.label,
    })),
    range: projection.range,
    primaryLevel,
  };
};

const selectPrimaryFibonacciLevel = (
  klines: Kline[],
  currentIndex: number,
  indicators: ComputedIndicators,
  indicatorEngine: IndicatorEngine,
  silent: boolean
): number => {
  const adxValue = indicatorEngine.resolveIndicatorValue(indicators, 'adx', currentIndex);
  const atrValue = indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex);

  if (adxValue === null || atrValue === null) {
    if (!silent) {
      logger.trace({ adxValue, atrValue }, 'Missing ADX or ATR for dynamic Fibonacci level selection, using default');
    }
    return DEFAULT_FIBONACCI_LEVEL;
  }

  const currentKline = klines[currentIndex];
  const closePrice = currentKline ? parseFloat(currentKline.close) : 0;
  const atrPercent = closePrice > 0 ? (atrValue / closePrice) * 100 : 0;

  let volumeRatio: number | undefined;
  const currentVolume = currentKline ? parseFloat(currentKline.volume) : 0;
  if (currentVolume > 0 && currentIndex >= 20) {
    let avgVolume = 0;
    for (let i = currentIndex - 20; i < currentIndex; i++) {
      const k = klines[i];
      if (k) avgVolume += parseFloat(k.volume);
    }
    avgVolume /= 20;
    volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : undefined;
  }

  const result = selectDynamicFibonacciLevel({ adx: adxValue, atrPercent, volumeRatio });

  if (!silent) {
    logger.trace({
      adx: adxValue.toFixed(2),
      atrPercent: atrPercent.toFixed(2),
      volumeRatio: volumeRatio?.toFixed(2) ?? 'N/A',
      selectedLevel: result.level,
      reason: result.reason,
    }, 'Dynamic Fibonacci level selected');
  }

  return result.level;
};

export const validateFibonacciEntryProgress = (
  entryPrice: number,
  fibonacciProjection: FibonacciProjectionData | undefined,
  direction: SetupDirection,
  maxProgress: number,
  silent: boolean
): { valid: boolean; progress: number; reason?: string } => {
  if (!fibonacciProjection) {
    return { valid: true, progress: 0 };
  }

  const { swingLow, swingHigh } = fibonacciProjection;
  const swingRange = swingHigh.price - swingLow.price;

  if (swingRange <= 0) {
    return { valid: true, progress: 0, reason: 'invalid_swing_range' };
  }

  const progress = direction === 'LONG'
    ? ((entryPrice - swingLow.price) / swingRange) * 100
    : ((swingHigh.price - entryPrice) / swingRange) * 100;

  const isValid = progress <= maxProgress;

  if (!isValid && !silent) {
    logger.warn({
      direction,
      entryPrice: entryPrice.toFixed(4),
      swingLow: swingLow.price.toFixed(4),
      swingHigh: swingHigh.price.toFixed(4),
      fibLevel: `${progress.toFixed(1)}%`,
      maxAllowed: `${maxProgress}%`,
    }, '! Entry price above max Fibonacci level - setup rejected');
  }

  return {
    valid: isValid,
    progress,
    reason: isValid ? undefined : 'entry_above_max_fib_level',
  };
};

export const extractTriggerCandles = (
  klines: Kline[],
  currentIndex: number,
  lookback: number
): TriggerCandleSnapshot[] => {
  const snapshots: TriggerCandleSnapshot[] = [];

  for (let offset = -(lookback - 1); offset <= 0; offset++) {
    const idx = currentIndex + offset;
    if (idx < 0 || idx >= klines.length) continue;

    const kline = klines[idx];
    if (!kline) continue;

    snapshots.push({
      offset,
      openTime: kline.openTime,
      open: typeof kline.open === 'string' ? parseFloat(kline.open) : kline.open,
      high: typeof kline.high === 'string' ? parseFloat(kline.high) : kline.high,
      low: typeof kline.low === 'string' ? parseFloat(kline.low) : kline.low,
      close: typeof kline.close === 'string' ? parseFloat(kline.close) : kline.close,
      volume: typeof kline.volume === 'string' ? parseFloat(kline.volume) : kline.volume,
    });
  }

  return snapshots;
};

export const extractIndicatorValues = (
  indicators: ComputedIndicators,
  currentIndex: number
): TriggerIndicatorValues => {
  const values: TriggerIndicatorValues = {};

  for (const [id, indicator] of Object.entries(indicators)) {
    if (id.startsWith('_')) continue;

    if (Array.isArray(indicator.values)) {
      const current = indicator.values[currentIndex];
      const prev = currentIndex > 0 ? indicator.values[currentIndex - 1] : null;
      const prev2 = currentIndex > 1 ? indicator.values[currentIndex - 2] : null;

      if (current !== null && current !== undefined) {
        values[id] = current;
      }
      if (prev !== null && prev !== undefined) {
        values[`${id}Prev`] = prev;
      }
      if (prev2 !== null && prev2 !== undefined) {
        values[`${id}Prev2`] = prev2;
      }
    } else {
      const subValues = indicator.values;
      for (const [subKey, arr] of Object.entries(subValues)) {
        const current = arr[currentIndex];
        const prev = currentIndex > 0 ? arr[currentIndex - 1] : null;

        if (current !== null && current !== undefined) {
          values[`${id}.${subKey}`] = current;
        }
        if (prev !== null && prev !== undefined) {
          values[`${id}.${subKey}Prev`] = prev;
        }
      }
    }
  }

  return values;
};
