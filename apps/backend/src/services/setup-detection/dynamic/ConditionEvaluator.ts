import { serializeError } from '../../../utils/errors';

import type {
  ComparisonOperator,
  ComputedIndicators,
  Condition,
  ConditionGroup,
  ConditionOperand,
  EvaluationContext,
} from '@marketmind/types';
import {
  isCalcExpression,
  isConditionGroup,
  isParameterReference,
} from '@marketmind/types';

import { logger } from '../../logger';
import type { IndicatorEngine } from './IndicatorEngine';

const MATH_EXPRESSION_REGEX = /^(.+?)\s*([*+\-/])\s*(\d+\.?\d*)$/;

export class ConditionEvaluator {
  private indicatorEngine: IndicatorEngine;

  constructor(indicatorEngine: IndicatorEngine) {
    this.indicatorEngine = indicatorEngine;
  }

  evaluate(
    condition: Condition | ConditionGroup,
    context: EvaluationContext
  ): boolean {
    if (isConditionGroup(condition)) {
      return this.evaluateGroup(condition, context);
    }
    return this.evaluateSimple(condition, context);
  }

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

  private evaluateSimple(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    const { op } = condition;

    if (op === 'crossover' || op === 'crossunder') {
      return this.evaluateCrossover(condition, context, op === 'crossover');
    }

    const leftValue = this.resolveValue(condition.left, context);
    const rightValue = this.resolveValue(condition.right, context);

    if (leftValue === null || rightValue === null) {
      return false;
    }

    const result = this.compare(leftValue, rightValue, op);



    return result;
  }

  private evaluateCrossover(
    condition: Condition,
    context: EvaluationContext,
    isCrossover: boolean
  ): boolean {
    const { currentIndex, indicators, params } = context;

    if (currentIndex < 1) {
      return false;
    }

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
      return leftPrevious <= rightPrevious && leftCurrent > rightCurrent;
    } else {
      return leftPrevious >= rightPrevious && leftCurrent < rightCurrent;
    }
  }

  private getSeriesForOperand(
    operand: ConditionOperand,
    indicators: ComputedIndicators,
    params: Record<string, number>
  ): (number | null)[] {
    if (typeof operand === 'number') {
      const length = this.getIndicatorLength(indicators);
      return new Array(length).fill(operand);
    }

    if (isCalcExpression(operand)) {
      const length = this.getIndicatorLength(indicators);
      const series: (number | null)[] = [];
      for (let i = 0; i < length; i++) {
        const value = this.evaluateCalcExpression(operand.calc, {
          klines: [],
          indicators,
          params,
          currentIndex: i,
        });
        series.push(value);
      }
      return series;
    }

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

  private getIndicatorLength(indicators: ComputedIndicators): number {
    const priceIndicator = indicators['_price'];
    if (priceIndicator && !Array.isArray(priceIndicator.values)) {
      const values = priceIndicator.values;
      return values['close']?.length ?? 0;
    }
    return 0;
  }

  private resolveValue(
    operand: ConditionOperand,
    context: EvaluationContext
  ): number | null {
    const { currentIndex, indicators, params } = context;

    if (typeof operand === 'number') {
      return operand;
    }

    if (isCalcExpression(operand)) {
      return this.evaluateCalcExpression(operand.calc, context);
    }

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

  private evaluateCalcExpression(
    expression: string,
    context: EvaluationContext
  ): number | null {
    try {
      const resolveToken = (token: string): number | null => {
        const trimmed = token.trim();
        
        if (trimmed.startsWith('$')) {
          const paramName = trimmed.slice(1);
          return context.params[paramName] ?? null;
        }
        
        const numValue = parseFloat(trimmed);
        if (!isNaN(numValue)) {
          return numValue;
        }
        
        return this.indicatorEngine.resolveIndicatorValue(
          context.indicators,
          trimmed,
          context.currentIndex
        );
      };

      const tokenize = (exp: string): string[] => {
        const tokens: string[] = [];
        let current = '';
        let parenDepth = 0;
        
        for (let i = 0; i < exp.length; i++) {
          const char = exp[i];
          
          if (char === '(') {
            parenDepth++;
            current += char;
          } else if (char === ')') {
            parenDepth--;
            current += char;
          } else if (['+', '-', '*', '/'].includes(char!) && parenDepth === 0) {
            if (current.trim()) tokens.push(current.trim());
            tokens.push(char!);
            current = '';
          } else {
            current += char;
          }
        }
        if (current.trim()) tokens.push(current.trim());
        
        return tokens;
      };

      const evaluateTokens = (tokens: string[]): number | null => {
        if (tokens.length === 1) {
          const token = tokens[0]!;
          if (token.startsWith('(') && token.endsWith(')')) {
            return this.evaluateCalcExpression(token.slice(1, -1), context);
          }
          return resolveToken(token);
        }

        for (let i = 1; i < tokens.length; i += 2) {
          const op = tokens[i];
          if (op === '*' || op === '/') {
            const left = resolveToken(tokens[i - 1]!);
            const right = resolveToken(tokens[i + 1]!);
            if (left === null || right === null) return null;
            
            const result = op === '*' ? left * right : (right !== 0 ? left / right : null);
            if (result === null) return null;
            
            tokens.splice(i - 1, 3, result.toString());
            i -= 2;
          }
        }

        let result: number | null = resolveToken(tokens[0]!);
        if (result === null) return null;
        
        for (let i = 1; i < tokens.length; i += 2) {
          const op = tokens[i];
          const right = resolveToken(tokens[i + 1]!);
          if (right === null) return null;
          
          if (op === '+') result += right;
          else if (op === '-') result -= right;
        }
        
        return result;
      };

      const tokens = tokenize(expression.trim());
      return evaluateTokens(tokens);
      
    } catch (error) {
      logger.error({ expression, error: serializeError(error) }, 'Error evaluating calc expression');
      return null;
    }
  }

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
