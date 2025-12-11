import type {
  Condition,
  ConditionOperand,
  ExitContext,
  ExitLevel,
  StrategyDefinition,
} from '@marketmind/types';
import { isParameterReference } from '@marketmind/types';

import { EXIT_CALCULATOR, FLOAT_COMPARISON } from '../../../constants';
import type { IndicatorEngine } from './IndicatorEngine';

const {
  DEFAULT_MULTIPLIER,
  DEFAULT_PERCENTAGE,
  DEFAULT_DISTANCE_PERCENT,
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
    const distance = this.calculateExitDistance(exit, context);

    if (direction === 'LONG') {
      return entryPrice - distance;
    } else {
      return entryPrice + distance;
    }
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

      if (direction === 'LONG') {
        return entryPrice + tpDistance;
      } else {
        return entryPrice - tpDistance;
      }
    }

    if (exit.type === 'indicator') {
      const target = this.resolveIndicatorTarget(exit, context);
      if (target !== null) {
        return target;
      }
    }

    const distance = this.calculateExitDistance(exit, context);

    if (direction === 'LONG') {
      return entryPrice + distance;
    } else {
      return entryPrice - distance;
    }
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
   * Resolve indicator target value (e.g., "bb.middle")
   */
  private resolveIndicatorTarget(
    exit: ExitLevel,
    context: ExitContext
  ): number | null {
    const { indicators, currentIndex } = context;

    if (exit.value === undefined) {
      return null;
    }

    if (typeof exit.value === 'number') {
      return exit.value;
    }

    if (typeof exit.value === 'string') {
      return this.indicatorEngine.resolveIndicatorValue(
        indicators,
        exit.value,
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

    if (config.bonuses) {
      for (const bonus of config.bonuses) {
        if (this.evaluateBonusCondition(bonus.condition, context)) {
          confidence += bonus.bonus;
        }
      }
    }

    const maxConfidence = config.max ?? DEFAULT_MAX_CONFIDENCE;
    return Math.min(Math.max(confidence, 0), maxConfidence);
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
}
