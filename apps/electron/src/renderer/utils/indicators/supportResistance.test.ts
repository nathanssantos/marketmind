import type { PivotPoint } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    detectSupportResistance,
    findBreakouts,
    findHighestSwingHigh,
    findLowestSwingLow,
    findPivotPoints,
    findRecentSwingHigh,
    findRecentSwingLow,
    isNearLevel,
} from './supportResistance';

const createKline = (
  close: number,
  high?: number,
  low?: number,
  volume = 1000,
  timestamp = Date.now(),
): Kline => ({
  timestamp,
  open: close,
  high: high ?? close,
  low: low ?? close,
  close,
  volume,
});

describe('findPivotPoints', () => {
  it('should return empty array for insufficient data', () => {
    const klines = [createKline(100), createKline(101)];
    expect(findPivotPoints(klines, 5)).toEqual([]);
  });

  it('should detect pivot highs', () => {
    const klines = [
      createKline(100, 100, 100),
      createKline(101, 101, 101),
      createKline(102, 102, 102),
      createKline(105, 105, 105),
      createKline(103, 103, 103),
      createKline(102, 102, 102),
      createKline(101, 101, 101),
    ];

    const pivots = findPivotPoints(klines, 2);
    const highs = pivots.filter((p) => p.type === 'high');

    expect(highs.length).toBeGreaterThan(0);
    expect(highs.some((p) => p.price === 105)).toBe(true);
  });

  it('should detect pivot lows', () => {
    const klines = [
      createKline(100, 100, 100),
      createKline(99, 99, 99),
      createKline(98, 98, 98),
      createKline(95, 95, 95),
      createKline(97, 97, 97),
      createKline(98, 98, 98),
      createKline(99, 99, 99),
    ];

    const pivots = findPivotPoints(klines, 2);
    const lows = pivots.filter((p) => p.type === 'low');

    expect(lows.length).toBeGreaterThan(0);
    expect(lows.some((p) => p.price === 95)).toBe(true);
  });

  it('should respect lookback period', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createKline(100 + Math.sin(i) * 10, 100 + Math.sin(i) * 10 + 2, 100 + Math.sin(i) * 10 - 2),
    );

    const pivots3 = findPivotPoints(klines, 3);
    const pivots5 = findPivotPoints(klines, 5);

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
      { index: 0, openTime: Date.now(), price: 100, type: 'high' },
      { index: 5, openTime: Date.now(), price: 100.5, type: 'high' },
      { index: 10, openTime: Date.now(), price: 99.8, type: 'high' },
    ];

    const levels = detectSupportResistance(pivots, 0.01);
    expect(levels.length).toBeGreaterThan(0);
  });

  it('should assign correct type to levels', () => {
    const pivots: PivotPoint[] = [
      { index: 0, openTime: Date.now(), price: 100, type: 'high' },
      { index: 5, openTime: Date.now(), price: 100.3, type: 'high' },
      { index: 10, openTime: Date.now(), price: 90, type: 'low' },
      { index: 15, openTime: Date.now(), price: 90.2, type: 'low' },
    ];

    const levels = detectSupportResistance(pivots, 0.01);

    const resistance = levels.filter((l) => l.type === 'resistance');
    const support = levels.filter((l) => l.type === 'support');

    expect(resistance.length).toBeGreaterThan(0);
    expect(support.length).toBeGreaterThan(0);
  });

  it('should sort by strength', () => {
    const pivots: PivotPoint[] = [
      { index: 0, openTime: Date.now(), price: 100, type: 'high' },
      { index: 5, openTime: Date.now(), price: 100.2, type: 'high' },
      { index: 10, openTime: Date.now(), price: 90, type: 'low' },
      { index: 15, openTime: Date.now(), price: 90.1, type: 'low' },
      { index: 20, openTime: Date.now(), price: 90.15, type: 'low' },
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
    const klines = [createKline(100)];
    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(klines, levels);
    expect(breakouts).toEqual([]);
  });

  it('should detect resistance breakouts', () => {
    const klines = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createKline(95 + i * 0.2, 95 + i * 0.2, 95 + i * 0.2, 1000);
      if (i === 20) return createKline(99, 99, 99, 1000);
      return createKline(101, 101, 101, 2000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(klines, levels, 1.5);
    expect(breakouts.length).toBeGreaterThan(0);
  });

  it('should detect support breakdowns', () => {
    const klines = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createKline(105 - i * 0.2, 105 - i * 0.2, 105 - i * 0.2, 1000);
      if (i === 20) return createKline(101, 101, 101, 1000);
      return createKline(99, 99, 99, 2000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'support' as const },
    ];

    const breakouts = findBreakouts(klines, levels, 1.5);
    expect(breakouts.length).toBeGreaterThan(0);
  });

  it('should confirm breakouts with volume', () => {
    const klines = Array.from({ length: 25 }, (_, i) => {
      if (i < 20) return createKline(95, 95, 95, 1000);
      return createKline(101, 101, 101, 3000);
    });

    const levels = [
      { price: 100, strength: 2, touches: [0, 1], type: 'resistance' as const },
    ];

    const breakouts = findBreakouts(klines, levels, 1.5);
    const confirmedBreakouts = breakouts.filter((b) => b.volumeConfirmation);

    expect(confirmedBreakouts.length).toBeGreaterThan(0);
  });
});

describe('findRecentSwingLow', () => {
  it('should return fallback value for single kline', () => {
    const klines = [createKline(100)];
    const result = findRecentSwingLow(klines, 0, 20);
    expect(result).toBe(100);
  });

  it('should find most recent swing low', () => {
    const klines = [
      createKline(100, 102, 98),
      createKline(105, 107, 103),
      createKline(110, 112, 108),
      createKline(108, 110, 106),
      createKline(106, 108, 102),
      createKline(104, 106, 100),
      createKline(102, 104, 98),
      createKline(105, 107, 102),
      createKline(108, 110, 106),
      createKline(112, 114, 110),
      createKline(115, 117, 113),
    ];

    const result = findRecentSwingLow(klines, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeLessThan(110);
  });
});

describe('findRecentSwingHigh', () => {
  it('should return fallback value for single kline', () => {
    const klines = [createKline(100)];
    const result = findRecentSwingHigh(klines, 0, 20);
    expect(result).toBe(100);
  });

  it('should find most recent swing high', () => {
    const klines = [
      createKline(100, 105, 98),
      createKline(98, 103, 96),
      createKline(96, 101, 94),
      createKline(98, 104, 96),
      createKline(100, 110, 98),
      createKline(102, 108, 100),
      createKline(100, 105, 98),
      createKline(98, 103, 96),
      createKline(96, 101, 94),
      createKline(94, 99, 92),
      createKline(92, 97, 90),
    ];

    const result = findRecentSwingHigh(klines, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeGreaterThan(100);
  });
});

describe('findLowestSwingLow', () => {
  it('should return null for empty klines', () => {
    const result = findLowestSwingLow([], 0, 20);
    expect(result).toBeNull();
  });

  it('should find lowest swing low in range', () => {
    const klines = [
      createKline(120, 122, 118),
      createKline(118, 120, 116),
      createKline(116, 118, 90),
      createKline(118, 120, 116),
      createKline(120, 122, 118),
      createKline(122, 124, 120),
      createKline(120, 122, 118),
      createKline(118, 120, 100),
      createKline(120, 122, 118),
      createKline(122, 124, 120),
      createKline(124, 126, 122),
    ];

    const result = findLowestSwingLow(klines, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeLessThan(110);
  });
});

describe('findHighestSwingHigh', () => {
  it('should return null for empty klines', () => {
    const result = findHighestSwingHigh([], 0, 20);
    expect(result).toBeNull();
  });

  it('should find highest swing high in range', () => {
    const klines = [
      createKline(90, 92, 88),
      createKline(92, 94, 90),
      createKline(94, 120, 92),
      createKline(92, 94, 90),
      createKline(90, 92, 88),
      createKline(88, 90, 86),
      createKline(90, 92, 88),
      createKline(92, 105, 90),
      createKline(90, 92, 88),
      createKline(88, 90, 86),
      createKline(86, 88, 84),
    ];

    const result = findHighestSwingHigh(klines, 10, 10, 2);
    expect(result).toBeTruthy();
    if (result) expect(result).toBeGreaterThan(100);
  });
});

