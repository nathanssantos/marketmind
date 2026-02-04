import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestWallet, createAuthenticatedUser } from '../helpers/test-fixtures';
import { autoTradingConfig, tradeExecutions, wallets } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateEntityId } from '../../utils/id';

const mockGetPosition = vi.fn();
const mockModifyIsolatedMargin = vi.fn();

vi.mock('../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({
    getPosition: mockGetPosition,
    modifyIsolatedMargin: mockModifyIsolatedMargin,
  })),
}));

vi.mock('../../services/binance-client', () => ({
  isPaperWallet: vi.fn((wallet: { walletType: string }) => wallet.walletType === 'paper'),
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitRiskAlert: vi.fn(),
    emitWalletUpdate: vi.fn(),
  })),
}));

import { MarginManagerService } from '../../services/margin-manager';

describe('MarginManagerService', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    vi.clearAllMocks();
  });

  describe('calculateMaintenanceMargin', () => {
    it('should calculate correct maintenance margin for small notional', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(5000);
      expect(margin).toBe(20);
    });

    it('should calculate correct maintenance margin for 10000 notional (tier boundary)', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(10000);
      expect(margin).toBe(40);
    });

    it('should calculate correct maintenance margin for 50000 notional', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(50000);
      expect(margin).toBe(250);
    });

    it('should calculate correct maintenance margin for 250000 notional', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(250000);
      expect(margin).toBe(2500);
    });

    it('should calculate correct maintenance margin for 1000000 notional', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(1000000);
      expect(margin).toBe(25000);
    });

    it('should handle negative notional (absolute value)', () => {
      const service = new MarginManagerService();
      const margin = (service as unknown as { calculateMaintenanceMargin: (notional: number) => number }).calculateMaintenanceMargin(-5000);
      expect(margin).toBe(20);
    });
  });

  describe('getMaintenanceMarginRate', () => {
    it('should return 0.4% for notional <= 10000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(5000);
      expect(rate).toBe(0.004);
    });

    it('should return 0.5% for notional <= 50000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(25000);
      expect(rate).toBe(0.005);
    });

    it('should return 1% for notional <= 250000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(100000);
      expect(rate).toBe(0.01);
    });

    it('should return 2.5% for notional <= 1000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(500000);
      expect(rate).toBe(0.025);
    });

    it('should return 5% for notional <= 5000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(2000000);
      expect(rate).toBe(0.05);
    });

    it('should return 10% for notional <= 20000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(10000000);
      expect(rate).toBe(0.10);
    });

    it('should return 12.5% for notional <= 50000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(30000000);
      expect(rate).toBe(0.125);
    });

    it('should return 15% for notional <= 100000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(75000000);
      expect(rate).toBe(0.15);
    });

    it('should return 25% for notional > 100000000', () => {
      const service = new MarginManagerService();
      const rate = (service as unknown as { getMaintenanceMarginRate: (notional: number) => number }).getMaintenanceMarginRate(200000000);
      expect(rate).toBe(0.25);
    });
  });

  describe('start and stop', () => {
    it('should start the service', () => {
      const service = new MarginManagerService();
      service.start();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(true);
      service.stop();
    });

    it('should not start twice', () => {
      const service = new MarginManagerService();
      service.start();
      service.start();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(true);
      service.stop();
    });

    it('should stop the service', () => {
      const service = new MarginManagerService();
      service.start();
      service.stop();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(false);
      expect((service as unknown as { checkInterval: unknown }).checkInterval).toBeNull();
    });
  });

  describe('checkAllIsolatedMargins', () => {
    it('should not process if no open futures executions', async () => {
      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();
      expect(mockGetPosition).not.toHaveBeenCalled();
    });

    it('should skip paper wallets', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      });

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockGetPosition).not.toHaveBeenCalled();
    });

    it('should skip wallets without margin top-up enabled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: false,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      });

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockGetPosition).not.toHaveBeenCalled();
    });

    it('should check positions for live wallets with margin top-up enabled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '1000',
        notional: '5000',
      } as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockGetPosition).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should skip cross margin positions', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'CROSS',
        isolatedWallet: '0',
        notional: '5000',
      } as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockModifyIsolatedMargin).not.toHaveBeenCalled();
    });

    it('should not top up if margin ratio below threshold', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '1000',
        notional: '5000',
      } as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockModifyIsolatedMargin).not.toHaveBeenCalled();
    });

    it('should top up margin when ratio exceeds threshold', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
        marginTopUpCount: 0,
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '50',
        notional: '5000',
      } as never);

      mockModifyIsolatedMargin.mockResolvedValue({} as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockModifyIsolatedMargin).toHaveBeenCalledWith(
        'BTCUSDT',
        1000,
        'ADD',
        expect.anything()
      );

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.marginTopUpCount).toBe(1);
    });

    it('should not top up when max top-ups reached', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
        marginTopUpCount: 3,
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '50',
        notional: '5000',
      } as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockModifyIsolatedMargin).not.toHaveBeenCalled();
    });

    it('should update wallet balance after top-up', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
        marginTopUpCount: 0,
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '50',
        notional: '5000',
      } as never);

      mockModifyIsolatedMargin.mockResolvedValue({} as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      const [updatedWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, wallet.id));

      expect(parseFloat(updatedWallet!.currentBalance!)).toBe(9000);
    });

    it('should not top up if amount too small', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '5',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
        marginTopUpCount: 0,
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '50',
        notional: '5000',
      } as never);

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      expect(mockModifyIsolatedMargin).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        marginTopUpEnabled: true,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
        marginTopUpCount: 0,
      });

      mockGetPosition.mockResolvedValue({
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
        isolatedWallet: '50',
        notional: '5000',
      } as never);

      mockModifyIsolatedMargin.mockRejectedValue(new Error('API Error'));

      const service = new MarginManagerService();
      await service.checkAllIsolatedMargins();

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.marginTopUpCount).toBe(0);
    });
  });
});
