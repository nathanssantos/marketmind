import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../trpc/context';
import { appRouter } from '../trpc/router';

vi.mock('binance-api-node', () => ({
  default: vi.fn(() => ({
    candles: vi.fn(),
    ws: {
      candles: vi.fn(),
    },
  })),
}));

describe('Setup Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      db: {
        query: {
          klines: {
            findMany: async () => [],
          },
          setupDetections: {
            findMany: async () => [],
          },
        },
        insert: () => ({
          values: async () => [],
        }),
      } as unknown as Context['db'],
      sessionId: 'test-session',
      session: {
        id: '1',
        userId: '1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      user: {
        id: '1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        name: null,
        emailVerified: false,
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      req: {} as any,
      res: {} as any,
      websocket: null,
    };

    caller = appRouter.createCaller(mockContext);
  });

  describe('detectCurrent', () => {
    it('should return empty setups array initially', async () => {
      const result = await caller.setup.detectCurrent({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
      });

      expect(result.setups).toEqual([]);
      expect(result.detectedAt).toBeInstanceOf(Date);
    });

    it('should accept optional config', async () => {
      const result = await caller.setup.detectCurrent({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        config: {
          minConfidence: 80,
          minRiskReward: 3.0,
        },
      });

      expect(result.setups).toEqual([]);
    });
  });

  describe('detectRange', () => {
    it('should return empty setups for time range', async () => {
      const result = await caller.setup.detectRange({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-01-02'),
      });

      expect(result.setups).toEqual([]);
      expect(result.processedKlines).toBe(0);
      expect(result.detectedAt).toBeInstanceOf(Date);
    });
  });

  describe('getConfig', () => {
    it('should return default config', async () => {
      const result = await caller.setup.getConfig();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('updateConfig', () => {
    it('should accept config updates', async () => {
      const result = await caller.setup.updateConfig({
        minConfidence: 75,
        minRiskReward: 2.5,
      });

      expect(result.success).toBe(true);
      expect(result.config).toEqual({
        minConfidence: 75,
        minRiskReward: 2.5,
      });
    });

    it('should accept setup-specific config', async () => {
      const result = await caller.setup.updateConfig({
        setup91: {
          enabled: true,
          emaPeriod: 9,
          volumeMultiplier: 1.5,
          atrMultiplier: 2,
          stopLossATRMultiplier: 2,
          takeProfitATRMultiplier: 4,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return empty history initially', async () => {
      const result = await caller.setup.getHistory({});

      expect(result.setups).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept filter parameters', async () => {
      const result = await caller.setup.getHistory({
        symbol: 'BTCUSDT',
        setupType: 'setup91',
        direction: 'LONG',
        limit: 50,
      });

      expect(result.setups).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return default stats', async () => {
      const result = await caller.setup.getStats({});

      expect(result.totalSetups).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.byDirection).toEqual({ LONG: 0, SHORT: 0 });
      expect(result.avgConfidence).toBe(0);
      expect(result.avgRiskReward).toBe(0);
    });

    it('should accept filter parameters', async () => {
      const result = await caller.setup.getStats({
        symbol: 'BTCUSDT',
        setupType: 'setup91',
      });

      expect(result).toBeDefined();
    });
  });
});
