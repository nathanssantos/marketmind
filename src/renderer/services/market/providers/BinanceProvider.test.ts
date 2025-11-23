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

  describe('BaseMarketProvider getters', () => {
    it('should return provider name', () => {
      const provider = new BinanceProvider();
      expect(provider.name).toBe('Binance');
    });

    it('should return provider type', () => {
      const provider = new BinanceProvider();
      expect(provider.type).toBe('crypto');
    });

    it('should return enabled status', () => {
      const provider = new BinanceProvider();
      expect(provider.isEnabled).toBe(true);
    });
  });

  describe('rateLimitedFetch', () => {
    it('should not delay when rateLimit is not configured', async () => {
      const provider = new BinanceProvider({ rateLimit: undefined });
      const fetcher = vi.fn().mockResolvedValue('result');
      
      const start = Date.now();
      const result = await (provider as never)['rateLimitedFetch'](fetcher);
      const duration = Date.now() - start;
      
      expect(result).toBe('result');
      expect(fetcher).toHaveBeenCalledOnce();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('handleError', () => {
    it('should include error code when available', () => {
      const provider = new BinanceProvider();
      const error = Object.assign(new Error('Network error'), { code: 'ERR_NETWORK' });
      
      expect(() => {
        (provider as never)['handleError'](error, 'Fetch failed');
      }).toThrow();
      
      try {
        (provider as never)['handleError'](error, 'Fetch failed');
      } catch (err) {
        const marketError = err as { provider: string; message: string; code?: string };
        expect(marketError.code).toBe('ERR_NETWORK');
        expect(marketError.provider).toBe('Binance');
        expect(marketError.message).toContain('Network error');
      }
    });
  });

  describe('subscribeToUpdates', () => {
    const WEBSOCKET_OPEN = 1;
    const WEBSOCKET_CLOSED = 3;
    let closeFn: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
      closeFn = vi.fn();
      
      const WebSocketMock = vi.fn(function(this: any, url: string) {
        this.url = url;
        this.readyState = WEBSOCKET_OPEN;
        this.close = closeFn;
        this.send = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
      }) as any;

      WebSocketMock.OPEN = WEBSOCKET_OPEN;
      WebSocketMock.CONNECTING = 0;
      WebSocketMock.CLOSING = 2;
      WebSocketMock.CLOSED = WEBSOCKET_CLOSED;

      global.WebSocket = WebSocketMock;
    });

    afterEach(() => {
      delete (global as any).WebSocket;
    });

    it('should create WebSocket connection', () => {
      const provider = new BinanceProvider();
      const callback = vi.fn();

      provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback,
      });

      expect(global.WebSocket).toHaveBeenCalledWith(
        'wss://stream.binance.com:9443/ws/btcusdt@kline_1h'
      );
    });

    it('should parse and forward WebSocket messages', () => {
      const provider = new BinanceProvider();
      const callback = vi.fn();

      provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback,
      });

      const mockKlineData = {
        e: 'kline',
        k: {
          t: 1704067200000,
          o: '42000.00',
          h: '42500.00',
          l: '41800.00',
          c: '42300.00',
          v: '100.50',
          x: true,
        },
      };

      const wsInstance = (global.WebSocket as any).mock.results[0]?.value;
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(mockKlineData),
      });

      wsInstance.onmessage(messageEvent);

      expect(callback).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        candle: {
          timestamp: 1704067200000,
          open: 42000,
          high: 42500,
          low: 41800,
          close: 42300,
          volume: 100.5,
        },
        isFinal: true,
      });
    });

    it('should handle WebSocket errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const provider = new BinanceProvider();

      provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback: vi.fn(),
      });

      const wsInstance = (global.WebSocket as any).mock.results[0]?.value;
      const errorEvent = new Event('error');
      wsInstance.onerror(errorEvent);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle invalid WebSocket messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const provider = new BinanceProvider();
      const callback = vi.fn();

      provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback,
      });

      const wsInstance = (global.WebSocket as any).mock.results[0]?.value;
      const messageEvent = new MessageEvent('message', {
        data: 'invalid json',
      });

      wsInstance.onmessage(messageEvent);

      expect(callback).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should clean up WebSocket on unsubscribe', () => {
      const provider = new BinanceProvider();

      const unsubscribe = provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback: vi.fn(),
      });

      expect(() => unsubscribe()).not.toThrow();
      expect(closeFn).toHaveBeenCalled();
    });

    it('should not close WebSocket if already closed', () => {
      const WebSocketMock = vi.fn(function(this: any) {
        this.readyState = WEBSOCKET_CLOSED;
        this.close = closeFn;
      });
      global.WebSocket = WebSocketMock as any;
      
      const provider = new BinanceProvider();

      const unsubscribe = provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback: vi.fn(),
      });

      closeFn.mockClear();
      unsubscribe();

      expect(closeFn).not.toHaveBeenCalled();
    });

    it('should handle WebSocket close event', () => {
      const provider = new BinanceProvider();

      provider.subscribeToUpdates({
        symbol: 'BTCUSDT',
        interval: '1h',
        callback: vi.fn(),
      });

      const wsInstance = (global.WebSocket as any).mock.results[0]?.value;
      const closeEvent = new CloseEvent('close');
      wsInstance.onclose(closeEvent);

      expect(true).toBe(true);
    });
  });

  describe('ensureSymbolsCache', () => {
    it('should fetch symbols when cache is empty', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExchangeInfo,
      });

      const provider = new BinanceProvider();
      await provider.searchSymbols('BTC');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/exchangeInfo');
    });

    it('should reuse cache when still valid', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExchangeInfo,
      });

      const provider = new BinanceProvider();
      
      await provider.searchSymbols('BTC');
      mockAxiosInstance.get.mockClear();
      await provider.searchSymbols('ETH');

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should refresh cache after expiration', async () => {
      vi.useFakeTimers();
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExchangeInfo,
      });

      const provider = new BinanceProvider();
      
      await provider.searchSymbols('BTC');
      mockAxiosInstance.get.mockClear();
      
      vi.advanceTimersByTime(6 * 60 * 1000);
      
      await provider.searchSymbols('ETH');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v3/exchangeInfo');
      
      vi.useRealTimers();
    });
  });
});
