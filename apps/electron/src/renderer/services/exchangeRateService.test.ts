import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRateCache, fetchExchangeRate, fetchUsdtBrlRate, getCachedRate } from './exchangeRateService';

describe('exchangeRateService', () => {
  beforeEach(() => {
    clearRateCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchUsdtBrlRate', () => {
    it('should fetch rate from Binance API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.50' }),
      });

      const rate = await fetchUsdtBrlRate();
      expect(rate).toBe(5.5);
      expect(fetch).toHaveBeenCalledWith('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
    });

    it('should return cached rate if within TTL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.50' }),
      });

      await fetchUsdtBrlRate();
      await fetchUsdtBrlRate();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return fallback rate on API error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const rate = await fetchUsdtBrlRate();
      expect(rate).toBe(6.0);
    });

    it('should return fallback rate on invalid response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: 'invalid' }),
      });

      const rate = await fetchUsdtBrlRate();
      expect(rate).toBe(6.0);
    });
  });

  describe('fetchExchangeRate', () => {
    it('should return 1 for same currency', async () => {
      const rate = await fetchExchangeRate('USD', 'USD');
      expect(rate).toBe(1);
    });

    it('should fetch USDT→BRL via Binance', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.80' }),
      });

      const rate = await fetchExchangeRate('USDT', 'BRL');
      expect(rate).toBe(5.8);
      expect(fetch).toHaveBeenCalledWith('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
    });

    it('should fetch BTC→USDT via Binance', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '95000' }),
      });

      const rate = await fetchExchangeRate('BTC', 'USDT');
      expect(rate).toBe(95000);
      expect(fetch).toHaveBeenCalledWith('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    });

    it('should fetch reverse pair (BRL→USDT) by inverting', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.00' }),
      });

      const rate = await fetchExchangeRate('BRL', 'USDT');
      expect(rate).toBe(0.2);
    });

    it('should fetch USD→BRL using USDT→BRL as proxy', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '6.00' }),
      });

      const rate = await fetchExchangeRate('USD', 'BRL');
      expect(rate).toBe(6.0);
    });

    it('should cache rates per pair', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.50' }),
      });

      await fetchExchangeRate('USDT', 'BRL');
      await fetchExchangeRate('USDT', 'BRL');

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return fallback on error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const rate = await fetchExchangeRate('USDT', 'BRL');
      expect(rate).toBe(6.0);
    });
  });

  describe('getCachedRate', () => {
    it('should return null when no rate is cached', () => {
      expect(getCachedRate()).toBeNull();
    });

    it('should return cached rate after fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: '5.75' }),
      });

      await fetchUsdtBrlRate();
      expect(getCachedRate()).toBe(5.75);
      expect(getCachedRate('USDT', 'BRL')).toBe(5.75);
    });

    it('should return null for uncached pair', () => {
      expect(getCachedRate('EUR', 'BRL')).toBeNull();
    });
  });
});
