import { describe, expect, it } from 'vitest';
import {
  addPrice,
  averagePrice,
  calculateQuoteQty,
  comparePrice,
  dividePrice,
  formatPrice,
  formatQty,
  formatVolume,
  isValidPrice,
  isValidQty,
  isValidSymbol,
  maxPrice,
  minPrice,
  multiplyPrice,
  normalizeSymbol,
  parsePrice,
  parseQty,
  parseSymbol,
  parseVolume,
  subtractPrice,
} from './priceUtils';

describe('priceUtils', () => {
  describe('parsePrice', () => {
    it('should parse string price to number', () => {
      expect(parsePrice('100.50')).toBe(100.5);
    });

    it('should return number as is', () => {
      expect(parsePrice(100.5)).toBe(100.5);
    });

    it('should handle small decimals', () => {
      expect(parsePrice('0.00001234')).toBe(0.00001234);
    });
  });

  describe('formatPrice', () => {
    it('should format with default precision (8)', () => {
      expect(formatPrice(100.5)).toBe('100.50000000');
    });

    it('should format with custom precision', () => {
      expect(formatPrice(100.5, 2)).toBe('100.50');
    });

    it('should format large numbers', () => {
      expect(formatPrice(42000.12345678, 4)).toBe('42000.1235');
    });
  });

  describe('parseQty', () => {
    it('should parse string qty to number', () => {
      expect(parseQty('1.5')).toBe(1.5);
    });

    it('should return number as is', () => {
      expect(parseQty(1.5)).toBe(1.5);
    });
  });

  describe('formatQty', () => {
    it('should format with default precision (8)', () => {
      expect(formatQty(1.5)).toBe('1.50000000');
    });

    it('should format with custom precision', () => {
      expect(formatQty(1.5, 4)).toBe('1.5000');
    });
  });

  describe('parseVolume', () => {
    it('should parse string volume to number', () => {
      expect(parseVolume('1000.5')).toBe(1000.5);
    });

    it('should return number as is', () => {
      expect(parseVolume(1000.5)).toBe(1000.5);
    });
  });

  describe('formatVolume', () => {
    it('should format with default precision (8)', () => {
      expect(formatVolume(1000.5)).toBe('1000.50000000');
    });

    it('should format with custom precision', () => {
      expect(formatVolume(1000.5, 2)).toBe('1000.50');
    });
  });

  describe('calculateQuoteQty', () => {
    it('should calculate quote quantity', () => {
      expect(calculateQuoteQty('100', '1.5')).toBe('150.00000000');
    });

    it('should handle decimal prices', () => {
      expect(parseFloat(calculateQuoteQty('42000.50', '0.5'))).toBeCloseTo(21000.25, 2);
    });
  });

  describe('isValidPrice', () => {
    it('should return true for valid positive price', () => {
      expect(isValidPrice('100.50')).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidPrice('0')).toBe(false);
    });

    it('should return false for negative price', () => {
      expect(isValidPrice('-100')).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidPrice('invalid')).toBe(false);
    });
  });

  describe('isValidQty', () => {
    it('should return true for valid positive qty', () => {
      expect(isValidQty('1.5')).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidQty('0')).toBe(false);
    });

    it('should return false for negative qty', () => {
      expect(isValidQty('-1')).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidQty('invalid')).toBe(false);
    });
  });

  describe('comparePrice', () => {
    it('should return positive when a > b', () => {
      expect(comparePrice('110', '100')).toBeGreaterThan(0);
    });

    it('should return negative when a < b', () => {
      expect(comparePrice('100', '110')).toBeLessThan(0);
    });

    it('should return 0 when equal', () => {
      expect(comparePrice('100', '100')).toBe(0);
    });
  });

  describe('addPrice', () => {
    it('should add two prices', () => {
      const result = parseFloat(addPrice('100', '50'));
      expect(result).toBe(150);
    });

    it('should handle decimals', () => {
      const result = parseFloat(addPrice('100.5', '50.25'));
      expect(result).toBeCloseTo(150.75, 2);
    });
  });

  describe('subtractPrice', () => {
    it('should subtract two prices', () => {
      const result = parseFloat(subtractPrice('100', '50'));
      expect(result).toBe(50);
    });

    it('should handle negative result', () => {
      const result = parseFloat(subtractPrice('50', '100'));
      expect(result).toBe(-50);
    });
  });

  describe('multiplyPrice', () => {
    it('should multiply price by number', () => {
      const result = parseFloat(multiplyPrice('100', 2));
      expect(result).toBe(200);
    });

    it('should handle fractional multiplier', () => {
      const result = parseFloat(multiplyPrice('100', 0.5));
      expect(result).toBe(50);
    });
  });

  describe('dividePrice', () => {
    it('should divide price by number', () => {
      const result = parseFloat(dividePrice('100', 2));
      expect(result).toBe(50);
    });

    it('should handle fractional divisor', () => {
      const result = parseFloat(dividePrice('100', 0.5));
      expect(result).toBe(200);
    });
  });

  describe('averagePrice', () => {
    it('should calculate average of prices', () => {
      const result = parseFloat(averagePrice(['100', '200', '300']));
      expect(result).toBe(200);
    });

    it('should return 0 for empty array', () => {
      expect(averagePrice([])).toBe('0');
    });

    it('should handle single price', () => {
      const result = parseFloat(averagePrice(['100']));
      expect(result).toBe(100);
    });
  });

  describe('maxPrice', () => {
    it('should return max price', () => {
      const result = parseFloat(maxPrice(['100', '200', '150']));
      expect(result).toBe(200);
    });

    it('should return 0 for empty array', () => {
      expect(maxPrice([])).toBe('0');
    });

    it('should handle single price', () => {
      const result = parseFloat(maxPrice(['100']));
      expect(result).toBe(100);
    });
  });

  describe('minPrice', () => {
    it('should return min price', () => {
      const result = parseFloat(minPrice(['100', '200', '150']));
      expect(result).toBe(100);
    });

    it('should return 0 for empty array', () => {
      expect(minPrice([])).toBe('0');
    });

    it('should handle single price', () => {
      const result = parseFloat(minPrice(['100']));
      expect(result).toBe(100);
    });
  });

  describe('normalizeSymbol', () => {
    it('should uppercase symbol', () => {
      expect(normalizeSymbol('btcusdt')).toBe('BTCUSDT');
    });

    it('should remove special characters', () => {
      expect(normalizeSymbol('BTC-USDT')).toBe('BTCUSDT');
    });

    it('should remove spaces', () => {
      expect(normalizeSymbol('BTC USDT')).toBe('BTCUSDT');
    });

    it('should handle already normalized symbol', () => {
      expect(normalizeSymbol('BTCUSDT')).toBe('BTCUSDT');
    });
  });

  describe('parseSymbol', () => {
    it('should parse USDT pair', () => {
      expect(parseSymbol('BTCUSDT')).toEqual({ base: 'BTC', quote: 'USDT' });
    });

    it('should parse BUSD pair', () => {
      expect(parseSymbol('ETHBUSD')).toEqual({ base: 'ETH', quote: 'BUSD' });
    });

    it('should parse BTC pair', () => {
      expect(parseSymbol('ETHBTC')).toEqual({ base: 'ETH', quote: 'BTC' });
    });

    it('should parse BNB pair', () => {
      expect(parseSymbol('ADABNB')).toEqual({ base: 'ADA', quote: 'BNB' });
    });

    it('should parse USD pair', () => {
      expect(parseSymbol('BTCUSD')).toEqual({ base: 'BTC', quote: 'USD' });
    });

    it('should parse EUR pair', () => {
      expect(parseSymbol('BTCEUR')).toEqual({ base: 'BTC', quote: 'EUR' });
    });

    it('should parse BRL pair', () => {
      expect(parseSymbol('BTCBRL')).toEqual({ base: 'BTC', quote: 'BRL' });
    });

    it('should return null for unknown quote', () => {
      expect(parseSymbol('BTCXYZ')).toBeNull();
    });

    it('should return null for empty base', () => {
      expect(parseSymbol('USDT')).toBeNull();
    });

    it('should handle lowercase input', () => {
      expect(parseSymbol('btcusdt')).toEqual({ base: 'BTC', quote: 'USDT' });
    });
  });

  describe('isValidSymbol', () => {
    it('should return true for valid USDT pair', () => {
      expect(isValidSymbol('BTCUSDT')).toBe(true);
    });

    it('should return true for valid BUSD pair', () => {
      expect(isValidSymbol('ETHBUSD')).toBe(true);
    });

    it('should return false for too short symbol', () => {
      expect(isValidSymbol('BTC')).toBe(false);
    });

    it('should return false for invalid quote', () => {
      expect(isValidSymbol('BTCXYZ')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidSymbol('')).toBe(false);
    });
  });
});
