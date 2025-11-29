import { describe, it, expect } from 'vitest';
import type { Candle, PivotPoint } from '@shared/types';
import {
  findPivotPoints,
  detectSupportResistance,
  isNearLevel,
  findBreakouts,
  findRecentSwingLow,
  findRecentSwingHigh,
  findLowestSwingLow,
  findHighestSwingHigh,
} from './supportResistance';

const createCandle = (
  close: number,
  high?: number,
  low?: number,
  volume = 1000,
  timestamp = Date.now(),
): Candle => ({
  timestamp,
  open: close,
  high: high ?? close,
  low: low ?? close,
  close,
  volume,
});

describe('findPivotPoints', () => {
  it('should return empty array for insufficient data', () => {
    const candles = [createCandle(100), createCandle(101)];
    expect(findPivotPoints(candles, 5)).toEqual([]);
  });

  it('should detect pivot highs', () => {
    const candles = [
      createCandle(100, 100, 100),
      createCandle(101, 101, 101),
      createCandle(102, 102, 102),
      createCandle(105, 105, 105),
      createCandle(103, 103, 103),
      createCandle(102, 102, 102),
      createCandle(101, 101, 101),
    ];

    const pivots = findPivotPoints(candles, 2);
    const highs = pivots.filter((p) => p.type === 'high');

    expect(highs.length).toBeGreaterThan(0);
    expect(highs.some((p) => p.price === 105)).toBe(true);
  });

  it('should detect pivot lows', () => {
    const candles = [
      createCandle(100, 100, 100),
      createCandle(99, 99, 99),
      createCandle(98, 98, 98),
      createCandle(95, 95, 95),
      createCandle(97, 97, 97),
      createCandle(98, 98, 98),
      createCandle(99, 99, 99),
    ];

    const pivots = findPivotPoints(candles, 2);
    const lows = pivots.filter((p) => p.type === 'low');

    expect(lows.length).toBeGreaterThan(0);
    expect(lows.some((p) => p.price === 95)).toBe(true);
  });

  it('should respect lookback period', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + Math.sin(i) * 10, 100 + Math.sin(i) * 10 + 2, 100 + Math.sin(i) * 10 - 2),
    );

    const pivots3 = findPivotPoints(candles, 3);
    const pivots5 = findPivotPoints(candles, 5);

    expect(pivots3.length).toBeGreaterThanOrEqual(pivots5.length);
  });
});

describe('detectSupportResistance', () => {
  it('should return empty array for no pivots', () => {
    const levels = detectSupportResistance([]);

    expect(levels).toEqual([]);
  });

  it('should cluster nearby pivots into levels', () => {
    const pivots: PivotPoint[] = [
      { index: 0, timestamp: Date.now(), price: 100, type: 'high' },
      { index: 5, timestamp: Date.now(), price: 100.5, type: 'high' },
      { index: 10, timestamp: Date.now(), price: 99.8, type: 'high' },
    ];

    const levels = detectSupportResistance(pivots, 0.01);
    expect(levels.length).toBeGreaterThan(0);
  });

  it('should assign correct type to levels', () => {
    const pivots: PivotPoint[] = [
      { index: 0, timestamp: Date.now(), price: 100, type: 'high' },
      { index: 5, timestamp: Date.now(), price: 100.3, type: 'high' },
      { index: 10, timestamp: Date.now(), price: 90, type: 'low' },
      { index: 15, timestamp: Date.now(), price: 90.2, type: 'low' },
    ];

    const levels = detectSupportResistance(pivots, 0.01);

    const resistance = levels.filter((l) => l.type === 'resistance');
    const support = levels.filter((l) => l.type === 'support');

    expect(resistance.length).toBeGreaterThan(0);
    expect(support.length).toBeGreaterThan(0);
  });

  it('should sort by strength', () => {
    const pivots: PivotPoint[] = [
      { index: 0, timestamp: Date.now(), price: 100, type: 'high' },
      { index: 5, timestamp: Date.now(), price: 100.2, type: 'high' },
      { index: 10, timestamp: Date.now(), price: 90, type: 'low' },
      { index: 15, timestamp: Date.now(), price: 90.1, type: 'low' },
      { index: 20, timestamp: Date.now(), price: 90.15, type: 'low' },
    ];

    const levels = detectSupportResistance(pivots, 0.01);

    if (levels.length >= 2) {
      expect(levels[0]!.strength).toBeGreaterThanOrEqual(levels[1]!.strength);
    }
  });
});

describe('isNearLevel', () => {
  it('should return true for prices near level', () => {
    expect(isNearLevel(100, 100.3, 0.005)).toBe(true);
    expect(isNearLevel(100, 99.7, 0.005)).toBe(true);
  });

  it('should return false for prices far from level', () => {
    expect(isNearLevel(100, 102, 0.005)).toBe(false);
    expect(isNearLevel(100, 95, 0.005)).toBe(false);
  });

  it('should respect custom threshold', () => {
    expect(isNearLevel(100, 102, 0.02)).toBe(true);
    expect(isNearLevel(100, 102, 0.01)).toBe(false);
  });
});

describe('findBreakouts', () => {
  it('should return empty array for insufficient data', () => {
    const candles = [createCandle(100)];
    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(candles, levels);
    expect(breakouts).toEqual([]);
  });

  it('should detect resistance breakouts', () => {
    const candles = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createCandle(95 + i * 0.2, 95 + i * 0.2, 95 + i * 0.2, 1000);
      if (i === 20) return createCandle(99, 99, 99, 1000);
      return createCandle(101, 101, 101, 2000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(candles, levels, 1.5);
    expect(breakouts.length).toBeGreaterThan(0);
  });

  it('should detect support breakdowns', () => {
    const candles = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createCandle(105 - i * 0.2, 105 - i * 0.2, 105 - i * 0.2, 1000);
      if (i === 20) return createCandle(101, 101, 101, 1000);
      return createCandle(99, 99, 99, 2000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'support' as const },
    ];

    const breakouts = findBreakouts(candles, levels, 1.5);
    expect(breakouts.length).toBeGreaterThan(0);
  });

  it('should confirm breakouts with volume', () => {
    const candles = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createCandle(95, 95, 95, 1000);
      return createCandle(101, 101, 101, 3000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(candles, levels, 1.5);
    const confirmedBreakouts = breakouts.filter((b) => b.volumeConfirmation);

    expect(confirmedBreakouts.length).toBeGreaterThan(0);
  });
});

describe('findRecentSwingLow', () => {
  it('should return null for insufficient data', () => {
    const candles = [createCandle(100)];
    const result = findRecentSwingLow(candles, 0, 20);
    expect(result).toBeNull();
  });

  it('should find most recent swing low', () => {
    const candles = [
      createCandle(100, 102, 98),
      createCandle(105, 107, 103),
      createCandle(110, 112, 108),
      createCandle(108, 110, 106),
      createCandle(106, 108, 102),
      createCandle(104, 106, 100),
      createCandle(102, 104, 98),
      createCandle(105, 107, 102),
      createCandle(108, 110, 106),
      createCandle(112, 114, 110),
      createCandle(115, 117, 113),
    ];

    const result = findRecentSwingLow(candles, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeLessThan(110);
  });
});

describe('findRecentSwingHigh', () => {
  it('should return null for insufficient data', () => {
    const candles = [createCandle(100)];
    const result = findRecentSwingHigh(candles, 0, 20);
    expect(result).toBeNull();
  });

  it('should find most recent swing high', () => {
    const candles = [
      createCandle(100, 105, 98),
      createCandle(98, 103, 96),
      createCandle(96, 101, 94),
      createCandle(98, 104, 96),
      createCandle(100, 110, 98),
      createCandle(102, 108, 100),
      createCandle(100, 105, 98),
      createCandle(98, 103, 96),
      createCandle(96, 101, 94),
      createCandle(94, 99, 92),
      createCandle(92, 97, 90),
    ];

    const result = findRecentSwingHigh(candles, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeGreaterThan(100);
  });
});

describe('findLowestSwingLow', () => {
  it('should return null for insufficient data', () => {
    const candles = [createCandle(100)];
    const result = findLowestSwingLow(candles, 0, 20);
    expect(result).toBeNull();
  });

  it('should find lowest swing low in range', () => {
    const candles = [
      createCandle(100, 102, 95),
      createCandle(105, 107, 100),
      createCandle(110, 112, 105),
      createCandle(108, 110, 103),
      createCandle(106, 108, 98),
      createCandle(104, 106, 100),
      createCandle(105, 107, 102),
      createCandle(107, 109, 104),
      createCandle(109, 111, 106),
      createCandle(111, 113, 108),
      createCandle(113, 115, 110),
    ];

    const result = findLowestSwingLow(candles, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeLessThan(110);
  });
});

describe('findHighestSwingHigh', () => {
  it('should return null for insufficient data', () => {
    const candles = [createCandle(100)];
    const result = findHighestSwingHigh(candles, 0, 20);
    expect(result).toBeNull();
  });

  it('should find highest swing high in range', () => {
    const candles = [
      createCandle(100, 105, 98),
      createCandle(98, 103, 96),
      createCandle(96, 101, 94),
      createCandle(98, 115, 96),
      createCandle(100, 110, 98),
      createCandle(102, 108, 100),
      createCandle(100, 105, 98),
      createCandle(98, 103, 96),
      createCandle(96, 101, 94),
      createCandle(94, 99, 92),
      createCandle(92, 97, 90),
    ];

    const result = findHighestSwingHigh(candles, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeGreaterThan(100);
  });
});

