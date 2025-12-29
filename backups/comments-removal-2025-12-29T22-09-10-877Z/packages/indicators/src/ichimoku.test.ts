import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateIchimoku } from './ichimoku';

const createMockKlines = (count: number, basePrice: number = 100): Kline[] => {
  return Array.from({ length: count }, (_, i) => {
    const price = basePrice + Math.sin(i / 10) * 10;
    return {
      openTime: Date.now() + i * 86400000,
      open: String(price),
      high: String(price * 1.02),
      low: String(price * 0.98),
      close: String(price),
      volume: '1000',
      closeTime: Date.now() + i * 86400000 + 86399999,
      quoteVolume: '1000000',
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '500000',
    };
  });
};

describe('calculateIchimoku', () => {
  it('should return empty arrays for empty input', () => {
    const result = calculateIchimoku([]);
    expect(result.tenkan).toEqual([]);
    expect(result.kijun).toEqual([]);
    expect(result.senkouA).toEqual([]);
    expect(result.senkouB).toEqual([]);
    expect(result.chikou).toEqual([]);
  });

  it('should calculate Ichimoku with default parameters', () => {
    const klines = createMockKlines(100);
    const result = calculateIchimoku(klines);

    expect(result.tenkan).toHaveLength(100);
    expect(result.kijun).toHaveLength(100);
    expect(result.senkouA).toHaveLength(100);
    expect(result.senkouB).toHaveLength(100);
    expect(result.chikou).toHaveLength(100);

    const validTenkan = result.tenkan.filter((v): v is number => v !== null);
    const validKijun = result.kijun.filter((v): v is number => v !== null);
    
    expect(validTenkan.length).toBeGreaterThan(50);
    expect(validKijun.length).toBeGreaterThan(50);
  });

  it('should calculate Tenkan-sen (Conversion Line) correctly', () => {
    const klines = createMockKlines(50);
    const result = calculateIchimoku(klines, 9, 26, 52, 26);

    const firstValidTenkan = result.tenkan.findIndex(v => v !== null);
    expect(firstValidTenkan).toBe(8);

    result.tenkan.forEach((value) => {
      if (value !== null) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  it('should calculate Kijun-sen (Base Line) correctly', () => {
    const klines = createMockKlines(50);
    const result = calculateIchimoku(klines, 9, 26, 52, 26);

    const firstValidKijun = result.kijun.findIndex(v => v !== null);
    expect(firstValidKijun).toBe(25);

    result.kijun.forEach((value) => {
      if (value !== null) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  it('should calculate Senkou Span A (Leading Span A) with displacement', () => {
    const klines = createMockKlines(100);
    const displacement = 26;
    const result = calculateIchimoku(klines, 9, 26, 52, displacement);

    let foundDisplacedValue = false;
    for (let i = 26; i < result.senkouA.length; i++) {
      if (result.senkouA[i] !== null) {
        foundDisplacedValue = true;
        break;
      }
    }
    expect(foundDisplacedValue).toBe(true);
  });

  it('should calculate Senkou Span B (Leading Span B) with displacement', () => {
    const klines = createMockKlines(100);
    const displacement = 26;
    const result = calculateIchimoku(klines, 9, 26, 52, displacement);

    let foundDisplacedValue = false;
    for (let i = 52 + displacement; i < result.senkouB.length; i++) {
      if (result.senkouB[i] !== null) {
        foundDisplacedValue = true;
        break;
      }
    }
    expect(foundDisplacedValue).toBe(true);
  });

  it('should calculate Chikou Span (Lagging Span) correctly', () => {
    const klines = createMockKlines(100);
    const displacement = 26;
    const result = calculateIchimoku(klines, 9, 26, 52, displacement);

    const validChikou = result.chikou.filter((v): v is number => v !== null);
    expect(validChikou.length).toBe(100 - displacement);

    for (let i = 0; i < 100 - displacement; i++) {
      expect(result.chikou[i]).toBe(parseFloat(klines[i + displacement]!.close));
    }
  });

  it('should handle uptrend correctly', () => {
    const klines = Array.from({ length: 100 }, (_, i) => {
      const price = 100 + i * 2;
      return {
        openTime: Date.now() + i * 86400000,
        open: String(price),
        high: String(price * 1.01),
        low: String(price * 0.99),
        close: String(price),
        volume: '1000',
        closeTime: Date.now() + i * 86400000 + 86399999,
        quoteVolume: '1000000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '500000',
      };
    });

    const result = calculateIchimoku(klines);
    const validTenkan = result.tenkan.filter((v): v is number => v !== null);
    const validKijun = result.kijun.filter((v): v is number => v !== null);

    expect(validTenkan.length).toBeGreaterThan(0);
    expect(validKijun.length).toBeGreaterThan(0);

    const lastTenkan = validTenkan[validTenkan.length - 1];
    const lastKijun = validKijun[validKijun.length - 1];
    expect(lastTenkan).toBeGreaterThan(lastKijun!);
  });

  it('should work with custom parameters', () => {
    const klines = createMockKlines(100);
    const result = calculateIchimoku(klines, 5, 15, 30, 15);

    expect(result.tenkan).toHaveLength(100);
    expect(result.kijun).toHaveLength(100);

    const firstValidTenkan = result.tenkan.findIndex(v => v !== null);
    const firstValidKijun = result.kijun.findIndex(v => v !== null);

    expect(firstValidTenkan).toBe(4);
    expect(firstValidKijun).toBe(14);
  });

  it('should return null values for insufficient data', () => {
    const klines = createMockKlines(5);
    const result = calculateIchimoku(klines, 9, 26, 52, 26);

    const validTenkan = result.tenkan.filter((v): v is number => v !== null);
    const validKijun = result.kijun.filter((v): v is number => v !== null);
    
    expect(validTenkan.length).toBeLessThan(3);
    expect(validKijun.length).toBe(0);
  });
});
