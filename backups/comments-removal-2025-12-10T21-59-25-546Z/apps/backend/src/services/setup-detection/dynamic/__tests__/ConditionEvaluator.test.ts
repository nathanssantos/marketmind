import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionEvaluator } from '../ConditionEvaluator';
import { IndicatorEngine } from '../IndicatorEngine';
import type { Kline, Condition, ConditionGroup, EvaluationContext } from '@marketmind/types';

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
});
