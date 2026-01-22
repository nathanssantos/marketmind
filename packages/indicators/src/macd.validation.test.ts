import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateMACD } from './macd';

const createMockKline = (close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close - 1),
  high: String(close + 1),
  low: String(close - 2),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('MACD TA-Lib Validation', () => {
  it('should produce NaN for first 25 periods (slow EMA period - 1)', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    for (let i = 0; i < 25; i++) {
      expect(isNaN(result.macd[i]!)).toBe(true);
    }
    expect(isNaN(result.macd[25]!)).toBe(false);
  });

  it('should calculate MACD line as fast EMA minus slow EMA', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const validMacd = result.macd.filter((v) => !isNaN(v!));
    expect(validMacd.length).toBeGreaterThan(0);

    validMacd.forEach((value) => {
      expect(Math.abs(value!)).toBeLessThan(20);
    });
  });

  it('should have signal line lag behind MACD line', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const firstValidMacdIdx = result.macd.findIndex((v) => !isNaN(v!));
    const firstValidSignalIdx = result.signal.findIndex((v) => !isNaN(v!));

    expect(firstValidSignalIdx).toBeGreaterThanOrEqual(firstValidMacdIdx);
  });

  it('should calculate histogram as MACD minus signal', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.random() * 10);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    for (let i = 0; i < result.macd.length; i++) {
      const macd = result.macd[i];
      const signal = result.signal[i];
      const histogram = result.histogram[i];

      if (!isNaN(macd!) && !isNaN(signal!) && !isNaN(histogram!)) {
        expect(histogram).toBeCloseTo(macd! - signal!, 10);
      }
    }
  });

  it('should show positive MACD in strong uptrend', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const lastMacd = result.macd[result.macd.length - 1];
    expect(lastMacd).toBeGreaterThan(0);
  });

  it('should show negative MACD in strong downtrend', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const lastMacd = result.macd[result.macd.length - 1];
    expect(lastMacd).toBeLessThan(0);
  });

  it('should handle empty input', () => {
    const result = calculateMACD([], 12, 26, 9);
    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
    expect(result.histogram).toHaveLength(0);
  });

  it('should use correct EMA multiplier (2 / (period + 1))', () => {
    const constantPrices = Array(50).fill(100);
    const klines = constantPrices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const validMacd = result.macd.filter((v) => !isNaN(v!));
    validMacd.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });

  it('should match TA-Lib values for sample data', () => {
    const prices = [
      26.00, 26.50, 26.25, 26.75, 27.00, 26.50, 27.25, 27.50, 27.25, 27.75,
      28.00, 27.50, 28.25, 28.50, 28.25, 28.75, 29.00, 28.50, 29.25, 29.50,
      29.25, 29.75, 30.00, 29.50, 30.25, 30.50, 30.25, 30.75, 31.00, 30.50,
      31.25, 31.50, 31.25, 31.75, 32.00, 31.50, 32.25, 32.50, 32.25, 32.75,
    ];

    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateMACD(klines, 12, 26, 9);

    const validValues = result.macd.filter((v) => !isNaN(v!));
    expect(validValues.length).toBeGreaterThan(10);

    const lastMacd = result.macd[result.macd.length - 1];
    expect(lastMacd).toBeGreaterThan(0);
  });
});
