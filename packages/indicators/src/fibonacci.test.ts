import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  calculateAutoFibonacci,
  calculateFibonacciExtension,
  calculateFibonacciProjection,
  calculateFibonacciRetracement,
  FIBONACCI_EXTENSION_LEVELS,
  selectDynamicFibonacciLevel,
} from './fibonacci';

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

describe('calculateFibonacciRetracement', () => {
  it('should calculate retracement levels for uptrend', () => {
    const levels = calculateFibonacciRetracement(100, 0, 'up');

    expect(levels.length).toBe(9);
    expect(levels.find((l) => l.level === 0)?.price).toBe(100);
    expect(levels.find((l) => l.level === 0.5)?.price).toBe(50);
    expect(levels.find((l) => l.level === 1)?.price).toBe(0);
  });

  it('should calculate retracement levels for downtrend', () => {
    const levels = calculateFibonacciRetracement(100, 0, 'down');

    expect(levels.length).toBe(9);
    expect(levels.find((l) => l.level === 0)?.price).toBe(0);
    expect(levels.find((l) => l.level === 0.5)?.price).toBe(50);
    expect(levels.find((l) => l.level === 1)?.price).toBe(100);
  });

  it('should include extension levels', () => {
    const levels = calculateFibonacciRetracement(100, 0, 'up');

    const extensionLevel = levels.find((l) => l.level === 1.618);
    expect(extensionLevel).toBeDefined();
    expect(extensionLevel?.price).toBeCloseTo(-61.8, 1);
  });

  it('should include correct labels', () => {
    const levels = calculateFibonacciRetracement(100, 50, 'up');

    const level50 = levels.find((l) => l.level === 0.5);
    expect(level50?.label).toBe('50.0%');
  });
});

describe('calculateAutoFibonacci', () => {
  it('should detect uptrend and calculate fibonacci', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      const basePrice = i < 30 ? 100 + i * 2 : 160 - (i - 30) * 1;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateAutoFibonacci(klines, 50);

    expect(result).not.toBeNull();
    expect(result?.levels.length).toBe(9);
    expect(result?.swingHigh).toBeGreaterThan(result?.swingLow as number);
  });

  it('should return null for insufficient data', () => {
    const klines = [createMockKline(105, 95, 0), createMockKline(106, 96, 1)];
    const result = calculateAutoFibonacci(klines, 50);

    expect(result).toBeNull();
  });

  it('should detect correct direction', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      const basePrice = 100 + i;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateAutoFibonacci(klines, 50);

    expect(result?.direction).toBe('up');
  });

  it('should find swing high and low correctly', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      const basePrice = 100 + Math.sin(i * 0.2) * 20;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateAutoFibonacci(klines, 50);

    expect(result).not.toBeNull();
    expect(result?.swingHigh).toBeGreaterThanOrEqual(result?.swingLow as number);
  });
});

describe('calculateFibonacciExtension', () => {
  it('should calculate extension levels for uptrend', () => {
    const levels = calculateFibonacciExtension(100, 200, 150);

    expect(levels.length).toBe(7);
    expect(levels.find((l) => l.level === 1)?.price).toBe(150);
    expect(levels.find((l) => l.level === 1.618)?.price).toBeCloseTo(211.8, 1);
  });

  it('should calculate extension levels for downtrend', () => {
    const levels = calculateFibonacciExtension(200, 100, 150);

    expect(levels.length).toBe(7);
    expect(levels.find((l) => l.level === 1)?.price).toBe(150);
    expect(levels.find((l) => l.level === 1.618)?.price).toBeCloseTo(88.2, 1);
  });

  it('should include correct labels', () => {
    const levels = calculateFibonacciExtension(100, 200, 150);

    const level1618 = levels.find((l) => l.level === 1.618);
    expect(level1618?.label).toBe('161.8%');
  });
});

describe('calculateFibonacciProjection', () => {
  it('should calculate extension levels for LONG direction', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      const basePrice = i < 30 ? 100 + i * 2 : 160 - (i - 30) * 0.5;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    expect(result!.swingLow.price).toBeLessThan(result!.swingHigh.price);
    expect(result!.levels.find((l) => l.level === 1.618)).toBeDefined();
    expect(result!.levels.find((l) => l.level === 0)!.price).toBe(result!.swingLow.price);
    expect(result!.levels.find((l) => l.level === 1)!.price).toBe(result!.swingHigh.price);
  });

  it('should calculate extension levels for SHORT direction', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      const basePrice = i < 30 ? 160 - i * 2 : 100 + (i - 30) * 0.5;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'SHORT');

    expect(result).not.toBeNull();
    expect(result!.levels.find((l) => l.level === 0)!.price).toBe(result!.swingHigh.price);
    expect(result!.levels.find((l) => l.level === 1)!.price).toBe(result!.swingLow.price);
  });

  it('should return null for insufficient klines', () => {
    const klines = [
      createMockKline(105, 95, 0),
      createMockKline(106, 96, 1),
      createMockKline(107, 97, 2),
    ];
    const result = calculateFibonacciProjection(klines, 2, 50, 'LONG');

    expect(result).toBeNull();
  });

  it('should include all extension levels', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 30) basePrice = 100 + i * 2;
      else if (i < 45) basePrice = 160 - (i - 30) * 3;
      else basePrice = 115 + (i - 45) * 2;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    expect(result!.levels.length).toBe(FIBONACCI_EXTENSION_LEVELS.length);
    for (const expectedLevel of FIBONACCI_EXTENSION_LEVELS) {
      expect(result!.levels.find((l) => l.level === expectedLevel)).toBeDefined();
    }
  });

  it('should include swing point indices and timestamps', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 30) basePrice = 100 + i * 2;
      else if (i < 45) basePrice = 160 - (i - 30) * 3;
      else basePrice = 115 + (i - 45) * 2;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    expect(typeof result!.swingLow.index).toBe('number');
    expect(typeof result!.swingHigh.index).toBe('number');
    expect(typeof result!.swingLow.timestamp).toBe('number');
    expect(typeof result!.swingHigh.timestamp).toBe('number');
    expect(result!.swingLow.timestamp).toBeGreaterThan(0);
    expect(result!.swingHigh.timestamp).toBeGreaterThan(0);
  });

  it('should calculate correct extension prices for LONG', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 20) basePrice = 100;
      else if (i < 40) basePrice = 100 + (i - 20) * 5;
      else basePrice = 200;
      klines.push(createMockKline(basePrice + 1, basePrice - 1, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();

    const range = result!.swingHigh.price - result!.swingLow.price;
    const level1618 = result!.levels.find((l) => l.level === 1.618);

    expect(level1618).toBeDefined();
    const expectedPrice = result!.swingHigh.price + range * 0.618;
    expect(level1618!.price).toBeCloseTo(expectedPrice, 1);
  });

  it('should include range in result', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 30) basePrice = 100 + i * 2;
      else if (i < 45) basePrice = 160 - (i - 30) * 3;
      else basePrice = 115 + (i - 45) * 2;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    expect(result!.range).toBeGreaterThan(0);
    expect(result!.range).toBe(result!.swingHigh.price - result!.swingLow.price);
  });

  it('should detect direction based on swing point positions', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 30) basePrice = 100 + i * 2;
      else if (i < 45) basePrice = 160 - (i - 30) * 3;
      else basePrice = 115 + (i - 45) * 2;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    expect(result!.direction).toBe('up');
  });

  it('should include correct labels for all levels', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 60; i++) {
      let basePrice: number;
      if (i < 30) basePrice = 100 + i * 2;
      else if (i < 45) basePrice = 160 - (i - 30) * 3;
      else basePrice = 115 + (i - 45) * 2;
      klines.push(createMockKline(basePrice + 2, basePrice - 2, i));
    }

    const result = calculateFibonacciProjection(klines, 59, 50, 'LONG');

    expect(result).not.toBeNull();
    const level1618 = result!.levels.find((l) => l.level === 1.618);
    expect(level1618?.label).toBe('161.8%');

    const level200 = result!.levels.find((l) => l.level === 2);
    expect(level200?.label).toBe('200.0%');

    expect(result!.levels).toHaveLength(11);
  });
});

describe('selectDynamicFibonacciLevel', () => {
  describe('ADX-based selection (optimized for higher targets)', () => {
    it('should return 1.618 for ranging market (ADX < 20)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 15, atrPercent: 1.5 });
      expect(result.level).toBe(1.618);
      expect(result.reason).toBe('ranging_market');
    });

    it('should return 1.618 for ADX at boundary (ADX = 19)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 19, atrPercent: 2.0 });
      expect(result.level).toBe(1.618);
      expect(result.reason).toBe('ranging_market');
    });

    it('should return 2 for weak trend (ADX 20-25)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 22, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('weak_trend');
    });

    it('should return 2 for ADX at weak trend boundary (ADX = 24)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 24, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('weak_trend');
    });

    it('should return 2 for moderate trend (ADX 25-35)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 27, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('moderate_trend');
    });
  });

  describe('Strong trend (ADX >= 35)', () => {
    it('should return 2 for strong trend (ADX >= 35)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 35, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should return 2 with volume confirmation', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 1.5, volumeRatio: 2.0 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should return 2 with high volatility (ATR% > 2.5)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 3.0 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });
  });

  describe('Very strong trend (ADX >= 45 with confirmation)', () => {
    it('should return 2.618 for very strong trend with volume confirmation', () => {
      const result = selectDynamicFibonacciLevel({ adx: 50, atrPercent: 2.0, volumeRatio: 2.0 });
      expect(result.level).toBe(2.618);
      expect(result.reason).toBe('very_strong_trend_confirmed');
    });

    it('should return 2.618 for very strong trend with very high volatility (ATR% > 4.0)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 50, atrPercent: 4.5 });
      expect(result.level).toBe(2.618);
      expect(result.reason).toBe('very_strong_trend_confirmed');
    });

    it('should return 2 for very strong trend without confirmation', () => {
      const result = selectDynamicFibonacciLevel({ adx: 50, atrPercent: 2.0 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });
  });

  describe('Edge cases', () => {
    it('should handle ADX exactly at 20 (boundary)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 20, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('weak_trend');
    });

    it('should handle ADX exactly at 25 (boundary)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 25, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('moderate_trend');
    });

    it('should handle ADX exactly at 35 (boundary)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 35, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should handle ADX exactly at 45 (very strong boundary)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 45, atrPercent: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should handle volume ratio exactly at threshold (1.5)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 1.5, volumeRatio: 1.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('moderate_trend');
    });

    it('should handle volume ratio just above threshold (1.51)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 1.5, volumeRatio: 1.51 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should handle ATR% exactly at threshold (2.5)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 2.5 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('moderate_trend');
    });

    it('should handle ATR% just above threshold (2.51)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 30, atrPercent: 2.51 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should handle ATR% at very high volatility threshold (4.0)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 45, atrPercent: 4.0 });
      expect(result.level).toBe(2);
      expect(result.reason).toBe('strong_trend');
    });

    it('should handle ATR% just above very high volatility threshold (4.01)', () => {
      const result = selectDynamicFibonacciLevel({ adx: 45, atrPercent: 4.01 });
      expect(result.level).toBe(2.618);
      expect(result.reason).toBe('very_strong_trend_confirmed');
    });
  });
});
