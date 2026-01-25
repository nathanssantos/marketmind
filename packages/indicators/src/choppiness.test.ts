import { describe, it, expect } from 'vitest';
import { calculateChoppiness, getChoppinessResult, CHOPPINESS_FILTER } from './choppiness';
import type { Kline } from '@marketmind/types';

const createKline = (open: number, high: number, low: number, close: number, volume = 1000): Kline => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: Date.now(),
  closeTime: Date.now() + 3600000,
  open: open.toString(),
  high: high.toString(),
  low: low.toString(),
  close: close.toString(),
  volume: volume.toString(),
  quoteVolume: (volume * close).toString(),
  trades: 100,
  takerBuyBaseVolume: (volume * 0.5).toString(),
  takerBuyQuoteVolume: (volume * 0.5 * close).toString(),
});

const generateTrendingKlines = (length: number): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;
  for (let i = 0; i < length; i++) {
    price += 5;
    klines.push(createKline(price - 2, price + 1, price - 3, price));
  }
  return klines;
};

const generateSidewaysKlines = (length: number): Kline[] => {
  const klines: Kline[] = [];
  const basePrice = 100;
  for (let i = 0; i < length; i++) {
    const variation = (i % 2 === 0 ? 1 : -1) * 0.5;
    klines.push(createKline(
      basePrice + variation,
      basePrice + 1,
      basePrice - 1,
      basePrice - variation,
    ));
  }
  return klines;
};

describe('calculateChoppiness', () => {
  it('should return empty array for empty input', () => {
    const result = calculateChoppiness([]);
    expect(result).toEqual([]);
  });

  it('should return NaN for insufficient data', () => {
    const klines = generateTrendingKlines(5);
    const result = calculateChoppiness(klines, 14);
    expect(result.every(v => isNaN(v))).toBe(true);
  });

  it('should return values between 0 and 100', () => {
    const klines = generateTrendingKlines(30);
    const result = calculateChoppiness(klines, 14);
    const validValues = result.filter(v => !isNaN(v));
    expect(validValues.length).toBeGreaterThan(0);
    validValues.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('should detect trending market (low choppiness)', () => {
    const klines = generateTrendingKlines(50);
    const result = calculateChoppiness(klines, 14);
    const lastValue = result[result.length - 1];
    expect(lastValue).toBeDefined();
    expect(lastValue).not.toBeNaN();
  });

  it('should respect custom period', () => {
    const klines = generateTrendingKlines(30);
    const result10 = calculateChoppiness(klines, 10);
    const result20 = calculateChoppiness(klines, 20);
    const validValues10 = result10.filter(v => !isNaN(v));
    const validValues20 = result20.filter(v => !isNaN(v));
    expect(validValues10.length).toBeGreaterThan(validValues20.length);
  });
});

describe('getChoppinessResult', () => {
  it('should return null value for insufficient data', () => {
    const klines = generateTrendingKlines(5);
    const result = getChoppinessResult(klines);
    expect(result.value).toBeNull();
    expect(result.isChoppy).toBe(false);
    expect(result.isTrending).toBe(false);
  });

  it('should detect trending market correctly', () => {
    const klines = generateTrendingKlines(50);
    const result = getChoppinessResult(klines);
    expect(result.value).not.toBeNull();
    if (result.value !== null && result.value < CHOPPINESS_FILTER.LOW_THRESHOLD) {
      expect(result.isTrending).toBe(true);
      expect(result.isChoppy).toBe(false);
    }
  });

  it('should use custom thresholds', () => {
    const klines = generateTrendingKlines(50);
    const result = getChoppinessResult(klines, 14, 80, 20);
    expect(result.value).not.toBeNull();
    if (result.value !== null) {
      expect(result.isChoppy).toBe(result.value > 80);
      expect(result.isTrending).toBe(result.value < 20);
    }
  });
});

describe('CHOPPINESS_FILTER constants', () => {
  it('should export correct default values', () => {
    expect(CHOPPINESS_FILTER.DEFAULT_PERIOD).toBe(14);
    expect(CHOPPINESS_FILTER.HIGH_THRESHOLD).toBe(61.8);
    expect(CHOPPINESS_FILTER.LOW_THRESHOLD).toBe(38.2);
  });
});
