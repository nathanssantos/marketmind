import { describe, it, expect, beforeEach } from 'vitest';
import type { Kline } from '@marketmind/types';
import { PineIndicatorCache } from '../PineIndicatorCache';

const makeKlines = (count: number, base = 50000, amplitude = 5000): Kline[] =>
  Array.from({ length: count }, (_, i) => ({
    openTime: 1700000000000 + i * 3600000,
    open: String(base + Math.sin(i * 0.1) * amplitude + i * 5),
    high: String(base + Math.sin(i * 0.1) * amplitude + i * 5 + 200 + Math.random() * 100),
    low: String(base + Math.sin(i * 0.1) * amplitude + i * 5 - 200 - Math.random() * 100),
    close: String(base + Math.sin(i * 0.1) * amplitude + i * 5 + 50),
    volume: String(1000 + i * 10 + Math.random() * 500),
    closeTime: 1700000000000 + i * 3600000 + 3599999,
    quoteVolume: '0',
    trades: 100,
    takerBuyBaseVolume: '0',
    takerBuyQuoteVolume: '0',
  }));

describe('PineIndicatorCache', () => {
  let cache: PineIndicatorCache;
  const klines = makeKlines(100);

  beforeEach(async () => {
    cache = new PineIndicatorCache();
    await cache.initialize(klines);
  });

  describe('getOrCompute', () => {
    it('should compute and cache single indicators', async () => {
      const result1 = await cache.getOrCompute('ema', { period: 20 });
      const result2 = await cache.getOrCompute('ema', { period: 20 });
      expect(result1).toBe(result2);
      expect(result1.length).toBe(klines.length);
    });

    it('should differentiate by params', async () => {
      const ema20 = await cache.getOrCompute('ema', { period: 20 });
      const ema50 = await cache.getOrCompute('ema', { period: 50 });
      expect(ema20).not.toBe(ema50);
    });

    it('should return valid values', async () => {
      const result = await cache.getOrCompute('sma', { period: 10 });
      const valid = result.filter((v) => v !== null);
      expect(valid.length).toBeGreaterThan(0);
    });
  });

  describe('getOrComputeMulti', () => {
    it('should compute and cache multi-output indicators', async () => {
      const result1 = await cache.getOrComputeMulti('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
      const result2 = await cache.getOrComputeMulti('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
      expect(result1).toBe(result2);
      expect(result1['line']).toBeDefined();
      expect(result1['signal']).toBeDefined();
      expect(result1['histogram']).toBeDefined();
    });

    it('should differentiate multi indicators by type', async () => {
      const macd = await cache.getOrComputeMulti('macd');
      const bb = await cache.getOrComputeMulti('bb');
      expect(macd).not.toBe(bb);
      expect(macd['line']).toBeDefined();
      expect(bb['middle']).toBeDefined();
    });
  });

  describe('precompute', () => {
    it('should precompute single indicators', async () => {
      await cache.precompute([
        { type: 'ema', params: { period: 20 } },
        { type: 'rsi', params: { period: 14 } },
      ]);
      expect(cache.getEMA(20).length).toBe(klines.length);
      expect(cache.getRSI(14).length).toBe(klines.length);
    });

    it('should precompute multi indicators', async () => {
      await cache.precompute([
        { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
        { type: 'stoch', params: { period: 14, smoothK: 3 } },
      ]);
      expect(cache.getMACD()['line']).toBeDefined();
      expect(cache.getStochastic()['k']).toBeDefined();
    });

    it('should skip unknown indicator types', async () => {
      await expect(cache.precompute([{ type: 'unknown_indicator' }])).resolves.not.toThrow();
    });
  });

  describe('convenience getters', () => {
    it('getEMA returns cached EMA', async () => {
      await cache.getOrCompute('ema', { period: 50 });
      const result = cache.getEMA(50);
      expect(result.length).toBe(klines.length);
    });

    it('getSMA returns cached SMA', async () => {
      await cache.getOrCompute('sma', { period: 20 });
      const result = cache.getSMA(20);
      expect(result.length).toBe(klines.length);
    });

    it('getRSI returns cached RSI', async () => {
      await cache.getOrCompute('rsi', { period: 14 });
      const result = cache.getRSI(14);
      expect(result.length).toBe(klines.length);
    });

    it('getATR returns cached ATR', async () => {
      await cache.getOrCompute('atr', { period: 14 });
      const result = cache.getATR(14);
      expect(result.length).toBe(klines.length);
    });

    it('getStochastic returns cached stoch', async () => {
      await cache.getOrComputeMulti('stoch', { period: 14, smoothK: 3 });
      const result = cache.getStochastic(14, 3);
      expect(result['k']).toBeDefined();
      expect(result['d']).toBeDefined();
    });

    it('getDMI returns cached DMI', async () => {
      await cache.getOrComputeMulti('dmi', { period: 14 });
      const result = cache.getDMI(14);
      expect(result['plusDI']).toBeDefined();
      expect(result['minusDI']).toBeDefined();
      expect(result['adx']).toBeDefined();
    });

    it('getSupertrend returns cached supertrend', async () => {
      await cache.getOrComputeMulti('supertrend', { multiplier: 3, period: 10 });
      const result = cache.getSupertrend(3, 10);
      expect(result['value']).toBeDefined();
      expect(result['direction']).toBeDefined();
    });

    it('getBB returns cached BB', async () => {
      await cache.getOrComputeMulti('bb', { period: 20, stdDev: 2 });
      const result = cache.getBB(20, 2);
      expect(result['middle']).toBeDefined();
      expect(result['upper']).toBeDefined();
      expect(result['lower']).toBeDefined();
    });

    it('returns empty array for uncached single indicators', () => {
      expect(cache.getEMA(99)).toEqual([]);
      expect(cache.getSMA(99)).toEqual([]);
    });

    it('returns empty object for uncached multi indicators', () => {
      expect(cache.getStochastic(99, 99)).toEqual({});
      expect(cache.getDMI(99)).toEqual({});
    });
  });

  describe('initialize', () => {
    it('should clear cache on re-initialize', async () => {
      await cache.getOrCompute('ema', { period: 20 });
      expect(cache.getEMA(20).length).toBe(klines.length);

      const newKlines = makeKlines(50);
      await cache.initialize(newKlines);
      expect(cache.getEMA(20)).toEqual([]);
    });
  });
});
