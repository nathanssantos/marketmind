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

describe('Risk Manager Utilities', () => {
  describe('calculatePositionExposure', () => {
    it('should return 0 for empty positions array', () => {
      const result = calculatePositionExposure([]);
      expect(result).toBe(0);
    });

    it('should calculate exposure for single position', () => {
      const positions: PositionLike[] = [
        { entryPrice: '100', quantity: '10' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBe(1000);
    });

    it('should calculate exposure for multiple positions', () => {
      const positions: PositionLike[] = [
        { entryPrice: '100', quantity: '10' },
        { entryPrice: '50', quantity: '20' },
        { entryPrice: '200', quantity: '5' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBe(3000);
    });

    it('should handle decimal values', () => {
      const positions: PositionLike[] = [
        { entryPrice: '50000.50', quantity: '0.001' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBeCloseTo(50.0005, 4);
    });

    it('should handle very large numbers', () => {
      const positions: PositionLike[] = [
        { entryPrice: '100000', quantity: '1000' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBe(100000000);
    });

    it('should handle zero quantity', () => {
      const positions: PositionLike[] = [
        { entryPrice: '100', quantity: '0' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBe(0);
    });

    it('should handle zero price', () => {
      const positions: PositionLike[] = [
        { entryPrice: '0', quantity: '10' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBe(0);
    });
  });

  describe('calculateMaxPositionValue', () => {
    it('should calculate 10% of balance', () => {
      const result = calculateMaxPositionValue(10000, 10);
      expect(result).toBe(1000);
    });

    it('should calculate 100% of balance', () => {
      const result = calculateMaxPositionValue(10000, 100);
      expect(result).toBe(10000);
    });

    it('should calculate 1% of balance', () => {
      const result = calculateMaxPositionValue(10000, 1);
      expect(result).toBe(100);
    });

    it('should handle 0% position size', () => {
      const result = calculateMaxPositionValue(10000, 0);
      expect(result).toBe(0);
    });

    it('should handle 0 balance', () => {
      const result = calculateMaxPositionValue(0, 10);
      expect(result).toBe(0);
    });

    it('should handle decimal percentages', () => {
      const result = calculateMaxPositionValue(10000, 2.5);
      expect(result).toBe(250);
    });

    it('should handle very small balances', () => {
      const result = calculateMaxPositionValue(0.01, 50);
      expect(result).toBe(0.005);
    });
  });

  describe('calculateMaxTotalExposure', () => {
    it('should calculate total exposure for multiple positions', () => {
      const result = calculateMaxTotalExposure(10000, 10, 5);
      expect(result).toBe(5000);
    });

    it('should handle single position limit', () => {
      const result = calculateMaxTotalExposure(10000, 10, 1);
      expect(result).toBe(1000);
    });

    it('should handle 0 concurrent positions', () => {
      const result = calculateMaxTotalExposure(10000, 10, 0);
      expect(result).toBe(0);
    });

    it('should handle high position size percentage', () => {
      const result = calculateMaxTotalExposure(10000, 50, 2);
      expect(result).toBe(10000);
    });

    it('should handle decimal values', () => {
      const result = calculateMaxTotalExposure(10000, 5.5, 3);
      expect(result).toBe(1650);
    });
  });

  describe('calculateMaxDailyLoss', () => {
    it('should calculate 5% daily loss limit', () => {
      const result = calculateMaxDailyLoss(10000, 5);
      expect(result).toBe(500);
    });

    it('should calculate 1% daily loss limit', () => {
      const result = calculateMaxDailyLoss(10000, 1);
      expect(result).toBe(100);
    });

    it('should handle 0 limit', () => {
      const result = calculateMaxDailyLoss(10000, 0);
      expect(result).toBe(0);
    });

    it('should handle 0 balance', () => {
      const result = calculateMaxDailyLoss(0, 5);
      expect(result).toBe(0);
    });

    it('should handle large balance', () => {
      const result = calculateMaxDailyLoss(1000000, 2);
      expect(result).toBe(20000);
    });
  });

  describe('calculateDrawdownPercent', () => {
    it('should calculate 10% drawdown', () => {
      const result = calculateDrawdownPercent(10000, 9000);
      expect(result).toBe(10);
    });

    it('should return 0 for no drawdown', () => {
      const result = calculateDrawdownPercent(10000, 10000);
      expect(result).toBe(0);
    });

    it('should return negative for profit', () => {
      const result = calculateDrawdownPercent(10000, 11000);
      expect(result).toBe(-10);
    });

    it('should return 0 for 0 initial balance', () => {
      const result = calculateDrawdownPercent(0, 1000);
      expect(result).toBe(0);
    });

    it('should return 0 for negative initial balance', () => {
      const result = calculateDrawdownPercent(-1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate 100% drawdown', () => {
      const result = calculateDrawdownPercent(10000, 0);
      expect(result).toBe(100);
    });

    it('should calculate 50% drawdown', () => {
      const result = calculateDrawdownPercent(10000, 5000);
      expect(result).toBe(50);
    });

    it('should handle decimal values', () => {
      const result = calculateDrawdownPercent(10000, 9500);
      expect(result).toBe(5);
    });
  });

  describe('validateOrderSizePure', () => {
    it('should validate order within limits', () => {
      const result = validateOrderSizePure(10000, 500, 10);
      expect(result.isValid).toBe(true);
      expect(result.maxAllowed).toBe(1000);
      expect(result.reason).toBeUndefined();
    });

    it('should reject order exceeding limits', () => {
      const result = validateOrderSizePure(10000, 1500, 10);
      expect(result.isValid).toBe(false);
      expect(result.maxAllowed).toBe(1000);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('should validate order at exact limit', () => {
      const result = validateOrderSizePure(10000, 1000, 10);
      expect(result.isValid).toBe(true);
    });

    it('should handle 0 balance', () => {
      const result = validateOrderSizePure(0, 100, 10);
      expect(result.isValid).toBe(false);
      expect(result.maxAllowed).toBe(0);
    });

    it('should handle 0 order value', () => {
      const result = validateOrderSizePure(10000, 0, 10);
      expect(result.isValid).toBe(true);
    });

    it('should handle 100% position size', () => {
      const result = validateOrderSizePure(10000, 10000, 100);
      expect(result.isValid).toBe(true);
      expect(result.maxAllowed).toBe(10000);
    });

    it('should format reason with 2 decimal places', () => {
      const result = validateOrderSizePure(10000, 1500.555, 10);
      expect(result.reason).toContain('1500.56');
      expect(result.reason).toContain('1000.00');
    });
  });

  describe('calculateExposureUtilization', () => {
    it('should calculate 50% utilization', () => {
      const result = calculateExposureUtilization(500, 1000);
      expect(result).toBe(50);
    });

    it('should calculate 100% utilization', () => {
      const result = calculateExposureUtilization(1000, 1000);
      expect(result).toBe(100);
    });

    it('should calculate 0% utilization', () => {
      const result = calculateExposureUtilization(0, 1000);
      expect(result).toBe(0);
    });

    it('should return 0 for 0 max allowed', () => {
      const result = calculateExposureUtilization(500, 0);
      expect(result).toBe(0);
    });

    it('should handle over 100% utilization', () => {
      const result = calculateExposureUtilization(1500, 1000);
      expect(result).toBe(150);
    });

    it('should handle decimal values', () => {
      const result = calculateExposureUtilization(333.33, 1000);
      expect(result).toBeCloseTo(33.333, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle NaN input gracefully in exposure calculation', () => {
      const positions: PositionLike[] = [
        { entryPrice: 'invalid', quantity: '10' }
      ];
      const result = calculatePositionExposure(positions);
      expect(result).toBeNaN();
    });

    it('should handle extremely large position sizes', () => {
      const result = calculateMaxPositionValue(Number.MAX_SAFE_INTEGER, 1);
      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle precision in drawdown calculations', () => {
      const result = calculateDrawdownPercent(100.33, 99.77);
      expect(result).toBeCloseTo(0.558, 2);
    });
  });
});
