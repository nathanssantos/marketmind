import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

vi.mock('../../services/backtesting/BacktestEngine', () => ({
  BacktestEngine: class {
    run = vi.fn().mockResolvedValue({
      trades: [
        {
          id: 'trade-1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: 50000,
          exitPrice: 51000,
          quantity: 0.1,
          pnl: 100,
          pnlPercent: 2,
          entryTime: Date.now() - 3600000,
          exitTime: Date.now(),
          setupType: 'test-setup',
          exitReason: 'TAKE_PROFIT',
        },
      ],
      metrics: {
        totalTrades: 10,
        winningTrades: 7,
        losingTrades: 3,
        winRate: 70,
        totalPnl: 500,
        totalPnlPercent: 5,
        avgWin: 100,
        avgLoss: -50,
        avgRiskReward: 2,
        maxDrawdown: 100,
        maxDrawdownPercent: 1,
        profitFactor: 3.5,
        sharpeRatio: 1.5,
        maxConsecutiveLosses: 2,
        avgHoldTime: 3600000,
      },
      equityCurve: [
        { time: Date.now() - 86400000, equity: 10000 },
        { time: Date.now(), equity: 10500 },
      ],
    });
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Backtest Router', () => {
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
    await cleanupTables();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated access to run', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.backtest.run({
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: 10000,
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated access to list', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.backtest.list()).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated access to getResult', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.backtest.getResult({ id: 'test-id' })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated access to delete', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.backtest.delete({ id: 'test-id' })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('run', () => {
    it('should run backtest with minimal config', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'COMPLETED');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('trades');
    });

    it('should run backtest with full config', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.backtest.run({
        symbol: 'ETHUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        initialCapital: 50000,
        setupTypes: ['setup91', 'setup92'],
        minConfidence: 70,
        onlyWithTrend: true,
        useAlgorithmicLevels: true,
        stopLossPercent: 2,
        takeProfitPercent: 6,
        maxPositionSize: 15,
        commission: 0.001,
        marketType: 'FUTURES',
        useBnbDiscount: true,
        useStochasticFilter: true,
        useAdxFilter: false,
      }) as any;

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'COMPLETED');
      expect(result.config.symbol).toBe('ETHUSDT');
      expect(result.config.marketType).toBe('FUTURES');
    });

    it('should return metrics in result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      expect(result.metrics).toHaveProperty('totalTrades');
      expect(result.metrics).toHaveProperty('winRate');
      expect(result.metrics).toHaveProperty('totalPnl');
      expect(result.metrics).toHaveProperty('maxDrawdown');
      expect(result.metrics).toHaveProperty('profitFactor');
    });

    it('should include trades in result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      expect(result.trades).toBeInstanceOf(Array);
      expect(result.trades[0]).toHaveProperty('symbol');
      expect(result.trades[0]).toHaveProperty('side');
      expect(result.trades[0]).toHaveProperty('pnl');
    });

    it('should cache result for later retrieval', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const runResult = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      const getResult = await caller.backtest.getResult({ id: runResult.id });

      expect(getResult).toEqual(runResult);
    });
  });

  describe('getResult', () => {
    it('should return cached backtest result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const runResult = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      const result = await caller.backtest.getResult({ id: runResult.id }) as any;

      expect(result.id).toBe(runResult.id);
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw NOT_FOUND for non-existent result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.getResult({ id: 'non-existent-id' })
      ).rejects.toThrow('Backtest result not found');
    });
  });

  describe('list', () => {
    it('should return list of backtest results', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      });

      await caller.backtest.run({
        symbol: 'ETHUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 5000,
      });

      const results = await caller.backtest.list();

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('symbol');
      expect(results[0]).toHaveProperty('winRate');
    });

    it('should sort results by creation date descending', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await caller.backtest.run({
        symbol: 'ETHUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 5000,
      });

      const results = await caller.backtest.list();

      const times = results.map(r => new Date(r.createdAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      }
    });
  });

  describe('delete', () => {
    it('should delete backtest result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const runResult = await caller.backtest.run({
        symbol: 'BTCUSDT',
        interval: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
      }) as any;

      const deleteResult = await caller.backtest.delete({ id: runResult.id });
      expect(deleteResult.success).toBe(true);

      await expect(
        caller.backtest.getResult({ id: runResult.id })
      ).rejects.toThrow('Backtest result not found');
    });

    it('should throw NOT_FOUND for non-existent result', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.delete({ id: 'non-existent-id' })
      ).rejects.toThrow('Backtest result not found');
    });
  });

  describe('Input validation', () => {
    it('should reject negative initial capital', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.run({
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: -1000,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid minConfidence', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.run({
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: 10000,
          minConfidence: 150,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid market type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.run({
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: 10000,
          marketType: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });

    it('should reject maxPositionSize over 100', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.backtest.run({
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: 10000,
          maxPositionSize: 150,
        })
      ).rejects.toThrow();
    });
  });
});
