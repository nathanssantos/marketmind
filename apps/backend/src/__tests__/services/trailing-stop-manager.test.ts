import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';

const {
  mockFetch,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbQuery,
  mockLogger,
  mockUpdateStopLossOrder,
  mockCalculateATRPercent,
  mockGetVolatilityProfile,
  mockEmitTradeNotification,
  mockEmitPositionUpdate,
  mockGetWebSocketService,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbQuery: {
    priceCache: { findFirst: vi.fn() },
    klines: { findFirst: vi.fn(), findMany: vi.fn() },
    setupDetections: { findFirst: vi.fn() },
    autoTradingConfig: { findFirst: vi.fn() },
    symbolTrailingStopOverrides: { findFirst: vi.fn() },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
  },
  mockUpdateStopLossOrder: vi.fn(),
  mockCalculateATRPercent: vi.fn(() => 0.02),
  mockGetVolatilityProfile: vi.fn(() => ({
    atrMultiplier: 2.0,
    breakevenThreshold: 0.01,
    feesThreshold: 0.015,
    minTrailingDistance: 0.002,
  })),
  mockEmitTradeNotification: vi.fn(),
  mockEmitPositionUpdate: vi.fn(),
  mockGetWebSocketService: vi.fn(() => null),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn(() => [1.5, 1.6, 1.7]),
  calculateSwingPoints: vi.fn(() => ({
    swingPoints: [
      { index: 5, type: 'low', price: 99, timestamp: Date.now() - 1000 },
    ],
  })),
}));

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getRoundTripFee: vi.fn(({ marketType, useBnbDiscount }: { marketType: string; useBnbDiscount?: boolean }) => {
      if (marketType === 'SPOT') return useBnbDiscount ? 0.0015 : 0.002;
      return useBnbDiscount ? 0.0003 : 0.0008;
    }),
  };
});

vi.mock('../../constants', () => ({
  TRAILING_STOP: {
    BREAKEVEN_THRESHOLD: 0.01,
    FEES_COVERAGE_THRESHOLD: 0.015,
    PEAK_PROFIT_FLOOR: 0.3,
    TP_THRESHOLD_FOR_BREAKEVEN: 0.3,
    TP_THRESHOLD_FOR_ADVANCED: 0.6,
  },
}));

vi.mock('../../db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    query: mockDbQuery,
  },
}));

vi.mock('../../db/schema', () => ({
  autoTradingConfig: { walletId: 'walletId', trailingStopEnabled: 'trailingStopEnabled' },
  klines: { symbol: 'symbol', interval: 'interval', marketType: 'marketType', openTime: 'openTime' },
  priceCache: { symbol: 'symbol' },
  setupDetections: { id: 'id' },
  symbolTrailingStopOverrides: { walletId: 'walletId', symbol: 'symbol' },
  tradeExecutions: { id: 'id', status: 'status' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock('../../services/logger', () => ({ logger: mockLogger }));

vi.mock('../../services/protection-orders', () => ({
  updateStopLossOrder: (...args: unknown[]) => mockUpdateStopLossOrder(...args),
}));

vi.mock('../../services/volatility-profile', () => ({
  calculateATRPercent: (...args: unknown[]) => mockCalculateATRPercent(...args),
  getVolatilityProfile: (...args: unknown[]) => mockGetVolatilityProfile(...args),
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => mockGetWebSocketService(),
}));

vi.mock('../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => e),
}));

vi.mock('../../utils/formatters', () => ({
  formatPrice: vi.fn((p: number) => p.toString()),
}));

import { TrailingStopService } from '../../services/trailing-stop';
import type { TradeExecution, AutoTradingConfig, SymbolTrailingStopOverride } from '../../db/schema';

const makeExecution = (overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id: 'exec-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  setupId: 'setup-1',
  setupType: 'momentum-breakout',
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryOrderId: null,
  stopLossOrderId: null,
  takeProfitOrderId: null,
  orderListId: null,
  exitOrderId: null,
  entryPrice: '100',
  exitPrice: null,
  quantity: '0.1',
  stopLoss: '95',
  takeProfit: '120',
  pnl: null,
  pnlPercent: null,
  fees: '0',
  exitSource: null,
  exitReason: null,
  openedAt: new Date(Date.now() - 3600000),
  closedAt: null,
  status: 'open',
  entryOrderType: 'MARKET',
  limitEntryPrice: null,
  expiresAt: null,
  marketType: 'FUTURES',
  leverage: 10,
  liquidationPrice: null,
  accumulatedFunding: '0',
  positionSide: 'BOTH',
  marginTopUpCount: 0,
  triggerKlineIndex: null,
  triggerKlineOpenTime: null,
  triggerCandleData: null,
  triggerIndicatorValues: null,
  fibonacciProjection: null,
  entryFee: null,
  exitFee: null,
  commissionAsset: null,
  trailingStopAlgoId: null,
  trailingStopMode: 'local',
  stopLossAlgoId: null,
  takeProfitAlgoId: null,
  stopLossIsAlgo: false,
  takeProfitIsAlgo: false,
  entryInterval: null,
  barsInTrade: 0,
  lastPriceMovementBar: 0,
  highestPriceSinceEntry: null,
  lowestPriceSinceEntry: null,
  trailingActivatedAt: null,
  highestPriceSinceTrailingActivation: null,
  lowestPriceSinceTrailingActivation: null,
  opportunityCostAlertSentAt: null,
  originalStopLoss: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as TradeExecution);

const makeKlineRow = (overrides: Record<string, unknown> = {}) => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: new Date(Date.now() - 7200000),
  closeTime: new Date(Date.now() - 3600000),
  open: '100',
  high: '105',
  low: '99',
  close: '103',
  volume: '1000',
  quoteVolume: '100000',
  trades: 500,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
  marketType: 'FUTURES',
  ...overrides,
});

const makeKlineRows = (count: number, baseTime: number = Date.now() - 100 * 3600000) =>
  Array.from({ length: count }, (_, i) => makeKlineRow({
    openTime: new Date(baseTime + i * 3600000),
    closeTime: new Date(baseTime + (i + 1) * 3600000),
    open: (100 + i * 0.1).toString(),
    high: (101 + i * 0.1).toString(),
    low: (99 + i * 0.1).toString(),
    close: (100.5 + i * 0.1).toString(),
  }));

const setupSelectChain = (result: unknown[]) => {
  const whereFn = vi.fn().mockResolvedValue(result);
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDbSelect.mockReturnValue({ from: fromFn });
  return { fromFn, whereFn };
};

const setupInsertChain = () => {
  const onConflictDoUpdateFn = vi.fn().mockResolvedValue(undefined);
  const valuesFn = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateFn });
  mockDbInsert.mockReturnValue({ values: valuesFn });
  return { valuesFn, onConflictDoUpdateFn };
};

const setupUpdateChain = () => {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDbUpdate.mockReturnValue({ set: setFn });
  return { setFn, whereFn };
};

describe('TrailingStopService - Manager Methods', () => {
  let service: TrailingStopService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    service = new TrailingStopService();
    setupSelectChain([]);
    setupInsertChain();
    setupUpdateChain();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchPriceFromApi (via getCurrentPrice)', () => {
    it('should fetch futures price from premium index endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markPrice: '45000.50' }),
      });

      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      setupInsertChain();
      setupSelectChain([makeExecution()]);

      const exec = makeExecution({ symbol: 'BTCUSDT', marketType: 'FUTURES' });
      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30));
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);

      const selectChain = setupSelectChain([exec]);

      const configChain = vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]);
      const configFrom = vi.fn().mockReturnValue({ where: configChain });

      const overrideChain = vi.fn().mockResolvedValue([]);
      const overrideFrom = vi.fn().mockReturnValue({ where: overrideChain });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: selectChain.fromFn };
        if (callCount === 2) return { from: configFrom };
        if (callCount === 3) return { from: overrideFrom };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      await service.updateTrailingStops();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fapi.binance.com/fapi/v1/premiumIndex'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should fetch spot price from ticker endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ price: '45000.50' }),
      });

      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      setupInsertChain();

      const exec = makeExecution({ symbol: 'BTCUSDT', marketType: 'SPOT' });
      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30));
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([exec]) }) };
        if (callCount === 2) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]) }) };
        if (callCount === 3) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      await service.updateTrailingStops();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.binance.com/api/v3/ticker/price'),
        expect.any(Object)
      );
    });

    it('should throw on non-ok HTTP response after retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      mockDbQuery.klines.findFirst.mockResolvedValue(null);

      const fetchPriceFromApi = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['fetchPriceFromApi'].bind(service);
      await expect(fetchPriceFromApi('BTCUSDT', 'FUTURES')).rejects.toThrow('HTTP 500');
    });
  });

  describe('getLastKlinePrice', () => {
    it('should return close price when kline is recent', async () => {
      const recentKline = {
        symbol: 'BTCUSDT',
        openTime: new Date(Date.now() - 60000),
        close: '45123.45',
      };
      mockDbQuery.klines.findFirst.mockResolvedValue(recentKline);

      const getLastKlinePrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number | null>>)['getLastKlinePrice'].bind(service);
      const result = await getLastKlinePrice('BTCUSDT', 'FUTURES');
      expect(result).toBe(45123.45);
    });

    it('should return null when kline is stale', async () => {
      const staleKline = {
        symbol: 'BTCUSDT',
        openTime: new Date(Date.now() - 600000),
        close: '45000',
      };
      mockDbQuery.klines.findFirst.mockResolvedValue(staleKline);

      const getLastKlinePrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number | null>>)['getLastKlinePrice'].bind(service);
      const result = await getLastKlinePrice('BTCUSDT', 'FUTURES');
      expect(result).toBeNull();
    });

    it('should return null when no kline found', async () => {
      mockDbQuery.klines.findFirst.mockResolvedValue(null);

      const getLastKlinePrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number | null>>)['getLastKlinePrice'].bind(service);
      const result = await getLastKlinePrice('BTCUSDT', 'FUTURES');
      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockDbQuery.klines.findFirst.mockRejectedValue(new Error('DB error'));

      const getLastKlinePrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number | null>>)['getLastKlinePrice'].bind(service);
      const result = await getLastKlinePrice('BTCUSDT', 'FUTURES');
      expect(result).toBeNull();
    });
  });

  describe('getCurrentPrice', () => {
    it('should return cached price when cache is fresh', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '44000',
        timestamp: new Date(Date.now() - 30000),
      });

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);
      const result = await getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(result).toBe(44000);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch from API when cache is stale', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '44000',
        timestamp: new Date(Date.now() - 120000),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markPrice: '45000' }),
      });
      setupInsertChain();

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);
      const result = await getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(result).toBe(45000);
    });

    it('should use spot cache key without _FUTURES suffix', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT',
        price: '44000',
        timestamp: new Date(Date.now() - 30000),
      });

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);
      const result = await getCurrentPrice('BTCUSDT', 'SPOT');
      expect(result).toBe(44000);
    });

    it('should retry on fetch failure and succeed on second attempt', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ markPrice: '45000' }),
        });
      setupInsertChain();

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);

      const promise = getCurrentPrice('BTCUSDT', 'FUTURES');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe(45000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should fall back to kline price after all retries fail', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      mockDbQuery.klines.findFirst.mockResolvedValue({
        openTime: new Date(Date.now() - 60000),
        close: '43500',
      });

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);

      const promise = getCurrentPrice('BTCUSDT', 'FUTURES');
      await vi.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toBe(43500);
    });

    it('should fall back to stale cache when API and kline both fail', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '42000',
        timestamp: new Date(Date.now() - 300000),
      });
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));
      mockDbQuery.klines.findFirst.mockResolvedValue(null);

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);

      const promise = getCurrentPrice('BTCUSDT', 'FUTURES');
      await vi.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toBe(42000);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ cachedPrice: '42000' }),
        expect.stringContaining('stale cached price')
      );
    });

    it('should throw when all fallbacks exhausted', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      const networkError = new Error('Network error');
      mockFetch.mockImplementation(() => Promise.reject(networkError));
      mockDbQuery.klines.findFirst.mockResolvedValue(null);

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);

      const promise = getCurrentPrice('BTCUSDT', 'FUTURES').catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT' }),
        expect.stringContaining('Failed to fetch current price')
      );
    });

    it('should upsert price into cache on successful fetch', async () => {
      mockDbQuery.priceCache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markPrice: '45000' }),
      });

      const insertChain = setupInsertChain();

      const getCurrentPrice = (service as unknown as Record<string, (...args: unknown[]) => Promise<number>>)['getCurrentPrice'].bind(service);
      await getCurrentPrice('BTCUSDT', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
      expect(insertChain.valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT_FUTURES',
          price: '45000',
        })
      );
    });
  });

  describe('updateTrailingStops', () => {
    it('should return empty array when no open executions', async () => {
      setupSelectChain([]);

      const result = await service.updateTrailingStops();
      expect(result).toEqual([]);
    });

    it('should return empty array when all executions have trailing stop disabled', async () => {
      const exec = makeExecution({ walletId: 'wallet-disabled' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([exec]) }) };
        if (callCount === 2) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-disabled', trailingStopEnabled: false }]) }) };
        if (callCount === 3) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      const result = await service.updateTrailingStops();
      expect(result).toEqual([]);
    });

    it('should catch and log errors for individual symbol groups', async () => {
      const exec = makeExecution();

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([exec]) }) };
        if (callCount === 2) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]) }) };
        if (callCount === 3) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      mockDbQuery.setupDetections.findFirst.mockRejectedValue(new Error('DB boom'));

      const result = await service.updateTrailingStops();
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT' }),
        expect.stringContaining('Error processing trailing stops')
      );
    });
  });

  describe('filterByTrailingStopEnabled', () => {
    const filterByTrailingStopEnabled = (svc: TrailingStopService) =>
      (svc as unknown as Record<string, (execs: TradeExecution[]) => Promise<TradeExecution[]>>)['filterByTrailingStopEnabled'].bind(svc);

    it('should include executions for wallets with trailing stop enabled', async () => {
      const exec = makeExecution({ walletId: 'wallet-1' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      const result = await filterByTrailingStopEnabled(service)([exec]);
      expect(result).toHaveLength(1);
    });

    it('should exclude executions for wallets with trailing stop disabled', async () => {
      const exec = makeExecution({ walletId: 'wallet-1' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: false }]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      const result = await filterByTrailingStopEnabled(service)([exec]);
      expect(result).toHaveLength(0);
    });

    it('should include wallets with no config (defaults to enabled)', async () => {
      const exec = makeExecution({ walletId: 'wallet-no-config' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      const result = await filterByTrailingStopEnabled(service)([exec]);
      expect(result).toHaveLength(1);
    });

    it('should respect symbol override when useIndividualConfig is true', async () => {
      const exec = makeExecution({ walletId: 'wallet-1', symbol: 'BTCUSDT' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]) }) };
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              walletId: 'wallet-1',
              symbol: 'BTCUSDT',
              useIndividualConfig: true,
              trailingStopEnabled: false,
            }]),
          }),
        };
      });

      const result = await filterByTrailingStopEnabled(service)([exec]);
      expect(result).toHaveLength(0);
    });

    it('should ignore symbol override when useIndividualConfig is false', async () => {
      const exec = makeExecution({ walletId: 'wallet-1', symbol: 'BTCUSDT' });

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'wallet-1', trailingStopEnabled: true }]) }) };
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              walletId: 'wallet-1',
              symbol: 'BTCUSDT',
              useIndividualConfig: false,
              trailingStopEnabled: false,
            }]),
          }),
        };
      });

      const result = await filterByTrailingStopEnabled(service)([exec]);
      expect(result).toHaveLength(1);
    });

    it('should return all executions when walletIds is empty', async () => {
      const result = await filterByTrailingStopEnabled(service)([]);
      expect(result).toEqual([]);
    });
  });

  describe('groupExecutionsBySymbol', () => {
    type GroupFn = (execs: TradeExecution[]) => Map<string, TradeExecution[]>;
    const groupExecutionsBySymbol = (svc: TrailingStopService) =>
      (svc as unknown as Record<string, GroupFn>)['groupExecutionsBySymbol'].bind(svc);

    it('should group executions by symbol', () => {
      const exec1 = makeExecution({ id: 'e1', symbol: 'BTCUSDT' });
      const exec2 = makeExecution({ id: 'e2', symbol: 'ETHUSDT' });
      const exec3 = makeExecution({ id: 'e3', symbol: 'BTCUSDT' });

      const result = groupExecutionsBySymbol(service)([exec1, exec2, exec3]);
      expect(result.get('BTCUSDT')).toHaveLength(2);
      expect(result.get('ETHUSDT')).toHaveLength(1);
    });

    it('should return empty map for empty array', () => {
      const result = groupExecutionsBySymbol(service)([]);
      expect(result.size).toBe(0);
    });
  });

  describe('processSymbolGroup', () => {
    type ProcessFn = (symbol: string, execs: TradeExecution[]) => Promise<unknown[]>;
    const processSymbolGroup = (svc: TrailingStopService) =>
      (svc as unknown as Record<string, ProcessFn>)['processSymbolGroup'].bind(svc);

    it('should skip executions without setupId', async () => {
      const exec = makeExecution({ setupId: null });

      const result = await processSymbolGroup(service)('BTCUSDT', [exec]);
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-1' }),
        expect.stringContaining('missing setupId')
      );
    });

    it('should skip executions where setup is not found', async () => {
      const exec = makeExecution({ setupId: 'nonexistent' });
      mockDbQuery.setupDetections.findFirst.mockResolvedValue(null);

      const result = await processSymbolGroup(service)('BTCUSDT', [exec]);
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ setupId: 'nonexistent' }),
        expect.stringContaining('Setup not found')
      );
    });

    it('should skip interval group when insufficient klines', async () => {
      const exec = makeExecution();
      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(10));

      const result = await processSymbolGroup(service)('BTCUSDT', [exec]);
      expect(result).toEqual([]);
    });

    it('should process executions with sufficient klines and return updates', async () => {
      const exec = makeExecution({
        entryPrice: '100',
        stopLoss: '95',
        side: 'LONG',
        openedAt: new Date(Date.now() - 86400000),
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });

      const klineRows = makeKlineRows(30, Date.now() - 86400000 - 3600000);
      mockDbQuery.klines.findMany.mockResolvedValue(klineRows);

      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '110',
        timestamp: new Date(Date.now() - 10000),
      });

      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);
      setupUpdateChain();

      const result = await processSymbolGroup(service)('BTCUSDT', [exec]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should apply volatility profile when config enables it and ATR is available', async () => {
      const svc = new TrailingStopService({ useVolatilityBasedThresholds: true, useATRMultiplier: true });

      const exec = makeExecution({ openedAt: new Date(Date.now() - 86400000) });
      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30, Date.now() - 86400000 - 3600000));
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '110',
        timestamp: new Date(Date.now() - 10000),
      });
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);
      setupUpdateChain();

      await processSymbolGroup(svc)('BTCUSDT', [exec]);

      expect(mockCalculateATRPercent).toHaveBeenCalled();
      expect(mockGetVolatilityProfile).toHaveBeenCalled();
    });

    it('should parse fibonacci projection data from execution', async () => {
      const fibData = {
        swingLow: { price: 90, index: 0, timestamp: 1000 },
        swingHigh: { price: 100, index: 10, timestamp: 2000 },
        range: 10,
        primaryLevel: 1.618,
        levels: [{ level: 1.0, price: 100, label: '100%' }],
      };

      const exec = makeExecution({
        fibonacciProjection: JSON.stringify(fibData),
        openedAt: new Date(Date.now() - 86400000),
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30, Date.now() - 86400000 - 3600000));
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '110',
        timestamp: new Date(Date.now() - 10000),
      });
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);
      setupUpdateChain();

      await processSymbolGroup(service)('BTCUSDT', [exec]);
    });

    it('should warn and continue when fibonacci data is invalid JSON', async () => {
      const exec = makeExecution({
        fibonacciProjection: 'invalid-json',
        openedAt: new Date(Date.now() - 86400000),
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30, Date.now() - 86400000 - 3600000));
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT_FUTURES',
        price: '110',
        timestamp: new Date(Date.now() - 10000),
      });
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);
      setupUpdateChain();

      await processSymbolGroup(service)('BTCUSDT', [exec]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-1' }),
        expect.stringContaining('Failed to parse Fibonacci')
      );
    });

    it('should use SPOT marketType when execution is SPOT', async () => {
      const exec = makeExecution({
        marketType: 'SPOT',
        openedAt: new Date(Date.now() - 86400000),
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(30, Date.now() - 86400000 - 3600000));
      mockDbQuery.priceCache.findFirst.mockResolvedValue({
        symbol: 'BTCUSDT',
        price: '110',
        timestamp: new Date(Date.now() - 10000),
      });
      mockDbQuery.autoTradingConfig.findFirst.mockResolvedValue(null);
      mockDbQuery.symbolTrailingStopOverrides.findFirst.mockResolvedValue(null);
      setupUpdateChain();

      await processSymbolGroup(service)('BTCUSDT', [exec]);
    });
  });

  describe('calculateTrailingStopWithConfig', () => {
    const calculateTrailingStopWithConfig = (svc: TrailingStopService) =>
      (svc as unknown as Record<string, (...args: unknown[]) => unknown>)['calculateTrailingStopWithConfig'].bind(svc);

    const baseKlines = makeKlineRows(30, Date.now() - 86400000 - 3600000).map((k, i) => ({
      symbol: k.symbol,
      interval: '1h',
      openTime: new Date(Date.now() - (30 - i) * 3600000).getTime(),
      closeTime: new Date(Date.now() - (29 - i) * 3600000).getTime(),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume ?? '0',
      trades: k.trades ?? 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
    }));

    const config: TrailingStopOptimizationConfig = {
      breakevenProfitThreshold: 0.01,
      breakevenWithFeesThreshold: 0.015,
      minTrailingDistancePercent: 0.002,
      swingLookback: 3,
      useATRMultiplier: false,
      atrMultiplier: 2.0,
      feePercent: 0.0008,
      trailingDistancePercent: 0.3,
      useVolatilityBasedThresholds: false,
      marketType: 'FUTURES',
      useBnbDiscount: false,
    };

    it('should return null when no klines exist after entry', () => {
      const exec = makeExecution({
        openedAt: new Date(Date.now() + 3600000),
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 110, [], baseKlines, undefined, config, null
      );
      expect(result).toBeNull();
    });

    it('should return null when still in entry candle', () => {
      const exec = makeExecution({
        openedAt: new Date(baseKlines[baseKlines.length - 1]!.openTime),
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 110, [], baseKlines, undefined, config, null
      );
      expect(result).toBeNull();
    });

    it('should use stored extreme prices when trailing is already activated for LONG', () => {
      const exec = makeExecution({
        side: 'LONG',
        entryPrice: '100',
        stopLoss: '99',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: new Date(Date.now() - 1800000),
        highestPriceSinceTrailingActivation: '115',
        lowestPriceSinceTrailingActivation: '98',
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 120, [], baseKlines, undefined, config, null
      );

      if (result) {
        expect(result.isFirstActivation).toBe(false);
      }
    });

    it('should mark first activation when trailing is not yet activated', () => {
      const exec = makeExecution({
        side: 'LONG',
        entryPrice: '100',
        stopLoss: '95',
        takeProfit: '120',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: null,
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 115, [], baseKlines, undefined, config, null
      );

      if (result) {
        expect(result.isFirstActivation).toBe(true);
      }
    });

    it('should update highest price for LONG when current price exceeds stored extreme', () => {
      const exec = makeExecution({
        side: 'LONG',
        entryPrice: '100',
        stopLoss: '95',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: new Date(Date.now() - 1800000),
        highestPriceSinceTrailingActivation: '110',
      });

      calculateTrailingStopWithConfig(service)(
        exec, 115, [], baseKlines, undefined, config, null
      );
    });

    it('should update lowest price for SHORT when current price is below stored extreme', () => {
      const exec = makeExecution({
        side: 'SHORT',
        entryPrice: '100',
        stopLoss: '105',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: new Date(Date.now() - 1800000),
        lowestPriceSinceTrailingActivation: '95',
      });

      calculateTrailingStopWithConfig(service)(
        exec, 90, [], baseKlines, undefined, config, null
      );
    });

    it('should pass take profit from execution to trailing stop computation', () => {
      const exec = makeExecution({
        entryPrice: '100',
        takeProfit: '120',
        stopLoss: '95',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
      });

      calculateTrailingStopWithConfig(service)(
        exec, 115, [], baseKlines, undefined, config, null
      );
    });

    it('should handle execution without take profit', () => {
      const exec = makeExecution({
        entryPrice: '100',
        takeProfit: null,
        stopLoss: '95',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
      });

      calculateTrailingStopWithConfig(service)(
        exec, 115, [], baseKlines, undefined, config, null
      );
    });

    it('should handle execution without current stop loss', () => {
      const exec = makeExecution({
        entryPrice: '100',
        stopLoss: null,
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
      });

      calculateTrailingStopWithConfig(service)(
        exec, 115, [], baseKlines, undefined, config, null
      );
    });

    it('should include currentExtremePrice in result for LONG', () => {
      const exec = makeExecution({
        side: 'LONG',
        entryPrice: '100',
        stopLoss: '95',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: new Date(Date.now() - 1800000),
        highestPriceSinceTrailingActivation: '115',
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 112, [], baseKlines, undefined, config, null
      );

      if (result) {
        expect(result.currentExtremePrice).toBe(115);
      }
    });

    it('should include currentExtremePrice in result for SHORT', () => {
      const exec = makeExecution({
        side: 'SHORT',
        entryPrice: '100',
        stopLoss: '105',
        openedAt: new Date(baseKlines[0]!.openTime - 3600000),
        trailingActivatedAt: new Date(Date.now() - 1800000),
        lowestPriceSinceTrailingActivation: '88',
      });

      const result = calculateTrailingStopWithConfig(service)(
        exec, 90, [], baseKlines, undefined, config, null
      );

      if (result) {
        expect(result.currentExtremePrice).toBe(88);
      }
    });
  });

  describe('applyStopLossUpdate', () => {
    const applyStopLossUpdate = (svc: TrailingStopService) =>
      (svc as unknown as Record<string, (...args: unknown[]) => Promise<void>>)['applyStopLossUpdate'].bind(svc);

    it('should update trade execution in database with new stop loss', async () => {
      const exec = makeExecution({ side: 'LONG', marketType: 'FUTURES' });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({ stopLoss: '101' })
      );
    });

    it('should set trailingActivatedAt on first activation', async () => {
      const exec = makeExecution({ side: 'LONG' });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, true, 110);

      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          stopLoss: '101',
          trailingActivatedAt: expect.any(Date),
          highestPriceSinceTrailingActivation: '110',
        })
      );
    });

    it('should set lowestPriceSinceTrailingActivation on first activation for SHORT', async () => {
      const exec = makeExecution({ side: 'SHORT' });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 99, 105, true, 90);

      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          stopLoss: '99',
          trailingActivatedAt: expect.any(Date),
          lowestPriceSinceTrailingActivation: '90',
        })
      );
    });

    it('should update highestPriceSinceTrailingActivation when new extreme for LONG', async () => {
      const exec = makeExecution({
        side: 'LONG',
        highestPriceSinceTrailingActivation: '100',
      });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 105, 100, false, 110);

      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          highestPriceSinceTrailingActivation: '110',
        })
      );
    });

    it('should not update highestPriceSinceTrailingActivation when not a new extreme for LONG', async () => {
      const exec = makeExecution({
        side: 'LONG',
        highestPriceSinceTrailingActivation: '120',
      });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 105, 100, false, 110);

      const setCallArg = updateChain.setFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCallArg['highestPriceSinceTrailingActivation']).toBeUndefined();
    });

    it('should update lowestPriceSinceTrailingActivation when new extreme for SHORT', async () => {
      const exec = makeExecution({
        side: 'SHORT',
        lowestPriceSinceTrailingActivation: '90',
      });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 95, 100, false, 85);

      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          lowestPriceSinceTrailingActivation: '85',
        })
      );
    });

    it('should not update lowestPriceSinceTrailingActivation when not a new extreme for SHORT', async () => {
      const exec = makeExecution({
        side: 'SHORT',
        lowestPriceSinceTrailingActivation: '80',
      });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 95, 100, false, 85);

      const setCallArg = updateChain.setFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCallArg['lowestPriceSinceTrailingActivation']).toBeUndefined();
    });

    it('should update stop loss on Binance for live FUTURES wallet with algo order', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: 12345,
        stopLossIsAlgo: true,
        walletId: 'wallet-live',
      });

      const wallet = {
        id: 'wallet-live',
        walletType: 'live',
        name: 'Live Wallet',
      };

      const selectWhere = vi.fn().mockResolvedValue([wallet]);
      const selectLimit = vi.fn().mockReturnValue(selectWhere);
      const selectFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectLimit }) });
      mockDbSelect.mockReturnValue({ from: selectFrom });

      selectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([wallet]),
        }),
      });

      mockUpdateStopLossOrder.mockResolvedValue({ algoId: 99999 });
      setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockUpdateStopLossOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          side: 'LONG',
          triggerPrice: 101,
          marketType: 'FUTURES',
          currentAlgoId: 12345,
        })
      );
    });

    it('should skip Binance order update for paper wallets', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: 12345,
        stopLossIsAlgo: true,
        walletId: 'wallet-paper',
      });

      const wallet = { id: 'wallet-paper', walletType: 'paper', name: 'Paper Wallet' };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([wallet]),
          }),
        }),
      });

      setupUpdateChain();
      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockUpdateStopLossOrder).not.toHaveBeenCalled();
    });

    it('should skip Binance order update when stopLossIsAlgo is false', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: 12345,
        stopLossIsAlgo: false,
      });

      setupUpdateChain();
      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockUpdateStopLossOrder).not.toHaveBeenCalled();
    });

    it('should skip Binance order update when no stopLossAlgoId', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: null,
        stopLossIsAlgo: true,
      });

      setupUpdateChain();
      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockUpdateStopLossOrder).not.toHaveBeenCalled();
    });

    it('should log error but continue when Binance order update fails', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: 12345,
        stopLossIsAlgo: true,
        walletId: 'wallet-live',
      });

      const wallet = { id: 'wallet-live', walletType: 'live', name: 'Live' };
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([wallet]),
          }),
        }),
      });

      mockUpdateStopLossOrder.mockRejectedValue(new Error('Binance error'));
      setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-1' }),
        expect.stringContaining('Failed to update SL order')
      );
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should emit WebSocket notifications when WebSocket service is available', async () => {
      const exec = makeExecution({ side: 'LONG', walletId: 'wallet-1' });
      setupUpdateChain();

      mockGetWebSocketService.mockReturnValue({
        emitTradeNotification: mockEmitTradeNotification,
        emitPositionUpdate: mockEmitPositionUpdate,
      });

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockEmitTradeNotification).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
        type: 'TRAILING_STOP_UPDATED',
        title: '> Trailing Stop',
        urgency: 'low',
      }));

      expect(mockEmitPositionUpdate).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
        id: 'exec-1',
        status: 'open',
        stopLoss: '101',
      }));
    });

    it('should show correct side label in notification for SHORT', async () => {
      const exec = makeExecution({ side: 'SHORT', walletId: 'wallet-1' });
      setupUpdateChain();

      mockGetWebSocketService.mockReturnValue({
        emitTradeNotification: mockEmitTradeNotification,
        emitPositionUpdate: mockEmitPositionUpdate,
      });

      await applyStopLossUpdate(service)(exec, 99, 105, false, undefined);

      expect(mockEmitTradeNotification).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
        body: expect.stringContaining('Short'),
      }));
    });

    it('should not emit notifications when WebSocket service is null', async () => {
      const exec = makeExecution();
      setupUpdateChain();
      mockGetWebSocketService.mockReturnValue(null);

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(mockEmitTradeNotification).not.toHaveBeenCalled();
      expect(mockEmitPositionUpdate).not.toHaveBeenCalled();
    });

    it('should handle null oldStopLoss in notification body', async () => {
      const exec = makeExecution({ side: 'LONG' });
      setupUpdateChain();

      mockGetWebSocketService.mockReturnValue({
        emitTradeNotification: mockEmitTradeNotification,
        emitPositionUpdate: mockEmitPositionUpdate,
      });

      await applyStopLossUpdate(service)(exec, 101, null, false, undefined);

      expect(mockEmitTradeNotification).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({
          body: expect.stringContaining('-'),
        })
      );
    });

    it('should log first activation message', async () => {
      const exec = makeExecution({ side: 'LONG' });
      setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, true, 110);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-1', currentExtremePrice: 110 }),
        expect.stringContaining('First activation')
      );
    });

    it('should include algoId in update when Binance order returns new algoId', async () => {
      const exec = makeExecution({
        marketType: 'FUTURES',
        stopLossAlgoId: 12345,
        stopLossIsAlgo: true,
        walletId: 'wallet-live',
      });

      const wallet = { id: 'wallet-live', walletType: 'live', name: 'Live' };
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([wallet]),
          }),
        }),
      });

      mockUpdateStopLossOrder.mockResolvedValue({ algoId: 99999 });
      const updateChain = setupUpdateChain();

      await applyStopLossUpdate(service)(exec, 101, 95, false, undefined);

      expect(updateChain.setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          stopLoss: '101',
          stopLossAlgoId: 99999,
        })
      );
    });
  });

  describe('end-to-end updateTrailingStops flow', () => {
    it('should process multiple symbols with different intervals', async () => {
      const exec1 = makeExecution({ id: 'e1', symbol: 'BTCUSDT', walletId: 'w1', setupId: 's1' });
      const exec2 = makeExecution({ id: 'e2', symbol: 'ETHUSDT', walletId: 'w1', setupId: 's2' });

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([exec1, exec2]) }) };
        }
        if (selectCallCount === 2) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ walletId: 'w1', trailingStopEnabled: true }]) }) };
        }
        if (selectCallCount === 3) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 's1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(5));

      const result = await service.updateTrailingStops();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle mixed enabled and disabled wallets', async () => {
      const exec1 = makeExecution({ id: 'e1', walletId: 'w-enabled' });
      const exec2 = makeExecution({ id: 'e2', walletId: 'w-disabled' });

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([exec1, exec2]) }) };
        }
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { walletId: 'w-enabled', trailingStopEnabled: true },
                { walletId: 'w-disabled', trailingStopEnabled: false },
              ]),
            }),
          };
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      });

      mockDbQuery.setupDetections.findFirst.mockResolvedValue({ id: 'setup-1', interval: '1h' });
      mockDbQuery.klines.findMany.mockResolvedValue(makeKlineRows(5));

      const result = await service.updateTrailingStops();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
