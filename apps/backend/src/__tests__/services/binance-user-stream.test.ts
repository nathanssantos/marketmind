import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

const mockOn = vi.fn();
const mockCloseAll = vi.fn();
const mockSubscribeSpotUserDataStreamWithListenKey = vi.fn();

vi.mock('binance', () => ({
  WebsocketClient: class MockWebsocketClient {
    on = mockOn;
    closeAll = mockCloseAll;
    subscribeSpotUserDataStreamWithListenKey = mockSubscribeSpotUserDataStreamWithListenKey;
  },
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../../db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

vi.mock('../../db/schema', () => ({
  tradeExecutions: { id: 'id', walletId: 'walletId', symbol: 'symbol', status: 'status' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ type: 'and', args })),
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  sql: Object.assign((...args: unknown[]) => ({ type: 'sql', args }), {
    raw: (value: string) => ({ type: 'raw', value }),
  }),
}));

const mockGetSpotUserDataListenKey = vi.fn();
const mockKeepAliveSpotUserDataListenKey = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock('../../services/binance-client', () => ({
  createBinanceClient: vi.fn(() => ({
    getSpotUserDataListenKey: mockGetSpotUserDataListenKey,
    keepAliveSpotUserDataListenKey: mockKeepAliveSpotUserDataListenKey,
    cancelOrder: mockCancelOrder,
  })),
  isPaperWallet: vi.fn((wallet: { walletType: string }) => wallet.walletType === 'paper'),
  silentWsLogger: {},
}));

const mockEmitPositionUpdate = vi.fn();
const mockEmitWalletUpdate = vi.fn();

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitWalletUpdate: mockEmitWalletUpdate,
  })),
}));

const mockApplyTransferDelta = vi.fn();

vi.mock('../../services/wallet-balance', () => ({
  applyTransferDelta: (input: unknown) => mockApplyTransferDelta(input),
}));

const { BinanceUserStreamService, binanceUserStreamService } = await import('../../services/binance-user-stream');

describe('BinanceUserStreamService', () => {
  let service: InstanceType<typeof BinanceUserStreamService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new BinanceUserStreamService();

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockGetSpotUserDataListenKey.mockResolvedValue({ listenKey: 'test-listen-key' });
    mockKeepAliveSpotUserDataListenKey.mockResolvedValue({});
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should start service and subscribe to active wallets', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      await service.start();

      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('should subscribe to live wallets only', async () => {
      const liveWallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([liveWallet]),
      });

      await service.start();

      expect(mockGetSpotUserDataListenKey).toHaveBeenCalled();
    });

    it('should skip FUTURES wallets', async () => {
      const futuresWallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'FUTURES',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([futuresWallet]),
      });

      await service.start();

      expect(mockGetSpotUserDataListenKey).not.toHaveBeenCalled();
    });

    it('should skip paper wallets', async () => {
      const paperWallet = {
        id: 'wallet-1',
        walletType: 'paper',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([paperWallet]),
      });

      await service.start();

      expect(mockGetSpotUserDataListenKey).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should close all connections', async () => {
      const liveWallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([liveWallet]),
      });

      await service.start();
      service.stop();

      expect(mockCloseAll).toHaveBeenCalledWith(true);
    });

    it('should handle stop when not started', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('subscribeWallet', () => {
    it('should subscribe to live wallet', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      expect(mockGetSpotUserDataListenKey).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('exception', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('reconnected', expect.any(Function));
      expect(mockSubscribeSpotUserDataStreamWithListenKey).toHaveBeenCalled();
    });

    it('should not subscribe to paper wallet', async () => {
      const paperWallet = {
        id: 'wallet-1',
        walletType: 'paper',
      };

      await service.subscribeWallet(paperWallet as any);

      expect(mockGetSpotUserDataListenKey).not.toHaveBeenCalled();
    });

    it('should not resubscribe to already subscribed wallet', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockGetSpotUserDataListenKey.mockClear();

      await service.subscribeWallet(wallet as any);

      expect(mockGetSpotUserDataListenKey).not.toHaveBeenCalled();
    });

    it('should handle subscription errors', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      mockGetSpotUserDataListenKey.mockRejectedValue(new Error('API error'));

      await expect(service.subscribeWallet(wallet as any)).resolves.not.toThrow();
    });

    it('should use testnet key for testnet wallets', async () => {
      const testnetWallet = {
        id: 'wallet-1',
        walletType: 'testnet',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(testnetWallet as any);

      expect(mockSubscribeSpotUserDataStreamWithListenKey).toHaveBeenCalledWith(
        'mainTestnetUserData',
        'test-listen-key'
      );
    });
  });

  describe('unsubscribeWallet', () => {
    it('should unsubscribe and close connection', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      service.unsubscribeWallet('wallet-1');

      expect(mockCloseAll).toHaveBeenCalledWith(true);
    });

    it('should handle unsubscribe when not subscribed', () => {
      expect(() => service.unsubscribeWallet('non-existent')).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should handle executionReport messages', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      const executionReport = {
        e: 'executionReport',
        s: 'BTCUSDT',
        X: 'FILLED',
        x: 'TRADE',
        i: 12345,
        L: '50000',
        z: '0.1',
        o: 'LIMIT',
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      messageHandler(executionReport);
      await vi.runOnlyPendingTimersAsync();
    });

    it('should ignore non-object messages', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      expect(() => messageHandler('string message')).not.toThrow();
      expect(() => messageHandler(null)).not.toThrow();
    });

    it('short-circuits outboundAccountPosition without a USDT entry', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockDbSelect.mockClear();
      mockDbUpdate.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const balanceUpdate = { e: 'outboundAccountPosition', B: [] };
      messageHandler(balanceUpdate);
      await vi.runOnlyPendingTimersAsync();

      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('dispatches outboundAccountPosition USDT entry to a wallet balance update', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockDbUpdate.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const event = {
        e: 'outboundAccountPosition',
        E: Date.now(),
        B: [
          { a: 'USDT', f: '100', l: '50' },
          { a: 'BTC', f: '0.01', l: '0' },
        ],
      };

      messageHandler(event);
      await vi.runOnlyPendingTimersAsync();

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('routes balanceUpdate to applyTransferDelta with positive deposit delta', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockDbSelect.mockClear();
      mockApplyTransferDelta.mockClear();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
          }),
        }),
      });

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      const eventTime = Date.now();
      messageHandler({ e: 'balanceUpdate', a: 'USDT', d: '25', E: eventTime, T: eventTime });
      await vi.runOnlyPendingTimersAsync();

      expect(mockApplyTransferDelta).toHaveBeenCalledWith(expect.objectContaining({
        walletId: 'wallet-1',
        userId: 'user-1',
        asset: 'USDT',
        deltaAmount: 25,
        reason: 'BALANCE_UPDATE',
        eventTime,
      }));
    });

    it('routes balanceUpdate with negative delta as withdrawal', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockApplyTransferDelta.mockClear();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
          }),
        }),
      });

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      messageHandler({ e: 'balanceUpdate', a: 'USDT', d: '-10', E: Date.now(), T: Date.now() });
      await vi.runOnlyPendingTimersAsync();

      expect(mockApplyTransferDelta).toHaveBeenCalledWith(expect.objectContaining({
        deltaAmount: -10,
        reason: 'BALANCE_UPDATE',
      }));
    });

    it('ignores balanceUpdate for non-USDT assets', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockDbSelect.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      messageHandler({ e: 'balanceUpdate', a: 'BTC', d: '0.01', E: Date.now(), T: Date.now() });
      await vi.runOnlyPendingTimersAsync();

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('ignores balanceUpdate with zero delta', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockDbSelect.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      messageHandler({ e: 'balanceUpdate', a: 'USDT', d: '0', E: Date.now(), T: Date.now() });
      await vi.runOnlyPendingTimersAsync();

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('triggers resubscribe on listenKeyExpired', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockCloseAll.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      messageHandler({ e: 'listenKeyExpired', E: Date.now() });
      await vi.advanceTimersByTimeAsync(1500);

      expect(mockCloseAll).toHaveBeenCalled();
    });

    it('triggers resubscribe on eventStreamTerminated', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);
      mockCloseAll.mockClear();

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];
      messageHandler({ e: 'eventStreamTerminated', E: Date.now() });
      await vi.advanceTimersByTimeAsync(1500);

      expect(mockCloseAll).toHaveBeenCalled();
    });
  });

  describe('order update handling', () => {
    it('should handle pending LIMIT order fill', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      const pendingExecution = {
        id: 'exec-1',
        walletId: 'wallet-1',
        symbol: 'BTCUSDT',
        status: 'pending',
        entryOrderId: '12345',
        side: 'LONG',
        entryPrice: '50000',
      };

      await service.subscribeWallet(wallet as any);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([pendingExecution]),
          }),
        }),
      });

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const executionReport = {
        e: 'executionReport',
        s: 'BTCUSDT',
        X: 'FILLED',
        x: 'TRADE',
        i: 12345,
        L: '50100',
        z: '0.1',
        o: 'LIMIT',
      };

      messageHandler(executionReport);
      await vi.runOnlyPendingTimersAsync();

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockEmitPositionUpdate).toHaveBeenCalled();
    });

    it('should handle SL order fill and cancel TP', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
        currentBalance: '10000',
      };

      const openExecution = {
        id: 'exec-1',
        walletId: 'wallet-1',
        symbol: 'BTCUSDT',
        status: 'open',
        stopLossOrderId: '12345',
        takeProfitOrderId: '12346',
        side: 'LONG',
        entryPrice: '50000',
      };

      await service.subscribeWallet(wallet as any);

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([openExecution]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([wallet]),
            }),
          }),
        });

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const executionReport = {
        e: 'executionReport',
        s: 'BTCUSDT',
        X: 'FILLED',
        x: 'TRADE',
        i: 12345,
        L: '49000',
        z: '0.1',
        o: 'STOP_LOSS',
      };

      messageHandler(executionReport);
      await vi.runOnlyPendingTimersAsync();

      expect(mockCancelOrder).toHaveBeenCalledWith({ symbol: 'BTCUSDT', orderId: 12346 });
    });

    it('should handle errors in order update', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      });

      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1];

      const executionReport = {
        e: 'executionReport',
        s: 'BTCUSDT',
        X: 'FILLED',
        x: 'TRADE',
        i: 12345,
        L: '50000',
        z: '0.1',
        o: 'LIMIT',
      };

      expect(() => messageHandler(executionReport)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket exceptions', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      const exceptionHandler = mockOn.mock.calls.find((c) => c[0] === 'exception')?.[1];
      expect(exceptionHandler).toBeDefined();

      expect(() => exceptionHandler(new Error('WebSocket error'))).not.toThrow();
    });

    it('should handle reconnection', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      const reconnectedHandler = mockOn.mock.calls.find((c) => c[0] === 'reconnected')?.[1];
      expect(reconnectedHandler).toBeDefined();

      expect(() => reconnectedHandler()).not.toThrow();
    });
  });

  describe('listen key refresh', () => {
    it('should refresh listen key periodically', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(mockKeepAliveSpotUserDataListenKey).toHaveBeenCalledWith('test-listen-key');
    });

    it('should handle listen key refresh errors', async () => {
      const wallet = {
        id: 'wallet-1',
        walletType: 'live',
        marketType: 'SPOT',
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
      };

      await service.subscribeWallet(wallet as any);

      mockKeepAliveSpotUserDataListenKey.mockRejectedValue(new Error('Refresh failed'));

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });
  });
});

describe('binanceUserStreamService singleton', () => {
  it('should export a singleton instance', () => {
    expect(binanceUserStreamService).toBeDefined();
    expect(binanceUserStreamService).toBeInstanceOf(BinanceUserStreamService);
  });
});
