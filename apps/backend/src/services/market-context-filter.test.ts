import type { MarketContextConfig, MarketContextData, TradingSetup } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./btc-dominance-data', () => ({
  BTCDominanceDataService: class {
    getBTCDominanceResult = vi.fn().mockResolvedValue({ current: 50, change24h: 0.5 });
  },
}));

vi.mock('./binance-futures-data', () => ({
  BinanceFuturesDataService: class {
    getCurrentFundingRate = vi.fn().mockResolvedValue({ rate: 0.01, nextFundingTime: Date.now() });
    getCurrentOpenInterest = vi.fn().mockResolvedValue({ openInterest: 1000000, timestamp: Date.now() });
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { MarketContextFilter } = await import('./market-context-filter');

const createMockSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  id: 'test-setup-1',
  type: 'larry-williams-9-1',
  direction: 'LONG',
  openTime: Date.now(),
  entryPrice: 50000,
  stopLoss: 49000,
  takeProfit: 52000,
  riskRewardRatio: 2,
  confidence: 70,
  volumeConfirmation: true,
  indicatorConfluence: 3,
  klineIndex: 100,
  setupData: {},
  visible: true,
  source: 'algorithm',
  ...overrides,
});

const createMockConfig = (overrides: Partial<MarketContextConfig> = {}): MarketContextConfig => ({
  id: 'config-1',
  walletId: 'wallet-1',
  userId: 'user-1',
  enabled: true,
  shadowMode: false,
  fearGreed: {
    enabled: true,
    thresholdLow: 20,
    thresholdHigh: 80,
    action: 'reduce_size',
    sizeReduction: 50,
  },
  fundingRate: {
    enabled: true,
    threshold: 0.05,
    action: 'penalize',
    penalty: 20,
  },
  btcDominance: {
    enabled: false,
    changeThreshold: 1.0,
    action: 'reduce_size',
    sizeReduction: 25,
  },
  openInterest: {
    enabled: false,
    changeThreshold: 10,
    action: 'warn_only',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MarketContextFilter', () => {
  let filter: InstanceType<typeof MarketContextFilter>;

  beforeEach(() => {
    filter = new MarketContextFilter();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ value: '50' }] }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchMarketData', () => {
    it('should fetch all market data sources', async () => {
      const data = await filter.fetchMarketData('BTCUSDT');

      expect(data).toHaveProperty('fearGreedIndex');
      expect(data).toHaveProperty('btcDominance');
      expect(data).toHaveProperty('fundingRate');
      expect(data).toHaveProperty('timestamp');
      expect(data.fearGreedIndex).toBe(50);
    });

    it('should return default fear greed when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const data = await filter.fetchMarketData('BTCUSDT');

      expect(data.fearGreedIndex).toBe(50);
    });
  });

  describe('evaluateFilters', () => {
    it('should pass when all conditions are normal', () => {
      const setup = createMockSetup();
      const config = createMockConfig();
      const marketData: MarketContextData = {
        fearGreedIndex: 50,
        btcDominance: 45,
        fundingRate: 0.01,
        timestamp: new Date(),
      };

      const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

      expect(result.shouldTrade).toBe(true);
      expect(result.positionSizeMultiplier).toBe(1.0);
      expect(result.confidenceAdjustment).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    describe('Fear & Greed Filter', () => {
      it('should reduce size on extreme fear', () => {
        const setup = createMockSetup();
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 15,
          btcDominance: 45,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.positionSizeMultiplier).toBe(0.5);
        expect(result.warnings).toContain('Extreme fear (15)');
        expect(result.appliedFilters).toContainEqual(
          expect.objectContaining({ filter: 'fear_greed_extreme_fear' })
        );
      });

      it('should reduce size on extreme greed for LONG', () => {
        const setup = createMockSetup({ direction: 'LONG' });
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 85,
          btcDominance: 45,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.positionSizeMultiplier).toBe(0.5);
        expect(result.warnings).toContain('Extreme greed on LONG (85)');
      });

      it('should not reduce size on extreme greed for SHORT', () => {
        const setup = createMockSetup({ direction: 'SHORT' });
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 85,
          btcDominance: 45,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.positionSizeMultiplier).toBe(1.0);
        expect(result.warnings).not.toContain(expect.stringContaining('Extreme greed'));
      });

      it('should block trade when action is block', () => {
        const setup = createMockSetup();
        const config = createMockConfig({
          fearGreed: {
            enabled: true,
            thresholdLow: 20,
            thresholdHigh: 80,
            action: 'block',
            sizeReduction: 50,
          },
        });
        const marketData: MarketContextData = {
          fearGreedIndex: 15,
          btcDominance: 45,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.shouldTrade).toBe(false);
        expect(result.reason).toBe('Extreme fear (15)');
      });
    });

    describe('Funding Rate Filter', () => {
      it('should penalize LONG on high positive funding', () => {
        const setup = createMockSetup({ direction: 'LONG' });
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 45,
          fundingRate: 0.08,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.confidenceAdjustment).toBe(-20);
        expect(result.warnings).toContain('High funding rate on LONG (0.0800%)');
      });

      it('should penalize SHORT on negative funding', () => {
        const setup = createMockSetup({ direction: 'SHORT' });
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 45,
          fundingRate: -0.08,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.confidenceAdjustment).toBe(-20);
        expect(result.warnings).toContain('Low funding rate on SHORT (-0.0800%)');
      });

      it('should not penalize when funding is within threshold', () => {
        const setup = createMockSetup({ direction: 'LONG' });
        const config = createMockConfig();
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 45,
          fundingRate: 0.03,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.confidenceAdjustment).toBe(0);
      });
    });

    describe('BTC Dominance Filter', () => {
      it('should reduce size on rising BTC dominance for altcoins', () => {
        const setup = createMockSetup();
        const config = createMockConfig({
          btcDominance: {
            enabled: true,
            changeThreshold: 1.0,
            action: 'reduce_size',
            sizeReduction: 25,
          },
        });
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 55,
          btcDominanceChange24h: 1.5,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'ETHUSDT');

        expect(result.positionSizeMultiplier).toBe(0.75);
        expect(result.warnings).toContain('BTC dominance rising on altcoin (+1.50%)');
      });

      it('should not apply BTC dominance filter to BTCUSDT', () => {
        const setup = createMockSetup();
        const config = createMockConfig({
          btcDominance: {
            enabled: true,
            changeThreshold: 1.0,
            action: 'reduce_size',
            sizeReduction: 25,
          },
        });
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 55,
          btcDominanceChange24h: 1.5,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.positionSizeMultiplier).toBe(1.0);
      });
    });

    describe('Open Interest Filter', () => {
      it('should warn on OI spike', () => {
        const setup = createMockSetup();
        const config = createMockConfig({
          openInterest: {
            enabled: true,
            changeThreshold: 10,
            action: 'warn_only',
          },
        });
        const marketData: MarketContextData = {
          fearGreedIndex: 50,
          btcDominance: 45,
          fundingRate: 0.01,
          openInterest: 1000000,
          openInterestChange24h: 15,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'BTCUSDT');

        expect(result.shouldTrade).toBe(true);
        expect(result.warnings).toContain('Open interest spike (+15.00%)');
      });
    });

    describe('Multiple Filters', () => {
      it('should apply multiple size reductions cumulatively', () => {
        const setup = createMockSetup();
        const config = createMockConfig({
          btcDominance: {
            enabled: true,
            changeThreshold: 1.0,
            action: 'reduce_size',
            sizeReduction: 25,
          },
        });
        const marketData: MarketContextData = {
          fearGreedIndex: 15,
          btcDominance: 55,
          btcDominanceChange24h: 1.5,
          fundingRate: 0.01,
          timestamp: new Date(),
        };

        const result = (filter as any).evaluateFilters(setup, config, marketData, 'ETHUSDT');

        expect(result.positionSizeMultiplier).toBe(0.5 * 0.75);
        expect(result.warnings).toHaveLength(2);
      });
    });
  });

  describe('validateSetup', () => {
    it('should pass when filter is disabled', async () => {
      vi.spyOn(filter, 'getConfig').mockResolvedValueOnce(
        createMockConfig({ enabled: false })
      );

      const setup = createMockSetup();
      const result = await filter.validateSetup(setup, 'BTCUSDT', 'wallet-1');

      expect(result.shouldTrade).toBe(true);
      expect(result.positionSizeMultiplier).toBe(1.0);
    });

    it('should return pass result with shadow warning in shadow mode', async () => {
      vi.spyOn(filter, 'getConfig').mockResolvedValueOnce(
        createMockConfig({ 
          shadowMode: true,
          fearGreed: {
            enabled: true,
            thresholdLow: 20,
            thresholdHigh: 80,
            action: 'reduce_size',
            sizeReduction: 50,
          },
        })
      );
      vi.spyOn(filter, 'fetchMarketData').mockResolvedValueOnce({
        fearGreedIndex: 15,
        btcDominance: 45,
        fundingRate: 0.01,
        timestamp: new Date(),
      });

      const setup = createMockSetup();
      const result = await filter.validateSetup(setup, 'BTCUSDT', 'wallet-1');

      expect(result.shouldTrade).toBe(true);
      expect(result.positionSizeMultiplier).toBe(1.0);
      expect(result.warnings).toBeDefined();
      if (result.warnings.length > 0) {
        expect(result.warnings[0]).toContain('[SHADOW]');
      }
    });
  });

  describe('getFilterResult', () => {
    it('should return correct filter results', () => {
      expect((filter as any).getFilterResult('block')).toBe('block');
      expect((filter as any).getFilterResult('reduce_size')).toBe('adjust');
      expect((filter as any).getFilterResult('penalize')).toBe('adjust');
      expect((filter as any).getFilterResult('warn_only')).toBe('warn');
    });
  });

  describe('cache', () => {
    it('should cache config and return same instance', async () => {
      const result1 = await filter.getConfig('wallet-1');
      const result2 = await filter.getConfig('wallet-1');

      expect(result1.walletId).toBe(result2.walletId);
      expect(result1.enabled).toBe(result2.enabled);
    });

    it('should invalidate cache', () => {
      filter.invalidateCache('wallet-1');
      expect((filter as any).configCache.has('wallet-1')).toBe(false);
    });
  });
});
