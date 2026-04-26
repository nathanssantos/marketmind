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

    it('should keep netPnL = sum(trade.pnl) so W × avgWin + L × avgLoss matches', async () => {
      // Regression for the W/L count vs netPnL desync: the previous
      // implementation overrode netPnL with `getDailyIncomeSum` whenever a
      // period was selected, mixing two data sources and breaking the math
      // users expect (W × avgWin + L × avgLoss == netPnL).
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

      // Stuff a stray Binance income event into the period — under the old
      // implementation this would have polluted netPnL and broken the math.
      const db = getTestDatabase();
      await db.insert(incomeEvents).values({
        userId: user.id,
        walletId: wallet.id,
        binanceTranId: Date.now(),
        incomeType: 'FUNDING_FEE',
        amount: '999',
        asset: 'USDT',
        symbol: 'BTCUSDT',
        incomeTime: recent,
        source: 'binance',
      });

      const result = await caller.analytics.getPerformance({ walletId: wallet.id, period: 'day' });

      const expectedNet = result.winningTrades * result.avgWin + result.losingTrades * result.avgLoss;
      expect(result.netPnL).toBeCloseTo(expectedNet, 1);

      // The stray FUNDING_FEE row must NOT bleed into netPnL.
      expect(result.netPnL).toBeCloseTo(250, 0);
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

    it('prefers incomeEvents over trade pnl when both are populated', async () => {
      // Once the income sync runs, incomeEvents includes funding +
      // commissions that trade.pnl alone misses. We must surface that.
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const today = new Date();
      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
        pnl: '100',
        openedAt: today,
        closedAt: today,
      });

      // Simulate income sync — REALIZED_PNL + FUNDING_FEE deltas for today.
      await db.insert(incomeEvents).values([
        {
          userId: user.id,
          walletId: wallet.id,
          binanceTranId: 1,
          incomeType: 'REALIZED_PNL',
          amount: '100',
          asset: 'USDT',
          symbol: 'BTCUSDT',
          incomeTime: today,
          source: 'binance',
        },
        {
          userId: user.id,
          walletId: wallet.id,
          binanceTranId: 2,
          incomeType: 'FUNDING_FEE',
          amount: '5',
          asset: 'USDT',
          symbol: 'BTCUSDT',
          incomeTime: today,
          source: 'binance',
        },
      ]);

      const result = await caller.analytics.getDailyPerformance({
        walletId: wallet.id,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      });

      const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayKey = fmt.format(today);
      const todayBucket = result.find((d) => d.date === todayKey);
      // Income sum = 100 + 5 = 105 — preferred over the bare trade.pnl=100.
      expect(todayBucket?.pnl).toBeCloseTo(105, 0);
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
  });
});
