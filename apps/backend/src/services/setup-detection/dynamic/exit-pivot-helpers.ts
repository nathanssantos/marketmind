import {
  analyzePivots,
  findNearestPivotTarget,
  type EnhancedPivotPoint,
  type PivotDetectionConfig,
  type PivotStrength,
} from '@marketmind/indicators';
import type {
  ConditionOperand,
  ExitContext,
  ExitLevel,
  Kline,
  PivotStrengthFilter,
} from '@marketmind/types';

import { EXIT_CALCULATOR } from '../../../constants';
import { logger } from '../../logger';
import type { IndicatorEngine } from './IndicatorEngine';

const { MIN_SWING_BUFFER_ATR, MIN_ENTRY_STOP_SEPARATION_PERCENT } = EXIT_CALCULATOR;

export const buildPivotConfig = (exit: ExitLevel): PivotDetectionConfig => {
  const config = exit.pivotConfig;
  return {
    lookback: exit.lookback ?? 5,
    lookahead: 2,
    volumeLookback: config?.volumeLookback ?? 20,
    volumeMultiplier: config?.volumeMultiplier ?? 1.2,
  };
};

export const findPrioritizedPivotStop = (
  klines: Kline[],
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  config?: PivotDetectionConfig
): { stop: number | null; pivot: EnhancedPivotPoint | null; reason: string } => {
  const analysis = analyzePivots(klines, config);

  const relevantPivots = direction === 'LONG'
    ? analysis.pivots.filter(p => p.type === 'low' && p.price < entryPrice)
    : analysis.pivots.filter(p => p.type === 'high' && p.price > entryPrice);

  if (relevantPivots.length === 0) {
    return { stop: null, pivot: null, reason: 'no_pivots_found' };
  }

  const strongWithVolume = relevantPivots.find(p => p.strength === 'strong' && p.volumeConfirmed);
  if (strongWithVolume) {
    logger.trace({
      direction,
      pivotPrice: strongWithVolume.price.toFixed(4),
      strength: strongWithVolume.strength,
      volumeConfirmed: true,
    }, 'Found STRONG pivot with volume confirmation');
    return { stop: strongWithVolume.price, pivot: strongWithVolume, reason: 'strong_with_volume' };
  }

  const strong = relevantPivots.find(p => p.strength === 'strong');
  if (strong) {
    logger.trace({
      direction,
      pivotPrice: strong.price.toFixed(4),
      strength: strong.strength,
      volumeConfirmed: strong.volumeConfirmed,
    }, 'Found STRONG pivot');
    return { stop: strong.price, pivot: strong, reason: 'strong' };
  }

  const medium = relevantPivots.find(p => p.strength === 'medium');
  if (medium) {
    logger.trace({
      direction,
      pivotPrice: medium.price.toFixed(4),
      strength: medium.strength,
      volumeConfirmed: medium.volumeConfirmed,
    }, 'Found MEDIUM pivot');
    return { stop: medium.price, pivot: medium, reason: 'medium' };
  }

  return { stop: null, pivot: null, reason: 'only_weak_pivots' };
};

export const isPivotAcceptable = (
  pivot: EnhancedPivotPoint | null,
  minStrength: PivotStrengthFilter,
  requireVolumeConfirmation: boolean
): boolean => {
  if (!pivot) return false;

  if (requireVolumeConfirmation && !pivot.volumeConfirmed) return false;

  if (minStrength === 'any') return true;

  const strengthOrder: Record<PivotStrength, number> = {
    'weak': 1,
    'medium': 2,
    'strong': 3,
  };

  const minStrengthValue = strengthOrder[minStrength as PivotStrength] ?? 0;
  const pivotStrengthValue = strengthOrder[pivot.strength] ?? 0;

  return pivotStrengthValue >= minStrengthValue;
};

export const calculatePivotBasedStop = (
  exit: ExitLevel,
  context: ExitContext,
  indicatorEngine: IndicatorEngine,
  resolveOperand: (operand: ConditionOperand | undefined, context: ExitContext) => number,
  calculateSwingStop: (exit: ExitLevel, context: ExitContext) => number
): number => {
  const { direction, entryPrice, klines, indicators, currentIndex } = context;

  if (klines.length === 0 || currentIndex < 5) {
    throw new Error('Insufficient klines for pivot-based stop calculation');
  }

  const pivotConfig = buildPivotConfig(exit);
  const klinesTyped = klines as Kline[];
  const atrValue = indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;

  const { stop, pivot, reason } = findPrioritizedPivotStop(klinesTyped, entryPrice, direction, pivotConfig);

  if (stop === null) {
    logger.trace({
      direction, entryPrice: entryPrice.toFixed(4), reason,
    }, 'No suitable pivot (STRONG/MEDIUM) found - falling back to swing-based stop');

    const swingExit: ExitLevel = { type: 'swingHighLow', indicator: 'atr', buffer: MIN_SWING_BUFFER_ATR };
    return calculateSwingStop(swingExit, context);
  }

  let stopLoss = stop;

  if (exit.buffer !== undefined && atrValue > 0) {
    const bufferValue = resolveOperand(exit.buffer, context);
    const bufferAmount = atrValue * bufferValue;
    stopLoss = direction === 'LONG' ? stopLoss - bufferAmount : stopLoss + bufferAmount;
  } else if (atrValue > 0) {
    const defaultBuffer = atrValue * MIN_SWING_BUFFER_ATR;
    stopLoss = direction === 'LONG' ? stopLoss - defaultBuffer : stopLoss + defaultBuffer;
  }

  const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
  const separationPercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;

  if (!isValid || separationPercent < MIN_ENTRY_STOP_SEPARATION_PERCENT) {
    logger.trace({
      direction,
      entryPrice: entryPrice.toFixed(4),
      pivotStop: stopLoss.toFixed(4),
      separationPercent: separationPercent.toFixed(3),
      minRequired: MIN_ENTRY_STOP_SEPARATION_PERCENT,
    }, 'Pivot stop invalid or too close - falling back to swing-based stop');

    const swingExit: ExitLevel = { type: 'swingHighLow', indicator: 'atr', buffer: MIN_SWING_BUFFER_ATR };
    return calculateSwingStop(swingExit, context);
  }

  logger.trace({
    type: 'stopLoss',
    exitType: 'pivotBased',
    direction,
    entryPrice: entryPrice.toFixed(4),
    stopLoss: stopLoss.toFixed(4),
    pivotPrice: stop.toFixed(4),
    pivotStrength: pivot?.strength ?? 'unknown',
    volumeConfirmed: pivot?.volumeConfirmed ?? false,
    selectionReason: reason,
    percentFromEntry: `${(((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
  }, 'Pivot-based stop loss calculated with prioritization');

  return stopLoss;
};

export const calculatePivotBasedTarget = (
  exit: ExitLevel,
  context: ExitContext,
  indicatorEngine: IndicatorEngine,
  stopLossPrice: number | undefined,
  calculateTakeProfit: (exit: ExitLevel, context: ExitContext, stopLossPrice?: number) => number
): number => {
  const { direction, entryPrice, klines, indicators, currentIndex } = context;

  if (klines.length === 0 || currentIndex < 5) {
    throw new Error('Insufficient klines for pivot-based target calculation');
  }

  const pivotConfig = buildPivotConfig(exit);
  const klinesTyped = klines as Kline[];

  const { target, pivot } = findNearestPivotTarget(klinesTyped, entryPrice, direction, pivotConfig);

  if (target === null || !isPivotAcceptable(pivot, exit.pivotConfig?.minStrength ?? 'any', exit.pivotConfig?.requireVolumeConfirmation ?? false)) {
    if (exit.fallback) {
      logger.trace({ direction, entryPrice }, 'No suitable pivot found for target - using fallback');
      return calculateTakeProfit(exit.fallback, context, stopLossPrice);
    }

    if (stopLossPrice !== undefined) {
      const slDistance = Math.abs(entryPrice - stopLossPrice);
      const defaultRR = 2.0;
      const fallbackTarget = direction === 'LONG'
        ? entryPrice + (slDistance * defaultRR)
        : entryPrice - (slDistance * defaultRR);

      logger.trace({
        direction,
        entryPrice: entryPrice.toFixed(4),
        fallbackTarget: fallbackTarget.toFixed(4),
        rrRatio: defaultRR,
      }, 'No suitable pivot for target - using 2:1 R:R fallback');

      return fallbackTarget;
    }

    const atrValue = indicatorEngine.resolveIndicatorValue(indicators, 'atr', currentIndex) ?? 0;
    const fallbackMultiplier = 3.0;
    return direction === 'LONG'
      ? entryPrice + (atrValue * fallbackMultiplier)
      : entryPrice - (atrValue * fallbackMultiplier);
  }

  const isValid = direction === 'LONG' ? target > entryPrice : target < entryPrice;
  if (!isValid) {
    if (exit.fallback) {
      return calculateTakeProfit(exit.fallback, context, stopLossPrice);
    }
    throw new Error(`Invalid pivot-based target: ${direction} TP ${target.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
  }

  logger.trace({
    type: 'takeProfit',
    exitType: 'pivotBased',
    direction,
    entryPrice: entryPrice.toFixed(4),
    takeProfit: target.toFixed(4),
    pivotStrength: pivot?.strength ?? 'unknown',
    volumeConfirmed: pivot?.volumeConfirmed ?? false,
    percentFromEntry: `${(((target - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
  }, 'Pivot-based take profit calculated');

  return target;
};
