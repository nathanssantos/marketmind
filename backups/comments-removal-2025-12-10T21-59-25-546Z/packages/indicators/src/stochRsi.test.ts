import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateStochRSI } from './stochRsi';

const createMockKlines = (closes: number[]): Kline[] => {
  return closes.map((close, i) => ({
    openTime: Date.now() + i * 86400000,
    open: String(close),
    high: String(close * 1.01),
    low: String(close * 0.99),
    close: String(close),
    volume: '1000',
    closeTime: Date.now() + i * 86400000 + 86399999,
    quoteVolume: '1000000',
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '500000',
  }));
};

describe('calculateStochRSI', () => {
  it('should return empty arrays for empty input', () => {
    const result = calculateStochRSI([], 14, 14, 3, 3);
    expect(result.k).toEqual([]);
    expect(result.d).toEqual([]);
  });

  it('should calculate StochRSI with default parameters', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const klines = createMockKlines(closes);
    const result = calculateStochRSI(klines);

    expect(result.k).toHaveLength(50);
    expect(result.d).toHaveLength(50);
    
    const validK = result.k.filter((v): v is number => v !== null);
    const validD = result.d.filter((v): v is number => v !== null);
    
    expect(validK.length).toBeGreaterThan(0);
    expect(validD.length).toBeGreaterThan(0);
    
    validK.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('should calculate StochRSI with custom parameters', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const klines = createMockKlines(closes);
    const result = calculateStochRSI(klines, 10, 10, 2, 2);

    expect(result.k).toHaveLength(50);
    expect(result.d).toHaveLength(50);
    
    const validK = result.k.filter((v): v is number => v !== null);
    expect(validK.length).toBeGreaterThan(0);
  });

  it('should return null for insufficient data', () => {
    const closes = [100, 101, 102];
    const klines = createMockKlines(closes);
    const result = calculateStochRSI(klines, 14, 14, 3, 3);

    expect(result.k.every(v => v === null)).toBe(true);
    expect(result.d.every(v => v === null)).toBe(true);
  });

  it('should handle trending market', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 5);
    const klines = createMockKlines(closes);
    const result = calculateStochRSI(klines, 14, 14, 3, 3);

    const validK = result.k.filter((v): v is number => v !== null);
    expect(validK.length).toBeGreaterThan(20);
    
    const recentK = validK.slice(-10);
    const avgRecentK = recentK.reduce((sum, v) => sum + v, 0) / recentK.length;
    expect(avgRecentK).toBeGreaterThanOrEqual(50);
  });

  it('should produce K and D values where D lags K', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 20);
    const klines = createMockKlines(closes);
    const result = calculateStochRSI(klines, 14, 14, 3, 3);

    let nonNullKIndex = -1;
    let nonNullDIndex = -1;
    
    for (let i = 0; i < result.k.length; i++) {
      if (result.k[i] !== null && nonNullKIndex === -1) {
        nonNullKIndex = i;
      }
      if (result.d[i] !== null && nonNullDIndex === -1) {
        nonNullDIndex = i;
      }
    }

    expect(nonNullDIndex).toBeGreaterThanOrEqual(nonNullKIndex);
  });
});
