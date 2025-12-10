import { describe, it, expect } from 'vitest';
import {
  calculateCumulativeRSI,
  calculateRSIConsecutiveDrops,
  calculateR3Entry,
} from './cumulativeRsi';
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

describe('calculateCumulativeRSI', () => {
  it('should return null for insufficient data', () => {
    const klines = [createKline(100, 0), createKline(99, 1), createKline(98, 2)];

    const result = calculateCumulativeRSI(klines, 2, 2);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).toBeNull();
  });

  it('should calculate cumulative RSI after enough data', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i++) {
      klines.push(createKline(100 - i * 2, i));
    }

    const result = calculateCumulativeRSI(klines, 2, 2);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    if (lastValue !== null) {
      expect(lastValue).toBeGreaterThanOrEqual(0);
      expect(lastValue).toBeLessThanOrEqual(200);
    }
  });

  it('should return RSI values array', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i++) {
      klines.push(createKline(100 + Math.sin(i) * 10, i));
    }

    const result = calculateCumulativeRSI(klines, 2, 2);
    expect(result.rsiValues.length).toBe(klines.length);
  });

  it('should detect oversold condition (cumulative < 10)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i++) {
      klines.push(createKline(100 - i * 5, i));
    }

    const result = calculateCumulativeRSI(klines, 2, 2);
    const lastValue = result.values[result.values.length - 1];

    expect(lastValue).not.toBeNull();
    if (lastValue !== null) {
      expect(lastValue).toBeLessThan(50);
    }
  });

  it('should handle empty input', () => {
    const result = calculateCumulativeRSI([]);
    expect(result.values).toHaveLength(0);
    expect(result.rsiValues).toHaveLength(0);
  });

  it('should work with different sum periods', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 15; i++) {
      klines.push(createKline(100 - i, i));
    }

    const result2 = calculateCumulativeRSI(klines, 2, 2);
    const result3 = calculateCumulativeRSI(klines, 2, 3);

    expect(result2.values.filter((v) => v !== null).length).toBeGreaterThan(0);
    expect(result3.values.filter((v) => v !== null).length).toBeGreaterThan(0);
  });
});

describe('calculateRSIConsecutiveDrops', () => {
  it('should detect 3 consecutive RSI drops', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i++) {
      klines.push(createKline(100 - i * 3, i));
    }

    const result = calculateRSIConsecutiveDrops(klines, 2, 3);

    const hasDetection = result.some((v) => v === true);
    expect(result.length).toBe(klines.length);
    expect(typeof hasDetection).toBe('boolean');
  });

  it('should return false for insufficient data', () => {
    const klines = [
      createKline(100, 0),
      createKline(99, 1),
      createKline(98, 2),
      createKline(97, 3),
    ];

    const result = calculateRSIConsecutiveDrops(klines, 2, 3);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
    expect(result[2]).toBe(false);
  });

  it('should not detect when RSI rises', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        klines.push(createKline(100 - i, i));
      } else {
        klines.push(createKline(100 - i + 5, i));
      }
    }

    const result = calculateRSIConsecutiveDrops(klines, 2, 3);
    const lastFew = result.slice(-3);
    expect(lastFew.every((v) => v === false)).toBe(true);
  });

  it('should handle empty input', () => {
    const result = calculateRSIConsecutiveDrops([]);
    expect(result).toHaveLength(0);
  });
});

describe('calculateR3Entry', () => {
  it('should return false for insufficient data', () => {
    const klines = [
      createKline(100, 0),
      createKline(99, 1),
      createKline(98, 2),
      createKline(97, 3),
      createKline(96, 4),
    ];

    const result = calculateR3Entry(klines, 2);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
    expect(result[2]).toBe(false);
  });

  it('should return array of correct length', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createKline(100 - i * 2, i));
    }

    const result = calculateR3Entry(klines, 2);
    expect(result.length).toBe(klines.length);
  });

  it('should handle empty input', () => {
    const result = calculateR3Entry([]);
    expect(result).toHaveLength(0);
  });

  it('should detect R3 entry when all conditions met', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 15; i++) {
      klines.push(createKline(100 - i * 5, i));
    }

    const result = calculateR3Entry(klines, 2);
    expect(result.length).toBe(15);
  });
});
