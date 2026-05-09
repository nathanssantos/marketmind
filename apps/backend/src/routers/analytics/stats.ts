import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { tradeExecutions } from '../../db/schema';
import {
  getDailyIncomeSum,
  getEquityCurvePoints,
} from '../../services/income-events';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure } from '../../trpc';
import type { IncomeType } from '../../constants/income-types';
import { startOfDayAgoInTz } from '../../utils/tz-bucket';

// Mirrors trades.ts — keep the period semantics in sync across procedures.
const setupPeriodStart = (period: 'day' | 'week' | 'month', tz: string, now = new Date()): Date => {
  switch (period) {
    case 'day':
      return startOfDayAgoInTz(0, tz, now);
    case 'week':
      return startOfDayAgoInTz(6, tz, now);
    case 'month':
      return startOfDayAgoInTz(29, tz, now);
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Equity-curve incidence types: realized PnL, fees (commission), funding,
// and capital movements (deposit/withdraw). Renderer plots each as a
// separate cumulative series so the user can see whether equity is
// drifting from PnL itself or from fees/funding/transfers.
const EQUITY_CURVE_TYPES: readonly IncomeType[] = [
  'REALIZED_PNL',
  'COMMISSION',
  'FUNDING_FEE',
  'TRANSFER',
];

export const statsProcedures = {
  getSetupStats: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        period: z.enum(['day', 'week', 'month', 'all']).default('all'),
        tz: z.string().default('UTC'),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.status, 'closed'),
        // Same orphan filter as getDailyPerformance — see comment there.
        isNotNull(tradeExecutions.exitPrice),
      ];

      if (input.period !== 'all') {
        whereConditions.push(gte(tradeExecutions.closedAt, setupPeriodStart(input.period, input.tz)));
      }

      const trades = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions));

      const statsBySetup = trades.reduce(
        (acc, trade) => {
          const setupType = trade.setupType ?? 'Unknown';

          acc[setupType] ??= {
            setupType,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            avgPnL: 0,
            winRate: 0,
          };

          const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;

          acc[setupType].totalTrades++;
          acc[setupType].totalPnL += pnl;

          if (pnl > 0) {
            acc[setupType].winningTrades++;
          } else if (pnl < 0) {
            acc[setupType].losingTrades++;
          }

          return acc;
        },
        {} as Record<
          string,
          {
            setupType: string;
            totalTrades: number;
            winningTrades: number;
            losingTrades: number;
            totalPnL: number;
            avgPnL: number;
            winRate: number;
          }
        >
      );

      const setupStats = Object.values(statsBySetup).map((stats) => ({
        ...stats,
        avgPnL: parseFloat((stats.totalPnL / stats.totalTrades).toFixed(2)),
        winRate: parseFloat(
          ((stats.winningTrades / stats.totalTrades) * 100).toFixed(2)
        ),
        totalPnL: parseFloat(stats.totalPnL.toFixed(2)),
      }));

      return setupStats.sort((a, b) => b.totalPnL - a.totalPnL);
    }),

  getDailyPerformance: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        tz: z.string().default('UTC'),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.findByIdAndUser(input.walletId, ctx.user.id, { throwIfNotFound: false });
      if (!wallet) return [];

      const effectiveCapital =
        parseFloat(wallet.initialBalance ?? '0') +
        parseFloat(wallet.totalDeposits ?? '0') -
        parseFloat(wallet.totalWithdrawals ?? '0');

      // Use Date.UTC instead of `new Date(y, m, 1)` so the month
      // boundaries are explicit UTC midnights regardless of the server's
      // local TZ. Frontend always passes the UTC year/month + tz='UTC'
      // to align with Binance's daily reset (00:00 UTC).
      const monthStart = new Date(Date.UTC(input.year, input.month - 1, 1));
      const monthEnd = new Date(Date.UTC(input.year, input.month, 1));

      const priorDailySum = await getDailyIncomeSum({
        walletId: input.walletId,
        userId: ctx.user.id,
        from: new Date(0),
        to: monthStart,
        tz: input.tz,
      });
      let runningBalance = effectiveCapital;
      for (const v of priorDailySum.values()) runningBalance += v;

      const monthDailySum = await getDailyIncomeSum({
        walletId: input.walletId,
        userId: ctx.user.id,
        from: monthStart,
        to: monthEnd,
        tz: input.tz,
      });

      // exit_price IS NOT NULL filters out corruptible execs:
      // position-sync orphans book themselves as closed with
      // exit_reason='SYNC_INCOMPLETE' / exit_price=null when Binance
      // trades aren't yet visible. Including them here would surface
      // their pre-fix phantom pnl values in the daily widget.
      const monthClosedTrades = await ctx.db
        .select({
          closedAt: tradeExecutions.closedAt,
          pnl: tradeExecutions.pnl,
        })
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'closed'),
            isNotNull(tradeExecutions.exitPrice),
            gte(tradeExecutions.closedAt, monthStart),
            lt(tradeExecutions.closedAt, monthEnd),
          ),
        );

      const tradeStatsByDay = new Map<string, { wins: number; losses: number; closedPositions: number; grossProfit: number; grossLoss: number }>();
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: input.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      for (const t of monthClosedTrades) {
        if (!t.closedAt) continue;
        const dateKey = fmt.format(t.closedAt);
        const stats = tradeStatsByDay.get(dateKey) ?? { wins: 0, losses: 0, closedPositions: 0, grossProfit: 0, grossLoss: 0 };
        stats.closedPositions++;
        const pnl = parseFloat(t.pnl ?? '0');
        if (pnl > 0) { stats.wins++; stats.grossProfit += pnl; }
        else if (pnl < 0) { stats.losses++; stats.grossLoss += Math.abs(pnl); }
        tradeStatsByDay.set(dateKey, stats);
      }

      const days = new Set<string>([...monthDailySum.keys(), ...tradeStatsByDay.keys()]);
      const sortedDays = Array.from(days).sort();

      const results: Array<{
        date: string;
        pnl: number;
        pnlPercent: number;
        tradesCount: number;
        wins: number;
        losses: number;
        grossProfit: number;
        grossLoss: number;
      }> = [];

      let balanceAtStart = runningBalance;
      for (const date of sortedDays) {
        const incomeSum = monthDailySum.get(date) ?? 0;
        const stats = tradeStatsByDay.get(date) ?? { wins: 0, losses: 0, closedPositions: 0, grossProfit: 0, grossLoss: 0 };

        // Daily PnL source resolution:
        //   - `incomeSum` = REALIZED_PNL + COMMISSION + FUNDING_FEE from
        //     Binance's income ledger. Authoritative — matches what
        //     Binance shows in its "Today's Realized PnL" widget exactly,
        //     INCLUDING funding deltas and fees that aren't captured in
        //     the per-trade `pnl` field.
        //   - `tradeRealizedNet` = sum of `tradeExecutions.pnl` for
        //     cleanly-closed trades today. Misses funding accrued during
        //     a position's lifetime (stored in `accumulated_funding` but
        //     not folded into `pnl`) and any post-close fee adjustments.
        //   - Execs with NULL `exit_price` are filtered upstream — they
        //     are position-sync orphans (`exit_reason='SYNC_INCOMPLETE'`)
        //     whose pnl was historically miscomputed against exit_price=0
        //     (incident 2026-05-08T17:09).
        //   - Rule: prefer `incomeSum` whenever Binance has reported any
        //     income event today — that's the authoritative value the
        //     user wants to see (and the one Binance UI shows). Fall
        //     back to `tradeRealizedNet` ONLY when income hasn't synced
        //     yet (incomeSum === 0 but trades were closed locally) so
        //     the widget updates immediately on close instead of waiting
        //     for the next income sync tick. Past concern about reverse-
        //     roll phantoms over-counting incomeSum no longer applies —
        //     that bug is fixed and Binance's ledger is canonical.
        const tradeRealizedNet = stats.grossProfit - stats.grossLoss;
        const dailyPnl = incomeSum !== 0 ? incomeSum : tradeRealizedNet;

        results.push({
          date,
          pnl: parseFloat(dailyPnl.toFixed(2)),
          pnlPercent: balanceAtStart > 0
            ? parseFloat(((dailyPnl / balanceAtStart) * 100).toFixed(2))
            : 0,
          tradesCount: stats.closedPositions,
          wins: stats.wins,
          losses: stats.losses,
          grossProfit: parseFloat(stats.grossProfit.toFixed(2)),
          grossLoss: parseFloat(stats.grossLoss.toFixed(2)),
        });

        balanceAtStart += dailyPnl;
      }

      return results;
    }),

  getEquityCurve: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        interval: z.enum(['1h', '1d']).default('1d'),
        tz: z.string().default('UTC'),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const initialBalance = parseFloat(wallet.initialBalance ?? '0');

      // Query all 4 incidence types in a single pass so we can build
      // separate cumulative series for the chart (PnL / fees / funding /
      // net transfers) without round-tripping the DB four times.
      const points = await getEquityCurvePoints({
        walletId: input.walletId,
        userId: ctx.user.id,
        from: wallet.createdAt,
        to: new Date(Date.now() + DAY_MS),
        tz: input.tz,
        types: EQUITY_CURVE_TYPES,
      });

      // Seed at `initialBalance` (the seed deposit when the wallet was
      // created, before any post-creation transfers/trades). Each
      // TRANSFER event in the loop below then adds the historical
      // deposit/withdrawal as it actually occurred, which makes the
      // breakeven line `initialBalance + cumulativeNetTransfers(t)`
      // step up/down in lockstep with the real capital movements.
      //
      // Earlier we seeded at `effectiveCapital` (initialBalance +
      // totalDeposits - totalWithdrawals from wallet meta), which
      // already bakes in *all* historical transfers. Adding the same
      // TRANSFER events again on top double-counted deposits, inflating
      // the equity line by `totalDeposits` and producing a "real
      // profit" that included both the trading gains AND the deposits.
      const equityPoints: Array<{
        timestamp: string;
        balance: number;
        pnl: number;
        cumulativePnl: number;
        cumulativeFees: number;
        cumulativeFunding: number;
        cumulativeNetTransfers: number;
      }> = [
        {
          timestamp: wallet.createdAt.toISOString(),
          balance: initialBalance,
          pnl: 0,
          cumulativePnl: 0,
          cumulativeFees: 0,
          cumulativeFunding: 0,
          cumulativeNetTransfers: 0,
        },
      ];

      let runningBalance = initialBalance;
      let runningPnl = 0;
      let runningFees = 0;
      let runningFunding = 0;
      let runningTransfers = 0;
      for (const point of points) {
        runningBalance += point.delta;
        if (point.incomeType === 'REALIZED_PNL') runningPnl += point.delta;
        else if (point.incomeType === 'COMMISSION') runningFees += point.delta;
        else if (point.incomeType === 'FUNDING_FEE') runningFunding += point.delta;
        else if (point.incomeType === 'TRANSFER') runningTransfers += point.delta;
        equityPoints.push({
          timestamp: new Date(point.time).toISOString(),
          balance: parseFloat(runningBalance.toFixed(2)),
          pnl: parseFloat(point.delta.toFixed(2)),
          cumulativePnl: parseFloat(runningPnl.toFixed(2)),
          cumulativeFees: parseFloat(runningFees.toFixed(2)),
          cumulativeFunding: parseFloat(runningFunding.toFixed(2)),
          cumulativeNetTransfers: parseFloat(runningTransfers.toFixed(2)),
        });
      }

      return equityPoints;
    }),
};
