import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateDonchian } from './donchian';

const createMockKline = (high: number, low: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String((high + low) / 2),
  high: String(high),
  low: String(low),
  close: String((high + low) / 2),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateDonchian', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(105, 95, 0),
      createMockKline(107, 97, 1),
    ];

    const result = calculateDonchian(klines, 20);

    expect(result.upper).toHaveLength(2);
    expect(result.middle).toHaveLength(2);
    expect(result.lower).toHaveLength(2);
    expect(result.upper.every((v) => v === null)).toBe(true);
  });

  it('should calculate correct upper and lower bands', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(110 + i, 90 - i, i));
    }

    const result = calculateDonchian(klines, 20);

    expect(result.upper[19]).toBe(129);
    expect(result.lower[19]).toBe(71);
    expect(result.middle[19]).toBe(100);
  });

  it('should calculate middle as average of upper and lower', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(120, 80, i));
    }

    const result = calculateDonchian(klines, 20);

    expect(result.upper[19]).toBe(120);
    expect(result.lower[19]).toBe(80);
    expect(result.middle[19]).toBe(100);
  });

  it('should handle constant prices', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(100, 100, i));
    }

    const result = calculateDonchian(klines, 20);

    expect(result.upper[19]).toBe(100);
    expect(result.lower[19]).toBe(100);
    expect(result.middle[19]).toBe(100);
  });

  it('should handle default period of 20', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      klines.push(createMockKline(110, 90, i));
    }

    const result = calculateDonchian(klines);

    expect(result.upper).toHaveLength(25);
    expect(result.upper[18]).toBeNull();
    expect(result.upper[19]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateDonchian([]);

    expect(result.upper).toHaveLength(0);
    expect(result.middle).toHaveLength(0);
    expect(result.lower).toHaveLength(0);
  });

  it('should update bands as new highs/lows occur', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      if (i < 20) {
        klines.push(createMockKline(110, 90, i));
      } else {
        klines.push(createMockKline(130, 70, i));
      }
    }

    const result = calculateDonchian(klines, 20);

    expect(result.upper[19]).toBe(110);
    expect(result.lower[19]).toBe(90);

    expect(result.upper[24]).toBe(130);
    expect(result.lower[24]).toBe(70);
  });

  it('should use lookback window for calculations', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      klines.push(createMockKline(100 + i, 90 - i, i));
    }

    const result = calculateDonchian(klines, 10);

    expect(result.upper[19]).toBe(119);
    expect(result.lower[19]).toBe(71);

    expect(result.upper[24]).toBe(124);
    expect(result.lower[24]).toBe(66);
  });
});
