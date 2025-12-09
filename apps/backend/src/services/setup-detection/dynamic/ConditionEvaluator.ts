/**
 * Condition Evaluator
 *
 * Evaluates entry/exit conditions defined in strategy JSON.
 * Supports comparison operators, crossover detection, nested condition groups,
 * and mathematical expressions (e.g., "volume.sma20 * 1.5").
 */

import type {
  Condition,
  ConditionGroup,
  ConditionOperand,
  ComparisonOperator,
  ComputedIndicators,
  EvaluationContext,
} from '@marketmind/types';
import {
  isConditionGroup,
  isParameterReference,
} from '@marketmind/types';

import { IndicatorEngine } from './IndicatorEngine';

const MATH_EXPRESSION_REGEX = /^(.+?)\s*([*+\-/])\s*(\d+\.?\d*)$/;

/**
 * Evaluates conditions against market data and indicators
 */
export class ConditionEvaluator {
  private indicatorEngine: IndicatorEngine;

  constructor(indicatorEngine: IndicatorEngine) {
    this.indicatorEngine = indicatorEngine;
  }

  /**
   * Evaluate a condition or condition group
   */
  evaluate(
    condition: Condition | ConditionGroup,
    context: EvaluationContext
  ): boolean {
    if (isConditionGroup(condition)) {
      return this.evaluateGroup(condition, context);
    }
    return this.evaluateSimple(condition, context);
  }

  /**
   * Evaluate a condition group (AND/OR)
   */
  private evaluateGroup(
    group: ConditionGroup,
    context: EvaluationContext
  ): boolean {
    if (group.conditions.length === 0) {
      return false;
    }

    if (group.operator === 'AND') {
      return group.conditions.every((cond) => this.evaluate(cond, context));
    } else {
      return group.conditions.some((cond) => this.evaluate(cond, context));
    }
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateSimple(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    const { op } = condition;

    // Handle crossover/crossunder specially
    if (op === 'crossover' || op === 'crossunder') {
      return this.evaluateCrossover(condition, context, op === 'crossover');
    }

    // Resolve values at current index
    const leftValue = this.resolveValue(condition.left, context);
    const rightValue = this.resolveValue(condition.right, context);

    if (leftValue === null || rightValue === null) {
      return false;
    }

    return this.compare(leftValue, rightValue, op);
  }

  /**
   * Evaluate crossover/crossunder conditions
   *
   * Crossover: left was below right, now is above
   * Crossunder: left was above right, now is below
   */
  private evaluateCrossover(
    condition: Condition,
    context: EvaluationContext,
    isCrossover: boolean
  ): boolean {
    const { currentIndex, indicators, params } = context;

    if (currentIndex < 1) {
      return false;
    }

    // Get series for left and right
    const leftSeries = this.getSeriesForOperand(condition.left, indicators, params);
    const rightSeries = this.getSeriesForOperand(condition.right, indicators, params);

    if (leftSeries.length === 0 || rightSeries.length === 0) {
      return false;
    }

    const leftCurrent = leftSeries[currentIndex];
    const leftPrevious = leftSeries[currentIndex - 1];
    const rightCurrent = rightSeries[currentIndex];
    const rightPrevious = rightSeries[currentIndex - 1];

    if (
      leftCurrent === null ||
      leftCurrent === undefined ||
      leftPrevious === null ||
      leftPrevious === undefined ||
      rightCurrent === null ||
      rightCurrent === undefined ||
      rightPrevious === null ||
      rightPrevious === undefined
    ) {
      return false;
    }

    if (isCrossover) {
      // Left crosses above right
      return leftPrevious <= rightPrevious && leftCurrent > rightCurrent;
    } else {
      // Left crosses below right
      return leftPrevious >= rightPrevious && leftCurrent < rightCurrent;
    }
  }

  /**
   * Get value series for an operand (for crossover detection)
   * Supports mathematical expressions like "emaFast * 1.01"
   */
  private getSeriesForOperand(
    operand: ConditionOperand,
    indicators: ComputedIndicators,
    params: Record<string, number>
  ): (number | null)[] {
    if (typeof operand === 'number') {
      const length = this.getIndicatorLength(indicators);
      return new Array(length).fill(operand);
    }

    // Handle numeric strings (e.g., "30" should be treated as number 30)
    if (typeof operand === 'string' && /^-?\d+\.?\d*$/.test(operand)) {
      const parsed = parseFloat(operand);
      if (!isNaN(parsed)) {
        const length = this.getIndicatorLength(indicators);
        return new Array(length).fill(parsed);
      }
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      const value = params[paramName];
      if (value === undefined) return [];
      const length = this.getIndicatorLength(indicators);
      return new Array(length).fill(value);
    }

    const mathMatch = MATH_EXPRESSION_REGEX.exec(operand);
    if (mathMatch) {
      const [, indicatorRef, operator, multiplierStr] = mathMatch;
      if (!indicatorRef || !operator || !multiplierStr) return [];

      const baseSeries = this.indicatorEngine.getIndicatorSeries(indicators, indicatorRef.trim());
      const multiplier = parseFloat(multiplierStr);
      if (isNaN(multiplier)) return [];

      return baseSeries.map((val) => {
        if (val === null) return null;
        switch (operator) {
          case '*': return val * multiplier;
          case '/': return multiplier !== 0 ? val / multiplier : null;
          case '+': return val + multiplier;
          case '-': return val - multiplier;
          default: return null;
        }
      });
    }

    return this.indicatorEngine.getIndicatorSeries(indicators, operand);
  }

  /**
   * Get length of indicator arrays
   */
  private getIndicatorLength(indicators: ComputedIndicators): number {
    const priceIndicator = indicators['_price'];
    if (priceIndicator && !Array.isArray(priceIndicator.values)) {
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values['close']?.length ?? 0;
    }
    return 0;
  }

  /**
   * Resolve an operand to a numeric value at the current index
   * Supports mathematical expressions like "volume.sma20 * 1.5"
   */
  private resolveValue(
    operand: ConditionOperand,
    context: EvaluationContext
  ): number | null {
    const { currentIndex, indicators, params } = context;

    if (typeof operand === 'number') {
      return operand;
    }

    // Handle numeric strings (e.g., "30" should be treated as number 30)
    if (typeof operand === 'string' && /^-?\d+\.?\d*$/.test(operand)) {
      const parsed = parseFloat(operand);
      if (!isNaN(parsed)) return parsed;
    }

    if (isParameterReference(operand)) {
      const paramName = operand.slice(1);
      const value = params[paramName];
      return value ?? null;
    }

    const mathMatch = MATH_EXPRESSION_REGEX.exec(operand);
    if (mathMatch) {
      const [, indicatorRef, operator, multiplierStr] = mathMatch;
      if (!indicatorRef || !operator || !multiplierStr) return null;

      const baseValue = this.indicatorEngine.resolveIndicatorValue(
        indicators,
        indicatorRef.trim(),
        currentIndex
      );
      if (baseValue === null) return null;

      const multiplier = parseFloat(multiplierStr);
      if (isNaN(multiplier)) return null;

      switch (operator) {
        case '*': return baseValue * multiplier;
        case '/': return multiplier !== 0 ? baseValue / multiplier : null;
        case '+': return baseValue + multiplier;
        case '-': return baseValue - multiplier;
        default: return null;
      }
    }

    return this.indicatorEngine.resolveIndicatorValue(
      indicators,
      operand,
      currentIndex
    );
  }

  /**
   * Compare two values with a comparison operator
   */
  private compare(
    left: number,
    right: number,
    op: ComparisonOperator
  ): boolean {
    switch (op) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '==':
        return Math.abs(left - right) < 0.0000001; // Float comparison
      case '!=':
        return Math.abs(left - right) >= 0.0000001;
      default:
        return false;
    }
  }
}
