import type { Interval, BacktestConfig } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { BacktestEngine } from '../services/backtesting/BacktestEngine';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

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
        minProfitPercent: z.number().min(0).optional(),
        setupTypes: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional(),
        onlyWithTrend: z.boolean().optional().default(true),
        useAlgorithmicLevels: z.boolean().optional().default(false),
        stopLossPercent: z.number().positive().optional(),
        takeProfitPercent: z.number().positive().optional(),
        maxPositionSize: z.number().min(0).max(100).optional().default(10),
        commission: z.number().min(0).max(1).optional().default(0.001), // 0.1%
        useStochasticFilter: z.boolean().optional().default(false),
        useAdxFilter: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const backtestId = generateId(21);
      const startTime = Date.now();

      try {
        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'RUNNING',
          config: input,
          startTime: new Date().toISOString(),
        });

        console.log('[Backtest] Starting backtest', backtestId, 'for', input.symbol, input.interval);
        console.log('[Backtest] Date range:', input.startDate, 'to', input.endDate);

        const config: BacktestConfig = {
          symbol: input.symbol,
          interval: input.interval as Interval,
          startDate: input.startDate,
          endDate: input.endDate,
          initialCapital: input.initialCapital,
          setupTypes: input.setupTypes || [
            'setup91', 'setup92', 'setup93', 'setup94', 'pattern123',
            'bullTrap', 'bearTrap', 'breakoutRetest'
          ],
          minConfidence: input.minConfidence,
          onlyWithTrend: input.onlyWithTrend,
          useAlgorithmicLevels: input.useAlgorithmicLevels,
          stopLossPercent: input.stopLossPercent,
          takeProfitPercent: input.takeProfitPercent,
          maxPositionSize: input.maxPositionSize,
          commission: input.commission,
          useStochasticFilter: input.useStochasticFilter,
          useAdxFilter: input.useAdxFilter,
        };

        const engine = new BacktestEngine();
        const result = await engine.run(config);

        backtestResults.set(backtestId, {
          ...result,
          id: backtestId,
          status: 'COMPLETED',
          config: input,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
        });

        console.log('[Backtest] Completed successfully');
        console.log('[Backtest] Results:', {
          trades: result.trades.length,
          winRate: `${result.metrics.winRate.toFixed(2)}%`,
          totalPnl: `${result.metrics.totalPnl.toFixed(2)} USDT (${result.metrics.totalPnlPercent.toFixed(2)}%)`,
          finalEquity: `${(input.initialCapital + result.metrics.totalPnl).toFixed(2)} USDT`,
          maxDrawdown: `${result.metrics.maxDrawdown.toFixed(2)} USDT (${result.metrics.maxDrawdownPercent.toFixed(2)}%)`,
          profitFactor: result.metrics.profitFactor.toFixed(2),
        });

        return backtestResults.get(backtestId);
      } catch (error) {
        console.error('[Backtest] Error:', error);

        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'FAILED',
          config: input,
          error: error instanceof Error ? error.message : 'Unknown error',
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Backtest failed',
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
