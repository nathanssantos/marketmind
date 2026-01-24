import { describe, expect, it } from 'vitest';
import { validateMinProfit } from '../min-profit';

describe('validateMinProfit', () => {
  describe('LONG positions', () => {
    it('should pass when profit after fees meets minimum', () => {
      const result = validateMinProfit({
        entryPrice: 100,
        takeProfit: 110,
        direction: 'LONG',
        minProfitPercent: 5,
        commissionRate: 0.001,
      });

      expect(result.isValid).toBe(true);
    });

    it('should fail when profit after fees is below minimum', () => {
      const result = validateMinProfit({
        entryPrice: 100,
        takeProfit: 101,
        direction: 'LONG',
        minProfitPercent: 2,
        commissionRate: 0.001,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('below minimum');
    });
  });

  describe('SHORT positions', () => {
    it('should pass when profit after fees meets minimum', () => {
      const result = validateMinProfit({
        entryPrice: 100,
        takeProfit: 90,
        direction: 'SHORT',
        minProfitPercent: 5,
        commissionRate: 0.001,
      });

      expect(result.isValid).toBe(true);
    });

    it('should fail when profit after fees is below minimum', () => {
      const result = validateMinProfit({
        entryPrice: 100,
        takeProfit: 99,
        direction: 'SHORT',
        minProfitPercent: 2,
        commissionRate: 0.001,
      });

      expect(result.isValid).toBe(false);
    });
  });

  it('should pass when minProfitPercent is undefined', () => {
    const result = validateMinProfit({
      entryPrice: 100,
      takeProfit: 101,
      direction: 'LONG',
      minProfitPercent: undefined,
      commissionRate: 0.001,
    });

    expect(result.isValid).toBe(true);
  });

  it('should pass when takeProfit is undefined', () => {
    const result = validateMinProfit({
      entryPrice: 100,
      takeProfit: undefined,
      direction: 'LONG',
      minProfitPercent: 5,
      commissionRate: 0.001,
    });

    expect(result.isValid).toBe(true);
  });

  it('should account for round-trip commission', () => {
    const result = validateMinProfit({
      entryPrice: 100,
      takeProfit: 103,
      direction: 'LONG',
      minProfitPercent: 2.5,
      commissionRate: 0.001,
    });

    expect(result.isValid).toBe(true);
  });
});
