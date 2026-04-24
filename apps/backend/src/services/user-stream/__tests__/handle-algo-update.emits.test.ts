import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();
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
  tradeExecutions: {},
}));

vi.mock('../../binance-futures-client', () => ({
  cancelFuturesAlgoOrder: vi.fn().mockResolvedValue(undefined),
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
const mockEmitRiskAlert = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: mockEmitPositionUpdate,
    emitRiskAlert: mockEmitRiskAlert,
  })),
}));

import { handleAlgoOrderUpdate } from '../handle-algo-update';
import type { UserStreamContext, FuturesAlgoOrderUpdate } from '../types';

const createMockCtx = (): UserStreamContext => ({
  connections: new Map([['wallet-1', { wsClient: {} as never, apiClient: { cancelFuturesAlgoOrder: vi.fn() } as never }]]),
  getCachedWallet: vi.fn(),
  invalidateWalletCache: vi.fn(),
  withPyramidLock: vi.fn(async (_w: string, _s: string, fn: () => Promise<void>) => { await fn(); }),
  mergeIntoExistingPosition: vi.fn(),
  syncPositionFromExchange: vi.fn(),
  scheduleDebouncedSlTpUpdate: vi.fn(),
  cancelPendingEntryOrders: vi.fn(),
  closeResidualPosition: vi.fn(),
  verifyAlgoFillProcessed: vi.fn(),
  recentAlgoEntrySymbols: new Map(),
} as never);

const makeEvent = (overrides: Partial<FuturesAlgoOrderUpdate['o']> = {}): FuturesAlgoOrderUpdate => ({
  e: 'ORDER_TRADE_UPDATE',
  E: Date.now(),
  T: Date.now(),
  o: {
    s: 'BTCUSDT',
    aid: 555,
    X: 'TRIGGERED',
    o: 'STOP_MARKET',
    ps: 'BOTH',
    ...overrides,
  } as never,
} as never);

describe('handleAlgoOrderUpdate — TRIGGERED emits position:update with exitReason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits position:update with exitReason=STOP_LOSS when SL algo triggers on a tracked open execution', async () => {
    const openExec = {
      id: 'exec-1',
      walletId: 'wallet-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'open',
      stopLossAlgoId: '555',
      stopLossOrderId: null,
      takeProfitAlgoId: '666',
      takeProfitOrderId: null,
    };

    // select #1: pendingEntryExecution → empty (not a pyramid path)
    // select #2: open executions for symbol → [openExec]
    let callNum = 0;
    mockDbSelect.mockImplementation(() => {
      callNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
            callNum === 1
              ? { limit: vi.fn().mockResolvedValue([]) }
              : Promise.resolve([openExec])
          ),
        }),
      };
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handleAlgoOrderUpdate(createMockCtx(), 'wallet-1', makeEvent({ aid: 555 }));

    expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
      'wallet-1',
      expect.objectContaining({
        id: 'exec-1',
        exitReason: 'STOP_LOSS',
        stopLossAlgoId: null,
        stopLossOrderId: null,
      })
    );
    expect(mockInvalidateExecutionCache).toHaveBeenCalledWith('BTCUSDT');
  });

  it('emits position:update with exitReason=TAKE_PROFIT when TP algo triggers', async () => {
    const openExec = {
      id: 'exec-2',
      walletId: 'wallet-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'open',
      stopLossAlgoId: '111',
      takeProfitAlgoId: '777',
    };

    let callNum = 0;
    mockDbSelect.mockImplementation(() => {
      callNum++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
            callNum === 1
              ? { limit: vi.fn().mockResolvedValue([]) }
              : Promise.resolve([openExec])
          ),
        }),
      };
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await handleAlgoOrderUpdate(createMockCtx(), 'wallet-1', makeEvent({ aid: 777 }));

    expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
      'wallet-1',
      expect.objectContaining({
        id: 'exec-2',
        exitReason: 'TAKE_PROFIT',
        takeProfitAlgoId: null,
      })
    );
  });
});
