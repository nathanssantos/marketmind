import { describe, expect, it } from 'vitest';
import { calculateChartKlines, calculateRequiredKlines } from '../utils/kline-calculator';
import { BACKFILL_TARGET_KLINES, CHART_INITIAL_KLINES } from '../constants';

describe('kline-calculator', () => {
  describe('calculateRequiredKlines', () => {
    it('should return BACKFILL_TARGET_KLINES constant for auto-trading backfill', () => {
      const result = calculateRequiredKlines();
      expect(result).toBe(BACKFILL_TARGET_KLINES);
    });

    it('should return 20000 for auto-trading backfill', () => {
      const result = calculateRequiredKlines();
      expect(result).toBe(20_000);
    });
  });

  describe('calculateChartKlines', () => {
    it('should return CHART_INITIAL_KLINES constant for chart display', () => {
      const result = calculateChartKlines();
      expect(result).toBe(CHART_INITIAL_KLINES);
    });

    it('should return 10000 for chart initial load', () => {
      const result = calculateChartKlines();
      expect(result).toBe(10_000);
    });
  });

  describe('BACKFILL_TARGET_KLINES constant', () => {
    it('should be at least 2500 for EMA200 convergence', () => {
      expect(BACKFILL_TARGET_KLINES).toBeGreaterThanOrEqual(2500);
    });

    it('should be a positive integer', () => {
      expect(Number.isInteger(BACKFILL_TARGET_KLINES)).toBe(true);
      expect(BACKFILL_TARGET_KLINES).toBeGreaterThan(0);
    });
  });
});
