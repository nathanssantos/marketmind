import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRateCache, fetchUsdtBrlRate, getCachedRate } from './exchangeRateService';

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
    });
  });
});
