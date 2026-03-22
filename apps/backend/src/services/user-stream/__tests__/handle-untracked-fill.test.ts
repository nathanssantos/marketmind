import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../../../db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: { id: 'id', walletId: 'walletId', symbol: 'symbol', status: 'status', marketType: 'marketType', side: 'side' },
  wallets: { id: 'id', currentBalance: 'currentBalance' },
  realizedPnlEvents: {},
  orders: { walletId: 'walletId', orderId: 'orderId' },
}));

const mockGetPosition = vi.fn().mockResolvedValue(null);

vi.mock('../../binance-futures-client', () => ({
  getPosition: (...args: unknown[]) => mockGetPosition(...args),
}));

vi.mock('../../../utils/id', () => ({
  generateEntityId: vi.fn(() => 'generated-id'),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockInvalidateExecutionCache = vi.fn();
vi.mock('../../binance-price-stream', () => ({
  binancePriceStreamService: { invalidateExecutionCache: (...args: unknown[]) => mockInvalidateExecutionCache(...args) },
}));

const mockEmitPositionUpdate = vi.fn();
const mockEmitPositionClosed = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitPositionClosed: mockEmitPositionClosed,
  })),
}));

const mockEmitPositionClosedBus = vi.fn();
vi.mock('../../scalping/position-event-bus', () => ({
  getPositionEventBus: vi.fn(() => ({
    emitPositionClosed: mockEmitPositionClosedBus,
  })),
}));

import { handleUntrackedReduceFill, handleManualOrderFill } from '../handle-untracked-fill';
import type { UserStreamContext } from '../types';

const createMockExecution = (overrides = {}) => ({
  id: 'exec-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  entryPrice: '50000',
  quantity: '0.1',
  leverage: 10,
  status: 'open',
  marketType: 'FUTURES',
  stopLoss: '49000',
  takeProfit: '52000',
  partialClosePnl: '0',
  openedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockCtx = (overrides: Partial<UserStreamContext> = {}): UserStreamContext => ({
  connections: new Map([['wallet-1', { wsClient: {} as never, apiClient: {} as never }]]),
  getCachedWallet: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1' }),
  invalidateWalletCache: vi.fn(),
  withPyramidLock: vi.fn(),
  mergeIntoExistingPosition: vi.fn(),
  syncPositionFromExchange: vi.fn(),
  scheduleDebouncedSlTpUpdate: vi.fn(),
  cancelPendingEntryOrders: vi.fn().mockResolvedValue(undefined),
  closeResidualPosition: vi.fn().mockResolvedValue(undefined),
  verifyAlgoFillProcessed: vi.fn(),
  recentAlgoEntrySymbols: new Map(),
  ...overrides,
});

describe('handleUntrackedReduceFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('should return false when realizedProfit is 0', async () => {
    const ctx = createMockCtx();
    const result = await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.05', '0', '0.1'
    );
    expect(result).toBe(false);
  });

  it('should return true but log warning when no opposite execution found', async () => {
    const ctx = createMockCtx();
    const result = await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.05', '50', '0.1'
    );
    expect(result).toBe(true);
  });

  it('should apply partial close when exchange reports remaining quantity', async () => {
    const oppositeExec = createMockExecution();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oppositeExec]),
        }),
      }),
    });
    mockGetPosition.mockResolvedValueOnce({
      positionAmt: '0.05',
      entryPrice: '50000',
    });

    const ctx = createMockCtx();
    const result = await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.05', '50', '0.1'
    );

    expect(result).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockInvalidateExecutionCache).toHaveBeenCalledWith('BTCUSDT');
  });

  it('should schedule SL/TP update on partial close when protection exists', async () => {
    const oppositeExec = createMockExecution({ stopLoss: '49000', takeProfit: '52000' });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oppositeExec]),
        }),
      }),
    });
    mockGetPosition.mockResolvedValueOnce({
      positionAmt: '0.05',
      entryPrice: '50000',
    });

    const ctx = createMockCtx();
    await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.05', '50', '0.1'
    );

    expect(ctx.scheduleDebouncedSlTpUpdate).toHaveBeenCalledWith('exec-1', 'wallet-1', 'BTCUSDT');
  });

  it('should apply full close when no remaining quantity on exchange', async () => {
    const oppositeExec = createMockExecution();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oppositeExec]),
        }),
      }),
    });
    mockGetPosition.mockResolvedValueOnce({
      positionAmt: '0',
      entryPrice: '0',
    });

    const ctx = createMockCtx();
    const result = await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.1', '100', '0.5'
    );

    expect(result).toBe(true);
    expect(mockEmitPositionClosed).toHaveBeenCalled();
    expect(mockEmitPositionClosedBus).toHaveBeenCalled();
    expect(ctx.cancelPendingEntryOrders).toHaveBeenCalledWith('wallet-1', 'BTCUSDT', 'exec-1');
  });

  it('should correctly determine reduce direction from order side', async () => {
    const oppositeExec = createMockExecution({ side: 'SHORT' });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oppositeExec]),
        }),
      }),
    });
    mockGetPosition.mockResolvedValueOnce({ positionAmt: '0', entryPrice: '0' });

    const ctx = createMockCtx();
    await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 100, '49000', '49000', '0.1', '100', '0.5'
    );

    expect(mockEmitPositionClosed).toHaveBeenCalledWith(
      'wallet-1',
      expect.objectContaining({ side: 'SHORT', exitReason: 'REDUCE_ORDER' })
    );
  });

  it('should accumulate partial close PnL on full close', async () => {
    const oppositeExec = createMockExecution({ partialClosePnl: '25' });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oppositeExec]),
        }),
      }),
    });
    mockGetPosition.mockResolvedValueOnce({ positionAmt: '0', entryPrice: '0' });

    const ctx = createMockCtx();
    await handleUntrackedReduceFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.1', '100', '0.5'
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      status: 'closed',
      exitSource: 'MANUAL',
      exitReason: 'REDUCE_ORDER',
    }));
  });
});

describe('handleManualOrderFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('should return early when no manual order found', async () => {
    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('should create trade execution for manual order fill', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            return Promise.resolve([]);
          }),
        }),
      }),
    }));
    mockGetPosition.mockResolvedValueOnce({ leverage: '5', liquidationPrice: '42000' });

    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('should skip execution creation when opposite position exists', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    const oppositeExec = { id: 'existing-1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            return Promise.resolve([oppositeExec]);
          }),
        }),
      }),
    }));

    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('should set direction to LONG for BUY orders', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'LIMIT', origQty: '0.1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            return Promise.resolve([]);
          }),
        }),
      }),
    }));

    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    expect(mockDbInsert).toHaveBeenCalled();
    const insertValues = mockDbInsert.mock.results[0]?.value.values;
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      side: 'LONG',
      entryOrderType: 'LIMIT',
    }));
  });

  it('should set direction to SHORT for SELL orders', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            return Promise.resolve([]);
          }),
        }),
      }),
    }));

    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'SELL', 12345, '50000', '50000', '0.1', 0
    );

    const insertValues = mockDbInsert.mock.results[0]?.value.values;
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      side: 'SHORT',
      entryOrderType: 'MARKET',
    }));
  });

  it('should return early when wallet not found', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            return Promise.resolve([]);
          }),
        }),
      }),
    }));

    const ctx = createMockCtx({
      getCachedWallet: vi.fn().mockResolvedValue(null),
    });

    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});
