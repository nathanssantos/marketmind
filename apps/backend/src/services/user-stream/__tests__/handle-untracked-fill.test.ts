import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        { currentBalance: '1000', totalWalletBalance: '1000' },
      ]),
      then: (resolve: (value: undefined) => unknown) => resolve(undefined),
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
const mockEmitOrderUpdate = vi.fn();
const mockEmitWalletUpdate = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitPositionClosed: mockEmitPositionClosed,
    emitOrderUpdate: mockEmitOrderUpdate,
    emitWalletUpdate: mockEmitWalletUpdate,
    emitTradeNotification: vi.fn(),
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
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { currentBalance: '1000', totalWalletBalance: '1000' },
          ]),
          then: (resolve: (value: undefined) => unknown) => resolve(undefined),
        }),
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

  // ----- REDUCE-ONLY SCENARIOS -----
  // When the order is reduceOnly:true, Binance caps executedQty at the
  // current position size. The position never flips. handleUntrackedReduceFill
  // sees positionAmt=0 (or sign matching the original side) and treats
  // the fill as a normal partial/full close. Sign-aware logic must NOT
  // trip the flip path for these cases.
  describe('reduce-only behavior (no flip)', () => {
    it('treats SELL on LONG with positionAmt=0 as a normal full close (not flip)', async () => {
      const oppositeExec = createMockExecution({ side: 'LONG', quantity: '1.0', entryPrice: '50000' });
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
        ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '1.0', '1000', '0.5',
      );

      // Full close path — emits position:closed with the original side.
      expect(mockEmitPositionClosed).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({ side: 'LONG', exitReason: 'REDUCE_ORDER' }),
      );
    });

    it('treats SELL on LONG with smaller remaining LONG (still positive amt) as partial close', async () => {
      const oppositeExec = createMockExecution({ side: 'LONG', quantity: '1.0', entryPrice: '50000' });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([oppositeExec]),
          }),
        }),
      });
      // Reduce-only SELL of 0.4 BTC; LONG goes from 1.0 → 0.6 (still LONG)
      mockGetPosition.mockResolvedValueOnce({ positionAmt: '0.6', entryPrice: '50000' });

      const ctx = createMockCtx();
      await handleUntrackedReduceFill(
        ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '51000', '51000', '0.4', '400', '0.2',
      );

      const setCall = mockDbUpdate.mock.results[0]?.value.set;
      const setArgs = setCall?.mock?.calls?.[0]?.[0] as Record<string, unknown> | undefined;
      // Partial close — quantity reduced, status stays open.
      expect(setArgs?.['status']).toBeUndefined();
      expect(setArgs?.['quantity']).toBe('0.6');
    });
  });

  // ----- POSITION FLIP SCENARIOS -----
  // User is LONG and places a SELL bigger than the position without
  // reduceOnly. Binance closes the LONG and opens a SHORT with the
  // excess in one fill (one-way mode). The DB must:
  //   1. Mark the LONG exec as 'closed' with the LONG-portion PnL
  //   2. NOT keep the LONG exec open with reduced quantity (the bug
  //      that caused the 2026-05-07T23:38 phantom-PnL incident)
  //   3. Optionally insert a SHORT exec for the excess (or rely on
  //      handleManualOrderFill on the next ORDER_TRADE_UPDATE — either
  //      is acceptable as long as side='LONG' is NOT preserved when
  //      Binance shows the position flipped).
  describe('position flip: SELL exceeds LONG without reduceOnly', () => {
    it('should fully close the LONG when Binance reports negative positionAmt (flipped to SHORT)', async () => {
      const oppositeExec = createMockExecution({ side: 'LONG', quantity: '1.0', entryPrice: '79858' });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([oppositeExec]),
          }),
        }),
      });
      // Binance flipped — position is now SHORT 0.5 (negative amt)
      mockGetPosition.mockResolvedValueOnce({
        positionAmt: '-0.5',
        entryPrice: '79950',
      });

      const ctx = createMockCtx();
      await handleUntrackedReduceFill(
        ctx, 'wallet-1', 'BTCUSDT', 'SELL', 100, '79950', '79950', '1.5', '92', '0.6',
      );

      // The LONG exec MUST be closed. It must NOT be left open with side=LONG
      // and a reduced quantity matching the now-SHORT position size — that
      // would mismatch reality on the exchange.
      const setCall = mockDbUpdate.mock.results[0]?.value.set;
      const setArgs = setCall?.mock?.calls?.[0]?.[0] as Record<string, unknown> | undefined;

      // Bug check: if the handler did `quantity: '0.5'` while preserving
      // side: 'LONG', this assertion fails. The fix should either:
      //  (a) close the exec entirely, OR
      //  (b) close + insert a new SHORT exec
      expect(setArgs?.['status']).toBe('closed');
      expect(setArgs?.['side']).not.toBe('LONG');
    });

    it('should fully close the SHORT when Binance reports positive positionAmt (flipped to LONG)', async () => {
      const oppositeExec = createMockExecution({ side: 'SHORT', quantity: '1.0', entryPrice: '80000' });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([oppositeExec]),
          }),
        }),
      });
      mockGetPosition.mockResolvedValueOnce({
        positionAmt: '0.3',
        entryPrice: '79500',
      });

      const ctx = createMockCtx();
      await handleUntrackedReduceFill(
        ctx, 'wallet-1', 'BTCUSDT', 'BUY', 200, '79500', '79500', '1.3', '40', '0.5',
      );

      const setCall = mockDbUpdate.mock.results[0]?.value.set;
      const setArgs = setCall?.mock?.calls?.[0]?.[0] as Record<string, unknown> | undefined;
      expect(setArgs?.['status']).toBe('closed');
      expect(setArgs?.['side']).not.toBe('SHORT');
    });
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

  it('should create trade execution for manual order fill and emit WS events', async () => {
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    const insertedExec = {
      id: 'generated-id',
      walletId: 'wallet-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'open',
      entryPrice: '50000',
      quantity: '0.1',
    };
    // Select call sequence with the race-guard check added:
    //   1) manual-order fetch        → [manualOrder]
    //   2) opposite-side existing?   → [] (none)
    //   3) same-side existing? (race)→ [] (no concurrent insert)
    //   4) re-read inserted exec     → [insertedExec]
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            if (selectCallCount === 2) return Promise.resolve([]);
            if (selectCallCount === 3) return Promise.resolve([]);
            return Promise.resolve([insertedExec]);
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
    expect(mockInvalidateExecutionCache).toHaveBeenCalledWith('BTCUSDT');
    expect(mockEmitPositionUpdate).toHaveBeenCalledWith('wallet-1', insertedExec);
    expect(mockEmitOrderUpdate).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      id: 'generated-id',
      orderId: '12345',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'open',
    }));
  });

  it('skips execution creation when same-side open exec already exists (race with position-sync)', async () => {
    // Race: position-sync ran between handleOrderUpdate's dispatch and
    // this handler's INSERT, picked up the Binance position as
    // "unknown" and inserted an exec for it. Without this guard,
    // handleManualOrderFill ALSO inserts → Portfolio briefly sums two
    // open execs → exposure displayed at 2× the real position size.
    const manualOrder = { walletId: 'wallet-1', orderId: '12345', type: 'MARKET', origQty: '0.1' };
    const concurrentExec = { id: 'sync-inserted-1' };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return Promise.resolve([manualOrder]);
            if (selectCallCount === 2) return Promise.resolve([]); // no opposite
            return Promise.resolve([concurrentExec]); // same-side already there
          }),
        }),
      }),
    }));

    const ctx = createMockCtx();
    await handleManualOrderFill(
      ctx, 'wallet-1', 'BTCUSDT', 'BUY', 12345, '50000', '50000', '0.1', 0
    );

    // No insert, no emit — position-sync owns the row.
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockEmitPositionUpdate).not.toHaveBeenCalled();
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
