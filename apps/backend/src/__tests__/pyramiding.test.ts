import { describe, expect, it } from 'vitest';
import {
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  calculateBaseSize,
  roundQuantity,
  calculatePyramidProfitPercent,
  calculatePyramidSize,
  DEFAULT_PYRAMIDING_CONFIG,
  type ExecutionLike,
} from '../services/pyramiding';

const createExecution = (overrides: Partial<ExecutionLike> = {}): ExecutionLike => ({
  entryPrice: '100',
  quantity: '1',
  side: 'LONG',
  openedAt: new Date('2024-01-01'),
  stopLoss: null,
  ...overrides,
});

describe('Pyramiding Pure Functions', () => {
  describe('calculateWeightedAvgPrice', () => {
    it('should return 0 for empty array', () => {
      expect(calculateWeightedAvgPrice([])).toBe(0);
    });

    it('should calculate simple average for same quantity', () => {
      const executions = [
        createExecution({ entryPrice: '100', quantity: '1' }),
        createExecution({ entryPrice: '110', quantity: '1' }),
      ];
      expect(calculateWeightedAvgPrice(executions)).toBe(105);
    });

    it('should calculate weighted average correctly', () => {
      const executions = [
        createExecution({ entryPrice: '100', quantity: '2' }),
        createExecution({ entryPrice: '110', quantity: '1' }),
      ];
      expect(calculateWeightedAvgPrice(executions)).toBeCloseTo(103.33, 1);
    });

    it('should handle single execution', () => {
      const executions = [createExecution({ entryPrice: '50000', quantity: '0.5' })];
      expect(calculateWeightedAvgPrice(executions)).toBe(50000);
    });

    it('should handle decimal quantities', () => {
      const executions = [
        createExecution({ entryPrice: '40000', quantity: '0.1' }),
        createExecution({ entryPrice: '42000', quantity: '0.2' }),
      ];
      const expected = (40000 * 0.1 + 42000 * 0.2) / (0.1 + 0.2);
      expect(calculateWeightedAvgPrice(executions)).toBeCloseTo(expected, 2);
    });
  });

  describe('calculateTotalExposure', () => {
    it('should return 0 for empty array', () => {
      expect(calculateTotalExposure([])).toBe(0);
    });

    it('should calculate total exposure correctly', () => {
      const executions = [
        createExecution({ entryPrice: '100', quantity: '2' }),
        createExecution({ entryPrice: '110', quantity: '1' }),
      ];
      expect(calculateTotalExposure(executions)).toBe(310);
    });

    it('should handle multiple positions', () => {
      const executions = [
        createExecution({ entryPrice: '50000', quantity: '0.1' }),
        createExecution({ entryPrice: '51000', quantity: '0.05' }),
        createExecution({ entryPrice: '52000', quantity: '0.15' }),
      ];
      const expected = 50000 * 0.1 + 51000 * 0.05 + 52000 * 0.15;
      expect(calculateTotalExposure(executions)).toBeCloseTo(expected, 2);
    });
  });

  describe('calculateBaseSize', () => {
    it('should return 0 for empty array', () => {
      expect(calculateBaseSize([])).toBe(0);
    });

    it('should return quantity of first entry by time', () => {
      const executions = [
        createExecution({ quantity: '2', openedAt: new Date('2024-01-02') }),
        createExecution({ quantity: '1', openedAt: new Date('2024-01-01') }),
        createExecution({ quantity: '0.5', openedAt: new Date('2024-01-03') }),
      ];
      expect(calculateBaseSize(executions)).toBe(1);
    });

    it('should handle single execution', () => {
      const executions = [createExecution({ quantity: '0.25' })];
      expect(calculateBaseSize(executions)).toBe(0.25);
    });
  });

  describe('roundQuantity', () => {
    it('should round small quantities to 5 decimal places', () => {
      expect(roundQuantity(0.123456789)).toBe(0.12345);
      expect(roundQuantity(0.999999)).toBe(0.99999);
    });

    it('should round medium quantities to 3 decimal places', () => {
      expect(roundQuantity(1.23456)).toBe(1.234);
      expect(roundQuantity(9.9999)).toBe(9.999);
    });

    it('should round large quantities to 2 decimal places', () => {
      expect(roundQuantity(10.12345)).toBe(10.12);
      expect(roundQuantity(100.999)).toBe(100.99);
    });

    it('should floor, not round', () => {
      expect(roundQuantity(0.999999999)).toBe(0.99999);
      expect(roundQuantity(5.9999)).toBe(5.999);
      expect(roundQuantity(99.999)).toBe(99.99);
    });
  });

  describe('calculatePyramidProfitPercent', () => {
    it('should calculate positive profit for LONG when price increases', () => {
      expect(calculatePyramidProfitPercent(100, 110, 'LONG')).toBe(0.1);
    });

    it('should calculate negative profit for LONG when price decreases', () => {
      expect(calculatePyramidProfitPercent(100, 90, 'LONG')).toBe(-0.1);
    });

    it('should calculate positive profit for SHORT when price decreases', () => {
      expect(calculatePyramidProfitPercent(100, 90, 'SHORT')).toBe(0.1);
    });

    it('should calculate negative profit for SHORT when price increases', () => {
      expect(calculatePyramidProfitPercent(100, 110, 'SHORT')).toBe(-0.1);
    });

    it('should return 0 when price equals entry', () => {
      expect(calculatePyramidProfitPercent(100, 100, 'LONG')).toBe(0);
      expect(calculatePyramidProfitPercent(100, 100, 'SHORT')).toBe(0);
    });
  });

  describe('calculatePyramidSize', () => {
    it('should apply scale factor correctly', () => {
      expect(calculatePyramidSize(1, 0, 0.8)).toBe(1);
      expect(calculatePyramidSize(1, 1, 0.8)).toBe(0.8);
      expect(calculatePyramidSize(1, 2, 0.8)).toBeCloseTo(0.64, 4);
    });

    it('should apply ML confidence boost when confidence > 0.7', () => {
      const withoutBoost = calculatePyramidSize(1, 1, 0.8);
      const withBoost = calculatePyramidSize(1, 1, 0.8, 0.8);
      expect(withBoost).toBe(withoutBoost * 1.2);
    });

    it('should not apply ML confidence boost when confidence <= 0.7', () => {
      const withoutBoost = calculatePyramidSize(1, 1, 0.8);
      const withLowConfidence = calculatePyramidSize(1, 1, 0.8, 0.7);
      expect(withLowConfidence).toBe(withoutBoost);
    });

    it('should apply custom ML confidence boost', () => {
      const result = calculatePyramidSize(1, 1, 0.8, 0.9, 1.5);
      expect(result).toBe(0.8 * 1.5);
    });
  });

  describe('DEFAULT_PYRAMIDING_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_PYRAMIDING_CONFIG.profitThreshold).toBe(0.01);
      expect(DEFAULT_PYRAMIDING_CONFIG.minDistance).toBe(0.005);
      expect(DEFAULT_PYRAMIDING_CONFIG.maxEntries).toBe(5);
      expect(DEFAULT_PYRAMIDING_CONFIG.scaleFactor).toBe(0.8);
      expect(DEFAULT_PYRAMIDING_CONFIG.mlConfidenceBoost).toBe(1.2);
    });
  });
});
