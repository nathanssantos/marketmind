import { describe, expect, it } from 'vitest';
import { calculateRequiredKlines } from '../utils/kline-calculator';
import { REQUIRED_KLINES } from '../constants';

describe('kline-calculator', () => {
  describe('calculateRequiredKlines', () => {
    it('should always return REQUIRED_KLINES constant', () => {
      const result = calculateRequiredKlines();
      expect(result).toBe(REQUIRED_KLINES);
    });

    it('should return at least 2500 klines for proper EMA convergence', () => {
      const result = calculateRequiredKlines();
      expect(result).toBeGreaterThanOrEqual(2500);
    });
  });

  describe('REQUIRED_KLINES constant', () => {
    it('should be at least 2500 for EMA200 convergence', () => {
      expect(REQUIRED_KLINES).toBeGreaterThanOrEqual(2500);
    });

    it('should be a positive integer', () => {
      expect(Number.isInteger(REQUIRED_KLINES)).toBe(true);
      expect(REQUIRED_KLINES).toBeGreaterThan(0);
    });
  });
});
