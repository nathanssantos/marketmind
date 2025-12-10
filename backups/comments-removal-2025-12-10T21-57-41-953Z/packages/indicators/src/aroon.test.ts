import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateAroon } from './aroon';

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

describe('calculateAroon', () => {
  it('should calculate Aroon correctly for uptrend', () => {
    const klines = Array.from({ length: 35 }, (_, i) => createMockKline(102 + i * 2, 98 + i * 2, i));
    const result = calculateAroon(klines);

    expect(result.aroonUp).toHaveLength(35);
    expect(result.aroonDown).toHaveLength(35);
    expect(result.oscillator).toHaveLength(35);

    const lastUp = result.aroonUp[result.aroonUp.length - 1];
    expect(lastUp).toBe(100);

    const lastOscillator = result.oscillator[result.oscillator.length - 1];
    expect(lastOscillator).toBeGreaterThan(0);
  });

  it('should calculate Aroon correctly for downtrend', () => {
    const klines = Array.from({ length: 35 }, (_, i) =>
      createMockKline(202 - i * 2, 198 - i * 2, i),
    );
    const result = calculateAroon(klines);

    const lastDown = result.aroonDown[result.aroonDown.length - 1];
    expect(lastDown).toBe(100);

    const lastOscillator = result.oscillator[result.oscillator.length - 1];
    expect(lastOscillator).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateAroon(klines);

    expect(result.aroonUp.every((v) => v === null)).toBe(true);
    expect(result.aroonDown.every((v) => v === null)).toBe(true);
    expect(result.oscillator.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 25', () => {
    const klines = Array.from({ length: 35 }, (_, i) => createMockKline(105 + i, 95 + i, i));
    const result = calculateAroon(klines);

    expect(result.aroonUp).toHaveLength(35);

    const firstValidIndex = result.aroonUp.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(25);
  });

  it('should handle empty array', () => {
    const result = calculateAroon([]);
    expect(result.aroonUp).toEqual([]);
    expect(result.aroonDown).toEqual([]);
    expect(result.oscillator).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = Array.from({ length: 35 }, (_, i) => createMockKline(105, 95, i));
    expect(calculateAroon(klines, 0).aroonUp).toEqual([]);
    expect(calculateAroon(klines, -1).aroonUp).toEqual([]);
  });

  it('should return values between 0 and 100 for Aroon Up/Down', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const basePrice = 100 + Math.sin(i * 0.3) * 10;
      return createMockKline(basePrice + 2, basePrice - 2, i);
    });
    const result = calculateAroon(klines);

    result.aroonUp.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    result.aroonDown.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should return oscillator between -100 and 100', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const basePrice = 100 + Math.sin(i * 0.3) * 10;
      return createMockKline(basePrice + 2, basePrice - 2, i);
    });
    const result = calculateAroon(klines);

    result.oscillator.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });
});
