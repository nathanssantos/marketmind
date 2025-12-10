import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateCCI } from './cci';

const createMockKline = (high: number, low: number, close: number, index: number): Kline => ({
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

describe('calculateCCI', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(105, 95, 100, 0),
      createMockKline(107, 97, 102, 1),
    ];

    const result = calculateCCI(klines, 20);

    expect(result).toHaveLength(2);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('should return 0 when typical price equals SMA', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(105, 95, 100, i));
    }

    const result = calculateCCI(klines, 20);

    expect(result[result.length - 1]).toBe(0);
  });

  it('should return positive values when price is above SMA', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base + 5, base - 5, base, i));
    }

    const result = calculateCCI(klines, 20);

    expect(result[result.length - 1]).not.toBeNull();
    expect(result[result.length - 1]!).toBeGreaterThan(0);
  });

  it('should return negative values when price is below SMA', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 200 - i;
      klines.push(createMockKline(base + 5, base - 5, base, i));
    }

    const result = calculateCCI(klines, 20);

    expect(result[result.length - 1]).not.toBeNull();
    expect(result[result.length - 1]!).toBeLessThan(0);
  });

  it('should handle default period of 20', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      klines.push(createMockKline(110, 90, 100, i));
    }

    const result = calculateCCI(klines);

    expect(result).toHaveLength(25);
    expect(result[18]).toBeNull();
    expect(result[19]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateCCI([]);

    expect(result).toHaveLength(0);
  });

  it('should handle varying price movements', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100 + Math.sin(i * 0.5) * 20;
      klines.push(createMockKline(base + 5, base - 5, base, i));
    }

    const result = calculateCCI(klines, 20);

    const validValues = result.filter((v) => v !== null);
    expect(validValues.length).toBeGreaterThan(0);
  });

  it('should handle zero mean deviation', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(105, 95, 100, i));
    }

    const result = calculateCCI(klines, 20);

    expect(result[result.length - 1]).toBe(0);
  });
});
