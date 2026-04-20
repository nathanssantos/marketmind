import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'exec-1' }]),
    }),
  }),
});

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock('../../../db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: { id: 'trade_executions.id', status: 'trade_executions.status' },
  wallets: { id: 'wallets.id', currentBalance: 'wallets.currentBalance' },
  realizedPnlEvents: {},
}));

const mockGetAllTradeFeesForPosition = vi.fn().mockResolvedValue(null);
const mockGetOrderEntryFee = vi.fn().mockResolvedValue(null);
const mockGetPosition = vi.fn().mockResolvedValue(null);
const mockCancelFuturesAlgoOrder = vi.fn().mockResolvedValue(undefined);

vi.mock('../../binance-futures-client', () => ({
  getAllTradeFeesForPosition: (...args: unknown[]) => mockGetAllTradeFeesForPosition(...args),
  getOrderEntryFee: (...args: unknown[]) => mockGetOrderEntryFee(...args),
  getPosition: (...args: unknown[]) => mockGetPosition(...args),
  cancelFuturesAlgoOrder: (...args: unknown[]) => mockCancelFuturesAlgoOrder(...args),
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
const mockEmitOrderUpdate = vi.fn();
const mockEmitPositionClosed = vi.fn();

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitOrderUpdate: mockEmitOrderUpdate,
    emitPositionClosed: mockEmitPositionClosed,
  })),
}));

const mockEmitPositionClosedBus = vi.fn();
vi.mock('../../scalping/position-event-bus', () => ({
  getPositionEventBus: vi.fn(() => ({
    emitPositionClosed: mockEmitPositionClosedBus,
  })),
}));

vi.mock('@marketmind/utils', async () => {
  const actual = await vi.importActual<typeof import('@marketmind/utils')>('@marketmind/utils');
  return {
    ...actual,
    calculatePnl: vi.fn(() => ({
      grossPnl: 100,
      totalFees: 2,
      netPnl: 98,
      pnlPercent: 4.9,
      marginValue: 2000,
    })),
  };
});

import { handleExitFill } from '../handle-exit-fill';
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
  entryFee: '0.5',
  exitFee: null,
  accumulatedFunding: '0',
  partialClosePnl: '0',
  entryOrderId: '12345',
  stopLoss: '49000',
  takeProfit: '52000',
  stopLossAlgoId: 'sl-algo-1',
  stopLossOrderId: null,
  stopLossIsAlgo: true,
  takeProfitAlgoId: 'tp-algo-1',
  takeProfitOrderId: null,
  takeProfitIsAlgo: true,
  exitReason: null,
  openedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  setupId: null,
  ...overrides,
});

const createMockCtx = (overrides: Partial<UserStreamContext> = {}): UserStreamContext => {
  const mockApiClient = {
    cancelOrder: vi.fn().mockResolvedValue({ status: 'CANCELED' }),
  };
  return {
    connections: new Map([['wallet-1', { wsClient: {} as never, apiClient: mockApiClient as never }]]),
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
  };
};

describe('handleExitFill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'exec-1' }]),
        }),
      }),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('should detect partial close when exchange reports remaining quantity', async () => {
    mockGetPosition.mockResolvedValueOnce({
      positionAmt: '0.05',
      entryPrice: '50500',
    });

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.05', '0.25', true, false, false
    );

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockInvalidateExecutionCache).toHaveBeenCalledWith('BTCUSDT');
    expect(mockEmitPositionUpdate).toHaveBeenCalled();
  });

  it('should schedule SL/TP update on partial close when protection exists', async () => {
    mockGetPosition.mockResolvedValueOnce({
      positionAmt: '0.05',
      entryPrice: '50500',
    });

    const ctx = createMockCtx();
    const execution = createMockExecution({ stopLoss: '49000', takeProfit: '52000' });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.05', '0.25', true, false, false
    );

    expect(ctx.scheduleDebouncedSlTpUpdate).toHaveBeenCalledWith('exec-1', 'wallet-1', 'BTCUSDT');
  });

  it('should perform full close when no remaining position on exchange', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(mockEmitPositionClosed).toHaveBeenCalled();
    expect(mockEmitPositionClosedBus).toHaveBeenCalled();
  });

  it('should cancel opposite TP order when SL fills', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution({
      takeProfitAlgoId: 'tp-algo-1',
      takeProfitIsAlgo: true,
    });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '49000', '49000', '0.1', '0.5', true, false, false
    );

    expect(mockCancelFuturesAlgoOrder).toHaveBeenCalledWith(expect.anything(), 'tp-algo-1');
  });

  it('should cancel opposite SL order when TP fills', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution({
      stopLossAlgoId: 'sl-algo-1',
      stopLossIsAlgo: true,
    });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '52000', '52000', '0.1', '0.5', false, true, false
    );

    expect(mockCancelFuturesAlgoOrder).toHaveBeenCalledWith(expect.anything(), 'sl-algo-1');
  });

  it('should skip OCO cancellation for algo trigger fills', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution({ exitReason: 'TRAILING_STOP' });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, true
    );

    expect(mockCancelFuturesAlgoOrder).not.toHaveBeenCalled();
  });

  it('should use REST API fees when available', async () => {
    mockGetPosition.mockResolvedValueOnce(null);
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce({
      entryFee: 1.5,
      exitFee: 1.2,
    });

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.01', true, false, false
    );

    expect(mockGetAllTradeFeesForPosition).toHaveBeenCalled();
  });

  it('should fallback to event commission when REST API fails', async () => {
    mockGetPosition.mockResolvedValueOnce(null);
    mockGetAllTradeFeesForPosition.mockRejectedValueOnce(new Error('API error'));

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(mockEmitPositionClosed).toHaveBeenCalled();
  });

  it('should fetch entry fee when actualEntryFee is 0 and entryOrderId exists', async () => {
    mockGetPosition.mockResolvedValueOnce(null);
    mockGetAllTradeFeesForPosition.mockResolvedValueOnce(null);
    mockGetOrderEntryFee.mockResolvedValueOnce({ entryFee: 0.8 });

    const ctx = createMockCtx();
    const execution = createMockExecution({ entryFee: '0', entryOrderId: '12345' });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(mockGetOrderEntryFee).toHaveBeenCalled();
  });

  it('should skip if position already closed by another process', async () => {
    mockGetPosition.mockResolvedValueOnce(null);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(mockEmitPositionClosed).not.toHaveBeenCalled();
  });

  it('should throw when wallet not found', async () => {
    const ctx = createMockCtx({
      getCachedWallet: vi.fn().mockResolvedValue(null),
    });
    const execution = createMockExecution();

    await expect(
      handleExitFill(ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false)
    ).rejects.toThrow('Wallet not found: wallet-1');
  });

  it('should set exit reason to STOP_LOSS for SL fill', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '49000', '49000', '0.1', '0.5', true, false, false
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ exitReason: 'STOP_LOSS' }));
  });

  it('should set exit reason to TAKE_PROFIT for TP fill', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '52000', '52000', '0.1', '0.5', false, true, false
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ exitReason: 'TAKE_PROFIT' }));
  });

  it('should preserve exit reason from execution on algo trigger fill', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution({ exitReason: 'TRAILING_STOP' });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '52000', '52000', '0.1', '0.5', false, true, true
    );

    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ exitReason: 'TRAILING_STOP' }));
  });

  it('should include partialClosePnl in final PnL calculation', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution({ partialClosePnl: '50' });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(mockEmitPositionClosed).toHaveBeenCalledWith(
      'wallet-1',
      expect.objectContaining({ pnl: 148 })
    );
  });

  it('should call cancelPendingEntryOrders after full close', async () => {
    mockGetPosition.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const execution = createMockExecution();

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '51000', '51000', '0.1', '0.5', true, false, false
    );

    expect(ctx.cancelPendingEntryOrders).toHaveBeenCalledWith('wallet-1', 'BTCUSDT', 'exec-1');
  });

  it('should retry cancelling opposite order on transient errors', async () => {
    vi.useRealTimers();
    mockGetPosition.mockResolvedValueOnce(null);

    const mockApiClient = {
      cancelOrder: vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 'CANCELED' }),
    };
    const ctx = createMockCtx({
      connections: new Map([['wallet-1', { wsClient: {} as never, apiClient: mockApiClient as never }]]),
    });
    const execution = createMockExecution({
      stopLossAlgoId: null,
      stopLossOrderId: '999',
      stopLossIsAlgo: false,
      takeProfitAlgoId: null,
      takeProfitOrderId: null,
      takeProfitIsAlgo: false,
    });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '49000', '49000', '0.1', '0.5', false, true, false
    );

    expect(mockApiClient.cancelOrder).toHaveBeenCalledTimes(2);
  });

  it('should treat "Unknown order" as successful cancel', async () => {
    mockGetPosition.mockResolvedValueOnce(null);
    mockCancelFuturesAlgoOrder.mockRejectedValueOnce(new Error('Unknown order'));

    const ctx = createMockCtx();
    const execution = createMockExecution({
      takeProfitAlgoId: 'tp-algo-1',
      takeProfitIsAlgo: true,
    });

    await handleExitFill(
      ctx, 'wallet-1', execution as never, 'BTCUSDT', 100, '49000', '49000', '0.1', '0.5', true, false, false
    );

    expect(mockCancelFuturesAlgoOrder).toHaveBeenCalledTimes(1);
    expect(mockEmitPositionClosed).toHaveBeenCalled();
  });
});
