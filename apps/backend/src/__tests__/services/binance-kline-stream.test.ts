import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BinanceKlineStreamService, BinanceFuturesKlineStreamService, type KlineUpdate } from '../../services/binance-kline-stream';

const mockOn = vi.fn();
const mockCloseAll = vi.fn();
const mockSubscribeSpotKline = vi.fn();
const mockSubscribeKlines = vi.fn();

vi.mock('binance', () => {
  return {
    WebsocketClient: class MockWebsocketClient {
      on = mockOn;
      closeAll = mockCloseAll;
      subscribeSpotKline = mockSubscribeSpotKline;
      subscribeKlines = mockSubscribeKlines;
    },
  };
});

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitKlineUpdate: vi.fn(),
  })),
}));

vi.mock('../../db', () => ({
  db: {
    query: {
      klines: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe('BinanceKlineStreamService', () => {
  let service: BinanceKlineStreamService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BinanceKlineStreamService();
  });

  describe('start', () => {
    it('should initialize WebSocket client', () => {
      service.start();

      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });

    it('should not reinitialize if already running', () => {
      service.start();
      service.start();

      expect(mockOn).toHaveBeenCalledTimes(3);
    });
  });

  describe('stop', () => {
    it('should close WebSocket and clear subscriptions', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.stop();

      expect(mockCloseAll).toHaveBeenCalledWith(true);
      expect(service.getActiveSubscriptions()).toEqual([]);
    });

    it('should handle stop when not started', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to kline stream', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');

      expect(mockSubscribeSpotKline).toHaveBeenCalledWith('BTCUSDT', '1h');
    });

    it('should increment client count for existing subscription', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('BTCUSDT', '1h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0]!.clients).toBe(2);
    });

    it('should not subscribe if client not initialized', () => {
      service.subscribe('BTCUSDT', '1h');

      expect(mockSubscribeSpotKline).not.toHaveBeenCalled();
    });

    it('should handle multiple different subscriptions', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('ETHUSDT', '4h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(2);
    });
  });

  describe('unsubscribe', () => {
    it('should decrement client count', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('BTCUSDT', '1h');
      service.unsubscribe('BTCUSDT', '1h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0]!.clients).toBe(1);
    });

    it('should remove subscription when count reaches zero', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.unsubscribe('BTCUSDT', '1h');

      expect(service.getActiveSubscriptions()).toHaveLength(0);
    });

    it('should handle unsubscribe for non-existent subscription', () => {
      service.start();
      expect(() => service.unsubscribe('BTCUSDT', '1h')).not.toThrow();
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return empty array when no subscriptions', () => {
      service.start();
      expect(service.getActiveSubscriptions()).toEqual([]);
    });

    it('should return list of active subscriptions', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('ETHUSDT', '4h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(2);
      expect(subs).toContainEqual({ symbol: 'BTCUSDT', interval: '1h', clients: 1 });
      expect(subs).toContainEqual({ symbol: 'ETHUSDT', interval: '4h', clients: 1 });
    });
  });

  describe('message handling', () => {
    it('should handle valid kline message', () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      const klineMessage = {
        e: 'kline',
        k: {
          s: 'BTCUSDT',
          i: '1h',
          t: 1700000000000,
          T: 1700003599999,
          o: '50000',
          h: '50500',
          l: '49500',
          c: '50200',
          v: '1000',
          q: '50000000',
          n: 5000,
          V: '500',
          Q: '25000000',
          x: false,
        },
      };

      expect(() => messageHandler(klineMessage)).not.toThrow();
    });

    it('should ignore non-object messages', () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(() => messageHandler('string message')).not.toThrow();
      expect(() => messageHandler(null)).not.toThrow();
    });

    it('should ignore non-kline messages', () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(() => messageHandler({ e: 'trade' })).not.toThrow();
    });
  });

  describe('stream health watchdog', () => {
    it('marks subscription degraded and emits stream:health after 60s silence', async () => {
      vi.useFakeTimers();
      const emitStreamHealth = vi.fn();
      const { getWebSocketService } = await import('../../services/websocket');
      (getWebSocketService as ReturnType<typeof vi.fn>).mockReturnValue({
        emitKlineUpdate: vi.fn(),
        emitStreamHealth,
      });

      service.start();
      service.subscribe('BTCUSDT', '1m');

      vi.advanceTimersByTime(61_000);
      vi.advanceTimersByTime(15_000);

      expect(emitStreamHealth).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
        status: 'degraded',
      }));
      expect(mockCloseAll).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('emits healthy when a degraded subscription sees a fresh lastMessageAt', async () => {
      vi.useFakeTimers();
      const emitStreamHealth = vi.fn();
      const { getWebSocketService } = await import('../../services/websocket');
      (getWebSocketService as ReturnType<typeof vi.fn>).mockReturnValue({
        emitKlineUpdate: vi.fn(),
        emitStreamHealth,
      });

      service.start();
      service.subscribe('BTCUSDT', '1m');

      const subsMap = (service as unknown as { subscriptions: Map<string, { lastMessageAt: number; healthStatus: string }> }).subscriptions;
      const sub = subsMap.get('btcusdt_1m')!;
      sub.healthStatus = 'degraded';
      sub.lastMessageAt = Date.now();

      vi.advanceTimersByTime(15_000);

      const healthyCalls = emitStreamHealth.mock.calls.filter(c => c[0].status === 'healthy');
      expect(healthyCalls.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('stops the watchdog on stop()', async () => {
      vi.useFakeTimers();
      const emitStreamHealth = vi.fn();
      const { getWebSocketService } = await import('../../services/websocket');
      (getWebSocketService as ReturnType<typeof vi.fn>).mockReturnValue({
        emitKlineUpdate: vi.fn(),
        emitStreamHealth,
      });

      service.start();
      service.subscribe('BTCUSDT', '1m');
      service.stop();

      vi.advanceTimersByTime(120_000);
      expect(emitStreamHealth).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

describe('BinanceFuturesKlineStreamService', () => {
  let service: BinanceFuturesKlineStreamService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BinanceFuturesKlineStreamService();
  });

  describe('start', () => {
    it('should initialize WebSocket client', () => {
      service.start();

      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });

    it('should not reinitialize if already running', () => {
      service.start();
      service.start();

      expect(mockOn).toHaveBeenCalledTimes(3);
    });
  });

  describe('stop', () => {
    it('should close WebSocket and clear subscriptions', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.stop();

      expect(mockCloseAll).toHaveBeenCalledWith(true);
      expect(service.getActiveSubscriptions()).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('should auto-start and subscribe to futures kline stream', () => {
      service.subscribe('BTCUSDT', '1h');

      expect(mockSubscribeKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 'usdm');
    });

    it('should increment client count for existing subscription', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('BTCUSDT', '1h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0]!.clients).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should decrement client count', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('BTCUSDT', '1h');
      service.unsubscribe('BTCUSDT', '1h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0]!.clients).toBe(1);
    });

    it('should remove subscription when count reaches zero', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.unsubscribe('BTCUSDT', '1h');

      expect(service.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return list of active subscriptions', () => {
      service.start();
      service.subscribe('BTCUSDT', '1h');
      service.subscribe('ETHUSDT', '4h');

      const subs = service.getActiveSubscriptions();
      expect(subs).toHaveLength(2);
    });
  });

  describe('message handling', () => {
    it('should handle valid futures kline message', () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      const klineMessage = {
        e: 'kline',
        k: {
          s: 'BTCUSDT',
          i: '1h',
          t: 1700000000000,
          T: 1700003599999,
          o: '50000',
          h: '50500',
          l: '49500',
          c: '50200',
          v: '1000',
          q: '50000000',
          n: 5000,
          V: '500',
          Q: '25000000',
          x: true,
        },
      };

      expect(() => messageHandler(klineMessage)).not.toThrow();
    });
  });

  describe('stream health watchdog', () => {
    it('marks futures subscription degraded and forces reconnect after silence', async () => {
      vi.useFakeTimers();
      const emitStreamHealth = vi.fn();
      const { getWebSocketService } = await import('../../services/websocket');
      (getWebSocketService as ReturnType<typeof vi.fn>).mockReturnValue({
        emitKlineUpdate: vi.fn(),
        emitStreamHealth,
      });

      service.start();
      service.subscribe('BTCUSDT', '1m');

      vi.advanceTimersByTime(61_000);
      vi.advanceTimersByTime(15_000);

      expect(emitStreamHealth).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
      }));
      expect(mockCloseAll).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('synthesized kline:update emits never trigger a false stream:health=healthy on the native stream', async () => {
      vi.useFakeTimers();
      const emitStreamHealth = vi.fn();
      const emitKlineUpdate = vi.fn();
      const { getWebSocketService } = await import('../../services/websocket');
      (getWebSocketService as ReturnType<typeof vi.fn>).mockReturnValue({
        emitKlineUpdate,
        emitStreamHealth,
      });

      service.start();
      service.subscribe('BTCUSDT', '1m');

      vi.advanceTimersByTime(61_000);
      vi.advanceTimersByTime(15_000);

      const degradedCount = emitStreamHealth.mock.calls.filter((c) => c[0].status === 'degraded').length;
      expect(degradedCount).toBeGreaterThan(0);

      for (let i = 0; i < 10; i++) {
        getWebSocketService()?.emitKlineUpdate?.({
          symbol: 'BTCUSDT', interval: '1m',
          openTime: Date.now(), closeTime: Date.now() + 59_999,
          open: '50000', high: '50500', low: '49500', close: '50200',
          volume: '10', isClosed: false, timestamp: Date.now(),
        });
        vi.advanceTimersByTime(1_000);
      }

      const healthyEmits = emitStreamHealth.mock.calls.filter((c) => c[0].status === 'healthy');
      expect(healthyEmits.length).toBe(0);

      vi.useRealTimers();
    });
  });
});

describe('KlineUpdate type', () => {
  it('should have correct structure', () => {
    const update: KlineUpdate = {
      symbol: 'BTCUSDT',
      interval: '1h',
      marketType: 'SPOT',
      openTime: 1700000000000,
      closeTime: 1700003599999,
      open: '50000',
      high: '50500',
      low: '49500',
      close: '50200',
      volume: '1000',
      quoteVolume: '50000000',
      trades: 5000,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '25000000',
      isClosed: true,
      timestamp: Date.now(),
    };

    expect(update.symbol).toBe('BTCUSDT');
    expect(update.interval).toBe('1h');
    expect(update.isClosed).toBe(true);
  });
});
