import { describe, it, expect } from 'vitest';
import {
  calculateATRPercent,
  getVolatilityProfile,
  getVolatilityAdjustedMultiplier,
  isHighVolatility,
  isExtremeVolatility,
  getVolatilityReductionFactor,
} from '../volatility';

describe('calculateATRPercent', () => {
  it('should calculate ATR percentage correctly', () => {
    expect(calculateATRPercent(100, 10000)).toBe(1);
    expect(calculateATRPercent(200, 10000)).toBe(2);
    expect(calculateATRPercent(50, 10000)).toBe(0.5);
  });

  it('should return 0 for zero price', () => {
    expect(calculateATRPercent(100, 0)).toBe(0);
  });

  it('should return 0 for negative price', () => {
    expect(calculateATRPercent(100, -100)).toBe(0);
  });
});

describe('getVolatilityProfile', () => {
  it('should return LOW profile for ATR < 1%', () => {
    const profile = getVolatilityProfile(0.5);
    expect(profile.level).toBe('LOW');
    expect(profile.atrMultiplier).toBe(2.0);
  });

  it('should return MEDIUM profile for ATR 1-2%', () => {
    const profile = getVolatilityProfile(1.5);
    expect(profile.level).toBe('MEDIUM');
    expect(profile.atrMultiplier).toBe(2.5);
  });

  it('should return HIGH profile for ATR 2-3%', () => {
    const profile = getVolatilityProfile(2.5);
    expect(profile.level).toBe('HIGH');
    expect(profile.atrMultiplier).toBe(3.0);
  });

  it('should return VERY_HIGH profile for ATR 3-4%', () => {
    const profile = getVolatilityProfile(3.5);
    expect(profile.level).toBe('VERY_HIGH');
    expect(profile.atrMultiplier).toBe(3.5);
  });

  it('should return EXTREME profile for ATR >= 4%', () => {
    const profile = getVolatilityProfile(5.0);
    expect(profile.level).toBe('EXTREME');
  });

  it('should include atrPercent in profile', () => {
    const profile = getVolatilityProfile(2.5);
    expect(profile.atrPercent).toBe(2.5);
  });

  it('should accept SPOT market option', () => {
    const profile = getVolatilityProfile(1.5, { marketType: 'SPOT' });
    expect(profile.level).toBe('MEDIUM');
  });

  it('should accept FUTURES market option', () => {
    const profile = getVolatilityProfile(1.5, { marketType: 'FUTURES' });
    expect(profile.level).toBe('MEDIUM');
  });
});

describe('getVolatilityAdjustedMultiplier', () => {
  it('should adjust multiplier based on volatility', () => {
    const baseMultiplier = 2.0;
    const adjusted = getVolatilityAdjustedMultiplier(baseMultiplier, 1.5);
    expect(adjusted).toBeGreaterThan(0);
  });

  it('should return higher multiplier for higher volatility', () => {
    const baseMultiplier = 2.0;
    const lowVol = getVolatilityAdjustedMultiplier(baseMultiplier, 0.5);
    const highVol = getVolatilityAdjustedMultiplier(baseMultiplier, 3.5);
    expect(highVol).toBeGreaterThan(lowVol);
  });
});

describe('isHighVolatility', () => {
  it('should return true for ATR >= 3%', () => {
    expect(isHighVolatility(3.0)).toBe(true);
    expect(isHighVolatility(4.0)).toBe(true);
  });

  it('should return false for ATR < 3%', () => {
    expect(isHighVolatility(2.9)).toBe(false);
    expect(isHighVolatility(1.0)).toBe(false);
  });
});

describe('isExtremeVolatility', () => {
  it('should return true for ATR >= 4%', () => {
    expect(isExtremeVolatility(4.0)).toBe(true);
    expect(isExtremeVolatility(5.0)).toBe(true);
  });

  it('should return false for ATR < 4%', () => {
    expect(isExtremeVolatility(3.9)).toBe(false);
    expect(isExtremeVolatility(2.0)).toBe(false);
  });
});

describe('getVolatilityReductionFactor', () => {
  it('should return 1.0 for normal volatility', () => {
    expect(getVolatilityReductionFactor(2.0)).toBe(1.0);
    expect(getVolatilityReductionFactor(1.0)).toBe(1.0);
  });

  it('should return 0.7 for high volatility', () => {
    expect(getVolatilityReductionFactor(3.0)).toBe(0.7);
    expect(getVolatilityReductionFactor(3.5)).toBe(0.7);
  });

  it('should return 0.5 for extreme volatility', () => {
    expect(getVolatilityReductionFactor(4.0)).toBe(0.5);
    expect(getVolatilityReductionFactor(5.0)).toBe(0.5);
  });
});
