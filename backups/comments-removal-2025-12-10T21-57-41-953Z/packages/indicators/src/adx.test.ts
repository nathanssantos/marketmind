import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateADX } from './adx';

const createMockKline = (open: number, high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(open),
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

describe('calculateADX', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(100, 105, 98, 102, 0),
      createMockKline(102, 107, 100, 105, 1),
    ];
    const result = calculateADX(klines, 14);

    expect(result.adx).toHaveLength(2);
    expect(result.plusDI).toHaveLength(2);
    expect(result.minusDI).toHaveLength(2);
    expect(result.adx.every((v) => v === null)).toBe(true);
  });

  it('should calculate ADX for trending market', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i++) {
      const base = 100 + i * 2;
      klines.push(createMockKline(base, base + 3, base - 1, base + 1, i));
    }

    const result = calculateADX(klines, 14);

    expect(result.adx).toHaveLength(30);
    expect(result.plusDI).toHaveLength(30);
    expect(result.minusDI).toHaveLength(30);

    const validADX = result.adx.filter((v) => v !== null);
    expect(validADX.length).toBeGreaterThan(0);

    validADX.forEach((adx) => {
      expect(adx).toBeGreaterThanOrEqual(0);
      expect(adx).toBeLessThanOrEqual(100);
    });
  });

  it('should show higher +DI than -DI in uptrend', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i++) {
      const base = 100 + i * 3;
      klines.push(createMockKline(base, base + 5, base - 1, base + 4, i));
    }

    const result = calculateADX(klines, 14);

    const lastPlusDI = result.plusDI[result.plusDI.length - 1];
    const lastMinusDI = result.minusDI[result.minusDI.length - 1];

    expect(lastPlusDI).not.toBeNull();
    expect(lastMinusDI).not.toBeNull();
    expect(lastPlusDI!).toBeGreaterThan(lastMinusDI!);
  });

  it('should show higher -DI than +DI in downtrend', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i++) {
      const base = 200 - i * 3;
      klines.push(createMockKline(base, base + 1, base - 5, base - 4, i));
    }

    const result = calculateADX(klines, 14);

    const lastPlusDI = result.plusDI[result.plusDI.length - 1];
    const lastMinusDI = result.minusDI[result.minusDI.length - 1];

    expect(lastPlusDI).not.toBeNull();
    expect(lastMinusDI).not.toBeNull();
    expect(lastMinusDI!).toBeGreaterThan(lastPlusDI!);
  });

  it('should handle default period of 14', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base, base + 2, base - 1, base + 1, i));
    }

    const result = calculateADX(klines);

    expect(result.adx).toHaveLength(30);
    const firstValidIndex = result.plusDI.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(14);
  });

  it('should handle empty array', () => {
    const result = calculateADX([]);

    expect(result.adx).toHaveLength(0);
    expect(result.plusDI).toHaveLength(0);
    expect(result.minusDI).toHaveLength(0);
  });
});
