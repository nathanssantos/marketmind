import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../../indicators/evaluator';

describe('evaluateCondition', () => {
  it('returns passed=false and value=null when series is empty', () => {
    expect(evaluateCondition({ series: [], op: 'gt', threshold: 50 })).toEqual({ passed: false, value: null });
  });

  it('ignores trailing nulls and uses most recent defined value', () => {
    const res = evaluateCondition({ series: [10, 20, 30, null, null], op: 'gt', threshold: 25 });
    expect(res).toEqual({ passed: true, value: 30 });
  });

  describe('gt / lt', () => {
    it('gt passes when value > threshold', () => {
      expect(evaluateCondition({ series: [5, 75], op: 'gt', threshold: 70 })).toEqual({ passed: true, value: 75 });
    });

    it('gt fails when value == threshold', () => {
      expect(evaluateCondition({ series: [70], op: 'gt', threshold: 70 })).toEqual({ passed: false, value: 70 });
    });

    it('lt passes when value < threshold', () => {
      expect(evaluateCondition({ series: [20], op: 'lt', threshold: 30 })).toEqual({ passed: true, value: 20 });
    });
  });

  describe('between / outside', () => {
    it('between passes when value in [lo, hi]', () => {
      expect(evaluateCondition({ series: [50], op: 'between', threshold: [40, 60] })).toEqual({ passed: true, value: 50 });
    });

    it('between is inclusive on both bounds', () => {
      expect(evaluateCondition({ series: [40], op: 'between', threshold: [40, 60] }).passed).toBe(true);
      expect(evaluateCondition({ series: [60], op: 'between', threshold: [40, 60] }).passed).toBe(true);
    });

    it('outside passes when value is below lo or above hi', () => {
      expect(evaluateCondition({ series: [30], op: 'outside', threshold: [40, 60] }).passed).toBe(true);
      expect(evaluateCondition({ series: [70], op: 'outside', threshold: [40, 60] }).passed).toBe(true);
      expect(evaluateCondition({ series: [50], op: 'outside', threshold: [40, 60] }).passed).toBe(false);
    });
  });

  describe('cross operations', () => {
    it('crossAbove triggers when prev <= ref and current > ref', () => {
      expect(evaluateCondition({ series: [50, 60], op: 'crossAbove', threshold: 55 }).passed).toBe(true);
    });

    it('crossAbove does not trigger when already above in prev', () => {
      expect(evaluateCondition({ series: [60, 65], op: 'crossAbove', threshold: 55 }).passed).toBe(false);
    });

    it('crossBelow triggers when prev >= ref and current < ref', () => {
      expect(evaluateCondition({ series: [60, 40], op: 'crossBelow', threshold: 50 }).passed).toBe(true);
    });

    it('crossAbove with compareSeries uses compare value as ref', () => {
      const series = [10, 30];
      const compareSeries = [20, 20];
      expect(evaluateCondition({ series, op: 'crossAbove', compareSeries }).passed).toBe(true);
    });
  });

  describe('oversold / overbought', () => {
    it('oversold with valueRange uses 20% of range', () => {
      expect(evaluateCondition({ series: [15], op: 'oversold', valueRange: { min: 0, max: 100 } }).passed).toBe(true);
      expect(evaluateCondition({ series: [25], op: 'oversold', valueRange: { min: 0, max: 100 } }).passed).toBe(false);
    });

    it('overbought with valueRange uses 80% of range', () => {
      expect(evaluateCondition({ series: [85], op: 'overbought', valueRange: { min: 0, max: 100 } }).passed).toBe(true);
      expect(evaluateCondition({ series: [75], op: 'overbought', valueRange: { min: 0, max: 100 } }).passed).toBe(false);
    });

    it('oversold with explicit threshold overrides range', () => {
      expect(evaluateCondition({ series: [35], op: 'oversold', threshold: 40 }).passed).toBe(true);
    });
  });

  describe('rising / falling', () => {
    it('rising when current > prev', () => {
      expect(evaluateCondition({ series: [50, 60], op: 'rising' }).passed).toBe(true);
    });

    it('falling when current < prev', () => {
      expect(evaluateCondition({ series: [60, 50], op: 'falling' }).passed).toBe(true);
    });

    it('rising requires at least two defined values', () => {
      expect(evaluateCondition({ series: [null, 50], op: 'rising' }).passed).toBe(false);
    });
  });

  describe('priceAbove / priceBelow', () => {
    it('priceAbove passes when latest close > latest indicator value', () => {
      expect(
        evaluateCondition({ series: [100, 120], op: 'priceAbove', closeSeries: [110, 125] }).passed,
      ).toBe(true);
    });

    it('priceAbove fails when close <= indicator', () => {
      expect(
        evaluateCondition({ series: [100, 120], op: 'priceAbove', closeSeries: [110, 120] }).passed,
      ).toBe(false);
    });

    it('priceBelow passes when latest close < latest indicator value', () => {
      expect(
        evaluateCondition({ series: [100, 120], op: 'priceBelow', closeSeries: [110, 115] }).passed,
      ).toBe(true);
    });

    it('priceBelow fails when closeSeries missing', () => {
      expect(evaluateCondition({ series: [100], op: 'priceBelow' }).passed).toBe(false);
    });
  });
});
