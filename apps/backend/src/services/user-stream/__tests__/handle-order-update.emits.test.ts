import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn();
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
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: {},
}));

vi.mock('../../execution-manager', () => ({
  detectExitReason: vi.fn(() => null),
  isClosingSide: vi.fn(() => false),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockEmitOrderCancelled = vi.fn();
const mockEmitOrderUpdate = vi.fn();
const mockEmitPositionUpdate = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitOrderCancelled: mockEmitOrderCancelled,
    emitOrderUpdate: mockEmitOrderUpdate,
    emitPositionUpdate: mockEmitPositionUpdate,
  })),
}));

vi.mock('../handle-pending-fill', () => ({ handlePendingFill: vi.fn() }));
vi.mock('../handle-untracked-fill', () => ({ handleUntrackedReduceFill: vi.fn(), handleManualOrderFill: vi.fn() }));
vi.mock('../handle-exit-fill', () => ({ handleExitFill: vi.fn() }));

import { handleOrderUpdate } from '../handle-order-update';
import type { UserStreamContext, FuturesOrderUpdate } from '../types';

const createMockCtx = (): UserStreamContext => ({
  connections: new Map(),
  getCachedWallet: vi.fn(),
  invalidateWalletCache: vi.fn(),
  withPyramidLock: vi.fn(),
  mergeIntoExistingPosition: vi.fn(),
  syncPositionFromExchange: vi.fn(),
  scheduleDebouncedSlTpUpdate: vi.fn(),
  cancelPendingEntryOrders: vi.fn(),
  closeResidualPosition: vi.fn(),
  verifyAlgoFillProcessed: vi.fn(),
  recentAlgoEntrySymbols: new Map(),
} as never);

const makeEvent = (overrides: Partial<FuturesOrderUpdate['o']> = {}): FuturesOrderUpdate => ({
  e: 'ORDER_TRADE_UPDATE',
  E: Date.now(),
  T: Date.now(),
  o: {
    s: 'BTCUSDT',
    c: 'client-id',
    S: 'BUY',
    o: 'LIMIT',
    f: 'GTC',
    q: '0.1',
    p: '50000',
    X: 'CANCELED',
    x: 'CANCELED',
    i: 99,
    L: '0',
    z: '0',
    ap: '0',
    rp: '0',
    n: '0',
    N: 'USDT',
    ps: 'BOTH',
    ...overrides,
  } as never,
} as never);

describe('handleOrderUpdate — CANCELED branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits order:cancelled + per-execution order:update + position:update when pending execution was cancelled', async () => {
    const cancelledRow = { id: 'exec-99', walletId: 'wallet-1', entryOrderId: '99', status: 'cancelled' };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([cancelledRow]),
        }),
      }),
    });

    const event = makeEvent({ X: 'CANCELED', x: 'CANCELED', i: 99 });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    expect(mockEmitOrderCancelled).toHaveBeenCalledWith('wallet-1', '99');
    expect(mockEmitOrderUpdate).toHaveBeenCalledWith('wallet-1', { id: 'exec-99', status: 'cancelled' });
    expect(mockEmitPositionUpdate).toHaveBeenCalledWith('wallet-1', cancelledRow);
  });

  it('still emits order:cancelled even when no pending execution matched', async () => {
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const event = makeEvent({ X: 'CANCELED', x: 'CANCELED', i: 42 });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    expect(mockEmitOrderCancelled).toHaveBeenCalledWith('wallet-1', '42');
    expect(mockEmitOrderUpdate).not.toHaveBeenCalled();
    expect(mockEmitPositionUpdate).not.toHaveBeenCalled();
  });
});

describe('handleOrderUpdate — PARTIALLY_FILLED branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits position:update with the partial fill quantity so the chart paints immediately', async () => {
    const pending = { id: 'exec-99', walletId: 'wallet-1', symbol: 'BTCUSDT', entryOrderId: '99', status: 'pending', quantity: '0' };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pending]),
        }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const event = makeEvent({
      X: 'PARTIALLY_FILLED',
      x: 'TRADE',
      i: 99,
      q: '1.0',
      z: '0.4',
    });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    expect(mockEmitPositionUpdate).toHaveBeenCalledTimes(1);
    expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
      'wallet-1',
      expect.objectContaining({ id: 'exec-99', quantity: '0.4' }),
    );
  });

  it('does not emit when there is no pending execution to update', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const event = makeEvent({
      X: 'PARTIALLY_FILLED',
      x: 'TRADE',
      i: 99,
      q: '1.0',
      z: '0.4',
    });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    expect(mockEmitPositionUpdate).not.toHaveBeenCalled();
  });
});

// Regression test for incident 2026-05-08 (exec FuxZ3Mhqq4a):
// MARKET order with attached SL/TP was inserted into DB at order-creation
// time using `submitNewOrder.avgPrice` (or fallback `input.price`). When
// Binance's response had an empty/zero avgPrice — and the chart's
// reference price was used as fallback — the DB stored an entry_price
// that was up to 200+ dollars off the actual fill avg. Subsequently
// orphan-close PnL was computed against the wrong entry_price, hiding
// real losses.
//
// Fix: when an entry-fill ORDER_TRADE_UPDATE arrives for an already-
// tracked exec (matching entryOrderId), update entry_price + entry_fee
// from the WS event's avgPrice/commission instead of skipping. The WS
// payload is authoritative for the order's final avg.
describe('handleOrderUpdate — entry fill correction for tracked exec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const trackedExec = (overrides: Record<string, unknown> = {}) => ({
    id: 'exec-tracked',
    walletId: 'wallet-1',
    symbol: 'BTCUSDT',
    side: 'SHORT',
    status: 'open',
    entryOrderId: '1006569617293',
    entryPrice: '79623.00',  // placeholder from input.price fallback
    entryFee: null,
    quantity: '1.063',
    marketType: 'FUTURES',
    ...overrides,
  });

  it('overwrites stale entry_price when WS avgPrice differs by > 0.01%', async () => {
    let selectCall = 0;
    // The handler chains .select().from().where() WITHOUT limit for
    // openExecutions, but WITH limit for the pending exec lookup. Mock
    // both shapes by exposing each as a thenable resolver.
    mockDbSelect.mockImplementation(() => {
      const isPendingLookup = selectCall === 0;
      selectCall++;
      const data = isPendingLookup ? [] : [trackedExec()];
      const limitFn = vi.fn().mockResolvedValue(data);
      const whereFn = vi.fn().mockImplementation(() => ({
        limit: limitFn,
        then: (resolve: (value: unknown[]) => unknown) => resolve(data),
      }));
      return { from: vi.fn().mockReturnValue({ where: whereFn }) };
    });
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDbUpdate.mockReturnValue({ set: setMock });

    const event = makeEvent({
      X: 'FILLED',
      x: 'TRADE',
      i: 1006569617293,
      S: 'SELL',
      ap: '79408.55',  // authoritative avg from Binance fills
      L: '79408',
      z: '1.063',
      ap_real: undefined,
      rp: '0',
      n: '34.21',
    });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      entryPrice: '79408.55',
      entryFee: '34.21',
    }));
  });

  it('skips update when WS avgPrice matches DB within tolerance', async () => {
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      const isPendingLookup = selectCall === 0;
      selectCall++;
      const data = isPendingLookup ? [] : [trackedExec({ entryPrice: '79408.55' })];
      const limitFn = vi.fn().mockResolvedValue(data);
      const whereFn = vi.fn().mockImplementation(() => ({
        limit: limitFn,
        then: (resolve: (value: unknown[]) => unknown) => resolve(data),
      }));
      return { from: vi.fn().mockReturnValue({ where: whereFn }) };
    });
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDbUpdate.mockReturnValue({ set: setMock });

    const event = makeEvent({
      X: 'FILLED',
      x: 'TRADE',
      i: 1006569617293,
      S: 'SELL',
      ap: '79408.55',
      L: '79408',
      z: '1.063',
      rp: '0',
      n: '34.21',
    });

    await handleOrderUpdate(createMockCtx(), 'wallet-1', event);

    // No update call — values within tolerance.
    expect(setMock).not.toHaveBeenCalled();
  });
});
