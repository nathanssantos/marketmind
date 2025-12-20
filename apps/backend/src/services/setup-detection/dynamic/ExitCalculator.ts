import type {
  Condition,
  ConditionOperand,
  ExitContext,
  ExitLevel,
  StrategyDefinition,
} from '@marketmind/types';
import { isParameterReference } from '@marketmind/types';

import { EXIT_CALCULATOR, FLOAT_COMPARISON } from '../../../constants';
import { logger } from '../../logger';
import type { IndicatorEngine } from './IndicatorEngine';

const {
  DEFAULT_MULTIPLIER,
  DEFAULT_PERCENTAGE,
  DEFAULT_DISTANCE_PERCENT,
  DEFAULT_SWING_BUFFER_PERCENT,
  MIN_SWING_BUFFER_ATR,
  BASE_CONFIDENCE,
  VOLUME_CONFIRMATION_BONUS,
  MAX_CONFIDENCE,
  DEFAULT_MAX_CONFIDENCE,
} = EXIT_CALCULATOR;

const { EPSILON } = FLOAT_COMPARISON;

/**
 * Calculates exit levels (stop loss, take profit) for strategies
 */
export class ExitCalculator {
  private indicatorEngine: IndicatorEngine;

  constructor(indicatorEngine: IndicatorEngine) {
    this.indicatorEngine = indicatorEngine;
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(exit: ExitLevel, context: ExitContext): number {
    const { direction, entryPrice } = context;

    if (exit.type === 'swingHighLow') {
      return this.calculateSwingHighLowStop(exit, context);
    }

    const distance = this.calculateExitDistance(exit, context);

    if (distance < 0) {
      logger.warn({
        direction,
        entryPrice,
        distance,
        exitType: exit.type,
      }, '⚠️  Negative distance for stop loss - using absolute value');
      throw new Error(`Invalid negative distance (${distance}) for stop loss calculation`);
    }

    const stopLoss = direction === 'LONG'
      ? entryPrice - distance
      : entryPrice + distance;

    const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLoss.toFixed(4),
        distance: distance.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID STOP LOSS - SL must be below entry for LONG and above entry for SHORT');
      throw new Error(`Invalid stop loss: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
    }

    logger.debug({
      type: 'stopLoss',
      exitType: exit.type,
      direction,
      entryPrice: entryPrice.toFixed(4),
      distance: distance.toFixed(4),
      stopLoss: stopLoss.toFixed(4),
      percentFromEntry: `${(((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)  }%`,
      note: 'Initial SL - trailing stop may adjust this later',
    }, 'Stop loss calculated');

    return stopLoss;
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(
    exit: ExitLevel,
    context: ExitContext,
    stopLossPrice?: number
  ): number {
    const { direction, entryPrice } = context;

    if (exit.type === 'riskReward' && stopLossPrice !== undefined) {
      const slDistance = Math.abs(entryPrice - stopLossPrice);
      const multiplier = this.resolveOperand(exit.multiplier ?? DEFAULT_MULTIPLIER, context);
      const tpDistance = slDistance * multiplier;

      const takeProfit = direction === 'LONG' 
        ? entryPrice + tpDistance 
        : entryPrice - tpDistance;

      logger.debug({
        type: 'takeProfit',
        exitType: 'riskReward',
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLossPrice.toFixed(4),
        slDistance: slDistance.toFixed(4),
        multiplier: multiplier.toFixed(2),
        tpDistance: tpDistance.toFixed(4),
        takeProfit: takeProfit.toFixed(4),
        riskReward: `${multiplier.toFixed(2)  }:1`,
      }, 'Take profit calculated (R:R)');

      return takeProfit;
    }

    if (exit.type === 'indicator') {
      const target = this.resolveIndicatorTarget(exit, context);
      if (target !== null) {
        const isValid = direction === 'LONG' ? target > entryPrice : target < entryPrice;
        if (!isValid) {
          logger.warn({
            direction,
            entryPrice: entryPrice.toFixed(4),
            indicatorTarget: target.toFixed(4),
            exitType: exit.type,
          }, '⚠️ Indicator-based TP is in loss zone - using fallback or throwing');
          if (exit.fallback) {
            logger.info('Using fallback TP calculation');
            return this.calculateTakeProfit(exit.fallback, context, stopLossPrice);
          }
          throw new Error(`Invalid take profit from indicator: ${direction} TP ${target.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
        }
        return target;
      }
    }

    const distance = this.calculateExitDistance(exit, context);
    const takeProfit = direction === 'LONG' 
      ? entryPrice + distance 
      : entryPrice - distance;

    const isValid = direction === 'LONG' ? takeProfit > entryPrice : takeProfit < entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        takeProfit: takeProfit.toFixed(4),
        distance: distance.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID TAKE PROFIT - TP must be above entry for LONG and below entry for SHORT');
      throw new Error(`Invalid take profit: ${direction} TP ${takeProfit.toFixed(4)} must be ${direction === 'LONG' ? 'above' : 'below'} entry ${entryPrice.toFixed(4)}`);
    }

    return takeProfit;
  }

  /**
   * Calculate the distance from entry price for exit level
   */
  private calculateExitDistance(exit: ExitLevel, context: ExitContext): number {
    const { entryPrice } = context;

    switch (exit.type) {
      case 'atr': {
        const atrValue = this.getATRValue(exit, context);
        const multiplier = this.resolveOperand(exit.multiplier ?? DEFAULT_MULTIPLIER, context);
        return atrValue * multiplier;
      }

      case 'percent': {
        const percent = this.resolveOperand(exit.value ?? DEFAULT_PERCENTAGE, context);
        return entryPrice * (percent / 100);
      }

      case 'fixed': {
        return this.resolveOperand(exit.value ?? 0, context);
      }

      case 'indicator': {
        const target = this.resolveIndicatorTarget(exit, context);
        if (target !== null) {
          return Math.abs(target - entryPrice);
        }
        if (exit.fallback) {
          return this.calculateExitDistance(exit.fallback, context);
        }
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
      }

      case 'riskReward': {
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
      }

      default:
        return entryPrice * DEFAULT_DISTANCE_PERCENT;
    }
  }

  /**
   * Get ATR value from indicator reference
   */
  private getATRValue(exit: ExitLevel, context: ExitContext): number {
    const { indicators, currentIndex } = context;
    const indicatorRef = exit.indicator ?? 'atr';

    const value = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      indicatorRef,
      currentIndex
    );

    return value ?? 0;
  }

  /**
   * Calculate stop loss based on true swing high/low (pivot points)
   * For SHORT: finds most recent swing high (peak confirmed by lower highs around it)
   * For LONG: finds most recent swing low (trough confirmed by higher lows around it)
   * Buffer adds ATR-based distance beyond the swing point to avoid premature stops
   *
   * Searches backwards up to 50 candles to find the first confirmed swing point.
   * If no swing point is found, falls back to min/max of last 20 candles.
   */
  private calculateSwingHighLowStop(exit: ExitLevel, context: ExitContext): number {
    const { direction, entryPrice, klines, currentIndex, indicators } = context;

    if (klines.length === 0 || currentIndex < 2) {
      throw new Error('Insufficient klines for swing high/low calculation');
    }

    let stopLoss: number;

    if (direction === 'SHORT') {
      stopLoss = this.findSwingHigh(klines, currentIndex);
    } else {
      stopLoss = this.findSwingLow(klines, currentIndex);
    }

    let bufferApplied = false;
    const atrValue = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      'atr',
      currentIndex
    ) ?? 0;

    if (exit.buffer !== undefined) {
      const bufferValue = this.resolveOperand(exit.buffer, context);
      if (exit.indicator === 'atr') {
        const effectiveBuffer = Math.max(bufferValue, MIN_SWING_BUFFER_ATR);
        const bufferAmount = atrValue * effectiveBuffer;
        stopLoss = direction === 'SHORT' ? stopLoss + bufferAmount : stopLoss - bufferAmount;
        bufferApplied = true;

        if (bufferValue < MIN_SWING_BUFFER_ATR) {
          logger.debug({
            direction,
            requestedBuffer: bufferValue,
            appliedBuffer: effectiveBuffer,
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
      const minAtrBuffer = atrValue * MIN_SWING_BUFFER_ATR;
      const defaultPercentBuffer = stopLoss * (DEFAULT_SWING_BUFFER_PERCENT / 100);
      const defaultBufferAmount = Math.max(minAtrBuffer, defaultPercentBuffer);
      stopLoss = direction === 'SHORT' ? stopLoss + defaultBufferAmount : stopLoss - defaultBufferAmount;
      logger.debug({
        direction,
        defaultBufferPercent: DEFAULT_SWING_BUFFER_PERCENT,
        minAtrBuffer: minAtrBuffer.toFixed(4),
        bufferAmount: defaultBufferAmount.toFixed(4),
      }, 'Applied default swing buffer (max of ATR and percent)');
    }

    const isValid = direction === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
    if (!isValid) {
      logger.error({
        direction,
        entryPrice: entryPrice.toFixed(4),
        stopLoss: stopLoss.toFixed(4),
        exitType: exit.type,
      }, '❌ INVALID SWING HIGH/LOW STOP - SL must be below entry for LONG and above entry for SHORT');
      throw new Error(`Invalid swing high/low stop loss: ${direction} SL ${stopLoss.toFixed(4)} must be ${direction === 'LONG' ? 'below' : 'above'} entry ${entryPrice.toFixed(4)}`);
    }

    const maxLookback = Math.min(50, currentIndex);
    logger.debug({
      type: 'stopLoss',
      exitType: 'swingHighLow',
      direction,
      entryPrice: entryPrice.toFixed(4),
      stopLoss: stopLoss.toFixed(4),
      maxCandlesConsidered: maxLookback,
      percentFromEntry: `${(((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2)}%`,
      bufferApplied: bufferApplied ? 'custom' : 'default',
    }, 'Swing high/low stop loss calculated');

    return stopLoss;
  }

  /**
   * Resolve indicator target value (e.g., "bb.middle")
   */
  private resolveIndicatorTarget(
    exit: ExitLevel,
    context: ExitContext
  ): number | null {
    const { indicators, currentIndex } = context;

    const indicatorRef = exit.value ?? exit.indicator;

    if (indicatorRef === undefined) {
      return null;
    }

    if (typeof indicatorRef === 'number') {
      return indicatorRef;
    }

    if (typeof indicatorRef === 'string') {
      return this.indicatorEngine.resolveIndicatorValue(
        indicators,
        indicatorRef,
        currentIndex
      );
    }

    return 0;
  }

  /**
   * Resolve an operand (number or parameter reference) to a value
   */
  private resolveOperand(
    operand: ConditionOperand | undefined,
    context: ExitContext
  ): number {
    if (operand === undefined) {
      return 0;
    }

    if (typeof operand === 'number') {
      return operand;
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      return context.params[paramName] ?? 0;
    }

    if (typeof operand === 'string') {
      const value = this.indicatorEngine.resolveIndicatorValue(
        context.indicators,
        operand,
        context.currentIndex
      );
      return value ?? 0;
    }

    return 0;
  }

  /**
   * Calculate confidence score for a strategy signal
   */
  calculateConfidence(
    strategy: StrategyDefinition,
    context: ExitContext
  ): number {
    const config = strategy.confidence;

    if (!config) {
      return this.calculateDefaultConfidence(context);
    }

    let confidence = config.base;
    const appliedBonuses: Array<{ description: string; bonus: number }> = [];

    if (config.bonuses) {
      for (const bonus of config.bonuses) {
        if (this.evaluateBonusCondition(bonus.condition, context)) {
          confidence += bonus.bonus;
          appliedBonuses.push({
            description: bonus.description ?? 'Unknown',
            bonus: bonus.bonus,
          });
        }
      }
    }

    const maxConfidence = config.max ?? DEFAULT_MAX_CONFIDENCE;
    const finalConfidence = Math.min(Math.max(confidence, 0), maxConfidence);

    logger.debug({
      strategy: strategy.id,
      baseConfidence: config.base,
      appliedBonuses,
      totalBonus: appliedBonuses.reduce((sum, b) => sum + b.bonus, 0),
      rawConfidence: confidence,
      maxConfidence,
      finalConfidence,
    }, 'Confidence calculated');

    return finalConfidence;
  }

  /**
   * Evaluate a bonus condition
   */
  private evaluateBonusCondition(
    condition: Condition,
    context: ExitContext
  ): boolean {
    const leftValue = this.resolveConditionOperand(condition.left, context);
    const rightValue = this.resolveConditionOperand(condition.right, context);

    if (leftValue === null || rightValue === null) {
      return false;
    }

    switch (condition.op) {
      case '>':
        return leftValue > rightValue;
      case '<':
        return leftValue < rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '==':
        return Math.abs(leftValue - rightValue) < EPSILON;
      case '!=':
        return Math.abs(leftValue - rightValue) >= EPSILON;
      default:
        return false;
    }
  }

  /**
   * Resolve a condition operand for bonus evaluation
   */
  private resolveConditionOperand(
    operand: ConditionOperand,
    context: ExitContext
  ): number | null {
    if (typeof operand === 'number') {
      return operand;
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      return context.params[paramName] ?? null;
    }

    if (typeof operand === 'string') {
      return this.indicatorEngine.resolveIndicatorValue(
        context.indicators,
        operand,
        context.currentIndex
      );
    }

    return null;
  }

  /**
   * Calculate default confidence when no config is provided
   */
  private calculateDefaultConfidence(context: ExitContext): number {
    const { indicators, currentIndex } = context;

    let confidence = BASE_CONFIDENCE;

    const volumeCurrent = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      'volume.current',
      currentIndex
    );
    const volumeSma20 = this.indicatorEngine.resolveIndicatorValue(
      indicators,
      'volume.sma20',
      currentIndex
    );

    if (volumeCurrent !== null && volumeSma20 !== null && volumeCurrent > volumeSma20) {
      confidence += VOLUME_CONFIRMATION_BONUS;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  /**
   * Calculate risk-reward ratio
   * Returns 0 if stopLoss or takeProfit is null (indicator-based exit strategies)
   */
  calculateRiskReward(
    entryPrice: number,
    stopLoss: number | null,
    takeProfit: number | null,
    _direction: 'LONG' | 'SHORT'
  ): number {
    if (stopLoss === null || takeProfit === null) return 0;

    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entryPrice);

    if (riskDistance === 0) return 0;

    return rewardDistance / riskDistance;
  }

  /**
   * Find true swing low - searches backwards for first pivot low
   * A swing low is confirmed when the low is lower than both neighbors
   */
  private findSwingLow(klines: Kline[], currentIndex: number): number {
    const maxLookback = Math.min(50, currentIndex);

    for (let i = currentIndex - 1; i >= Math.max(1, currentIndex - maxLookback); i--) {
      const kline = klines[i];
      if (!kline) continue;

      const low = parseFloat(String((kline as { low: string }).low));
      const prevLow = parseFloat(String((klines[i - 1] as { low: string }).low));
      const nextLow = parseFloat(String((klines[i + 1] as { low: string }).low));

      if (low <= prevLow && low <= nextLow) {
        return low;
      }
    }

    const fallbackStart = Math.max(0, currentIndex - 20);
    const lows = [];
    for (let i = fallbackStart; i <= currentIndex; i++) {
      const kline = klines[i];
      if (kline) lows.push(parseFloat(String((kline as { low: string }).low)));
    }
    return Math.min(...lows);
  }

  /**
   * Find true swing high - searches backwards for first pivot high
   * A swing high is confirmed when the high is higher than both neighbors
   */
  private findSwingHigh(klines: Kline[], currentIndex: number): number {
    const maxLookback = Math.min(50, currentIndex);

    for (let i = currentIndex - 1; i >= Math.max(1, currentIndex - maxLookback); i--) {
      const kline = klines[i];
      if (!kline) continue;

      const high = parseFloat(String((kline as { high: string }).high));
      const prevHigh = parseFloat(String((klines[i - 1] as { high: string }).high));
      const nextHigh = parseFloat(String((klines[i + 1] as { high: string }).high));

      if (high >= prevHigh && high >= nextHigh) {
        return high;
      }
    }

    const fallbackStart = Math.max(0, currentIndex - 20);
    const highs = [];
    for (let i = fallbackStart; i <= currentIndex; i++) {
      const kline = klines[i];
      if (kline) highs.push(parseFloat(String((kline as { high: string }).high)));
    }
    return Math.max(...highs);
  }
}

