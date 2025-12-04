import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { tradeExecutions, wallets } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

export const analyticsRouter = router({
  getTradeHistory: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
      ];

      if (input.status) {
        whereConditions.push(eq(tradeExecutions.status, input.status));
      }

      if (input.startDate) {
        whereConditions.push(gte(tradeExecutions.openedAt, new Date(input.startDate)));
      }

      if (input.endDate) {
        whereConditions.push(
          sql`${tradeExecutions.openedAt} <= ${new Date(input.endDate)}`
        );
      }

      const trades = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(tradeExecutions)
        .where(and(...whereConditions));

      return {
        trades,
        total: Number(countResult?.count ?? 0),
        limit: input.limit,
        offset: input.offset,
      };
    }),

  getPerformance: protectedProcedure
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
        let startDate = new Date();

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

      const totalTrades = trades.length;
      const winningTrades = trades.filter((t) => {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        return pnl > 0;
      });
      const losingTrades = trades.filter((t) => {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        return pnl < 0;
      });

      const totalPnL = trades.reduce((sum, t) => {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        return sum + pnl;
      }, 0);

      const totalFees = trades.reduce((sum, t) => {
        const fees = t.fees ? parseFloat(t.fees) : 0;
        return sum + fees;
      }, 0);

      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

      const avgWin =
        winningTrades.length > 0
          ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0) /
            winningTrades.length
          : 0;

      const avgLoss =
        losingTrades.length > 0
          ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0) /
            losingTrades.length
          : 0;

      const profitFactor =
        avgLoss !== 0 ? Math.abs(avgWin * winningTrades.length) / Math.abs(avgLoss * losingTrades.length) : 0;

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(eq(wallets.id, input.walletId))
        .limit(1);

      const initialBalance = wallet ? parseFloat(wallet.initialBalance || '0') : 0;
      const currentBalance = wallet ? parseFloat(wallet.currentBalance || '0') : 0;
      const totalReturn =
        initialBalance > 0 ? ((currentBalance - initialBalance) / initialBalance) * 100 : 0;

      const largestWin = winningTrades.length > 0
        ? Math.max(...winningTrades.map((t) => parseFloat(t.pnl || '0')))
        : 0;

      const largestLoss = losingTrades.length > 0
        ? Math.min(...losingTrades.map((t) => parseFloat(t.pnl || '0')))
        : 0;

      let maxDrawdown = 0;
      let peak = initialBalance;
      let runningBalance = initialBalance;

      for (const trade of trades.sort(
        (a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime()
      )) {
        const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
        runningBalance += pnl;

        if (runningBalance > peak) {
          peak = runningBalance;
        }

        const drawdown = peak > 0 ? ((peak - runningBalance) / peak) * 100 : 0;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      return {
        totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        totalFees: parseFloat(totalFees.toFixed(2)),
        netPnL: parseFloat((totalPnL - totalFees).toFixed(2)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        largestWin: parseFloat(largestWin.toFixed(2)),
        largestLoss: parseFloat(largestLoss.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      };
    }),

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
        let startDate = new Date();

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

  getEquityCurve: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        interval: z.enum(['1h', '1d']).default('1d'),
      })
    )
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(
          and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id))
        )
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const trades = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.status, 'closed')
          )
        )
        .orderBy(tradeExecutions.closedAt);

      const initialBalance = parseFloat(wallet.initialBalance || '0');
      let runningBalance = initialBalance;

      const equityPoints = [
        {
          timestamp: wallet.createdAt.toISOString(),
          balance: initialBalance,
          pnl: 0,
        },
      ];

      for (const trade of trades) {
        if (!trade.closedAt) continue;

        const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
        runningBalance += pnl;

        equityPoints.push({
          timestamp: trade.closedAt.toISOString(),
          balance: parseFloat(runningBalance.toFixed(2)),
          pnl: parseFloat(pnl.toFixed(2)),
        });
      }

      return equityPoints;
    }),
});
