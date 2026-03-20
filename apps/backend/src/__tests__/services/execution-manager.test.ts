import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculatePnL,
  detectExitReason,
  isClosingSide,
  PROTECTION_ORDER_TYPES,
  clearProtectionOrderIds,
  updateProtectionOrderId,
  closeExecutionWithPnL,
  cancelAndClearProtectionOrder,
  cancelAllExecutionOrders,
  getExecutionById,
  getWalletById,
  syncProtectionOrderIdFromExchange,
} from '../../services/execution-manager';
import { cleanupTables, getTestDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import * as schema from '../../db/schema';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/protection-orders', () => ({
  cancelProtectionOrder: vi.fn().mockResolvedValue(true),
}));

describe('Execution Manager', () => {
  describe('PROTECTION_ORDER_TYPES', () => {
    it('should have correct order types', () => {
      expect(PROTECTION_ORDER_TYPES.STOP_LOSS).toBe('STOP_MARKET');
      expect(PROTECTION_ORDER_TYPES.TAKE_PROFIT).toBe('TAKE_PROFIT_MARKET');
    });
  });

  describe('detectExitReason', () => {
    describe('LONG positions', () => {
      it('should detect STOP_LOSS when exit price is below entry price', () => {
        const result = detectExitReason('LONG', 50000, 48000);
        expect(result).toBe('STOP_LOSS');
      });

      it('should detect TAKE_PROFIT when exit price is above entry price', () => {
        const result = detectExitReason('LONG', 50000, 52000);
        expect(result).toBe('TAKE_PROFIT');
      });

      it('should detect TAKE_PROFIT when exit price equals entry price', () => {
        const result = detectExitReason('LONG', 50000, 50000);
        expect(result).toBe('TAKE_PROFIT');
      });
    });

    describe('SHORT positions', () => {
      it('should detect STOP_LOSS when exit price is above entry price', () => {
        const result = detectExitReason('SHORT', 50000, 52000);
        expect(result).toBe('STOP_LOSS');
      });

      it('should detect TAKE_PROFIT when exit price is below entry price', () => {
        const result = detectExitReason('SHORT', 50000, 48000);
        expect(result).toBe('TAKE_PROFIT');
      });

      it('should detect TAKE_PROFIT when exit price equals entry price', () => {
        const result = detectExitReason('SHORT', 50000, 50000);
        expect(result).toBe('TAKE_PROFIT');
      });
    });
  });

  describe('calculatePnL', () => {
    describe('LONG positions', () => {
      it('should calculate positive PnL for profitable trade', () => {
        const result = calculatePnL('LONG', 50000, 52000, 0.1, 1);
        expect(result.pnl).toBeCloseTo(200, 2);
        expect(result.pnlPercent).toBeCloseTo(4, 2);
      });

      it('should calculate negative PnL for losing trade', () => {
        const result = calculatePnL('LONG', 50000, 48000, 0.1, 1);
        expect(result.pnl).toBeCloseTo(-200, 2);
        expect(result.pnlPercent).toBeCloseTo(-4, 2);
      });

      it('should apply leverage multiplier correctly to pnlPercent', () => {
        const result1x = calculatePnL('LONG', 50000, 52000, 0.1, 1);
        const result10x = calculatePnL('LONG', 50000, 52000, 0.1, 10);
        expect(result10x.pnl).toBeCloseTo(result1x.pnl, 2);
        expect(result10x.pnlPercent).toBeCloseTo(result1x.pnlPercent * 10, 2);
      });

      it('should subtract fees from PnL', () => {
        const resultNoFees = calculatePnL('LONG', 50000, 52000, 0.1, 1, 0, 0);
        const resultWithFees = calculatePnL('LONG', 50000, 52000, 0.1, 1, 10, 5);
        expect(resultWithFees.pnl).toBeCloseTo(resultNoFees.pnl - 15, 2);
      });
    });

    describe('SHORT positions', () => {
      it('should calculate positive PnL for profitable trade', () => {
        const result = calculatePnL('SHORT', 50000, 48000, 0.1, 1);
        expect(result.pnl).toBeCloseTo(200, 2);
        expect(result.pnlPercent).toBeCloseTo(4, 2);
      });

      it('should calculate negative PnL for losing trade', () => {
        const result = calculatePnL('SHORT', 50000, 52000, 0.1, 1);
        expect(result.pnl).toBeCloseTo(-200, 2);
        expect(result.pnlPercent).toBeCloseTo(-4, 2);
      });

      it('should apply leverage multiplier correctly to pnlPercent', () => {
        const result1x = calculatePnL('SHORT', 50000, 48000, 0.1, 1);
        const result20x = calculatePnL('SHORT', 50000, 48000, 0.1, 20);
        expect(result20x.pnl).toBeCloseTo(result1x.pnl, 2);
        expect(result20x.pnlPercent).toBeCloseTo(result1x.pnlPercent * 20, 2);
      });
    });

    describe('Edge cases', () => {
      it('should handle zero quantity', () => {
        const result = calculatePnL('LONG', 50000, 52000, 0, 1);
        expect(result.pnl).toBe(0);
        expect(result.pnlPercent).toBe(0);
      });

      it('should handle breakeven trade', () => {
        const result = calculatePnL('LONG', 50000, 50000, 0.1, 1);
        expect(result.pnl).toBe(0);
        expect(result.pnlPercent).toBe(0);
      });

      it('should handle very small price movements', () => {
        const result = calculatePnL('LONG', 50000, 50001, 0.1, 10);
        expect(result.pnl).toBeCloseTo(0.1, 2);
        expect(result.pnlPercent).toBeCloseTo(0.02, 2);
      });
    });
  });

  describe('isClosingSide', () => {
    it('should return true for LONG position with SELL order', () => {
      expect(isClosingSide('LONG', 'SELL')).toBe(true);
    });

    it('should return false for LONG position with BUY order', () => {
      expect(isClosingSide('LONG', 'BUY')).toBe(false);
    });

    it('should return true for SHORT position with BUY order', () => {
      expect(isClosingSide('SHORT', 'BUY')).toBe(true);
    });

    it('should return false for SHORT position with SELL order', () => {
      expect(isClosingSide('SHORT', 'SELL')).toBe(false);
    });
  });
});

describe('Execution Manager - Database Operations', () => {
  let db: ReturnType<typeof getTestDatabase>;
  let testUserId: string;
  let testWalletId: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
  }, 60000);

  afterAll(async () => {
    await teardownTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanupTables();

    testUserId = generateEntityId();
    testWalletId = generateEntityId();

    await db.insert(schema.users).values({
      id: testUserId,
      email: 'test@example.com',
      passwordHash: 'hashed_password',
    });

    await db.insert(schema.wallets).values({
      id: testWalletId,
      userId: testUserId,
      name: 'Test Wallet',
      walletType: 'paper',
      marketType: 'FUTURES',
      apiKeyEncrypted: 'encrypted_key',
      apiSecretEncrypted: 'encrypted_secret',
      currentBalance: '1000',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createTestExecution = async (overrides: Partial<schema.TradeExecution> = {}) => {
    const executionId = generateEntityId();
    const execution: schema.NewTradeExecution = {
      id: executionId,
      userId: testUserId,
      walletId: testWalletId,
      symbol: 'BTCUSDT',
      side: 'LONG',
      entryPrice: '50000',
      quantity: '0.1',
      status: 'open',
      openedAt: new Date(),
      marketType: 'FUTURES',
      leverage: 10,
      stopLoss: '48000',
      takeProfit: '55000',
      entryFee: '5',
      stopLossAlgoId: '12345',
      takeProfitAlgoId: '67890',
      ...overrides,
    };

    await db.insert(schema.tradeExecutions).values(execution);
    return executionId;
  };

  describe('getWalletById', () => {
    it('should return wallet when found', async () => {
      const wallet = await getWalletById(testWalletId);
      expect(wallet).not.toBeNull();
      expect(wallet?.id).toBe(testWalletId);
      expect(wallet?.name).toBe('Test Wallet');
    });

    it('should return null when wallet not found', async () => {
      const wallet = await getWalletById('non-existent-id');
      expect(wallet).toBeNull();
    });
  });

  describe('getExecutionById', () => {
    it('should return execution when found', async () => {
      const executionId = await createTestExecution();
      const execution = await getExecutionById(executionId);
      expect(execution).not.toBeNull();
      expect(execution?.id).toBe(executionId);
      expect(execution?.symbol).toBe('BTCUSDT');
    });

    it('should return null when execution not found', async () => {
      const execution = await getExecutionById('non-existent-id');
      expect(execution).toBeNull();
    });
  });

  describe('clearProtectionOrderIds', () => {
    it('should clear stopLoss IDs only', async () => {
      const executionId = await createTestExecution();

      await clearProtectionOrderIds(executionId, 'stopLoss');

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBeNull();
      expect(execution?.stopLoss).toBeNull();
      expect(execution?.takeProfitAlgoId).toBe('67890');
      expect(parseFloat(execution?.takeProfit || '0')).toBe(55000);
    });

    it('should clear takeProfit IDs only', async () => {
      const executionId = await createTestExecution();

      await clearProtectionOrderIds(executionId, 'takeProfit');

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBe('12345');
      expect(parseFloat(execution?.stopLoss || '0')).toBe(48000);
      expect(execution?.takeProfitAlgoId).toBeNull();
      expect(execution?.takeProfit).toBeNull();
    });

    it('should clear both IDs', async () => {
      const executionId = await createTestExecution();

      await clearProtectionOrderIds(executionId, 'both');

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBeNull();
      expect(execution?.stopLoss).toBeNull();
      expect(execution?.takeProfitAlgoId).toBeNull();
      expect(execution?.takeProfit).toBeNull();
    });
  });

  describe('updateProtectionOrderId', () => {
    it('should update stopLoss algo ID and price', async () => {
      const executionId = await createTestExecution();

      await updateProtectionOrderId(executionId, 'stopLoss', '99999', 47000);

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBe('99999');
      expect(parseFloat(execution?.stopLoss || '0')).toBe(47000);
    });

    it('should update takeProfit algo ID and price', async () => {
      const executionId = await createTestExecution();

      await updateProtectionOrderId(executionId, 'takeProfit', '88888', 56000);

      const execution = await getExecutionById(executionId);
      expect(execution?.takeProfitAlgoId).toBe('88888');
      expect(parseFloat(execution?.takeProfit || '0')).toBe(56000);
    });

    it('should update only algo ID when price not provided', async () => {
      const executionId = await createTestExecution();

      await updateProtectionOrderId(executionId, 'stopLoss', '99999');

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBe('99999');
      expect(parseFloat(execution?.stopLoss || '0')).toBe(48000);
    });

    it('should set algo ID to null', async () => {
      const executionId = await createTestExecution();

      await updateProtectionOrderId(executionId, 'stopLoss', null);

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBeNull();
    });
  });

  describe('closeExecutionWithPnL', () => {
    it('should close execution with calculated PnL', async () => {
      const executionId = await createTestExecution();

      const result = await closeExecutionWithPnL({
        executionId,
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe('closed');
      expect(parseFloat(result?.exitPrice || '0')).toBe(52000);
      expect(result?.exitReason).toBe('TAKE_PROFIT');
      expect(parseFloat(result?.pnl || '0')).toBeGreaterThan(0);
      expect(result?.stopLossAlgoId).toBeNull();
      expect(result?.takeProfitAlgoId).toBeNull();
    });

    it('should use provided realizedPnl when available', async () => {
      const executionId = await createTestExecution();

      const result = await closeExecutionWithPnL({
        executionId,
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
        realizedPnl: 150.5,
      });

      expect(result).not.toBeNull();
      expect(parseFloat(result?.pnl || '0')).toBeCloseTo(150.5, 2);
    });

    it('should handle closing with exit fee', async () => {
      const executionId = await createTestExecution();

      const result = await closeExecutionWithPnL({
        executionId,
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
        exitFee: 10,
      });

      expect(result).not.toBeNull();
      expect(parseFloat(result?.exitFee || '0')).toBe(10);
      expect(parseFloat(result?.fees || '0')).toBe(15);
    });

    it('should return null for non-existent execution', async () => {
      const result = await closeExecutionWithPnL({
        executionId: 'non-existent',
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
      });

      expect(result).toBeNull();
    });

    it('should return existing execution if already closed', async () => {
      const executionId = await createTestExecution({ status: 'closed' });

      const result = await closeExecutionWithPnL({
        executionId,
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
      });

      expect(result?.status).toBe('closed');
    });
  });

  describe('cancelAndClearProtectionOrder', () => {
    it('should cancel order and clear IDs from database', async () => {
      const executionId = await createTestExecution();
      const wallet = await getWalletById(testWalletId);
      const execution = await getExecutionById(executionId);

      const result = await cancelAndClearProtectionOrder({
        wallet: wallet!,
        execution: execution!,
        field: 'stopLoss',
      });

      expect(result).toBe(true);

      const updatedExecution = await getExecutionById(executionId);
      expect(updatedExecution?.stopLossAlgoId).toBeNull();
    });

    it('should return true if no order to cancel', async () => {
      const executionId = await createTestExecution({ stopLossAlgoId: null, stopLossOrderId: null });
      const wallet = await getWalletById(testWalletId);
      const execution = await getExecutionById(executionId);

      const result = await cancelAndClearProtectionOrder({
        wallet: wallet!,
        execution: execution!,
        field: 'stopLoss',
      });

      expect(result).toBe(true);
    });
  });

  describe('cancelAllExecutionOrders', () => {
    it('should cancel all protection orders and clear IDs', async () => {
      const executionId = await createTestExecution();
      const wallet = await getWalletById(testWalletId);
      const execution = await getExecutionById(executionId);

      await cancelAllExecutionOrders(wallet!, execution!);

      const updatedExecution = await getExecutionById(executionId);
      expect(updatedExecution?.stopLossAlgoId).toBeNull();
      expect(updatedExecution?.stopLoss).toBeNull();
      expect(updatedExecution?.takeProfitAlgoId).toBeNull();
      expect(updatedExecution?.takeProfit).toBeNull();
    });
  });

  describe('syncProtectionOrderIdFromExchange', () => {
    it('should sync stopLoss order ID from exchange', async () => {
      const executionId = await createTestExecution();

      await syncProtectionOrderIdFromExchange(executionId, 'stopLoss', '111111', 47500);

      const execution = await getExecutionById(executionId);
      expect(execution?.stopLossAlgoId).toBe('111111');
      expect(parseFloat(execution?.stopLoss || '0')).toBe(47500);
    });

    it('should sync takeProfit order ID from exchange', async () => {
      const executionId = await createTestExecution();

      await syncProtectionOrderIdFromExchange(executionId, 'takeProfit', '222222', 56500);

      const execution = await getExecutionById(executionId);
      expect(execution?.takeProfitAlgoId).toBe('222222');
      expect(parseFloat(execution?.takeProfit || '0')).toBe(56500);
    });
  });
});
