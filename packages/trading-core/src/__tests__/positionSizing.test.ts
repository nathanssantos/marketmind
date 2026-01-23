import { describe, it, expect } from 'vitest';
import {
  calculateKellyPercentage,
  calculateKellyCriterion,
  calculateOptimalKellyFraction,
  roundQuantity,
  calculateFixedPositionSize,
  calculateRiskBasedPositionSize,
  calculateMaxPositionValue,
  calculateVolatilityAdjustment,
  applyVolatilityAdjustment,
  calculateAdaptiveSize,
  calculatePositionSize,
  recommendPositionSizingMethod,
} from '../positionSizing';

describe('Kelly Criterion', () => {
  describe('calculateKellyPercentage', () => {
    it('should calculate Kelly percentage correctly', () => {
      const result = calculateKellyPercentage(0.6, 2.0);
      expect(result).toBeCloseTo(40, 0);
    });

    it('should return negative for losing strategy', () => {
      const result = calculateKellyPercentage(0.3, 1.0);
      expect(result).toBeLessThan(0);
    });
  });

  describe('calculateKellyCriterion', () => {
    it('should use default values when no stats provided', () => {
      const result = calculateKellyCriterion();
      expect(result.kellyPercent).toBeGreaterThan(0);
      expect(result.rationale).toContain('default');
    });

    it('should use provided stats when trade count is sufficient', () => {
      const result = calculateKellyCriterion({
        winRate: 0.6,
        avgRiskReward: 2.0,
        tradeCount: 30,
      });
      expect(result.kellyPercent).toBeGreaterThan(0);
      expect(result.isValid).toBe(true);
    });

    it('should apply fractional Kelly', () => {
      const full = calculateKellyCriterion(undefined, 1.0);
      const quarter = calculateKellyCriterion(undefined, 0.25);
      expect(quarter.kellyPercent).toBeLessThan(full.kellyPercent);
    });
  });

  describe('calculateOptimalKellyFraction', () => {
    it('should increase fraction for good win rate', () => {
      const base = calculateOptimalKellyFraction(0.5, 1.5, 10);
      const good = calculateOptimalKellyFraction(0.6, 1.5, 10);
      expect(good).toBeGreaterThanOrEqual(base);
    });

    it('should decrease fraction for high drawdown', () => {
      const low = calculateOptimalKellyFraction(0.5, 1.5, 5);
      const high = calculateOptimalKellyFraction(0.5, 1.5, 25);
      expect(high).toBeLessThan(low);
    });
  });
});

describe('Simple Position Sizing', () => {
  describe('roundQuantity', () => {
    it('should round small quantities to 5 decimals', () => {
      const result = roundQuantity(0.123456789);
      expect(result).toBe(0.12345);
    });

    it('should round medium quantities to 3 decimals', () => {
      const result = roundQuantity(5.123456);
      expect(result).toBe(5.123);
    });

    it('should round large quantities to 2 decimals', () => {
      const result = roundQuantity(100.126);
      expect(result).toBe(100.12);
    });
  });

  describe('calculateFixedPositionSize', () => {
    it('should calculate position based on percentage', () => {
      const result = calculateFixedPositionSize(10000, 100, 10);
      expect(result.positionValue).toBe(1000);
      expect(result.quantity).toBe(10);
    });
  });

  describe('calculateRiskBasedPositionSize', () => {
    it('should calculate position based on risk', () => {
      const result = calculateRiskBasedPositionSize(10000, 100, 95, 2);
      expect(result.quantity).toBeGreaterThan(0);
    });

    it('should return 0 for no stop distance', () => {
      const result = calculateRiskBasedPositionSize(10000, 100, 100, 2);
      expect(result.quantity).toBe(0);
    });
  });

  describe('calculateMaxPositionValue', () => {
    it('should calculate max position value', () => {
      const result = calculateMaxPositionValue(10000, 10);
      expect(result).toBe(1000);
    });
  });
});

describe('Volatility Adjustment', () => {
  describe('calculateVolatilityAdjustment', () => {
    it('should return 1.0 for normal volatility', () => {
      const result = calculateVolatilityAdjustment(2.0);
      expect(result.adjustmentFactor).toBe(1.0);
    });

    it('should reduce position for high volatility', () => {
      const result = calculateVolatilityAdjustment(4.0);
      expect(result.adjustmentFactor).toBeLessThan(1.0);
    });
  });

  describe('applyVolatilityAdjustment', () => {
    it('should reduce quantity for high volatility', () => {
      const base = 100;
      const adjusted = applyVolatilityAdjustment(base, 4.0);
      expect(adjusted).toBeLessThan(base);
    });

    it('should not change quantity for normal volatility', () => {
      const base = 100;
      const adjusted = applyVolatilityAdjustment(base, 2.0);
      expect(adjusted).toBe(base);
    });
  });
});

describe('Adaptive Size', () => {
  describe('calculateAdaptiveSize', () => {
    it('should reduce size during drawdown', () => {
      const result = calculateAdaptiveSize(10, {
        drawdownPercent: 20,
        volatilityLevel: 'normal',
        consecutiveLosses: 0,
        consecutiveWins: 0,
      });
      expect(result.adjustedPercent).toBeLessThan(10);
    });

    it('should reduce size for high volatility', () => {
      const result = calculateAdaptiveSize(10, {
        drawdownPercent: 0,
        volatilityLevel: 'high',
        consecutiveLosses: 0,
        consecutiveWins: 0,
      });
      expect(result.adjustedPercent).toBeLessThan(10);
    });

    it('should reduce size for loss streak', () => {
      const result = calculateAdaptiveSize(10, {
        drawdownPercent: 0,
        volatilityLevel: 'normal',
        consecutiveLosses: 4,
        consecutiveWins: 0,
      });
      expect(result.adjustedPercent).toBeLessThan(10);
    });

    it('should increase size for win streak (with low drawdown)', () => {
      const result = calculateAdaptiveSize(10, {
        drawdownPercent: 2,
        volatilityLevel: 'normal',
        consecutiveLosses: 0,
        consecutiveWins: 5,
      });
      expect(result.adjustedPercent).toBeGreaterThanOrEqual(10);
    });
  });
});

describe('Position Size Calculator', () => {
  describe('calculatePositionSize', () => {
    it('should calculate fixed position size', () => {
      const result = calculatePositionSize({
        method: 'fixed',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
      });
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.method).toBe('fixed');
    });

    it('should calculate kelly position size', () => {
      const result = calculatePositionSize({
        method: 'kelly',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        historicalStats: {
          winRate: 0.6,
          avgRiskReward: 2.0,
          tradeCount: 30,
        },
      });
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.method).toBe('kelly');
    });

    it('should calculate risk-based position size', () => {
      const result = calculatePositionSize({
        method: 'risk-based',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        stopLoss: 95,
        riskPerTrade: 2,
      });
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.method).toBe('risk-based');
    });

    it('should apply volatility adjustment', () => {
      const normal = calculatePositionSize({
        method: 'fixed',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        volatility: { atrPercent: 2.0 },
      });

      const high = calculatePositionSize({
        method: 'fixed',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        volatility: { atrPercent: 4.0 },
      });

      expect(high.quantity).toBeLessThan(normal.quantity);
    });

    it('should apply leverage', () => {
      const noLeverage = calculatePositionSize({
        method: 'fixed',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        leverage: 1,
      });

      const withLeverage = calculatePositionSize({
        method: 'fixed',
        equity: 10000,
        entryPrice: 100,
        maxPositionSizePercent: 10,
        leverage: 2,
      });

      expect(withLeverage.quantity).toBeGreaterThan(noLeverage.quantity);
    });
  });

  describe('recommendPositionSizingMethod', () => {
    it('should recommend kelly for profitable strategy with enough trades', () => {
      const result = recommendPositionSizingMethod(0.55, 2.0, 50, true);
      expect(result).toBe('kelly');
    });

    it('should recommend risk-based for few trades with stop loss', () => {
      const result = recommendPositionSizingMethod(0.5, 1.5, 10, true);
      expect(result).toBe('risk-based');
    });

    it('should recommend fixed for few trades without stop loss', () => {
      const result = recommendPositionSizingMethod(0.5, 1.5, 10, false);
      expect(result).toBe('fixed');
    });
  });
});
