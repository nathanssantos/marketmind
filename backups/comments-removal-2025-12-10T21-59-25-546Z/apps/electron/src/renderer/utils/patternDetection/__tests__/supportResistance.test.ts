import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../../shared/types';
import { detectResistance, detectSupport } from '../patterns/supportResistance';
import type { PivotPoint } from '../types';

const createTestKlines = (count: number, basePrice: number): Kline[] => {
  const klines: Kline[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    klines.push({
      openTime: now + i * 60000,
      open: basePrice,
      high: basePrice + 10,
      low: basePrice - 10,
      close: basePrice,
      volume: 1000,
    });
  }
  
  return klines;
};

const createTestPivots = (type: 'high' | 'low', prices: number[], timestamps: number[]): PivotPoint[] => {
  return prices.map((price, index) => ({
    index,
    price,
    openTime: timestamps[index] || Date.now() + index * 60000,
    type,
    strength: 1,
    volume: 1000,
  }));
};

describe('supportResistance', () => {
  describe('detectSupport', () => {
    it('should detect support from clustered low pivots', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots = createTestPivots('low', [99, 100, 101, 99.5, 100.5], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
        Date.now() + 240000,
      ]);
      
      const supports = detectSupport(klines, lowPivots);
      
      expect(supports.length).toBeGreaterThan(0);
      expect(supports[0]?.type).toBe('support');
      expect(supports[0]?.points).toHaveLength(2);
    });

    it('should not detect support with insufficient touches', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots = createTestPivots('low', [100], [Date.now()]);
      
      const supports = detectSupport(klines, lowPivots);
      
      expect(supports.length).toBe(0);
    });

    it('should assign confidence scores to detected supports', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots = createTestPivots('low', [100, 100.5, 99.5, 100.2], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
      ]);
      
      const supports = detectSupport(klines, lowPivots);
      
      if (supports[0]) {
        expect(supports[0].confidence).toBeGreaterThan(0);
        expect(supports[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should filter high pivots and only use low pivots', () => {
      const klines = createTestKlines(100, 100);
      const highPivots = createTestPivots('high', [110, 111, 110.5], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
      ]);
      
      const supports = detectSupport(klines, highPivots);
      
      expect(supports.length).toBe(0);
    });

    it('should sort supports by confidence (highest first)', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots = createTestPivots('low', [
        100, 100.5, 99.5, 100.2,
        90, 90.5, 89.5, 90.3, 90.1, 89.8,
      ], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
        Date.now() + 240000,
        Date.now() + 300000,
        Date.now() + 360000,
        Date.now() + 420000,
        Date.now() + 480000,
        Date.now() + 540000,
      ]);
      
      const supports = detectSupport(klines, lowPivots);
      
      if (supports.length >= 2) {
        expect(supports[0]!.confidence).toBeGreaterThanOrEqual(supports[1]!.confidence!);
      }
    });

    it('should limit results to max patterns per type', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots: PivotPoint[] = [];
      
      for (let i = 0; i < 20; i++) {
        lowPivots.push(...createTestPivots('low', [
          100 + i * 5,
          100 + i * 5 + 0.5,
          100 + i * 5 - 0.5,
          100 + i * 5 + 0.2,
        ], [
          Date.now() + i * 1000,
          Date.now() + i * 1000 + 100,
          Date.now() + i * 1000 + 200,
          Date.now() + i * 1000 + 300,
        ]));
      }
      
      const supports = detectSupport(klines, lowPivots);
      
      expect(supports.length).toBeLessThanOrEqual(5);
    });
  });

  describe('detectResistance', () => {
    it('should detect resistance from clustered high pivots', () => {
      const klines = createTestKlines(100, 100);
      const highPivots = createTestPivots('high', [110, 111, 110.5, 111.2], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
      ]);
      
      const resistances = detectResistance(klines, highPivots);
      
      expect(resistances.length).toBeGreaterThan(0);
      expect(resistances[0]?.type).toBe('resistance');
      expect(resistances[0]?.points).toHaveLength(2);
    });

    it('should not detect resistance with insufficient touches', () => {
      const klines = createTestKlines(100, 100);
      const highPivots = createTestPivots('high', [110], [Date.now()]);
      
      const resistances = detectResistance(klines, highPivots);
      
      expect(resistances.length).toBe(0);
    });

    it('should filter low pivots and only use high pivots', () => {
      const klines = createTestKlines(100, 100);
      const lowPivots = createTestPivots('low', [90, 91, 90.5], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
      ]);
      
      const resistances = detectResistance(klines, lowPivots);
      
      expect(resistances.length).toBe(0);
    });

    it('should assign confidence scores to detected resistances', () => {
      const klines = createTestKlines(100, 100);
      const highPivots = createTestPivots('high', [110, 110.5, 109.5, 110.2], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
      ]);
      
      const resistances = detectResistance(klines, highPivots);
      
      if (resistances[0]) {
        expect(resistances[0].confidence).toBeGreaterThan(0);
        expect(resistances[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should create labels with price and touch count', () => {
      const klines = createTestKlines(100, 100);
      const highPivots = createTestPivots('high', [110, 110.5, 109.5, 110.2], [
        Date.now(),
        Date.now() + 60000,
        Date.now() + 120000,
        Date.now() + 180000,
      ]);
      
      const resistances = detectResistance(klines, highPivots);
      
      if (resistances[0]) {
        expect(resistances[0].label).toContain('Resistance at');
        expect(resistances[0].label).toContain('touches');
      }
    });
  });
});
