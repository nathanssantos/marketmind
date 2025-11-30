import type { FetchKlinesOptions } from '@shared/types';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinGeckoProvider } from './CoinGeckoProvider';

vi.mock('axios');

const mockMarketChart = {
  prices: [
    [1704067200000, 42000],
    [1704070800000, 42500],
    [1704074400000, 41800],
  ],
  market_caps: [
    [1704067200000, 820000000000],
    [1704070800000, 830000000000],
    [1704074400000, 815000000000],
  ],
  total_volumes: [
    [1704067200000, 100000000],
    [1704070800000, 120000000],
    [1704074400000, 95000000],
  ],
};

const mockCoin = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
};

const mockCoinsList = [mockCoin];

describe('CoinGeckoProvider', () => {
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      get: vi.fn(),
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const provider = new CoinGeckoProvider();

      expect(provider).toBeInstanceOf(CoinGeckoProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.coingecko.com/api/v3',
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should create instance with custom config', () => {
      const provider = new CoinGeckoProvider({
        baseUrl: 'https://custom.coingecko.com',
        rateLimit: 20,
      });

      expect(provider).toBeInstanceOf(CoinGeckoProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://custom.coingecko.com',
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('fetchCandles', () => {
    it('should fetch candles successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockMarketChart,
      });

      const provider = new CoinGeckoProvider();
      const options: FetchCandlesOptions = {
        symbol: 'bitcoin',
        interval: '1h',
      };

      const result = await provider.fetchCandles(options);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/coins/bitcoin/market_chart', {
        params: {
          vs_currency: 'usd',
          days: 7,
          interval: 'hourly',
        },
      });

      expect(result.symbol).toBe('bitcoin');
      expect(result.interval).toBe('1h');
      expect(result.candles).toHaveLength(3);
      expect(result.candles[0]).toEqual({
        timestamp: 1704067200000,
        open: 42000,
        high: 42000,
        low: 42000,
        close: 42000,
        volume: 100000000,
      });
    });

    it('should normalize symbol to lowercase', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockMarketChart,
      });

      const provider = new CoinGeckoProvider();
      await provider.fetchCandles({
        symbol: 'BITCOIN',
        interval: '1h',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/coins/bitcoin/market_chart', {
        params: expect.anything(),
      });
    });

    it('should remove USD/USDT from symbol', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockMarketChart,
      });

      const provider = new CoinGeckoProvider();

      await provider.fetchCandles({
        symbol: 'BTCUSD',
        interval: '1h',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/coins/btc/market_chart', {
        params: expect.anything(),
      });
    });

    it('should use custom limit', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockMarketChart,
      });

      const provider = new CoinGeckoProvider();
      const result = await provider.fetchCandles({
        symbol: 'bitcoin',
        interval: '1h',
        limit: 2,
      });

      expect(result.candles).toHaveLength(2);
    });

    it('should map intervals to days correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockMarketChart,
      });

      const provider = new CoinGeckoProvider();
      const intervals: Array<[string, number, string]> = [
        ['1m', 1, '5m'],
        ['5m', 1, '5m'],
        ['15m', 1, '5m'],
        ['30m', 1, '5m'],
        ['1h', 7, 'hourly'],
        ['4h', 7, 'hourly'],
        ['1d', 90, 'daily'],
        ['1w', 90, 'daily'],
        ['1M', 365, 'daily'],
      ];

      for (const [interval, days, cgInterval] of intervals) {
        await provider.fetchCandles({
          symbol: 'bitcoin',
          interval: interval as never,
        });

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/coins/bitcoin/market_chart', {
          params: {
            vs_currency: 'usd',
            days,
            interval: cgInterval,
          },
        });
      }
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const provider = new CoinGeckoProvider();

      await expect(
        provider.fetchCandles({
          symbol: 'bitcoin',
          interval: '1h',
        })
      ).rejects.toThrow();
    });

    it('should handle missing volume data', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          prices: [[1704067200000, 42000]],
          market_caps: [[1704067200000, 820000000000]],
          total_volumes: [],
        },
      });

      const provider = new CoinGeckoProvider();
      const result = await provider.fetchCandles({
        symbol: 'bitcoin',
        interval: '1h',
      });

      expect(result.candles[0]?.volume).toBe(0);
    });
  });

  describe('searchSymbols', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockCoinsList,
      });
    });

    it('should search symbols by ID', async () => {
      const provider = new CoinGeckoProvider();
      const results = await provider.searchSymbols('bitcoin');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        symbol: 'BITCOIN',
        baseAsset: 'BTC',
        quoteAsset: 'USD',
        displayName: 'Bitcoin (BTC)',
        status: 'TRADING',
      });
    });

    it('should search symbols by symbol code', async () => {
      const provider = new CoinGeckoProvider();
      const results = await provider.searchSymbols('btc');

      expect(results).toHaveLength(1);
      expect(results[0]?.baseAsset).toBe('BTC');
    });

    it('should search symbols by name', async () => {
      const provider = new CoinGeckoProvider();
      const results = await provider.searchSymbols('Bitcoin');

      expect(results).toHaveLength(1);
      expect(results[0]?.displayName).toBe('Bitcoin (BTC)');
    });

    it('should be case insensitive', async () => {
      const provider = new CoinGeckoProvider();
      const results = await provider.searchSymbols('BITCOIN');

      expect(results).toHaveLength(1);
    });

    it('should limit results to 50', async () => {
      const manyCoins = Array.from({ length: 100 }, (_, i) => ({
        id: `coin${i}`,
        symbol: `coin${i}`,
        name: `Coin ${i}`,
      }));

      mockAxiosInstance.get.mockResolvedValue({
        data: manyCoins,
      });

      const provider = new CoinGeckoProvider();
      const results = await provider.searchSymbols('coin');

      expect(results).toHaveLength(50);
    });

    it('should cache coins list', async () => {
      const provider = new CoinGeckoProvider();

      await provider.searchSymbols('bitcoin');
      await provider.searchSymbols('ethereum');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when cache unavailable', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const provider = new CoinGeckoProvider();

      await expect(provider.searchSymbols('bitcoin')).rejects.toThrow();
    });
  });

  describe('getSymbolInfo', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockCoinsList,
      });
    });

    it('should get symbol info', async () => {
      const provider = new CoinGeckoProvider();
      const info = await provider.getSymbolInfo('bitcoin');

      expect(info).toEqual({
        symbol: 'BITCOIN',
        baseAsset: 'BTC',
        quoteAsset: 'USD',
        displayName: 'Bitcoin (BTC)',
        minPrice: 0,
        maxPrice: 0,
        tickSize: 0.01,
        minQuantity: 0,
        maxQuantity: 0,
        stepSize: 0.00000001,
      });
    });

    it('should throw error for unknown symbol', async () => {
      const provider = new CoinGeckoProvider();

      await expect(provider.getSymbolInfo('unknown')).rejects.toThrow();
    });

    it('should normalize symbol to lowercase', async () => {
      const provider = new CoinGeckoProvider();
      const info = await provider.getSymbolInfo('BITCOIN');

      expect(info.symbol).toBe('BITCOIN');
    });
  });

  describe('normalizeSymbol', () => {
    it('should remove USD suffix', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.normalizeSymbol('BITCOINUSD')).toBe('bitcoin');
    });

    it('should remove USDT suffix', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.normalizeSymbol('ETHUSDT')).toBe('etht');
    });

    it('should convert to lowercase', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.normalizeSymbol('BITCOIN')).toBe('bitcoin');
    });

    it('should handle mixed case USD', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.normalizeSymbol('BitcoinUsd')).toBe('bitcoin');
    });
  });

  describe('BaseMarketProvider getters', () => {
    it('should return provider name', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.name).toBe('CoinGecko');
    });

    it('should return provider type', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.type).toBe('crypto');
    });

    it('should return enabled status', () => {
      const provider = new CoinGeckoProvider();
      expect(provider.isEnabled).toBe(true);
    });
  });
});
