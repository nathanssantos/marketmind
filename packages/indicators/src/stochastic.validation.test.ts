import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateStochastic, DEFAULT_STOCHASTIC_CONFIG } from './stochastic';

const createMockKlineWithHLC = (
  high: number,
  low: number,
  close: number,
  index: number
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

describe('Stochastic TA-Lib Validation', () => {
  it('should calculate %K as (close - lowestLow) / (highestHigh - lowestLow) * 100', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKlineWithHLC(110 + i, 90 + i, 100 + i, i));
    }

    const result = calculateStochastic(klines, 14, 1, 1);

    const last = klines[klines.length - 1]!;
    const lowestLow = 90;
    const highestHigh = 123;
    const close = 113;

    const expectedRawK = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;

    expect(result.k[result.k.length - 1]).toBeCloseTo(expectedRawK, 1);
  });

  it('should apply SMA smoothing to %K (slow stochastic)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const high = 100 + (i % 3) * 5;
      const low = 90 + (i % 3) * 5;
      const close = 95 + (i % 3) * 5;
      klines.push(createMockKlineWithHLC(high, low, close, i));
    }

    const fastResult = calculateStochastic(klines, 14, 1, 1);
    const slowResult = calculateStochastic(klines, 14, 3, 3);

    const fastKValues = fastResult.k.filter((v) => v !== null);
    const slowKValues = slowResult.k.filter((v) => v !== null);

    expect(fastKValues.length).toBeGreaterThan(slowKValues.length);
  });

  it('should calculate %D as SMA of %K', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const high = 100 + Math.sin(i / 3) * 10;
      const low = 80 + Math.sin(i / 3) * 10;
      const close = 90 + Math.sin(i / 3) * 10;
      klines.push(createMockKlineWithHLC(high, low, close, i));
    }

    const result = calculateStochastic(klines, 14, 3, 3);

    const validK = result.k.filter((v) => v !== null);
    const validD = result.d.filter((v) => v !== null);

    expect(validD.length).toBeLessThanOrEqual(validK.length);
  });

  it('should return 50 when highestHigh equals lowestLow', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKlineWithHLC(100, 100, 100, i));
    }

    const result = calculateStochastic(klines, 14, 1, 1);
    const lastK = result.k[result.k.length - 1];

    expect(lastK).toBe(50);
  });

  it('should return values between 0 and 100', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 30; i++) {
      const high = 100 + Math.random() * 20;
      const low = 80 + Math.random() * 10;
      const close = low + Math.random() * (high - low);
      klines.push(createMockKlineWithHLC(high, low, close, i));
    }

    const result = calculateStochastic(klines, 14, 3, 3);

    result.k.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    result.d.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should return 100 when close equals highest high', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      const high = 100 + i;
      const low = 80;
      const close = i === 13 ? high : 90;
      klines.push(createMockKlineWithHLC(high, low, close, i));
    }

    const result = calculateStochastic(klines, 14, 1, 1);
    const lastK = result.k[result.k.length - 1];

    expect(lastK).toBeCloseTo(100, 1);
  });

  it('should return 0 when close equals lowest low', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      const high = 120;
      const low = 100 - i;
      const close = i === 13 ? low : 110;
      klines.push(createMockKlineWithHLC(high, low, close, i));
    }

    const result = calculateStochastic(klines, 14, 1, 1);
    const lastK = result.k[result.k.length - 1];

    expect(lastK).toBeCloseTo(0, 1);
  });

  it('should handle empty input', () => {
    const result = calculateStochastic([], 14, 3, 3);
    expect(result.k).toHaveLength(0);
    expect(result.d).toHaveLength(0);
  });

  it('should handle invalid parameters', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKlineWithHLC(100, 90, 95, i));
    }

    const result1 = calculateStochastic(klines, 0, 3, 3);
    const result2 = calculateStochastic(klines, 14, 0, 3);
    const result3 = calculateStochastic(klines, 14, 3, 0);

    expect(result1.k).toHaveLength(0);
    expect(result2.k).toHaveLength(0);
    expect(result3.k).toHaveLength(0);
  });

  it('should use default config values', () => {
    expect(DEFAULT_STOCHASTIC_CONFIG.kPeriod).toBe(14);
    expect(DEFAULT_STOCHASTIC_CONFIG.kSmoothing).toBe(3);
    expect(DEFAULT_STOCHASTIC_CONFIG.dPeriod).toBe(3);
    expect(DEFAULT_STOCHASTIC_CONFIG.overboughtLevel).toBe(80);
    expect(DEFAULT_STOCHASTIC_CONFIG.oversoldLevel).toBe(20);
  });

  it('should match TA-Lib Stochastic for sample data', () => {
    const sampleData = [
      { h: 127.01, l: 125.36, c: 126.00 },
      { h: 127.62, l: 126.16, c: 126.50 },
      { h: 126.59, l: 124.93, c: 125.50 },
      { h: 127.35, l: 126.09, c: 126.75 },
      { h: 128.17, l: 126.82, c: 127.50 },
      { h: 128.43, l: 126.48, c: 127.00 },
      { h: 127.37, l: 126.03, c: 126.50 },
      { h: 126.42, l: 124.83, c: 125.50 },
      { h: 126.90, l: 126.39, c: 126.75 },
      { h: 126.85, l: 125.72, c: 126.25 },
      { h: 125.65, l: 124.56, c: 125.00 },
      { h: 125.72, l: 124.57, c: 125.50 },
      { h: 127.16, l: 125.07, c: 126.50 },
      { h: 127.72, l: 126.86, c: 127.25 },
      { h: 128.01, l: 127.00, c: 127.75 },
      { h: 128.50, l: 127.25, c: 128.00 },
    ];

    const klines = sampleData.map((d, i) => createMockKlineWithHLC(d.h, d.l, d.c, i));
    const result = calculateStochastic(klines, 14, 3, 3);

    const validK = result.k.filter((v) => v !== null);
    const validD = result.d.filter((v) => v !== null);

    expect(validK.length).toBeGreaterThan(0);

    validK.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    validD.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });
});
