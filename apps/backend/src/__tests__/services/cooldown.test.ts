import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CooldownService, type CooldownConfig, type MarketConditions } from '../../services/cooldown';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestUser, createTestWallet } from '../helpers/test-fixtures';
import { tradeCooldowns } from '../../db/schema';
import { and, eq } from 'drizzle-orm';

describe('CooldownService', () => {
  let cooldownService: CooldownService;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    cooldownService = new CooldownService();
  });

  describe('calculateAdaptiveCooldown', () => {
    const baseConfig: CooldownConfig = {
      baseMinutes: 60,
      volatilityMultiplier: 1.0,
      drawdownMultiplier: 1.0,
      lossStreakMultiplier: 1.0,
      maxMinutes: 1440,
      minMinutes: 5,
    };

    const normalConditions: MarketConditions = {
      volatilityLevel: 'normal',
      drawdownPercent: 0,
      consecutiveLosses: 0,
      consecutiveWins: 0,
    };

    it('should return base cooldown for normal conditions', () => {
      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, normalConditions);

      expect(result.minutes).toBe(60);
      expect(result.rationale).toContain('Base: 60m');
      expect(result.rationale).toContain('Vol: normal');
    });

    it('should reduce cooldown for low volatility', () => {
      const lowVolConditions: MarketConditions = {
        ...normalConditions,
        volatilityLevel: 'low',
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, lowVolConditions);

      expect(result.minutes).toBe(45);
      expect(result.rationale).toContain('Vol: low');
    });

    it('should increase cooldown for high volatility', () => {
      const highVolConditions: MarketConditions = {
        ...normalConditions,
        volatilityLevel: 'high',
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, highVolConditions);

      expect(result.minutes).toBe(90);
      expect(result.rationale).toContain('Vol: high');
    });

    it('should significantly increase cooldown for extreme volatility', () => {
      const extremeVolConditions: MarketConditions = {
        ...normalConditions,
        volatilityLevel: 'extreme',
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, extremeVolConditions);

      expect(result.minutes).toBe(150);
      expect(result.rationale).toContain('Vol: extreme');
    });

    it('should increase cooldown based on drawdown percent', () => {
      const drawdownConditions: MarketConditions = {
        ...normalConditions,
        drawdownPercent: 12,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, drawdownConditions);

      expect(result.minutes).toBe(90);
      expect(result.rationale).toContain('DD: 12.0%');
    });

    it('should significantly increase cooldown for severe drawdown', () => {
      const severeDrawdownConditions: MarketConditions = {
        ...normalConditions,
        drawdownPercent: 25,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, severeDrawdownConditions);

      expect(result.minutes).toBe(180);
      expect(result.rationale).toContain('DD: 25.0%');
    });

    it('should increase cooldown for loss streak', () => {
      const lossStreakConditions: MarketConditions = {
        ...normalConditions,
        consecutiveLosses: 3,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, lossStreakConditions);

      expect(result.minutes).toBe(90);
      expect(result.rationale).toContain('Losses: 3');
    });

    it('should significantly increase cooldown for severe loss streak', () => {
      const severeLossConditions: MarketConditions = {
        ...normalConditions,
        consecutiveLosses: 5,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, severeLossConditions);

      expect(result.minutes).toBe(180);
      expect(result.rationale).toContain('Losses: 5');
    });

    it('should cap loss streak multiplier at 5', () => {
      const extremeLossConditions: MarketConditions = {
        ...normalConditions,
        consecutiveLosses: 10,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, extremeLossConditions);

      expect(result.minutes).toBe(180);
    });

    it('should reduce cooldown for win streak of 3', () => {
      const winStreakConditions: MarketConditions = {
        ...normalConditions,
        consecutiveWins: 3,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, winStreakConditions);

      expect(result.minutes).toBe(54);
      expect(result.rationale).toContain('Wins: 3');
    });

    it('should combine multiple factors', () => {
      const combinedConditions: MarketConditions = {
        volatilityLevel: 'high',
        drawdownPercent: 15,
        consecutiveLosses: 2,
        consecutiveWins: 0,
      };

      const result = cooldownService.calculateAdaptiveCooldown(baseConfig, combinedConditions);

      expect(result.minutes).toBe(225);
      expect(result.rationale).toContain('Vol: high');
      expect(result.rationale).toContain('DD: 15.0%');
      expect(result.rationale).toContain('Losses: 2');
    });

    it('should respect maxMinutes limit', () => {
      const configWithLowMax: CooldownConfig = {
        ...baseConfig,
        maxMinutes: 100,
      };

      const extremeConditions: MarketConditions = {
        volatilityLevel: 'extreme',
        drawdownPercent: 30,
        consecutiveLosses: 5,
        consecutiveWins: 0,
      };

      const result = cooldownService.calculateAdaptiveCooldown(configWithLowMax, extremeConditions);

      expect(result.minutes).toBe(100);
      expect(result.rationale).toContain('Final: 100m');
    });

    it('should respect minMinutes limit', () => {
      const configWithHighMin: CooldownConfig = {
        ...baseConfig,
        baseMinutes: 1,
        minMinutes: 10,
      };

      const lowConditions: MarketConditions = {
        volatilityLevel: 'low',
        drawdownPercent: 0,
        consecutiveLosses: 0,
        consecutiveWins: 5,
      };

      const result = cooldownService.calculateAdaptiveCooldown(configWithHighMin, lowConditions);

      expect(result.minutes).toBe(10);
    });

    it('should use default values when config values are undefined', () => {
      const minimalConfig: CooldownConfig = {
        baseMinutes: 30,
      };

      const result = cooldownService.calculateAdaptiveCooldown(minimalConfig, normalConditions);

      expect(result.minutes).toBe(30);
    });
  });

  describe('setCooldown', () => {
    it('should create a new cooldown entry', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const cooldown = await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id,
        'exec-123',
        60,
        'Test cooldown'
      );

      expect(cooldown).toBeDefined();
      expect(cooldown.strategyId).toBe('strategy-1');
      expect(cooldown.symbol).toBe('BTCUSDT');
      expect(cooldown.interval).toBe('1h');
      expect(cooldown.walletId).toBe(wallet.id);
      expect(cooldown.lastExecutionId).toBe('exec-123');
      expect(cooldown.cooldownMinutes).toBe(60);
      expect(cooldown.reason).toBe('Test cooldown');
    });

    it('should update existing cooldown entry', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id,
        'exec-123',
        30,
        'Initial cooldown'
      );

      const updated = await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id,
        'exec-456',
        90,
        'Updated cooldown'
      );

      expect(updated.lastExecutionId).toBe('exec-456');
      expect(updated.cooldownMinutes).toBe(90);
      expect(updated.reason).toBe('Updated cooldown');

      const db = getTestDatabase();
      const all = await db
        .select()
        .from(tradeCooldowns)
        .where(
          and(
            eq(tradeCooldowns.strategyId, 'strategy-1'),
            eq(tradeCooldowns.symbol, 'BTCUSDT')
          )
        );
      expect(all.length).toBe(1);
    });

    it('should set cooldownUntil correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const before = Date.now();
      const cooldown = await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id,
        'exec-123',
        60
      );
      const after = Date.now();

      const expectedMin = before + 60 * 60 * 1000;
      const expectedMax = after + 60 * 60 * 1000;

      expect(cooldown.cooldownUntil.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(cooldown.cooldownUntil.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('checkCooldown', () => {
    it('should return not in cooldown when no cooldown exists', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const result = await cooldownService.checkCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id
      );

      expect(result.inCooldown).toBe(false);
      expect(result.cooldownUntil).toBeUndefined();
    });

    it('should return in cooldown when cooldown is active', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id,
        'exec-123',
        60,
        'Active cooldown'
      );

      const result = await cooldownService.checkCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id
      );

      expect(result.inCooldown).toBe(true);
      expect(result.cooldownUntil).toBeDefined();
      expect(result.reason).toBe('Active cooldown');
    });

    it('should return not in cooldown and delete expired cooldown', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const db = getTestDatabase();
      await db.insert(tradeCooldowns).values({
        strategyId: 'strategy-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        walletId: wallet.id,
        lastExecutionId: 'exec-123',
        lastExecutionAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        cooldownUntil: new Date(Date.now() - 60 * 60 * 1000),
        cooldownMinutes: 60,
      });

      const result = await cooldownService.checkCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet.id
      );

      expect(result.inCooldown).toBe(false);

      const remaining = await db
        .select()
        .from(tradeCooldowns)
        .where(eq(tradeCooldowns.strategyId, 'strategy-1'));
      expect(remaining.length).toBe(0);
    });

    it('should check correct symbol/interval/wallet combination', async () => {
      const { user } = await createTestUser();
      const wallet1 = await createTestWallet({ userId: user.id, name: 'Wallet 1' });
      const wallet2 = await createTestWallet({ userId: user.id, name: 'Wallet 2' });

      await cooldownService.setCooldown(
        'strategy-1',
        'BTCUSDT',
        '1h',
        wallet1.id,
        'exec-123',
        60
      );

      const result1 = await cooldownService.checkCooldown('strategy-1', 'BTCUSDT', '1h', wallet1.id);
      expect(result1.inCooldown).toBe(true);

      const result2 = await cooldownService.checkCooldown('strategy-1', 'BTCUSDT', '1h', wallet2.id);
      expect(result2.inCooldown).toBe(false);

      const result3 = await cooldownService.checkCooldown('strategy-1', 'ETHUSDT', '1h', wallet1.id);
      expect(result3.inCooldown).toBe(false);

      const result4 = await cooldownService.checkCooldown('strategy-1', 'BTCUSDT', '4h', wallet1.id);
      expect(result4.inCooldown).toBe(false);

      const result5 = await cooldownService.checkCooldown('strategy-2', 'BTCUSDT', '1h', wallet1.id);
      expect(result5.inCooldown).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired cooldowns', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(tradeCooldowns).values([
        {
          strategyId: 'expired-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          walletId: wallet.id,
          lastExecutionId: 'exec-1',
          lastExecutionAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          cooldownUntil: new Date(Date.now() - 60 * 60 * 1000),
          cooldownMinutes: 60,
        },
        {
          strategyId: 'expired-2',
          symbol: 'ETHUSDT',
          interval: '1h',
          walletId: wallet.id,
          lastExecutionId: 'exec-2',
          lastExecutionAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          cooldownUntil: new Date(Date.now() - 2 * 60 * 60 * 1000),
          cooldownMinutes: 60,
        },
        {
          strategyId: 'active-1',
          symbol: 'XRPUSDT',
          interval: '1h',
          walletId: wallet.id,
          lastExecutionId: 'exec-3',
          lastExecutionAt: new Date(),
          cooldownUntil: new Date(Date.now() + 60 * 60 * 1000),
          cooldownMinutes: 60,
        },
      ]);

      const count = await cooldownService.cleanupExpired();

      expect(count).toBe(2);

      const remaining = await db.select().from(tradeCooldowns);
      expect(remaining.length).toBe(1);
      expect(remaining[0]!.strategyId).toBe('active-1');
    });

    it('should return 0 when no expired cooldowns exist', async () => {
      const count = await cooldownService.cleanupExpired();
      expect(count).toBe(0);
    });
  });
});
