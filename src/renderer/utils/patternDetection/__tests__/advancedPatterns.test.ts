import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../../shared/types';
import {
    detectTripleBottoms,
    detectTripleTops,
} from '../patterns/advancedPatterns';
import type { PivotPoint } from '../types';

const createCandle = (
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000
): Candle => ({
  timestamp,
  open,
  high,
  low,
  close,
  volume,
});

const createPivot = (
  index: number,
  price: number,
  type: 'high' | 'low',
  baseTimestamp = Date.now()
): PivotPoint => ({
  index,
  price,
  timestamp: baseTimestamp + index * 60000,
  type,
  strength: 1,
  volume: 1000,
});

describe('detectTripleTops', () => {
  describe('valid patterns', () => {
    it('should detect triple top with three peaks at same level', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        const isPeak = i === 5 || i === 15 || i === 25;
        const high = isPeak ? 110 : 95;
        const low = isPeak ? 95 : 90;
        candles.push(
          createCandle(now + i * 60000, 100, high, low, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 110, 'high', now),
        createPivot(20, 90, 'low', now),
        createPivot(25, 110, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('triple-top');
      expect(patterns[0].confidence).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should detect triple top within ±8% tolerance', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 95, 110, 90, 95, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 107, 'high', now),
        createPivot(20, 90, 'low', now),
        createPivot(25, 103, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('triple-top');
    });

    it('should require minimum 3 peaks', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 110, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should calculate confidence based on peak alignment', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 110, 'high', now),
        createPivot(20, 90, 'low', now),
        createPivot(25, 110, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeGreaterThan(0.5);
    });

    it('should include neckline and peaks in pattern data', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 110, 'high', now),
        createPivot(20, 90, 'low', now),
        createPivot(25, 110, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].peak1).toBeDefined();
      expect(patterns[0].peak2).toBeDefined();
      expect(patterns[0].peak3).toBeDefined();
      expect(patterns[0].neckline).toBeDefined();
      expect(patterns[0].neckline.length).toBe(2);
    });
  });

  describe('rejection cases', () => {
    it('should reject when null candles', () => {
      const patterns = detectTripleTops(null as unknown as Candle[], []);
      expect(patterns).toEqual([]);
    });

    it('should reject when undefined candles', () => {
      const patterns = detectTripleTops(
        undefined as unknown as Candle[],
        []
      );
      expect(patterns).toEqual([]);
    });

    it('should reject when empty candles', () => {
      const patterns = detectTripleTops([], []);
      expect(patterns).toEqual([]);
    });

    it('should reject when insufficient candles', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const patterns = detectTripleTops(candles, []);

      expect(patterns).toEqual([]);
    });

    it('should reject peaks outside ±8% tolerance', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 95, 120, 90, 95, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'high', now),
        createPivot(10, 90, 'low', now),
        createPivot(15, 120, 'high', now),
        createPivot(20, 90, 'low', now),
        createPivot(25, 105, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject when insufficient low pivots between peaks', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', now),
        createPivot(15, 110, 'high', now),
        createPivot(25, 110, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBe(0);
    });
  });

  describe('sorting and limits', () => {
    it('should sort patterns by confidence descending', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 100; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 110, 'high', now),
        createPivot(15, 90, 'low', now),
        createPivot(30, 110, 'high', now),
        createPivot(35, 90, 'low', now),
        createPivot(50, 110, 'high', now),
        createPivot(60, 108, 'high', now),
        createPivot(65, 90, 'low', now),
        createPivot(80, 108, 'high', now),
        createPivot(85, 90, 'low', now),
        createPivot(95, 108, 'high', now),
      ];

      const patterns = detectTripleTops(candles, pivots);

      if (patterns.length > 1) {
        for (let i = 1; i < patterns.length; i++) {
          expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(
            patterns[i].confidence
          );
        }
      }
    });

    it('should respect MAX_PATTERNS_PER_TYPE limit', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 200; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 50; i++) {
        pivots.push(createPivot(i * 4, 110, 'high', now));
        pivots.push(createPivot(i * 4 + 2, 90, 'low', now));
      }

      const patterns = detectTripleTops(candles, pivots);

      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });
});

describe('detectTripleBottoms', () => {
  describe('valid patterns', () => {
    it('should detect triple bottom with three troughs at same level', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        const isTrough = i === 5 || i === 15 || i === 25;
        const low = isTrough ? 90 : 105;
        const high = isTrough ? 105 : 110;
        candles.push(
          createCandle(now + i * 60000, 100, high, low, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 90, 'low', now),
        createPivot(20, 110, 'high', now),
        createPivot(25, 90, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('triple-bottom');
      expect(patterns[0].confidence).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should detect triple bottom within ±8% tolerance', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 105, 110, 90, 105, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 93, 'low', now),
        createPivot(20, 110, 'high', now),
        createPivot(25, 97, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('triple-bottom');
    });

    it('should require minimum 3 troughs', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 90, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should calculate confidence based on trough alignment', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 90, 'low', now),
        createPivot(20, 110, 'high', now),
        createPivot(25, 90, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeGreaterThan(0.5);
    });

    it('should include neckline and troughs in pattern data', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 90, 'low', now),
        createPivot(20, 110, 'high', now),
        createPivot(25, 90, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].peak1).toBeDefined();
      expect(patterns[0].peak2).toBeDefined();
      expect(patterns[0].peak3).toBeDefined();
      expect(patterns[0].neckline).toBeDefined();
      expect(patterns[0].neckline.length).toBe(2);
    });
  });

  describe('rejection cases', () => {
    it('should reject when null candles', () => {
      const patterns = detectTripleBottoms(null as unknown as Candle[], []);
      expect(patterns).toEqual([]);
    });

    it('should reject when undefined candles', () => {
      const patterns = detectTripleBottoms(
        undefined as unknown as Candle[],
        []
      );
      expect(patterns).toEqual([]);
    });

    it('should reject when empty candles', () => {
      const patterns = detectTripleBottoms([], []);
      expect(patterns).toEqual([]);
    });

    it('should reject when insufficient candles', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const patterns = detectTripleBottoms(candles, []);

      expect(patterns).toEqual([]);
    });

    it('should reject troughs outside ±8% tolerance', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 105, 110, 80, 105, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', now),
        createPivot(10, 110, 'high', now),
        createPivot(15, 80, 'low', now),
        createPivot(20, 110, 'high', now),
        createPivot(25, 95, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject when insufficient high pivots between troughs', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(15, 90, 'low', now),
        createPivot(25, 90, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBe(0);
    });
  });

  describe('sorting and limits', () => {
    it('should sort patterns by confidence descending', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 100; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 90, 'low', now),
        createPivot(15, 110, 'high', now),
        createPivot(30, 90, 'low', now),
        createPivot(35, 110, 'high', now),
        createPivot(50, 90, 'low', now),
        createPivot(60, 92, 'low', now),
        createPivot(65, 110, 'high', now),
        createPivot(80, 92, 'low', now),
        createPivot(85, 110, 'high', now),
        createPivot(95, 92, 'low', now),
      ];

      const patterns = detectTripleBottoms(candles, pivots);

      if (patterns.length > 1) {
        for (let i = 1; i < patterns.length; i++) {
          expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(
            patterns[i].confidence
          );
        }
      }
    });

    it('should respect MAX_PATTERNS_PER_TYPE limit', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 200; i++) {
        candles.push(
          createCandle(now + i * 60000, 100, 110, 90, 100, 1000)
        );
      }

      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 50; i++) {
        pivots.push(createPivot(i * 4, 90, 'low', now));
        pivots.push(createPivot(i * 4 + 2, 110, 'high', now));
      }

      const patterns = detectTripleBottoms(candles, pivots);

      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });
});
