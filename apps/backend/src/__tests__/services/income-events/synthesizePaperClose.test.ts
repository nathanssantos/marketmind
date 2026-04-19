import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { incomeEvents } from '../../../db/schema';
import { synthesizePaperClose } from '../../../services/income-events';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../../helpers/test-fixtures';

describe('synthesizePaperClose', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  it('emits REALIZED_PNL, COMMISSION, and FUNDING_FEE rows with correct signs', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
    const db = getTestDatabase();

    const inserted = await synthesizePaperClose({
      walletId: wallet.id,
      userId: user.id,
      executionId: 'exec-1',
      symbol: 'BTCUSDT',
      grossPnl: 120,
      totalFees: 5.5,
      accumulatedFunding: -2.3,
      closedAt: new Date('2026-04-19T10:00:00Z'),
    });

    expect(inserted).toBe(3);

    const rows = await db
      .select()
      .from(incomeEvents)
      .where(and(eq(incomeEvents.walletId, wallet.id), eq(incomeEvents.executionId, 'exec-1')));

    expect(rows).toHaveLength(3);

    const pnl = rows.find((r) => r.incomeType === 'REALIZED_PNL');
    const fees = rows.find((r) => r.incomeType === 'COMMISSION');
    const funding = rows.find((r) => r.incomeType === 'FUNDING_FEE');

    expect(parseFloat(pnl!.amount)).toBe(120);
    expect(parseFloat(fees!.amount)).toBe(-5.5);
    expect(parseFloat(funding!.amount)).toBe(-2.3);
    expect(rows.every((r) => r.source === 'paper')).toBe(true);
    expect(rows.every((r) => r.binanceTranId < 0)).toBe(true);
  });

  it('skips fee row when totalFees is 0', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
    const db = getTestDatabase();

    const inserted = await synthesizePaperClose({
      walletId: wallet.id,
      userId: user.id,
      executionId: 'exec-2',
      symbol: 'ETHUSDT',
      grossPnl: 50,
      totalFees: 0,
    });

    expect(inserted).toBe(1);

    const rows = await db
      .select()
      .from(incomeEvents)
      .where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.incomeType).toBe('REALIZED_PNL');
  });

  it('enforces UNIQUE(walletId, binanceTranId) — no duplicates across multiple calls', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
    const db = getTestDatabase();

    await synthesizePaperClose({
      walletId: wallet.id,
      userId: user.id,
      executionId: 'exec-a',
      symbol: 'BTCUSDT',
      grossPnl: 10,
      totalFees: 1,
    });
    await synthesizePaperClose({
      walletId: wallet.id,
      userId: user.id,
      executionId: 'exec-b',
      symbol: 'BTCUSDT',
      grossPnl: 20,
      totalFees: 2,
    });

    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    const uniqueIds = new Set(rows.map((r) => r.binanceTranId));
    expect(uniqueIds.size).toBe(rows.length);
  });
});
