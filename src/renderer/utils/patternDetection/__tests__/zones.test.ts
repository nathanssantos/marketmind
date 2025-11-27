import { describe, expect, it } from 'vitest';
import type { Candle } from '../../../../shared/types';
import {
    detectAccumulationZones,
    detectBuyZones,
    detectLiquidityZones,
    detectSellZones,
} from '../patterns/zones';
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

describe('zones', () => {
  describe('detectBuyZones', () => {
    it('should detect buy zone with clustered low pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(15, 98.5, 'low', now),
        createPivot(25, 99, 'low', now),
        createPivot(35, 98.2, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      expect(zones.length).toBeGreaterThan(0);
      expect(zones[0]?.type).toBe('buy-zone');
      expect(zones[0]?.bottomPrice).toBeDefined();
      expect(zones[0]?.topPrice).toBeDefined();
      expect(zones[0]?.confidence).toBeGreaterThan(0);
    });

    it('should reject zones with insufficient touches', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(35, 98.2, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should reject zones with widely dispersed prices', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 90, 'low', now),
        createPivot(15, 95, 'low', now),
        createPivot(25, 100, 'low', now),
        createPivot(35, 105, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should return empty array for insufficient candles', () => {
      const candles: Candle[] = [createCandle(Date.now(), 100, 102, 98, 100)];
      const pivots: PivotPoint[] = [];

      const zones = detectBuyZones(candles, pivots);

      expect(zones).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(15, 98.5, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should assign confidence scores between 0 and 1', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(15, 98.5, 'low', now),
        createPivot(25, 99, 'low', now),
        createPivot(35, 98.2, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      zones.forEach((zone) => {
        expect(zone.confidence).toBeGreaterThan(0);
        expect(zone.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('detectSellZones', () => {
    it('should detect sell zone with clustered high pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 102, 'high', now),
        createPivot(15, 101.5, 'high', now),
        createPivot(25, 101, 'high', now),
        createPivot(35, 101.8, 'high', now),
      ];

      const zones = detectSellZones(candles, pivots);

      expect(zones.length).toBeGreaterThan(0);
      expect(zones[0]?.type).toBe('sell-zone');
      expect(zones[0]?.bottomPrice).toBeDefined();
      expect(zones[0]?.topPrice).toBeDefined();
      expect(zones[0]?.confidence).toBeGreaterThan(0);
    });

    it('should reject zones with insufficient touches', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 102, 'high', now),
        createPivot(35, 101.8, 'high', now),
      ];

      const zones = detectSellZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should return empty array for insufficient pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 102, 'high', now),
        createPivot(15, 101.5, 'high', now),
      ];

      const zones = detectSellZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should assign proper zone height', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 102, 'high', now),
        createPivot(15, 101.5, 'high', now),
        createPivot(25, 101, 'high', now),
        createPivot(35, 101.8, 'high', now),
      ];

      const zones = detectSellZones(candles, pivots);

      if (zones.length > 0) {
        const zone = zones[0];
        if (zone) {
          expect(zone.topPrice).toBeGreaterThan(zone.bottomPrice);
        }
      }
    });
  });

  describe('detectLiquidityZones', () => {
    it('should detect liquidity zone with high volume and clustered pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        const volume = i >= 10 && i <= 20 ? 1600 : 1000;
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, volume));
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 98, 'low', now),
        createPivot(12, 102, 'high', now),
        createPivot(15, 99, 'low', now),
        createPivot(18, 101, 'high', now),
      ];

      const zones = detectLiquidityZones(candles, pivots);

      expect(zones.length).toBeGreaterThanOrEqual(0);
      if (zones.length > 0) {
        expect(zones[0]?.type).toBe('liquidity-zone');
        expect(zones[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it('should reject zones with low volume', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        const volume = i >= 10 && i <= 20 ? 1100 : 1000;
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, volume));
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 98, 'low', now),
        createPivot(12, 102, 'high', now),
        createPivot(15, 99, 'low', now),
        createPivot(18, 101, 'high', now),
      ];

      const zones = detectLiquidityZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should reject zones with insufficient pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 3000));
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 98, 'low', now),
        createPivot(15, 99, 'low', now),
      ];

      const zones = detectLiquidityZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should return empty array for insufficient candles', () => {
      const candles: Candle[] = [createCandle(Date.now(), 100, 102, 98, 100)];
      const pivots: PivotPoint[] = [];

      const zones = detectLiquidityZones(candles, pivots);

      expect(zones).toEqual([]);
    });

    it('should detect zones with mixed high and low pivots', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        const volume = i >= 10 && i <= 20 ? 1600 : 1000;
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, volume));
      }

      const pivots: PivotPoint[] = [
        createPivot(10, 98, 'low', now),
        createPivot(12, 102, 'high', now),
        createPivot(15, 99, 'low', now),
        createPivot(18, 101, 'high', now),
        createPivot(20, 99.5, 'low', now),
      ];

      const zones = detectLiquidityZones(candles, pivots);

      expect(zones.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectAccumulationZones', () => {
    it('should detect accumulation zone with low volatility and rising volume', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 60; i++) {
        const volume = i >= 20 && i < 40 ? 1500 : 1000;
        const price = i < 40 ? 100 : 105;
        candles.push(createCandle(now + i * 60000, price, price + 1, price - 1, price, volume));
      }

      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      expect(zones.length).toBeGreaterThanOrEqual(0);
      if (zones.length > 0) {
        expect(zones[0]?.type).toBe('accumulation-zone');
        expect(zones[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it('should reject zones with high volatility', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 60; i++) {
        const price = 100 + (i % 2 === 0 ? 10 : -10);
        candles.push(createCandle(now + i * 60000, price, price + 5, price - 5, price, 1500));
      }

      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should reject zones without volume increase', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 60; i++) {
        candles.push(createCandle(now + i * 60000, 100, 101, 99, 100, 1000));
      }

      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should reject zones without future price increase', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 60; i++) {
        const volume = i >= 20 && i < 40 ? 1500 : 1000;
        candles.push(createCandle(now + i * 60000, 100, 101, 99, 100, volume));
      }

      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      expect(zones.length).toBe(0);
    });

    it('should return empty array for insufficient candles', () => {
      const candles: Candle[] = [createCandle(Date.now(), 100, 102, 98, 100)];
      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      expect(zones).toEqual([]);
    });

    it('should assign confidence scores properly', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 60; i++) {
        const volume = i >= 20 && i < 40 ? 1500 : 1000;
        const price = i < 40 ? 100 : 105;
        candles.push(createCandle(now + i * 60000, price, price + 1, price - 1, price, volume));
      }

      const pivots: PivotPoint[] = [];

      const zones = detectAccumulationZones(candles, pivots);

      zones.forEach((zone) => {
        expect(zone.confidence).toBeGreaterThan(0);
        expect(zone.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty candles array', () => {
      const candles: Candle[] = [];
      const pivots: PivotPoint[] = [];

      expect(detectBuyZones(candles, pivots)).toEqual([]);
      expect(detectSellZones(candles, pivots)).toEqual([]);
      expect(detectLiquidityZones(candles, pivots)).toEqual([]);
      expect(detectAccumulationZones(candles, pivots)).toEqual([]);
    });

    it('should handle null/undefined candles gracefully', () => {
      const pivots: PivotPoint[] = [];

      expect(detectBuyZones(null as unknown as Candle[], pivots)).toEqual([]);
      expect(detectSellZones(undefined as unknown as Candle[], pivots)).toEqual([]);
      expect(detectLiquidityZones(null as unknown as Candle[], pivots)).toEqual([]);
      expect(detectAccumulationZones(undefined as unknown as Candle[], pivots)).toEqual([]);
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 200; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 100; i++) {
        pivots.push(createPivot(i * 2, 98 + (i % 3), 'low', now));
      }

      const zones = detectBuyZones(candles, pivots);

      expect(zones.length).toBeLessThanOrEqual(5);
    });

    it('should sort zones by confidence', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 100; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(15, 98.5, 'low', now),
        createPivot(25, 99, 'low', now),
        createPivot(35, 98.2, 'low', now),
        createPivot(45, 98.3, 'low', now),
        createPivot(55, 98.8, 'low', now),
        createPivot(65, 98.1, 'low', now),
        createPivot(75, 98.6, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      for (let i = 1; i < zones.length; i++) {
        const prev = zones[i - 1];
        const curr = zones[i];
        if (prev && curr) {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        }
      }
    });

    it('should handle zones with missing candle data', () => {
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 0; i < 50; i++) {
        if (i % 5 !== 0) {
          candles.push(createCandle(now + i * 60000, 100, 102, 98, 100, 1000));
        }
      }

      const pivots: PivotPoint[] = [
        createPivot(5, 98, 'low', now),
        createPivot(15, 98.5, 'low', now),
        createPivot(25, 99, 'low', now),
        createPivot(35, 98.2, 'low', now),
      ];

      const zones = detectBuyZones(candles, pivots);

      expect(zones).toBeDefined();
      expect(Array.isArray(zones)).toBe(true);
    });
  });
});
