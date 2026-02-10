import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import * as schema from '../../db/schema';
import type { Interval } from '@marketmind/types';

vi.mock('../../services/setup-detection/dynamic', () => {
  const mockStrategiesInternal = [
    {
      id: 'test-strategy-1',
      name: 'Test Strategy 1',
      version: '1.0.0',
      description: 'A test strategy',
      author: 'Test Author',
      tags: ['test', 'strategy'],
      status: 'active',
      recommendedTimeframes: ['1h', '4h'],
      conditions: { entry: { long: [], short: [] }, exit: { long: [], short: [] } },
      risk: { stopLoss: { method: 'fixed', value: 2 }, takeProfit: { method: 'fixed', value: 4 } },
    },
    {
      id: 'test-strategy-2',
      name: 'Test Strategy 2',
      version: '1.0.0',
      description: 'Another test strategy',
      author: 'Test Author',
      tags: ['test'],
      status: 'experimental',
      recommendedTimeframes: ['15m'],
      conditions: { entry: { long: [], short: [] }, exit: { long: [], short: [] } },
      risk: { stopLoss: { method: 'fixed', value: 1.5 }, takeProfit: { method: 'fixed', value: 3 } },
    },
  ];

  return {
    StrategyLoader: class {
      loadAll({ includeUnprofitable: _includeUnprofitable = false, includeStatuses, excludeStatuses }: any = {}) {
        let filtered = [...mockStrategiesInternal];

        if (includeStatuses) {
          filtered = filtered.filter(s => includeStatuses.includes(s.status));
        }
        if (excludeStatuses) {
          filtered = filtered.filter(s => !excludeStatuses.includes(s.status));
        }

        return Promise.resolve(filtered);
      }

      loadFromString(json: string) {
        return JSON.parse(json);
      }

      validateStrategy(strategy: any) {
        return {
          valid: !!strategy.id && !!strategy.name,
          errors: strategy.id ? [] : [{ path: 'id', message: 'Missing id', severity: 'error' }],
          warnings: [],
        };
      }
    },
    StrategyInterpreter: class {
      detect() {
        return {
          setup: {
            id: 'setup-1',
            type: 'test-strategy-1',
            symbol: 'BTCUSDT',
            interval: '1h',
            direction: 'LONG',
            entryPrice: 50000,
            stopLoss: 49000,
            takeProfit: 52000,
            confidence: 75,
            detectedAt: Date.now(),
            riskReward: 2,
          },
          confidence: 75,
        };
      }
    },
  };
});

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
      expect(result[0]!.recommendedTimeframes).toBeInstanceOf(Array);
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
      expect(result).toHaveProperty('conditions');
      expect(result).toHaveProperty('risk');
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
    it('should validate valid strategy JSON (public endpoint)', async () => {
      const caller = createUnauthenticatedCaller();

      const validStrategy = JSON.stringify({
        id: 'custom-strategy',
        name: 'Custom Strategy',
        version: '1.0.0',
        conditions: { entry: { long: [], short: [] }, exit: { long: [], short: [] } },
        risk: { stopLoss: { method: 'fixed', value: 2 }, takeProfit: { method: 'fixed', value: 4 } },
      });

      const result = await caller.setupDetection.validateStrategy({
        strategyJson: validStrategy,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid strategy JSON', async () => {
      const caller = createUnauthenticatedCaller();

      const invalidStrategy = JSON.stringify({
        name: 'Missing ID Strategy',
      });

      const result = await caller.setupDetection.validateStrategy({
        strategyJson: invalidStrategy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON', async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.setupDetection.validateStrategy({
        strategyJson: 'not valid json',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.path).toBe('json');
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
