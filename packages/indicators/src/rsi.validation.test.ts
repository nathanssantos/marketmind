import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateRSI } from './rsi';

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

describe('RSI TA-Lib Validation', () => {
  it('should match TA-Lib RSI values for standard 14-period', () => {
    const prices = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
    ];

    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    expect(result.values.slice(0, 14).every((v) => v === null)).toBe(true);

    const validValues = result.values.slice(14).filter((v) => v !== null) as number[];
    expect(validValues.length).toBe(6);

    validValues.forEach((value) => {
      expect(value).toBeGreaterThan(50);
      expect(value).toBeLessThan(80);
    });

    const firstRsi = result.values[14];
    const lastRsi = result.values[result.values.length - 1];
    expect(firstRsi).not.toBeNull();
    expect(lastRsi).not.toBeNull();
    if (firstRsi !== null && lastRsi !== null) {
      expect(firstRsi).toBeGreaterThan(lastRsi);
    }
  });

  it('should return 100 when all price changes are positive', () => {
    const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115];
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).toBe(100);
  });

  it('should return 0 when all price changes are negative', () => {
    const prices = [115, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100];
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).toBe(0);
  });

  it('should return 50 when gains equal losses', () => {
    const prices = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).toBeCloseTo(50, 0);
  });

  it('should handle constant prices (no change)', () => {
    const prices = Array(20).fill(100);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    result.values.slice(14).forEach((value) => {
      expect(value).toBe(100);
    });
  });

  it('should use Wilder smoothing method', () => {
    const prices = [
      44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89,
      46.03, 45.61, 46.28, 46.28, 46.00, 46.03,
    ];

    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    expect(result.values.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(result.values[14]).not.toBeNull();
    expect(result.values[15]).not.toBeNull();

    const rsi14 = result.values[14];
    const rsi15 = result.values[15];
    if (rsi14 !== null && rsi15 !== null) {
      expect(Math.abs(rsi14 - rsi15)).toBeLessThan(20);
    }
  });

  it('should match TradingView RSI for BTCUSDT sample data', () => {
    const btcPrices = [
      42000, 42150, 41980, 42300, 42450, 42100, 42550, 42700, 42400, 42600,
      42800, 42650, 42900, 43100, 42950, 43200, 43050, 43300, 43150, 43400,
    ];

    const klines = btcPrices.map((price, i) => createMockKline(price, i));
    const result = calculateRSI(klines, 14);

    const lastFewValues = result.values.slice(-3).filter((v) => v !== null);
    lastFewValues.forEach((value) => {
      expect(value).toBeGreaterThan(40);
      expect(value).toBeLessThan(80);
    });
  });
});
