import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateKlinger } from './klinger';

const createMockKline = (
  close: number,
  high: number,
  low: number,
  volume: number,
  index: number,
): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: String(volume),
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: String(volume * close),
  trades: 100,
  takerBuyBaseVolume: String(volume / 2),
  takerBuyQuoteVolume: String((volume / 2) * close),
});

describe('calculateKlinger', () => {
  it('should calculate Klinger correctly', () => {
    const klines = Array.from({ length: 70 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, 1000, i),
    );
    const result = calculateKlinger(klines);

    expect(result.kvo).toHaveLength(70);
    expect(result.signal).toHaveLength(70);

    const lastKvo = result.kvo[result.kvo.length - 1];
    expect(lastKvo).not.toBeNull();
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 40 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, 1000, i),
    );
    const result = calculateKlinger(klines);

    expect(result.kvo.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 34, 55, 13', () => {
    const klines = Array.from({ length: 70 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, 1000, i),
    );
    const result = calculateKlinger(klines);

    expect(result.kvo).toHaveLength(70);

    const firstValidIndex = result.kvo.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(55);
  });

  it('should handle empty array', () => {
    const result = calculateKlinger([]);
    expect(result.kvo).toEqual([]);
    expect(result.signal).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 70 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, 1000, i),
    );
    expect(calculateKlinger(klines, 0, 55, 13).kvo).toEqual([]);
    expect(calculateKlinger(klines, 34, 0, 13).kvo).toEqual([]);
    expect(calculateKlinger(klines, 34, 55, 0).kvo).toEqual([]);
  });

  it('should detect bullish/bearish divergence potential', () => {
    const klines: Kline[] = [];

    for (let i = 0; i < 70; i++) {
      const price = 100 + i;
      klines.push(createMockKline(price, price + 2, price - 2, 1000 + i * 100, i));
    }

    const result = calculateKlinger(klines);

    const validKvo = result.kvo.filter((v) => v !== null);
    expect(validKvo.length).toBeGreaterThan(0);
  });
});
