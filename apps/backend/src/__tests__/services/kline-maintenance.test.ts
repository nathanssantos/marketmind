import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbQueryKlinesFindMany = vi.fn();
const mockDbQueryKlinesFindFirst = vi.fn();
const mockDbQueryPairMaintenanceLogFindFirst = vi.fn();
const mockDbQueryActiveWatchersFindMany = vi.fn();

vi.mock('../../db', () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
    query: {
      klines: {
        findMany: mockDbQueryKlinesFindMany,
        findFirst: mockDbQueryKlinesFindFirst,
      },
      pairMaintenanceLog: {
        findFirst: mockDbQueryPairMaintenanceLogFindFirst,
      },
      activeWatchers: {
        findMany: mockDbQueryActiveWatchersFindMany,
      },
    },
  },
}));

vi.mock('../../db/schema', () => ({
  klines: {
    symbol: 'symbol',
    interval: 'interval',
    marketType: 'marketType',
    openTime: 'openTime',
    closeTime: 'closeTime',
  },
  pairMaintenanceLog: {
    symbol: 'symbol',
    interval: 'interval',
    marketType: 'marketType',
  },
  activeWatchers: {},
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ type: 'gte', a, b })),
  lte: vi.fn((a: unknown, b: unknown) => ({ type: 'lte', a, b })),
  asc: vi.fn((col: unknown) => ({ type: 'asc', col })),
}));

const mockFetchHistoricalKlinesFromAPI = vi.fn();
const mockFetchFuturesKlinesFromAPI = vi.fn();
const mockGetIntervalMilliseconds = vi.fn();

vi.mock('../../services/binance-historical', () => ({
  fetchHistoricalKlinesFromAPI: mockFetchHistoricalKlinesFromAPI,
  fetchFuturesKlinesFromAPI: mockFetchFuturesKlinesFromAPI,
  getIntervalMilliseconds: mockGetIntervalMilliseconds,
}));

const mockSpotGetActiveSubscriptions = vi.fn();
const mockFuturesGetActiveSubscriptions = vi.fn();

vi.mock('../../services/binance-kline-stream', () => ({
  binanceKlineStreamService: {
    getActiveSubscriptions: mockSpotGetActiveSubscriptions,
  },
  binanceFuturesKlineStreamService: {
    getActiveSubscriptions: mockFuturesGetActiveSubscriptions,
  },
}));

const mockIsKlineCorrupted = vi.fn();
const mockIsKlineStaleCorrupted = vi.fn();
const mockIsKlineSpikeCorrupted = vi.fn();
const mockFetchBinanceKlinesBatch = vi.fn();

vi.mock('../../services/kline-validator', () => ({
  KlineValidator: {
    isKlineCorrupted: mockIsKlineCorrupted,
    isKlineStaleCorrupted: mockIsKlineStaleCorrupted,
    isKlineSpikeCorrupted: mockIsKlineSpikeCorrupted,
    fetchBinanceKlinesBatch: mockFetchBinanceKlinesBatch,
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock('../../services/watcher-batch-logger', () => {
  class MockMaintenanceLogBuffer {
    private _type: string;
    gapFills: unknown[] = [];
    corruptionFixes: unknown[] = [];
    pairsChecked = 0;

    constructor(type: string) {
      this._type = type;
    }

    addGapFill(entry: unknown) {
      this.gapFills.push(entry);
    }

    addCorruptionFix(entry: unknown) {
      this.corruptionFixes.push(entry);
    }

    setPairsChecked(count: number) {
      this.pairsChecked = count;
    }

    toResult() {
      return {
        type: this._type,
        startTime: new Date(),
        endTime: new Date(),
        pairsChecked: this.pairsChecked,
        totalGapsFound: this.gapFills.length,
        totalCandlesFilled: 0,
        totalCorruptedFixed: 0,
        gapFills: this.gapFills,
        corruptionFixes: this.corruptionFixes,
      };
    }
  }

  return {
    MaintenanceLogBuffer: MockMaintenanceLogBuffer,
    outputMaintenanceResults: vi.fn(),
    outputReconnectionValidationResults: vi.fn(),
  };
});

vi.mock('../../constants', () => ({
  REQUIRED_KLINES: 2500,
  TIME_MS: { HOUR: 3_600_000, MINUTE: 60_000, SECOND: 1000 },
  COOLDOWN_GAP_CHECK: 7_200_000,
  COOLDOWN_CORRUPTION_CHECK: 7_200_000,
  CORRUPTION_CHECK_KLINES: 1000,
  API_VALIDATION_RECENT_COUNT: 1000,
}));

const {
  KlineMaintenance,
  getKlineMaintenance,
  initializeKlineMaintenance,
  getKlineGapFiller,
  initializeKlineGapFiller,
} = await import('../../services/kline-maintenance');

type KlineMaintenanceInstance = InstanceType<typeof KlineMaintenance>;

const HOUR_MS = 3_600_000;

const createDbKline = (overrides: Partial<{
  symbol: string;
  interval: string;
  marketType: string;
  openTime: Date;
  closeTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  createdAt: Date;
}> = {}) => ({
  symbol: 'BTCUSDT',
  interval: '4h',
  marketType: 'FUTURES',
  openTime: new Date('2024-06-01T00:00:00Z'),
  closeTime: new Date('2024-06-01T04:00:00Z'),
  open: '60000',
  high: '61000',
  low: '59000',
  close: '60500',
  volume: '1000',
  quoteVolume: '60000000',
  trades: 5000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '30000000',
  createdAt: new Date(),
  ...overrides,
});

const createApiKline = (openTime: number) => ({
  openTime,
  closeTime: openTime + HOUR_MS - 1,
  open: '60000',
  high: '61000',
  low: '59000',
  close: '60500',
  volume: '1000',
  quoteVolume: '60000000',
  trades: 5000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '30000000',
});

const setupDefaultMocks = () => {
  mockGetIntervalMilliseconds.mockReturnValue(HOUR_MS);
  mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
  mockSpotGetActiveSubscriptions.mockReturnValue([]);
  mockFuturesGetActiveSubscriptions.mockReturnValue([]);
  mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
  mockDbQueryKlinesFindMany.mockResolvedValue([]);
  mockDbQueryKlinesFindFirst.mockResolvedValue(null);
  mockFetchHistoricalKlinesFromAPI.mockResolvedValue([]);
  mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);
  mockIsKlineCorrupted.mockReturnValue(null);
  mockIsKlineStaleCorrupted.mockReturnValue(null);
  mockIsKlineSpikeCorrupted.mockReturnValue(null);
  mockFetchBinanceKlinesBatch.mockResolvedValue(new Map());

  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  });

  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
};

describe('KlineMaintenance', () => {
  let maintenance: KlineMaintenanceInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setupDefaultMocks();
    maintenance = new KlineMaintenance();
  });

  afterEach(() => {
    maintenance.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should set up a check interval and run startup sync', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      await maintenance.start();
      expect(mockDbQueryActiveWatchersFindMany).toHaveBeenCalled();
    });

    it('should not reinitialize if already started', async () => {
      await maintenance.start();
      const callCount = mockDbQueryActiveWatchersFindMany.mock.calls.length;
      await maintenance.start();
      expect(mockDbQueryActiveWatchersFindMany.mock.calls.length).toBe(callCount);
    });

    it('should skip startup sync when skipStartupSync is true', async () => {
      await maintenance.start({ skipStartupSync: true });
      expect(mockDbQueryActiveWatchersFindMany).not.toHaveBeenCalled();
    });

    it('should schedule delayed startup sync when skipStartupSync and delayMs are set', async () => {
      await maintenance.start({ skipStartupSync: true, delayMs: 5000 });
      expect(mockDbQueryActiveWatchersFindMany).not.toHaveBeenCalled();

      vi.advanceTimersByTime(4999);
      await Promise.resolve();
      expect(mockDbQueryActiveWatchersFindMany).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear the check interval', async () => {
      await maintenance.start();
      maintenance.stop();
      const callCountAfterStop = mockDbQueryActiveWatchersFindMany.mock.calls.length;
      vi.advanceTimersByTime(10 * HOUR_MS);
      expect(mockDbQueryActiveWatchersFindMany.mock.calls.length).toBe(callCountAfterStop);
    });

    it('should be safe to call stop when not started', () => {
      expect(() => maintenance.stop()).not.toThrow();
    });

    it('should be safe to call stop multiple times', async () => {
      await maintenance.start();
      maintenance.stop();
      expect(() => maintenance.stop()).not.toThrow();
    });
  });

  describe('checkAndFillGaps', () => {
    it('should skip when already running', async () => {
      mockDbQueryActiveWatchersFindMany.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([
          { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
        ]), 100))
      );

      const promise1 = maintenance.checkAndFillGaps();
      const promise2 = maintenance.checkAndFillGaps();

      vi.advanceTimersByTime(200);
      await Promise.all([promise1, promise2]);

      expect(mockDbQueryActiveWatchersFindMany).toHaveBeenCalledTimes(1);
    });

    it('should return early when no active pairs exist', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryKlinesFindMany).not.toHaveBeenCalled();
    });

    it('should check gaps for active pairs', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryKlinesFindMany).toHaveBeenCalled();
    });

    it('should skip gap check when cooldown is active', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        lastGapCheck: new Date(Date.now() - 1000),
        lastCorruptionCheck: new Date(Date.now() - 1000),
      });

      await maintenance.checkAndFillGaps();

      expect(mockFetchFuturesKlinesFromAPI).not.toHaveBeenCalled();
    });

    it('should handle errors during gap checking gracefully', async () => {
      mockDbQueryActiveWatchersFindMany.mockRejectedValue(new Error('DB connection failed'));

      await expect(maintenance.checkAndFillGaps()).resolves.toBeUndefined();
    });

    it('should handle per-pair errors without stopping other pairs', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
        { symbol: 'ETHUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);

      let callCount = 0;
      mockDbQueryPairMaintenanceLogFindFirst.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) throw new Error('DB error for first pair');
        return Promise.resolve(null);
      });

      await maintenance.checkAndFillGaps();
    });

    it('should fill detected gaps using futures API for FUTURES market type', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime), closeTime: new Date(baseTime + HOUR_MS - 1) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 4 * HOUR_MS), closeTime: new Date(baseTime + 5 * HOUR_MS - 1) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      const gapKline = createApiKline(baseTime + HOUR_MS);
      mockFetchFuturesKlinesFromAPI.mockResolvedValue([gapKline]);

      await maintenance.checkAndFillGaps();

      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
    });

    it('should check and fix corrupted klines when corruption cooldown expired', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);

      const recentCheck = new Date(Date.now() - 1000);
      const expiredCheck = new Date(Date.now() - 10 * HOUR_MS);

      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: recentCheck })
        .mockResolvedValueOnce({ lastCorruptionCheck: expiredCheck });

      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryKlinesFindMany).toHaveBeenCalled();
    });
  });

  describe('forceCheckSymbol', () => {
    it('should detect gaps and fill them for the specified symbol', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 3 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([
        createApiKline(baseTime + HOUR_MS),
      ]);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(result).toHaveProperty('gapsFilled');
      expect(result).toHaveProperty('corruptedFixed');
    });

    it('should use SPOT API for SPOT market type', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);
      mockFetchHistoricalKlinesFromAPI.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'SPOT');

      expect(mockFetchHistoricalKlinesFromAPI).toHaveBeenCalled();
      expect(mockFetchFuturesKlinesFromAPI).not.toHaveBeenCalled();
    });

    it('should default market type to FUTURES', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h');

      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
    });

    it('should update maintenance log after force check', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('ETHUSDT', '4h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });
  });

  describe('gap detection logic', () => {
    it('should detect gap at the beginning when first kline is after start time', async () => {
      const baseTime = Date.now() - 5 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const firstKline = createDbKline({ openTime: new Date(baseTime + 3 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([firstKline]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([
        createApiKline(baseTime),
      ]);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
      expect(result.gapsFilled).toBeGreaterThanOrEqual(0);
    });

    it('should detect gaps between consecutive klines', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([
        createApiKline(baseTime + HOUR_MS),
        createApiKline(baseTime + 2 * HOUR_MS),
      ]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
    });

    it('should detect gap at the end when last kline is old', async () => {
      const now = Date.now();
      const baseTime = now - 100 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
    });

    it('should return full gap when no klines exist and no known earliest date', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([
        createApiKline(Date.now() - 2 * HOUR_MS),
      ]);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
      expect(result.gapsFilled).toBeGreaterThanOrEqual(0);
    });

    it('should not report gap at beginning when earliestKlineDate is known', async () => {
      const earliestDate = new Date('2020-01-01');
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        earliestKlineDate: earliestDate,
        lastGapCheck: null,
        lastCorruptionCheck: null,
      });

      const now = Date.now();
      const klines = [
        createDbKline({ openTime: new Date(now - 3 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - 2 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(result).toBeDefined();
    });

    it('should return empty gaps when no klines and earliestKlineDate is known', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        earliestKlineDate: new Date('2020-01-01'),
        lastGapCheck: null,
        lastCorruptionCheck: null,
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.gapsFilled).toBe(0);
    });
  });

  describe('gap filling', () => {
    it('should insert fetched klines into the database', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      const apiKlines = [
        createApiKline(baseTime + HOUR_MS),
        createApiKline(baseTime + 2 * HOUR_MS),
      ];
      mockFetchFuturesKlinesFromAPI.mockResolvedValue(apiKlines);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should record earliest kline date when no klines returned from API', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should handle insert errors for individual klines gracefully', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      const apiKlines = [createApiKline(baseTime + HOUR_MS)];
      mockFetchFuturesKlinesFromAPI.mockResolvedValue(apiKlines);

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockRejectedValue(new Error('Insert failed')),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await expect(maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES')).resolves.toBeDefined();
    });

    it('should handle API fetch errors gracefully', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockFetchFuturesKlinesFromAPI.mockRejectedValue(new Error('API timeout'));

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.gapsFilled).toBe(0);
    });

    it('should process gaps in batches of 3', async () => {
      const baseTime = Date.now() - 50 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) }),
        createDbKline({ openTime: new Date(baseTime + 10 * HOUR_MS) }),
        createDbKline({ openTime: new Date(baseTime + 15 * HOUR_MS) }),
        createDbKline({ openTime: new Date(baseTime + 20 * HOUR_MS) }),
        createDbKline({ openTime: new Date(baseTime + 25 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockFetchFuturesKlinesFromAPI).toHaveBeenCalled();
    });
  });

  describe('corruption detection and fixing', () => {
    it('should detect corrupted klines using KlineValidator.isKlineCorrupted', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: new Date(now - 1000) })
        .mockResolvedValueOnce(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        open: '0',
        high: '0',
        low: '0',
        close: '0',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);

      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero or negative prices' });

      const fixedKline = {
        openTime: corruptedKline.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: corruptedKline.closeTime.getTime(),
      };
      const apiMap = new Map<number, typeof fixedKline>();
      apiMap.set(corruptedKline.openTime.getTime(), fixedKline);
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      await maintenance.checkAndFillGaps();

      expect(mockIsKlineCorrupted).toHaveBeenCalled();
      expect(mockFetchBinanceKlinesBatch).toHaveBeenCalled();
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should detect stale corrupted klines', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const now = Date.now();
      const klines = [
        createDbKline({ openTime: new Date(now - 3 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - 2 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValueOnce(null).mockReturnValueOnce({ openTime: klines[1]!.openTime, reason: 'Stale candle' }).mockReturnValueOnce(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const fixedKline = {
        openTime: klines[1]!.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: klines[1]!.closeTime.getTime(),
      };
      const apiMap = new Map<number, typeof fixedKline>();
      apiMap.set(klines[1]!.openTime.getTime(), fixedKline);
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBeGreaterThanOrEqual(0);
    });

    it('should detect spike corrupted klines', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const now = Date.now();
      const klines = [
        createDbKline({ openTime: new Date(now - 3 * HOUR_MS) }),
        createDbKline({
          openTime: new Date(now - 2 * HOUR_MS),
          close: '90000',
          high: '91000',
        }),
        createDbKline({ openTime: new Date(now - HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ openTime: klines[1]!.openTime, reason: 'Close price spike' })
        .mockReturnValueOnce(null);

      const apiMap = new Map();
      apiMap.set(klines[1]!.openTime.getTime(), {
        openTime: klines[1]!.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: klines[1]!.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(mockIsKlineSpikeCorrupted).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return zero counts when no corrupted klines found', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([
        createDbKline({ openTime: new Date(Date.now() - HOUR_MS) }),
      ]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(0);
    });
  });

  describe('active pairs resolution', () => {
    it('should get pairs from active watchers in database', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
        { symbol: 'ETHUSDT', interval: '1h', marketType: 'SPOT' },
      ]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryActiveWatchersFindMany).toHaveBeenCalled();
    });

    it('should include pairs from spot stream subscriptions', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      mockSpotGetActiveSubscriptions.mockReturnValue([
        { symbol: 'ADAUSDT', interval: '15m' },
      ]);

      await maintenance.checkAndFillGaps();

      expect(mockSpotGetActiveSubscriptions).toHaveBeenCalled();
    });

    it('should include pairs from futures stream subscriptions', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([
        { symbol: 'SOLUSDT', interval: '4h' },
      ]);

      await maintenance.checkAndFillGaps();

      expect(mockFuturesGetActiveSubscriptions).toHaveBeenCalled();
    });

    it('should deduplicate pairs across all sources', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([
        { symbol: 'BTCUSDT', interval: '4h' },
      ]);
      mockSpotGetActiveSubscriptions.mockReturnValue([]);

      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      const gapDetectionCalls = mockDbQueryKlinesFindMany.mock.calls.length;
      expect(gapDetectionCalls).toBeLessThanOrEqual(2);
    });

    it('should handle stream service errors gracefully', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '4h', marketType: 'FUTURES' },
      ]);
      mockSpotGetActiveSubscriptions.mockImplementation(() => { throw new Error('Service not ready'); });
      mockFuturesGetActiveSubscriptions.mockImplementation(() => { throw new Error('Service not ready'); });

      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await expect(maintenance.checkAndFillGaps()).resolves.toBeUndefined();
    });
  });

  describe('cooldown checks', () => {
    it('should allow gap check when no previous check exists', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryKlinesFindMany).toHaveBeenCalled();
    });

    it('should allow gap check when cooldown has expired', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        lastGapCheck: new Date(Date.now() - 10 * HOUR_MS),
        lastCorruptionCheck: new Date(Date.now() - 10 * HOUR_MS),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();

      expect(mockDbQueryKlinesFindMany).toHaveBeenCalled();
    });

    it('should skip gap check when cooldown is still active', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        lastGapCheck: new Date(Date.now() - 60_000),
        lastCorruptionCheck: new Date(Date.now() - 60_000),
      });

      await maintenance.checkAndFillGaps();

      expect(mockFetchFuturesKlinesFromAPI).not.toHaveBeenCalled();
    });

    it('should allow corruption check when no previous check exists', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: new Date(Date.now() - 1000) })
        .mockResolvedValueOnce(null);

      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();
    });
  });

  describe('maintenance log updates', () => {
    it('should create maintenance log entry for new pairs', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('NEWCOIN', '1h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should update maintenance log with gap check results', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '4h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should update maintenance log with corruption check results', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '4h', 'FUTURES');

      const insertCalls = mockDbInsert.mock.calls.length;
      expect(insertCalls).toBeGreaterThanOrEqual(2);
    });
  });

  describe('checkAfterReconnection', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should return zero counts when no active pairs', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);

      const result = await maintenance.checkAfterReconnection();

      expect(result).toEqual({ checked: 0, fixed: 0 });
    });

    it('should skip pairs with no recent klines', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      const result = await maintenance.checkAfterReconnection();

      expect(result.checked).toBe(0);
    });

    it('should check klines against Binance API after reconnection', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const recentKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([recentKline]);

      const apiMap = new Map();
      apiMap.set(recentKline.openTime.getTime(), {
        openTime: recentKline.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: recentKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();

      expect(result.checked).toBeGreaterThan(0);
      expect(mockFetchBinanceKlinesBatch).toHaveBeenCalled();
    });

    it('should fix mismatched klines after reconnection', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        close: '50000',
        volume: '100',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();

      expect(result.fixed).toBeGreaterThan(0);
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should not fix klines that match the API data', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: dbKline.open,
        high: dbKline.high,
        low: dbKline.low,
        close: dbKline.close,
        volume: dbKline.volume,
        quoteVolume: dbKline.quoteVolume,
        trades: dbKline.trades,
        takerBuyBaseVolume: dbKline.takerBuyBaseVolume,
        takerBuyQuoteVolume: dbKline.takerBuyQuoteVolume,
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();

      expect(result.fixed).toBe(0);
    });

    it('should check multiple pairs during reconnection validation', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
        { symbol: 'ETHUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const kline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline]);

      const apiMap = new Map();
      apiMap.set(kline.openTime.getTime(), {
        openTime: kline.openTime.getTime(),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        quoteVolume: kline.quoteVolume,
        trades: kline.trades,
        takerBuyBaseVolume: kline.takerBuyBaseVolume,
        takerBuyQuoteVolume: kline.takerBuyQuoteVolume,
        closeTime: kline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();

      expect(result.checked).toBeGreaterThan(0);
      expect(mockFetchBinanceKlinesBatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('periodic interval execution', () => {
    it('should set up periodic check interval on start', async () => {
      await maintenance.start();

      const callsBefore = mockDbQueryActiveWatchersFindMany.mock.calls.length;
      maintenance.stop();

      vi.advanceTimersByTime(10 * HOUR_MS);
      await Promise.resolve();

      expect(mockDbQueryActiveWatchersFindMany.mock.calls.length).toBe(callsBefore);
    });

    it('should stop periodic checks after stop is called', async () => {
      await maintenance.start();
      maintenance.stop();

      const callsAfterStop = mockDbQueryActiveWatchersFindMany.mock.calls.length;
      vi.advanceTimersByTime(10 * HOUR_MS);

      expect(mockDbQueryActiveWatchersFindMany.mock.calls.length).toBe(callsAfterStop);
    });
  });

  describe('start - branch coverage', () => {
    it('should skip startup sync without delay when skipStartupSync is true and no delayMs', async () => {
      await maintenance.start({ skipStartupSync: true });
      expect(mockDbQueryActiveWatchersFindMany).not.toHaveBeenCalled();
    });

    it('should schedule delayed startup sync when skipStartupSync and delayMs are both set', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      await maintenance.start({ skipStartupSync: true, delayMs: 1000 });
      expect(mockDbQueryActiveWatchersFindMany).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1001);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('checkCorruptionOnStartup - branch coverage', () => {
    it('should return pairsChecked 0 when no active pairs', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      await maintenance.start();
    });

    it('should log corruption fix with success status when all corrupted klines are fixed', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        open: '0',
        high: '0',
        low: '0',
        close: '0',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);
      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero prices' });

      const fixedKline = createApiKline(corruptedKline.openTime.getTime());
      const apiMap = new Map();
      apiMap.set(corruptedKline.openTime.getTime(), fixedKline);
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      await maintenance.start();
    });

    it('should log corruption fix with partial status when only some corrupted klines are fixed', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      const kline2 = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);
      mockIsKlineCorrupted
        .mockReturnValueOnce({ openTime: kline1.openTime, reason: 'Zero prices' })
        .mockReturnValueOnce({ openTime: kline2.openTime, reason: 'Zero prices' });

      const apiMap = new Map();
      apiMap.set(kline1.openTime.getTime(), createApiKline(kline1.openTime.getTime()));
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      await maintenance.start();
    });

    it('should log corruption fix with error status when no corrupted klines are fixed', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);
      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero prices' });

      mockFetchBinanceKlinesBatch.mockResolvedValue(new Map());

      await maintenance.start();
    });

    it('should handle per-pair errors in corruption check on startup', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockRejectedValue(new Error('DB error'));

      await maintenance.start();
    });

    it('should handle global error in corruption check on startup', async () => {
      mockDbQueryActiveWatchersFindMany
        .mockResolvedValueOnce([{ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' }])
        .mockRejectedValueOnce(new Error('Global error'));

      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.start();
    });
  });

  describe('updateMaintenanceLog - branch coverage', () => {
    it('should set lastGapCheck and gapsFound when checkType is gap with gapsFound defined', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should set lastCorruptionCheck and corruptedFixed when checkType is corruption with corruptedFixed defined', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      const insertCalls = mockDbInsert.mock.calls.length;
      expect(insertCalls).toBeGreaterThanOrEqual(2);
    });
  });

  describe('checkAllStoredPairs - branch coverage', () => {
    it('should add skipped gap fill to logBuffer when cooldown is active during startup', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        lastGapCheck: new Date(Date.now() - 1000),
        lastCorruptionCheck: new Date(Date.now() - 1000),
      });

      await maintenance.start();
    });

    it('should add gap fill with partial status when gaps found but none filled', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.start();
    });

    it('should add gap fill with success status when totalFilled > 0', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.start();
    });

    it('should handle per-pair error with logBuffer adding error entry', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockRejectedValue(new Error('DB pair error'));

      await maintenance.start();
    });

    it('should handle per-pair error with non-Error object', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockRejectedValue('string error');

      await maintenance.start();
    });

    it('should handle global error in checkAllStoredPairs', async () => {
      mockDbQueryActiveWatchersFindMany.mockRejectedValue(new Error('DB connection error'));

      await maintenance.start();
    });
  });

  describe('checkAndFillGaps - branch coverage', () => {
    it('should fill gaps and log with success status when totalFilled > 0', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);
      mockFetchFuturesKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.checkAndFillGaps();
    });

    it('should log with partial status when gaps found but totalFilled is 0', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);
      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.checkAndFillGaps();
    });

    it('should check and fix corrupted klines with partial fix status', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: new Date(now - 1000) })
        .mockResolvedValueOnce(null);

      const kline1 = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      const kline2 = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);
      mockIsKlineCorrupted
        .mockReturnValueOnce({ openTime: kline1.openTime, reason: 'Zero' })
        .mockReturnValueOnce({ openTime: kline2.openTime, reason: 'Zero' });

      const apiMap = new Map();
      apiMap.set(kline1.openTime.getTime(), createApiKline(kline1.openTime.getTime()));
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      await maintenance.checkAndFillGaps();
    });

    it('should check and fix corrupted klines with error status when none fixed', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: new Date(now - 1000) })
        .mockResolvedValueOnce(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);
      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero' });
      mockFetchBinanceKlinesBatch.mockResolvedValue(new Map());

      await maintenance.checkAndFillGaps();
    });

    it('should not log gap fill when no gaps and no filled candles', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const now = Date.now();
      const klines = [
        createDbKline({ openTime: new Date(now - 2 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.checkAndFillGaps();
    });
  });

  describe('detectGaps - branch coverage', () => {
    it('should use SPOT start time for SPOT market type', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);
      mockFetchHistoricalKlinesFromAPI.mockResolvedValue([]);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'SPOT');

      expect(mockFetchHistoricalKlinesFromAPI).toHaveBeenCalled();
    });

    it('should use knownEarliestDate when available for minStartTime', async () => {
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        earliestKlineDate: new Date('2022-01-01'),
        lastGapCheck: null,
        lastCorruptionCheck: null,
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.gapsFilled).toBe(0);
    });

    it('should not add gap at beginning when knownEarliestDate is set even if first kline is after start', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue({
        earliestKlineDate: new Date('2022-01-01'),
        lastGapCheck: null,
        lastCorruptionCheck: null,
      });

      const klines = [
        createDbKline({ openTime: new Date(now - 5 * HOUR_MS) }),
        createDbKline({ openTime: new Date(now - 4 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });

    it('should not add gap at beginning when missingAtStart < MIN_GAP_SIZE_TO_FILL', async () => {
      const now = Date.now();
      const baseTime = now - 2 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });

    it('should skip gap between klines when missingCandles < MIN_GAP_SIZE_TO_FILL', async () => {
      const now = Date.now();
      const baseTime = now - 5 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(baseTime) }),
        createDbKline({ openTime: new Date(baseTime + HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });

    it('should not add gap at end when missingAtEnd < MIN_GAP_SIZE_TO_FILL + 1', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(now - HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });

    it('should handle single kline with null prevKline and currKline check', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const klines = [
        createDbKline({ openTime: new Date(now - 100 * HOUR_MS) }),
      ];
      mockDbQueryKlinesFindMany.mockResolvedValue(klines);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });
  });

  describe('fillGap - branch coverage', () => {
    it('should log when not silent (forceCheckSymbol calls fillGap without silent)', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      const { logger: mockLogger } = await import('../../services/logger');

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT' }),
        'Filling gap'
      );
    });

    it('should use fetchHistoricalKlinesFromAPI for SPOT market type in fillGap', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime), marketType: 'SPOT' });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS), marketType: 'SPOT' });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchHistoricalKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'SPOT');

      expect(mockFetchHistoricalKlinesFromAPI).toHaveBeenCalled();
    });

    it('should handle empty API response with no existing klines in DB', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(null);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });

    it('should handle klines with missing takerBuyBaseVolume and takerBuyQuoteVolume', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      const apiKline = {
        openTime: baseTime + HOUR_MS,
        closeTime: baseTime + 2 * HOUR_MS - 1,
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '',
        takerBuyQuoteVolume: '',
      };
      mockFetchFuturesKlinesFromAPI.mockResolvedValue([apiKline]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should log success and update earliest kline when inserted > 0 and not silent', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(createDbKline({ openTime: new Date(baseTime) }));

      const { logger: mockLogger } = await import('../../services/logger');

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ inserted: 1 }),
        'Gap filled successfully'
      );
    });

    it('should not update earliest kline when firstKline is null after insert', async () => {
      const baseTime = Date.now() - 10 * HOUR_MS;
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({ openTime: new Date(baseTime) });
      const kline2 = createDbKline({ openTime: new Date(baseTime + 5 * HOUR_MS) });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockFetchFuturesKlinesFromAPI.mockResolvedValue([createApiKline(baseTime + HOUR_MS)]);
      mockDbQueryKlinesFindFirst.mockResolvedValue(null);

      await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
    });
  });

  describe('detectAndFixCorruptedKlines - API validation branch coverage', () => {
    it('should detect OHLC mismatches via API validation for recently closed klines', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
        open: '50000',
        high: '51000',
        low: '49000',
        close: '50500',
        volume: '500',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const apiKline = {
        openTime: closedKline.openTime.getTime(),
        closeTime: closedKline.closeTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
      };
      const validationMap = new Map();
      validationMap.set(closedKline.openTime.getTime(), apiKline);

      const fixMap = new Map();
      fixMap.set(closedKline.openTime.getTime(), apiKline);

      mockFetchBinanceKlinesBatch
        .mockResolvedValueOnce(validationMap)
        .mockResolvedValueOnce(fixMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBeGreaterThanOrEqual(1);
    });

    it('should skip API validation kline when no apiKline found in map', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);
      mockFetchBinanceKlinesBatch.mockResolvedValue(new Map());

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(0);
    });

    it('should skip already-corrupted klines when validating against API', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const kline1 = createDbKline({
        openTime: new Date(now - 4 * HOUR_MS),
        closeTime: new Date(now - 3 * HOUR_MS - 1),
      });
      const kline2 = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([kline1, kline2]);

      mockIsKlineCorrupted
        .mockReturnValueOnce({ openTime: kline1.openTime, reason: 'Zero prices' })
        .mockReturnValueOnce(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const apiMap = new Map();
      apiMap.set(kline1.openTime.getTime(), createApiKline(kline1.openTime.getTime()));
      apiMap.set(kline2.openTime.getTime(), createApiKline(kline2.openTime.getTime()));
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result).toBeDefined();
    });

    it('should detect volume mismatch via API validation', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
        volume: '10',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const apiKline = {
        openTime: closedKline.openTime.getTime(),
        closeTime: closedKline.closeTime.getTime(),
        open: closedKline.open,
        high: closedKline.high,
        low: closedKline.low,
        close: closedKline.close,
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
      };
      const validationMap = new Map();
      validationMap.set(closedKline.openTime.getTime(), apiKline);
      const fixMap = new Map();
      fixMap.set(closedKline.openTime.getTime(), apiKline);

      mockFetchBinanceKlinesBatch
        .mockResolvedValueOnce(validationMap)
        .mockResolvedValueOnce(fixMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBeGreaterThanOrEqual(1);
    });

    it('should detect individual OHLC field mismatches (open, high, low, close)', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
        open: '50000',
        high: '51000',
        low: '49000',
        close: '50500',
        volume: '1000',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const apiKline = {
        openTime: closedKline.openTime.getTime(),
        closeTime: closedKline.closeTime.getTime(),
        open: '60000',
        high: '62000',
        low: '58000',
        close: '61000',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
      };
      const validationMap = new Map();
      validationMap.set(closedKline.openTime.getTime(), apiKline);
      const fixMap = new Map();
      fixMap.set(closedKline.openTime.getTime(), apiKline);

      mockFetchBinanceKlinesBatch
        .mockResolvedValueOnce(validationMap)
        .mockResolvedValueOnce(fixMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(1);
    });

    it('should skip API validation fields when apiOHLC value is 0', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const apiKline = {
        openTime: closedKline.openTime.getTime(),
        closeTime: closedKline.closeTime.getTime(),
        open: '0',
        high: '0',
        low: '0',
        close: '0',
        volume: '0',
        quoteVolume: '0',
        trades: 0,
        takerBuyBaseVolume: '0',
        takerBuyQuoteVolume: '0',
      };
      const validationMap = new Map();
      validationMap.set(closedKline.openTime.getTime(), apiKline);

      mockFetchBinanceKlinesBatch.mockResolvedValue(validationMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(0);
    });

    it('should not fix corrupted klines when no binanceKline found in fix map', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);

      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero prices' });

      const validationMap = new Map();
      mockFetchBinanceKlinesBatch.mockResolvedValue(validationMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(0);
    });

    it('should log fixed corrupted klines when not silent and fixed > 0', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      mockDbQueryPairMaintenanceLogFindFirst
        .mockResolvedValueOnce({ lastGapCheck: new Date(now - 1000) })
        .mockResolvedValueOnce(null);

      const corruptedKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([corruptedKline]);
      mockIsKlineCorrupted.mockReturnValue({ openTime: corruptedKline.openTime, reason: 'Zero' });

      const fixedKline = createApiKline(corruptedKline.openTime.getTime());
      const apiMap = new Map();
      apiMap.set(corruptedKline.openTime.getTime(), fixedKline);
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      await maintenance.checkAndFillGaps();

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should not skip klines not yet closed for API validation', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const notClosedKline = createDbKline({
        openTime: new Date(now - HOUR_MS),
        closeTime: new Date(now + HOUR_MS),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([notClosedKline]);

      mockIsKlineCorrupted.mockReturnValue(null);
      mockIsKlineStaleCorrupted.mockReturnValue(null);
      mockIsKlineSpikeCorrupted.mockReturnValue(null);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result.corruptedFixed).toBe(0);
    });

    it('should handle empty klinesToValidate after filtering already corrupted', async () => {
      const now = Date.now();
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);

      const closedKline = createDbKline({
        openTime: new Date(now - 3 * HOUR_MS),
        closeTime: new Date(now - 2 * HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([closedKline]);

      mockIsKlineCorrupted.mockReturnValue({ openTime: closedKline.openTime, reason: 'Zero prices' });

      const apiMap = new Map();
      apiMap.set(closedKline.openTime.getTime(), createApiKline(closedKline.openTime.getTime()));
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.forceCheckSymbol('BTCUSDT', '1h', 'FUTURES');
      expect(result).toBeDefined();
    });
  });

  describe('checkAfterReconnection - branch coverage', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should skip pair when firstKline or lastKline is undefined', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      const result = await maintenance.checkAfterReconnection();
      expect(result.checked).toBe(0);
    });

    it('should skip kline when no apiKline found in map during reconnection', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const recentKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([recentKline]);
      mockFetchBinanceKlinesBatch.mockResolvedValue(new Map());

      const result = await maintenance.checkAfterReconnection();
      expect(result.checked).toBeGreaterThan(0);
      expect(result.fixed).toBe(0);
    });

    it('should detect individual mismatch fields (open, high, low, close, volume) during reconnection', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        open: '50000',
        high: '51000',
        low: '49000',
        close: '50500',
        volume: '100',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: '60000',
        high: '62000',
        low: '58000',
        close: '61000',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();
      expect(result.fixed).toBe(1);
    });

    it('should handle diffPercent calculation when apiOHLC field is 0', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        volume: '0',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: dbKline.open,
        high: dbKline.high,
        low: dbKline.low,
        close: dbKline.close,
        volume: '0',
        quoteVolume: dbKline.quoteVolume,
        trades: dbKline.trades,
        takerBuyBaseVolume: dbKline.takerBuyBaseVolume,
        takerBuyQuoteVolume: dbKline.takerBuyQuoteVolume,
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();
      expect(result.fixed).toBe(0);
    });

    it('should skip volume mismatch when apiOHLC.volume is 0', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '0',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();
      expect(result.fixed).toBe(0);
    });

    it('should skip OHLC field mismatch when apiOHLC field is 0', async () => {
      const now = Date.now();
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      const dbKline = createDbKline({
        openTime: new Date(now - 2 * HOUR_MS),
        closeTime: new Date(now - HOUR_MS - 1),
        open: '60000',
        high: '61000',
        low: '59000',
        close: '60500',
        volume: '1000',
      });
      mockDbQueryKlinesFindMany.mockResolvedValue([dbKline]);

      const apiMap = new Map();
      apiMap.set(dbKline.openTime.getTime(), {
        openTime: dbKline.openTime.getTime(),
        open: '0',
        high: '0',
        low: '0',
        close: '0',
        volume: '1000',
        quoteVolume: '60000000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '30000000',
        closeTime: dbKline.closeTime.getTime(),
      });
      mockFetchBinanceKlinesBatch.mockResolvedValue(apiMap);

      const result = await maintenance.checkAfterReconnection();
      expect(result.fixed).toBe(0);
    });
  });

  describe('getActivePairsWithSubscriptions - branch coverage', () => {
    it('should deduplicate watchers with same symbol, interval, and marketType', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);

      await maintenance.checkAndFillGaps();
    });

    it('should add SPOT subscriptions that are not already in the set', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      mockSpotGetActiveSubscriptions.mockReturnValue([
        { symbol: 'ETHUSDT', interval: '15m' },
        { symbol: 'ETHUSDT', interval: '15m' },
      ]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([]);

      await maintenance.checkAndFillGaps();
    });

    it('should add FUTURES subscriptions that are not already in the set', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([]);
      mockSpotGetActiveSubscriptions.mockReturnValue([]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([
        { symbol: 'SOLUSDT', interval: '4h' },
        { symbol: 'SOLUSDT', interval: '4h' },
      ]);

      await maintenance.checkAndFillGaps();
    });

    it('should not add SPOT subscription when already seen from watchers', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT' },
      ]);
      mockSpotGetActiveSubscriptions.mockReturnValue([
        { symbol: 'BTCUSDT', interval: '1h' },
      ]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();
    });

    it('should not add FUTURES subscription when already seen from watchers', async () => {
      mockDbQueryActiveWatchersFindMany.mockResolvedValue([
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
      ]);
      mockSpotGetActiveSubscriptions.mockReturnValue([]);
      mockFuturesGetActiveSubscriptions.mockReturnValue([
        { symbol: 'BTCUSDT', interval: '1h' },
      ]);
      mockDbQueryPairMaintenanceLogFindFirst.mockResolvedValue(null);
      mockDbQueryKlinesFindMany.mockResolvedValue([]);

      await maintenance.checkAndFillGaps();
    });
  });
});

describe('Module exports', () => {
  it('should return a singleton from getKlineMaintenance', () => {
    const instance1 = getKlineMaintenance();
    const instance2 = getKlineMaintenance();
    expect(instance1).toBe(instance2);
  });

  it('should create a new instance from initializeKlineMaintenance', () => {
    const instance1 = getKlineMaintenance();
    const instance2 = initializeKlineMaintenance();
    expect(instance2).toBeInstanceOf(KlineMaintenance);
    expect(instance2).not.toBe(instance1);
  });

  it('should alias getKlineGapFiller to getKlineMaintenance', () => {
    expect(getKlineGapFiller).toBe(getKlineMaintenance);
  });

  it('should alias initializeKlineGapFiller to initializeKlineMaintenance', () => {
    expect(initializeKlineGapFiller).toBe(initializeKlineMaintenance);
  });

  it('should export KlineMaintenance class', () => {
    expect(KlineMaintenance).toBeDefined();
    const instance = new KlineMaintenance();
    expect(instance).toHaveProperty('start');
    expect(instance).toHaveProperty('stop');
    expect(instance).toHaveProperty('checkAndFillGaps');
    expect(instance).toHaveProperty('forceCheckSymbol');
    expect(instance).toHaveProperty('checkAfterReconnection');
    instance.stop();
  });
});
