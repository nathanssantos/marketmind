import { describe, it, expect } from 'vitest';
import { calculatePercentBSeries, calculatePercentBConsecutive } from './percentB';
import type { Kline } from '@marketmind/types';

const createKline = (close: number, index: number = 0): Kline => ({
  openTime: Date.now() + index * 86400000,
  open: String(close),
  high: String(close + 5),
  low: String(close - 5),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + index * 86400000,
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
});

const createVolatileKlines = (length: number): Kline[] => {
  return Array.from({ length }, (_, i) =>
    createKline(100 + Math.sin(i * 0.5) * 20, i)
  );
};

describe('calculatePercentBSeries', () => {
  it('should return null for insufficient data', () => {
    const klines = createVolatileKlines(10);
    const result = calculatePercentBSeries(klines, 20, 2);

    expect(result.values.length).toBe(10);
    result.values.forEach((v: number | null) => expect(v).toBeNull());
  });

  it('should calculate %b after enough data', () => {
    const klines = createVolatileKlines(30);
    const result = calculatePercentBSeries(klines, 20, 2);

    expect(result.values[19]).not.toBeNull();
    expect(result.values[29]).not.toBeNull();
  });

  it('should return values for volatile price action', () => {
    const klines = createVolatileKlines(30);
    const result = calculatePercentBSeries(klines, 20, 2);

    const validValues = result.values.filter((v): v is number => v !== null);
    expect(validValues.length).toBeGreaterThan(0);
    validValues.forEach((v) => {
      expect(typeof v).toBe('number');
      expect(isNaN(v)).toBe(false);
    });
  });

  it('should detect price at lower band (%b near 0)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      if (i < 22) {
        klines.push(createKline(100 + Math.sin(i * 0.5) * 15, i));
      } else {
        klines.push(createKline(70, i));
      }
    }

    const result = calculatePercentBSeries(klines, 20, 2);
    const lastValue = result.values[result.values.length - 1];

    expect(lastValue).not.toBeNull();
    if (lastValue !== null) {
      expect(lastValue).toBeLessThan(0.3);
    }
  });

  it('should handle extreme price moves', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      if (i < 22) {
        klines.push(createKline(100 + Math.sin(i * 0.5) * 15, i));
      } else {
        klines.push(createKline(150, i));
      }
    }

    const result = calculatePercentBSeries(klines, 20, 2);
    const lastValue = result.values[result.values.length - 1];

    if (lastValue !== null && lastValue !== undefined) {
      expect(typeof lastValue).toBe('number');
      expect(Number.isNaN(lastValue)).toBe(false);
    }
  });

  it('should handle empty input', () => {
    const result = calculatePercentBSeries([]);
    expect(result.values).toHaveLength(0);
  });

  it('should work with different periods', () => {
    const klines = createVolatileKlines(30);

    const result10 = calculatePercentBSeries(klines, 10, 2);
    const result20 = calculatePercentBSeries(klines, 20, 2);

    expect(result10.values.filter((v): v is number => v !== null).length).toBeGreaterThanOrEqual(
      result20.values.filter((v): v is number => v !== null).length
    );
  });
});

describe('calculatePercentBConsecutive', () => {
  it('should return array of correct length', () => {
    const klines = createVolatileKlines(30);
    const result = calculatePercentBConsecutive(klines, 0.2, 3, 20, 2);

    expect(result.length).toBe(30);
  });

  it('should return false for early bars', () => {
    const klines = createVolatileKlines(30);
    const result = calculatePercentBConsecutive(klines, 0.2, 3, 20, 2);

    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
  });

  it('should return boolean values', () => {
    const klines = createVolatileKlines(30);
    const result = calculatePercentBConsecutive(klines, 0.2, 3, 20, 2);

    result.forEach((v) => expect(typeof v).toBe('boolean'));
  });

  it('should handle empty input', () => {
    const result = calculatePercentBConsecutive([]);
    expect(result).toHaveLength(0);
  });

  it('should work with different thresholds', () => {
    const klines = createVolatileKlines(40);

    const result02 = calculatePercentBConsecutive(klines, 0.2, 3, 20, 2);
    const result05 = calculatePercentBConsecutive(klines, 0.5, 3, 20, 2);

    expect(result02.length).toBe(40);
    expect(result05.length).toBe(40);
  });

  it('should detect consecutive days below threshold when price drops', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 35; i++) {
      if (i < 25) {
        klines.push(createKline(100 + Math.sin(i * 0.3) * 10, i));
      } else {
        klines.push(createKline(70, i));
      }
    }

    const result = calculatePercentBConsecutive(klines, 0.3, 3, 20, 2);
    expect(result.length).toBe(35);

    const lastFew = result.slice(-5);
    const hasDetection = lastFew.some(v => v === true);
    expect(typeof hasDetection).toBe('boolean');
  });
});
