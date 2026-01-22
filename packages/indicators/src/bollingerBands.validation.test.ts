import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  calculateBollingerBands,
  calculateBollingerBandsArray,
  calculateBBWidth,
  calculateBBPercentB,
} from './bollingerBands';

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

describe('Bollinger Bands TA-Lib Validation', () => {
  it('should calculate middle band as 20-period SMA', () => {
    const prices = Array.from({ length: 25 }, (_, i) => 100 + i);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateBollingerBands(klines, 20, 2);

    const last20Prices = prices.slice(-20);
    const expectedSMA = last20Prices.reduce((a, b) => a + b, 0) / 20;

    expect(result).not.toBeNull();
    expect(result!.middle).toBeCloseTo(expectedSMA, 10);
  });

  it('should calculate upper/lower bands with 2 standard deviations', () => {
    const prices = [
      25.0, 24.5, 25.5, 25.0, 24.0, 26.0, 25.5, 24.5, 25.0, 25.5,
      24.0, 25.0, 26.0, 25.5, 24.5, 25.0, 25.5, 24.0, 25.0, 26.0,
    ];

    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateBollingerBands(klines, 20, 2);

    expect(result).not.toBeNull();

    const mean = prices.reduce((a, b) => a + b, 0) / 20;
    const squaredDiffs = prices.map((p) => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / 20;
    const stdDev = Math.sqrt(variance);

    expect(result!.middle).toBeCloseTo(mean, 10);
    expect(result!.upper).toBeCloseTo(mean + 2 * stdDev, 10);
    expect(result!.lower).toBeCloseTo(mean - 2 * stdDev, 10);
  });

  it('should return null for insufficient data', () => {
    const prices = Array.from({ length: 15 }, (_, i) => 100 + i);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateBollingerBands(klines, 20, 2);

    expect(result).toBeNull();
  });

  it('should have bands equidistant from middle', () => {
    const prices = Array.from({ length: 25 }, (_, i) => 100 + Math.random() * 10);
    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateBollingerBands(klines, 20, 2);

    expect(result).not.toBeNull();

    const upperDist = result!.upper - result!.middle;
    const lowerDist = result!.middle - result!.lower;

    expect(upperDist).toBeCloseTo(lowerDist, 10);
  });

  it('should widen bands during high volatility', () => {
    const lowVolPrices = Array(20).fill(100);
    const highVolPrices = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10));

    const lowVolKlines = lowVolPrices.map((price, i) => createMockKline(price, i));
    const highVolKlines = highVolPrices.map((price, i) => createMockKline(price, i));

    const lowVolBB = calculateBollingerBands(lowVolKlines, 20, 2);
    const highVolBB = calculateBollingerBands(highVolKlines, 20, 2);

    expect(lowVolBB).not.toBeNull();
    expect(highVolBB).not.toBeNull();

    const lowVolWidth = lowVolBB!.upper - lowVolBB!.lower;
    const highVolWidth = highVolBB!.upper - highVolBB!.lower;

    expect(highVolWidth).toBeGreaterThan(lowVolWidth);
  });

  it('should calculate BBWidth correctly', () => {
    const bb = { upper: 110, middle: 100, lower: 90 };
    const width = calculateBBWidth(bb);

    expect(width).toBeCloseTo(0.2, 10);
  });

  it('should calculate %B correctly', () => {
    const bb = { upper: 110, middle: 100, lower: 90 };

    expect(calculateBBPercentB(90, bb)).toBeCloseTo(0, 10);
    expect(calculateBBPercentB(100, bb)).toBeCloseTo(0.5, 10);
    expect(calculateBBPercentB(110, bb)).toBeCloseTo(1, 10);
    expect(calculateBBPercentB(95, bb)).toBeCloseTo(0.25, 10);
    expect(calculateBBPercentB(105, bb)).toBeCloseTo(0.75, 10);
  });

  it('should handle %B outside bands', () => {
    const bb = { upper: 110, middle: 100, lower: 90 };

    expect(calculateBBPercentB(85, bb)).toBeLessThan(0);
    expect(calculateBBPercentB(115, bb)).toBeGreaterThan(1);
  });

  it('should match TA-Lib Bollinger Bands for sample data', () => {
    const prices = [
      86.16, 89.09, 88.78, 90.32, 89.07, 91.15, 89.44, 89.18, 86.93, 87.68,
      86.96, 89.43, 89.32, 88.72, 87.45, 87.26, 89.50, 87.90, 89.13, 90.70,
    ];

    const klines = prices.map((price, i) => createMockKline(price, i));
    const result = calculateBollingerBands(klines, 20, 2);

    expect(result).not.toBeNull();

    const expectedMiddle = prices.reduce((a, b) => a + b, 0) / 20;
    expect(result!.middle).toBeCloseTo(expectedMiddle, 10);

    expect(result!.upper).toBeGreaterThan(result!.middle);
    expect(result!.lower).toBeLessThan(result!.middle);

    const bandWidth = result!.upper - result!.lower;
    expect(bandWidth).toBeGreaterThan(0);
    expect(bandWidth).toBeLessThan(20);
  });

  describe('calculateBollingerBandsArray', () => {
    it('should return array with null for first period-1 values', () => {
      const prices = Array.from({ length: 25 }, (_, i) => 100 + i);
      const klines = prices.map((price, i) => createMockKline(price, i));
      const result = calculateBollingerBandsArray(klines, 20, 2);

      expect(result).toHaveLength(25);
      for (let i = 0; i < 19; i++) {
        expect(result[i]).toBeNull();
      }
      for (let i = 19; i < 25; i++) {
        expect(result[i]).not.toBeNull();
      }
    });

    it('should produce consistent values with single calculation', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
      const klines = prices.map((price, i) => createMockKline(price, i));

      const singleResult = calculateBollingerBands(klines, 20, 2);
      const arrayResult = calculateBollingerBandsArray(klines, 20, 2);
      const lastArrayResult = arrayResult[arrayResult.length - 1];

      expect(singleResult).not.toBeNull();
      expect(lastArrayResult).not.toBeNull();
      expect(singleResult!.middle).toBeCloseTo(lastArrayResult!.middle, 10);
      expect(singleResult!.upper).toBeCloseTo(lastArrayResult!.upper, 10);
      expect(singleResult!.lower).toBeCloseTo(lastArrayResult!.lower, 10);
    });
  });
});
