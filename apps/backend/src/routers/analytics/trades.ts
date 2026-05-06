import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { incomeEvents, tradeExecutions } from '../../db/schema';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure } from '../../trpc';
import { startOfDayAgoInTz } from '../../utils/tz-bucket';

// Period → first day of the rolling window in user's TZ.
//   'day'   = today (midnight tz to now)
//   'week'  = today + 6 prior days = 7 calendar days
//   'month' = today + 29 prior days = 30 calendar days (matches
//             Binance's "30D" terminology, not strict calendar month)
//   'all'   = no filter (returned as undefined by caller)
const periodStart = (period: 'day' | 'week' | 'month', tz: string, now = new Date()): Date => {
  switch (period) {
    case 'day':
      return startOfDayAgoInTz(0, tz, now);
    case 'week':
      return startOfDayAgoInTz(6, tz, now);
    case 'month':
      return startOfDayAgoInTz(29, tz, now);
  }
};

// Ground-truth source for realized PnL, fees and funding: Binance's
// income events stream. `tradeExecutions.fees` and `.accumulated_funding`
// are derived per-trade by our own bookkeeping and have known drift
// vs. Binance's real reporting (e.g. partial-fill double-counting).
// Both `getPerformance` and `getEquityCurve` share this helper so the
// numbers shown in the Analytics modal stay internally consistent.
interface IncomeBreakdown {
  realizedPnL: number;
  fees: number;
  funding: number;
}

export const sumIncomeBreakdown = async (
  walletId: string,
  userId: string,
  from?: Date,
  to?: Date,
): Promise<IncomeBreakdown> => {
  const conditions = [
    eq(incomeEvents.walletId, walletId),
    eq(incomeEvents.userId, userId),
    sql`${incomeEvents.incomeType} IN ('REALIZED_PNL', 'COMMISSION', 'FUNDING_FEE')`,
  ];
  if (from) conditions.push(gte(incomeEvents.incomeTime, from));
  if (to) conditions.push(lte(incomeEvents.incomeTime, to));

  const rows = await db
    .select({
      incomeType: incomeEvents.incomeType,
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)`,
    })
    .from(incomeEvents)
    .where(and(...conditions))
    .groupBy(incomeEvents.incomeType);

  let realizedPnL = 0;
  let fees = 0;
  let funding = 0;
  for (const row of rows) {
    const amount = parseFloat(row.total);
    if (row.incomeType === 'REALIZED_PNL') realizedPnL = amount;
    else if (row.incomeType === 'COMMISSION') fees = amount;
    else if (row.incomeType === 'FUNDING_FEE') funding = amount;
  }
  return { realizedPnL, fees, funding };
};

export const tradeProcedures = {
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
        tz: z.string().default('UTC'),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.status, 'closed'),
      ];

      if (input.period !== 'all') {
        whereConditions.push(gte(tradeExecutions.closedAt, periodStart(input.period, input.tz)));
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

      // Per-trade summed PnL — used as the count-consistent base for
      // avgWin / avgLoss / profitFactor / largestWin/Loss / streaks below.
      // For the headline cards (netPnL, totalFees, totalFunding, grossPnL)
      // we prefer Binance income-event aggregates (see ground-truth
      // section below) because per-trade fees can drift from Binance's
      // real reporting (partial-fill double counting, etc).
      const tradePnLSum = trades.reduce((sum, t) => {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        return sum + pnl;
      }, 0);

      // Headline aggregates — pulled from `incomeEvents` so they match
      // what Binance actually charged/credited the wallet. Same TZ-aware
      // period boundary as the trade query so the two cards stay
      // aligned. Falls back to per-trade sums if the income table is
      // empty (e.g. paper wallets that never sync from Binance).
      const incomePeriodFrom =
        input.period !== 'all' ? periodStart(input.period, input.tz) : undefined;

      const incomeBreakdown = await sumIncomeBreakdown(
        input.walletId,
        ctx.user.id,
        incomePeriodFrom,
      );
      const hasIncomeEvents =
        incomeBreakdown.realizedPnL !== 0
        || incomeBreakdown.fees !== 0
        || incomeBreakdown.funding !== 0;

      // grossPnL = realized PnL before fees/funding (what Binance reports
      //            in REALIZED_PNL income events).
      // totalFees = COMMISSION events (always negative).
      // totalFunding = FUNDING_FEE events (can be either sign).
      // netPnL = grossPnL + fees + funding (what survived after costs).
      // When we don't have income events (paper wallet), reconstruct
      // approximations from per-trade fields.
      const grossPnL = hasIncomeEvents
        ? incomeBreakdown.realizedPnL
        : tradePnLSum + trades.reduce((sum, t) => sum + (t.fees ? parseFloat(t.fees) : 0), 0);
      const totalFees = hasIncomeEvents
        ? incomeBreakdown.fees
        : -trades.reduce((sum, t) => sum + (t.fees ? parseFloat(t.fees) : 0), 0);
      const totalFunding = hasIncomeEvents
        ? incomeBreakdown.funding
        : trades.reduce((sum, t) => sum + (t.accumulatedFunding ? parseFloat(t.accumulatedFunding) : 0), 0);
      const totalPnL = grossPnL + totalFees + totalFunding;

      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

      const avgWin =
        winningTrades.length > 0
          ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl ?? '0'), 0) /
            winningTrades.length
          : 0;

      const avgLoss =
        losingTrades.length > 0
          ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl ?? '0'), 0) /
            losingTrades.length
          : 0;

      const profitFactor =
        avgLoss !== 0 ? Math.abs(avgWin * winningTrades.length) / Math.abs(avgLoss * losingTrades.length) : 0;

      const wallet = await walletQueries.findByIdAndUser(input.walletId, ctx.user.id, { throwIfNotFound: false });

      const initialBalance = wallet ? parseFloat(wallet.initialBalance ?? '0') : 0;
      const walletTotalDeposits = wallet ? parseFloat(wallet.totalDeposits ?? '0') : 0;
      const walletTotalWithdrawals = wallet ? parseFloat(wallet.totalWithdrawals ?? '0') : 0;
      const effectiveCapital = initialBalance + walletTotalDeposits - walletTotalWithdrawals;

      // Total Return mirrors Net PnL across all periods so the two cards
      // never disagree in sign. Earlier we mixed sources — wallet-balance-
      // based for 'all' (includes unrealized PnL, coin swaps, anything
      // Binance counts) vs PnL-based for filtered periods — which produced
      // pairs like "Total Return -3.59% / Net PnL +$930" because the
      // wallet balance reflected open-position drawdown + coin swaps that
      // never touch realized PnL income events. By dividing the
      // income-events-based netPnL (same source as the headline card) by
      // effectiveCapital, both cards always agree.
      const totalReturn = effectiveCapital > 0
        ? (totalPnL / effectiveCapital) * 100
        : 0;

      const largestWin = winningTrades.length > 0
        ? Math.max(...winningTrades.map((t) => parseFloat(t.pnl ?? '0')))
        : 0;

      const largestLoss = losingTrades.length > 0
        ? Math.min(...losingTrades.map((t) => parseFloat(t.pnl ?? '0')))
        : 0;

      let maxDrawdown = 0;
      let peak = effectiveCapital;
      let runningBalance = effectiveCapital;

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

      const netPnL = totalPnL;

      // Trades sorted by close time — needed for streaks (consecutive
      // wins/losses) and for "first trade closed before all the others"
      // semantics on best/worst-by-time. Filter rejects trades with no
      // closedAt because they shouldn't be in the closed bucket but
      // defensive against orphan rows.
      const closedSorted = trades
        .filter((t) => t.closedAt)
        .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

      let longestWinStreak = 0;
      let longestLossStreak = 0;
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let durationSumMs = 0;
      let durationSampleCount = 0;
      for (const t of closedSorted) {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        if (pnl > 0) {
          currentWinStreak++;
          currentLossStreak = 0;
          if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
        } else if (pnl < 0) {
          currentLossStreak++;
          currentWinStreak = 0;
          if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
        } else {
          currentWinStreak = 0;
          currentLossStreak = 0;
        }
        if (t.openedAt && t.closedAt) {
          const ms = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
          if (ms > 0) {
            durationSumMs += ms;
            durationSampleCount++;
          }
        }
      }
      const avgTradeDurationHours = durationSampleCount > 0
        ? durationSumMs / durationSampleCount / (60 * 60 * 1000)
        : 0;

      // Long vs Short breakdown — same metric semantics as the top-level
      // panel (win rate, netPnL, avg per side) so users can answer
      // "which direction is paying me?". Returns null for a side when
      // no trades exist (renderer hides the column).
      const directionStats = (side: 'LONG' | 'SHORT') => {
        const subset = trades.filter((t) => t.side === side);
        if (subset.length === 0) return null;
        let wins = 0;
        let netPnl = 0;
        for (const t of subset) {
          const pnl = t.pnl ? parseFloat(t.pnl) : 0;
          netPnl += pnl;
          if (pnl > 0) wins++;
        }
        return {
          trades: subset.length,
          winRate: parseFloat(((wins / subset.length) * 100).toFixed(2)),
          netPnL: parseFloat(netPnl.toFixed(2)),
          avgPnL: parseFloat((netPnl / subset.length).toFixed(2)),
        };
      };

      // Per-symbol breakdown — top performers + biggest drains. Sort by
      // |netPnL| so the table surfaces "where is my money coming from
      // (or going to)". Renderer caps to top N.
      const bySymbolMap = new Map<string, { symbol: string; trades: number; wins: number; losses: number; netPnL: number }>();
      for (const t of trades) {
        const symbol = t.symbol;
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        const entry = bySymbolMap.get(symbol) ?? { symbol, trades: 0, wins: 0, losses: 0, netPnL: 0 };
        entry.trades++;
        entry.netPnL += pnl;
        if (pnl > 0) entry.wins++;
        else if (pnl < 0) entry.losses++;
        bySymbolMap.set(symbol, entry);
      }
      const bySymbol = Array.from(bySymbolMap.values())
        .map((s) => ({
          symbol: s.symbol,
          trades: s.trades,
          winRate: s.trades > 0 ? parseFloat(((s.wins / s.trades) * 100).toFixed(2)) : 0,
          netPnL: parseFloat(s.netPnL.toFixed(2)),
        }))
        .sort((a, b) => Math.abs(b.netPnL) - Math.abs(a.netPnL));

      // Best / worst trade — full row info so the renderer can show
      // symbol + side + duration + close date in a compact card.
      type BestWorstTrade = {
        id: string;
        symbol: string;
        side: string;
        pnl: number;
        pnlPercent: number;
        openedAt: string | null;
        closedAt: string | null;
        durationHours: number;
      };
      const tradeRowToCard = (t: typeof trades[number]): BestWorstTrade => {
        const pnl = t.pnl ? parseFloat(t.pnl) : 0;
        const entryPrice = t.entryPrice ? parseFloat(t.entryPrice) : 0;
        const quantity = t.quantity ? parseFloat(t.quantity) : 0;
        const notional = entryPrice * quantity;
        const ms = t.openedAt && t.closedAt
          ? new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()
          : 0;
        return {
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          pnl: parseFloat(pnl.toFixed(2)),
          pnlPercent: notional > 0 ? parseFloat(((pnl / notional) * 100).toFixed(2)) : 0,
          openedAt: t.openedAt ? new Date(t.openedAt).toISOString() : null,
          closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
          durationHours: ms > 0 ? parseFloat((ms / (60 * 60 * 1000)).toFixed(2)) : 0,
        };
      };
      let bestTrade: BestWorstTrade | null = null;
      let worstTrade: BestWorstTrade | null = null;
      if (winningTrades.length > 0) {
        const winnersSorted = [...winningTrades].sort(
          (a, b) => parseFloat(b.pnl ?? '0') - parseFloat(a.pnl ?? '0')
        );
        bestTrade = tradeRowToCard(winnersSorted[0]!);
      }
      if (losingTrades.length > 0) {
        const losersSorted = [...losingTrades].sort(
          (a, b) => parseFloat(a.pnl ?? '0') - parseFloat(b.pnl ?? '0')
        );
        worstTrade = tradeRowToCard(losersSorted[0]!);
      }

      return {
        totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),
        grossPnL: parseFloat(grossPnL.toFixed(2)),
        totalFees: parseFloat(totalFees.toFixed(2)),
        totalFunding: parseFloat(totalFunding.toFixed(2)),
        netPnL: parseFloat(netPnL.toFixed(2)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        largestWin: parseFloat(largestWin.toFixed(2)),
        largestLoss: parseFloat(largestLoss.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        effectiveCapital: parseFloat(effectiveCapital.toFixed(2)),
        totalDeposits: parseFloat(walletTotalDeposits.toFixed(2)),
        totalWithdrawals: parseFloat(walletTotalWithdrawals.toFixed(2)),
        avgTradeDurationHours: parseFloat(avgTradeDurationHours.toFixed(2)),
        longestWinStreak,
        longestLossStreak,
        long: directionStats('LONG'),
        short: directionStats('SHORT'),
        bySymbol,
        bestTrade,
        worstTrade,
      };
    }),
};
