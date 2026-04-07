import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import * as schema from '../../db/schema';
import type { Interval } from '@marketmind/types';

vi.mock('../../services/pine/PineStrategyLoader', () => {
  const mockStrategiesInternal = [
    {
      metadata: {
        id: 'test-strategy-1',
        name: 'Test Strategy 1',
        version: '1.0.0',
        description: 'A test strategy',
        author: 'Test Author',
        tags: ['test', 'strategy'],
        status: 'active',
        enabled: true,
        parameters: {},
        filters: {},
        recommendedTimeframes: { primary: '1h', secondary: ['4h'] },
      },
      source: '',
      filePath: 'test',
    },
    {
      metadata: {
        id: 'test-strategy-2',
        name: 'Test Strategy 2',
        version: '1.0.0',
        description: 'Another test strategy',
        author: 'Test Author',
        tags: ['test'],
        status: 'experimental',
        enabled: true,
        parameters: {},
        filters: {},
        recommendedTimeframes: { primary: '15m' },
      },
      source: '',
      filePath: 'test',
    },
  ];

  return {
    PineStrategyLoader: class {
      loadAll() {
        return Promise.resolve([...mockStrategiesInternal]);
      }

      loadAllCached() {
        return this.loadAll();
      }

      loadFromString(source: string) {
        return {
          metadata: { id: 'inline', name: 'Inline Strategy', version: '1.0.0', description: '', author: '', tags: [], status: 'active', enabled: true, parameters: {}, filters: {} },
          source,
          filePath: 'inline',
        };
      }
    },
  };
});

vi.mock('../../services/indicator-engine', () => ({
  detectSetups: vi.fn().mockResolvedValue([
    {
      setup: {
        type: 'test-strategy-1',
        direction: 'LONG',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        confidence: 75,
        riskRewardRatio: 2,
      },
      confidence: 75,
      strategyId: 'test-strategy-1',
    },
  ]),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

describe('Setup Detection Router', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete(schema.klines);
    await cleanupTables();
  });

  const createTestKline = async (options: {
    symbol?: string;
    interval?: Interval;
    openTime?: Date;
  } = {}) => {
    const baseTime = options.openTime || new Date(Date.now() - 60000);

    const [kline] = await db.insert(schema.klines).values({
      symbol: options.symbol || 'BTCUSDT',
      interval: options.interval || '1h',
      marketType: 'SPOT',
      openTime: baseTime,
      closeTime: new Date(baseTime.getTime() + 3600000),
      open: '50000',
      high: '51000',
      low: '49000',
      close: '50500',
      volume: '100',
      quoteVolume: '5000000',
      trades: 1000,
      takerBuyBaseVolume: '50',
      takerBuyQuoteVolume: '2500000',
    }).returning();

    return kline;
  };

  describe('listStrategies', () => {
    it('should list all strategies (public endpoint)', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.listStrategies();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('version');
      expect(result[0]).toHaveProperty('status');
    });

    it('should filter by includeStatuses', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.listStrategies({
        includeStatuses: ['active'],
      });

      expect(result.every(s => s.status === 'active')).toBe(true);
    });

    it('should filter by excludeStatuses', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.listStrategies({
        excludeStatuses: ['experimental'],
      });

      expect(result.every(s => s.status !== 'experimental')).toBe(true);
    });

    it('should include recommended timeframes', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.listStrategies();

      expect(result[0]).toHaveProperty('recommendedTimeframes');
      expect(result[0]!.recommendedTimeframes).toBeDefined();
    });
  });

  describe('getStrategyDetails', () => {
    it('should return strategy details (public endpoint)', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.getStrategyDetails({
        strategyId: 'test-strategy-1',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('filters');
    });

    it('should throw error for non-existent strategy', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.setupDetection.getStrategyDetails({
          strategyId: 'non-existent-strategy',
        })
      ).rejects.toThrow('Strategy not found');
    });
  });

  describe('detectSetups', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.setupDetection.detectSetups({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should return empty array when no klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.setupDetection.detectSetups({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
      });

      expect(result.setups).toEqual([]);
      expect(result.strategiesUsed).toBe(0);
    });

    it('should detect setups when klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(Date.now() - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetups({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
      });

      expect(result).toHaveProperty('setups');
      expect(result).toHaveProperty('detectedAt');
      expect(result).toHaveProperty('strategiesUsed');
    });

    it('should filter by enabled strategies', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(Date.now() - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetups({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        enabledStrategies: ['test-strategy-1'],
      });

      expect(result.strategiesUsed).toBeLessThanOrEqual(1);
    });

    it('should filter by minConfidence', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(Date.now() - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetups({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        minConfidence: 80,
      });

      expect(result.setups.every(s => s.confidence >= 80)).toBe(true);
    });

    it('should filter by minRiskReward', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(Date.now() - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetups({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        minRiskReward: 1.5,
      });

      expect(result).toHaveProperty('setups');
    });
  });

  describe('detectSetupsInRange', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.setupDetection.detectSetupsInRange({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          startTime: Date.now() - 86400000,
          endTime: Date.now(),
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should return empty array when no klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.setupDetection.detectSetupsInRange({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
      });

      expect(result.setups).toEqual([]);
    });

    it('should detect setups in time range', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(now - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetupsInRange({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        startTime: now - 5 * 3600000,
        endTime: now,
      });

      expect(result).toHaveProperty('setups');
    });

    it('should filter by enabled strategies', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        await createTestKline({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: new Date(now - (i * 3600000)),
        });
      }

      const result = await caller.setupDetection.detectSetupsInRange({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        startTime: now - 5 * 3600000,
        endTime: now,
        enabledStrategies: ['test-strategy-1'],
      });

      expect(result).toHaveProperty('setups');
    });
  });

  describe('validateStrategy', () => {
    it('should validate valid Pine strategy source (public endpoint)', async () => {
      const caller = createUnauthenticatedCaller();

      const validSource = '// @id custom-strategy\n// @name Custom Strategy\n//@version=5\nindicator("Custom Strategy", overlay=true)\nplot(0, "signal")\n';

      const result = await caller.setupDetection.validateStrategy({
        strategySource: validSource,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid Pine strategy source', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.validateStrategy({
        strategySource: 'not valid pine source',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Input validation', () => {
    it('should reject invalid minConfidence', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.setupDetection.detectSetups({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          minConfidence: 150,
        })
      ).rejects.toThrow();
    });

    it('should reject negative minRiskReward', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.setupDetection.detectSetups({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          minRiskReward: -1,
        })
      ).rejects.toThrow();
    });
  });
});
