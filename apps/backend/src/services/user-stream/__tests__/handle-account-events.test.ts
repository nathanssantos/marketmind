import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      then: vi.fn().mockReturnValue({ catch: vi.fn() }),
    }),
  }),
});

const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});

vi.mock('../../../db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: { id: 'id', walletId: 'walletId', symbol: 'symbol', status: 'status', marketType: 'marketType', entryOrderId: 'entryOrderId', stopLossOrderId: 'slOid', stopLossAlgoId: 'slAid', takeProfitOrderId: 'tpOid', takeProfitAlgoId: 'tpAid' },
  wallets: { id: 'id' },
}));

vi.mock('../../binance-futures-client', () => ({
  cancelFuturesAlgoOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../protection-orders', () => ({
  cancelAllProtectionOrders: vi.fn().mockResolvedValue(undefined),
}));

const mockClearProtectionOrderIds = vi.fn().mockResolvedValue(undefined);
vi.mock('../../execution-manager', () => ({
  clearProtectionOrderIds: (...args: unknown[]) => mockClearProtectionOrderIds(...args),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockEmitRiskAlert = vi.fn();
const mockEmitWalletUpdate = vi.fn();
const mockEmitPositionUpdate = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitRiskAlert: mockEmitRiskAlert,
    emitWalletUpdate: mockEmitWalletUpdate,
    emitPositionUpdate: mockEmitPositionUpdate,
  })),
}));

const mockApplyTransferDelta = vi.fn().mockResolvedValue({ tranId: -1, newBalance: 0, depositsAdded: 0, withdrawalsAdded: 0 });
vi.mock('../../wallet-balance', () => ({
  applyTransferDelta: (...args: unknown[]) => mockApplyTransferDelta(...args),
}));

import {
  handleAccountUpdate,
  handleMarginCall,
  handleConfigUpdate,
  handleConditionalOrderReject,
} from '../handle-account-events';
import type { UserStreamContext, FuturesAccountUpdate, FuturesMarginCall, FuturesAccountConfigUpdate, FuturesConditionalOrderReject } from '../types';

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

describe('handleAccountUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('should sync USDT balance from account update', async () => {
    const ctx = createMockCtx();
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'ORDER',
        B: [{ a: 'USDT', wb: '10000.50', cw: '10000.50', bc: '0' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(ctx.invalidateWalletCache).toHaveBeenCalledWith('wallet-1');
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('should skip non-USDT balances', async () => {
    const ctx = createMockCtx();
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'ORDER',
        B: [{ a: 'BTC', wb: '1.5', cw: '1.5', bc: '0' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(ctx.invalidateWalletCache).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('should emit wallet update via WebSocket', async () => {
    const ctx = createMockCtx();
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'DEPOSIT',
        B: [{ a: 'USDT', wb: '5000', cw: '5000', bc: '0' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(mockEmitWalletUpdate).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      reason: 'DEPOSIT',
    }));
  });

  it('routes DEPOSIT/WITHDRAW/TRANSFER reasons through applyTransferDelta (not direct update)', async () => {
    const ctx = createMockCtx({
      getCachedWallet: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', currentBalance: '100' }),
    });
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: 1700000000000,
      T: 1700000000000,
      a: {
        m: 'DEPOSIT',
        B: [{ a: 'USDT', wb: '150', cw: '150', bc: '50' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(mockApplyTransferDelta).toHaveBeenCalledWith(expect.objectContaining({
      walletId: 'wallet-1',
      userId: 'user-1',
      asset: 'USDT',
      deltaAmount: 50,
      newBalance: 150,
      reason: 'DEPOSIT',
      eventTime: 1700000000000,
    }));
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('uses direct db.update when reason is not a transfer (e.g. ORDER)', async () => {
    const ctx = createMockCtx({
      getCachedWallet: vi.fn().mockResolvedValue({ id: 'wallet-1', userId: 'user-1', currentBalance: '100' }),
    });
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'ORDER',
        B: [{ a: 'USDT', wb: '105', cw: '105', bc: '5' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(mockApplyTransferDelta).not.toHaveBeenCalled();
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('should skip wallet update when wallet not found in cache', async () => {
    const ctx = createMockCtx({
      getCachedWallet: vi.fn().mockResolvedValue(null),
    });
    const event: FuturesAccountUpdate = {
      e: 'ACCOUNT_UPDATE',
      E: Date.now(),
      T: Date.now(),
      a: {
        m: 'ORDER',
        B: [{ a: 'USDT', wb: '10000', cw: '10000', bc: '0' }],
        P: [],
      },
    };

    await handleAccountUpdate(ctx, 'wallet-1', event);

    expect(ctx.invalidateWalletCache).not.toHaveBeenCalled();
  });
});

describe('handleMarginCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit risk alert for each position at risk', async () => {
    const ctx = createMockCtx();
    const event: FuturesMarginCall = {
      e: 'MARGIN_CALL',
      E: Date.now(),
      cw: '500',
      p: [
        { s: 'BTCUSDT', ps: 'LONG', pa: '0.1', mt: 'cross', iw: '0', mp: '49000', up: '-100', mm: '50' },
        { s: 'ETHUSDT', ps: 'SHORT', pa: '1', mt: 'cross', iw: '0', mp: '3500', up: '-50', mm: '25' },
      ],
    };

    await handleMarginCall(ctx, 'wallet-1', event);

    expect(mockEmitRiskAlert).toHaveBeenCalledTimes(2);
    expect(mockEmitRiskAlert).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      type: 'LIQUIDATION_RISK',
      level: 'critical',
      symbol: 'BTCUSDT',
    }));
  });

  it('should handle empty positions array', async () => {
    const ctx = createMockCtx();
    const event: FuturesMarginCall = {
      e: 'MARGIN_CALL',
      E: Date.now(),
      cw: '500',
      p: [],
    };

    await handleMarginCall(ctx, 'wallet-1', event);

    expect(mockEmitRiskAlert).not.toHaveBeenCalled();
  });
});

describe('handleConfigUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: vi.fn().mockImplementation((cb: (r: unknown) => void) => {
              cb([{ id: 'exec-1', leverage: 20 }]);
              return { catch: vi.fn() };
            }),
          }),
        }),
      }),
    });
  });

  it('should update leverage on open executions when ac event received', () => {
    const ctx = createMockCtx();
    const event: FuturesAccountConfigUpdate = {
      e: 'ACCOUNT_CONFIG_UPDATE',
      E: Date.now(),
      T: Date.now(),
      ac: { s: 'BTCUSDT', l: 20 },
    };

    handleConfigUpdate(ctx, 'wallet-1', event);

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('should handle multi-asset mode update (ai event)', () => {
    const ctx = createMockCtx();
    const event: FuturesAccountConfigUpdate = {
      e: 'ACCOUNT_CONFIG_UPDATE',
      E: Date.now(),
      T: Date.now(),
      ai: { j: true },
    };

    handleConfigUpdate(ctx, 'wallet-1', event);

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

describe('handleConditionalOrderReject', () => {
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

  it('should cancel pending entry execution when entry order rejected', async () => {
    const pendingEntry = {
      id: 'pending-1',
      entryOrderId: '999',
      status: 'pending',
    };
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pendingEntry]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const event: FuturesConditionalOrderReject = {
      e: 'CONDITIONAL_ORDER_TRIGGER_REJECT',
      E: Date.now(),
      T: Date.now(),
      or: { s: 'BTCUSDT', i: 999, r: 'PRICE_UNREACHABLE' },
    };

    await handleConditionalOrderReject(ctx, 'wallet-1', event);

    expect(mockDbUpdate).toHaveBeenCalled();
    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
    }));
  });

  it('should emit risk alert when TP/SL order rejected', async () => {
    const ctx = createMockCtx();
    const event: FuturesConditionalOrderReject = {
      e: 'CONDITIONAL_ORDER_TRIGGER_REJECT',
      E: Date.now(),
      T: Date.now(),
      or: { s: 'BTCUSDT', i: 555, r: 'PRICE_UNREACHABLE' },
    };

    await handleConditionalOrderReject(ctx, 'wallet-1', event);

    expect(mockEmitRiskAlert).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      type: 'ORDER_REJECTED',
      level: 'critical',
    }));
  });

  it('should clear protection order IDs when SL order rejected', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const openExecution = {
      id: 'exec-1',
      stopLossOrderId: '555',
      stopLossAlgoId: null,
      takeProfitOrderId: null,
      takeProfitAlgoId: null,
    };
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([openExecution]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const event: FuturesConditionalOrderReject = {
      e: 'CONDITIONAL_ORDER_TRIGGER_REJECT',
      E: Date.now(),
      T: Date.now(),
      or: { s: 'BTCUSDT', i: 555, r: 'PRICE_UNREACHABLE' },
    };

    await handleConditionalOrderReject(ctx, 'wallet-1', event);

    expect(mockClearProtectionOrderIds).toHaveBeenCalledWith('exec-1', 'stopLoss');
  });

  it('should clear protection order IDs when TP algo order rejected', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const openExecution = {
      id: 'exec-1',
      stopLossOrderId: null,
      stopLossAlgoId: null,
      takeProfitOrderId: null,
      takeProfitAlgoId: '777',
    };
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([openExecution]),
        }),
      }),
    });

    const ctx = createMockCtx();
    const event: FuturesConditionalOrderReject = {
      e: 'CONDITIONAL_ORDER_TRIGGER_REJECT',
      E: Date.now(),
      T: Date.now(),
      or: { s: 'BTCUSDT', i: 777, r: 'PRICE_UNREACHABLE' },
    };

    await handleConditionalOrderReject(ctx, 'wallet-1', event);

    expect(mockClearProtectionOrderIds).toHaveBeenCalledWith('exec-1', 'takeProfit');
  });
});
