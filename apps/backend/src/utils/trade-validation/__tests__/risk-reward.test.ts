import { describe, expect, it } from 'vitest';
import { validateRiskReward } from '../risk-reward';

describe('validateRiskReward', () => {
  describe('LONG positions', () => {
    it('should pass when R:R ratio meets minimum', () => {
      const result = validateRiskReward({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 115,
        direction: 'LONG',
        minRiskRewardRatio: 2.0,
      });

      expect(result.isValid).toBe(true);
      expect(result.riskRewardRatio).toBe(3);
      expect(result.risk).toBe(5);
      expect(result.reward).toBe(15);
    });

    it('should fail when R:R ratio is below minimum', () => {
      const result = validateRiskReward({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 107,
        direction: 'LONG',
        minRiskRewardRatio: 2.0,
      });

      expect(result.isValid).toBe(false);
      expect(result.riskRewardRatio).toBeCloseTo(1.4, 1);
      expect(result.reason).toContain('below minimum');
    });

    it('should pass when no SL/TP defined', () => {
      const result = validateRiskReward({
        entryPrice: 100,
        stopLoss: undefined,
        takeProfit: 110,
        direction: 'LONG',
        minRiskRewardRatio: 2.0,
      });

      expect(result.isValid).toBe(true);
      expect(result.riskRewardRatio).toBeNull();
    });
  });

  describe('SHORT positions', () => {
    it('should pass when R:R ratio meets minimum', () => {
      const result = validateRiskReward({
        entryPrice: 100,
        stopLoss: 105,
        takeProfit: 85,
        direction: 'SHORT',
        minRiskRewardRatio: 2.0,
      });

      expect(result.isValid).toBe(true);
      expect(result.riskRewardRatio).toBe(3);
      expect(result.risk).toBe(5);
      expect(result.reward).toBe(15);
    });

    it('should fail when R:R ratio is below minimum', () => {
      const result = validateRiskReward({
        entryPrice: 100,
        stopLoss: 105,
        takeProfit: 93,
        direction: 'SHORT',
        minRiskRewardRatio: 2.0,
      });

      expect(result.isValid).toBe(false);
      expect(result.riskRewardRatio).toBeCloseTo(1.4, 1);
    });
  });

  it('should use default minRiskRewardRatio of 1.0', () => {
    const result = validateRiskReward({
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 106,
      direction: 'LONG',
    });

    expect(result.isValid).toBe(true);
    expect(result.riskRewardRatio).toBeCloseTo(1.2, 1);
  });

  it('should handle invalid risk (non-positive)', () => {
    const result = validateRiskReward({
      entryPrice: 100,
      stopLoss: 100,
      takeProfit: 110,
      direction: 'LONG',
      minRiskRewardRatio: 1.0,
    });

    expect(result.isValid).toBe(true);
    expect(result.risk).toBe(0);
  });
});
