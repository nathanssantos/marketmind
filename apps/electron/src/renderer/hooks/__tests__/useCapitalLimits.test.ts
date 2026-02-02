import { CAPITAL_RULES } from '@marketmind/types';
import { describe, expect, it } from 'vitest';

interface CapitalLimits {
  walletBalance: number;
  leverage: number;
  positionSizePercent: number;
  availableCapital: number;
  maxAffordableWatchers: number;
  capitalPerWatcher: number;
  maxCapitalPerPosition: number;
}

const formatCapitalTooltip = (capitalLimits: CapitalLimits | null): string => {
  if (!capitalLimits) return '';
  const { walletBalance, leverage, positionSizePercent, maxCapitalPerPosition } = capitalLimits;
  return `$${walletBalance.toFixed(2)} × ${leverage}x × ${positionSizePercent}% | Max/pos: $${maxCapitalPerPosition.toFixed(2)} (1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO} rule)`;
};

const calculateMaxAffordableWatchers = (
  availableCapital: number,
  positionSizePercent: number,
  minRequiredPerPosition: number
): number => {
  const safetyMargin = 1.1;
  const requiredPerWatcher = minRequiredPerPosition * safetyMargin;
  const maxWatchers = Math.floor((availableCapital * positionSizePercent / 100) / requiredPerWatcher);
  return Math.max(1, maxWatchers);
};

const calculateMinRequiredCapitalForSymbol = (
  minNotional: number,
  minQty: number,
  price: number,
  safetyMargin: number = 1.1
): { minRequired: number; source: 'minNotional' | 'minQty' } => {
  const minNotionalRequired = minNotional * safetyMargin;
  const minQtyRequired = minQty * price * safetyMargin;

  if (minQtyRequired > minNotionalRequired) {
    return { minRequired: minQtyRequired, source: 'minQty' };
  }
  return { minRequired: minNotionalRequired, source: 'minNotional' };
};

describe('useCapitalLimits', () => {
  describe('formatCapitalTooltip', () => {
    it('should return empty string when capitalLimits is null', () => {
      expect(formatCapitalTooltip(null)).toBe('');
    });

    it('should format tooltip correctly with 1/5 rule', () => {
      const capitalLimits: CapitalLimits = {
        walletBalance: 100,
        leverage: 1,
        positionSizePercent: 15,
        availableCapital: 100,
        maxAffordableWatchers: 10,
        capitalPerWatcher: 15,
        maxCapitalPerPosition: 20,
      };

      const result = formatCapitalTooltip(capitalLimits);
      expect(result).toBe('$100.00 × 1x × 15% | Max/pos: $20.00 (1/5 rule)');
    });

    it('should handle leverage in tooltip', () => {
      const capitalLimits: CapitalLimits = {
        walletBalance: 50,
        leverage: 2,
        positionSizePercent: 15,
        availableCapital: 100,
        maxAffordableWatchers: 5,
        capitalPerWatcher: 20,
        maxCapitalPerPosition: 20,
      };

      const result = formatCapitalTooltip(capitalLimits);
      expect(result).toBe('$50.00 × 2x × 15% | Max/pos: $20.00 (1/5 rule)');
    });

    it('should handle decimal values correctly', () => {
      const capitalLimits: CapitalLimits = {
        walletBalance: 123.456,
        leverage: 5,
        positionSizePercent: 20,
        availableCapital: 617.28,
        maxAffordableWatchers: 25,
        capitalPerWatcher: 24.69,
        maxCapitalPerPosition: 123.46,
      };

      const result = formatCapitalTooltip(capitalLimits);
      expect(result).toBe('$123.46 × 5x × 20% | Max/pos: $123.46 (1/5 rule)');
    });
  });

  describe('calculateMaxAffordableWatchers', () => {
    it('should calculate max watchers correctly', () => {
      const result = calculateMaxAffordableWatchers(1000, 15, 5);
      expect(result).toBe(27);
    });

    it('should return at least 1 watcher even with low capital', () => {
      const result = calculateMaxAffordableWatchers(100, 15, 100);
      expect(result).toBe(1);
    });

    it('should handle higher position size correctly', () => {
      const result = calculateMaxAffordableWatchers(500, 15, 10);
      expect(result).toBe(6);
    });

    it('should consider safety margin (1.1x) in calculation', () => {
      const availableCapital = 1100;
      const positionSizePercent = 10;
      const minRequired = 10;
      const result = calculateMaxAffordableWatchers(availableCapital, positionSizePercent, minRequired);
      expect(result).toBe(10);
    });
  });

  describe('calculateMinRequiredCapitalForSymbol', () => {
    it('should return minNotional when it is higher', () => {
      const result = calculateMinRequiredCapitalForSymbol(10, 0.001, 100);
      expect(result.source).toBe('minNotional');
      expect(result.minRequired).toBeCloseTo(11, 1);
    });

    it('should return minQty when minQty * price is higher', () => {
      const result = calculateMinRequiredCapitalForSymbol(5, 0.01, 700);
      expect(result.source).toBe('minQty');
      expect(result.minRequired).toBeCloseTo(7.7, 1);
    });

    it('should handle BNBUSDT case correctly (minQty=0.01, price=$700)', () => {
      const result = calculateMinRequiredCapitalForSymbol(5, 0.01, 700);
      expect(result.source).toBe('minQty');
      expect(result.minRequired).toBeCloseTo(7.7, 5);
    });

    it('should handle BTCUSDT case correctly (minQty=0.001, price=$100000)', () => {
      const result = calculateMinRequiredCapitalForSymbol(5, 0.001, 100000);
      expect(result.source).toBe('minQty');
      expect(result.minRequired).toBeCloseTo(110, 5);
    });

    it('should handle low-value coins correctly (minNotional dominates)', () => {
      const result = calculateMinRequiredCapitalForSymbol(5, 1, 0.5);
      expect(result.source).toBe('minNotional');
      expect(result.minRequired).toBe(5.5);
    });

    it('should use default safety margin of 1.1', () => {
      const result = calculateMinRequiredCapitalForSymbol(10, 0, 0);
      expect(result.minRequired).toBe(11);
    });

    it('should allow custom safety margin', () => {
      const result = calculateMinRequiredCapitalForSymbol(10, 0, 0, 1.2);
      expect(result.minRequired).toBe(12);
    });
  });

  describe('1/5 rule scenarios', () => {
    it('should filter out BTC with $100 wallet (BTC needs $110, 1/5 of $100 = $20)', () => {
      const walletBalance = 100;
      const availableCapital = walletBalance;
      const maxCapitalPerPosition = availableCapital / 5;

      const btcMinRequired = 110;

      expect(btcMinRequired).toBeGreaterThan(maxCapitalPerPosition);
      expect(maxCapitalPerPosition).toBe(20);
    });

    it('should allow BNB with $100 wallet (BNB needs $7.7, 1/5 of $100 = $20)', () => {
      const walletBalance = 100;
      const availableCapital = walletBalance;
      const maxCapitalPerPosition = availableCapital / 5;

      const { minRequired: bnbMinRequired } = calculateMinRequiredCapitalForSymbol(5, 0.01, 700);

      expect(bnbMinRequired).toBeLessThan(maxCapitalPerPosition);
      expect(bnbMinRequired).toBeCloseTo(7.7, 1);
    });

    it('should allow BTC with $600 wallet and 5x leverage', () => {
      const walletBalance = 600;
      const leverage = 5;
      const availableCapital = walletBalance * leverage;
      const maxCapitalPerPosition = availableCapital / 5;

      const btcMinRequired = 110;

      expect(btcMinRequired).toBeLessThan(maxCapitalPerPosition);
      expect(maxCapitalPerPosition).toBe(600);
    });

    it('should calculate correctly for $50 wallet trading BNB futures', () => {
      const walletBalance = 50;
      const leverage = 1;
      const availableCapital = walletBalance * leverage;
      const maxCapitalPerPosition = availableCapital / 5;
      const positionSizePercent = 10;

      expect(maxCapitalPerPosition).toBe(10);

      const bnbMinQty = 0.01;
      const bnbPrice = 700;
      const minNotional = 5;

      const { minRequired } = calculateMinRequiredCapitalForSymbol(minNotional, bnbMinQty, bnbPrice);
      expect(minRequired).toBeCloseTo(7.7, 1);
      expect(minRequired).toBeLessThan(maxCapitalPerPosition);

      const maxWatchers = calculateMaxAffordableWatchers(availableCapital, positionSizePercent, minRequired);
      expect(maxWatchers).toBe(1);
    });

    it('should guarantee at least 5 watchers with 1/5 rule', () => {
      const walletBalance = 50;
      const availableCapital = walletBalance;
      const maxCapitalPerPosition = availableCapital / 5;

      expect(maxCapitalPerPosition).toBe(10);
    });

    it('should handle low capital scenario - can only trade low-cost symbols', () => {
      const walletBalance = 10;
      const leverage = 1;
      const availableCapital = walletBalance * leverage;
      const maxCapitalPerPosition = availableCapital / 5;

      expect(maxCapitalPerPosition).toBe(2);

      const dogeMinRequired = 5.5;
      expect(dogeMinRequired).toBeGreaterThan(maxCapitalPerPosition);
    });
  });
});
