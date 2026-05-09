import type { PositionSide } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { incomeEvents, tradeExecutions } from '../../db/schema';
import { generateEntityId } from '../../utils/id';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

const createTestTradeExecution = async (options: {
  userId: string;
  walletId: string;
  symbol?: string;
  side?: PositionSide;
  status?: 'open' | 'closed' | 'cancelled' | 'pending';
  setupType?: string;
  pnl?: string;
  fees?: string;
  openedAt?: Date;
  closedAt?: Date;
  exitPrice?: string | null;
  exitReason?: string | null;
}) => {
  const db = getTestDatabase();
  const {
    userId,
    walletId,
    symbol = 'BTCUSDT',
    side = 'LONG',
    status = 'closed',
    setupType = 'larry-williams-9-1',
    pnl = '100',
    fees = '1',
    openedAt = new Date(),
    closedAt = new Date(),
    // Default closed execs to a populated exit_price so they survive
    // the analytics filter that excludes orphaned (SYNC_INCOMPLETE)
    // rows where exit_price is null. Tests that need to model an
    // orphaned row pass `exitPrice: null` explicitly.
    exitPrice = status === 'closed' ? '50100' : null,
    exitReason = null,
  } = options;

  const [execution] = await db
    .insert(tradeExecutions)
    .values({
      id: generateEntityId(),
      userId,
      walletId,
      symbol,
      side,
      status,
      setupType,
      entryPrice: '50000',
      quantity: '0.1',
      stopLoss: '49000',
      takeProfit: '52000',
      pnl: status === 'closed' ? pnl : null,
      fees: status === 'closed' ? fees : null,
      exitPrice,
      exitReason,
      openedAt,
      closedAt: status === 'closed' ? closedAt : null,
    })
    .returning();

  return execution!;
};

describe('Analytics Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('getTradeHistory', () => {
    it('should return trade history for wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        status: 'closed',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        status: 'closed',
      });

      const result = await caller.analytics.getTradeHistory({
        walletId: wallet.id,
      });

      expect(result.trades.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
        pnl: undefined,
      });

      const closedTrades = await caller.analytics.getTradeHistory({
        walletId: wallet.id,
        status: 'closed',
      });

      const openTrades = await caller.analytics.getTradeHistory({
        walletId: wallet.id,
        status: 'open',
      });

      expect(closedTrades.trades.length).toBe(1);
      expect(openTrades.trades.length).toBe(1);
    });

    it('should respect limit and offset', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 10; i++) {
        await createTestTradeExecution({
          userId: user.id,
          walletId: wallet.id,
          status: 'closed',
        });
      }

      const page1 = await caller.analytics.getTradeHistory({
        walletId: wallet.id,
        limit: 5,
        offset: 0,
      });

      const page2 = await caller.analytics.getTradeHistory({
        walletId: wallet.id,
        limit: 5,
        offset: 5,
      });

      expect(page1.trades.length).toBe(5);
      expect(page2.trades.length).toBe(5);
      expect(page1.total).toBe(10);
    });

    it('should not return trades from other users', async () => {
      const { user: user1, session: _session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const wallet1 = await createTestWallet({ userId: user1.id, walletType: 'paper' });
      await createTestWallet({ userId: user2.id, walletType: 'paper' });

      await createTestTradeExecution({
        userId: user1.id,
        walletId: wallet1.id,
        status: 'closed',
      });

      const caller2 = createAuthenticatedCaller(user2, session2);
      const result = await caller2.analytics.getTradeHistory({
        walletId: wallet1.id,
      });

      expect(result.trades.length).toBe(0);
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.analytics.getTradeHistory({
          walletId: 'wallet-id',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getPerformance', () => {
    it('should calculate performance metrics', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '200',
        fees: '2',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '-100',
        fees: '1',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '150',
        fees: '1.5',
      });

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
      });

      expect(result.totalTrades).toBe(3);
      expect(result.winningTrades).toBe(2);
      expect(result.losingTrades).toBe(1);
      expect(result.winRate).toBeCloseTo(66.67, 1);
      expect(result.netPnL).toBeCloseTo(250, 0);
    });

    it('should return zeros for empty wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
      });

      expect(result.totalTrades).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.netPnL).toBe(0);
    });

    it('should filter by period', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '100',
        openedAt: twoHoursAgo,
        closedAt: twoHoursAgo,
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '200',
        openedAt: threeDaysAgo,
        closedAt: threeDaysAgo,
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '300',
        openedAt: twoWeeksAgo,
        closedAt: twoWeeksAgo,
      });

      const dayResult = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'day',
      });

      const weekResult = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      const monthResult = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'month',
      });

      expect(dayResult.totalTrades).toBe(1);
      expect(weekResult.totalTrades).toBe(2);
      expect(monthResult.totalTrades).toBe(3);
    });

    it('should keep totalReturn sign-consistent with netPnL across periods', async () => {
      // Regression for the bug where Total Return was always derived from
      // the all-time wallet balance regardless of the selected period — so
      // a profitable Week could appear next to a deeply negative all-time
      // return, with conflicting signs on the same screen.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Recent winning trade (inside Day window)
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '500',
        fees: '5',
        openedAt: oneHourAgo,
        closedAt: oneHourAgo,
      });

      // Older losing trade (outside Day window, inside Month)
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '-2000',
        fees: '5',
        openedAt: tenDaysAgo,
        closedAt: tenDaysAgo,
      });

      const dayResult = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'day' });
      const monthResult = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'month' });

      // Day: only the +500 trade is visible — netPnL > 0 ⇒ totalReturn > 0
      expect(dayResult.netPnL).toBeGreaterThan(0);
      expect(dayResult.totalReturn).toBeGreaterThan(0);
      expect(Math.sign(dayResult.netPnL)).toBe(Math.sign(dayResult.totalReturn));

      // Month: both trades visible — netPnL < 0 ⇒ totalReturn < 0
      expect(monthResult.netPnL).toBeLessThan(0);
      expect(monthResult.totalReturn).toBeLessThan(0);
      expect(Math.sign(monthResult.netPnL)).toBe(Math.sign(monthResult.totalReturn));
    });

    it('falls back to per-trade fields when no income events exist (paper-wallet path)', async () => {
      // Paper wallets never sync from Binance, so income_events is empty.
      // In that mode netPnL must reconstruct from trade-level pnl + fees +
      // accumulated_funding so the user still gets a sensible headline.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const recent = new Date(now.getTime() - 60 * 60 * 1000);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '100',
        fees: '1',
        openedAt: recent,
        closedAt: recent,
      });
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '200',
        fees: '1',
        openedAt: recent,
        closedAt: recent,
      });
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '-50',
        fees: '1',
        openedAt: recent,
        closedAt: recent,
      });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'day' });

      // netPnL = sum(trade.pnl) when income events are absent.
      expect(result.netPnL).toBeCloseTo(250, 0);
      // grossPnL fallback = netPnL + fees (so net = gross − fees holds).
      expect(result.grossPnL).toBeCloseTo(253, 0);
      // Fees flipped to negative so the sign convention matches the
      // income-events path.
      expect(result.totalFees).toBeCloseTo(-3, 0);
    });

    it('uses incomeEvents as ground truth for netPnL/totalFees/totalFunding when present', async () => {
      // Regression: before this PR, headline netPnL summed
      // `tradeExecutions.pnl/fees/accumulatedFunding` even when Binance
      // income events were available. Per-trade fees can drift from
      // Binance reality (partial-fill double counting), so on a real
      // wallet the headline disagreed with what the equity curve was
      // showing for the same period. Income events ARE Binance's
      // ground truth — the headline now follows it.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const now = new Date();
      const recent = new Date(now.getTime() - 60 * 60 * 1000);

      // Per-trade rows show inflated fees + a positive net.
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '500',
        fees: '20',
        openedAt: recent,
        closedAt: recent,
      });

      // But Binance ground truth says: gross was 500, fees only 8, no
      // funding. Real net = 500 - 8 = 492.
      await db.insert(incomeEvents).values([
        {
          userId: user.id,
          walletId: wallet.id,
          binanceTranId: 1,
          incomeType: 'REALIZED_PNL',
          amount: '500',
          asset: 'USDT',
          symbol: 'BTCUSDT',
          incomeTime: recent,
          source: 'binance',
        },
        {
          userId: user.id,
          walletId: wallet.id,
          binanceTranId: 2,
          incomeType: 'COMMISSION',
          amount: '-8',
          asset: 'USDT',
          symbol: 'BTCUSDT',
          incomeTime: recent,
          source: 'binance',
        },
      ]);

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.grossPnL).toBeCloseTo(500, 1);
      expect(result.totalFees).toBeCloseTo(-8, 1);
      expect(result.totalFunding).toBeCloseTo(0, 1);
      expect(result.netPnL).toBeCloseTo(492, 1);

      // Per-trade aggregates still reflect the trade-level data — they're
      // descriptive stats, not authoritative totals. avgWin reads pnl
      // off the row (500) which is fine.
      expect(result.avgWin).toBeCloseTo(500, 1);
      expect(result.winningTrades).toBe(1);
    });

    it('keeps Total Return sign-consistent with Net PnL (income-events-based)', async () => {
      // Regression: Total Return was wallet-balance-based for 'all'
      // (currentBalance - effectiveCapital) but PnL-based for filtered
      // periods. This produced opposite signs when the wallet had
      // unrealized losses on open positions or COIN_SWAP withdrawals
      // (e.g. Total Return -3.59% alongside Net PnL +$930.77).
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '1000',
        currentBalance: '700', // Wallet sitting in unrealized drawdown
        totalDeposits: '0',
        totalWithdrawals: '0',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const now = new Date();
      const recent = new Date(now.getTime() - 60 * 60 * 1000);

      // Realized profit of +$100 from a closed trade.
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '100',
        fees: '1',
        openedAt: recent,
        closedAt: recent,
      });
      await db.insert(incomeEvents).values({
        userId: user.id,
        walletId: wallet.id,
        binanceTranId: 1,
        incomeType: 'REALIZED_PNL',
        amount: '100',
        asset: 'USDT',
        symbol: 'BTCUSDT',
        incomeTime: recent,
        source: 'binance',
      });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      // netPnL is positive (+$100 realized), so totalReturn must also
      // be positive — even though currentBalance ($700) < effectiveCapital
      // ($1000) thanks to the open-position drawdown.
      expect(result.netPnL).toBeGreaterThan(0);
      expect(result.totalReturn).toBeGreaterThan(0);
      expect(result.totalReturn).toBeCloseTo(10, 1); // $100 / $1000 * 100
    });
  });

  describe('getDailyPerformance', () => {
    it('falls back to trade-level pnl when income events have not synced yet (regression: daily PnL stuck after close)', async () => {
      // The user's complaint: after closing a trade, the sidebar's daily
      // PnL stays at the previous total until the periodic income sync
      // populates `incomeEvents`. The fix: use `tradeExecutions.pnl`
      // sum-by-day as the fallback when `incomeSum === 0` for that day.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const today = new Date();
      // Insert a closed trade today with realized pnl=300 — but NO matching
      // incomeEvents row, simulating the "just closed, sync hasn't run" gap.
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '300',
        fees: '1',
        openedAt: today,
        closedAt: today,
      });

      const result = await caller.analytics.getDailyPerformance({
        walletId: wallet.id,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      });

      // The trade is reflected in the daily bucket immediately (pre-sync).
      const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayKey = fmt.format(today);
      const todayBucket = result.find((d) => d.date === todayKey);
      expect(todayBucket).toBeDefined();
      expect(todayBucket?.pnl).toBeCloseTo(300, 0);
      expect(todayBucket?.tradesCount).toBe(1);
      expect(todayBucket?.wins).toBe(1);
    });

    it('prefers Binance income ledger over DB trade pnl when income has synced (matches Binance widget)', async () => {
      // 2026-05-09 user report: app showed -$750.64 while Binance
      // showed -$962.99 for the same 4 trades. The $212 gap was funding
      // payments + fees Binance counts in REALIZED_PNL but our
      // per-trade `pnl` field excludes (funding sits in
      // `accumulated_funding`, not folded into `pnl`).
      //
      // Fix: prefer `incomeSum` (REALIZED_PNL + COMMISSION + FUNDING_FEE)
      // whenever Binance has reported any income today. The previous
      // behavior of preferring DB pnl was meant to filter phantom
      // reverse-roll income — that bug is fixed and the ledger is
      // canonical now. tradesCount still comes from DB metadata.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const today = new Date();
      // 3 closed trades — DB pnl sum 90 (excludes funding/fees).
      await createTestTradeExecution({
        userId: user.id, walletId: wallet.id, status: 'closed',
        pnl: '20', openedAt: today, closedAt: today,
      });
      await createTestTradeExecution({
        userId: user.id, walletId: wallet.id, status: 'closed',
        pnl: '20', openedAt: today, closedAt: today,
      });
      await createTestTradeExecution({
        userId: user.id, walletId: wallet.id, status: 'closed',
        pnl: '50', openedAt: today, closedAt: today,
      });

      // Binance income aggregate that includes per-trade pnl + funding +
      // fees — the value the user sees in the Binance widget. 70 here
      // simulates the same trades net of $20 funding + fees combined.
      await db.insert(incomeEvents).values([
        {
          userId: user.id, walletId: wallet.id, binanceTranId: 1,
          incomeType: 'REALIZED_PNL', amount: '90', asset: 'USDT',
          symbol: 'BTCUSDT', incomeTime: today, source: 'binance',
        },
        {
          userId: user.id, walletId: wallet.id, binanceTranId: 2,
          incomeType: 'COMMISSION', amount: '-15', asset: 'USDT',
          symbol: 'BTCUSDT', incomeTime: today, source: 'binance',
        },
        {
          userId: user.id, walletId: wallet.id, binanceTranId: 3,
          incomeType: 'FUNDING_FEE', amount: '-5', asset: 'USDT',
          symbol: 'BTCUSDT', incomeTime: today, source: 'binance',
        },
      ]);

      const result = await caller.analytics.getDailyPerformance({
        walletId: wallet.id,
        year: today.getUTCFullYear(),
        month: today.getUTCMonth() + 1,
      });

      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayKey = fmt.format(today);
      const todayBucket = result.find((d) => d.date === todayKey);
      // tradesCount comes from DB metadata.
      expect(todayBucket?.tradesCount).toBe(3);
      // pnl comes from incomeSum: 90 - 15 - 5 = 70. NOT 90 (the trade-
      // level sum, which is what the Binance widget would NOT show).
      expect(todayBucket?.pnl).toBeCloseTo(70, 0);
    });

    it('excludes orphan execs (exit_price=NULL) from the daily DB sum (regression: phantom -$11k loss in widget)', async () => {
      // 2026-05-08T17:09Z incident: position-sync booked an orphaned
      // exec as closed with exit_reason='SYNC_INCOMPLETE', exit_price=
      // null, but pnl=-11656 (= entry × qty — the calc had run with
      // exit_price treated as 0 by an earlier code path). The widget
      // showed Today's P&L = -$11,532 while Binance itself showed
      // +$94. The structural fix: the daily query filters out execs
      // with NULL exit_price, so corrupted SYNC_INCOMPLETE rows can
      // never pollute the widget regardless of their stale pnl values.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id, walletType: 'paper', initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const today = new Date();
      // One clean trade — pnl=50, exitPrice populated.
      await createTestTradeExecution({
        userId: user.id, walletId: wallet.id, status: 'closed',
        pnl: '50', openedAt: today, closedAt: today,
      });
      // One orphan — pnl=-11656, exitPrice=NULL. Should be excluded.
      await createTestTradeExecution({
        userId: user.id, walletId: wallet.id, status: 'closed',
        pnl: '-11656', openedAt: today, closedAt: today,
        exitPrice: null, exitReason: 'SYNC_INCOMPLETE',
      });

      const result = await caller.analytics.getDailyPerformance({
        walletId: wallet.id,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      });

      const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayKey = fmt.format(today);
      const todayBucket = result.find((d) => d.date === todayKey);
      // Only the clean trade contributes — phantom is filtered out.
      expect(todayBucket?.pnl).toBeCloseTo(50, 0);
      expect(todayBucket?.tradesCount).toBe(1);
    });

    it('falls back to incomeSum on days with NO closed trades (funding-only days)', async () => {
      // A user who's holding through a funding interval on a flat day
      // (no positions opened or closed, just funding rolling) should
      // still see the funding delta — which only exists in incomeEvents.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id, walletType: 'paper', initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const today = new Date();
      await db.insert(incomeEvents).values({
        userId: user.id, walletId: wallet.id, binanceTranId: 99,
        incomeType: 'FUNDING_FEE', amount: '-3.5', asset: 'USDT',
        symbol: 'BTCUSDT', incomeTime: today, source: 'binance',
      });

      const result = await caller.analytics.getDailyPerformance({
        walletId: wallet.id,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      });

      const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayKey = fmt.format(today);
      const todayBucket = result.find((d) => d.date === todayKey);
      expect(todayBucket?.tradesCount).toBe(0);
      expect(todayBucket?.pnl).toBeCloseTo(-3.5, 1);
    });
  });

  describe('getSetupStats', () => {
    it('should group stats by setup type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'larry-williams-9-1',
        pnl: '100',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'larry-williams-9-1',
        pnl: '150',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'larry-williams-9-2',
        pnl: '-50',
      });

      const result = await caller.analytics.getSetupStats({
        walletId: wallet.id,
      });

      expect(result.length).toBe(2);

      const setup91 = result.find((s) => s.setupType === 'larry-williams-9-1');
      const setup92 = result.find((s) => s.setupType === 'larry-williams-9-2');

      expect(setup91?.totalTrades).toBe(2);
      expect(setup91?.winningTrades).toBe(2);
      expect(setup91?.totalPnL).toBe(250);
      expect(setup91?.winRate).toBe(100);

      expect(setup92?.totalTrades).toBe(1);
      expect(setup92?.losingTrades).toBe(1);
      expect(setup92?.totalPnL).toBe(-50);
    });

    it('should sort by total PnL descending', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'setup-a',
        pnl: '50',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'setup-b',
        pnl: '200',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        setupType: 'setup-c',
        pnl: '100',
      });

      const result = await caller.analytics.getSetupStats({
        walletId: wallet.id,
      });

      expect(result[0]!.setupType).toBe('setup-b');
      expect(result[1]!.setupType).toBe('setup-c');
      expect(result[2]!.setupType).toBe('setup-a');
    });
  });

  describe('getEquityCurve', () => {
    it('should return equity curve with initial balance', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.analytics.getEquityCurve({
        walletId: wallet.id,
      });

      expect(result.length).toBe(1);
      expect(result[0]!.balance).toBe(10000);
      expect(result[0]!.pnl).toBe(0);
    });

    it('should build equity curve from trades', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const now = Date.now();
      const date1 = new Date(now + 1000);
      const date2 = new Date(now + 2000);
      const date3 = new Date(now + 3000);

      const exec1 = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '100',
        openedAt: date1,
        closedAt: date1,
      });

      const exec2 = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '-50',
        openedAt: date2,
        closedAt: date2,
      });

      const exec3 = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '200',
        openedAt: date3,
        closedAt: date3,
      });

      await db.insert(incomeEvents).values([
        { walletId: wallet.id, userId: user.id, binanceTranId: -1001, incomeType: 'REALIZED_PNL', amount: '100', asset: 'USDT', symbol: 'BTCUSDT', executionId: exec1.id, source: 'paper', incomeTime: date1 },
        { walletId: wallet.id, userId: user.id, binanceTranId: -1002, incomeType: 'REALIZED_PNL', amount: '-50', asset: 'USDT', symbol: 'BTCUSDT', executionId: exec2.id, source: 'paper', incomeTime: date2 },
        { walletId: wallet.id, userId: user.id, binanceTranId: -1003, incomeType: 'REALIZED_PNL', amount: '200', asset: 'USDT', symbol: 'BTCUSDT', executionId: exec3.id, source: 'paper', incomeTime: date3 },
      ]);

      const result = await caller.analytics.getEquityCurve({
        walletId: wallet.id,
      });

      expect(result.length).toBe(4);
      expect(result[0]!.balance).toBe(10000);
      expect(result[1]!.balance).toBe(10100);
      expect(result[2]!.balance).toBe(10050);
      expect(result[3]!.balance).toBe(10250);
    });

    it('should throw for non-existent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.analytics.getEquityCurve({
          walletId: 'non-existent-wallet',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('seeds equity at initialBalance (not effectiveCapital) so transfers don\'t double-count', async () => {
      // Regression: earlier we seeded at effectiveCapital (= initialBalance
      // + totalDeposits - totalWithdrawals from wallet meta), then added
      // every TRANSFER income event on top. The transfers were counted
      // twice — once via wallet meta, once via the event loop — inflating
      // the equity line by `totalDeposits` and showing a fake "real
      // profit" that included the deposits themselves.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '1000',
        totalDeposits: '500',
        totalWithdrawals: '0',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();
      const now = Date.now();

      // Single TRANSFER deposit of $500 corresponding to wallet.totalDeposits.
      await db.insert(incomeEvents).values({
        userId: user.id,
        walletId: wallet.id,
        binanceTranId: 1,
        incomeType: 'TRANSFER',
        amount: '500',
        asset: 'USDT',
        symbol: null,
        incomeTime: new Date(now + 1000),
        source: 'binance',
      });

      const result = await caller.analytics.getEquityCurve({ walletId: wallet.id });

      // Seed at initialBalance (1000), not effectiveCapital (1500).
      expect(result[0]!.balance).toBe(1000);
      expect(result[0]!.cumulativeNetTransfers).toBe(0);
      // After the TRANSFER: balance = 1000 + 500 = 1500, transfers = 500.
      expect(result[1]!.balance).toBe(1500);
      expect(result[1]!.cumulativeNetTransfers).toBe(500);
    });

    it('returns separate cumulative series for PnL, fees, funding and net transfers', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();
      const now = Date.now();

      await db.insert(incomeEvents).values([
        { userId: user.id, walletId: wallet.id, binanceTranId: 1, incomeType: 'REALIZED_PNL', amount: '300', asset: 'USDT', symbol: 'BTCUSDT', incomeTime: new Date(now + 1000), source: 'binance' },
        { userId: user.id, walletId: wallet.id, binanceTranId: 2, incomeType: 'COMMISSION', amount: '-12', asset: 'USDT', symbol: 'BTCUSDT', incomeTime: new Date(now + 2000), source: 'binance' },
        { userId: user.id, walletId: wallet.id, binanceTranId: 3, incomeType: 'FUNDING_FEE', amount: '-3', asset: 'USDT', symbol: 'BTCUSDT', incomeTime: new Date(now + 3000), source: 'binance' },
        { userId: user.id, walletId: wallet.id, binanceTranId: 4, incomeType: 'TRANSFER', amount: '200', asset: 'USDT', symbol: null, incomeTime: new Date(now + 4000), source: 'binance' },
      ]);

      const result = await caller.analytics.getEquityCurve({ walletId: wallet.id });

      // Final point reflects all 4 series.
      const last = result[result.length - 1]!;
      expect(last.cumulativePnl).toBe(300);
      expect(last.cumulativeFees).toBe(-12);
      expect(last.cumulativeFunding).toBe(-3);
      expect(last.cumulativeNetTransfers).toBe(200);
      // Balance = initialBalance + sum of all 4 cumulative deltas.
      expect(last.balance).toBe(10485);
    });

    it('breakeven derived as initialBalance + cumulativeNetTransfers stays consistent', async () => {
      // The frontend reads `breakeven = initialBalance + cumulativeNetTransfers`.
      // This test guards the contract: with no TRANSFER events, the
      // chart's breakeven (computed in the renderer) must equal
      // initialBalance for every point. After a deposit, it must step
      // up by exactly the deposit amount.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        initialBalance: '5000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();
      const now = Date.now();

      await db.insert(incomeEvents).values([
        { userId: user.id, walletId: wallet.id, binanceTranId: 1, incomeType: 'REALIZED_PNL', amount: '150', asset: 'USDT', symbol: 'BTCUSDT', incomeTime: new Date(now + 1000), source: 'binance' },
        { userId: user.id, walletId: wallet.id, binanceTranId: 2, incomeType: 'TRANSFER', amount: '1000', asset: 'USDT', symbol: null, incomeTime: new Date(now + 2000), source: 'binance' },
        { userId: user.id, walletId: wallet.id, binanceTranId: 3, incomeType: 'TRANSFER', amount: '-300', asset: 'USDT', symbol: null, incomeTime: new Date(now + 3000), source: 'binance' },
      ]);

      const result = await caller.analytics.getEquityCurve({ walletId: wallet.id });

      const initialBalance = 5000;
      // Helper that mirrors the frontend's breakeven derivation.
      const breakevenAt = (cumulativeNetTransfers: number) => initialBalance + cumulativeNetTransfers;

      // Point 0 (seed): no transfers yet → breakeven = initialBalance.
      expect(breakevenAt(result[0]!.cumulativeNetTransfers)).toBe(5000);
      // Point 1 (REALIZED_PNL): no transfer yet → breakeven still 5000.
      expect(breakevenAt(result[1]!.cumulativeNetTransfers)).toBe(5000);
      // Point 2 (TRANSFER +1000): breakeven steps up to 6000.
      expect(breakevenAt(result[2]!.cumulativeNetTransfers)).toBe(6000);
      // Point 3 (TRANSFER -300): breakeven steps down to 5700.
      expect(breakevenAt(result[3]!.cumulativeNetTransfers)).toBe(5700);

      // Real profit at last point = balance - breakeven = realized PnL only.
      const last = result[result.length - 1]!;
      expect(last.balance - breakevenAt(last.cumulativeNetTransfers)).toBeCloseTo(150, 1);
    });
  });

  describe('getPerformance — new analytics fields', () => {
    it('breaks down LONG vs SHORT with their own win rate and PnL', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);
      const recent = new Date(Date.now() - 60 * 60 * 1000);

      // 2 long winners + 1 long loser → 66.7% win rate, +$150 net
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'LONG', pnl: '100', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'LONG', pnl: '100', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'LONG', pnl: '-50', openedAt: recent, closedAt: recent });
      // 1 short winner + 1 short loser → 50% win rate, +$30 net
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'SHORT', pnl: '80', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'SHORT', pnl: '-50', openedAt: recent, closedAt: recent });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.long).not.toBeNull();
      expect(result.long!.trades).toBe(3);
      expect(result.long!.winRate).toBeCloseTo(66.67, 1);
      expect(result.long!.netPnL).toBeCloseTo(150, 1);

      expect(result.short).not.toBeNull();
      expect(result.short!.trades).toBe(2);
      expect(result.short!.winRate).toBeCloseTo(50, 1);
      expect(result.short!.netPnL).toBeCloseTo(30, 1);
    });

    it('returns null for sides with no trades (renderer hides the column)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);
      const recent = new Date(Date.now() - 60 * 60 * 1000);

      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', side: 'LONG', pnl: '100', openedAt: recent, closedAt: recent });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.long).not.toBeNull();
      expect(result.short).toBeNull();
    });

    it('computes longest win/loss streaks from chronologically ordered closes', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);
      const t0 = Date.now() - 10 * 60 * 60 * 1000;

      // W W W L L W L → longest win streak = 3, longest loss streak = 2
      const pnls = ['100', '50', '75', '-30', '-20', '40', '-10'];
      for (let i = 0; i < pnls.length; i++) {
        await createTestTradeExecution({
          userId: user.id,
          walletId: wallet.id,
          status: 'closed',
          pnl: pnls[i]!,
          openedAt: new Date(t0 + i * 60 * 60 * 1000),
          closedAt: new Date(t0 + i * 60 * 60 * 1000),
        });
      }

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.longestWinStreak).toBe(3);
      expect(result.longestLossStreak).toBe(2);
    });

    it('computes avgTradeDurationHours from openedAt → closedAt deltas', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);

      const open1 = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const close1 = new Date(open1.getTime() + 2 * 60 * 60 * 1000); // 2h
      const open2 = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const close2 = new Date(open2.getTime() + 4 * 60 * 60 * 1000); // 4h

      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', pnl: '50', openedAt: open1, closedAt: close1 });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', pnl: '50', openedAt: open2, closedAt: close2 });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      // Avg of (2h, 4h) = 3h
      expect(result.avgTradeDurationHours).toBeCloseTo(3, 1);
    });

    it('returns top symbols sorted by absolute netPnL', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);
      const recent = new Date(Date.now() - 60 * 60 * 1000);

      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'BTCUSDT', pnl: '500', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'BTCUSDT', pnl: '100', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'ETHUSDT', pnl: '-300', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'SOLUSDT', pnl: '50', openedAt: recent, closedAt: recent });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      // Sort: BTC ($600) > ETH (-$300, abs 300) > SOL ($50)
      expect(result.bySymbol[0]!.symbol).toBe('BTCUSDT');
      expect(result.bySymbol[0]!.netPnL).toBeCloseTo(600, 1);
      expect(result.bySymbol[1]!.symbol).toBe('ETHUSDT');
      expect(result.bySymbol[1]!.netPnL).toBeCloseTo(-300, 1);
      expect(result.bySymbol[2]!.symbol).toBe('SOLUSDT');
    });

    it('reports best and worst trades with full context', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);
      const recent = new Date(Date.now() - 60 * 60 * 1000);

      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'BTCUSDT', side: 'LONG', pnl: '500', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'ETHUSDT', side: 'SHORT', pnl: '-200', openedAt: recent, closedAt: recent });
      await createTestTradeExecution({ userId: user.id, walletId: wallet.id, status: 'closed', symbol: 'SOLUSDT', side: 'LONG', pnl: '50', openedAt: recent, closedAt: recent });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.bestTrade).not.toBeNull();
      expect(result.bestTrade!.symbol).toBe('BTCUSDT');
      expect(result.bestTrade!.side).toBe('LONG');
      expect(result.bestTrade!.pnl).toBeCloseTo(500, 1);

      expect(result.worstTrade).not.toBeNull();
      expect(result.worstTrade!.symbol).toBe('ETHUSDT');
      expect(result.worstTrade!.side).toBe('SHORT');
      expect(result.worstTrade!.pnl).toBeCloseTo(-200, 1);
    });

    it('returns null bestTrade/worstTrade when there are no winners/losers', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'all' });

      expect(result.bestTrade).toBeNull();
      expect(result.worstTrade).toBeNull();
    });
  });

  // Day-level metrics — sit alongside trade-level. Bucketed by user-TZ
  // calendar day from `incomeEvents` (Binance ground truth).
  describe('getPerformance — day-level metrics', () => {
    const insertDailyIncome = async (
      walletId: string,
      userId: string,
      day: Date,
      pnlAmount: string,
    ) => {
      const db = getTestDatabase();
      await db.insert(incomeEvents).values({
        walletId,
        userId,
        binanceTranId: Math.floor(Math.random() * 1_000_000_000),
        incomeType: 'REALIZED_PNL',
        amount: pnlAmount,
        asset: 'USDT',
        symbol: 'BTCUSDT',
        source: 'binance',
        incomeTime: day,
      });
    };

    it('counts winning / losing / breakeven days from income events', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const day = (daysAgo: number) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12);

      // Spread events across distinct calendar days so the day buckets
      // map 1:1 to days.
      await insertDailyIncome(wallet.id, user.id, day(1), '50'); // Day -1: winner
      await insertDailyIncome(wallet.id, user.id, day(2), '-30'); // Day -2: loser
      await insertDailyIncome(wallet.id, user.id, day(3), '120'); // Day -3: winner
      // Day -4 through -6: no events → breakeven days (when 'month' window)

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      expect(result.winningDays).toBe(2);
      expect(result.losingDays).toBe(1);
      // 7 calendar days in 'week' window minus 2 winning + 1 losing = 4 breakeven
      // (could vary by 1 due to test-time-of-day rounding; allow flex)
      expect(result.breakevenDays).toBeGreaterThanOrEqual(3);
      expect(result.breakevenDays).toBeLessThanOrEqual(5);
    });

    it('computes day-level win rate as winningDays / totalDaysInRange', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const day = (daysAgo: number) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12);

      // 2 winning days out of a 7-day window = ~28.57%
      await insertDailyIncome(wallet.id, user.id, day(1), '50');
      await insertDailyIncome(wallet.id, user.id, day(3), '120');

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      expect(result.dayWinRate).toBeGreaterThan(20);
      expect(result.dayWinRate).toBeLessThan(35);
      expect(result.winningDays).toBe(2);
    });

    it('computes avgProfitPerDay as totalProfit / winningDays', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const now = new Date();
      const day = (daysAgo: number) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12);

      // 3 winning days: $100, $200, $300. avg = $200.
      // 2 losing days: -$50, -$150. avg = $100.
      await insertDailyIncome(wallet.id, user.id, day(1), '100');
      await insertDailyIncome(wallet.id, user.id, day(2), '-50');
      await insertDailyIncome(wallet.id, user.id, day(3), '200');
      await insertDailyIncome(wallet.id, user.id, day(4), '-150');
      await insertDailyIncome(wallet.id, user.id, day(5), '300');

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      expect(result.avgProfitPerDay).toBeCloseTo(200, 1);
      expect(result.avgLossPerDay).toBeCloseTo(100, 1);
    });

    it('returns zeros for day-level metrics on a wallet with no income events', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      expect(result.winningDays).toBe(0);
      expect(result.losingDays).toBe(0);
      expect(result.dayWinRate).toBe(0);
      expect(result.avgProfitPerDay).toBe(0);
      expect(result.avgLossPerDay).toBe(0);
    });

    it('combines REALIZED_PNL + COMMISSION + FUNDING_FEE into the day bucket', async () => {
      // Mirrors `getDailyIncomeSum` semantics: a day is winning/losing
      // based on the NET of all PNL_CONTRIBUTING_TYPES — so a day with
      // +$10 realized but -$15 fees nets to a losing day.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const now = new Date();
      const dayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);

      await db.insert(incomeEvents).values([
        { walletId: wallet.id, userId: user.id, binanceTranId: 9001, incomeType: 'REALIZED_PNL', amount: '10', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: dayAt },
        { walletId: wallet.id, userId: user.id, binanceTranId: 9002, incomeType: 'COMMISSION', amount: '-15', asset: 'USDT', symbol: 'BTCUSDT', source: 'binance', incomeTime: dayAt },
      ]);

      const result = await caller.analytics.getPerformance({
        walletId: wallet.id,
        period: 'week',
      });

      // Net for that day = +10 - 15 = -5 → losing day.
      expect(result.losingDays).toBe(1);
      expect(result.winningDays).toBe(0);
    });
  });
});
