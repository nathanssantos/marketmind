import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { incomeEvents, wallets } from '../../../db/schema';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../../helpers/test-fixtures';

vi.mock('../../../services/binance-futures-client', async () => {
  const actual = await vi.importActual<typeof import('../../../services/binance-futures-client')>(
    '../../../services/binance-futures-client',
  );
  return {
    ...actual,
    createBinanceFuturesClient: vi.fn(() => ({}) as never),
    getIncomeHistory: vi.fn(),
    isPaperWallet: (w: { walletType?: string; apiKeyEncrypted?: string }) =>
      w.walletType === 'paper' || w.apiKeyEncrypted === 'paper-trading',
  };
});

const { getIncomeHistory } = await import('../../../services/binance-futures-client');
const { syncWalletIncome } = await import('../../../services/income-events/syncFromBinance');

describe('syncWalletIncome', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    vi.mocked(getIncomeHistory).mockReset();
  });

  const makeLiveWallet = async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({
      userId: user.id,
      walletType: 'live',
      apiKey: 'live-key',
      apiSecret: 'live-secret',
    });
    const db = getTestDatabase();
    await db.update(wallets).set({ marketType: 'FUTURES' }).where(eq(wallets.id, wallet.id));
    const [refreshed] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    return { user, wallet: refreshed! };
  };

  it('inserts REALIZED_PNL, COMMISSION, FUNDING_FEE rows from Binance response', async () => {
    const { wallet } = await makeLiveWallet();
    const t = Date.now() - 60_000;

    vi.mocked(getIncomeHistory).mockResolvedValue([
      { tranId: 100001, incomeType: 'REALIZED_PNL', income: '115.78', asset: 'USDT', symbol: 'BTCUSDT', time: t, info: '', tradeId: 'x1' },
      { tranId: 100002, incomeType: 'COMMISSION', income: '-0.40', asset: 'USDT', symbol: 'BTCUSDT', time: t + 1, info: '', tradeId: 'x2' },
      { tranId: 100003, incomeType: 'FUNDING_FEE', income: '-1.20', asset: 'USDT', symbol: 'BTCUSDT', time: t + 2, info: '', tradeId: '' },
    ]);

    const result = await syncWalletIncome(wallet);

    expect(result.fetched).toBe(3);
    expect(result.inserted).toBe(3);

    const db = getTestDatabase();
    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source === 'binance')).toBe(true);
  });

  it('is idempotent — duplicate tranIds are not inserted twice', async () => {
    const { wallet } = await makeLiveWallet();
    const t = Date.now() - 60_000;

    const records = [
      { tranId: 200001, incomeType: 'REALIZED_PNL', income: '50', asset: 'USDT', symbol: 'BTCUSDT', time: t, info: '', tradeId: '' },
    ];

    vi.mocked(getIncomeHistory).mockResolvedValue(records);
    const first = await syncWalletIncome(wallet);
    expect(first.inserted).toBe(1);

    vi.mocked(getIncomeHistory).mockResolvedValue(records);
    const second = await syncWalletIncome(wallet);
    expect(second.fetched).toBe(1);
    expect(second.inserted).toBe(0);

    const db = getTestDatabase();
    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(1);
  });

  it('TRANSFER rows update wallet totalDeposits / totalWithdrawals', async () => {
    const { wallet } = await makeLiveWallet();
    const t = wallet.createdAt.getTime() + 60_000;

    vi.mocked(getIncomeHistory).mockResolvedValue([
      { tranId: 300001, incomeType: 'TRANSFER', income: '1000', asset: 'USDT', time: t, info: '', tradeId: '' },
      { tranId: 300002, incomeType: 'TRANSFER', income: '-300', asset: 'USDT', time: t + 1, info: '', tradeId: '' },
    ]);

    const result = await syncWalletIncome(wallet);
    expect(result.totalDeposits).toBeCloseTo(1000, 2);
    expect(result.totalWithdrawals).toBeCloseTo(300, 2);

    const db = getTestDatabase();
    const [updated] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(updated!.totalDeposits ?? '0')).toBeCloseTo(1000, 2);
    expect(parseFloat(updated!.totalWithdrawals ?? '0')).toBeCloseTo(300, 2);
  });

  it('skips paper wallets', async () => {
    const { user } = await createAuthenticatedUser();
    const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

    const result = await syncWalletIncome(wallet);
    expect(result.fetched).toBe(0);
    expect(vi.mocked(getIncomeHistory)).not.toHaveBeenCalled();
  });

  it('takes over a synthetic TRANSFER row: deletes synthetic, inserts real, skips totals bump', async () => {
    const { user, wallet } = await makeLiveWallet();
    const db = getTestDatabase();

    const syntheticTime = new Date(wallet.createdAt.getTime() + 60_000);
    const restTime = syntheticTime.getTime() + 10_000;

    await db.insert(incomeEvents).values({
      walletId: wallet.id,
      userId: user.id,
      binanceTranId: -999_888,
      incomeType: 'TRANSFER',
      amount: '150',
      asset: 'USDT',
      source: 'binance',
      info: 'realtime:BALANCE_UPDATE',
      incomeTime: syntheticTime,
    });

    await db
      .update(wallets)
      .set({ totalDeposits: '150', lastTransferSyncAt: syntheticTime })
      .where(eq(wallets.id, wallet.id));

    vi.mocked(getIncomeHistory).mockResolvedValue([
      { tranId: 400001, incomeType: 'TRANSFER', income: '150', asset: 'USDT', time: restTime, info: '', tradeId: '' },
    ]);

    const result = await syncWalletIncome(wallet);
    expect(result.inserted).toBe(1);
    expect(result.totalDeposits).toBe(0);

    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.binanceTranId).toBe(400001);

    const [updated] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    expect(parseFloat(updated!.totalDeposits ?? '0')).toBeCloseTo(150, 2);
  });

  it('does not take over when amount does not match the synthetic sibling', async () => {
    const { user, wallet } = await makeLiveWallet();
    const db = getTestDatabase();

    const syntheticTime = new Date(wallet.createdAt.getTime() + 60_000);
    const restTime = syntheticTime.getTime() + 5_000;

    await db.insert(incomeEvents).values({
      walletId: wallet.id,
      userId: user.id,
      binanceTranId: -777_666,
      incomeType: 'TRANSFER',
      amount: '200',
      asset: 'USDT',
      source: 'binance',
      incomeTime: syntheticTime,
    });

    await db
      .update(wallets)
      .set({ totalDeposits: '200' })
      .where(eq(wallets.id, wallet.id));

    vi.mocked(getIncomeHistory).mockResolvedValue([
      { tranId: 500001, incomeType: 'TRANSFER', income: '75', asset: 'USDT', time: restTime, info: '', tradeId: '' },
    ]);

    const result = await syncWalletIncome(wallet);
    expect(result.inserted).toBe(1);
    expect(result.totalDeposits).toBeCloseTo(75, 2);

    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(2);
  });

  it('does not take over when the synthetic row is outside the 60s window', async () => {
    const { user, wallet } = await makeLiveWallet();
    const db = getTestDatabase();

    const syntheticTime = new Date(wallet.createdAt.getTime() + 60_000);
    const restTime = syntheticTime.getTime() + 5 * 60_000;

    await db.insert(incomeEvents).values({
      walletId: wallet.id,
      userId: user.id,
      binanceTranId: -555_444,
      incomeType: 'TRANSFER',
      amount: '40',
      asset: 'USDT',
      source: 'binance',
      incomeTime: syntheticTime,
    });

    vi.mocked(getIncomeHistory).mockResolvedValue([
      { tranId: 600001, incomeType: 'TRANSFER', income: '40', asset: 'USDT', time: restTime, info: '', tradeId: '' },
    ]);

    const result = await syncWalletIncome(wallet);
    expect(result.totalDeposits).toBeCloseTo(40, 2);

    const rows = await db.select().from(incomeEvents).where(eq(incomeEvents.walletId, wallet.id));
    expect(rows).toHaveLength(2);
  });

  // Backfill behavior — these guard the v1.12 fix where the previous
  // 30-day cap silently truncated history for wallets that had been
  // trading on Binance before MarketMind connected.
  describe('historical backfill', () => {
    it('paginates in 7-day windows when wallet.createdAt is months ago', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      // Pretend the wallet was connected ~21 days ago — that's 4 windows
      // of 7 days each (3 full + 1 partial).
      const TWENTY_ONE_DAYS_MS = 21 * 24 * 60 * 60 * 1000;
      const fakeCreatedAt = new Date(Date.now() - TWENTY_ONE_DAYS_MS);

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'live-key',
        apiSecret: 'live-secret',
      });
      await db
        .update(wallets)
        .set({ marketType: 'FUTURES', createdAt: fakeCreatedAt })
        .where(eq(wallets.id, wallet.id));
      const [refreshed] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));

      vi.mocked(getIncomeHistory).mockResolvedValue([]);

      await syncWalletIncome(refreshed!);

      // Each window is 7 days. 21 days back = 3 windows expected (last
      // partial window sweeps to `now`).
      const calls = vi.mocked(getIncomeHistory).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(3);

      // No two calls should span more than 7 days — Binance's API limit.
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      for (const [, params] of calls) {
        if (params?.startTime != null && params?.endTime != null) {
          expect(params.endTime - params.startTime).toBeLessThanOrEqual(SEVEN_DAYS_MS);
        }
      }
    });

    it('on first sync, starts from wallet.createdAt — not now-24h', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      const fakeCreatedAt = new Date(Date.now() - TEN_DAYS_MS);

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'live-key',
        apiSecret: 'live-secret',
      });
      await db
        .update(wallets)
        .set({ marketType: 'FUTURES', createdAt: fakeCreatedAt })
        .where(eq(wallets.id, wallet.id));
      const [refreshed] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));

      vi.mocked(getIncomeHistory).mockResolvedValue([]);
      await syncWalletIncome(refreshed!);

      const firstCall = vi.mocked(getIncomeHistory).mock.calls[0];
      expect(firstCall?.[1]?.startTime).toBeGreaterThanOrEqual(fakeCreatedAt.getTime() - 1);
      // Crucially, it must NOT be now-24h (the old default).
      const TWENTY_FOUR_HOURS_AGO = Date.now() - 24 * 60 * 60 * 1000;
      expect(firstCall?.[1]?.startTime).toBeLessThan(TWENTY_FOUR_HOURS_AGO);
    });

    it('caps backfill at 6 months even when wallet.createdAt is older', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      // Binance only retains income history for ~6 months. A wallet
      // claiming to be 2 years old is fine but we shouldn't waste
      // 100+ pointless API calls trying to fetch beyond that horizon.
      const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
      const fakeCreatedAt = new Date(Date.now() - TWO_YEARS_MS);

      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'live-key',
        apiSecret: 'live-secret',
      });
      await db
        .update(wallets)
        .set({ marketType: 'FUTURES', createdAt: fakeCreatedAt })
        .where(eq(wallets.id, wallet.id));
      const [refreshed] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));

      vi.mocked(getIncomeHistory).mockResolvedValue([]);
      await syncWalletIncome(refreshed!);

      const firstCall = vi.mocked(getIncomeHistory).mock.calls[0];
      const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
      const SIX_MONTHS_AGO = Date.now() - SIX_MONTHS_MS;
      // First call's startTime should be ~6 months ago, not 2 years ago.
      expect(firstCall?.[1]?.startTime).toBeGreaterThanOrEqual(SIX_MONTHS_AGO - 60_000);
      expect(firstCall?.[1]?.startTime).toBeLessThanOrEqual(SIX_MONTHS_AGO + 60_000);
    });

    it('on resync, continues from lastSynced + 1 (not from creation)', async () => {
      const { wallet, user } = await makeLiveWallet();
      const db = getTestDatabase();

      // Seed an existing event from 3 days ago — sync should continue
      // from there, not restart from wallet.createdAt.
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const lastEventTime = new Date(Date.now() - THREE_DAYS_MS);
      await db.insert(incomeEvents).values({
        walletId: wallet.id,
        userId: user.id,
        binanceTranId: 700001,
        incomeType: 'REALIZED_PNL',
        amount: '50',
        asset: 'USDT',
        symbol: 'BTCUSDT',
        source: 'binance',
        incomeTime: lastEventTime,
      });

      vi.mocked(getIncomeHistory).mockResolvedValue([]);
      await syncWalletIncome(wallet);

      const firstCall = vi.mocked(getIncomeHistory).mock.calls[0];
      // Must start AFTER the seeded event, not from wallet.createdAt.
      expect(firstCall?.[1]?.startTime).toBeGreaterThan(lastEventTime.getTime());
      expect(firstCall?.[1]?.startTime).toBeLessThan(lastEventTime.getTime() + 1000);
    });
  });
});
