import { describe, expect, it } from 'vitest';
import type { Candle } from '../../shared/types';
import { calculateStochastic, DEFAULT_STOCHASTIC_CONFIG } from './stochastic';

describe('stochastic', () => {
  const createCandle = (close: number, high: number, low: number): Candle => ({
    timestamp: Date.now(),
    open: close,
    high,
    low,
    close,
    volume: 1000,
  });

  describe('calculateStochastic', () => {
    it('should return empty arrays for empty candles', () => {
      const result = calculateStochastic([], 14, 9);
      
      expect(result.k).toEqual([]);
      expect(result.d).toEqual([]);
    });

    it('should return empty arrays for invalid periods', () => {
      const candles = [createCandle(100, 102, 98)];
      
      expect(calculateStochastic(candles, 0, 9)).toEqual({ k: [], d: [] });
      expect(calculateStochastic(candles, 14, 0)).toEqual({ k: [], d: [] });
      expect(calculateStochastic(candles, -1, 9)).toEqual({ k: [], d: [] });
    });

    it('should return nulls for initial values before kPeriod', () => {
      const candles = Array.from({ length: 20 }, (_, i) => 
        createCandle(100 + i, 102 + i, 98 + i)
      );
      
      const result = calculateStochastic(candles, 14, 9);
      
      for (let i = 0; i < 13; i++) {
        expect(result.k[i]).toBeNull();
      }
      
      expect(result.k[13]).not.toBeNull();
    });

    it('should calculate %K correctly', () => {
      const candles = [
        createCandle(100, 105, 95),
        createCandle(102, 107, 97),
        createCandle(104, 109, 99),
        createCandle(106, 111, 101),
        createCandle(108, 113, 103),
      ];
      
      const result = calculateStochastic(candles, 5, 3);
      
      expect(result.k[0]).toBeNull();
      expect(result.k[1]).toBeNull();
      expect(result.k[2]).toBeNull();
      expect(result.k[3]).toBeNull();
      
      const expectedK = ((108 - 95) / (113 - 95)) * 100;
      expect(result.k[4]).toBeCloseTo(expectedK, 10);
    });

    it('should handle flat price range', () => {
      const candles = Array.from({ length: 15 }, () => 
        createCandle(100, 100, 100)
      );
      
      const result = calculateStochastic(candles, 14, 9);
      
      expect(result.k[13]).toBe(50);
      expect(result.k[14]).toBe(50);
    });

    it('should calculate %D as EMA of %K', () => {
      const candles = Array.from({ length: 30 }, (_, i) => {
        const base = 100 + i;
        return createCandle(base, base + 2, base - 2);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      for (let i = 0; i < 13 + 8; i++) {
        expect(result.d[i]).toBeNull();
      }
      
      expect(result.d[21]).not.toBeNull();
      expect(typeof result.d[21]).toBe('number');
    });

    it('should return values between 0 and 100 for %K', () => {
      const candles = Array.from({ length: 50 }, (_, i) => {
        const base = 100 + Math.sin(i * 0.1) * 10;
        return createCandle(base, base + 5, base - 5);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      result.k.forEach(value => {
        if (value !== null) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      });
    });

    it('should calculate correctly with default periods (14, 9)', () => {
      const candles = Array.from({ length: 30 }, (_, i) => {
        const base = 100 + i * 0.5;
        return createCandle(base, base + 3, base - 2);
      });
      
      const result = calculateStochastic(candles);
      
      expect(result.k).toHaveLength(30);
      expect(result.d).toHaveLength(30);
      
      for (let i = 0; i < 13; i++) {
        expect(result.k[i]).toBeNull();
      }
      
      expect(result.k[13]).not.toBeNull();
    });

    it('should handle volatile market conditions', () => {
      const candles = [
        createCandle(100, 110, 90),
        createCandle(95, 105, 85),
        createCandle(105, 115, 95),
        createCandle(110, 120, 100),
        createCandle(90, 100, 80),
        createCandle(100, 110, 90),
        createCandle(105, 115, 95),
        createCandle(98, 108, 88),
        createCandle(102, 112, 92),
        createCandle(107, 117, 97),
        createCandle(103, 113, 93),
        createCandle(99, 109, 89),
        createCandle(104, 114, 94),
        createCandle(108, 118, 98),
        createCandle(106, 116, 96),
      ];
      
      const result = calculateStochastic(candles, 14, 3);
      
      expect(result.k[13]).not.toBeNull();
      expect(result.k[14]).not.toBeNull();
      
      if (result.k[13] !== null && result.k[14] !== null) {
        expect(result.k[13]).toBeGreaterThanOrEqual(0);
        expect(result.k[13]).toBeLessThanOrEqual(100);
        expect(result.k[14]).toBeGreaterThanOrEqual(0);
        expect(result.k[14]).toBeLessThanOrEqual(100);
      }
    });

    it('should handle period of 1', () => {
      const candles = [
        createCandle(100, 105, 95),
        createCandle(102, 107, 97),
        createCandle(104, 109, 99),
      ];
      
      const result = calculateStochastic(candles, 1, 1);
      
      expect(result.k[0]).toBe(50);
      expect(result.k[1]).toBe(50);
      expect(result.k[2]).toBe(50);
    });

    it('should produce smooth %D line', () => {
      const candles = Array.from({ length: 40 }, (_, i) => {
        const base = 100 + Math.sin(i * 0.2) * 20;
        return createCandle(base, base + 5, base - 5);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      const validD = result.d.filter((v): v is number => v !== null);
      
      expect(validD.length).toBeGreaterThan(0);
      
      validD.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it('should handle large datasets efficiently', () => {
      const candles = Array.from({ length: 1000 }, (_, i) => {
        const base = 100 + i * 0.1;
        return createCandle(base, base + 2, base - 2);
      });
      
      const startTime = performance.now();
      const result = calculateStochastic(candles, 14, 9);
      const endTime = performance.now();
      
      expect(result.k).toHaveLength(1000);
      expect(result.d).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('DEFAULT_STOCHASTIC_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_STOCHASTIC_CONFIG.kPeriod).toBe(14);
      expect(DEFAULT_STOCHASTIC_CONFIG.dPeriod).toBe(9);
      expect(DEFAULT_STOCHASTIC_CONFIG.enabled).toBe(false);
      expect(DEFAULT_STOCHASTIC_CONFIG.kColor).toBe('#2196f3');
      expect(DEFAULT_STOCHASTIC_CONFIG.dColor).toBe('#ff5722');
      expect(DEFAULT_STOCHASTIC_CONFIG.overboughtLevel).toBe(80);
      expect(DEFAULT_STOCHASTIC_CONFIG.oversoldLevel).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle single candle', () => {
      const candles = [createCandle(100, 105, 95)];
      const result = calculateStochastic(candles, 1, 1);
      
      expect(result.k[0]).toBe(50);
    });

    it('should handle exact overbought scenario', () => {
      const candles = Array.from({ length: 20 }, (_, i) => {
        if (i < 14) return createCandle(100, 110, 90);
        return createCandle(110, 110, 90);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      const lastK = result.k[result.k.length - 1];
      expect(lastK).toBe(100);
    });

    it('should handle exact oversold scenario', () => {
      const candles = Array.from({ length: 20 }, (_, i) => {
        if (i < 14) return createCandle(100, 110, 90);
        return createCandle(90, 110, 90);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      const lastK = result.k[result.k.length - 1];
      expect(lastK).toBe(0);
    });

    it('should handle trending up market', () => {
      const candles = Array.from({ length: 30 }, (_, i) => {
        const base = 100 + i * 2;
        return createCandle(base, base + 3, base - 1);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      const validK = result.k.filter((v): v is number => v !== null);
      
      validK.forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should handle trending down market', () => {
      const candles = Array.from({ length: 30 }, (_, i) => {
        const base = 200 - i * 2;
        return createCandle(base, base + 1, base - 3);
      });
      
      const result = calculateStochastic(candles, 14, 9);
      
      const validK = result.k.filter((v): v is number => v !== null);
      
      validK.forEach(value => {
        expect(value).toBeLessThan(100);
      });
    });
  });
});
