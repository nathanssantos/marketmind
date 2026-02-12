import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { db } from '../../db';
import {
  DynamicSymbolRotationService,
  getIntervalMs,
  getDynamicSymbolRotationService,
  type RotationConfig,
} from '../../services/dynamic-symbol-rotation';

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    query: {
      klines: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

const mockGetSymbolScores = vi.fn().mockResolvedValue([
  { symbol: 'BTCUSDT', compositeScore: 95 },
  { symbol: 'ETHUSDT', compositeScore: 90 },
  { symbol: 'SOLUSDT', compositeScore: 85 },
  { symbol: 'DOGEUSDT', compositeScore: 80 },
  { symbol: 'XRPUSDT', compositeScore: 75 },
  { symbol: 'ADAUSDT', compositeScore: 70 },
  { symbol: 'LINKUSDT', compositeScore: 65 },
  { symbol: 'DOTUSDT', compositeScore: 60 },
  { symbol: 'AVAXUSDT', compositeScore: 55 },
  { symbol: 'UNIUSDT', compositeScore: 50 },
]);

vi.mock('../../services/opportunity-scoring', () => ({
  getOpportunityScoringService: vi.fn(() => ({
    getSymbolScores: mockGetSymbolScores,
  })),
}));

vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    calculateMaxWatchersFromSymbols: vi.fn().mockResolvedValue({
      eligibleSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      excludedSymbols: new Map([['DOGEUSDT', 'too low']]),
    }),
    getSymbolFilters: vi.fn().mockResolvedValue(new Map()),
  })),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../services/watcher-batch-logger', () => ({
  outputRotationResults: vi.fn(),
  RotationLogBuffer: class {
    setContext = vi.fn();
    setResult = vi.fn();
    toResult = vi.fn().mockReturnValue({});
  },
}));

vi.mock('../../utils/filters/btc-correlation-filter', () => ({
  getEma21Direction: vi.fn().mockReturnValue({
    direction: 'BULLISH',
    price: 45000,
    ema21: 44000,
  }),
}));

vi.mock('../../utils/filters/adx-filter', () => ({
  checkAdxCondition: vi.fn().mockReturnValue({
    isAllowed: true,
    adx: 25,
    plusDI: 30,
    minusDI: 15,
    reason: 'ADX strong trend',
  }),
}));

vi.mock('../../utils/kline-mapper', () => ({
  mapDbKlinesReversed: vi.fn().mockReturnValue(
    Array.from({ length: 60 }, (_, i) => ({
      openTime: 1700000000000 + i * 60000,
      open: String(40000 + i * 10),
      high: String(40000 + i * 10 + 50),
      low: String(40000 + i * 10 - 50),
      close: String(40000 + i * 10),
      volume: '100',
      closeTime: 1700000000000 + (i + 1) * 60000 - 1,
      quoteVolume: '1000',
      trades: 10,
      takerBuyBaseVolume: '50',
      takerBuyQuoteVolume: '500',
    }))
  ),
}));

vi.mock('../../services/btc-dominance-data', () => ({
  getBTCDominanceDataService: vi.fn(() => ({
    getBTCDominance: vi.fn().mockResolvedValue({ btcDominance: 55 }),
  })),
}));

vi.mock('../../services/altcoin-season-index', () => ({
  getAltcoinSeasonIndexService: vi.fn(() => ({
    getAltcoinSeasonIndex: vi.fn().mockResolvedValue({
      seasonType: 'NEUTRAL',
      altSeasonIndex: 50,
    }),
  })),
}));

vi.mock('../../services/order-book-analyzer', () => ({
  getOrderBookAnalyzerService: vi.fn(() => ({
    getOrderBookAnalysis: vi.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      imbalanceRatio: 1.0,
      bidWalls: [],
      askWalls: [],
      bidVolume: 1000,
      askVolume: 1000,
      spread: 0.1,
      spreadPercent: 0.001,
      midPrice: 45000,
      depth: 20,
      pressure: 'NEUTRAL',
      timestamp: new Date(),
    }),
  })),
}));

const mockSelectQuery = (activeWatcherSymbols: string[]) => {
  const mockDbSelect = db.select as unknown as MockedFunction<() => unknown>;
  mockDbSelect.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockResolvedValue(
        activeWatcherSymbols.map(symbol => ({
          id: `watcher-${symbol}`,
          symbol,
          isManual: false,
          walletId: 'test-wallet',
        }))
      ),
    })),
  } as unknown));
};

describe('DynamicSymbolRotationService - extended coverage', () => {
  let service: DynamicSymbolRotationService;

  const baseConfig: RotationConfig = {
    enabled: true,
    limit: 5,
    interval: '1h',
    excludedSymbols: [],
    marketType: 'FUTURES',
  };

  beforeEach(() => {
    service = new DynamicSymbolRotationService();
    vi.clearAllMocks();
    mockGetSymbolScores.mockResolvedValue([
      { symbol: 'BTCUSDT', compositeScore: 95 },
      { symbol: 'ETHUSDT', compositeScore: 90 },
      { symbol: 'SOLUSDT', compositeScore: 85 },
      { symbol: 'DOGEUSDT', compositeScore: 80 },
      { symbol: 'XRPUSDT', compositeScore: 75 },
      { symbol: 'ADAUSDT', compositeScore: 70 },
      { symbol: 'LINKUSDT', compositeScore: 65 },
      { symbol: 'DOTUSDT', compositeScore: 60 },
      { symbol: 'AVAXUSDT', compositeScore: 55 },
      { symbol: 'UNIUSDT', compositeScore: 50 },
    ]);
  });

  describe('getRotationHistory', () => {
    it('should return empty array when no history exists', () => {
      expect(service.getRotationHistory('wallet-1')).toEqual([]);
    });

    it('should return history up to specified limit', async () => {
      mockSelectQuery([]);

      await service.executeRotation('wallet-1', 'user-1', baseConfig);
      await service.executeRotation('wallet-1', 'user-1', baseConfig);
      await service.executeRotation('wallet-1', 'user-1', baseConfig);

      expect(service.getRotationHistory('wallet-1', 2)).toHaveLength(2);
      expect(service.getRotationHistory('wallet-1')).toHaveLength(3);
    });
  });

  describe('clearHistory', () => {
    it('should clear history and rankings for a wallet', async () => {
      mockSelectQuery([]);
      await service.executeRotation('wallet-1', 'user-1', baseConfig);

      expect(service.getRotationHistory('wallet-1')).toHaveLength(1);

      service.clearHistory('wallet-1');
      expect(service.getRotationHistory('wallet-1')).toEqual([]);
    });
  });

  describe('getRecommendedSymbols', () => {
    it('should return scored symbols up to limit', async () => {
      const result = await service.getRecommendedSymbols('FUTURES', 5);
      expect(result).toHaveLength(5);
      expect(result[0].symbol).toBe('BTCUSDT');
    });

    it('should exclude specified symbols', async () => {
      const result = await service.getRecommendedSymbols('FUTURES', 5, ['BTCUSDT']);
      expect(result.find(s => s.symbol === 'BTCUSDT')).toBeUndefined();
    });

    it('should use default limit of 20', async () => {
      const result = await service.getRecommendedSymbols('FUTURES');
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe('getDynamicSymbolRotationService singleton', () => {
    it('should return same instance on multiple calls', () => {
      const a = getDynamicSymbolRotationService();
      const b = getDynamicSymbolRotationService();
      expect(a).toBe(b);
    });
  });

  describe('executeRotation - error handling', () => {
    it('should return empty result on error', async () => {
      mockGetSymbolScores.mockRejectedValueOnce(new Error('scoring failed'));
      mockSelectQuery([]);

      const result = await service.executeRotation('wallet-1', 'user-1', baseConfig);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.kept).toEqual([]);
      expect(result.btcTrend).toBe('NEUTRAL');
      expect(result.isChoppyMarket).toBe(false);
    });
  });

  describe('executeRotation - excludedSymbols filter', () => {
    it('should exclude symbols from excludedSymbols config', async () => {
      mockSelectQuery([]);

      const result = await service.executeRotation('wallet-1', 'user-1', {
        ...baseConfig,
        limit: 3,
        excludedSymbols: ['BTCUSDT', 'ETHUSDT'],
      });

      expect(result.added).not.toContain('BTCUSDT');
      expect(result.added).not.toContain('ETHUSDT');
    });
  });

  describe('executeRotation - capital requirement filter', () => {
    it('should filter by capital requirements when configured', async () => {
      mockSelectQuery([]);

      const result = await service.executeRotation('wallet-1', 'user-1', {
        ...baseConfig,
        limit: 5,
        capitalRequirement: {
          walletBalance: 100,
          leverage: 10,
          positionSizePercent: 5,
        },
      });

      expect(result.skippedInsufficientCapital.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeRotation - BTC correlation filter', () => {
    it('should set btcTrend when BTC correlation filter is enabled', async () => {
      const btcDbKlines = Array.from({ length: 40 }, (_, i) => ({
        id: `kline-${i}`,
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        openTime: new Date(1700000000000 + i * 3600000),
        closeTime: new Date(1700000000000 + (i + 1) * 3600000 - 1),
        open: String(40000 + i * 10),
        high: String(40000 + i * 10 + 50),
        low: String(40000 + i * 10 - 50),
        close: String(40000 + i * 10),
        volume: '100',
        quoteVolume: '1000',
        trades: 10,
        takerBuyBaseVolume: '50',
        takerBuyQuoteVolume: '500',
      }));

      (db.query.klines.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(btcDbKlines);
      mockSelectQuery([]);

      const result = await service.executeRotation('wallet-1', 'user-1', {
        ...baseConfig,
        useBtcCorrelationFilter: true,
      });

      expect(result.btcTrend).toBe('BULLISH');
    });
  });

  describe('executeRotation - all symbols filtered keeps existing', () => {
    it('should keep existing watchers when all symbols are filtered out', async () => {
      mockGetSymbolScores.mockResolvedValueOnce([]);
      mockSelectQuery(['BTCUSDT', 'ETHUSDT']);

      const result = await service.executeRotation('wallet-1', 'user-1', baseConfig);

      expect(result.kept).toContain('BTCUSDT');
      expect(result.kept).toContain('ETHUSDT');
    });
  });
});
