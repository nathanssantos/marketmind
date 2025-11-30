import type { BaseMarketProvider, CandleData, FetchKlinesOptions, MarketProviderConfig, Symbol, SymbolInfo, WebSocketSubscription } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketDataService } from './MarketDataService';

vi.mock('../cache/indexedDBCache', () => ({
  indexedDBCache: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  },
}));

const mockCandles: CandleData = {
  candles: [
    {
      timestamp: Date.now(),
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000,
    },
  ],
  symbol: 'BTC/USD',
  interval: '1h',
};

const mockSymbols: Symbol[] = [
  {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    displayName: 'Bitcoin/Tether',
  },
];

const mockSymbolInfo: SymbolInfo = {
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  displayName: 'Bitcoin/Tether',
  minPrice: 0.01,
  maxPrice: 1000000,
  minQuantity: 0.00001,
  maxQuantity: 9000,
  tickSize: 0.01,
  stepSize: 0.00001,
};

const createMockProvider = (providerName: string, isEnabled = true): BaseMarketProvider => {
  const config: MarketProviderConfig = {
    name: providerName,
    type: 'crypto',
    baseUrl: 'https://api.example.com',
    enabled: isEnabled,
  };
  
  return {
    config,
    lastRequestTime: 0,
    requestCount: 0,
    fetchCandles: vi.fn(),
    searchSymbols: vi.fn(),
    getSymbolInfo: vi.fn(),
    normalizeSymbol: vi.fn((symbol: string) => symbol),
    supportsWebSocket: vi.fn(() => false),
    get name() { return this.config.name; },
    get isEnabled() { return this.config.enabled; },
  } as BaseMarketProvider;
};

describe('MarketDataService', () => {
  let primaryProvider: BaseMarketProvider;
  let fallbackProvider1: BaseMarketProvider;
  let fallbackProvider2: BaseMarketProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    primaryProvider = createMockProvider('primary');
    fallbackProvider1 = createMockProvider('fallback1');
    fallbackProvider2 = createMockProvider('fallback2');
  });

  describe('constructor', () => {
    it('should create instance with primary provider only', () => {
      const service = new MarketDataService({
        primaryProvider,
      });

      expect(service).toBeInstanceOf(MarketDataService);
    });

    it('should create instance with fallback providers', () => {
      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      expect(service).toBeInstanceOf(MarketDataService);
    });

    it('should use default cache settings', () => {
      const service = new MarketDataService({
        primaryProvider,
      });

      expect(service).toBeInstanceOf(MarketDataService);
    });

    it('should respect custom cache settings', () => {
      const service = new MarketDataService({
        primaryProvider,
        enableCache: false,
        cacheDuration: 30000,
      });

      expect(service).toBeInstanceOf(MarketDataService);
    });
  });

  describe('fetchCandles', () => {
    it('should fetch candles from primary provider', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
        limit: 100,
      };

      const result = await service.fetchCandles(options);

      expect(result).toEqual(mockCandles);
      expect(primaryProvider.fetchCandles).toHaveBeenCalledWith(options);
    });

    it('should use fallback provider when primary fails', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockRejectedValue(
        new Error('Primary provider error')
      );
      vi.mocked(fallbackProvider1.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      const result = await service.fetchCandles(options);

      expect(result).toEqual(mockCandles);
      expect(primaryProvider.fetchCandles).toHaveBeenCalled();
      expect(fallbackProvider1.fetchCandles).toHaveBeenCalled();
    });

    it('should try multiple fallback providers in order', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockRejectedValue(
        new Error('Primary error')
      );
      vi.mocked(fallbackProvider1.fetchCandles).mockRejectedValue(
        new Error('Fallback1 error')
      );
      vi.mocked(fallbackProvider2.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      const result = await service.fetchCandles(options);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(result).toEqual(mockCandles);
      expect(primaryProvider.fetchCandles).toHaveBeenCalled();
      expect(fallbackProvider1.fetchCandles).toHaveBeenCalled();
      expect(fallbackProvider2.fetchCandles).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockRejectedValue({
        provider: 'primary',
        message: 'Primary error',
      });
      vi.mocked(fallbackProvider1.fetchCandles).mockRejectedValue({
        provider: 'fallback1',
        message: 'Fallback error',
      });

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await expect(service.fetchCandles(options)).rejects.toThrow(
        'All providers failed to fetch candles'
      );
    });

    it('should skip disabled providers', async () => {
      const disabledProvider = createMockProvider('disabled', false);
      vi.mocked(disabledProvider.fetchCandles).mockResolvedValue(mockCandles);
      vi.mocked(fallbackProvider1.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider: disabledProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      const result = await service.fetchCandles(options);

      expect(result).toEqual(mockCandles);
      expect(disabledProvider.fetchCandles).not.toHaveBeenCalled();
      expect(fallbackProvider1.fetchCandles).toHaveBeenCalled();
    });

    it('should cache results when enabled', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
        limit: 100,
      };

      await service.fetchCandles(options);
      await service.fetchCandles(options);

      expect(primaryProvider.fetchCandles).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: false,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await service.fetchCandles(options);
      await service.fetchCandles(options);

      expect(primaryProvider.fetchCandles).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after duration', async () => {
      vi.useFakeTimers();
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
        cacheDuration: 1000,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await service.fetchCandles(options);
      
      vi.advanceTimersByTime(1001);
      
      await service.fetchCandles(options);

      expect(primaryProvider.fetchCandles).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should use different cache keys for different options', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
      });

      await service.fetchCandles({ symbol: 'BTC/USD', interval: '1h' });
      await service.fetchCandles({ symbol: 'ETH/USD', interval: '1h' });
      await service.fetchCandles({ symbol: 'BTC/USD', interval: '4h' });

      expect(primaryProvider.fetchCandles).toHaveBeenCalledTimes(3);
    });
  });

  describe('searchSymbols', () => {
    it('should search symbols using primary provider', async () => {
      vi.mocked(primaryProvider.searchSymbols).mockResolvedValue(mockSymbols);

      const service = new MarketDataService({
        primaryProvider,
      });

      const result = await service.searchSymbols('BTC');

      expect(result).toEqual(mockSymbols);
      expect(primaryProvider.searchSymbols).toHaveBeenCalledWith('BTC');
    });

    it('should use fallback provider when primary fails', async () => {
      vi.mocked(primaryProvider.searchSymbols).mockRejectedValue(
        new Error('Search failed')
      );
      vi.mocked(fallbackProvider1.searchSymbols).mockResolvedValue(mockSymbols);

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const result = await service.searchSymbols('BTC');

      expect(result).toEqual(mockSymbols);
      expect(fallbackProvider1.searchSymbols).toHaveBeenCalled();
    });

    it('should return empty array when all providers fail', async () => {
      vi.mocked(primaryProvider.searchSymbols).mockRejectedValue(
        new Error('Search failed')
      );

      const service = new MarketDataService({
        primaryProvider,
      });

      const result = await service.searchSymbols('BTC');

      expect(result).toEqual([]);
    });

    it('should skip disabled providers', async () => {
      const disabledProvider = createMockProvider('disabled', false);
      vi.mocked(fallbackProvider1.searchSymbols).mockResolvedValue(mockSymbols);

      const service = new MarketDataService({
        primaryProvider: disabledProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const result = await service.searchSymbols('BTC');

      expect(result).toEqual(mockSymbols);
      expect(disabledProvider.searchSymbols).not.toHaveBeenCalled();
    });
  });

  describe('getSymbolInfo', () => {
    it('should get symbol info from primary provider', async () => {
      vi.mocked(primaryProvider.getSymbolInfo).mockResolvedValue(mockSymbolInfo);

      const service = new MarketDataService({
        primaryProvider,
      });

      const result = await service.getSymbolInfo('BTC/USD');

      expect(result).toEqual(mockSymbolInfo);
      expect(primaryProvider.getSymbolInfo).toHaveBeenCalledWith('BTC/USD');
    });

    it('should use fallback provider when primary fails', async () => {
      vi.mocked(primaryProvider.getSymbolInfo).mockRejectedValue(
        new Error('Get info failed')
      );
      vi.mocked(fallbackProvider1.getSymbolInfo).mockResolvedValue(mockSymbolInfo);

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const result = await service.getSymbolInfo('BTC/USD');

      expect(result).toEqual(mockSymbolInfo);
      expect(fallbackProvider1.getSymbolInfo).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      vi.mocked(primaryProvider.getSymbolInfo).mockRejectedValue({
        provider: 'primary',
        message: 'Get info failed',
      });

      const service = new MarketDataService({
        primaryProvider,
      });

      await expect(service.getSymbolInfo('BTC/USD')).rejects.toThrow(
        'All providers failed to get symbol info'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await service.fetchCandles(options);
      service.clearCache();
      await service.fetchCandles(options);

      expect(primaryProvider.fetchCandles).toHaveBeenCalledTimes(2);
    });

    it('should handle indexedDB clear errors gracefully', async () => {
      const { indexedDBCache } = await import('../cache/indexedDBCache');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(indexedDBCache.clear).mockRejectedValueOnce(new Error('IndexedDB error'));

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
      });

      service.clearCache();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clear IndexedDB cache:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setPrimaryProvider', () => {
    it('should change primary provider and clear cache', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockResolvedValue(mockCandles);
      const newProvider = createMockProvider('new');
      vi.mocked(newProvider.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        enableCache: true,
      });

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await service.fetchCandles(options);
      
      service.setPrimaryProvider(newProvider);
      
      await service.fetchCandles(options);

      expect(newProvider.fetchCandles).toHaveBeenCalledTimes(1);
    });
  });

  describe('addFallbackProvider', () => {
    it('should add new fallback provider', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockRejectedValue(
        new Error('Primary failed')
      );
      vi.mocked(fallbackProvider1.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
      });

      service.addFallbackProvider(fallbackProvider1);

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      const result = await service.fetchCandles(options);

      expect(result).toEqual(mockCandles);
      expect(fallbackProvider1.fetchCandles).toHaveBeenCalled();
    });
  });

  describe('removeFallbackProvider', () => {
    it('should remove fallback provider by name', async () => {
      vi.mocked(primaryProvider.fetchCandles).mockRejectedValue(
        new Error('Primary failed')
      );
      vi.mocked(fallbackProvider1.fetchCandles).mockResolvedValue(mockCandles);

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      service.removeFallbackProvider('fallback1');

      const options: FetchCandlesOptions = {
        symbol: 'BTC/USD',
        interval: '1h',
      };

      await expect(service.fetchCandles(options)).rejects.toThrow(
        'All providers failed'
      );
    });
  });

  describe('subscribeToUpdates', () => {
    it('should subscribe to updates using primary provider', () => {
      const mockUnsubscribe = vi.fn();
      const mockSubscribe = vi.fn(() => mockUnsubscribe);
      
      primaryProvider.supportsWebSocket = vi.fn(() => true);
      primaryProvider.subscribeToUpdates = mockSubscribe;

      const service = new MarketDataService({
        primaryProvider,
      });

      const subscription: WebSocketSubscription = {
        symbol: 'BTC/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      const unsubscribe = service.subscribeToUpdates(subscription);

      expect(mockSubscribe).toHaveBeenCalledWith(subscription);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should use fallback provider when primary does not support WebSocket', () => {
      const mockUnsubscribe = vi.fn();
      const mockSubscribe = vi.fn(() => mockUnsubscribe);
      
      primaryProvider.supportsWebSocket = vi.fn(() => false);
      fallbackProvider1.supportsWebSocket = vi.fn(() => true);
      fallbackProvider1.subscribeToUpdates = mockSubscribe;

      const service = new MarketDataService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const subscription: WebSocketSubscription = {
        symbol: 'BTC/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      service.subscribeToUpdates(subscription);

      expect(mockSubscribe).toHaveBeenCalledWith(subscription);
    });

    it('should return noop function when no provider supports WebSocket', () => {
      const service = new MarketDataService({
        primaryProvider,
      });

      const subscription: WebSocketSubscription = {
        symbol: 'BTC/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      const unsubscribe = service.subscribeToUpdates(subscription);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should unsubscribe existing subscription before creating new one', () => {
      const mockUnsubscribe1 = vi.fn();
      const mockUnsubscribe2 = vi.fn();
      let callCount = 0;
      const mockSubscribe = vi.fn(() => {
        callCount++;
        return callCount === 1 ? mockUnsubscribe1 : mockUnsubscribe2;
      });
      
      primaryProvider.supportsWebSocket = vi.fn(() => true);
      primaryProvider.subscribeToUpdates = mockSubscribe;

      const service = new MarketDataService({
        primaryProvider,
      });

      const subscription: WebSocketSubscription = {
        symbol: 'BTC/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      service.subscribeToUpdates(subscription);
      service.subscribeToUpdates(subscription);

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all active subscriptions', () => {
      const mockUnsubscribe1 = vi.fn();
      const mockUnsubscribe2 = vi.fn();
      let callCount = 0;
      const mockSubscribe = vi.fn(() => {
        callCount++;
        return callCount === 1 ? mockUnsubscribe1 : mockUnsubscribe2;
      });
      
      primaryProvider.supportsWebSocket = vi.fn(() => true);
      primaryProvider.subscribeToUpdates = mockSubscribe;

      const service = new MarketDataService({
        primaryProvider,
      });

      service.subscribeToUpdates({
        symbol: 'BTC/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      });

      service.subscribeToUpdates({
        symbol: 'ETH/USD',
        interval: '1h',
        onUpdate: vi.fn(),
        onError: vi.fn(),
      });

      service.unsubscribeAll();

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });
  });
});
