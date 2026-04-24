import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { incomeEvents, wallets } from '../../../db/schema';
import { applyTransferDelta } from '../../../services/wallet-balance';
import { cleanupTables, getTestDatabase, setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../../helpers/test-fixtures';

vi.mock('../../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitWalletUpdate: vi.fn(),
  })),
}));

describe('applyTransferDelta', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  it('applies a deposit (positive delta): bumps balance + totalDeposits, inserts synthetic TRANSFER income event', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '100' });
    const db = getTestDatabase();

    const result = await applyTransferDelta({
      walletId: wallet.id,
      userId: user.id,
      asset: 'USDT',
      deltaAmount: 25,
      eventTime: Date.now(),
      reason: 'BALANCE_UPDATE',
    });

    expect(result).not.toBeNull();
    expect(result?.depositsAdded).toBe(25);
    expect(result?.withdrawalsAdded).toBe(0);

    const [updated] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(updated?.currentBalance ?? '0')).toBe(125);
    expect(parseFloat(updated?.totalDeposits ?? '0')).toBe(25);
    expect(parseFloat(updated?.totalWithdrawals ?? '0')).toBe(0);
    expect(updated?.lastTransferSyncAt).toBeInstanceOf(Date);

    const rows = await db
      .select()
      .from(incomeEvents)
      .where(and(eq(incomeEvents.walletId, wallet.id), eq(incomeEvents.incomeType, 'TRANSFER')));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.binanceTranId).toBeLessThan(0);
    expect(parseFloat(rows[0]?.amount ?? '0')).toBe(25);
    expect(rows[0]?.info).toContain('realtime');
  });

  it('applies a withdrawal (negative delta): bumps totalWithdrawals, leaves totalDeposits alone', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '100' });
    const db = getTestDatabase();

    const result = await applyTransferDelta({
      walletId: wallet.id,
      userId: user.id,
      asset: 'USDT',
      deltaAmount: -10,
      eventTime: Date.now(),
      reason: 'BALANCE_UPDATE',
    });

    expect(result?.depositsAdded).toBe(0);
    expect(result?.withdrawalsAdded).toBe(10);

    const [updated] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(updated?.currentBalance ?? '0')).toBe(90);
    expect(parseFloat(updated?.totalDeposits ?? '0')).toBe(0);
    expect(parseFloat(updated?.totalWithdrawals ?? '0')).toBe(10);
  });

  it('overrides currentBalance when newBalance is provided (futures ACCOUNT_UPDATE path)', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '500' });
    const db = getTestDatabase();

    await applyTransferDelta({
      walletId: wallet.id,
      userId: user.id,
      asset: 'USDT',
      deltaAmount: 50,
      newBalance: 600,
      eventTime: Date.now(),
      reason: 'DEPOSIT',
    });

    const [updated] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(updated?.currentBalance ?? '0')).toBe(600);
    expect(parseFloat(updated?.totalDeposits ?? '0')).toBe(50);
  });

  it('no-ops on zero delta', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '100' });
    const db = getTestDatabase();

    const result = await applyTransferDelta({
      walletId: wallet.id,
      userId: user.id,
      asset: 'USDT',
      deltaAmount: 0,
      eventTime: Date.now(),
      reason: 'BALANCE_UPDATE',
    });

    expect(result).toBeNull();

    const rows = await db
      .select()
      .from(incomeEvents)
      .where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(0);
  });
});
