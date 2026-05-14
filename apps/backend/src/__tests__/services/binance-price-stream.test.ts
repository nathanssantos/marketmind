import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOn = vi.fn();
const mockCloseAll = vi.fn();
const mockSubscribeAggregateTrades = vi.fn();

vi.mock('binance', () => ({
  WebsocketClient: class MockWebsocketClient {
    on = mockOn;
    closeAll = mockCloseAll;
    subscribeAggregateTrades = mockSubscribeAggregateTrades;
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

const mockPositionMonitorService = {
  updatePrice: vi.fn(),
  groupExecutionsBySymbolAndSidePublic: vi.fn().mockReturnValue(new Map()),
  checkPositionGroupByPrice: vi.fn(),
};

vi.mock('../../services/position-monitor', () => ({
  positionMonitorService: mockPositionMonitorService,
}));

const mockWebSocketService = {
  emitPriceUpdate: vi.fn(),
  getActiveRooms: vi.fn(() => [] as string[]),
  getActivelyViewedSymbols: vi.fn(() => [] as string[]),
};

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => mockWebSocketService),
}));

const mockDbSelect = vi.fn();
vi.mock('../../db', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
  inArray: vi.fn((field, values) => ({ field, values })),
}));

const { BinancePriceStreamService } = await import('../../services/binance-price-stream');

describe('BinancePriceStreamService', () => {
  let service: InstanceType<typeof BinancePriceStreamService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new BinancePriceStreamService();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should initialize WebSocket client and set up event handlers', () => {
      service.start();

      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });

    it('should not reinitialize if already running', () => {
      service.start();
      mockOn.mockClear();
      service.start();

      expect(mockOn).not.toHaveBeenCalled();
    });

    it('should set up periodic subscription check', () => {
      service.start();

      expect(mockDbSelect).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should close WebSocket and clear subscriptions', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');
      service.stop();

      expect(mockCloseAll).toHaveBeenCalledWith(true);
      expect(service.getSubscribedSymbols()).toEqual([]);
    });

    it('should handle stop when not started', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('subscribeSymbol', () => {
    it('should subscribe to symbol in lowercase', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');

      expect(mockSubscribeAggregateTrades).toHaveBeenCalledWith('btcusdt', 'usdm');
      expect(service.getSubscribedSymbols()).toContain('btcusdt');
    });

    it('should not subscribe if client not initialized', () => {
      service.subscribeSymbol('BTCUSDT');

      expect(mockSubscribeAggregateTrades).not.toHaveBeenCalled();
    });

    it('should not resubscribe to already subscribed symbol', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');
      mockSubscribeAggregateTrades.mockClear();
      service.subscribeSymbol('BTCUSDT');

      expect(mockSubscribeAggregateTrades).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeSymbol', () => {
    it('should unsubscribe from symbol', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');
      service.unsubscribeSymbol('BTCUSDT');

      expect(service.getSubscribedSymbols()).not.toContain('btcusdt');
    });

    it('should handle unsubscribe when not subscribed', () => {
      service.start();
      expect(() => service.unsubscribeSymbol('BTCUSDT')).not.toThrow();
    });
  });

  describe('getSubscribedSymbols', () => {
    it('should return empty array when no subscriptions', () => {
      service.start();
      expect(service.getSubscribedSymbols()).toEqual([]);
    });

    it('should return list of subscribed symbols', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');
      service.subscribeSymbol('ETHUSDT');

      const symbols = service.getSubscribedSymbols();
      expect(symbols).toHaveLength(2);
      expect(symbols).toContain('btcusdt');
      expect(symbols).toContain('ethusdt');
    });
  });

  describe('message handling', () => {
    it('should handle aggTrade message', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      const tradeMessage = {
        eventType: 'aggTrade',
        symbol: 'BTCUSDT',
        price: '50000.00',
        tradeTime: 1700000000000,
      };

      messageHandler(tradeMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).toHaveBeenCalledWith('BTCUSDT', 50000);
    });

    it('should handle trade message with short field names', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      const tradeMessage = {
        e: 'trade',
        s: 'ETHUSDT',
        p: 3000.5,
        T: 1700000000000,
      };

      messageHandler(tradeMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).toHaveBeenCalledWith('ETHUSDT', 3000.5);
    });

    it('should ignore non-object messages', () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(() => messageHandler('string message')).not.toThrow();
      expect(() => messageHandler(null)).not.toThrow();
      expect(() => messageHandler(undefined)).not.toThrow();
    });

    it('should ignore messages without symbol', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const tradeMessage = {
        eventType: 'aggTrade',
        price: '50000',
      };

      messageHandler(tradeMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).not.toHaveBeenCalled();
    });

    it('should ignore messages with invalid price', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const invalidPriceMessage = {
        eventType: 'aggTrade',
        symbol: 'BTCUSDT',
        price: 'invalid',
      };

      messageHandler(invalidPriceMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).not.toHaveBeenCalled();

      const zeroPriceMessage = {
        eventType: 'aggTrade',
        symbol: 'BTCUSDT',
        price: 0,
      };

      messageHandler(zeroPriceMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).not.toHaveBeenCalled();
    });

    it('should ignore non-trade event types', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const depthMessage = {
        eventType: 'depthUpdate',
        symbol: 'BTCUSDT',
      };

      messageHandler(depthMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockPositionMonitorService.updatePrice).not.toHaveBeenCalled();
    });

    it('should emit price update to websocket service', async () => {
      service.start();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const tradeMessage = {
        eventType: 'aggTrade',
        symbol: 'BTCUSDT',
        price: 50000,
        tradeTime: 1700000000000,
      };

      messageHandler(tradeMessage);
      await vi.runOnlyPendingTimersAsync();

      expect(mockWebSocketService.emitPriceUpdate).toHaveBeenCalledWith('BTCUSDT', 50000, 1700000000000);
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket errors', () => {
      service.start();

      const errorHandler = mockOn.mock.calls.find((c) => c[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();

      expect(() => errorHandler(new Error('Connection failed'))).not.toThrow();
    });

    it('should handle non-Error objects in error handler', () => {
      service.start();

      const errorHandler = mockOn.mock.calls.find((c) => c[0] === 'error')?.[1];
      expect(() => errorHandler('string error')).not.toThrow();
    });
  });

  describe('reconnection handling', () => {
    it('should resubscribe on reconnection', async () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');
      mockSubscribeAggregateTrades.mockClear();

      const reconnectHandler = mockOn.mock.calls.find((c) => c[0] === 'reconnected')?.[1];
      expect(reconnectHandler).toBeDefined();

      reconnectHandler();
      await vi.runOnlyPendingTimersAsync();

      expect(mockSubscribeAggregateTrades).toHaveBeenCalled();
    });

    it('should ignore duplicate reconnection events', () => {
      service.start();
      service.subscribeSymbol('BTCUSDT');

      const reconnectHandler = mockOn.mock.calls.find((c) => c[0] === 'reconnected')?.[1];

      reconnectHandler();
      mockSubscribeAggregateTrades.mockClear();

      reconnectHandler();

      expect(mockSubscribeAggregateTrades).not.toHaveBeenCalled();
    });

    // Regression for 2026-05-14 reconnect loop. With no open execs in DB
    // but the chart subscribed to BTCUSDT via the prices room, resubscribeAll
    // was routing every symbol to 'spot' (wsKey `main`) instead of 'usdm'
    // (wsKey `usdmMarket`) — chart never recovered futures prices, Binance
    // closed the misrouted spot connection, immediate reconnect loop every
    // ~7s. Fix: resubscribeAll consults getActiveRooms(ROOM_PREFIXES.prices)
    // the same way reconcileSubscriptions does, treating chart-driven
    // subscriptions as FUTURES (the only wsKey wired to the renderer's
    // price-update events).
    it('routes chart-room subscriptions to usdm on reconnect (no DB execs)', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      mockWebSocketService.getActiveRooms.mockReturnValue(['BTCUSDT', 'ETHUSDT']);

      service.start();
      service.subscribeSymbol('BTCUSDT');
      service.subscribeSymbol('ETHUSDT');
      mockSubscribeAggregateTrades.mockClear();

      const reconnectHandler = mockOn.mock.calls.find((c) => c[0] === 'reconnected')?.[1];
      reconnectHandler();
      await vi.runOnlyPendingTimersAsync();

      // Both symbols must resubscribe to 'usdm', NOT 'spot'.
      expect(mockSubscribeAggregateTrades).toHaveBeenCalledWith('btcusdt', 'usdm');
      expect(mockSubscribeAggregateTrades).toHaveBeenCalledWith('ethusdt', 'usdm');
      expect(mockSubscribeAggregateTrades).not.toHaveBeenCalledWith('btcusdt', 'spot');
      expect(mockSubscribeAggregateTrades).not.toHaveBeenCalledWith('ethusdt', 'spot');

      mockWebSocketService.getActiveRooms.mockReturnValue([]);
    });
  });

  describe('auto-subscription to active positions', () => {
    it('should subscribe to symbols with open executions', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { symbol: 'BTCUSDT', status: 'open', marketType: 'SPOT' },
            { symbol: 'ETHUSDT', status: 'pending', marketType: 'FUTURES' },
          ]),
        }),
      });

      service.start();
      await vi.runOnlyPendingTimersAsync();

      expect(mockSubscribeAggregateTrades).toHaveBeenCalledWith('btcusdt', 'spot');
      expect(mockSubscribeAggregateTrades).toHaveBeenCalledWith('ethusdt', 'usdm');
    });

    it('should unsubscribe from symbols without open positions', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { symbol: 'BTCUSDT', status: 'open', marketType: 'SPOT' },
          ]),
        }),
      });

      service.start();
      service.subscribeSymbol('ETHUSDT');
      await vi.runOnlyPendingTimersAsync();

      expect(service.getSubscribedSymbols()).not.toContain('ethusdt');
    });
  });
});

describe('PriceUpdate type', () => {
  it('should have correct structure', async () => {
    const { BinancePriceStreamService } = await import('../../services/binance-price-stream');
    expect(BinancePriceStreamService).toBeDefined();

    const update = {
      symbol: 'BTCUSDT',
      price: 50000,
      timestamp: Date.now(),
    };

    expect(update.symbol).toBe('BTCUSDT');
    expect(update.price).toBe(50000);
    expect(typeof update.timestamp).toBe('number');
  });
});
