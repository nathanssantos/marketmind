import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  ML_THRESHOLDS_BY_TIMEFRAME,
  getThresholdForTimeframe,
  updateThresholdForTimeframe,
  setThresholdsFromOptimization,
  getAllThresholds,
} from '../constants/optimizedThresholds';

describe('Optimized Thresholds', () => {
  describe('ML_THRESHOLDS_BY_TIMEFRAME', () => {
    it('should have thresholds for all standard timeframes', () => {
      const expectedTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      for (const tf of expectedTimeframes) {
        expect(ML_THRESHOLDS_BY_TIMEFRAME[tf]).toBeDefined();
        expect(ML_THRESHOLDS_BY_TIMEFRAME[tf]).toHaveProperty('minProbability');
        expect(ML_THRESHOLDS_BY_TIMEFRAME[tf]).toHaveProperty('minConfidence');
      }
    });

    it('should have decreasing probability thresholds for longer timeframes', () => {
      const prob1m = ML_THRESHOLDS_BY_TIMEFRAME['1m']!.minProbability;
      const prob1h = ML_THRESHOLDS_BY_TIMEFRAME['1h']!.minProbability;
      const prob1d = ML_THRESHOLDS_BY_TIMEFRAME['1d']!.minProbability;
      expect(prob1m).toBeGreaterThan(prob1h);
      expect(prob1h).toBeGreaterThan(prob1d);
    });

    it('should have decreasing confidence thresholds for longer timeframes', () => {
      const conf1m = ML_THRESHOLDS_BY_TIMEFRAME['1m']!.minConfidence;
      const conf1h = ML_THRESHOLDS_BY_TIMEFRAME['1h']!.minConfidence;
      const conf1d = ML_THRESHOLDS_BY_TIMEFRAME['1d']!.minConfidence;
      expect(conf1m).toBeGreaterThan(conf1h);
      expect(conf1h).toBeGreaterThan(conf1d);
    });

    it('should have valid probability values between 0 and 1', () => {
      for (const threshold of Object.values(ML_THRESHOLDS_BY_TIMEFRAME)) {
        expect(threshold.minProbability).toBeGreaterThanOrEqual(0);
        expect(threshold.minProbability).toBeLessThanOrEqual(1);
      }
    });

    it('should have valid confidence values between 0 and 100', () => {
      for (const threshold of Object.values(ML_THRESHOLDS_BY_TIMEFRAME)) {
        expect(threshold.minConfidence).toBeGreaterThanOrEqual(0);
        expect(threshold.minConfidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getThresholdForTimeframe', () => {
    it('should return threshold for known timeframe', () => {
      const threshold = getThresholdForTimeframe('1h');
      expect(threshold).toEqual({
        minProbability: 0.05,
        minConfidence: 50,
      });
    });

    it('should return default threshold for unknown timeframe', () => {
      const threshold = getThresholdForTimeframe('unknown');
      expect(threshold).toBeDefined();
      expect(threshold.minProbability).toBe(0.05);
      expect(threshold.minConfidence).toBe(50);
    });

    it('should return correct thresholds for all standard timeframes', () => {
      expect(getThresholdForTimeframe('1m')).toEqual({ minProbability: 0.10, minConfidence: 70 });
      expect(getThresholdForTimeframe('5m')).toEqual({ minProbability: 0.08, minConfidence: 65 });
      expect(getThresholdForTimeframe('15m')).toEqual({ minProbability: 0.07, minConfidence: 60 });
      expect(getThresholdForTimeframe('30m')).toEqual({ minProbability: 0.06, minConfidence: 55 });
      expect(getThresholdForTimeframe('1h')).toEqual({ minProbability: 0.05, minConfidence: 50 });
      expect(getThresholdForTimeframe('4h')).toEqual({ minProbability: 0.05, minConfidence: 50 });
      expect(getThresholdForTimeframe('1d')).toEqual({ minProbability: 0.04, minConfidence: 45 });
      expect(getThresholdForTimeframe('1w')).toEqual({ minProbability: 0.03, minConfidence: 40 });
    });
  });

  describe('updateThresholdForTimeframe', () => {
    beforeEach(() => {
      ML_THRESHOLDS_BY_TIMEFRAME['1h'] = { minProbability: 0.05, minConfidence: 50 };
    });

    it('should update threshold for existing timeframe', () => {
      const newThreshold = { minProbability: 0.08, minConfidence: 60 };
      updateThresholdForTimeframe('1h', newThreshold);
      expect(getThresholdForTimeframe('1h')).toEqual(newThreshold);
      ML_THRESHOLDS_BY_TIMEFRAME['1h'] = { minProbability: 0.05, minConfidence: 50 };
    });

    it('should add threshold for new timeframe', () => {
      const newThreshold = { minProbability: 0.02, minConfidence: 35 };
      updateThresholdForTimeframe('1M', newThreshold);
      expect(getThresholdForTimeframe('1M')).toEqual(newThreshold);
      delete ML_THRESHOLDS_BY_TIMEFRAME['1M'];
    });
  });

  describe('setThresholdsFromOptimization', () => {
    const originalThresholds: Record<string, { minProbability: number; minConfidence: number }> = {};

    beforeEach(() => {
      for (const [key, value] of Object.entries(ML_THRESHOLDS_BY_TIMEFRAME)) {
        originalThresholds[key] = { ...value };
      }
    });

    afterEach(() => {
      for (const [key, value] of Object.entries(originalThresholds)) {
        ML_THRESHOLDS_BY_TIMEFRAME[key] = value;
      }
    });

    it('should update multiple thresholds at once', () => {
      const newThresholds = {
        '1h': { minProbability: 0.06, minConfidence: 55 },
        '4h': { minProbability: 0.04, minConfidence: 45 },
      };
      setThresholdsFromOptimization(newThresholds);
      expect(getThresholdForTimeframe('1h')).toEqual(newThresholds['1h']);
      expect(getThresholdForTimeframe('4h')).toEqual(newThresholds['4h']);
    });

    it('should not affect unspecified timeframes', () => {
      const original1m = { ...ML_THRESHOLDS_BY_TIMEFRAME['1m'] };
      setThresholdsFromOptimization({
        '1h': { minProbability: 0.06, minConfidence: 55 },
      });
      expect(ML_THRESHOLDS_BY_TIMEFRAME['1m']).toEqual(original1m);
    });
  });

  describe('getAllThresholds', () => {
    it('should return a copy of all thresholds', () => {
      const thresholds = getAllThresholds();
      expect(thresholds).toHaveProperty('1m');
      expect(thresholds).toHaveProperty('1h');
      expect(thresholds).toHaveProperty('1d');
    });

    it('should return a new object (not a reference)', () => {
      const thresholds1 = getAllThresholds();
      const thresholds2 = getAllThresholds();
      expect(thresholds1).not.toBe(thresholds2);
      expect(thresholds1).toEqual(thresholds2);
    });

    it('should not allow modification of original thresholds through returned object', () => {
      const thresholds = getAllThresholds();
      const original1h = { ...ML_THRESHOLDS_BY_TIMEFRAME['1h'] };
      thresholds['1h'] = { minProbability: 0.99, minConfidence: 99 };
      expect(ML_THRESHOLDS_BY_TIMEFRAME['1h']).toEqual(original1h);
    });
  });
});
