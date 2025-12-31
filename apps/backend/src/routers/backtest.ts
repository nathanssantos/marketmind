import type { Interval, BacktestConfig } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { BacktestEngine } from '../services/backtesting/BacktestEngine';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

const MAX_CACHE_SIZE = 100;
const backtestResults = new Map<string, { createdAt: number; data: unknown }>();

const evictOldestIfNeeded = () => {
  if (backtestResults.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of backtestResults.entries()) {
      if (value.createdAt < oldestTime) {
        oldestTime = value.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) backtestResults.delete(oldestKey);
  }
};

const setCacheEntry = (id: string, data: unknown) => {
  evictOldestIfNeeded();
  backtestResults.set(id, { createdAt: Date.now(), data });
};

const getCacheEntry = (id: string): unknown | undefined => {
  const entry = backtestResults.get(id);
  return entry?.data;
};

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
        commission: z.number().min(0).max(1).optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).optional().default('SPOT'),
        useBnbDiscount: z.boolean().optional().default(false),
        useStochasticFilter: z.boolean().optional().default(false),
        useAdxFilter: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const backtestId = generateEntityId();
      const startTime = Date.now();

      try {
        setCacheEntry(backtestId, {
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
          marketType: input.marketType,
          useBnbDiscount: input.useBnbDiscount,
          useStochasticFilter: input.useStochasticFilter,
          useAdxFilter: input.useAdxFilter,
        };

        const engine = new BacktestEngine();
        const result = await engine.run(config);

        setCacheEntry(backtestId, {
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

        return getCacheEntry(backtestId);
      } catch (error) {
        console.error('[Backtest] Error:', error);

        setCacheEntry(backtestId, {
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
      const result = getCacheEntry(input.id);

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
      .map((entry) => {
        const result = entry.data as Record<string, unknown>;
        const config = result.config as Record<string, unknown>;
        const metrics = result.metrics as Record<string, number> | undefined;
        return {
          id: result.id,
          symbol: config.symbol,
          interval: config.interval,
          startDate: config.startDate,
          endDate: config.endDate,
          initialCapital: config.initialCapital as number,
          finalEquity: metrics?.totalPnl
            ? (config.initialCapital as number) + metrics.totalPnl
            : config.initialCapital,
          totalPnl: metrics?.totalPnl ?? 0,
          totalPnlPercent: metrics?.totalPnlPercent ?? 0,
          winRate: metrics?.winRate ?? 0,
          totalTrades: metrics?.totalTrades ?? 0,
          maxDrawdown: metrics?.maxDrawdown ?? 0,
          sharpeRatio: metrics?.sharpeRatio,
          createdAt: result.startTime as string,
          status: result.status,
        };
      })
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
