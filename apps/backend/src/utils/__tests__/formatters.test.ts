import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  roundToDecimals,
  calculateGrossPnl,
  calculateNotional,
  formatNumberForBinance,
  formatQuantityForBinance,
  formatPriceForBinance,
} from '../formatters';

describe('formatters', () => {
  describe('formatPrice', () => {
    it('should format prices >= 1 to 2 decimal places', () => {
      expect(formatPrice(1)).toBe('1.00');
      expect(formatPrice(100.456)).toBe('100.46');
      expect(formatPrice(50000)).toBe('50000.00');
    });

    it('should format prices < 1 to 6 decimal places', () => {
      expect(formatPrice(0.5)).toBe('0.500000');
      expect(formatPrice(0.000123)).toBe('0.000123');
      expect(formatPrice(0.99)).toBe('0.990000');
    });
  });

  describe('roundToDecimals', () => {
    it('should round to specified decimal places', () => {
      expect(roundToDecimals(1.23456789, 4)).toBe(1.2346);
      expect(roundToDecimals(1.23456789, 2)).toBe(1.23);
    });

    it('should default to 8 decimal places', () => {
      expect(roundToDecimals(1.123456789012)).toBe(1.12345679);
    });

    it('should return 0 for non-finite values', () => {
      expect(roundToDecimals(Infinity)).toBe(0);
      expect(roundToDecimals(-Infinity)).toBe(0);
      expect(roundToDecimals(NaN)).toBe(0);
    });
  });

  describe('calculateGrossPnl', () => {
    it('should calculate positive PnL for LONG with price increase', () => {
      expect(calculateGrossPnl(100, 110, 10, 'LONG')).toBeCloseTo(100, 5);
    });

    it('should calculate negative PnL for LONG with price decrease', () => {
      expect(calculateGrossPnl(100, 90, 10, 'LONG')).toBeCloseTo(-100, 5);
    });

    it('should calculate positive PnL for SHORT with price decrease', () => {
      expect(calculateGrossPnl(100, 90, 10, 'SHORT')).toBeCloseTo(100, 5);
    });

    it('should calculate negative PnL for SHORT with price increase', () => {
      expect(calculateGrossPnl(100, 110, 10, 'SHORT')).toBeCloseTo(-100, 5);
    });

    it('should return 0 when entry and exit prices are equal', () => {
      expect(calculateGrossPnl(100, 100, 10, 'LONG')).toBe(0);
      expect(calculateGrossPnl(100, 100, 10, 'SHORT')).toBe(-0);
    });
  });

  describe('calculateNotional', () => {
    it('should multiply price by quantity and round', () => {
      expect(calculateNotional(100, 5)).toBe(500);
      expect(calculateNotional(0.001, 1000)).toBeCloseTo(1, 5);
    });
  });

  describe('formatNumberForBinance', () => {
    it('should return "0" for zero', () => {
      expect(formatNumberForBinance(0)).toBe('0');
    });

    it('should return "0" for non-finite values', () => {
      expect(formatNumberForBinance(Infinity)).toBe('0');
      expect(formatNumberForBinance(NaN)).toBe('0');
    });

    it('should trim trailing zeros after decimal', () => {
      expect(formatNumberForBinance(1.5, 8)).toBe('1.5');
      expect(formatNumberForBinance(1.0, 8)).toBe('1');
      expect(formatNumberForBinance(1.10000, 8)).toBe('1.1');
    });

    it('should handle values without decimal point', () => {
      expect(formatNumberForBinance(100, 0)).toBe('100');
    });

    it('should use specified precision', () => {
      expect(formatNumberForBinance(1.123456, 3)).toBe('1.123');
    });

    it('should return "0" when trimmed result is empty', () => {
      expect(formatNumberForBinance(0.0000000001, 2)).toBe('0');
    });
  });

  describe('formatQuantityForBinance', () => {
    it('should use default precision when no stepSize provided', () => {
      expect(formatQuantityForBinance(1.5)).toBe('1.5');
    });

    it('should use default precision when stepSize is "0"', () => {
      expect(formatQuantityForBinance(1.5, '0')).toBe('1.5');
    });

    it('should use default precision when stepSize is non-finite', () => {
      expect(formatQuantityForBinance(1.5, 'abc')).toBe('1.5');
    });

    it('should align quantity to stepSize', () => {
      expect(formatQuantityForBinance(1.567, '0.01')).toBe('1.56');
      expect(formatQuantityForBinance(1.999, '0.1')).toBe('1.9');
    });

    it('should floor quantity to stepSize', () => {
      expect(formatQuantityForBinance(0.035, '0.001')).toBe('0.035');
      expect(formatQuantityForBinance(0.0359, '0.001')).toBe('0.035');
    });

    it('should handle integer stepSize', () => {
      expect(formatQuantityForBinance(5.7, '1')).toBe('5');
    });
  });

  describe('formatPriceForBinance', () => {
    it('should use default precision when no tickSize provided', () => {
      expect(formatPriceForBinance(100.5)).toBe('100.5');
    });

    it('should use default precision when tickSize is "0"', () => {
      expect(formatPriceForBinance(100.5, '0')).toBe('100.5');
    });

    it('should use default precision when tickSize is non-finite', () => {
      expect(formatPriceForBinance(100.5, 'abc')).toBe('100.5');
    });

    it('should round price to tickSize', () => {
      expect(formatPriceForBinance(100.567, '0.01')).toBe('100.57');
      expect(formatPriceForBinance(100.123, '0.1')).toBe('100.1');
    });

    it('should handle integer tickSize', () => {
      expect(formatPriceForBinance(105.7, '1')).toBe('106');
    });

    it('should handle tickSize with trailing zeros in step', () => {
      expect(formatPriceForBinance(0.12345, '0.00010')).toBe('0.1235');
    });
  });
});
