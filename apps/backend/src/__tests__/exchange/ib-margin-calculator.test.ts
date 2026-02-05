import { describe, it, expect } from 'vitest';
import type {
  IBAccountSummary,
  MarginSafetyConfig,
  MarginValidationResult,
} from '../../exchange/interactive-brokers/types';

const DEFAULT_MARGIN_SAFETY_CONFIG: MarginSafetyConfig = {
  minCushion: 0.15,
  maxLeverage: 1.8,
  warnDayTradesRemaining: 2,
  blockWhenMarginCall: true,
};

const validateMarginSafety = (
  account: IBAccountSummary,
  config: MarginSafetyConfig = DEFAULT_MARGIN_SAFETY_CONFIG
): MarginValidationResult => {
  const issues: string[] = [];

  if (account.cushion < config.minCushion) {
    issues.push(
      `Cushion ${(account.cushion * 100).toFixed(1)}% below minimum ${config.minCushion * 100}%`
    );
  }

  if (account.leverage > config.maxLeverage) {
    issues.push(
      `Leverage ${account.leverage.toFixed(2)}x exceeds maximum ${config.maxLeverage}x`
    );
  }

  if (account.dayTradesRemaining <= config.warnDayTradesRemaining) {
    issues.push(`Only ${account.dayTradesRemaining} day trades remaining (PDT rule)`);
  }

  if (config.blockWhenMarginCall && account.excessLiquidity <= 0) {
    issues.push('Account is in margin call - trading blocked');
  }

  const canTrade = account.cushion > 0 && account.availableFunds > 0;

  return {
    safe: issues.length === 0,
    issues,
    canTrade: canTrade && (!config.blockWhenMarginCall || account.excessLiquidity > 0),
  };
};

const getEffectiveLeverage = (account: IBAccountSummary): number => {
  if (account.netLiquidation === 0) return 0;
  return account.grossPositionValue / account.netLiquidation;
};

const getMarginUtilization = (account: IBAccountSummary): number => {
  if (account.equityWithLoanValue === 0) return 0;
  return account.initMarginReq / account.equityWithLoanValue;
};

const createMockAccountSummary = (overrides: Partial<IBAccountSummary> = {}): IBAccountSummary => ({
  netLiquidation: 100000,
  buyingPower: 200000,
  availableFunds: 50000,
  excessLiquidity: 30000,
  initMarginReq: 40000,
  maintMarginReq: 25000,
  equityWithLoanValue: 95000,
  grossPositionValue: 150000,
  sma: 60000,
  leverage: 1.5,
  cushion: 0.25,
  dayTradesRemaining: 3,
  fullInitMarginReq: 45000,
  fullMaintMarginReq: 28000,
  fullAvailableFunds: 45000,
  fullExcessLiquidity: 27000,
  ...overrides,
});

describe('MarginCalculator', () => {
  describe('validateMarginSafety', () => {
    it('should return safe=true for healthy account', () => {
      const account = createMockAccountSummary();
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.canTrade).toBe(true);
    });

    it('should warn when cushion is below minimum', () => {
      const account = createMockAccountSummary({ cushion: 0.10 });
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Cushion 10.0% below minimum 15%');
    });

    it('should warn when leverage exceeds maximum', () => {
      const account = createMockAccountSummary({ leverage: 2.5 });
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Leverage 2.50x exceeds maximum 1.8x');
    });

    it('should warn when day trades remaining is low', () => {
      const account = createMockAccountSummary({ dayTradesRemaining: 1 });
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Only 1 day trades remaining (PDT rule)');
    });

    it('should block trading when in margin call', () => {
      const account = createMockAccountSummary({ excessLiquidity: -1000 });
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Account is in margin call - trading blocked');
      expect(result.canTrade).toBe(false);
    });

    it('should accumulate multiple issues', () => {
      const account = createMockAccountSummary({
        cushion: 0.05,
        leverage: 3.0,
        dayTradesRemaining: 0,
      });
      const result = validateMarginSafety(account);

      expect(result.safe).toBe(false);
      expect(result.issues).toHaveLength(3);
    });

    it('should allow trading when not in margin call', () => {
      const account = createMockAccountSummary({ leverage: 2.0 });
      const result = validateMarginSafety(account);

      expect(result.canTrade).toBe(true);
    });

    it('should block trading when cushion is zero or negative', () => {
      const account = createMockAccountSummary({ cushion: 0, availableFunds: 0 });
      const result = validateMarginSafety(account);

      expect(result.canTrade).toBe(false);
    });
  });

  describe('validateMarginSafety with custom config', () => {
    it('should use custom minCushion', () => {
      const account = createMockAccountSummary({ cushion: 0.18 });
      const config: MarginSafetyConfig = {
        ...DEFAULT_MARGIN_SAFETY_CONFIG,
        minCushion: 0.20,
      };
      const result = validateMarginSafety(account, config);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Cushion 18.0% below minimum 20%');
    });

    it('should use custom maxLeverage', () => {
      const account = createMockAccountSummary({ leverage: 1.6 });
      const config: MarginSafetyConfig = {
        ...DEFAULT_MARGIN_SAFETY_CONFIG,
        maxLeverage: 1.5,
      };
      const result = validateMarginSafety(account, config);

      expect(result.safe).toBe(false);
      expect(result.issues).toContain('Leverage 1.60x exceeds maximum 1.5x');
    });

    it('should allow trading during margin call when blockWhenMarginCall is false', () => {
      const account = createMockAccountSummary({
        excessLiquidity: -1000,
        cushion: 0.05,
      });
      const config: MarginSafetyConfig = {
        ...DEFAULT_MARGIN_SAFETY_CONFIG,
        blockWhenMarginCall: false,
      };
      const result = validateMarginSafety(account, config);

      expect(result.issues).not.toContain('Account is in margin call - trading blocked');
      expect(result.canTrade).toBe(true);
    });
  });

  describe('getEffectiveLeverage', () => {
    it('should calculate effective leverage correctly', () => {
      const account = createMockAccountSummary({
        grossPositionValue: 150000,
        netLiquidation: 100000,
      });

      expect(getEffectiveLeverage(account)).toBe(1.5);
    });

    it('should return 0 when net liquidation is 0', () => {
      const account = createMockAccountSummary({ netLiquidation: 0 });

      expect(getEffectiveLeverage(account)).toBe(0);
    });

    it('should handle high leverage accounts', () => {
      const account = createMockAccountSummary({
        grossPositionValue: 400000,
        netLiquidation: 100000,
      });

      expect(getEffectiveLeverage(account)).toBe(4.0);
    });
  });

  describe('getMarginUtilization', () => {
    it('should calculate margin utilization correctly', () => {
      const account = createMockAccountSummary({
        initMarginReq: 40000,
        equityWithLoanValue: 100000,
      });

      expect(getMarginUtilization(account)).toBeCloseTo(0.4, 5);
    });

    it('should return 0 when equity is 0', () => {
      const account = createMockAccountSummary({ equityWithLoanValue: 0 });

      expect(getMarginUtilization(account)).toBe(0);
    });

    it('should handle full margin utilization', () => {
      const account = createMockAccountSummary({
        initMarginReq: 50000,
        equityWithLoanValue: 50000,
      });

      expect(getMarginUtilization(account)).toBe(1.0);
    });
  });

  describe('IBAccountSummary structure', () => {
    it('should have all required fields', () => {
      const account = createMockAccountSummary();

      expect(account).toHaveProperty('netLiquidation');
      expect(account).toHaveProperty('buyingPower');
      expect(account).toHaveProperty('availableFunds');
      expect(account).toHaveProperty('excessLiquidity');
      expect(account).toHaveProperty('initMarginReq');
      expect(account).toHaveProperty('maintMarginReq');
      expect(account).toHaveProperty('equityWithLoanValue');
      expect(account).toHaveProperty('grossPositionValue');
      expect(account).toHaveProperty('sma');
      expect(account).toHaveProperty('leverage');
      expect(account).toHaveProperty('cushion');
      expect(account).toHaveProperty('dayTradesRemaining');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero values', () => {
      const account = createMockAccountSummary({
        netLiquidation: 0,
        buyingPower: 0,
        availableFunds: 0,
        cushion: 0,
      });

      const result = validateMarginSafety(account);
      expect(result.canTrade).toBe(false);
    });

    it('should handle negative values', () => {
      const account = createMockAccountSummary({
        excessLiquidity: -5000,
        cushion: -0.05,
      });

      const result = validateMarginSafety(account);
      expect(result.safe).toBe(false);
      expect(result.canTrade).toBe(false);
    });

    it('should handle boundary conditions for day trades', () => {
      const accountAt2 = createMockAccountSummary({ dayTradesRemaining: 2 });
      const resultAt2 = validateMarginSafety(accountAt2);
      expect(resultAt2.issues.some(i => i.includes('day trades'))).toBe(true);

      const accountAt3 = createMockAccountSummary({ dayTradesRemaining: 3 });
      const resultAt3 = validateMarginSafety(accountAt3);
      expect(resultAt3.issues.some(i => i.includes('day trades'))).toBe(false);
    });
  });
});
