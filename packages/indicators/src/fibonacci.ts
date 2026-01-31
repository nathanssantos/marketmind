import type { Kline, TimeInterval } from '@marketmind/types';
import { FILTER_THRESHOLDS, INTERVAL_MS, TIME_MS } from '@marketmind/types';
import {
  FIBONACCI_ALL_LEVELS,
  FIBONACCI_RETRACEMENT_LEVELS,
  calculateFibonacciRetracement as fibCalcRetracement,
  calculateProjectionLevels,
  type FibonacciLevelSelectionContext,
  type FibonacciLevelSelectionResult,
  type SwingPointWithIndex,
  type FibonacciProjectionResult,
} from '@marketmind/fibonacci';
import {
  findSignificantSwingHigh,
  findSignificantSwingLow,
  findSwingHighAfter,
  findSwingLowAfter,
  validateSwingWithStructure,
  findAdaptiveFractalHigh,
  findAdaptiveFractalLow,
  SWING_POINT_DEFAULTS,
} from './swingPoints';

const DEFAULT_LOOKBACK_PERIOD_MS = 14 * TIME_MS.DAY;
const MIN_LOOKBACK_CANDLES = 50;
const MAX_LOOKBACK_CANDLES = 400;

export const calculateTimeframeLookback = (interval: TimeInterval): number => {
  const intervalMs = INTERVAL_MS[interval];
  if (!intervalMs) return 100;

  const calculatedLookback = Math.floor(DEFAULT_LOOKBACK_PERIOD_MS / intervalMs);
  return Math.max(MIN_LOOKBACK_CANDLES, Math.min(MAX_LOOKBACK_CANDLES, calculatedLookback));
};

export {
  FIBONACCI_ALL_LEVELS,
  FIBONACCI_RETRACEMENT_LEVELS,
  FIBONACCI_TARGET_LEVELS,
  FIBONACCI_PYRAMID_LEVELS,
  FIBONACCI_LEVEL_TO_NAME,
  FIBONACCI_PYRAMID_VALUES,
  FIBONACCI_DEFAULT_COLOR,
  FIBONACCI_LEVEL_COLORS,
  formatFibonacciLabel,
  getLevelColor,
  getLevelName,
  calculateFibonacciRetracement,
  calculateFibonacciExtension,
  calculateProjectionLevels,
  type FibonacciLevelData,
  type FibonacciColors,
  type FibonacciRetracementLevel,
  type FibonacciExtensionLevel,
  type FibonacciPyramidLevel,
  type FibonacciLevelSelectionContext,
  type FibonacciLevelSelectionResult,
  type SwingPointWithIndex,
  type FibonacciProjectionResult,
} from '@marketmind/fibonacci';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export const FIBONACCI_LEVELS = FIBONACCI_RETRACEMENT_LEVELS;
export const FIBONACCI_EXTENSION_LEVELS = FIBONACCI_ALL_LEVELS;

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

export interface FibonacciResult {
  levels: FibonacciLevel[];
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
}

export const calculateAutoFibonacci = (
  klines: Kline[],
  lookback: number = 50,
): FibonacciResult | null => {
  if (klines.length < lookback) {
    return null;
  }

  const recentKlines = klines.slice(-lookback);

  let highestIndex = 0;
  let lowestIndex = 0;
  let highestValue = getKlineHigh(recentKlines[0]!);
  let lowestValue = getKlineLow(recentKlines[0]!);

  for (let i = 1; i < recentKlines.length; i++) {
    const high = getKlineHigh(recentKlines[i]!);
    const low = getKlineLow(recentKlines[i]!);

    if (high > highestValue) {
      highestValue = high;
      highestIndex = i;
    }

    if (low < lowestValue) {
      lowestValue = low;
      lowestIndex = i;
    }
  }

  const direction = highestIndex > lowestIndex ? 'up' : 'down';
  const levels = fibCalcRetracement(highestValue, lowestValue, direction);

  return {
    levels,
    swingHigh: highestValue,
    swingLow: lowestValue,
    direction,
  };
};

export const calculateFibonacciProjection = (
  klines: Kline[],
  currentIndex: number,
  lookback: number | TimeInterval = 100,
  direction: 'LONG' | 'SHORT',
): FibonacciProjectionResult | null => {
  const effectiveLookback = typeof lookback === 'string'
    ? calculateTimeframeLookback(lookback)
    : lookback;

  const startIndex = Math.max(0, currentIndex - effectiveLookback);
  const endIndex = currentIndex;

  if (endIndex - startIndex < 20) return null;

  const fractalBars = SWING_POINT_DEFAULTS.FRACTAL_BARS_LEFT;
  const atrMultiplier = 2.0;
  const percentThreshold = 3.0;
  const useATR = true;

  let swingLowResult: { price: number; index: number; timestamp: number } | null = null;
  let swingHighResult: { price: number; index: number; timestamp: number } | null = null;

  if (direction === 'LONG') {
    let lowResult = findSignificantSwingLow(klines, endIndex, effectiveLookback, atrMultiplier, percentThreshold, useATR);

    if (lowResult) {
      const validation = validateSwingWithStructure(klines, lowResult, effectiveLookback);
      if (!validation.valid) {
        lowResult = findAdaptiveFractalLow(klines, endIndex, effectiveLookback);
      }
    } else {
      lowResult = findAdaptiveFractalLow(klines, endIndex, effectiveLookback);
    }

    if (!lowResult) return null;
    swingLowResult = { price: lowResult.price, index: lowResult.index, timestamp: lowResult.timestamp };

    const highResult = findSwingHighAfter(klines, swingLowResult.index, endIndex, fractalBars);
    if (!highResult) return null;
    swingHighResult = { price: highResult.price, index: highResult.index, timestamp: highResult.timestamp };
  } else {
    let highResult = findSignificantSwingHigh(klines, endIndex, effectiveLookback, atrMultiplier, percentThreshold, useATR);

    if (highResult) {
      const validation = validateSwingWithStructure(klines, highResult, effectiveLookback);
      if (!validation.valid) {
        highResult = findAdaptiveFractalHigh(klines, endIndex, effectiveLookback);
      }
    } else {
      highResult = findAdaptiveFractalHigh(klines, endIndex, effectiveLookback);
    }

    if (!highResult) return null;
    swingHighResult = { price: highResult.price, index: highResult.index, timestamp: highResult.timestamp };

    const lowResult = findSwingLowAfter(klines, swingHighResult.index, endIndex, fractalBars);
    if (!lowResult) return null;
    swingLowResult = { price: lowResult.price, index: lowResult.index, timestamp: lowResult.timestamp };
  }

  const swingLow: SwingPointWithIndex = {
    price: swingLowResult.price,
    index: swingLowResult.index,
    timestamp: swingLowResult.timestamp,
  };

  const swingHigh: SwingPointWithIndex = {
    price: swingHighResult.price,
    index: swingHighResult.index,
    timestamp: swingHighResult.timestamp,
  };

  const range = swingHigh.price - swingLow.price;

  if (range <= 0) return null;

  const levels = calculateProjectionLevels(swingLow, swingHigh, direction);
  const fibDirection = swingHigh.index > swingLow.index ? 'up' : 'down';

  return {
    levels,
    swingLow,
    swingHigh,
    direction: fibDirection,
    range,
  };
};

export const selectDynamicFibonacciLevel = (
  context: FibonacciLevelSelectionContext
): FibonacciLevelSelectionResult => {
  const { adx, atrPercent, volumeRatio } = context;

  const hasVolumeConfirmation = volumeRatio !== undefined && volumeRatio > FILTER_THRESHOLDS.VOLUME_SPIKE_MULTIPLIER;
  const hasVeryHighVolatility = atrPercent > FILTER_THRESHOLDS.VERY_HIGH_VOLATILITY_ATR;

  if (adx >= FILTER_THRESHOLDS.ADX_VERY_STRONG && (hasVolumeConfirmation || hasVeryHighVolatility)) {
    return { level: 2.618, reason: 'very_strong_trend_confirmed' };
  }

  return { level: 2, reason: 'default_optimized' };
};
