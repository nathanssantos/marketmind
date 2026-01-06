import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RiskManagerService,
  calculatePositionExposure,
  calculateMaxPositionValue,
  calculateMaxTotalExposure,
  calculateMaxDailyLoss,
  calculateDrawdownPercent,
  validateOrderSizePure,
  calculateExposureUtilization,
  type PositionLike,
} from '../../services/risk-manager';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestUser, createTestWallet } from '../helpers/test-fixtures';
import { tradeExecutions, autoTradingConfig, wallets } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('Risk Manager - Pure Utility Functions', () => {
  describe('calculatePositionExposure', () => {
    it('should calculate total exposure for positions', () => {
      const positions: PositionLike[] = [
        { entryPrice: '100', quantity: '10' },
        { entryPrice: '50', quantity: '20' },
      ];

      expect(calculatePositionExposure(positions)).toBe(2000);
    });

    it('should return 0 for empty array', () => {
      expect(calculatePositionExposure([])).toBe(0);
    });
  });

  describe('calculateMaxPositionValue', () => {
    it('should calculate max position value', () => {
      expect(calculateMaxPositionValue(10000, 15)).toBe(1500);
    });

    it('should handle 100% position size', () => {
      expect(calculateMaxPositionValue(10000, 100)).toBe(10000);
    });

    it('should handle 0% position size', () => {
      expect(calculateMaxPositionValue(10000, 0)).toBe(0);
    });
  });

  describe('calculateMaxTotalExposure', () => {
    it('should calculate max total exposure', () => {
      expect(calculateMaxTotalExposure(10000, 20, 3)).toBe(6000);
    });

    it('should handle single position', () => {
      expect(calculateMaxTotalExposure(10000, 50, 1)).toBe(5000);
    });
  });

  describe('calculateMaxDailyLoss', () => {
    it('should calculate max daily loss', () => {
      expect(calculateMaxDailyLoss(10000, 5)).toBe(500);
    });

    it('should handle 0% limit', () => {
      expect(calculateMaxDailyLoss(10000, 0)).toBe(0);
    });
  });

  describe('calculateDrawdownPercent', () => {
    it('should calculate drawdown percentage', () => {
      expect(calculateDrawdownPercent(10000, 9000)).toBe(10);
    });

    it('should return 0 for no drawdown', () => {
      expect(calculateDrawdownPercent(10000, 10000)).toBe(0);
    });

    it('should handle profit (negative drawdown)', () => {
      expect(calculateDrawdownPercent(10000, 11000)).toBe(-10);
    });

    it('should return 0 for initial balance of 0', () => {
      expect(calculateDrawdownPercent(0, 1000)).toBe(0);
    });
  });

  describe('validateOrderSizePure', () => {
    it('should validate order within limits', () => {
      const result = validateOrderSizePure(10000, 1000, 15);

      expect(result.isValid).toBe(true);
      expect(result.maxAllowed).toBe(1500);
    });

    it('should reject order exceeding limits', () => {
      const result = validateOrderSizePure(10000, 2000, 15);

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('exceeds maximum');
      expect(result.maxAllowed).toBe(1500);
    });

    it('should accept order exactly at limit', () => {
      const result = validateOrderSizePure(10000, 1500, 15);

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateExposureUtilization', () => {
    it('should calculate utilization percentage', () => {
      expect(calculateExposureUtilization(500, 1000)).toBe(50);
    });

    it('should handle full utilization', () => {
      expect(calculateExposureUtilization(1000, 1000)).toBe(100);
    });

    it('should handle over utilization', () => {
      expect(calculateExposureUtilization(1500, 1000)).toBe(150);
    });

    it('should return 0 for 0 max allowed', () => {
      expect(calculateExposureUtilization(500, 0)).toBe(0);
    });
  });
});

describe('RiskManagerService', () => {
  let riskManagerService: RiskManagerService;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    riskManagerService = new RiskManagerService();
  });

  describe('validateNewPosition', () => {
    it('should reject when wallet not found', async () => {
      const config = {
        id: 'config-1',
        userId: 'user-1',
        walletId: 'nonexistent',
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: '[]',
        positionSizing: 'percentage',
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: true,
        useAdxFilter: true,
        useTrendFilter: true,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await riskManagerService.validateNewPosition(
        'nonexistent',
        config,
        1000
      );

      expect(result.isValid).toBe(false);
      expect(result.reason!).toBe('Wallet not found');
    });

    it('should reject when max concurrent positions reached', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(autoTradingConfig).values({
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
        maxConcurrentPositions: 2,
      });

      await db.insert(tradeExecutions).values([
        {
          id: 'exec-1',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        },
        {
          id: 'exec-2',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'LONG',
          entryPrice: '3000',
          quantity: '1',
          status: 'open',
          openedAt: new Date(),
        },
      ]);

      const config = {
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 2,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: '[]',
        positionSizing: 'percentage',
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: true,
        useAdxFilter: true,
        useTrendFilter: true,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await riskManagerService.validateNewPosition(
        wallet.id,
        config,
        1000
      );

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('Maximum concurrent positions reached');
    });

    it('should reject when position size exceeds maximum', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const config = {
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: '[]',
        positionSizing: 'percentage',
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: true,
        useAdxFilter: true,
        useTrendFilter: true,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await riskManagerService.validateNewPosition(
        wallet.id,
        config,
        2000
      );

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('Position size exceeds maximum');
    });

    it('should allow valid position', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const config = {
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: '[]',
        positionSizing: 'percentage',
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: true,
        useAdxFilter: true,
        useTrendFilter: true,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await riskManagerService.validateNewPosition(
        wallet.id,
        config,
        1000
      );

      expect(result.isValid).toBe(true);
    });

    it('should adjust max positions based on active watchers count', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });
      const db = getTestDatabase();

      await db.insert(tradeExecutions).values([
        {
          id: 'exec-1',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        },
        {
          id: 'exec-2',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'LONG',
          entryPrice: '3000',
          quantity: '1',
          status: 'open',
          openedAt: new Date(),
        },
      ]);

      const config = {
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: '[]',
        positionSizing: 'percentage',
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: true,
        useAdxFilter: true,
        useTrendFilter: true,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await riskManagerService.validateNewPosition(
        wallet.id,
        config,
        1000,
        2
      );

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('Maximum concurrent positions reached (2)');
    });
  });

  describe('getCurrentExposure', () => {
    it('should return zero exposure when no positions', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const exposure = await riskManagerService.getCurrentExposure(wallet.id);

      expect(exposure.totalValue).toBe(0);
      expect(exposure.openPositionsCount).toBe(0);
      expect(exposure.utilizationPercent).toBe(0);
    });

    it('should calculate exposure correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });
      const db = getTestDatabase();

      await db.insert(tradeExecutions).values([
        {
          id: 'exec-1',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        },
      ]);

      const exposure = await riskManagerService.getCurrentExposure(wallet.id);

      expect(exposure.totalValue).toBe(5000);
      expect(exposure.openPositionsCount).toBe(1);
      expect(exposure.maxAllowed).toBe(10000);
      expect(exposure.utilizationPercent).toBe(50);
    });

    it('should return zeros for nonexistent wallet', async () => {
      const exposure = await riskManagerService.getCurrentExposure('nonexistent');

      expect(exposure.totalValue).toBe(0);
      expect(exposure.maxAllowed).toBe(0);
      expect(exposure.utilizationPercent).toBe(0);
      expect(exposure.openPositionsCount).toBe(0);
    });
  });

  describe('getDailyPnL', () => {
    it('should return zero when no trades today', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const pnl = await riskManagerService.getDailyPnL(wallet.id);

      expect(pnl.pnl).toBe(0);
    });

    it('should calculate daily PnL from closed trades', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });
      const db = getTestDatabase();

      await db.insert(tradeExecutions).values([
        {
          id: 'exec-1',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          exitPrice: '51000',
          quantity: '0.1',
          pnl: '100',
          status: 'closed',
          openedAt: new Date(),
          closedAt: new Date(),
        },
        {
          id: 'exec-2',
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'LONG',
          entryPrice: '3000',
          exitPrice: '2900',
          quantity: '1',
          pnl: '-100',
          status: 'closed',
          openedAt: new Date(),
          closedAt: new Date(),
        },
      ]);

      const pnl = await riskManagerService.getDailyPnL(wallet.id);

      expect(pnl.pnl).toBe(0);
    });

    it('should return zeros for nonexistent wallet', async () => {
      const pnl = await riskManagerService.getDailyPnL('nonexistent');

      expect(pnl.pnl).toBe(0);
      expect(pnl.limit).toBe(0);
      expect(pnl.percentUsed).toBe(0);
    });
  });

  describe('checkDrawdown', () => {
    it('should detect no drawdown', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const result = await riskManagerService.checkDrawdown(wallet.id, 15);

      expect(result.currentDrawdown).toBe(0);
      expect(result.maxDrawdown).toBe(15);
      expect(result.isExceeded).toBe(false);
    });

    it('should detect exceeded drawdown', async () => {
      const { user } = await createTestUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      await db
        .update(wallets)
        .set({ currentBalance: '8000' })
        .where(eq(wallets.id, wallet.id));

      const result = await riskManagerService.checkDrawdown(wallet.id, 15);

      expect(result.currentDrawdown).toBe(20);
      expect(result.maxDrawdown).toBe(15);
      expect(result.isExceeded).toBe(true);
    });

    it('should return safe defaults for nonexistent wallet', async () => {
      const result = await riskManagerService.checkDrawdown('nonexistent', 15);

      expect(result.currentDrawdown).toBe(0);
      expect(result.maxDrawdown).toBe(0);
      expect(result.isExceeded).toBe(false);
    });
  });

  describe('validateDrawdownForNewPosition', () => {
    it('should allow position when drawdown within limits', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const result = await riskManagerService.validateDrawdownForNewPosition(wallet.id, 15);

      expect(result.isValid).toBe(true);
    });

    it('should reject position when drawdown exceeded', async () => {
      const { user } = await createTestUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      await db
        .update(wallets)
        .set({ currentBalance: '8000' })
        .where(eq(wallets.id, wallet.id));

      const result = await riskManagerService.validateDrawdownForNewPosition(wallet.id, 15);

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('Maximum drawdown limit exceeded');
    });
  });

  describe('validateOrderSize', () => {
    it('should validate order within limits', async () => {
      const result = await riskManagerService.validateOrderSize(10000, 1000, 15);

      expect(result.isValid).toBe(true);
    });

    it('should reject order exceeding limits', async () => {
      const result = await riskManagerService.validateOrderSize(10000, 2000, 15);

      expect(result.isValid).toBe(false);
      expect(result.reason!).toContain('exceeds maximum');
    });
  });
});
