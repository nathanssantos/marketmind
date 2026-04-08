import { describe, it, expect } from 'vitest';
import type { Kline } from '@marketmind/types';
import { calculateSMA, calculateEMA, calculateRSI, calculateATR, calculateMACD } from '@marketmind/indicators';
import { PineIndicatorService } from '../PineIndicatorService';

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

const TOLERANCE = 0.02;

const comparePineVsLegacy = (
  pine: (number | null)[],
  legacy: (number | null)[],
  label: string,
  tolerance = TOLERANCE
) => {
  let compared = 0;

  for (let i = 0; i < Math.min(pine.length, legacy.length); i++) {
    const pv = pine[i];
    const lv = legacy[i];
    if (pv == null || lv == null) continue;
    if (Math.abs(lv) < 0.0001) continue;

    const relDiff = Math.abs(pv - lv) / Math.abs(lv);
    compared++;

    if (relDiff > tolerance) {
      throw new Error(`${label} mismatch at [${i}]: pine=${pv}, legacy=${lv}, diff=${(relDiff * 100).toFixed(4)}%`);
    }
  }

  expect(compared).toBeGreaterThan(0);
};

describe('PineIndicatorService', () => {
  const service = new PineIndicatorService();
  const klines = makeKlines(200);

  describe('parity with @marketmind/indicators', () => {
    it('SMA matches', async () => {
      const pine = await service.computeSMA(klines, 20);
      const legacy = calculateSMA(klines, 20);
      comparePineVsLegacy(pine, legacy, 'SMA(20)');
    });

    it('EMA matches', async () => {
      const pine = await service.computeEMA(klines, 20);
      const legacy = calculateEMA(klines, 20);
      comparePineVsLegacy(pine, legacy, 'EMA(20)');
    });

    it('RSI matches', async () => {
      const pine = await service.computeRSI(klines, 14);
      const legacy = calculateRSI(klines, 14).values;
      comparePineVsLegacy(pine, legacy, 'RSI(14)');
    });

    it('ATR matches', async () => {
      const pine = await service.computeATR(klines, 14);
      const legacy = calculateATR(klines, 14);
      comparePineVsLegacy(pine, legacy, 'ATR(14)');
    });

    it('MACD matches', async () => {
      const pine = await service.computeMACD(klines);
      const legacy = calculateMACD(klines, 12, 26, 9);
      comparePineVsLegacy(pine['line']!, legacy.macd, 'MACD line');
      comparePineVsLegacy(pine['signal']!, legacy.signal, 'MACD signal');
    });
  });

  describe('single-output indicators', () => {
    const singleTypes = ['sma', 'ema', 'rsi', 'atr', 'hma', 'wma', 'cci', 'mfi', 'roc', 'cmo', 'vwap', 'obv', 'wpr', 'tsi', 'sar', 'highest', 'lowest'] as const;

    for (const type of singleTypes) {
      it(`${type} should return valid values`, async () => {
        const result = await service.compute(type, klines, { period: 14 });
        expect(result.length).toBe(klines.length);
        const valid = result.filter((v) => v !== null);
        expect(valid.length).toBeGreaterThan(0);
      });
    }
  });

  describe('multi-output indicators', () => {
    it('BB returns middle, upper, lower', async () => {
      const result = await service.computeBB(klines, 20, 2);
      expect(result['middle']).toBeDefined();
      expect(result['upper']).toBeDefined();
      expect(result['lower']).toBeDefined();
      expect(result['middle']!.length).toBe(klines.length);

      const validMiddle = result['middle']!.filter((v) => v !== null);
      expect(validMiddle.length).toBeGreaterThan(0);

      for (let i = 0; i < klines.length; i++) {
        const m = result['middle']![i];
        const u = result['upper']![i];
        const l = result['lower']![i];
        if (m != null && u != null && l != null) {
          expect(u).toBeGreaterThan(m);
          expect(l).toBeLessThan(m);
        }
      }
    });

    it('Stochastic returns k, d', async () => {
      const result = await service.computeStochastic(klines, 14, 3);
      expect(result['k']).toBeDefined();
      expect(result['d']).toBeDefined();

      const validK = result['k']!.filter((v) => v !== null);
      expect(validK.length).toBeGreaterThan(0);

      for (const v of validK) {
        expect(v!).toBeGreaterThanOrEqual(0);
        expect(v!).toBeLessThanOrEqual(100);
      }
    });

    it('DMI returns plusDI, minusDI, adx', async () => {
      const result = await service.computeDMI(klines, 14);
      expect(result['plusDI']).toBeDefined();
      expect(result['minusDI']).toBeDefined();
      expect(result['adx']).toBeDefined();

      const validADX = result['adx']!.filter((v) => v !== null);
      expect(validADX.length).toBeGreaterThan(0);
    });

    it('Supertrend returns value, direction', async () => {
      const result = await service.computeSupertrend(klines, 3, 10);
      expect(result['value']).toBeDefined();
      expect(result['direction']).toBeDefined();

      const validValues = result['value']!.filter((v) => v !== null);
      expect(validValues.length).toBeGreaterThan(0);
    });

    it('Keltner Channels returns middle, upper, lower', async () => {
      const result = await service.computeMulti('kc', klines, { period: 20, multiplier: 2 });
      expect(result['middle']).toBeDefined();
      expect(result['upper']).toBeDefined();
      expect(result['lower']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('returns empty for empty klines', async () => {
      expect(await service.compute('sma', [], { period: 20 })).toEqual([]);
      expect(await service.computeMulti('macd', [])).toEqual({});
    });

    it('throws for unsupported type', async () => {
      await expect(service.compute('nonexistent' as any, klines)).rejects.toThrow('Unsupported');
      await expect(service.computeMulti('nonexistent' as any, klines)).rejects.toThrow('Unsupported');
    });

    it('handles short klines gracefully', async () => {
      const shortKlines = makeKlines(5);
      const result = await service.compute('sma', shortKlines, { period: 20 });
      expect(result.length).toBe(5);
    });
  });
});
