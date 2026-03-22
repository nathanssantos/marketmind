import {
  findMostRecentSwingHigh,
  findMostRecentSwingLow,
  findSignificantSwingHigh,
  findSignificantSwingLow,
} from '@marketmind/indicators';
import type {
  ConditionOperand,
  ExitContext,
  ExitLevel,
  Kline,
} from '@marketmind/types';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import { calculateATRPercent, getVolatilityAdjustedMultiplier } from '../../volatility-profile';
import type { IndicatorEngine } from './IndicatorEngine';

const {
  DEFAULT_SWING_BUFFER_PERCENT,
  MIN_SWING_BUFFER_ATR,
  SWING_SKIP_RECENT,
  NEAREST_SWING_LOOKBACK,
  NEAREST_SWING_FRACTAL_BARS,
  MIN_ENTRY_STOP_SEPARATION_PERCENT,
} = EXIT_CALCULATOR;

export const findNearestLocalSwingLow = (klines: Kline[], currentIndex: number): number => {
  const searchEndIndex = currentIndex - SWING_SKIP_RECENT;
  const nearestSwing = findMostRecentSwingLow(klines, searchEndIndex, NEAREST_SWING_LOOKBACK, NEAREST_SWING_FRACTAL_BARS);
  if (nearestSwing?.price) {
    logger.trace({
      currentIndex,
      swingIndex: nearestSwing.index,
      swingPrice: nearestSwing.price.toFixed(4),
      method: 'findNearestLocalSwingLow',
    }, 'Found nearest local swing low for stop placement');
    return nearestSwing.price;
  }
  return findSwingLow(klines, currentIndex, SWING_SKIP_RECENT);
};

export const findNearestLocalSwingHigh = (klines: Kline[], currentIndex: number): number => {
  const searchEndIndex = currentIndex - SWING_SKIP_RECENT;
  const nearestSwing = findMostRecentSwingHigh(klines, searchEndIndex, NEAREST_SWING_LOOKBACK, NEAREST_SWING_FRACTAL_BARS);
  if (nearestSwing?.price) {
    logger.trace({
      currentIndex,
      swingIndex: nearestSwing.index,
      swingPrice: nearestSwing.price.toFixed(4),
      method: 'findNearestLocalSwingHigh',
    }, 'Found nearest local swing high for stop placement');
    return nearestSwing.price;
  }
  return findSwingHigh(klines, currentIndex, SWING_SKIP_RECENT);
};

export const findSwingLow = (klines: Kline[], currentIndex: number, skipRecent: number = 0): number => {
  const lookback = Math.min(100, currentIndex);
  const searchEndIndex = currentIndex - skipRecent;

  const significantSwing = findSignificantSwingLow(klines, searchEndIndex, lookback);
  if (significantSwing && significantSwing.price) {
    logger.trace({
      currentIndex, skipRecent,
      swingIndex: significantSwing.index,
      swingPrice: significantSwing.price.toFixed(4),
      method: 'findSignificantSwingLow',
    }, 'Found significant swing low for stop placement');
    return significantSwing.price;
  }

  const recentSwing = findMostRecentSwingLow(klines, searchEndIndex, lookback, 3);
  if (recentSwing && recentSwing.price) {
    logger.trace({
      currentIndex, skipRecent,
      swingIndex: recentSwing.index,
      swingPrice: recentSwing.price.toFixed(4),
      method: 'findMostRecentSwingLow',
    }, 'Found most recent swing low (fallback) for stop placement');
    return recentSwing.price;
  }

  const fallbackStart = Math.max(0, currentIndex - 20);
  const fallbackEnd = Math.max(fallbackStart, searchEndIndex - 3);
  const lows = [];
  for (let i = fallbackStart; i <= fallbackEnd; i++) {
    const kline = klines[i];
    if (kline) lows.push(parseFloat(String((kline as { low: string }).low)));
  }
  const minLow = lows.length > 0 ? Math.min(...lows) : parseFloat(String((klines[currentIndex] as { low: string }).low));

  logger.trace({
    currentIndex, skipRecent, fallbackStart, fallbackEnd,
    minLow: minLow.toFixed(4),
    method: 'minimumOfRecentLows',
  }, 'Using minimum of recent lows (last resort fallback) for stop placement');

  return minLow;
};

export const findSwingHigh = (klines: Kline[], currentIndex: number, skipRecent: number = 0): number => {
  const lookback = Math.min(100, currentIndex);
  const searchEndIndex = currentIndex - skipRecent;

  const significantSwing = findSignificantSwingHigh(klines, searchEndIndex, lookback);
  if (significantSwing && significantSwing.price) {
    logger.trace({
      currentIndex, skipRecent,
      swingIndex: significantSwing.index,
      swingPrice: significantSwing.price.toFixed(4),
      method: 'findSignificantSwingHigh',
    }, 'Found significant swing high for stop placement');
    return significantSwing.price;
  }

  const recentSwing = findMostRecentSwingHigh(klines, searchEndIndex, lookback, 3);
  if (recentSwing && recentSwing.price) {
    logger.trace({
      currentIndex, skipRecent,
      swingIndex: recentSwing.index,
      swingPrice: recentSwing.price.toFixed(4),
      method: 'findMostRecentSwingHigh',
    }, 'Found most recent swing high (fallback) for stop placement');
    return recentSwing.price;
  }

  const fallbackStart = Math.max(0, currentIndex - 20);
  const fallbackEnd = Math.max(fallbackStart, searchEndIndex - 3);
  const highs = [];
  for (let i = fallbackStart; i <= fallbackEnd; i++) {
    const kline = klines[i];
    if (kline) highs.push(parseFloat(String((kline as { high: string }).high)));
  }
  const maxHigh = highs.length > 0 ? Math.max(...highs) : parseFloat(String((klines[currentIndex] as { high: string }).high));

  logger.trace({
    currentIndex, skipRecent, fallbackStart, fallbackEnd,
    maxHigh: maxHigh.toFixed(4),
    method: 'maximumOfRecentHighs',
  }, 'Using maximum of recent highs (last resort fallback) for stop placement');

  return maxHigh;
};

export const calculateSwingHighLowStop = (
  exit: ExitLevel,
  context: ExitContext,
  indicatorEngine: IndicatorEngine,
  resolveOperand: (operand: ConditionOperand | undefined, context: ExitContext) => number
): number => {
  const { direction, entryPrice, klines, currentIndex, indicators, fibonacciSwing } = context;

  if (klines.length === 0 || currentIndex < 2) {
    throw new Error('Insufficient klines for swing high/low calculation');
  }

  let rawSwingPrice: number;
  let usedFibonacciSwing = false;

  const useNearestSwing = context.initialStopMode === 'nearest_swing';
  if (fibonacciSwing && !useNearestSwing) {
    rawSwingPrice = direction === 'SHORT' ? fibonacciSwing.swingHigh.price : fibonacciSwing.swingLow.price;
    usedFibonacciSwing = true;
    logger.trace({
      direction,
      swingPrice: rawSwingPrice.toFixed(4),
      swingType: direction === 'SHORT' ? 'swingHigh' : 'swingLow',
    }, 'Using Fibonacci swing for stop loss calculation');
  } else if (useNearestSwing) {
    rawSwingPrice = direction === 'SHORT'
      ? findNearestLocalSwingHigh(klines as Kline[], currentIndex)
      : findNearestLocalSwingLow(klines as Kline[], currentIndex);
  } else {
    rawSwingPrice = direction === 'SHORT'
      ? findSwingHigh(klines as Kline[], currentIndex, SWING_SKIP_RECENT)
      : findSwingLow(klines as Kline[], currentIndex, SWING_SKIP_RECENT);
  }

  let stopLoss = rawSwingPrice;

  let bufferApplied = false;
  const atrValue = indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;
  const atrPercent = atrValue > 0 && entryPrice > 0 ? calculateATRPercent(atrValue, entryPrice) : 0;

  if (exit.buffer !== undefined) {
    const bufferValue = resolveOperand(exit.buffer, context);
    if (exit.indicator === 'atr') {
      const effectiveBuffer = Math.max(bufferValue, MIN_SWING_BUFFER_ATR);
      const adjustedBuffer = atrPercent > 0
        ? getVolatilityAdjustedMultiplier(effectiveBuffer, atrPercent)
        : effectiveBuffer;
      const bufferAmount = atrValue * adjustedBuffer;
      stopLoss = direction === 'SHORT' ? stopLoss + bufferAmount : stopLoss - bufferAmount;
      bufferApplied = true;

      if (adjustedBuffer !== effectiveBuffer) {
        logger.trace({
          direction, requestedBuffer: bufferValue, baseBuffer: effectiveBuffer,
          adjustedBuffer: adjustedBuffer.toFixed(3), atrPercent: atrPercent.toFixed(2),
        }, 'Volatility-adjusted ATR buffer for swing stop');
      } else if (bufferValue < MIN_SWING_BUFFER_ATR) {
        logger.trace({
          direction, requestedBuffer: bufferValue, appliedBuffer: effectiveBuffer,
          minBuffer: MIN_SWING_BUFFER_ATR,
        }, 'Buffer increased to minimum ATR buffer');
      }
    } else {
      const bufferAmount = entryPrice * (bufferValue / 100);
      stopLoss = direction === 'SHORT' ? stopLoss + bufferAmount : stopLoss - bufferAmount;
      bufferApplied = true;
    }
  }

  if (!bufferApplied) {
    const baseMinAtrBuffer = MIN_SWING_BUFFER_ATR;
    const adjustedMinAtrBuffer = atrPercent > 0
      ? getVolatilityAdjustedMultiplier(baseMinAtrBuffer, atrPercent)
      : baseMinAtrBuffer;
    const minAtrBuffer = atrValue * adjustedMinAtrBuffer;
    const defaultPercentBuffer = stopLoss * (DEFAULT_SWING_BUFFER_PERCENT / 100);
    const defaultBufferAmount = Math.max(minAtrBuffer, defaultPercentBuffer);
    stopLoss = direction === 'SHORT' ? stopLoss + defaultBufferAmount : stopLoss - defaultBufferAmount;
    logger.trace({
      direction, defaultBufferPercent: DEFAULT_SWING_BUFFER_PERCENT,
      minAtrBuffer: minAtrBuffer.toFixed(4), adjustedAtrMultiplier: adjustedMinAtrBuffer.toFixed(3),
      bufferAmount: defaultBufferAmount.toFixed(4),
    }, 'Applied default swing buffer (max of ATR and percent)');
  }

  const isOnWrongSide = direction === 'LONG' ? stopLoss >= entryPrice : stopLoss <= entryPrice;
  const separationPercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
  let usedFallback = false;

  if (isOnWrongSide || separationPercent < MIN_ENTRY_STOP_SEPARATION_PERCENT) {
    const minDistance = entryPrice * (MIN_ENTRY_STOP_SEPARATION_PERCENT / 100);
    const atrFallback = atrValue * 1.5;
    const fallbackDistance = Math.max(minDistance, atrFallback);

    stopLoss = direction === 'LONG'
      ? entryPrice - fallbackDistance
      : entryPrice + fallbackDistance;
    usedFallback = true;

    logger.trace({
      direction, originalStopLoss: rawSwingPrice.toFixed(4),
      wasOnWrongSide: isOnWrongSide,
      originalSeparation: `${separationPercent.toFixed(3)}%`,
      minRequired: `${MIN_ENTRY_STOP_SEPARATION_PERCENT}%`,
      fallbackDistance: fallbackDistance.toFixed(4),
      newStopLoss: stopLoss.toFixed(4),
    }, 'Swing stop invalid or too close - applied ATR-based fallback');
  }

  const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
  if (!isValid) {
    logger.error({
      direction, entryPrice: entryPrice.toFixed(4),
      stopLoss: stopLoss.toFixed(4), exitType: exit.type,
    }, '✗ INVALID SWING HIGH/LOW STOP - SL must be below entry for LONG and above entry for SHORT');
    throw new Error(`Invalid swing high/low stop loss: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
  }

  const finalSeparation = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
  const maxLookback = Math.min(50, currentIndex);

  logger.trace({
    type: 'stopLoss', exitType: 'swingHighLow', direction,
    entryPrice: entryPrice.toFixed(4), rawSwingPrice: rawSwingPrice.toFixed(4),
    stopLoss: stopLoss.toFixed(4),
    maxCandlesConsidered: usedFibonacciSwing ? 'fibonacci' : maxLookback,
    skipRecent: usedFibonacciSwing ? 0 : SWING_SKIP_RECENT,
    percentFromEntry: `${finalSeparation.toFixed(2)}%`,
    bufferApplied: bufferApplied ? 'custom' : 'default',
    usedFallback, usedFibonacciSwing,
  }, 'Swing high/low stop loss calculated');

  return stopLoss;
};
