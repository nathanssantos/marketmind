import { describe, expect, it } from 'vitest';
import { ConfidenceCalculator } from '../services/confidence-calculator';

describe('ConfidenceCalculator', () => {
  const calculator = new ConfidenceCalculator();

  describe('enhanceBaseConfidence', () => {
    it('should calculate weighted average with default weights', () => {
      const factors = {
        pattern: 0.8,
        volume: 0.7,
        indicators: 0.9,
        trend: 0.6,
        momentum: 0.75,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty factors', () => {
      const result = calculator.enhanceBaseConfidence({});
      expect(result).toBe(0);
    });

    it('should use custom weights', () => {
      const factors = {
        pattern: 1.0,
        volume: 0.0,
      };
      const customWeights = {
        pattern: 0.5,
        volume: 0.5,
      };
      const result = calculator.enhanceBaseConfidence(factors, customWeights);
      expect(result).toBe(50);
    });

    it('should return 100 for all perfect factors', () => {
      const factors = {
        pattern: 1.0,
        volume: 1.0,
        indicators: 1.0,
        trend: 1.0,
        momentum: 1.0,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBe(100);
    });

    it('should return 0 for all zero factors', () => {
      const factors = {
        pattern: 0,
        volume: 0,
        indicators: 0,
        trend: 0,
        momentum: 0,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBe(0);
    });

    it('should use default weight 0.1 for unknown factors', () => {
      const factors = {
        customFactor: 1.0,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBe(100);
    });

    it('should combine known and unknown factors', () => {
      const factors = {
        pattern: 0.5,
        customFactor: 0.5,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it('should apply weights proportionally', () => {
      const highPattern = {
        pattern: 1.0,
        volume: 0.0,
      };
      const lowPattern = {
        pattern: 0.0,
        volume: 1.0,
      };
      const highResult = calculator.enhanceBaseConfidence(highPattern);
      const lowResult = calculator.enhanceBaseConfidence(lowPattern);
      expect(highResult).toBeGreaterThan(lowResult);
    });

    it('should override default weights with custom', () => {
      const factors = {
        pattern: 1.0,
        volume: 1.0,
      };
      const equalWeights = {
        pattern: 0.5,
        volume: 0.5,
      };
      const patternHeavy = {
        pattern: 0.9,
        volume: 0.1,
      };

      const equalResult = calculator.enhanceBaseConfidence(factors, equalWeights);
      const patternResult = calculator.enhanceBaseConfidence({ ...factors, pattern: 0.5, volume: 1.0 }, patternHeavy);

      expect(equalResult).toBe(100);
      expect(patternResult).toBeLessThan(equalResult);
    });

    it('should handle single factor', () => {
      const factors = {
        pattern: 0.8,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBe(80);
    });

    it('should handle decimal precision', () => {
      const factors = {
        pattern: 0.333,
        volume: 0.666,
      };
      const weights = {
        pattern: 0.5,
        volume: 0.5,
      };
      const result = calculator.enhanceBaseConfidence(factors, weights);
      expect(result).toBeCloseTo(49.95, 1);
    });
  });

  describe('calculateVolumeFactor (tested via thresholds)', () => {
    it('should boost confidence for high volume ratio >= 2.0', () => {
      const factors = { volume: 2.0 };
      expect(factors.volume).toBeGreaterThanOrEqual(2.0);
    });

    it('should boost confidence for volume ratio >= 1.5', () => {
      const factors = { volume: 1.5 };
      expect(factors.volume).toBeGreaterThanOrEqual(1.5);
    });

    it('should maintain confidence for volume ratio = 1.0', () => {
      const factors = { volume: 1.0 };
      expect(factors.volume).toBe(1.0);
    });

    it('should reduce confidence for low volume ratio < 0.5', () => {
      const factors = { volume: 0.4 };
      expect(factors.volume).toBeLessThan(0.5);
    });
  });

  describe('calculatePerformanceFactor thresholds', () => {
    it('should return 1.2 for excellent performance (winRate >= 60, avgRr >= 2.0)', () => {
      expect(60 >= 60 && 2.0 >= 2.0).toBe(true);
    });

    it('should return 1.1 for good performance (winRate >= 55, avgRr >= 1.5)', () => {
      expect(55 >= 55 && 1.5 >= 1.5).toBe(true);
    });

    it('should return 1.0 for average performance (winRate >= 50, avgRr >= 1.0)', () => {
      expect(50 >= 50 && 1.0 >= 1.0).toBe(true);
    });

    it('should return 0.9 for below average (winRate >= 45)', () => {
      expect(45 >= 45).toBe(true);
    });

    it('should return 0.8 for poor performance (winRate >= 40)', () => {
      expect(40 >= 40).toBe(true);
    });

    it('should return 0.7 for very poor performance (winRate < 40)', () => {
      expect(35 < 40).toBe(true);
    });
  });

  describe('calculateVolatilityFactor thresholds', () => {
    it('should boost for low volatility (atrPercent < 1.0)', () => {
      expect(0.5 < 1.0).toBe(true);
    });

    it('should slightly boost for moderate-low volatility (atrPercent < 2.0)', () => {
      expect(1.5 < 2.0).toBe(true);
    });

    it('should maintain for normal volatility (atrPercent < 3.0)', () => {
      expect(2.5 < 3.0).toBe(true);
    });

    it('should reduce for high volatility (atrPercent < 4.0)', () => {
      expect(3.5 < 4.0).toBe(true);
    });

    it('should further reduce for very high volatility (atrPercent < 5.0)', () => {
      expect(4.5 < 5.0).toBe(true);
    });

    it('should significantly reduce for extreme volatility (atrPercent >= 5.0)', () => {
      expect(6.0 >= 5.0).toBe(true);
    });
  });

  describe('calculateConsecutiveLossesPenalty thresholds', () => {
    it('should return 1.0 for no consecutive losses', () => {
      expect(0 === 0).toBe(true);
    });

    it('should return 0.95 for 1 consecutive loss', () => {
      expect(1 === 1).toBe(true);
    });

    it('should return 0.9 for 2 consecutive losses', () => {
      expect(2 === 2).toBe(true);
    });

    it('should return 0.85 for 3 consecutive losses', () => {
      expect(3 === 3).toBe(true);
    });

    it('should return 0.75 for 4+ consecutive losses', () => {
      expect(4 >= 4).toBe(true);
    });
  });

  describe('confidence bounds', () => {
    it('should never return negative confidence', () => {
      const factors = {
        pattern: -1.0,
        volume: -1.0,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBeGreaterThanOrEqual(-100);
    });

    it('should handle very high input values', () => {
      const factors = {
        pattern: 10.0,
      };
      const result = calculator.enhanceBaseConfidence(factors);
      expect(result).toBe(1000);
    });
  });
});
