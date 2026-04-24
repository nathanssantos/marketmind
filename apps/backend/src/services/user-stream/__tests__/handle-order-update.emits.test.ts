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
