import { describe, it, expect, beforeEach } from 'vitest';
import { IndicatorEngine } from '../IndicatorEngine';
import type { Kline, IndicatorDefinition } from '@marketmind/types';

function createMockKline(close: number, index: number): Kline {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: (close - 1).toString(),
    high: (close + 2).toString(),
    low: (close - 2).toString(),
    close: close.toString(),
    volume: '1000',
    quoteVolume: (1000 * close).toString(),
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: (500 * close).toString(),
  };
}

function generateKlines(count: number, basePrice: number = 100): Kline[] {
  return Array.from({ length: count }, (_, i) => createMockKline(basePrice + i, i));
}

describe('IndicatorEngine', () => {
  let engine: IndicatorEngine;

  beforeEach(() => {
    engine = new IndicatorEngine();
  });

  describe('computeIndicators', () => {
    it('should compute SMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma20: { type: 'sma', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma20']).toBeDefined();
      expect(result['sma20']!.type).toBe('sma');
      expect(Array.isArray(result['sma20']!.values)).toBe(true);
    });

    it('should compute EMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        ema9: { type: 'ema', params: { period: 9 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['ema9']).toBeDefined();
      expect(result['ema9']!.type).toBe('ema');
      expect(Array.isArray(result['ema9']!.values)).toBe(true);
    });

    it('should compute RSI indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        rsi14: { type: 'rsi', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['rsi14']).toBeDefined();
      expect(result['rsi14']!.type).toBe('rsi');
    });

    it('should compute MACD indicator', () => {
      const klines = generateKlines(50);
      const indicators: Record<string, IndicatorDefinition> = {
        macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['macd']).toBeDefined();
      expect(result['macd']!.type).toBe('macd');
      expect((result['macd']!.values as Record<string, unknown>)['macd']).toBeDefined();
      expect((result['macd']!.values as Record<string, unknown>)['signal']).toBeDefined();
      expect((result['macd']!.values as Record<string, unknown>)['histogram']).toBeDefined();
    });

    it('should compute Bollinger Bands indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        bb: { type: 'bollingerBands', params: { period: 20, stdDev: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['bb']).toBeDefined();
      expect(result['bb']!.type).toBe('bollingerBands');
      expect((result['bb']!.values as Record<string, unknown>)['upper']).toBeDefined();
      expect((result['bb']!.values as Record<string, unknown>)['middle']).toBeDefined();
      expect((result['bb']!.values as Record<string, unknown>)['lower']).toBeDefined();
    });

    it('should compute ATR indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        atr: { type: 'atr', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['atr']).toBeDefined();
      expect(result['atr']!.type).toBe('atr');
    });

    it('should resolve parameter references', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      };
      const params = { smaPeriod: 10 };

      const result = engine.computeIndicators(klines, indicators, params);

      expect(result['sma']).toBeDefined();
      expect(result['sma']!.type).toBe('sma');
    });

    it('should throw error for unknown parameter reference', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: '$unknownParam' } },
      };

      expect(() => engine.computeIndicators(klines, indicators, {})).toThrow('Unknown parameter reference');
    });

    it('should add price and volume built-in indicators', () => {
      const klines = generateKlines(30);
      const result = engine.computeIndicators(klines, {}, {});

      expect(result['_price']).toBeDefined();
      expect(result['volume']).toBeDefined();
    });

    it('should cache computed indicators', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result1 = engine.computeIndicators(klines, indicators, {});
      const result2 = engine.computeIndicators(klines, indicators, {});

      expect(result1).toBe(result2);
    });

    it('should clear cache', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result1 = engine.computeIndicators(klines, indicators, {});
      engine.clearCache();
      const result2 = engine.computeIndicators(klines, indicators, {});

      expect(result1).not.toBe(result2);
    });
  });

  describe('resolveIndicatorValue', () => {
    it('should resolve simple indicator value at index', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 10 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'sma', 29);

      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should resolve price references', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const closeValue = engine.resolveIndicatorValue(indicators, 'close', 10);

      expect(closeValue).not.toBeNull();
      expect(closeValue).toBe(110);
    });

    it('should resolve nested indicator values (e.g., macd.signal)', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const signalValue = engine.resolveIndicatorValue(indicators, 'macd.signal', 49);

      expect(typeof signalValue).toBe('number');
    });

    it('should return null for invalid indicator reference', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'invalidIndicator', 10);

      expect(value).toBeNull();
    });
  });

  describe('getIndicatorSeries', () => {
    it('should return full series for indicator', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 10 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'sma');

      expect(series).toHaveLength(30);
    });

    it('should return price series', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const series = engine.getIndicatorSeries(indicators, 'close');

      expect(series).toHaveLength(30);
      expect(series[0]).toBe(100);
      expect(series[29]).toBe(129);
    });

    it('should return empty array for invalid reference', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const series = engine.getIndicatorSeries(indicators, 'invalid');

      expect(series).toEqual([]);
    });
  });
});
