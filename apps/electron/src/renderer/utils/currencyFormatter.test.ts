import { describe, expect, it } from 'vitest';
import { formatBRL, formatBRLCompact, getCurrencySymbol, formatWalletCurrency, formatWalletCurrencyWithSign } from './currencyFormatter';

describe('currencyFormatter', () => {
  describe('getCurrencySymbol', () => {
    it('should return $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return $ for USDT', () => {
      expect(getCurrencySymbol('USDT')).toBe('$');
    });

    it('should return R$ for BRL', () => {
      expect(getCurrencySymbol('BRL')).toBe('R$');
    });

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return $ for unknown currency', () => {
      expect(getCurrencySymbol('XYZ')).toBe('$');
    });

    it('should return $ when no currency provided', () => {
      expect(getCurrencySymbol()).toBe('$');
    });
  });

  describe('formatWalletCurrency', () => {
    it('should format with $ for USDT', () => {
      expect(formatWalletCurrency(1234.56, 'USDT')).toBe('$1234.56');
    });

    it('should format with R$ for BRL', () => {
      expect(formatWalletCurrency(1234.56, 'BRL')).toBe('R$1234.56');
    });

    it('should use absolute value', () => {
      expect(formatWalletCurrency(-500, 'USD')).toBe('$500.00');
    });

    it('should default to USDT', () => {
      expect(formatWalletCurrency(100)).toBe('$100.00');
    });
  });

  describe('formatWalletCurrencyWithSign', () => {
    it('should add + for positive values', () => {
      expect(formatWalletCurrencyWithSign(100, 'USD')).toBe('+$100.00');
    });

    it('should add - for negative values', () => {
      expect(formatWalletCurrencyWithSign(-100, 'USD')).toBe('-$100.00');
    });

    it('should format with correct currency symbol', () => {
      expect(formatWalletCurrencyWithSign(50, 'BRL')).toBe('+R$50.00');
      expect(formatWalletCurrencyWithSign(-50, 'EUR')).toBe('-€50.00');
    });

    it('should treat zero as positive', () => {
      expect(formatWalletCurrencyWithSign(0, 'USDT')).toBe('+$0.00');
    });
  });

  describe('formatBRL', () => {
    it('should format positive values correctly', () => {
      const result = formatBRL(1000);
      expect(result).toMatch(/R\$\s?1[.,]000[.,]00/);
    });

    it('should format zero correctly', () => {
      const result = formatBRL(0);
      expect(result).toMatch(/R\$\s?0[.,]00/);
    });

    it('should format negative values correctly', () => {
      const result = formatBRL(-500);
      expect(result).toMatch(/-?R\$\s?-?500[.,]00/);
    });

    it('should format decimal values with 2 decimal places', () => {
      const result = formatBRL(123.456);
      expect(result).toMatch(/R\$\s?123[.,]46/);
    });
  });

  describe('formatBRLCompact', () => {
    it('should format millions correctly', () => {
      expect(formatBRLCompact(1_500_000)).toBe('R$ 1.50M');
    });

    it('should format thousands correctly', () => {
      expect(formatBRLCompact(15_000)).toBe('R$ 15.00K');
    });

    it('should format small values using standard format', () => {
      const result = formatBRLCompact(999);
      expect(result).toMatch(/R\$\s?999[.,]00/);
    });
  });
});
