import { and, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import { realizedPnlEvents, tradeExecutions } from '../../db/schema';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure } from '../../trpc';

export const statsProcedures = {
  getSetupStats: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        period: z.enum(['day', 'week', 'month', 'all']).default('all'),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.status, 'closed'),
      ];

      if (input.period !== 'all') {
        const now = new Date();
        const startDate = new Date();

        switch (input.period) {
          case 'day':
            startDate.setDate(now.getDate() - 1);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        }

        whereConditions.push(gte(tradeExecutions.closedAt, startDate));
      }

      const trades = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions));

      const statsBySetup = trades.reduce(
        (acc, trade) => {
          const setupType = trade.setupType || 'Unknown';

          if (!acc[setupType]) {
            acc[setupType] = {
              setupType,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              totalPnL: 0,
              avgPnL: 0,
              winRate: 0,
            };
          }

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
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.findByIdAndUser(input.walletId, ctx.user.id, { throwIfNotFound: false });
      if (!wallet) return [];

      const effectiveCapital =
        parseFloat(wallet.initialBalance || '0') +
        parseFloat(wallet.totalDeposits || '0') -
        parseFloat(wallet.totalWithdrawals || '0');

      const monthStart = new Date(input.year, input.month - 1, 1);
      const monthEnd = new Date(input.year, input.month, 1);

      const priorEvents = await ctx.db
        .select({ pnl: realizedPnlEvents.pnl })
        .from(realizedPnlEvents)
        .where(
          and(
            eq(realizedPnlEvents.walletId, input.walletId),
            eq(realizedPnlEvents.userId, ctx.user.id),
            lt(realizedPnlEvents.createdAt, monthStart),
          )
        );

      let runningBalance = effectiveCapital;
      for (const e of priorEvents) {
        runningBalance += parseFloat(e.pnl || '0');
      }

      const events = await ctx.db
        .select()
        .from(realizedPnlEvents)
        .where(
          and(
            eq(realizedPnlEvents.walletId, input.walletId),
            eq(realizedPnlEvents.userId, ctx.user.id),
            gte(realizedPnlEvents.createdAt, monthStart),
            lt(realizedPnlEvents.createdAt, monthEnd),
          )
        )
        .orderBy(realizedPnlEvents.createdAt);

      const dailyData: Record<string, {
        pnl: number;
        closedPositions: number;
        balanceAtStart: number;
        wins: number;
        losses: number;
        grossProfit: number;
        grossLoss: number;
      }> = {};

      for (const event of events) {
        const dateKey = event.createdAt.toISOString().slice(0, 10);
        if (!dailyData[dateKey]) dailyData[dateKey] = { pnl: 0, closedPositions: 0, balanceAtStart: runningBalance, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0 };
        const pnl = parseFloat(event.pnl || '0');
        dailyData[dateKey].pnl += pnl;
        if (event.eventType === 'full_close') {
          dailyData[dateKey].closedPositions++;
          if (pnl > 0) {
            dailyData[dateKey].wins++;
            dailyData[dateKey].grossProfit += pnl;
          } else if (pnl < 0) {
            dailyData[dateKey].losses++;
            dailyData[dateKey].grossLoss += Math.abs(pnl);
          }
        }
        runningBalance += pnl;
      }

      return Object.entries(dailyData).map(([date, data]) => ({
        date,
        pnl: parseFloat(data.pnl.toFixed(2)),
        pnlPercent: data.balanceAtStart > 0
          ? parseFloat(((data.pnl / data.balanceAtStart) * 100).toFixed(2))
          : 0,
        tradesCount: data.closedPositions,
        wins: data.wins,
        losses: data.losses,
        grossProfit: parseFloat(data.grossProfit.toFixed(2)),
        grossLoss: parseFloat(data.grossLoss.toFixed(2)),
      }));
    }),

  getEquityCurve: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        interval: z.enum(['1h', '1d']).default('1d'),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const events = await ctx.db
        .select()
        .from(realizedPnlEvents)
        .where(
          and(
            eq(realizedPnlEvents.walletId, input.walletId),
            eq(realizedPnlEvents.userId, ctx.user.id),
          )
        )
        .orderBy(realizedPnlEvents.createdAt);

      const initialBalance = parseFloat(wallet.initialBalance || '0');
      const curveDeposits = parseFloat(wallet.totalDeposits || '0');
      const curveWithdrawals = parseFloat(wallet.totalWithdrawals || '0');
      const effectiveCapital = initialBalance + curveDeposits - curveWithdrawals;
      let runningBalance = effectiveCapital;

      const equityPoints = [
        {
          timestamp: wallet.createdAt.toISOString(),
          balance: effectiveCapital,
          pnl: 0,
        },
      ];

      for (const event of events) {
        const pnl = parseFloat(event.pnl || '0');
        runningBalance += pnl;

        equityPoints.push({
          timestamp: event.createdAt.toISOString(),
          balance: parseFloat(runningBalance.toFixed(2)),
          pnl: parseFloat(pnl.toFixed(2)),
        });
      }

      return equityPoints;
    }),
};
