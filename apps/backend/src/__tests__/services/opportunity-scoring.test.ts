import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetTopCoinsByMarketCap,
  mockGet24hrTickerData,
  mockScanSymbols,
  mockValidateSymbols,
} = vi.hoisted(() => ({
  mockGetTopCoinsByMarketCap: vi.fn(),
  mockGet24hrTickerData: vi.fn(),
  mockScanSymbols: vi.fn(),
  mockValidateSymbols: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../../db/schema', () => ({
  setupDetections: {
    symbol: 'symbol',
    detectedAt: 'detectedAt',
  },
  strategyPerformance: {
    symbol: 'symbol',
    winRate: 'winRate',
    avgWin: 'avgWin',
    avgLoss: 'avgLoss',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count'),
  gte: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
}));

vi.mock('../../services/market-cap-data', () => ({
  getMarketCapDataService: vi.fn(() => ({
    getTopCoinsByMarketCap: mockGetTopCoinsByMarketCap,
  })),
}));

vi.mock('../../services/binance-exchange-info', () => ({
  get24hrTickerData: mockGet24hrTickerData,
}));

vi.mock('../../services/setup-pre-scanner', () => ({
  getSetupPreScanner: vi.fn(() => ({
    scanSymbols: mockScanSymbols,
  })),
}));

vi.mock('../../services/filter-pre-validator', () => ({
  getFilterPreValidator: vi.fn(() => ({
    validateSymbols: mockValidateSymbols,
  })),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
  },
}));

import { db } from '../../db';
import type { TopCoin } from '../../services/market-cap-data';
import {
  OpportunityScoringService,
  getOpportunityScoringService,
  type ScoringWeights,
} from '../../services/opportunity-scoring';

const createTopCoin = (overrides: Partial<TopCoin> = {}): TopCoin => ({
  binanceSymbol: 'BTCUSDT',
  coingeckoId: 'bitcoin',
  name: 'Bitcoin',
  marketCapRank: 1,
  marketCap: 1_000_000_000_000,
  volume24h: 50_000_000_000,
  priceChange24h: 500,
  priceChangePercent24h: 1.5,
  currentPrice: 50000,
  ...overrides,
});

const createTickerData = (symbol: string, overrides = {}) => ({
  symbol,
  priceChange: 500,
  priceChangePercent: 1.5,
  weightedAvgPrice: 50000,
  lastPrice: 50500,
  volume: 1000,
  quoteVolume: 50_000_000,
  openPrice: 50000,
  highPrice: 51000,
  lowPrice: 49000,
  count: 100000,
  ...overrides,
});

const mockDbChainTwoCalls = (firstResults: unknown[], secondResults: unknown[]) => {
  let callCount = 0;

  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    const results = callCount === 1 ? firstResults : secondResults;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const base = Promise.resolve(results);
          (base as unknown as Record<string, unknown>).groupBy = vi.fn().mockResolvedValue(results);
          return base;
        }),
      }),
    };
  });
};

describe('OpportunityScoringService', () => {
  let service: OpportunityScoringService;

  beforeEach(() => {
    service = new OpportunityScoringService();
    vi.clearAllMocks();
  });

  describe('DEFAULT_WEIGHTS', () => {
    it('should have weights that sum to approximately 1.0', () => {
      const weights: ScoringWeights = {
        marketCapRank: 0.10,
        volume: 0.15,
        volatility: 0.10,
        priceChange: 0.05,
        setupFrequency: 0.15,
        winRate: 0.10,
        profitFactor: 0.10,
        pendingSetup: 0.15,
        filterPassRate: 0.10,
      };

      const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('setWeights', () => {
    it('should merge partial weights with defaults', async () => {
      service.setWeights({ volume: 0.50 });

      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);

      expect(scores).toHaveLength(1);
      expect(scores[0]!.compositeScore).toBeGreaterThan(0);
    });
  });

  describe('setCacheTTL', () => {
    it('should update cache TTL without error', () => {
      service.setCacheTTL(5000);
      expect(service).toBeDefined();
    });
  });

  describe('calculateMarketCapScore', () => {
    const setupForMarketCapTest = (rank: number) => {
      const coins = [createTopCoin({ marketCapRank: rank, binanceSymbol: `COIN${rank}USDT` })];
      const tickerMap = new Map([[`COIN${rank}USDT`, createTickerData(`COIN${rank}USDT`)]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);
    };

    it('should score 100 for rank <= 10', async () => {
      setupForMarketCapTest(5);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(100);
    });

    it('should score 90 for rank 11-25', async () => {
      setupForMarketCapTest(20);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(90);
    });

    it('should score 80 for rank 26-50', async () => {
      setupForMarketCapTest(40);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(80);
    });

    it('should score 70 for rank 51-75', async () => {
      setupForMarketCapTest(60);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(70);
    });

    it('should score max(50, 100 - rank * 0.5) for rank > 75', async () => {
      setupForMarketCapTest(80);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(100 - 80 * 0.5);
    });

    it('should floor at 50 for very high ranks', async () => {
      setupForMarketCapTest(200);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.marketCapScore).toBe(50);
    });
  });

  describe('calculatePriceChangeScore', () => {
    const setupForPriceChangeTest = (priceChangePercent: number) => {
      const coins = [createTopCoin({ priceChangePercent24h: priceChangePercent })];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);
    };

    it('should score 30 for price change < 0.5%', async () => {
      setupForPriceChangeTest(0.2);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(30);
    });

    it('should score between 70-100 for price change 0.5-3%', async () => {
      setupForPriceChangeTest(2.0);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(70 + 2.0 * 10);
    });

    it('should score 100 for price change 3-8%', async () => {
      setupForPriceChangeTest(5.0);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(100);
    });

    it('should score 90 for price change 8-15%', async () => {
      setupForPriceChangeTest(10.0);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(90);
    });

    it('should score 70 for price change > 15%', async () => {
      setupForPriceChangeTest(20.0);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(70);
    });

    it('should use absolute value for negative price changes', async () => {
      setupForPriceChangeTest(-5.0);
      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.priceChangeScore).toBe(100);
    });
  });

  describe('normalizeScore / volumeScore', () => {
    it('should normalize volume relative to max', async () => {
      const coins = [
        createTopCoin({ binanceSymbol: 'BTCUSDT', volume24h: 100_000 }),
        createTopCoin({ binanceSymbol: 'ETHUSDT', volume24h: 50_000, marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', createTickerData('BTCUSDT')],
        ['ETHUSDT', createTickerData('ETHUSDT')],
      ]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);

      const btcScore = scores.find((s) => s.symbol === 'BTCUSDT');
      const ethScore = scores.find((s) => s.symbol === 'ETHUSDT');

      expect(btcScore!.breakdown.volumeScore).toBe(100);
      expect(ethScore!.breakdown.volumeScore).toBe(50);
    });
  });

  describe('calculateVolatilityScore', () => {
    it('should score high for volatility in the optimal range', async () => {
      const coins = [
        createTopCoin({ binanceSymbol: 'BTCUSDT', currentPrice: 50000 }),
        createTopCoin({ binanceSymbol: 'ETHUSDT', currentPrice: 3000, marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', createTickerData('BTCUSDT', { highPrice: 55000, lowPrice: 45000, weightedAvgPrice: 50000 })],
        ['ETHUSDT', createTickerData('ETHUSDT', { highPrice: 3060, lowPrice: 2940, weightedAvgPrice: 3000 })],
      ]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      const ethScore = scores.find((s) => s.symbol === 'ETHUSDT');
      expect(ethScore!.breakdown.volatilityScore).toBeGreaterThanOrEqual(50);
    });

    it('should handle missing ticker data with volatility 0', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map<string, never>();

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.volatilityScore).toBeDefined();
    });
  });

  describe('setupFrequencyScore', () => {
    it('should cap setup frequency score at 100', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [{ symbol: 'BTCUSDT', count: 15 }],
        []
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.setupFrequencyScore).toBe(100);
    });

    it('should multiply setup count by 10', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [{ symbol: 'BTCUSDT', count: 3 }],
        []
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.setupFrequencyScore).toBe(30);
    });
  });

  describe('winRate and profitFactor scoring', () => {
    it('should use actual win rate from performance data', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [],
        [{ symbol: 'BTCUSDT', winRate: '65', avgWin: '3.0', avgLoss: '1.5' }]
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.winRateScore).toBe(65);
      expect(scores[0]!.rawData.winRate).toBe(65);
    });

    it('should default to 50 when no performance data exists', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.winRateScore).toBe(50);
      expect(scores[0]!.breakdown.profitFactorScore).toBe(50);
      expect(scores[0]!.rawData.winRate).toBeNull();
      expect(scores[0]!.rawData.profitFactor).toBeNull();
    });

    it('should cap profit factor score at 100', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [],
        [{ symbol: 'BTCUSDT', winRate: '70', avgWin: '10.0', avgLoss: '1.0' }]
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.profitFactorScore).toBeLessThanOrEqual(100);
    });

    it('should handle avgLoss of 0 with profitFactor of 1', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [],
        [{ symbol: 'BTCUSDT', winRate: '55', avgWin: '5.0', avgLoss: '0' }]
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.rawData.profitFactor).toBe(1);
    });
  });

  describe('getSymbolScores', () => {
    it('should return empty array when no coins from market cap service', async () => {
      mockGetTopCoinsByMarketCap.mockResolvedValue([]);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores).toEqual([]);
    });

    it('should sort scores by compositeScore descending', async () => {
      const coins = [
        createTopCoin({ binanceSymbol: 'LOWUSDT', marketCapRank: 100, volume24h: 1000 }),
        createTopCoin({ binanceSymbol: 'HIGHUSDT', marketCapRank: 1, volume24h: 100_000_000 }),
      ];
      const tickerMap = new Map([
        ['LOWUSDT', createTickerData('LOWUSDT', { highPrice: 100, lowPrice: 99, weightedAvgPrice: 99.5 })],
        ['HIGHUSDT', createTickerData('HIGHUSDT', { highPrice: 55000, lowPrice: 45000, weightedAvgPrice: 50000 })],
      ]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);

      expect(scores[0]!.compositeScore).toBeGreaterThanOrEqual(scores[1]!.compositeScore);
    });

    it('should respect limit parameter via market cap service', async () => {
      const allCoins = Array.from({ length: 5 }, (_, i) =>
        createTopCoin({ binanceSymbol: `COIN${i}USDT`, marketCapRank: i + 1 })
      );

      mockGetTopCoinsByMarketCap.mockImplementation((limit: number) => {
        return Promise.resolve(allCoins.slice(0, limit));
      });

      const tickerMap = new Map(
        allCoins.map((c) => [c.binanceSymbol, createTickerData(c.binanceSymbol)])
      );
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 3);
      expect(scores).toHaveLength(3);
      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledWith(3, 'FUTURES');
    });

    it('should populate rawData correctly', async () => {
      const coins = [createTopCoin({ marketCap: 999, volume24h: 888, priceChangePercent24h: 2.5 })];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [{ symbol: 'BTCUSDT', count: 4 }],
        []
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.rawData.marketCap).toBe(999);
      expect(scores[0]!.rawData.volume24h).toBe(888);
      expect(scores[0]!.rawData.priceChange24h).toBe(2.5);
      expect(scores[0]!.rawData.setupCount7d).toBe(4);
    });
  });

  describe('caching', () => {
    it('should return cached results on second call', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const firstResult = await service.getSymbolScores('FUTURES', 100);
      const secondResult = await service.getSymbolScores('FUTURES', 100);

      expect(firstResult).toEqual(secondResult);
      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledTimes(1);
    });

    it('should apply limit to cached results', async () => {
      const coins = Array.from({ length: 5 }, (_, i) =>
        createTopCoin({ binanceSymbol: `COIN${i}USDT`, marketCapRank: i + 1 })
      );
      const tickerMap = new Map(
        coins.map((c) => [c.binanceSymbol, createTickerData(c.binanceSymbol)])
      );

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      await service.getSymbolScores('FUTURES', 100);
      const limitedResult = await service.getSymbolScores('FUTURES', 2);

      expect(limitedResult).toHaveLength(2);
    });
  });

  describe('clearCache', () => {
    it('should clear specific market type cache', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      await service.getSymbolScores('FUTURES', 100);
      service.clearCache('FUTURES');

      mockDbChainTwoCalls([], []);
      await service.getSymbolScores('FUTURES', 100);

      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledTimes(2);
    });

    it('should clear all caches when no market type provided', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      await service.getSymbolScores('FUTURES', 100);
      service.clearCache();

      mockDbChainTwoCalls([], []);
      await service.getSymbolScores('FUTURES', 100);

      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTopSymbolsByScore', () => {
    it('should return only symbol strings', async () => {
      const coins = [
        createTopCoin({ binanceSymbol: 'BTCUSDT', marketCapRank: 1 }),
        createTopCoin({ binanceSymbol: 'ETHUSDT', marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', createTickerData('BTCUSDT')],
        ['ETHUSDT', createTickerData('ETHUSDT')],
      ]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const symbols = await service.getTopSymbolsByScore('FUTURES', 20);

      expect(symbols).toEqual(expect.arrayContaining(['BTCUSDT', 'ETHUSDT']));
      symbols.forEach((s) => expect(typeof s).toBe('string'));
    });
  });

  describe('getEnhancedSymbolScores', () => {
    const setupBaseScores = () => {
      const coins = [
        createTopCoin({ binanceSymbol: 'BTCUSDT', marketCapRank: 1 }),
        createTopCoin({ binanceSymbol: 'ETHUSDT', marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', createTickerData('BTCUSDT')],
        ['ETHUSDT', createTickerData('ETHUSDT')],
      ]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);
    };

    it('should return base scores when no enhanced options enabled', async () => {
      setupBaseScores();

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {});

      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0]!.breakdown.pendingSetupScore).toBeUndefined();
      expect(scores[0]!.breakdown.filterPassRateScore).toBeUndefined();
    });

    it('should include setup scanning results when enabled', async () => {
      setupBaseScores();

      const scanResults = new Map([
        ['BTCUSDT', { hasPendingSetup: true, score: 85, pendingSetups: [], alignedWithBTC: true, btcTrend: 'BULLISH' }],
        ['ETHUSDT', { hasPendingSetup: false, score: 40, pendingSetups: [], alignedWithBTC: false, btcTrend: 'NEUTRAL' }],
      ]);
      mockScanSymbols.mockResolvedValue(scanResults);

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {
        includeSetupScanning: true,
        interval: '4h',
      });

      const btcScore = scores.find((s) => s.symbol === 'BTCUSDT');
      expect(btcScore!.breakdown.pendingSetupScore).toBe(85);
      expect(btcScore!.rawData.hasPendingSetup).toBe(true);

      const ethScore = scores.find((s) => s.symbol === 'ETHUSDT');
      expect(ethScore!.breakdown.pendingSetupScore).toBe(50);
      expect(ethScore!.rawData.hasPendingSetup).toBe(false);
    });

    it('should include filter validation results when enabled', async () => {
      setupBaseScores();

      const validationResults = new Map([
        ['BTCUSDT', { confluenceScore: 90, wouldPassFilters: true, passedFilters: [], failingFilters: [], filterResults: {} }],
        ['ETHUSDT', { confluenceScore: 60, wouldPassFilters: true, passedFilters: [], failingFilters: [], filterResults: {} }],
      ]);
      mockValidateSymbols.mockResolvedValue(validationResults);

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {
        includeFilterValidation: true,
      });

      const btcScore = scores.find((s) => s.symbol === 'BTCUSDT');
      expect(btcScore!.breakdown.filterPassRateScore).toBe(90);
      expect(btcScore!.rawData.filterPassRate).toBe(90);
    });

    it('should handle setup scanning failure gracefully', async () => {
      setupBaseScores();
      mockScanSymbols.mockRejectedValue(new Error('scan failed'));

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {
        includeSetupScanning: true,
      });

      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0]!.breakdown.pendingSetupScore).toBe(50);
    });

    it('should handle filter validation failure gracefully', async () => {
      setupBaseScores();
      mockValidateSymbols.mockRejectedValue(new Error('validation failed'));

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {
        includeFilterValidation: true,
      });

      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0]!.breakdown.filterPassRateScore).toBe(50);
    });

    it('should sort enhanced scores by compositeScore descending', async () => {
      setupBaseScores();

      const scanResults = new Map([
        ['BTCUSDT', { hasPendingSetup: false, score: 10, pendingSetups: [], alignedWithBTC: false, btcTrend: 'NEUTRAL' }],
        ['ETHUSDT', { hasPendingSetup: true, score: 100, pendingSetups: [], alignedWithBTC: true, btcTrend: 'BULLISH' }],
      ]);
      mockScanSymbols.mockResolvedValue(scanResults);

      const scores = await service.getEnhancedSymbolScores('FUTURES', 100, {
        includeSetupScanning: true,
      });

      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]!.compositeScore).toBeGreaterThanOrEqual(scores[i + 1]!.compositeScore);
      }
    });

    it('should respect limit on enhanced scores', async () => {
      const coins = Array.from({ length: 10 }, (_, i) =>
        createTopCoin({ binanceSymbol: `COIN${i}USDT`, marketCapRank: i + 1 })
      );
      const tickerMap = new Map(
        coins.map((c) => [c.binanceSymbol, createTickerData(c.binanceSymbol)])
      );

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getEnhancedSymbolScores('FUTURES', 3, {});
      expect(scores).toHaveLength(3);
    });

    it('should use cached enhanced scores on repeated calls', async () => {
      setupBaseScores();

      await service.getEnhancedSymbolScores('FUTURES', 100, { interval: '12h' });

      const secondResult = await service.getEnhancedSymbolScores('FUTURES', 100, { interval: '12h' });
      expect(secondResult.length).toBeGreaterThan(0);
      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledTimes(1);
    });

    it('should default to 12h interval', async () => {
      setupBaseScores();
      mockScanSymbols.mockResolvedValue(new Map());

      await service.getEnhancedSymbolScores('FUTURES', 100, { includeSetupScanning: true });

      expect(mockScanSymbols).toHaveBeenCalledWith(
        expect.arrayContaining(['BTCUSDT', 'ETHUSDT']),
        expect.objectContaining({ interval: '12h' })
      );
    });
  });

  describe('getPerformanceData error handling', () => {
    it('should return empty map on db error and default to 50 scores', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);

      let callCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('db error')),
          }),
        };
      });

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.breakdown.winRateScore).toBe(50);
      expect(scores[0]!.breakdown.profitFactorScore).toBe(50);
    });
  });

  describe('getSetupCounts error handling', () => {
    it('should return empty map on db error and default to 0 setup count', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);

      let callCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockRejectedValue(new Error('db error')),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.rawData.setupCount7d).toBe(0);
      expect(scores[0]!.breakdown.setupFrequencyScore).toBe(0);
    });
  });

  describe('compositeScore calculation', () => {
    it('should compute weighted sum of all component scores', async () => {
      service.setWeights({
        marketCapRank: 1,
        volume: 0,
        volatility: 0,
        priceChange: 0,
        setupFrequency: 0,
        winRate: 0,
        profitFactor: 0,
      });

      const coins = [createTopCoin({ marketCapRank: 1 })];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.compositeScore).toBe(100);
    });
  });

  describe('getOpportunityScoringService singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const instance1 = getOpportunityScoringService();
      const instance2 = getOpportunityScoringService();
      expect(instance1).toBe(instance2);
    });

    it('should return an OpportunityScoringService instance', () => {
      const instance = getOpportunityScoringService();
      expect(instance).toBeInstanceOf(OpportunityScoringService);
    });
  });

  describe('SPOT market type', () => {
    it('should pass SPOT market type to market cap service', async () => {
      mockGetTopCoinsByMarketCap.mockResolvedValue([]);

      await service.getSymbolScores('SPOT', 50);

      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledWith(50, 'SPOT');
    });
  });

  describe('edge cases', () => {
    it('should handle single coin', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores).toHaveLength(1);
      expect(scores[0]!.symbol).toBe('BTCUSDT');
    });

    it('should handle zero volume for all coins', async () => {
      const coins = [createTopCoin({ volume24h: 0 })];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls([], []);

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores).toHaveLength(1);
      expect(scores[0]!.breakdown.volumeScore).toBeDefined();
    });

    it('should default market type to FUTURES', async () => {
      mockGetTopCoinsByMarketCap.mockResolvedValue([]);

      await service.getSymbolScores();

      expect(mockGetTopCoinsByMarketCap).toHaveBeenCalledWith(100, 'FUTURES');
    });

    it('should aggregate multiple performance entries for same symbol', async () => {
      const coins = [createTopCoin()];
      const tickerMap = new Map([['BTCUSDT', createTickerData('BTCUSDT')]]);

      mockGetTopCoinsByMarketCap.mockResolvedValue(coins);
      mockGet24hrTickerData.mockResolvedValue(tickerMap);
      mockDbChainTwoCalls(
        [],
        [
          { symbol: 'BTCUSDT', winRate: '60', avgWin: '2.0', avgLoss: '1.0' },
          { symbol: 'BTCUSDT', winRate: '80', avgWin: '4.0', avgLoss: '2.0' },
        ]
      );

      const scores = await service.getSymbolScores('FUTURES', 100);
      expect(scores[0]!.rawData.winRate).toBe(70);
      expect(scores[0]!.rawData.profitFactor).toBe(2);
    });
  });
});
