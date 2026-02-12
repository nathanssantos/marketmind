import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionEvaluator } from '../ConditionEvaluator';
import { IndicatorEngine } from '../IndicatorEngine';
import type { Kline, Condition, ConditionGroup, EvaluationContext, ComparisonOperator } from '@marketmind/types';

function createMockKline(close: number, index: number): Kline {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: (close - 1).toString(),
    high: (close + 2).toString(),
    low: (close - 2).toString(),
    close: close.toString(),
    volume: '1000',
    quoteVolume: (1000 * close).toString(),
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: (500 * close).toString(),
  };
}

function generateKlines(count: number, basePrice: number = 100): Kline[] {
  return Array.from({ length: count }, (_, i) => createMockKline(basePrice + i, i));
}

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;
  let indicatorEngine: IndicatorEngine;

  beforeEach(() => {
    indicatorEngine = new IndicatorEngine();
    evaluator = new ConditionEvaluator(indicatorEngine);
  });

  function createContext(klines: Kline[], currentIndex: number): EvaluationContext {
    const indicators = indicatorEngine.computeIndicators(
      klines,
      {
        emaFast: { type: 'ema', params: { period: 5 } },
        emaSlow: { type: 'ema', params: { period: 10 } },
        rsi: { type: 'rsi', params: { period: 14 } },
      },
      {}
    );

    return {
      klines,
      currentIndex,
      indicators,
      params: { threshold: 70 },
    };
  }

  describe('evaluate - simple conditions', () => {
    it('should evaluate greater than condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '>', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate less than condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '<', right: 150 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate greater than or equal condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '>=', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate less than or equal condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '<=', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate equality condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '==', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate not equal condition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '!=', right: 50 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve parameter references in conditions', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);
      context.params['myThreshold'] = 50;

      const condition: Condition = { left: 'close', op: '>', right: '$myThreshold' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should compare two indicator references', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'emaFast', op: '>', right: 'emaSlow' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('evaluate - condition groups', () => {
    it('should evaluate AND group - all true', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { left: 'close', op: '>', right: 100 },
          { left: 'close', op: '<', right: 200 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(true);
    });

    it('should evaluate AND group - one false', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { left: 'close', op: '>', right: 100 },
          { left: 'close', op: '<', right: 50 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(false);
    });

    it('should evaluate OR group - one true', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { left: 'close', op: '>', right: 200 },
          { left: 'close', op: '>', right: 100 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(true);
    });

    it('should evaluate OR group - all false', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { left: 'close', op: '>', right: 200 },
          { left: 'close', op: '<', right: 50 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(false);
    });

    it('should return false for empty condition group', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(false);
    });
  });

  describe('evaluate - crossover conditions', () => {
    it('should detect crossover when fast crosses above slow', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = i < 15 ? 100 - i : 85 + (i - 15) * 2;
        klines.push(createMockKline(close, i));
      }

      const context = createContext(klines, 29);

      const condition: Condition = { left: 'emaFast', op: 'crossover', right: 'emaSlow' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should detect crossunder when fast crosses below slow', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = i < 15 ? 100 + i : 115 - (i - 15) * 2;
        klines.push(createMockKline(close, i));
      }

      const context = createContext(klines, 29);

      const condition: Condition = { left: 'emaFast', op: 'crossunder', right: 'emaSlow' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should return false for crossover at index 0', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'emaFast', op: 'crossover', right: 'emaSlow' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('evaluate - edge cases', () => {
    it('should return false when left value is null', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'invalidIndicator', op: '>', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should return false when right value is null', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '>', right: 'invalidIndicator' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should handle nested condition groups', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { left: 'close', op: '>', right: 100 },
          {
            operator: 'OR',
            conditions: [
              { left: 'close', op: '>', right: 200 },
              { left: 'close', op: '<', right: 150 },
            ],
          } as ConditionGroup,
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(true);
    });
  });

  describe('resolveValue - math expressions', () => {
    it('should resolve multiplication math expression on indicator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '<', right: 'close * 1.5' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve addition math expression on indicator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '<', right: 'close + 10' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve subtraction math expression on indicator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '>', right: 'close - 10' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve division math expression on indicator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '>', right: 'close / 2' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should return null for division by zero in math expression', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close / 0', op: '>', right: 50 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should return null when base indicator in math expression is invalid', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'nonexistent * 2', op: '>', right: 50 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('resolveValue - string numeric operands', () => {
    it('should parse a string number as a numeric value', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'close', op: '>', right: '50' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should parse a negative string number as a numeric value', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'close', op: '>', right: '-50' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('resolveValue - CalcExpression operands', () => {
    it('should evaluate a simple calc expression with addition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: 'close',
        op: '<',
        right: { calc: 'close + 10' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate a calc expression with multiplication', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: 'close',
        op: '<',
        right: { calc: 'close * 2' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate a calc expression with subtraction', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: 'close',
        op: '>',
        right: { calc: 'close - 10' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate a calc expression with division', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: 'close',
        op: '>',
        right: { calc: 'close / 2' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should return null for calc expression with division by zero', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: { calc: 'close / 0' },
        op: '>',
        right: 50,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate a calc expression with parameter reference', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);
      context.params['multiplier'] = 2;

      const condition: Condition = {
        left: 'close',
        op: '<',
        right: { calc: 'close * $multiplier' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should return null for calc expression referencing missing parameter', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: { calc: '$missingParam + 10' },
        op: '>',
        right: 50,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate calc expression with parentheses as single token', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = {
        left: { calc: '(100)' },
        op: '==',
        right: 100,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should return null when calc expression references invalid indicator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: { calc: 'nonexistent + 10' },
        op: '>',
        right: 50,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate calc expression with numeric literal', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = {
        left: 'close',
        op: '==',
        right: { calc: '100' },
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should handle multiplication and addition in correct precedence', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = {
        left: { calc: '2 * 3 + 4' },
        op: '==',
        right: 10,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('resolveValue - parameter references', () => {
    it('should return null for undefined parameter reference', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: '$unknownParam', op: '>', right: 50 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should resolve left operand as parameter reference', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);
      context.params['myValue'] = 100;

      const condition: Condition = { left: '$myValue', op: '==', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('crossover - additional edge cases', () => {
    it('should return false for crossover with empty indicator series', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 5);

      const condition: Condition = { left: 'nonexistent', op: 'crossover', right: 'alsoNonexistent' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should return false for crossunder at index 0', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'emaFast', op: 'crossunder', right: 'emaSlow' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should handle crossover with numeric operand', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = 95 + i;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 10);

      const condition: Condition = { left: 'close', op: 'crossover', right: 104 };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should handle crossunder with numeric operand', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = 130 - i;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 10);

      const condition: Condition = { left: 'close', op: 'crossunder', right: 121 };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should handle crossover with string numeric operand', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = 95 + i;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 10);

      const condition: Condition = { left: 'close', op: 'crossover', right: '104' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should handle crossover with parameter reference', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = 95 + i;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 10);
      context.params['level'] = 104;

      const condition: Condition = { left: 'close', op: 'crossover', right: '$level' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should return false for crossover with undefined parameter reference', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 10);

      const condition: Condition = { left: 'close', op: 'crossover', right: '$missingParam' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should handle crossover with CalcExpression operand', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = 95 + i;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 15);

      const condition: Condition = { left: 'close', op: 'crossover', right: { calc: 'emaFast + 5' } };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getSeriesForOperand - math expression operators', () => {
    it('should apply multiplication to indicator series in crossover context', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 30; i++) {
        const close = i < 15 ? 100 - i * 0.5 : 93 + (i - 15) * 2;
        klines.push(createMockKline(close, i));
      }
      const context = createContext(klines, 20);

      const condition: Condition = { left: 'emaFast', op: 'crossover', right: 'emaSlow * 0.98' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should apply addition to indicator series in crossover context', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 15);

      const condition: Condition = { left: 'emaFast', op: 'crossover', right: 'emaSlow + 1' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should apply subtraction to indicator series in crossover context', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 15);

      const condition: Condition = { left: 'emaFast', op: 'crossover', right: 'emaSlow - 1' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should apply division to indicator series in crossover context', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 15);

      const condition: Condition = { left: 'close', op: 'crossover', right: 'close / 1.01' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });

    it('should return null for division by zero in series math expression', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 15);

      const condition: Condition = { left: 'close / 0', op: 'crossover', right: 'close' };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('empty OR group', () => {
    it('should return false for empty OR condition group', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(false);
    });
  });

  describe('deeply nested condition groups', () => {
    it('should evaluate three levels of nested groups', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            operator: 'AND',
            conditions: [
              { left: 'close', op: '>', right: 200 },
              { left: 'close', op: '<', right: 50 },
            ],
          } as ConditionGroup,
          {
            operator: 'AND',
            conditions: [
              { left: 'close', op: '>', right: 100 },
              {
                operator: 'OR',
                conditions: [
                  { left: 'close', op: '<', right: 150 },
                ],
              } as ConditionGroup,
            ],
          } as ConditionGroup,
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(true);
    });
  });

  describe('compare - edge cases with float equality', () => {
    it('should treat nearly equal floats as equal', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 100, op: '==', right: 100.00000001 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should treat sufficiently different floats as not equal', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 100, op: '==', right: 100.001 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate != correctly for nearly equal values', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 100, op: '!=', right: 100.00000001 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate != correctly for different values', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 100, op: '!=', right: 100.001 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('numeric left and right operands', () => {
    it('should compare two numeric operands directly', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 50, op: '<', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should compare two numeric operands with >=', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 100, op: '>=', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should return false for false greater than with numerics', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 50, op: '>', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('price source references', () => {
    it('should resolve open price', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'open', op: '>', right: 0 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve high price', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'high', op: '>', right: 'close' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve low price', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'low', op: '<', right: 'close' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should resolve volume', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = { left: 'volume', op: '==', right: 1000 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('calc expression - operator precedence', () => {
    it('should handle multiplication before addition', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = {
        left: { calc: '2 + 3 * 4' },
        op: '==',
        right: 14,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should handle division before subtraction', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 0);

      const condition: Condition = {
        left: { calc: '10 - 6 / 3' },
        op: '==',
        right: 8,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('AND group short-circuit behavior', () => {
    it('should return false early when first condition in AND group fails', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { left: 'close', op: '<', right: 50 },
          { left: 'close', op: '>', right: 100 },
          { left: 'close', op: '<', right: 200 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(false);
    });
  });

  describe('OR group short-circuit behavior', () => {
    it('should return true early when first condition in OR group passes', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { left: 'close', op: '>', right: 100 },
          { left: 'invalidIndicator', op: '>', right: 100 },
        ],
      };

      const result = evaluator.evaluate(group, context);
      expect(result).toBe(true);
    });
  });

  describe('both operands null', () => {
    it('should return false when both operands resolve to null', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 'invalidA', op: '>', right: 'invalidB' };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('compare - default/unknown operator', () => {
    it('should return false for unsupported comparison operator', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = { left: 100, op: 'between' as ComparisonOperator, right: 200 };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('calc expression - error handling', () => {
    it('should return null when calc expression causes an internal error', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 29);

      const condition: Condition = {
        left: { calc: '' },
        op: '>',
        right: 50,
      };
      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('getSeriesForOperand - null values in series for math operations', () => {
    it('should handle null values in series with multiplication', () => {
      const klines = generateKlines(30);
      const context = createContext(klines, 1);

      const condition: Condition = { left: 'rsi * 2', op: 'crossover', right: 100 };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('crossover - null values at specific indices', () => {
    it('should return false when previous index values are null for crossover', () => {
      const klines = generateKlines(5);
      const context = createContext(klines, 1);

      const condition: Condition = { left: 'rsi', op: 'crossover', right: 50 };
      const result = evaluator.evaluate(condition, context);

      expect(typeof result).toBe('boolean');
    });
  });
});
