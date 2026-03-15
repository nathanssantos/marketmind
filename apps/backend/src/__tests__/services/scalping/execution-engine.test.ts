import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ExecutionEngine, type ExecutionEngineConfig } from '../../../services/scalping/execution-engine';
import { SignalEngine, type SignalEngineConfig } from '../../../services/scalping/signal-engine';
import type { ScalpingSignal } from '@marketmind/types';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), trace: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: (e: unknown) => String(e),
}));

const mockExecuteBinanceOrder = vi.fn().mockResolvedValue({
  orderId: 12345,
  executedQty: '0.001',
  price: '50000',
  status: 'FILLED',
});

vi.mock('../../../services/auto-trading', () => ({
  autoTradingService: {
    executeBinanceOrder: (...args: unknown[]) => mockExecuteBinanceOrder(...args),
  },
}));

const mockCreateStopLoss = vi.fn().mockResolvedValue({ algoId: 100, orderId: null });
const mockCreateTakeProfit = vi.fn().mockResolvedValue({ algoId: 200, orderId: null });
const mockUpdateStopLoss = vi.fn().mockResolvedValue({ algoId: 101, orderId: null });

vi.mock('../../../services/protection-orders', () => ({
  createStopLossOrder: (...args: unknown[]) => mockCreateStopLoss(...args),
  createTakeProfitOrder: (...args: unknown[]) => mockCreateTakeProfit(...args),
  updateStopLossOrder: (...args: unknown[]) => mockUpdateStopLoss(...args),
}));

vi.mock('../../../services/database/walletQueries', () => ({
  walletQueries: {
    getByIdAndUser: vi.fn().mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      currentBalance: '10000',
      apiKey: 'key',
      apiSecret: 'secret',
    }),
  },
}));

vi.mock('../../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: () => ({
    getSymbolFilters: vi.fn().mockResolvedValue(new Map([
      ['BTCUSDT', { tickSize: 0.01 }],
    ])),
  }),
}));

const mockGetAccountInfo = vi.fn().mockResolvedValue({ availableBalance: '10000' });

vi.mock('../../../exchange', () => ({
  getFuturesClient: () => ({
    getAccountInfo: (...args: unknown[]) => mockGetAccountInfo(...args),
  }),
}));

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
const mockDbQueryFind = vi.fn().mockResolvedValue(null);
const mockDbQueryFindMany = vi.fn().mockResolvedValue([]);

vi.mock('../../../db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    query: {
      tradeExecutions: {
        findFirst: (...args: unknown[]) => mockDbQueryFind(...args),
        findMany: (...args: unknown[]) => mockDbQueryFindMany(...args),
      },
    },
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: { id: 'id', walletId: 'walletId', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

const defaultEngineConfig: ExecutionEngineConfig = {
  walletId: 'wallet-1',
  userId: 'user-1',
  executionMode: 'MARKET',
  positionSizePercent: 2,
  leverage: 3,
  maxConcurrentPositions: 2,
  microTrailingTicks: 8,
};

const defaultSignalConfig: SignalEngineConfig = {
  enabledStrategies: ['imbalance'],
  imbalanceThreshold: 0.6,
  cvdDivergenceBars: 10,
  vwapDeviationSigma: 2.0,
  largeTradeMult: 4.0,
  absorptionThreshold: 3.0,
  maxSpreadPercent: 0.03,
  circuitBreakerEnabled: true,
  circuitBreakerLossPercent: 2.0,
  circuitBreakerMaxTrades: 50,
  maxDailyTrades: 50,
  maxDailyLossPercent: 2.0,
};

const makeSignal = (overrides: Partial<ScalpingSignal> = {}): ScalpingSignal => ({
  id: 'signal-1',
  symbol: 'BTCUSDT',
  strategy: 'imbalance',
  direction: 'LONG',
  entryPrice: 50000,
  stopLoss: 49900,
  takeProfit: 50150,
  confidence: 75,
  metrics: {
    cvd: 100,
    imbalanceRatio: 0.7,
    microprice: 50000,
    spread: 1,
    spreadPercent: 0.002,
    largeBuyVol: 0,
    largeSellVol: 0,
    absorptionScore: 0,
    exhaustionScore: 0,
    timestamp: Date.now(),
  },
  timestamp: Date.now(),
  ...overrides,
});

describe('ExecutionEngine', () => {
  let signalEngine: SignalEngine;
  let engine: ExecutionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    signalEngine = new SignalEngine({ ...defaultSignalConfig });
    engine = new ExecutionEngine({ ...defaultEngineConfig }, signalEngine);
  });

  describe('executeSignal', () => {
    it('should execute a signal and track active position', async () => {
      await engine.executeSignal(makeSignal());

      expect(mockExecuteBinanceOrder).toHaveBeenCalledTimes(1);
      expect(mockCreateStopLoss).toHaveBeenCalledTimes(1);
      expect(mockCreateTakeProfit).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(engine.hasActivePosition('BTCUSDT')).toBe(true);
      expect(engine.getActivePositionCount()).toBe(1);
    });

    it('should not exceed max concurrent positions', async () => {
      await engine.executeSignal(makeSignal({ symbol: 'BTCUSDT' }));
      await engine.executeSignal(makeSignal({ symbol: 'ETHUSDT', id: 'sig-2' }));
      await engine.executeSignal(makeSignal({ symbol: 'SOLUSDT', id: 'sig-3' }));

      expect(engine.getActivePositionCount()).toBe(2);
      expect(engine.hasActivePosition('SOLUSDT')).toBe(false);
    });

    it('should not open duplicate position for same symbol', async () => {
      await engine.executeSignal(makeSignal());
      await engine.executeSignal(makeSignal({ id: 'sig-2' }));

      expect(mockExecuteBinanceOrder).toHaveBeenCalledTimes(1);
    });

    it('should build MARKET order params by default', async () => {
      await engine.executeSignal(makeSignal());

      const orderParams = mockExecuteBinanceOrder.mock.calls[0]![1];
      expect(orderParams.type).toBe('MARKET');
      expect(orderParams.side).toBe('BUY');
    });

    it('should build LIMIT order for POST_ONLY mode', async () => {
      const postOnlyEngine = new ExecutionEngine(
        { ...defaultEngineConfig, executionMode: 'POST_ONLY' },
        signalEngine,
      );

      await postOnlyEngine.executeSignal(makeSignal());

      const orderParams = mockExecuteBinanceOrder.mock.calls[0]![1];
      expect(orderParams.type).toBe('LIMIT');
      expect(orderParams.price).toBe(50000);
      expect(orderParams.timeInForce).toBe('GTC');
    });

    it('should build IOC order for IOC mode', async () => {
      const iocEngine = new ExecutionEngine(
        { ...defaultEngineConfig, executionMode: 'IOC' },
        signalEngine,
      );

      await iocEngine.executeSignal(makeSignal());

      const orderParams = mockExecuteBinanceOrder.mock.calls[0]![1];
      expect(orderParams.type).toBe('MARKET');
      expect(orderParams.timeInForce).toBe('IOC');
    });

    it('should use SELL side for SHORT signals', async () => {
      await engine.executeSignal(makeSignal({ direction: 'SHORT' }));

      const orderParams = mockExecuteBinanceOrder.mock.calls[0]![1];
      expect(orderParams.side).toBe('SELL');
    });

    it('should calculate quantity from balance and position size', async () => {
      await engine.executeSignal(makeSignal({ entryPrice: 50000 }));

      const orderParams = mockExecuteBinanceOrder.mock.calls[0]![1];
      const expectedQty = (10000 * 2) / 100 / 50000;
      expect(orderParams.quantity).toBeCloseTo(expectedQty);
    });

    it('should emergency close when both SL and TP fail', async () => {
      mockCreateStopLoss.mockRejectedValueOnce(new Error('SL failed'));
      mockCreateTakeProfit.mockRejectedValueOnce(new Error('TP failed'));

      await engine.executeSignal(makeSignal());

      expect(mockExecuteBinanceOrder).toHaveBeenCalledTimes(2);
      const closeCall = mockExecuteBinanceOrder.mock.calls[1]![1];
      expect(closeCall.side).toBe('SELL');
      expect(closeCall.reduceOnly).toBe(true);
      expect(engine.hasActivePosition('BTCUSDT')).toBe(false);
    });

    it('should still open position when only TP fails', async () => {
      mockCreateTakeProfit.mockRejectedValueOnce(new Error('TP failed'));

      await engine.executeSignal(makeSignal());

      expect(engine.hasActivePosition('BTCUSDT')).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it('should not execute when wallet balance is zero', async () => {
      mockGetAccountInfo.mockResolvedValueOnce({ availableBalance: '0' });

      const freshEngine = new ExecutionEngine({ ...defaultEngineConfig }, signalEngine);
      await freshEngine.executeSignal(makeSignal());

      expect(mockExecuteBinanceOrder).not.toHaveBeenCalled();
    });
  });

  describe('handlePositionClosed', () => {
    it('should remove active position and record trade', async () => {
      await engine.executeSignal(makeSignal());
      expect(engine.hasActivePosition('BTCUSDT')).toBe(true);

      await engine.handlePositionClosed('BTCUSDT', 50);
      expect(engine.hasActivePosition('BTCUSDT')).toBe(false);

      const cb = signalEngine.getCircuitBreakerState();
      expect(cb.tradeCount).toBe(1);
      expect(cb.sessionPnl).toBe(50);
    });

    it('should not error when symbol has no active position', async () => {
      await expect(engine.handlePositionClosed('UNKNOWN', 10)).resolves.not.toThrow();
    });
  });

  describe('restoreActivePositions', () => {
    it('should restore scalping executions from DB', async () => {
      mockDbQueryFindMany.mockResolvedValueOnce([
        { id: 'exec-1', symbol: 'BTCUSDT', setupType: 'scalping-imbalance', status: 'open' },
        { id: 'exec-2', symbol: 'ETHUSDT', setupType: 'scalping-cvd-divergence', status: 'open' },
      ]);

      await engine.restoreActivePositions();

      expect(engine.hasActivePosition('BTCUSDT')).toBe(true);
      expect(engine.hasActivePosition('ETHUSDT')).toBe(true);
      expect(engine.getActivePositionCount()).toBe(2);
    });

    it('should skip non-scalping executions', async () => {
      mockDbQueryFindMany.mockResolvedValueOnce([
        { id: 'exec-1', symbol: 'BTCUSDT', setupType: 'imbalance', status: 'open' },
      ]);

      await engine.restoreActivePositions();
      expect(engine.hasActivePosition('BTCUSDT')).toBe(false);
    });

    it('should handle DB errors gracefully', async () => {
      mockDbQueryFindMany.mockRejectedValueOnce(new Error('DB error'));
      await expect(engine.restoreActivePositions()).resolves.not.toThrow();
    });
  });

  describe('checkMicroTrailing', () => {
    it('should not trail when microTrailingTicks is 0', async () => {
      const noTrailEngine = new ExecutionEngine(
        { ...defaultEngineConfig, microTrailingTicks: 0 },
        signalEngine,
      );
      await noTrailEngine.checkMicroTrailing('BTCUSDT', 50100);
      expect(mockUpdateStopLoss).not.toHaveBeenCalled();
    });

    it('should not trail when no active position', async () => {
      await engine.checkMicroTrailing('BTCUSDT', 50100);
      expect(mockDbQueryFind).not.toHaveBeenCalled();
    });

    it('should update SL for profitable LONG position', async () => {
      vi.useFakeTimers({ now: 1000 });
      const freshEngine = new ExecutionEngine({ ...defaultEngineConfig }, signalEngine);
      await freshEngine.executeSignal(makeSignal());

      mockDbQueryFind.mockResolvedValueOnce({
        id: 'exec-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        status: 'open',
        quantity: '0.001',
        stopLoss: '49900',
        stopLossAlgoId: '100',
        stopLossOrderId: null,
      });

      vi.advanceTimersByTime(2000);
      await freshEngine.checkMicroTrailing('BTCUSDT', 50200);

      expect(mockUpdateStopLoss).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateStopLoss.mock.calls[0]![0];
      expect(updateCall.triggerPrice).toBeGreaterThan(49900);
      vi.useRealTimers();
    });

    it('should not move SL backward for LONG', async () => {
      vi.useFakeTimers({ now: 1000 });
      const freshEngine = new ExecutionEngine({ ...defaultEngineConfig }, signalEngine);
      await freshEngine.executeSignal(makeSignal());

      mockDbQueryFind.mockResolvedValueOnce({
        id: 'exec-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        status: 'open',
        quantity: '0.001',
        stopLoss: '50100',
        stopLossAlgoId: '100',
        stopLossOrderId: null,
      });

      vi.advanceTimersByTime(2000);
      await freshEngine.checkMicroTrailing('BTCUSDT', 50050);
      expect(mockUpdateStopLoss).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('getActiveSymbols', () => {
    it('should return list of active symbols', async () => {
      await engine.executeSignal(makeSignal({ symbol: 'BTCUSDT' }));
      const symbols = engine.getActiveSymbols();
      expect(symbols).toEqual(['BTCUSDT']);
    });

    it('should return empty array when no positions', () => {
      expect(engine.getActiveSymbols()).toEqual([]);
    });
  });

  describe('stop', () => {
    it('should clear all active positions', async () => {
      await engine.executeSignal(makeSignal());
      expect(engine.getActivePositionCount()).toBe(1);
      engine.stop();
      expect(engine.getActivePositionCount()).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', () => {
      engine.updateConfig({ leverage: 10 });
    });
  });
});
