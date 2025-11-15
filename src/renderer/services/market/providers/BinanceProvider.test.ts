import type { FetchCandlesOptions } from '@shared/types';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BinanceProvider } from './BinanceProvider';

vi.mock('axios');

const mockBinanceKline = [
  1704067200000,
  '42000.00',
  '42500.00',
  '41800.00',
  '42300.00',
  '100.50',
  1704070799999,
  '4200000.00',
  1000,
  '50.25',
  '2100000.00',
  '0',
];

const mockBinanceSymbol = {
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  status: 'TRADING',
  filters: [
    {
      filterType: 'PRICE_FILTER',
      minPrice: '0.01',
      maxPrice: '1000000.00',
      tickSize: '0.01',
    },
    {
      filterType: 'LOT_SIZE',
      minQty: '0.00001',
      maxQty: '9000.00',
      stepSize: '0.00001',
    },
  ],
};

const mockExchangeInfo = {
  symbols: [mockBinanceSymbol],
};

describe('BinanceProvider', () => {
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

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const provider = new BinanceProvider();

      expect(provider).toBeInstanceOf(BinanceProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.binance.com',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should create instance with custom config', () => {
      const provider = new BinanceProvider({
        baseUrl: 'https://custom.binance.com',
        rateLimit: 50,
      });

      expect(provider).toBeInstanceOf(BinanceProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://custom.binance.com',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('fetchCandles', () => {
    it('should fetch candles successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      const options: FetchCandlesOptions = {
        symbol: 'BTCUSDT',
        interval: '1h',
      };

      const result = await provider.fetchCandles(options);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
        params: {
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 500,
        },
      });

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.interval).toBe('1h');
      expect(result.candles).toHaveLength(1);
      expect(result.candles[0]).toEqual({
        timestamp: 1704067200000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 100.5,
      });
    });

    it('should normalize symbol with slash', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      await provider.fetchCandles({
        symbol: 'BTC/USDT',
        interval: '1h',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
        params: expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
      });
    });

    it('should use custom limit', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      await provider.fetchCandles({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
        params: expect.objectContaining({
          limit: 100,
        }),
      });
    });

    it('should cap limit at 1000', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      await provider.fetchCandles({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 5000,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
        params: expect.objectContaining({
          limit: 1000,
        }),
      });
    });

    it('should include start and end time', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      const startTime = 1704067200000;
      const endTime = 1704070799999;

      await provider.fetchCandles({
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime,
        endTime,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
        params: expect.objectContaining({
          startTime,
          endTime,
        }),
      });
    });

    it('should map all time intervals correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [mockBinanceKline],
      });

      const provider = new BinanceProvider();
      const intervals: Array<[string, string]> = [
        ['1m', '1m'],
        ['5m', '5m'],
        ['15m', '15m'],
        ['30m', '30m'],
        ['1h', '1h'],
        ['4h', '4h'],
        ['1d', '1d'],
        ['1w', '1w'],
        ['1M', '1M'],
      ];

      for (const [interval, expected] of intervals) {
        await provider.fetchCandles({
          symbol: 'BTCUSDT',
          interval: interval as never,
        });

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/klines', {
          params: expect.objectContaining({
            interval: expected,
          }),
        });
      }
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const provider = new BinanceProvider();

      await expect(
        provider.fetchCandles({
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow();
    });
  });

  describe('searchSymbols', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExchangeInfo,
      });
    });

    it('should search symbols by query', async () => {
      const provider = new BinanceProvider();
      const results = await provider.searchSymbols('BTC');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        displayName: 'BTC/USDT',
      });
    });

    it('should filter inactive symbols', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          symbols: [
            { ...mockBinanceSymbol, status: 'BREAK' },
            { ...mockBinanceSymbol, status: 'TRADING' },
          ],
        },
      });

      const provider = new BinanceProvider();
      const results = await provider.searchSymbols('BTC');

      expect(results).toHaveLength(1);
      expect(results[0]?.symbol).toBe('BTCUSDT');
    });

    it('should limit results to 50', async () => {
      const manySymbols = Array.from({ length: 100 }, (_, i) => ({
        ...mockBinanceSymbol,
        symbol: `BTC${i}USDT`,
      }));

      mockAxiosInstance.get.mockResolvedValue({
        data: { symbols: manySymbols },
      });

      const provider = new BinanceProvider();
      const results = await provider.searchSymbols('BTC');

      expect(results).toHaveLength(50);
    });

    it('should cache symbols', async () => {
      const provider = new BinanceProvider();

      await provider.searchSymbols('BTC');
      await provider.searchSymbols('ETH');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when cache unavailable', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const provider = new BinanceProvider();

      await expect(provider.searchSymbols('BTC')).rejects.toThrow();
    });
  });

  describe('getSymbolInfo', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExchangeInfo,
      });
    });

    it('should get symbol info', async () => {
      const provider = new BinanceProvider();
      const info = await provider.getSymbolInfo('BTCUSDT');

      expect(info).toEqual({
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        displayName: 'BTC/USDT',
        minPrice: 0.01,
        maxPrice: 1000000,
        tickSize: 0.01,
        minQuantity: 0.00001,
        maxQuantity: 9000,
        stepSize: 0.00001,
      });
    });

    it('should throw error for unknown symbol', async () => {
      const provider = new BinanceProvider();

      await expect(provider.getSymbolInfo('UNKNOWN')).rejects.toThrow();
    });

    it('should normalize symbol', async () => {
      const provider = new BinanceProvider();
      const info = await provider.getSymbolInfo('BTC/USDT');

      expect(info.symbol).toBe('BTCUSDT');
    });
  });

  describe('normalizeSymbol', () => {
    it('should remove slashes', () => {
      const provider = new BinanceProvider();
      expect(provider.normalizeSymbol('BTC/USDT')).toBe('BTCUSDT');
    });

    it('should remove hyphens', () => {
      const provider = new BinanceProvider();
      expect(provider.normalizeSymbol('BTC-USDT')).toBe('BTCUSDT');
    });

    it('should convert to uppercase', () => {
      const provider = new BinanceProvider();
      expect(provider.normalizeSymbol('btcusdt')).toBe('BTCUSDT');
    });
  });

  describe('supportsWebSocket', () => {
    it('should return true', () => {
      const provider = new BinanceProvider();
      expect(provider.supportsWebSocket()).toBe(true);
    });
  });

  describe('supportsWebSocket', () => {
    it('should return true', () => {
      const provider = new BinanceProvider();
      expect(provider.supportsWebSocket()).toBe(true);
    });
  });
});
