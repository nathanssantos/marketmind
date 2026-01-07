import type { Interval, BacktestConfig, BacktestResult, MultiWatcherBacktestResult } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { BacktestEngine } from '../services/backtesting/BacktestEngine';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import { loadMultiWatcherConfigFromAutoTrading, buildMultiWatcherConfigFromWatchers } from '../services/backtesting/configLoader';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

type CachedBacktestResult = Partial<BacktestResult> & { id: string; status: BacktestResult['status'] };
type CachedMultiWatcherResult = Partial<MultiWatcherBacktestResult> & { id: string; status: BacktestResult['status'] };

const MAX_CACHE_SIZE = 100;
const backtestResults = new Map<string, { createdAt: number; data: CachedBacktestResult }>();
const multiWatcherResults = new Map<string, { createdAt: number; data: CachedMultiWatcherResult }>();

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

const setCacheEntry = (id: string, data: CachedBacktestResult) => {
  evictOldestIfNeeded();
  backtestResults.set(id, { createdAt: Date.now(), data });
};

const getCacheEntry = (id: string): CachedBacktestResult | undefined => {
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

        logger.info({
          backtestId,
          symbol: input.symbol,
          interval: input.interval,
          startDate: input.startDate,
          endDate: input.endDate,
        }, 'Starting backtest');

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

        logger.info({
          backtestId,
          trades: result.trades.length,
          winRate: result.metrics.winRate,
          totalPnl: result.metrics.totalPnl,
          totalPnlPercent: result.metrics.totalPnlPercent,
          finalEquity: input.initialCapital + result.metrics.totalPnl,
          maxDrawdown: result.metrics.maxDrawdown,
          maxDrawdownPercent: result.metrics.maxDrawdownPercent,
          profitFactor: result.metrics.profitFactor,
        }, 'Backtest completed successfully');

        return getCacheEntry(backtestId);
      } catch (error) {
        logger.error({
          backtestId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }, 'Backtest failed');

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
        const result = entry.data;
        const config = result.config;
        const metrics = result.metrics;
        return {
          id: result.id,
          symbol: config?.symbol ?? '',
          interval: config?.interval ?? '',
          startDate: config?.startDate ?? '',
          endDate: config?.endDate ?? '',
          initialCapital: config?.initialCapital ?? 0,
          finalEquity: metrics?.totalPnl
            ? (config?.initialCapital ?? 0) + metrics.totalPnl
            : (config?.initialCapital ?? 0),
          totalPnl: metrics?.totalPnl ?? 0,
          totalPnlPercent: metrics?.totalPnlPercent ?? 0,
          winRate: metrics?.winRate ?? 0,
          totalTrades: metrics?.totalTrades ?? 0,
          maxDrawdown: metrics?.maxDrawdown ?? 0,
          sharpeRatio: metrics?.sharpeRatio,
          createdAt: result.startTime ?? '',
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

  multiWatcher: protectedProcedure
    .input(
      z.object({
        walletId: z.string().optional(),
        watchers: z
          .array(
            z.object({
              symbol: z.string(),
              interval: z.string(),
              setupTypes: z.array(z.string()).optional(),
              marketType: z.enum(['SPOT', 'FUTURES']).optional(),
              profileId: z.string().optional(),
            })
          )
          .optional(),
        startDate: z.string(),
        endDate: z.string(),
        initialCapital: z.number().positive().default(10000),
        exposureMultiplier: z.number().min(0.1).max(10).optional(),
        maxPositionSize: z.number().min(0).max(100).optional(),
        dailyLossLimit: z.number().min(0).max(100).optional(),
        useStochasticFilter: z.boolean().optional(),
        useAdxFilter: z.boolean().optional(),
        onlyWithTrend: z.boolean().optional(),
        minRiskRewardRatio: z.number().min(0).optional(),
        cooldownMinutes: z.number().min(0).optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).optional(),
        leverage: z.number().min(1).max(125).optional(),
        tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const backtestId = generateEntityId();

      try {
        let config;

        if (input.walletId) {
          config = await loadMultiWatcherConfigFromAutoTrading(input.walletId, {
            startDate: input.startDate,
            endDate: input.endDate,
            initialCapital: input.initialCapital,
          });
        } else if (input.watchers && input.watchers.length > 0) {
          config = buildMultiWatcherConfigFromWatchers(input.watchers, {
            startDate: input.startDate,
            endDate: input.endDate,
            initialCapital: input.initialCapital,
            exposureMultiplier: input.exposureMultiplier,
            maxPositionSize: input.maxPositionSize,
            dailyLossLimit: input.dailyLossLimit,
            useStochasticFilter: input.useStochasticFilter,
            useAdxFilter: input.useAdxFilter,
            onlyWithTrend: input.onlyWithTrend,
            minRiskRewardRatio: input.minRiskRewardRatio,
            cooldownMinutes: input.cooldownMinutes,
            marketType: input.marketType,
            leverage: input.leverage,
            tpCalculationMode: input.tpCalculationMode,
          });
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either walletId or watchers must be provided',
          });
        }

        multiWatcherResults.set(backtestId, {
          createdAt: Date.now(),
          data: {
            id: backtestId,
            status: 'RUNNING',
            config,
          },
        });

        logger.info(
          {
            backtestId,
            watchersCount: config.watchers.length,
            startDate: input.startDate,
            endDate: input.endDate,
          },
          'Starting multi-watcher backtest'
        );

        const engine = new MultiWatcherBacktestEngine(config);
        const result = await engine.run();

        multiWatcherResults.set(backtestId, {
          createdAt: Date.now(),
          data: {
            ...result,
            id: backtestId,
            status: 'COMPLETED',
          },
        });

        logger.info(
          {
            backtestId,
            trades: result.trades.length,
            winRate: result.metrics.winRate,
            totalPnl: result.metrics.totalPnl,
            totalPnlPercent: result.metrics.totalPnlPercent,
            finalEquity: input.initialCapital + result.metrics.totalPnl,
            maxDrawdown: result.metrics.maxDrawdown,
            maxDrawdownPercent: result.metrics.maxDrawdownPercent,
            profitFactor: result.metrics.profitFactor,
            watcherStats: result.watcherStats,
          },
          'Multi-watcher backtest completed successfully'
        );

        return multiWatcherResults.get(backtestId)?.data;
      } catch (error) {
        logger.error(
          {
            backtestId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Multi-watcher backtest failed'
        );

        multiWatcherResults.set(backtestId, {
          createdAt: Date.now(),
          data: {
            id: backtestId,
            status: 'FAILED',
            config: input as any,
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Multi-watcher backtest failed',
          cause: error,
        });
      }
    }),

  getMultiWatcherResult: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = multiWatcherResults.get(input.id);

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Multi-watcher backtest result not found',
        });
      }

      return result.data;
    }),
});
