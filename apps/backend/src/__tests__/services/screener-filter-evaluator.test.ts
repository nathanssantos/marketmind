import type { ScreenerFilterCondition } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { evaluateFilter, evaluateFilters, needsPreviousValues, getLookbackBars } from '../../services/screener/filter-evaluator';

const makeCondition = (overrides: Partial<ScreenerFilterCondition> & Pick<ScreenerFilterCondition, 'indicator' | 'operator'>): ScreenerFilterCondition => ({
  id: 'test-' + Math.random().toString(36).slice(2, 6),
  ...overrides,
});

describe('FilterEvaluator', () => {
  describe('evaluateFilter', () => {
    it('should pass ABOVE when value > threshold', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 });
      const result = evaluateFilter(cond, { RSI: 65 });
      expect(result.passed).toBe(true);
      expect(result.actualValue).toBe(65);
    });

    it('should fail ABOVE when value <= threshold', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 });
      expect(evaluateFilter(cond, { RSI: 30 }).passed).toBe(false);
      expect(evaluateFilter(cond, { RSI: 50 }).passed).toBe(false);
    });

    it('should pass BELOW when value < threshold', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 30 });
      expect(evaluateFilter(cond, { RSI: 25 }).passed).toBe(true);
    });

    it('should fail BELOW when value >= threshold', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 30 });
      expect(evaluateFilter(cond, { RSI: 35 }).passed).toBe(false);
    });

    it('should pass BETWEEN when value is in range', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'BETWEEN', value: 30, valueMax: 70 });
      expect(evaluateFilter(cond, { RSI: 50 }).passed).toBe(true);
      expect(evaluateFilter(cond, { RSI: 30 }).passed).toBe(true);
      expect(evaluateFilter(cond, { RSI: 70 }).passed).toBe(true);
    });

    it('should fail BETWEEN when value is out of range', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'BETWEEN', value: 30, valueMax: 70 });
      expect(evaluateFilter(cond, { RSI: 25 }).passed).toBe(false);
      expect(evaluateFilter(cond, { RSI: 75 }).passed).toBe(false);
    });

    it('should pass CROSSES_ABOVE', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 });
      expect(evaluateFilter(cond, { RSI: 55 }, { RSI: 45 }).passed).toBe(true);
    });

    it('should fail CROSSES_ABOVE when already above', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 });
      expect(evaluateFilter(cond, { RSI: 55 }, { RSI: 52 }).passed).toBe(false);
    });

    it('should pass CROSSES_BELOW', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'CROSSES_BELOW', value: 30 });
      expect(evaluateFilter(cond, { RSI: 25 }, { RSI: 35 }).passed).toBe(true);
    });

    it('should pass INCREASING', () => {
      const cond = makeCondition({ indicator: 'ADX', operator: 'INCREASING' });
      expect(evaluateFilter(cond, { ADX: 30 }, { ADX: 25 }).passed).toBe(true);
    });

    it('should fail INCREASING when not increasing', () => {
      const cond = makeCondition({ indicator: 'ADX', operator: 'INCREASING' });
      expect(evaluateFilter(cond, { ADX: 20 }, { ADX: 25 }).passed).toBe(false);
    });

    it('should pass DECREASING', () => {
      const cond = makeCondition({ indicator: 'ADX', operator: 'DECREASING' });
      expect(evaluateFilter(cond, { ADX: 20 }, { ADX: 30 }).passed).toBe(true);
    });

    it('should fail when indicator value is null', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 });
      expect(evaluateFilter(cond, { RSI: null }).passed).toBe(false);
    });

    it('should compare against another indicator', () => {
      const cond = makeCondition({
        indicator: 'PRICE_CLOSE',
        operator: 'ABOVE',
        compareIndicator: 'EMA',
      });
      expect(evaluateFilter(cond, { PRICE_CLOSE: 110, EMA: 100 }).passed).toBe(true);
      expect(evaluateFilter(cond, { PRICE_CLOSE: 90, EMA: 100 }).passed).toBe(false);
    });

    it('should fail CROSSES_ABOVE without previous values', () => {
      const cond = makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 });
      expect(evaluateFilter(cond, { RSI: 55 }).passed).toBe(false);
    });
  });

  describe('evaluateFilters', () => {
    it('should pass when all ungrouped conditions pass', () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 30 }),
        makeCondition({ indicator: 'ADX', operator: 'ABOVE', value: 25 }),
      ];
      const result = evaluateFilters(conditions, { RSI: 20, ADX: 35 });
      expect(result.passed).toBe(true);
      expect(result.matchedCount).toBe(2);
    });

    it('should fail when any ungrouped condition fails', () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 30 }),
        makeCondition({ indicator: 'ADX', operator: 'ABOVE', value: 25 }),
      ];
      const result = evaluateFilters(conditions, { RSI: 50, ADX: 35 });
      expect(result.passed).toBe(false);
    });

    it('should pass when any condition in OR group passes', () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 25, logicGroup: 'rsi-extreme' }),
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 75, logicGroup: 'rsi-extreme' }),
        makeCondition({ indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 2 }),
      ];
      const result = evaluateFilters(conditions, { RSI: 80, ATR_PERCENT: 3 });
      expect(result.passed).toBe(true);
    });

    it('should fail when no condition in OR group passes', () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'RSI', operator: 'BELOW', value: 25, logicGroup: 'rsi-extreme' }),
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 75, logicGroup: 'rsi-extreme' }),
      ];
      const result = evaluateFilters(conditions, { RSI: 50 });
      expect(result.passed).toBe(false);
    });

    it('should pass with empty conditions', () => {
      const result = evaluateFilters([], {});
      expect(result.passed).toBe(true);
      expect(result.matchedCount).toBe(0);
    });
  });

  describe('needsPreviousValues', () => {
    it('should return true for CROSSES_ABOVE', () => {
      expect(needsPreviousValues([
        makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 }),
      ])).toBe(true);
    });

    it('should return false for simple operators', () => {
      expect(needsPreviousValues([
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 }),
      ])).toBe(false);
    });
  });

  describe('getLookbackBars', () => {
    it('should return 0 for simple operators', () => {
      expect(getLookbackBars([
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 }),
      ])).toBe(0);
    });

    it('should return LOOKBACK_BARS_FOR_CROSS for cross operators', () => {
      expect(getLookbackBars([
        makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 }),
      ])).toBeGreaterThan(0);
    });
  });
});
