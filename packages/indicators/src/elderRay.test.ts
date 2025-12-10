import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateElderRay } from './elderRay';

const createMockKline = (
  close: number,
  high: number,
  low: number,
  index: number,
): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateElderRay', () => {
  it('should calculate Elder Ray correctly for uptrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i * 2, 102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateElderRay(klines);

    expect(result.bullPower).toHaveLength(25);
    expect(result.bearPower).toHaveLength(25);

    const lastBull = result.bullPower[result.bullPower.length - 1];
    expect(lastBull).not.toBeNull();
    expect(lastBull).toBeGreaterThan(0);
  });

  it('should calculate Elder Ray correctly for downtrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(200 - i * 2, 202 - i * 2, 198 - i * 2, i),
    );
    const result = calculateElderRay(klines);

    const lastBear = result.bearPower[result.bearPower.length - 1];
    expect(lastBear).not.toBeNull();
    expect(lastBear).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateElderRay(klines);

    expect(result.bullPower.every((v) => v === null)).toBe(true);
    expect(result.bearPower.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 13', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateElderRay(klines);

    expect(result.bullPower).toHaveLength(25);

    const firstValidIndex = result.bullPower.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(12);
  });

  it('should handle empty array', () => {
    const result = calculateElderRay([]);
    expect(result.bullPower).toEqual([]);
    expect(result.bearPower).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    expect(calculateElderRay(klines, 0).bullPower).toEqual([]);
    expect(calculateElderRay(klines, -1).bullPower).toEqual([]);
  });

  it('should have bull power > bear power in uptrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i * 2, 102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateElderRay(klines);

    for (let i = 0; i < result.bullPower.length; i++) {
      const bull = result.bullPower[i];
      const bear = result.bearPower[i];
      if (bull !== null && bull !== undefined && bear !== null && bear !== undefined) {
        expect(bull).toBeGreaterThan(bear);
      }
    }
  });

  it('should work with custom period', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateElderRay(klines, 5);

    const firstValidIndex = result.bullPower.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(4);
  });
});
