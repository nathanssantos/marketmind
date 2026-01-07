import { describe, expect, it } from 'vitest';
import {
  calculatePositionExposure,
  calculateMaxPositionValue,
  calculateMaxTotalExposure,
  calculateMaxDailyLoss,
  calculateDrawdownPercent,
  validateOrderSizePure,
  calculateExposureUtilization,
  type PositionLike,
} from '../services/risk-manager';

const createPosition = (overrides: Partial<PositionLike> = {}): PositionLike => ({
  entryPrice: 100,
  quantity: 1,
  ...overrides,
});

describe('Risk Manager Pure Functions', () => {
  describe('calculatePositionExposure', () => {
    it('should return 0 for empty array', () => {
      expect(calculatePositionExposure([])).toBe(0);
    });

    it('should calculate exposure for single position', () => {
      const positions = [createPosition({ entryPrice: 50000, quantity: 0.1 })];
      expect(calculatePositionExposure(positions)).toBe(5000);
    });

    it('should calculate exposure for multiple positions', () => {
      const positions = [
        createPosition({ entryPrice: 50000, quantity: 0.1 }),
        createPosition({ entryPrice: 51000, quantity: 0.2 }),
      ];
      expect(calculatePositionExposure(positions)).toBe(5000 + 10200);
    });

    it('should handle decimal values', () => {
      const positions = [
        createPosition({ entryPrice: 42315.75, quantity: 0.00123 }),
      ];
      expect(calculatePositionExposure(positions)).toBeCloseTo(52.05, 2);
    });
  });

  describe('calculateMaxPositionValue', () => {
    it('should calculate correct max position value', () => {
      expect(calculateMaxPositionValue(10000, 10)).toBe(1000);
      expect(calculateMaxPositionValue(10000, 25)).toBe(2500);
      expect(calculateMaxPositionValue(10000, 100)).toBe(10000);
    });

    it('should handle decimal percentages', () => {
      expect(calculateMaxPositionValue(10000, 2.5)).toBe(250);
    });

    it('should return 0 for 0% position size', () => {
      expect(calculateMaxPositionValue(10000, 0)).toBe(0);
    });

    it('should handle large balances', () => {
      expect(calculateMaxPositionValue(1000000, 5)).toBe(50000);
    });
  });

  describe('calculateMaxTotalExposure', () => {
    it('should calculate total exposure correctly', () => {
      expect(calculateMaxTotalExposure(10000, 10, 3)).toBe(3000);
      expect(calculateMaxTotalExposure(10000, 20, 5)).toBe(10000);
    });

    it('should scale with concurrent positions', () => {
      const base = calculateMaxTotalExposure(10000, 10, 1);
      expect(calculateMaxTotalExposure(10000, 10, 2)).toBe(base * 2);
      expect(calculateMaxTotalExposure(10000, 10, 3)).toBe(base * 3);
    });
  });

  describe('calculateMaxDailyLoss', () => {
    it('should calculate max daily loss correctly', () => {
      expect(calculateMaxDailyLoss(10000, 5)).toBe(500);
      expect(calculateMaxDailyLoss(10000, 2)).toBe(200);
    });

    it('should handle small percentages', () => {
      expect(calculateMaxDailyLoss(100000, 0.5)).toBe(500);
    });
  });

  describe('calculateDrawdownPercent', () => {
    it('should return 0 for no drawdown', () => {
      expect(calculateDrawdownPercent(10000, 10000)).toBe(0);
    });

    it('should calculate positive drawdown', () => {
      expect(calculateDrawdownPercent(10000, 9000)).toBe(10);
      expect(calculateDrawdownPercent(10000, 8500)).toBe(15);
    });

    it('should return negative for profit', () => {
      expect(calculateDrawdownPercent(10000, 11000)).toBe(-10);
    });

    it('should return 0 for zero initial balance', () => {
      expect(calculateDrawdownPercent(0, 1000)).toBe(0);
    });

    it('should return 0 for negative initial balance', () => {
      expect(calculateDrawdownPercent(-1000, 500)).toBe(0);
    });

    it('should handle 100% drawdown', () => {
      expect(calculateDrawdownPercent(10000, 0)).toBe(100);
    });
  });

  describe('validateOrderSizePure', () => {
    it('should validate valid order size', () => {
      const result = validateOrderSizePure(10000, 500, 10);
      expect(result.isValid).toBe(true);
      expect(result.maxAllowed).toBe(1000);
    });

    it('should invalidate order exceeding max', () => {
      const result = validateOrderSizePure(10000, 1500, 10);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
      expect(result.maxAllowed).toBe(1000);
    });

    it('should validate order at exactly max', () => {
      const result = validateOrderSizePure(10000, 1000, 10);
      expect(result.isValid).toBe(true);
    });

    it('should handle small balances', () => {
      const result = validateOrderSizePure(100, 15, 10);
      expect(result.isValid).toBe(false);
      expect(result.maxAllowed).toBe(10);
    });
  });

  describe('calculateExposureUtilization', () => {
    it('should calculate utilization percentage', () => {
      expect(calculateExposureUtilization(500, 1000)).toBe(50);
      expect(calculateExposureUtilization(750, 1000)).toBe(75);
      expect(calculateExposureUtilization(1000, 1000)).toBe(100);
    });

    it('should return 0 when max allowed is 0', () => {
      expect(calculateExposureUtilization(500, 0)).toBe(0);
    });

    it('should handle over-utilization', () => {
      expect(calculateExposureUtilization(1500, 1000)).toBe(150);
    });

    it('should handle zero exposure', () => {
      expect(calculateExposureUtilization(0, 1000)).toBe(0);
    });
  });
});
