import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { PineMarketProvider } from '../PineMarketProvider';

const makeKline = (openTime: number, base: number, intervalMs = 3600000): Kline => ({
  openTime,
  open: String(base),
  high: String(base + 50),
  low: String(base - 50),
  close: String(base),
  volume: '1000',
  closeTime: openTime + intervalMs - 1,
  quoteVolume: '0',
  trades: 100,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

describe('PineMarketProvider', () => {
  describe('getMarketData', () => {
    it('serves klines for a TF passed by its label form (1h, 4h, 1d)', async () => {
      const klines = Array.from({ length: 10 }, (_, i) => makeKline(i * 3600000, 100 + i));
      const provider = new PineMarketProvider({ '1h': klines });
      const result = await provider.getMarketData('BTCUSDT', '1h');
      expect(result).toHaveLength(10);
      expect(result[0]!.close).toBe(100);
    });

    it('serves klines for a TF passed by PineTS normalized form (60, 240, D)', async () => {
      const klines = Array.from({ length: 5 }, (_, i) => makeKline(i * 3600000, 200 + i));
      const provider = new PineMarketProvider({ '1h': klines });
      // PineTS internally normalizes '1h' to '60' before calling getMarketData.
      // The provider must accept both labels.
      const result = await provider.getMarketData('BTCUSDT', '60');
      expect(result).toHaveLength(5);
      expect(result[0]!.close).toBe(200);
    });

    it('throws a descriptive error when a TF is requested that is not pre-loaded', async () => {
      const klines = Array.from({ length: 5 }, (_, i) => makeKline(i * 3600000, 100 + i));
      const provider = new PineMarketProvider({ '4h': klines });
      // No '1d' klines loaded. PineTS internally normalizes '1d' to 'D'.
      await expect(provider.getMarketData('BTCUSDT', '1d'))
        .rejects.toThrow(/no klines registered for timeframe='1d'/);
      await expect(provider.getMarketData('BTCUSDT', 'D'))
        .rejects.toThrow(/no klines registered for timeframe='D'/);
    });

    it('error message lists the available timeframes so the author can fix the strategy header', async () => {
      const provider = new PineMarketProvider({ '4h': [], '1d': [] });
      try {
        await provider.getMarketData('BTCUSDT', '1w');
        expect.fail('should have thrown');
      } catch (e) {
        expect(String(e)).toMatch(/Available:.*\b4h\b/);
        expect(String(e)).toMatch(/Available:.*\b1d\b/);
        expect(String(e)).toMatch(/@requires-tf/);
      }
    });

    it('maps our String-form kline fields (open/high/low/close) to PineTS numeric form', async () => {
      const klines = [makeKline(0, 1234)];
      const provider = new PineMarketProvider({ '1h': klines });
      const [out] = await provider.getMarketData('BTCUSDT', '1h');
      expect(typeof out!.open).toBe('number');
      expect(typeof out!.close).toBe('number');
      expect(out!.close).toBe(1234);
    });
  });

  describe('getSupportedTimeframes', () => {
    it('exposes both label and PineTS-normalized form for every loaded TF', () => {
      const provider = new PineMarketProvider({
        '1h': [],
        '4h': [],
        '1d': [],
      });
      const tfs = provider.getSupportedTimeframes();
      // Label form
      expect(tfs.has('1h')).toBe(true);
      expect(tfs.has('4h')).toBe(true);
      expect(tfs.has('1d')).toBe(true);
      // PineTS-normalized form — PineTS internally checks this set BEFORE
      // calling getMarketData, so both forms must be present or the
      // fast path (`_getMarketDataNative`) is skipped.
      expect(tfs.has('60')).toBe(true);
      expect(tfs.has('240')).toBe(true);
      expect(tfs.has('D')).toBe(true);
    });

    it('returns an empty set when no klines were loaded', () => {
      const provider = new PineMarketProvider({});
      expect(provider.getSupportedTimeframes().size).toBe(0);
    });
  });

  describe('getSymbolInfo', () => {
    it('returns a complete ISymbolInfo shape with tickerid populated', async () => {
      const provider = new PineMarketProvider({});
      const info = await provider.getSymbolInfo('BTCUSDT');
      // PineTS strategies read syminfo.tickerid via `request.security(
      // syminfo.tickerid, '4h', close)`. If this field is missing/empty,
      // PineTS crashes at run time with "Cannot read properties of
      // undefined (reading 'tickerid')". The shape must have all 40+
      // fields from ISymbolInfo or TS will reject the assignment.
      expect(info.tickerid).toBe('BTCUSDT');
      expect(info.ticker).toBe('BTCUSDT');
      expect(info.mintick).toBeGreaterThan(0);
      expect(info.session).toBe('24x7');
      expect(info.timezone).toBe('Etc/UTC');
    });
  });
});
