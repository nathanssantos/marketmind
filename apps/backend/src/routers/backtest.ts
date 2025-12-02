import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { and, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { klines } from '../db/schema';
import { SetupDetectionService } from '../services/setup-detection/SetupDetectionService';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

// In-memory storage for backtest results (could be moved to DB later)
const backtestResults = new Map<string, any>();

export const backtestRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        initialCapital: z.number().positive(),
        setupTypes: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional(),
        stopLossPercent: z.number().positive().optional(),
        takeProfitPercent: z.number().positive().optional(),
        maxPositionSize: z.number().min(0).max(100).optional().default(10),
        commission: z.number().min(0).max(1).optional().default(0.001), // 0.1%
      })
    )
    .mutation(async ({ input, ctx }) => {
      const backtestId = generateId(21);
      const startTime = Date.now();

      try {
        // Set initial status
        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'RUNNING',
          config: input,
          startTime: new Date().toISOString(),
        });

        // 1. Fetch historical klines
        const historicalKlines = await ctx.db
          .select()
          .from(klines)
          .where(
            and(
              eq(klines.symbol, input.symbol),
              eq(klines.interval, input.interval),
              gte(klines.openTime, new Date(input.startDate)),
              lte(klines.openTime, new Date(input.endDate))
            )
          )
          .orderBy(klines.openTime);

        if (historicalKlines.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No historical data found for the specified period',
          });
        }

        // 2. Convert klines to expected format
        const convertedKlines = historicalKlines.map((k) => ({
          openTime: k.openTime.getTime(),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          closeTime: k.openTime.getTime(), // Use openTime as approximation
          quoteVolume: k.quoteVolume || '0',
          trades: k.trades || 0,
          takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
          takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
        }));

        // 3. Detect setups in the historical data
        const setupDetectionService = new SetupDetectionService();
        const detectedSetups = setupDetectionService.detectSetups(convertedKlines);

        // Filter by setup types if specified
        const filteredSetups = input.setupTypes?.length
          ? detectedSetups.filter((s: any) => input.setupTypes!.includes(s.setupType))
          : detectedSetups;

        // Filter by minimum confidence if specified
        const tradableSetups = input.minConfidence
          ? filteredSetups.filter((s: any) => s.confidence >= input.minConfidence!)
          : filteredSetups;

        // 3. Simulate trading based on setups
        const trades: any[] = [];
        let equity = input.initialCapital;
        let peakEquity = input.initialCapital;
        let maxDrawdown = 0;
        const equityCurve: any[] = [
          {
            time: input.startDate,
            equity: input.initialCapital,
            drawdown: 0,
            drawdownPercent: 0,
          },
        ];

        const klineMap = new Map(
          historicalKlines.map((k) => [k.openTime.getTime(), k])
        );

        // Sort setups by openTime
        const sortedSetups = tradableSetups.sort(
          (a: any, b: any) => a.openTime - b.openTime
        );

        for (const setup of sortedSetups) {
          const entryTime = new Date(setup.openTime);
          const entryKline = klineMap.get(entryTime.getTime());

          if (!entryKline) continue;

          const entryPrice = parseFloat(entryKline.close);
          const positionSize = (equity * (input.maxPositionSize / 100)) / entryPrice;
          const positionValue = positionSize * entryPrice;

          // Calculate SL/TP
          const stopLoss = input.stopLossPercent
            ? setup.direction === 'LONG'
              ? entryPrice * (1 - input.stopLossPercent / 100)
              : entryPrice * (1 + input.stopLossPercent / 100)
            : undefined;

          const takeProfit = input.takeProfitPercent
            ? setup.direction === 'LONG'
              ? entryPrice * (1 + input.takeProfitPercent / 100)
              : entryPrice * (1 - input.takeProfitPercent / 100)
            : undefined;

          // Find exit
          let exitPrice: number | undefined;
          let exitTime: string | undefined;
          let exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_PERIOD' | undefined;

          const futureKlines = historicalKlines.filter(
            (k) => k.openTime.getTime() > entryTime.getTime()
          );

          for (const futureKline of futureKlines) {
            const high = parseFloat(futureKline.high);
            const low = parseFloat(futureKline.low);

            // Check stop loss
            if (stopLoss) {
              if (
                (setup.direction === 'LONG' && low <= stopLoss) ||
                (setup.direction === 'SHORT' && high >= stopLoss)
              ) {
                exitPrice = stopLoss;
                exitTime = futureKline.openTime.toISOString();
                exitReason = 'STOP_LOSS';
                break;
              }
            }

            // Check take profit
            if (takeProfit) {
              if (
                (setup.direction === 'LONG' && high >= takeProfit) ||
                (setup.direction === 'SHORT' && low <= takeProfit)
              ) {
                exitPrice = takeProfit;
                exitTime = futureKline.openTime.toISOString();
                exitReason = 'TAKE_PROFIT';
                break;
              }
            }
          }

          // If no exit found, close at end of period
          if (!exitPrice) {
            const lastKline = historicalKlines[historicalKlines.length - 1];
            exitPrice = parseFloat(lastKline!.close);
            exitTime = lastKline!.openTime.toISOString();
            exitReason = 'END_OF_PERIOD';
          }

          // Calculate PnL
          const priceDiff =
            setup.direction === 'LONG'
              ? exitPrice - entryPrice
              : entryPrice - exitPrice;

          const pnl = priceDiff * positionSize;
          const commission = positionValue * input.commission * 2; // Entry + Exit
          const netPnl = pnl - commission;
          const pnlPercent = (netPnl / positionValue) * 100;

          // Update equity
          equity += netPnl;

          // Track drawdown
          if (equity > peakEquity) {
            peakEquity = equity;
          }
          const currentDrawdown = peakEquity - equity;
          const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

          if (currentDrawdown > maxDrawdown) {
            maxDrawdown = currentDrawdown;
          }

          // Record trade
          const trade = {
            id: generateId(16),
            setupId: setup.id,
            setupType: setup.type,
            setupConfidence: setup.confidence,
            entryTime: new Date(setup.openTime).toISOString(),
            entryPrice,
            exitTime,
            exitPrice,
            side: setup.direction,
            quantity: positionSize,
            stopLoss,
            takeProfit,
            pnl,
            pnlPercent,
            commission,
            netPnl,
            exitReason,
            status: 'CLOSED' as const,
          };

          trades.push(trade);

          // Update equity curve
          if (exitTime) {
            equityCurve.push({
              time: exitTime,
              equity,
              drawdown: currentDrawdown,
              drawdownPercent: currentDrawdownPercent,
            });
          }
        }

        // 4. Calculate metrics
        const winningTrades = trades.filter((t) => (t.netPnl ?? 0) > 0);
        const losingTrades = trades.filter((t) => (t.netPnl ?? 0) < 0);

        const totalPnl = trades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
        const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

        const totalWins = winningTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
        const totalLosses = Math.abs(
          losingTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0)
        );

        const metrics = {
          totalTrades: trades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,

          totalPnl,
          totalPnlPercent: (totalPnl / input.initialCapital) * 100,
          avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
          avgPnlPercent:
            trades.length > 0
              ? trades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / trades.length
              : 0,

          avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
          avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
          largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.netPnl ?? 0)) : 0,
          largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.netPnl ?? 0)) : 0,
          profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,

          maxDrawdown,
          maxDrawdownPercent: (maxDrawdown / peakEquity) * 100,

          totalCommission,

          avgTradeDuration: 0, // TODO: Calculate
          avgWinDuration: 0,
          avgLossDuration: 0,
          sharpeRatio: 0,
        };

        // 5. Calculate Sharpe Ratio (simplified)
        if (trades.length > 1) {
          const returns = trades.map((t) => t.pnlPercent ?? 0);
          const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const variance =
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            (returns.length - 1);
          const stdDev = Math.sqrt(variance);
          metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          id: backtestId,
          config: input,
          trades,
          metrics,
          equityCurve,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration,
          status: 'COMPLETED' as const,
        };

        // Store result
        backtestResults.set(backtestId, result);

        return result;
      } catch (error) {
        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          config: input,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Backtest failed',
          cause: error,
        });
      }
    }),

  getResult: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = backtestResults.get(input.id);

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return result;
    }),

  list: protectedProcedure.query(async () => {
    const results = Array.from(backtestResults.values())
      .map((result) => ({
        id: result.id,
        symbol: result.config.symbol,
        interval: result.config.interval,
        startDate: result.config.startDate,
        endDate: result.config.endDate,
        initialCapital: result.config.initialCapital,
        finalEquity: result.metrics?.totalPnl
          ? result.config.initialCapital + result.metrics.totalPnl
          : result.config.initialCapital,
        totalPnl: result.metrics?.totalPnl ?? 0,
        totalPnlPercent: result.metrics?.totalPnlPercent ?? 0,
        winRate: result.metrics?.winRate ?? 0,
        totalTrades: result.metrics?.totalTrades ?? 0,
        maxDrawdown: result.metrics?.maxDrawdown ?? 0,
        sharpeRatio: result.metrics?.sharpeRatio,
        createdAt: result.startTime,
        status: result.status,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results;
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const deleted = backtestResults.delete(input.id);

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return { success: true };
    }),
});
