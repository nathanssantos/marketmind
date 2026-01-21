import { describe, expect, it } from 'vitest';
import { formatBRL, formatBRLCompact } from './currencyFormatter';

describe('currencyFormatter', () => {
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
