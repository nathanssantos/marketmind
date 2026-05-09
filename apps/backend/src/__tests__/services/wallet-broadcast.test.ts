import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { tradeExecutions, wallets } from '../../db/schema';
import {
  closeExecutionAndBroadcast,
  emitPositionClosedEvents,
  incrementWalletBalanceAndBroadcast,
} from '../../services/wallet-broadcast';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanupTables,
  getTestDatabase,
} from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { generateEntityId } from '../../utils/id';

describe('closeExecutionAndBroadcast', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  const insertOpenExec = async (userId: string, walletId: string) => {
    const db = getTestDatabase();
    const [exec] = await db
      .insert(tradeExecutions)
      .values({
        id: generateEntityId(),
        userId,
        walletId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '80000',
        quantity: '0.1',
        status: 'open',
        marketType: 'FUTURES',
        openedAt: new Date(),
      })
      .returning();
    if (!exec) throw new Error('exec insert failed');
    return exec;
  };

  it('updates exec to closed, increments wallet balance, returns closed: true', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
    const exec = await insertOpenExec(user.id, wallet.id);

    const result = await closeExecutionAndBroadcast(exec, {
      exitPrice: 80500,
      exitReason: 'TAKE_PROFIT',
      exitSource: 'ALGORITHM',
      pnl: 50,
      pnlPercent: 0.625,
      fees: 0.4,
    });

    expect(result.closed).toBe(true);
    expect(result.walletBalance).not.toBeNull();
    expect(parseFloat(result.walletBalance!.currentBalance)).toBeCloseTo(10050, 1);

    const db = getTestDatabase();
    const [reloaded] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, exec.id));
    expect(reloaded?.status).toBe('closed');
    expect(reloaded?.exitReason).toBe('TAKE_PROFIT');
    expect(reloaded?.exitSource).toBe('ALGORITHM');
    expect(parseFloat(reloaded?.pnl ?? '0')).toBe(50);
    expect(reloaded?.stopLossOrderId).toBeNull();
    expect(reloaded?.takeProfitOrderId).toBeNull();
  });

  it('returns closed: false on race-loss without double-incrementing balance', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
    const exec = await insertOpenExec(user.id, wallet.id);

    const first = await closeExecutionAndBroadcast(exec, {
      exitPrice: 80500,
      exitReason: 'TAKE_PROFIT',
      exitSource: 'ALGORITHM',
      pnl: 50,
      pnlPercent: 0.625,
    });
    expect(first.closed).toBe(true);

    const second = await closeExecutionAndBroadcast(exec, {
      exitPrice: 80500,
      exitReason: 'TAKE_PROFIT',
      exitSource: 'ALGORITHM',
      pnl: 50,
      pnlPercent: 0.625,
    });
    expect(second.closed).toBe(false);
    expect(second.walletBalance).toBeNull();

    const db = getTestDatabase();
    const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    // Single increment of +50, not +100.
    expect(parseFloat(walletRow?.currentBalance ?? '0')).toBeCloseTo(10050, 1);
  });

  it('skips wallet broadcast when pnl is 0 (no balance delta) but still closes the exec', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
    const exec = await insertOpenExec(user.id, wallet.id);

    const result = await closeExecutionAndBroadcast(exec, {
      exitPrice: null,
      exitReason: 'EXCHANGE_FLAT',
      exitSource: 'EXCHANGE_SYNC',
      pnl: 0,
      pnlPercent: 0,
    });

    expect(result.closed).toBe(true);
    expect(result.walletBalance).toBeNull();

    const db = getTestDatabase();
    const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(walletRow?.currentBalance ?? '0')).toBeCloseTo(10000, 1);

    const [reloaded] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, exec.id));
    expect(reloaded?.status).toBe('closed');
    expect(reloaded?.exitPrice).toBeNull();
  });

  it('emitPositionClosedEvents and incrementWalletBalanceAndBroadcast remain exported for direct call sites', () => {
    expect(typeof emitPositionClosedEvents).toBe('function');
    expect(typeof incrementWalletBalanceAndBroadcast).toBe('function');
  });
});
