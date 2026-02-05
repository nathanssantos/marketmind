import { describe, it, expect } from 'vitest';
import {
  calculateTieredCommission,
  calculateRoundTripCommission,
  estimateCommissionRate,
} from '../../exchange/interactive-brokers/fee-calculator';
import { IB_COMMISSION_RATES } from '../../exchange/interactive-brokers/constants';

describe('IB Fee Calculator', () => {
  describe('calculateTieredCommission', () => {
    it('should calculate TIER_1 commission for small order', () => {
      const result = calculateTieredCommission(100, 150);

      expect(result.tier).toBe('TIER_1');
      expect(result.perShareRate).toBe(IB_COMMISSION_RATES.TIERED.TIER_1.rate);
      expect(result.commission).toBe(100 * 0.0035);
      expect(result.shares).toBe(100);
      expect(result.tradeValue).toBe(15000);
    });

    it('should apply minimum commission for very small orders', () => {
      const result = calculateTieredCommission(10, 5);

      expect(result.commission).toBe(0.35);
      expect(result.tier).toBe('TIER_1');
    });

    it('should cap commission at 1% of trade value', () => {
      const result = calculateTieredCommission(1000, 0.10);

      const rawCommission = 1000 * 0.0035;
      const maxCommission = 1000 * 0.10 * 0.01;
      expect(result.commission).toBe(Math.max(0.35, Math.min(rawCommission, maxCommission)));
    });

    it('should use TIER_2 rate for high monthly volume', () => {
      const result = calculateTieredCommission(100, 150, 300_000);

      expect(result.tier).toBe('TIER_2');
      expect(result.perShareRate).toBe(IB_COMMISSION_RATES.TIERED.TIER_2.rate);
      expect(result.commission).toBe(Math.max(0.35, 100 * 0.002));
    });

    it('should use TIER_3 rate for very high monthly volume', () => {
      const result = calculateTieredCommission(100, 150, 3_000_000);

      expect(result.tier).toBe('TIER_3');
      expect(result.perShareRate).toBe(IB_COMMISSION_RATES.TIERED.TIER_3.rate);
    });

    it('should use TIER_4 rate for extremely high monthly volume', () => {
      const result = calculateTieredCommission(100, 150, 20_000_000);

      expect(result.tier).toBe('TIER_4');
      expect(result.perShareRate).toBe(IB_COMMISSION_RATES.TIERED.TIER_4.rate);
    });

    it('should return zero commission for LITE accounts', () => {
      const result = calculateTieredCommission(100, 150, 0, 'LITE');

      expect(result.commission).toBe(0);
      expect(result.tier).toBe('LITE');
      expect(result.effectiveRate).toBe(0);
    });

    it('should calculate effective rate correctly', () => {
      const result = calculateTieredCommission(100, 150);

      const expectedRate = result.commission / result.tradeValue;
      expect(result.effectiveRate).toBeCloseTo(expectedRate, 10);
    });

    it('should handle zero price gracefully', () => {
      const result = calculateTieredCommission(100, 0);

      expect(result.tradeValue).toBe(0);
      expect(result.effectiveRate).toBe(0);
      expect(result.commission).toBe(0.35);
    });
  });

  describe('calculateRoundTripCommission', () => {
    it('should calculate entry and exit commissions', () => {
      const result = calculateRoundTripCommission(100, 150, 155);

      expect(result.entry.commission).toBeGreaterThan(0);
      expect(result.exit.commission).toBeGreaterThan(0);
      expect(result.total).toBe(result.entry.commission + result.exit.commission);
    });

    it('should account for volume increase on exit', () => {
      const result = calculateRoundTripCommission(100, 150, 155, 299_900);

      expect(result.entry.tier).toBe('TIER_1');
      expect(result.exit.tier).toBe('TIER_2');
    });

    it('should return zero total for LITE accounts', () => {
      const result = calculateRoundTripCommission(100, 150, 155, 0, 'LITE');

      expect(result.total).toBe(0);
      expect(result.entry.commission).toBe(0);
      expect(result.exit.commission).toBe(0);
    });
  });

  describe('estimateCommissionRate', () => {
    it('should return TIER_1 rate for zero volume', () => {
      const rate = estimateCommissionRate(0);

      expect(rate).toBe(IB_COMMISSION_RATES.TIERED.TIER_1.rate);
    });

    it('should return TIER_2 rate for high volume', () => {
      const rate = estimateCommissionRate(500_000);

      expect(rate).toBe(IB_COMMISSION_RATES.TIERED.TIER_2.rate);
    });

    it('should return zero for LITE accounts', () => {
      const rate = estimateCommissionRate(0, 'LITE');

      expect(rate).toBe(0);
    });
  });

  describe('Commission rate tiers', () => {
    it('should have decreasing rates per tier', () => {
      const tier1 = IB_COMMISSION_RATES.TIERED.TIER_1.rate;
      const tier2 = IB_COMMISSION_RATES.TIERED.TIER_2.rate;
      const tier3 = IB_COMMISSION_RATES.TIERED.TIER_3.rate;
      const tier4 = IB_COMMISSION_RATES.TIERED.TIER_4.rate;

      expect(tier1).toBeGreaterThan(tier2);
      expect(tier2).toBeGreaterThan(tier3);
      expect(tier3).toBeGreaterThan(tier4);
    });

    it('should have increasing volume thresholds per tier', () => {
      const tier1Max = IB_COMMISSION_RATES.TIERED.TIER_1.maxShares;
      const tier2Max = IB_COMMISSION_RATES.TIERED.TIER_2.maxShares;
      const tier3Max = IB_COMMISSION_RATES.TIERED.TIER_3.maxShares;

      expect(tier1Max).toBeLessThan(tier2Max);
      expect(tier2Max).toBeLessThan(tier3Max);
    });
  });
});
