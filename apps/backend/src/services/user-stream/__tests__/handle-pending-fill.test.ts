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

const mockDbDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../../../db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: { id: 'trade_executions.id', walletId: 'walletId', symbol: 'symbol', status: 'status', marketType: 'marketType', side: 'side' },
}));

const mockGetOrderEntryFee = vi.fn().mockResolvedValue(null);
const mockGetPosition = vi.fn().mockResolvedValue(null);

vi.mock('../../binance-futures-client', () => ({
  getOrderEntryFee: (...args: unknown[]) => mockGetOrderEntryFee(...args),
  getPosition: (...args: unknown[]) => mockGetPosition(...args),
}));

const mockCreateStopLossOrder = vi.fn().mockResolvedValue({ orderId: null, algoId: 'sl-999', isAlgoOrder: true });
const mockCreateTakeProfitOrder = vi.fn().mockResolvedValue({ orderId: null, algoId: 'tp-999', isAlgoOrder: true });

vi.mock('../../protection-orders', () => ({
  createStopLossOrder: (...args: unknown[]) => mockCreateStopLossOrder(...args),
  createTakeProfitOrder: (...args: unknown[]) => mockCreateTakeProfitOrder(...args),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockEmitPositionUpdate = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitTradeNotification: vi.fn(),
  })),
}));

import { handlePendingFill } from '../handle-pending-fill';
import type { UserStreamContext } from '../types';

const createMockPending = (overrides = {}) => ({
  id: 'pending-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  entryPrice: '0',
  quantity: '0.1',
  leverage: 10,
  status: 'pending',
  marketType: 'FUTURES',
  entryFee: '0',
  stopLoss: null,
  takeProfit: null,
  stopLossAlgoId: null,
  stopLossOrderId: null,
  stopLossIsAlgo: false,
  takeProfitAlgoId: null,
  takeProfitOrderId: null,
  takeProfitIsAlgo: false,
  setupId: null,
  openedAt: null,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockCtx = (overrides: Partial<UserStreamContext> = {}): UserStreamContext => ({
  connections: new Map([['wallet-1', { wsClient: {} as never, apiClient: {} as never }]]),
  getCachedWallet: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1' }),
  invalidateWalletCache: vi.fn(),
  withPyramidLock: vi.fn(async (_w, _s, fn) => fn()),
  mergeIntoExistingPosition: vi.fn().mockResolvedValue(undefined),
  syncPositionFromExchange: vi.fn(),
  scheduleDebouncedSlTpUpdate: vi.fn(),
  cancelPendingEntryOrders: vi.fn().mockResolvedValue(undefined),
  closeResidualPosition: vi.fn().mockResolvedValue(undefined),
  verifyAlgoFillProcessed: vi.fn(),
  recentAlgoEntrySymbols: new Map(),
  ...overrides,
});

describe('handlePendingFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('should activate pending execution with fill price and quantity', async () => {
    const ctx = createMockCtx();
    const pending = createMockPending();

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(mockDbUpdate).toHaveBeenCalled();
    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      status: 'open',
      entryPrice: '50000',
      quantity: '0.1',
    }));
  });

  it('should merge into existing position when same-side open execution exists', async () => {
    const existingOpen = { id: 'existing-1', side: 'LONG' };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingOpen]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const pending = createMockPending({ side: 'LONG' });

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(ctx.withPyramidLock).toHaveBeenCalledWith('wallet-1', 'BTCUSDT', expect.any(Function));
    expect(ctx.mergeIntoExistingPosition).toHaveBeenCalledWith(
      'wallet-1', 'BTCUSDT', 'existing-1', 0.1, 50000, 'pending-1', expect.any(String)
    );
  });

  it('should delete pending execution when opposite-side open execution exists', async () => {
    const existingOpen = { id: 'existing-1', side: 'SHORT' };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingOpen]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const pending = createMockPending({ side: 'LONG' });

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('should place SL/TP orders when setupId exists and no protection order IDs', async () => {
    const ctx = createMockCtx();
    const pending = createMockPending({
      setupId: 'setup-1',
      stopLoss: '48000',
      takeProfit: '53000',
    });

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(mockCreateStopLossOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'BTCUSDT',
      triggerPrice: 48000,
    }));
    expect(mockCreateTakeProfitOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'BTCUSDT',
      triggerPrice: 53000,
    }));
  });

  it('should not place SL/TP when protection order IDs already exist', async () => {
    const ctx = createMockCtx();
    const pending = createMockPending({
      setupId: 'setup-1',
      stopLoss: '48000',
      takeProfit: '53000',
      stopLossAlgoId: 'existing-sl',
      takeProfitAlgoId: 'existing-tp',
    });

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(mockCreateStopLossOrder).not.toHaveBeenCalled();
    expect(mockCreateTakeProfitOrder).not.toHaveBeenCalled();
  });

  it('should fetch liquidation price from exchange on activation', async () => {
    mockGetPosition.mockResolvedValueOnce({
      liquidationPrice: '42000',
    });

    const ctx = createMockCtx();
    const pending = createMockPending();

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      liquidationPrice: '42000',
    }));
  });

  it('should use event commission when REST fee fetch fails', async () => {
    mockGetOrderEntryFee.mockRejectedValueOnce(new Error('API error'));

    const ctx = createMockCtx();
    const pending = createMockPending();

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.5', 'USDT'
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      entryFee: '0.5',
    }));
  });

  it('should use REST API fee when available and greater than 0', async () => {
    mockGetOrderEntryFee.mockResolvedValueOnce({ entryFee: 1.2 });

    const ctx = createMockCtx();
    const pending = createMockPending();

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      entryFee: '1.2',
    }));
  });

  it('should emit position update via WebSocket', async () => {
    const ctx = createMockCtx();
    const pending = createMockPending();

    await handlePendingFill(
      ctx, 'wallet-1', pending as never, 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', '0.25', 'USDT'
    );

    expect(mockEmitPositionUpdate).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      status: 'open',
      entryPrice: '50000',
    }));
  });
});
