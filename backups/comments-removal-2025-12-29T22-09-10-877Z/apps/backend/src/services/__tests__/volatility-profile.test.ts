import { describe, it, expect } from 'vitest';
import {
  calculateATRPercent,
  getVolatilityProfile,
  getVolatilityAdjustedMultiplier,
} from '../volatility-profile';

describe('volatility-profile', () => {
  describe('calculateATRPercent', () => {
    it('should return 0 for zero price', () => {
      expect(calculateATRPercent(100, 0)).toBe(0);
    });

    it('should return 0 for negative price', () => {
      expect(calculateATRPercent(100, -50)).toBe(0);
    });

    it('should calculate ATR% correctly for BTC-like asset', () => {
      expect(calculateATRPercent(2500, 100000)).toBe(2.5);
    });

    it('should calculate ATR% correctly for ADA-like asset', () => {
      expect(calculateATRPercent(0.05, 0.90)).toBeCloseTo(5.56, 1);
    });

    it('should calculate ATR% correctly for 1% volatility', () => {
      expect(calculateATRPercent(0.01, 1.0)).toBe(1.0);
    });

    it('should calculate ATR% correctly for 4% volatility', () => {
      expect(calculateATRPercent(2000, 50000)).toBe(4.0);
    });
  });

  describe('getVolatilityProfile', () => {
    it('should return LOW for ATR% < 1% with SPOT fees', () => {
      const profile = getVolatilityProfile(0.5);
      expect(profile.level).toBe('LOW');
      expect(profile.atrMultiplier).toBe(2.0);
      expect(profile.breakevenThreshold).toBe(0.01);
      expect(profile.feesThreshold).toBe(0.007);
      expect(profile.minTrailingDistance).toBe(0.003);
    });

    it('should return MEDIUM for ATR% between 1% and 2% with SPOT fees', () => {
      const profile = getVolatilityProfile(1.5);
      expect(profile.level).toBe('MEDIUM');
      expect(profile.atrMultiplier).toBe(2.5);
      expect(profile.breakevenThreshold).toBe(0.015);
      expect(profile.feesThreshold).toBe(0.012);
      expect(profile.minTrailingDistance).toBe(0.004);
    });

    it('should return HIGH for ATR% between 2% and 3% with SPOT fees', () => {
      const profile = getVolatilityProfile(2.5);
      expect(profile.level).toBe('HIGH');
      expect(profile.atrMultiplier).toBe(3.0);
      expect(profile.breakevenThreshold).toBe(0.02);
      expect(profile.feesThreshold).toBe(0.017);
      expect(profile.minTrailingDistance).toBe(0.005);
    });

    it('should return VERY_HIGH for ATR% between 3% and 4% with SPOT fees', () => {
      const profile = getVolatilityProfile(3.5);
      expect(profile.level).toBe('VERY_HIGH');
      expect(profile.atrMultiplier).toBe(3.5);
      expect(profile.breakevenThreshold).toBe(0.025);
      expect(profile.feesThreshold).toBe(0.022);
      expect(profile.minTrailingDistance).toBe(0.006);
    });

    it('should return EXTREME for ATR% > 4% with SPOT fees', () => {
      const profile = getVolatilityProfile(5.0);
      expect(profile.level).toBe('EXTREME');
      expect(profile.breakevenThreshold).toBe(0.03);
      expect(profile.feesThreshold).toBe(0.027);
      expect(profile.minTrailingDistance).toBe(0.007);
    });

    it('should return lower feesThreshold for FUTURES marketType', () => {
      const spotProfile = getVolatilityProfile(0.5);
      const futuresProfile = getVolatilityProfile(0.5, { marketType: 'FUTURES' });
      expect(futuresProfile.feesThreshold).toBeLessThan(spotProfile.feesThreshold);
      expect(futuresProfile.feesThreshold).toBeCloseTo(0.0058, 4);
    });

    it('should apply BNB discount to feesThreshold', () => {
      const spotProfile = getVolatilityProfile(0.5);
      const bnbProfile = getVolatilityProfile(0.5, { useBnbDiscount: true });
      expect(bnbProfile.feesThreshold).toBeLessThan(spotProfile.feesThreshold);
      expect(bnbProfile.feesThreshold).toBeCloseTo(0.0065, 4);
    });

    it('should calculate dynamic multiplier for EXTREME volatility', () => {
      const profile4 = getVolatilityProfile(4.0);
      expect(profile4.atrMultiplier).toBe(4.0);

      const profile5 = getVolatilityProfile(5.0);
      expect(profile5.atrMultiplier).toBe(4.25);

      const profile6 = getVolatilityProfile(6.0);
      expect(profile6.atrMultiplier).toBe(4.5);
    });

    it('should cap EXTREME multiplier at 5.0', () => {
      const profile = getVolatilityProfile(10.0);
      expect(profile.atrMultiplier).toBe(5.0);
    });

    it('should include atrPercent in profile', () => {
      const profile = getVolatilityProfile(2.5);
      expect(profile.atrPercent).toBe(2.5);
    });

    it('should handle boundary values correctly', () => {
      expect(getVolatilityProfile(0.99).level).toBe('LOW');
      expect(getVolatilityProfile(1.0).level).toBe('MEDIUM');
      expect(getVolatilityProfile(1.99).level).toBe('MEDIUM');
      expect(getVolatilityProfile(2.0).level).toBe('HIGH');
      expect(getVolatilityProfile(2.99).level).toBe('HIGH');
      expect(getVolatilityProfile(3.0).level).toBe('VERY_HIGH');
      expect(getVolatilityProfile(3.99).level).toBe('VERY_HIGH');
      expect(getVolatilityProfile(4.0).level).toBe('EXTREME');
    });
  });

  describe('getVolatilityAdjustedMultiplier', () => {
    it('should maintain 1:1 ratio for LOW volatility (baseline)', () => {
      const adjusted = getVolatilityAdjustedMultiplier(2.0, 0.5);
      expect(adjusted).toBe(2.0);
    });

    it('should increase multiplier by 1.25x for MEDIUM volatility', () => {
      const adjusted = getVolatilityAdjustedMultiplier(2.0, 1.5);
      expect(adjusted).toBe(2.5);
    });

    it('should increase multiplier by 1.5x for HIGH volatility', () => {
      const adjusted = getVolatilityAdjustedMultiplier(2.0, 2.5);
      expect(adjusted).toBe(3.0);
    });

    it('should increase multiplier by 1.75x for VERY_HIGH volatility', () => {
      const adjusted = getVolatilityAdjustedMultiplier(2.0, 3.5);
      expect(adjusted).toBe(3.5);
    });

    it('should scale any base multiplier proportionally', () => {
      const adjusted = getVolatilityAdjustedMultiplier(1.5, 2.5);
      expect(adjusted).toBe(2.25);
    });

    it('should handle EXTREME volatility correctly', () => {
      const adjusted = getVolatilityAdjustedMultiplier(2.0, 5.0);
      expect(adjusted).toBeCloseTo(4.25, 2);
    });
  });

  describe('real-world scenarios', () => {
    it('should classify BTC correctly (ATR ~2-3%)', () => {
      const atrPercent = calculateATRPercent(2500, 100000);
      const profile = getVolatilityProfile(atrPercent);
      expect(profile.level).toBe('HIGH');
      expect(profile.atrMultiplier).toBe(3.0);
    });

    it('should classify ADA correctly (ATR ~5-8%)', () => {
      const atrPercent = calculateATRPercent(0.05, 0.90);
      const profile = getVolatilityProfile(atrPercent);
      expect(profile.level).toBe('EXTREME');
      expect(profile.atrMultiplier).toBeGreaterThanOrEqual(4.0);
    });

    it('should classify ETH correctly (ATR ~2.5-3%)', () => {
      const atrPercent = calculateATRPercent(100, 3500);
      const profile = getVolatilityProfile(atrPercent);
      expect(profile.level).toBe('HIGH');
    });

    it('should classify SOL correctly (ATR ~4-5%)', () => {
      const atrPercent = calculateATRPercent(8, 180);
      const profile = getVolatilityProfile(atrPercent);
      expect(profile.level).toBe('EXTREME');
    });

    it('should classify stablecoins correctly (ATR < 0.5%)', () => {
      const atrPercent = calculateATRPercent(0.002, 1.0);
      const profile = getVolatilityProfile(atrPercent);
      expect(profile.level).toBe('LOW');
      expect(profile.atrMultiplier).toBe(2.0);
    });
  });
});
