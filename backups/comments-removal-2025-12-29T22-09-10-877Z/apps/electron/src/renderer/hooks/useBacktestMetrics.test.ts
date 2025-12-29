import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDuration,
  getProfitFactorLabel,
  getSharpeRatioLabel,
  getCommissionPercent,
  getMaxPositionSize,
  getCommissionImpact,
  getThemeColors,
  DECIMAL_PLACES,
  MINUTES_PER_HOUR,
  PERCENT_MULTIPLIER,
  DEFAULT_COMMISSION,
  DEFAULT_MAX_POSITION,
  PROFIT_FACTOR_EXCELLENT,
  PROFIT_FACTOR_GOOD,
  SHARPE_EXCELLENT,
  SHARPE_GOOD,
} from './useBacktestMetrics';

describe('useBacktestMetrics pure functions', () => {
  describe('constants', () => {
    it('should have correct default values', () => {
      expect(DECIMAL_PLACES).toBe(2);
      expect(MINUTES_PER_HOUR).toBe(60);
      expect(PERCENT_MULTIPLIER).toBe(100);
      expect(DEFAULT_COMMISSION).toBe(0.001);
      expect(DEFAULT_MAX_POSITION).toBe(10);
    });

    it('should have correct threshold values', () => {
      expect(PROFIT_FACTOR_EXCELLENT).toBe(2);
      expect(PROFIT_FACTOR_GOOD).toBe(1.5);
      expect(SHARPE_EXCELLENT).toBe(2);
      expect(SHARPE_GOOD).toBe(1);
    });
  });

  describe('formatCurrency', () => {
    it('should format positive numbers as USD', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format negative numbers', () => {
      expect(formatCurrency(-500.25)).toBe('-$500.25');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should respect custom decimal places', () => {
      expect(formatCurrency(100, 0)).toBe('$100');
      expect(formatCurrency(100.123, 3)).toBe('$100.123');
    });

    it('should format large numbers with commas', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('should round to specified decimals', () => {
      expect(formatCurrency(100.999, 2)).toBe('$101.00');
    });
  });

  describe('formatPercent', () => {
    it('should format positive percentages', () => {
      expect(formatPercent(50)).toBe('50.00%');
    });

    it('should format negative percentages', () => {
      expect(formatPercent(-25.5)).toBe('-25.50%');
    });

    it('should format zero', () => {
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('should respect custom decimal places', () => {
      expect(formatPercent(33.333, 1)).toBe('33.3%');
      expect(formatPercent(66.6666, 3)).toBe('66.667%');
    });

    it('should handle small percentages', () => {
      expect(formatPercent(0.01)).toBe('0.01%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with default decimals', () => {
      expect(formatNumber(123.456)).toBe('123.46');
    });

    it('should respect custom decimals', () => {
      expect(formatNumber(123.456, 0)).toBe('123');
      expect(formatNumber(123.456, 1)).toBe('123.5');
      expect(formatNumber(123.456, 4)).toBe('123.4560');
    });

    it('should handle integers', () => {
      expect(formatNumber(100)).toBe('100.00');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-50.5)).toBe('-50.50');
    });
  });

  describe('formatDuration', () => {
    it('should convert minutes to hours', () => {
      expect(formatDuration(60)).toBe('1.0');
      expect(formatDuration(120)).toBe('2.0');
    });

    it('should handle partial hours', () => {
      expect(formatDuration(90)).toBe('1.5');
      expect(formatDuration(45)).toBe('0.8');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0.0');
    });

    it('should respect custom decimals', () => {
      expect(formatDuration(100, 2)).toBe('1.67');
    });

    it('should handle large durations', () => {
      expect(formatDuration(1440)).toBe('24.0');
    });
  });

  describe('getProfitFactorLabel', () => {
    it('should return excellent for profit factor >= 2', () => {
      expect(getProfitFactorLabel(2)).toBe('excellent');
      expect(getProfitFactorLabel(2.5)).toBe('excellent');
      expect(getProfitFactorLabel(10)).toBe('excellent');
    });

    it('should return good for profit factor >= 1.5 and < 2', () => {
      expect(getProfitFactorLabel(1.5)).toBe('good');
      expect(getProfitFactorLabel(1.7)).toBe('good');
      expect(getProfitFactorLabel(1.99)).toBe('good');
    });

    it('should return fair for profit factor < 1.5', () => {
      expect(getProfitFactorLabel(1.49)).toBe('fair');
      expect(getProfitFactorLabel(1)).toBe('fair');
      expect(getProfitFactorLabel(0.5)).toBe('fair');
      expect(getProfitFactorLabel(0)).toBe('fair');
    });

    it('should handle negative profit factors as fair', () => {
      expect(getProfitFactorLabel(-1)).toBe('fair');
    });
  });

  describe('getSharpeRatioLabel', () => {
    it('should return null for null or undefined', () => {
      expect(getSharpeRatioLabel(null)).toBeNull();
      expect(getSharpeRatioLabel(undefined)).toBeNull();
    });

    it('should return null for zero', () => {
      expect(getSharpeRatioLabel(0)).toBeNull();
    });

    it('should return excellent for sharpe >= 2', () => {
      expect(getSharpeRatioLabel(2)).toBe('excellent');
      expect(getSharpeRatioLabel(3)).toBe('excellent');
    });

    it('should return good for sharpe >= 1 and < 2', () => {
      expect(getSharpeRatioLabel(1)).toBe('good');
      expect(getSharpeRatioLabel(1.5)).toBe('good');
      expect(getSharpeRatioLabel(1.99)).toBe('good');
    });

    it('should return fair for sharpe > 0 and < 1', () => {
      expect(getSharpeRatioLabel(0.5)).toBe('fair');
      expect(getSharpeRatioLabel(0.99)).toBe('fair');
      expect(getSharpeRatioLabel(0.01)).toBe('fair');
    });

    it('should return fair for negative sharpe ratios', () => {
      expect(getSharpeRatioLabel(-0.5)).toBe('fair');
      expect(getSharpeRatioLabel(-2)).toBe('fair');
    });
  });

  describe('getCommissionPercent', () => {
    it('should use default commission when undefined', () => {
      expect(getCommissionPercent(undefined)).toBe('0.10%');
    });

    it('should calculate commission percent correctly', () => {
      expect(getCommissionPercent(0.001)).toBe('0.10%');
      expect(getCommissionPercent(0.01)).toBe('1.00%');
      expect(getCommissionPercent(0.05)).toBe('5.00%');
    });

    it('should handle zero commission', () => {
      expect(getCommissionPercent(0)).toBe('0.00%');
    });
  });

  describe('getMaxPositionSize', () => {
    it('should use default when undefined', () => {
      expect(getMaxPositionSize(undefined)).toBe(10);
    });

    it('should return provided value', () => {
      expect(getMaxPositionSize(5)).toBe(5);
      expect(getMaxPositionSize(20)).toBe(20);
      expect(getMaxPositionSize(100)).toBe(100);
    });

    it('should handle zero', () => {
      expect(getMaxPositionSize(0)).toBe(0);
    });
  });

  describe('getCommissionImpact', () => {
    it('should calculate commission impact correctly', () => {
      expect(getCommissionImpact(100, 10000)).toBe('1.00%');
      expect(getCommissionImpact(50, 10000)).toBe('0.50%');
      expect(getCommissionImpact(250, 10000)).toBe('2.50%');
    });

    it('should handle zero commission', () => {
      expect(getCommissionImpact(0, 10000)).toBe('0.00%');
    });

    it('should handle large commission', () => {
      expect(getCommissionImpact(1000, 10000)).toBe('10.00%');
    });

    it('should handle small initial capital', () => {
      expect(getCommissionImpact(10, 100)).toBe('10.00%');
    });
  });

  describe('getThemeColors', () => {
    it('should return light mode colors', () => {
      const colors = getThemeColors('light');
      expect(colors.positiveColor).toBe('green.500');
      expect(colors.negativeColor).toBe('red.500');
    });

    it('should return dark mode colors', () => {
      const colors = getThemeColors('dark');
      expect(colors.positiveColor).toBe('green.300');
      expect(colors.negativeColor).toBe('red.300');
    });
  });
});
