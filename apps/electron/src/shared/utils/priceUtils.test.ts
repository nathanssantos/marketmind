import { describe, expect, it } from 'vitest';
import {
  addPrice,
  averagePrice,
  calculateQuoteQty,
  comparePrice,
  dividePrice,
  formatPriceExact,
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
  roundTradingQty,
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

  describe('formatPriceExact', () => {
    it('should format with default precision (8)', () => {
      expect(formatPriceExact(100.5)).toBe('100.50000000');
    });

    it('should format with custom precision', () => {
      expect(formatPriceExact(100.5, 2)).toBe('100.50');
    });

    it('should format large numbers', () => {
      expect(formatPriceExact(42000.12345678, 4)).toBe('42000.1235');
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

  describe('roundTradingQty', () => {
    describe('without stepSize (digit-bucket fallback)', () => {
      it('floors qty >= 100 to 0 decimals (truncate, never round up)', () => {
        // 123.99 → "123" (NOT "124" — that would over-allocate above 100%).
        expect(roundTradingQty(123.99)).toBe('123');
        expect(roundTradingQty(100.5)).toBe('100');
      });

      it('floors qty in [1, 100) to 2 decimals', () => {
        // 1.999999 → "1.99" (toFixed(2) would have given "2.00", overshooting).
        expect(roundTradingQty(1.999999)).toBe('1.99');
        expect(roundTradingQty(50.555)).toBe('50.55');
      });

      it('floors qty in [0.001, 1) to 4 decimals', () => {
        // 0.46599999 → "0.4659" (NOT "0.4660" — that would over-allocate vs 100%).
        expect(roundTradingQty(0.46599999)).toBe('0.4659');
        expect(roundTradingQty(0.0015)).toBe('0.0015');
      });

      it('floors qty < 0.001 to 6 decimals', () => {
        expect(roundTradingQty(0.000123999)).toBe('0.000123');
      });

      it('handles zero / negative / non-finite qty gracefully', () => {
        expect(roundTradingQty(0)).toBe('0.000000');
        expect(roundTradingQty(-5)).toBe('0.000000');
        expect(roundTradingQty(NaN)).toBe('0.000000');
        expect(roundTradingQty(Infinity)).toBe('0.000000');
      });
    });

    describe('with stepSize (snaps to exchange LOT_SIZE)', () => {
      it('snaps to BTCUSDT futures stepSize=0.001', () => {
        expect(roundTradingQty(0.46599, 0.001)).toBe('0.465');
        expect(roundTradingQty(0.001, 0.001)).toBe('0.001');
        expect(roundTradingQty(0.0019, 0.001)).toBe('0.001');
      });

      it('snaps to ETHUSDT stepSize=0.01', () => {
        expect(roundTradingQty(1.2345, 0.01)).toBe('1.23');
        expect(roundTradingQty(0.0099, 0.01)).toBe('0.00');
      });

      it('snaps to integer stepSize=1 (e.g. low-precision symbols)', () => {
        expect(roundTradingQty(123.99, 1)).toBe('123');
      });

      it('returns 0.000 when qty < stepSize', () => {
        expect(roundTradingQty(0.0005, 0.001)).toBe('0.000');
      });

      it('falls through to digit-bucket fallback for stepSize <= 0', () => {
        expect(roundTradingQty(0.46599, 0)).toBe('0.4659');
        expect(roundTradingQty(0.46599, -1)).toBe('0.4659');
      });

      it('precision derived from stepSize handles e.g. 0.0001', () => {
        expect(roundTradingQty(0.12345678, 0.0001)).toBe('0.1234');
      });

      it('regression: 100% sizing never overshoots after step snap', () => {
        // User wants 100% of $5000 at 10x leverage, market price $80,500:
        //   qty = (5000 * 10) / 80500 = 0.62111801...
        // With stepSize=0.001, must FLOOR to 0.621 (not round to 0.622),
        // so the submitted qty consumes <= the requested margin × leverage.
        const balance = 5000;
        const leverage = 10;
        const price = 80500;
        const requestedQty = (balance * leverage) / price;
        const snapped = roundTradingQty(requestedQty, 0.001);
        expect(snapped).toBe('0.621');
        expect(parseFloat(snapped) * price).toBeLessThanOrEqual(balance * leverage);
      });
    });
  });
});
