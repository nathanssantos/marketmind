import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupDetections } from '../../db/schema';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

const createTestSetupDetection = async (options: {
  userId: string;
  symbol?: string;
  interval?: string;
  setupType?: string;
  direction?: 'LONG' | 'SHORT';
  confidence?: number;
  riskReward?: string;
  detectedAt?: Date;
}) => {
  const db = getTestDatabase();
  const {
    userId,
    symbol = 'BTCUSDT',
    interval = '1h',
    setupType = 'setup91',
    direction = 'LONG',
    confidence = 75,
    riskReward = '2.5',
    detectedAt = new Date(),
  } = options;

  const [detection] = await db
    .insert(setupDetections)
    .values({
      id: randomUUID(),
      userId,
      symbol,
      interval,
      setupType,
      direction,
      entryPrice: '50000',
      stopLoss: '49000',
      takeProfit: '53000',
      confidence,
      riskReward,
      metadata: '{}',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      detectedAt,
    })
    .returning();

  return detection!;
};

describe('Setup Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('detectCurrent', () => {
    it('should return empty array when no klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.setup.detectCurrent({
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      expect(result.setups).toEqual([]);
      expect(result.detectedAt).toBeDefined();
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.setup.detectCurrent({
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('detectRange', () => {
    it('should return empty array when no klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      const result = await caller.setup.detectRange({
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime,
        endTime,
      });

      expect(result.setups).toEqual([]);
      expect(result.processedKlines).toBe(0);
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.setup.detectRange({
          symbol: 'BTCUSDT',
          interval: '1h',
          startTime: new Date(),
          endTime: new Date(),
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getConfig', () => {
    it('should return default config', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const config = await caller.setup.getConfig();

      expect(config).toBeDefined();
      expect(typeof config.enableTrendFilter).toBe('boolean');
      expect(typeof config.minConfidence).toBe('number');
      expect(typeof config.minRiskReward).toBe('number');
    });
  });

  describe('updateConfig', () => {
    it('should update config and return success', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.setup.updateConfig({
        minConfidence: 70,
        minRiskReward: 2.0,
        trendFilterEnabled: true,
      });

      expect(result.success).toBe(true);
      expect(result.config.minConfidence).toBe(70);
      expect(result.config.minRiskReward).toBe(2.0);
      expect(result.config.trendFilterEnabled).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return setup detection history', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'BTCUSDT',
        setupType: 'setup91',
      });

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'ETHUSDT',
        setupType: 'setup92',
      });

      const result = await caller.setup.getHistory({});

      expect(result.setups.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by symbol', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'BTCUSDT',
      });

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'ETHUSDT',
      });

      const result = await caller.setup.getHistory({
        symbol: 'BTCUSDT',
      });

      expect(result.setups.length).toBe(1);
      expect(result.setups[0]!.symbol).toBe('BTCUSDT');
    });

    it('should filter by setup type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        setupType: 'setup91',
      });

      await createTestSetupDetection({
        userId: user.id,
        setupType: 'setup92',
      });

      const result = await caller.setup.getHistory({
        setupType: 'setup91',
      });

      expect(result.setups.length).toBe(1);
      expect(result.setups[0]!.type).toBe('setup91');
    });

    it('should filter by direction', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        direction: 'LONG',
      });

      await createTestSetupDetection({
        userId: user.id,
        direction: 'SHORT',
      });

      const result = await caller.setup.getHistory({
        direction: 'LONG',
      });

      expect(result.setups.length).toBe(1);
      expect(result.setups[0]!.direction).toBe('LONG');
    });

    it('should not return detections from other users', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      await createTestSetupDetection({
        userId: user1.id,
        symbol: 'BTCUSDT',
      });

      const caller2 = createAuthenticatedCaller(user2, session2);
      const result = await caller2.setup.getHistory({});

      expect(result.setups.length).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestSetupDetection({
          userId: user.id,
        });
      }

      const result = await caller.setup.getHistory({
        limit: 5,
      });

      expect(result.setups.length).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return stats for detected setups', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        setupType: 'setup91',
        direction: 'LONG',
        confidence: 80,
        riskReward: '2.5',
      });

      await createTestSetupDetection({
        userId: user.id,
        setupType: 'setup91',
        direction: 'SHORT',
        confidence: 70,
        riskReward: '3.0',
      });

      await createTestSetupDetection({
        userId: user.id,
        setupType: 'setup92',
        direction: 'LONG',
        confidence: 75,
        riskReward: '2.0',
      });

      const result = await caller.setup.getStats({});

      expect(result.totalSetups).toBe(3);
      expect(result.byType['setup91']).toBe(2);
      expect(result.byType['setup92']).toBe(1);
      expect(result.byDirection.LONG).toBe(2);
      expect(result.byDirection.SHORT).toBe(1);
      expect(result.avgConfidence).toBe(75);
      expect(result.avgRiskReward).toBeCloseTo(2.5, 1);
    });

    it('should return zeros when no setups exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.setup.getStats({});

      expect(result.totalSetups).toBe(0);
      expect(result.byDirection.LONG).toBe(0);
      expect(result.byDirection.SHORT).toBe(0);
      expect(result.avgConfidence).toBe(0);
      expect(result.avgRiskReward).toBe(0);
    });

    it('should filter by symbol', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'BTCUSDT',
      });

      await createTestSetupDetection({
        userId: user.id,
        symbol: 'ETHUSDT',
      });

      const result = await caller.setup.getStats({
        symbol: 'BTCUSDT',
      });

      expect(result.totalSetups).toBe(1);
    });

    it('should not include detections from other users', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      await createTestSetupDetection({
        userId: user1.id,
      });

      const caller2 = createAuthenticatedCaller(user2, session2);
      const result = await caller2.setup.getStats({});

      expect(result.totalSetups).toBe(0);
    });
  });
});
