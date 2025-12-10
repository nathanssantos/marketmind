import { describe, it, expect } from 'vitest';
import {
  findSwingHighs,
  findSwingLows,
  calculateLiquidityLevels,
  findNearestLiquidity,
  detectLiquiditySweep,
  clusterLiquidityZones,
  type LiquidityLevel,
} from './liquidityLevels';

describe('Liquidity Levels', () => {
  describe('findSwingHighs', () => {
    it('should find swing highs correctly', () => {
      const highs = [100, 105, 110, 108, 106, 112, 108, 104];
      const swings = findSwingHighs(highs, 2, 2);

      expect(swings.length).toBe(2);
      expect(swings[0]?.price).toBe(110);
      expect(swings[0]?.index).toBe(2);
    });

    it('should respect left and right parameters', () => {
      const highs = [100, 105, 110, 108, 112, 108, 104];
      const swings = findSwingHighs(highs, 1, 1);

      expect(swings.length).toBeGreaterThan(0);
    });

    it('should return empty array for insufficient data', () => {
      const highs = [100, 105];
      const swings = findSwingHighs(highs, 2, 2);

      expect(swings).toEqual([]);
    });

    it('should handle flat data', () => {
      const highs = [100, 100, 100, 100, 100];
      const swings = findSwingHighs(highs, 1, 1);

      expect(swings).toEqual([]);
    });
  });

  describe('findSwingLows', () => {
    it('should find swing lows correctly', () => {
      const lows = [100, 95, 90, 92, 94, 88, 92, 96];
      const swings = findSwingLows(lows, 2, 2);

      expect(swings.length).toBe(2);
      expect(swings[0]?.price).toBe(90);
      expect(swings[0]?.index).toBe(2);
    });

    it('should respect left and right parameters', () => {
      const lows = [100, 95, 90, 92, 88, 92, 96];
      const swings = findSwingLows(lows, 1, 1);

      expect(swings.length).toBeGreaterThan(0);
    });

    it('should return empty array for insufficient data', () => {
      const lows = [100, 95];
      const swings = findSwingLows(lows, 2, 2);

      expect(swings).toEqual([]);
    });
  });

  describe('calculateLiquidityLevels', () => {
    const generateTestData = (length: number) => {
      const highs: number[] = [];
      const lows: number[] = [];
      const closes: number[] = [];

      for (let i = 0; i < length; i++) {
        const base = 100 + Math.sin(i * 0.2) * 10;
        highs.push(base + 2);
        lows.push(base - 2);
        closes.push(base);
      }

      return { highs, lows, closes };
    };

    it('should return empty array for insufficient data', () => {
      const { highs, lows, closes } = generateTestData(10);
      const levels = calculateLiquidityLevels(highs, lows, closes, { lookback: 50 });

      expect(levels).toEqual([]);
    });

    it('should find liquidity levels with sufficient data', () => {
      const { highs, lows, closes } = generateTestData(100);
      const levels = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 1,
      });

      expect(levels.length).toBeGreaterThan(0);
    });

    it('should respect minTouches parameter', () => {
      const { highs, lows, closes } = generateTestData(100);

      const lowThreshold = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 1,
      });

      const highThreshold = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 5,
      });

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });

    it('should sort levels by strength', () => {
      const { highs, lows, closes } = generateTestData(100);
      const levels = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 1,
      });

      for (let i = 1; i < levels.length; i++) {
        expect(levels[i - 1]!.strength).toBeGreaterThanOrEqual(levels[i]!.strength);
      }
    });

    it('should cap strength at 100', () => {
      const { highs, lows, closes } = generateTestData(100);
      const levels = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 1,
      });

      for (const level of levels) {
        expect(level.strength).toBeLessThanOrEqual(100);
      }
    });

    it('should include both support and resistance levels', () => {
      const { highs, lows, closes } = generateTestData(100);
      const levels = calculateLiquidityLevels(highs, lows, closes, {
        lookback: 50,
        minTouches: 1,
      });

      const supports = levels.filter((l) => l.type === 'support');
      const resistances = levels.filter((l) => l.type === 'resistance');

      if (levels.length > 1) {
        expect(supports.length + resistances.length).toBe(levels.length);
      }
    });
  });

  describe('findNearestLiquidity', () => {
    const mockLevels: LiquidityLevel[] = [
      { price: 95, type: 'support', strength: 80, touches: 3, firstIndex: 10, lastIndex: 40 },
      { price: 98, type: 'support', strength: 60, touches: 2, firstIndex: 20, lastIndex: 35 },
      { price: 102, type: 'resistance', strength: 70, touches: 3, firstIndex: 15, lastIndex: 45 },
      { price: 105, type: 'resistance', strength: 50, touches: 2, firstIndex: 5, lastIndex: 30 },
    ];

    it('should find nearest support below current price', () => {
      const result = findNearestLiquidity(100, mockLevels);

      expect(result.support?.price).toBe(98);
    });

    it('should find nearest resistance above current price', () => {
      const result = findNearestLiquidity(100, mockLevels);

      expect(result.resistance?.price).toBe(102);
    });

    it('should return null when no support below', () => {
      const result = findNearestLiquidity(90, mockLevels);

      expect(result.support).toBeNull();
    });

    it('should return null when no resistance above', () => {
      const result = findNearestLiquidity(110, mockLevels);

      expect(result.resistance).toBeNull();
    });

    it('should handle empty levels array', () => {
      const result = findNearestLiquidity(100, []);

      expect(result.support).toBeNull();
      expect(result.resistance).toBeNull();
    });
  });

  describe('detectLiquiditySweep', () => {
    const mockLevels: LiquidityLevel[] = [
      { price: 95, type: 'support', strength: 80, touches: 3, firstIndex: 10, lastIndex: 40 },
      { price: 105, type: 'resistance', strength: 70, touches: 3, firstIndex: 15, lastIndex: 45 },
    ];

    it('should detect bullish sweep of support', () => {
      const highs = [100, 100, 98];
      const lows = [96, 96, 94.8];
      const closes = [97, 95.5, 96];

      const result = detectLiquiditySweep(highs, lows, closes, mockLevels, 2, 0.002);

      expect(result.swept).toBe(true);
      expect(result.direction).toBe('bullish');
      expect(result.level?.type).toBe('support');
    });

    it('should detect bearish sweep of resistance', () => {
      const highs = [104, 104, 105.3];
      const lows = [102, 102, 103];
      const closes = [103, 104, 103.5];

      const result = detectLiquiditySweep(highs, lows, closes, mockLevels, 2, 0.002);

      expect(result.swept).toBe(true);
      expect(result.direction).toBe('bearish');
      expect(result.level?.type).toBe('resistance');
    });

    it('should return no sweep when conditions not met', () => {
      const highs = [100, 101, 102];
      const lows = [98, 99, 100];
      const closes = [99, 100, 101];

      const result = detectLiquiditySweep(highs, lows, closes, mockLevels, 2);

      expect(result.swept).toBe(false);
      expect(result.level).toBeNull();
      expect(result.direction).toBeNull();
    });

    it('should handle index 0', () => {
      const highs = [100];
      const lows = [98];
      const closes = [99];

      const result = detectLiquiditySweep(highs, lows, closes, mockLevels, 0);

      expect(result.swept).toBe(false);
    });

    it('should handle empty levels', () => {
      const highs = [100, 101];
      const lows = [98, 99];
      const closes = [99, 100];

      const result = detectLiquiditySweep(highs, lows, closes, [], 1);

      expect(result.swept).toBe(false);
    });
  });

  describe('clusterLiquidityZones', () => {
    it('should cluster nearby levels into zones', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 80, touches: 3, firstIndex: 10, lastIndex: 40 },
        { price: 100.3, type: 'support', strength: 60, touches: 2, firstIndex: 15, lastIndex: 35 },
        { price: 110, type: 'resistance', strength: 70, touches: 3, firstIndex: 20, lastIndex: 45 },
      ];

      const zones = clusterLiquidityZones(levels, 0.005);

      expect(zones.length).toBe(2);
    });

    it('should merge levels within tolerance', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 50, touches: 2, firstIndex: 10, lastIndex: 30 },
        { price: 100.2, type: 'support', strength: 50, touches: 2, firstIndex: 15, lastIndex: 35 },
        { price: 100.4, type: 'support', strength: 50, touches: 2, firstIndex: 20, lastIndex: 40 },
      ];

      const zones = clusterLiquidityZones(levels, 0.005);

      expect(zones.length).toBe(1);
      expect(zones[0]?.low).toBe(100);
      expect(zones[0]?.high).toBe(100.4);
    });

    it('should sum touches in zones', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 50, touches: 2, firstIndex: 10, lastIndex: 30 },
        { price: 100.2, type: 'support', strength: 50, touches: 3, firstIndex: 15, lastIndex: 35 },
      ];

      const zones = clusterLiquidityZones(levels, 0.005);

      expect(zones[0]?.touches).toBe(5);
    });

    it('should determine zone type by majority', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 50, touches: 2, firstIndex: 10, lastIndex: 30 },
        { price: 100.2, type: 'resistance', strength: 50, touches: 2, firstIndex: 15, lastIndex: 35 },
        { price: 100.4, type: 'resistance', strength: 50, touches: 2, firstIndex: 20, lastIndex: 40 },
      ];

      const zones = clusterLiquidityZones(levels, 0.01);

      expect(zones[0]?.type).toBe('resistance');
    });

    it('should handle empty levels array', () => {
      const zones = clusterLiquidityZones([]);

      expect(zones).toEqual([]);
    });

    it('should sort zones by strength', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 30, touches: 1, firstIndex: 10, lastIndex: 30 },
        { price: 110, type: 'resistance', strength: 80, touches: 4, firstIndex: 20, lastIndex: 50 },
        { price: 105, type: 'support', strength: 50, touches: 2, firstIndex: 15, lastIndex: 40 },
      ];

      const zones = clusterLiquidityZones(levels, 0.005);

      for (let i = 1; i < zones.length; i++) {
        expect(zones[i - 1]!.strength).toBeGreaterThanOrEqual(zones[i]!.strength);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values in arrays', () => {
      const highs = [100, undefined as unknown as number, 105, 103, 108];
      const swings = findSwingHighs(highs, 1, 1);

      expect(swings).toBeDefined();
    });

    it('should handle single element arrays', () => {
      const swings = findSwingHighs([100], 1, 1);
      expect(swings).toEqual([]);
    });

    it('should handle very small tolerance', () => {
      const levels: LiquidityLevel[] = [
        { price: 100, type: 'support', strength: 50, touches: 2, firstIndex: 10, lastIndex: 30 },
        { price: 100.001, type: 'support', strength: 50, touches: 2, firstIndex: 15, lastIndex: 35 },
      ];

      const zones = clusterLiquidityZones(levels, 0.00001);

      expect(zones.length).toBe(2);
    });
  });
});
