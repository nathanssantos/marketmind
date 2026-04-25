import { FIBONACCI_TARGET_LEVELS } from '@marketmind/fibonacci';
import type { BacktestConfig } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DEFAULT_ENABLED_SETUPS } from '../../constants';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { logger } from '../../services/logger';
import { protectedProcedure } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { generateEntityId } from '../../utils/id';
import { backtestResults, getCacheEntry, setCacheEntry } from './shared';

export const simpleProcedures = {
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
        useTrendFilter: z.boolean().optional(),
        useAlgorithmicLevels: z.boolean().optional().default(false),
        stopLossPercent: z.number().positive().optional(),
        takeProfitPercent: z.number().positive().optional(),
        commission: z.number().min(0).max(1).optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).optional().default('FUTURES'),
        useBnbDiscount: z.boolean().optional().default(false),
        useStochasticFilter: z.boolean().optional(),
        useAdxFilter: z.boolean().optional(),
        useMtfFilter: z.boolean().optional(),
        useBtcCorrelationFilter: z.boolean().optional(),
        useMarketRegimeFilter: z.boolean().optional(),
        useVolumeFilter: z.boolean().optional(),
        useFundingFilter: z.boolean().optional(),
        useConfluenceScoring: z.boolean().optional(),
        confluenceMinScore: z.number().min(0).max(100).optional(),
        useMomentumTimingFilter: z.boolean().optional(),
        trendFilterPeriod: z.number().min(1).optional(),
        tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
        fibonacciTargetLevel: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        positionSizePercent: z.number().min(1).max(100).optional(),
        leverage: z.number().min(1).max(125).optional(),
        cooldownMinutes: z.number().min(0).optional(),
        useCooldown: z.boolean().optional(),
        minRiskRewardRatio: z.number().min(0).optional(),
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
          interval: input.interval,
          startDate: input.startDate,
          endDate: input.endDate,
          initialCapital: input.initialCapital,
          setupTypes: input.setupTypes ?? [...DEFAULT_ENABLED_SETUPS],
          minConfidence: input.minConfidence,
          useTrendFilter: input.useTrendFilter,
          useAlgorithmicLevels: input.useAlgorithmicLevels,
          stopLossPercent: input.stopLossPercent,
          takeProfitPercent: input.takeProfitPercent,
          commission: input.commission,
          marketType: input.marketType,
          useBnbDiscount: input.useBnbDiscount,
          useStochasticFilter: input.useStochasticFilter,
          useAdxFilter: input.useAdxFilter,
          useMtfFilter: input.useMtfFilter,
          useBtcCorrelationFilter: input.useBtcCorrelationFilter,
          useMarketRegimeFilter: input.useMarketRegimeFilter,
          useVolumeFilter: input.useVolumeFilter,
          useFundingFilter: input.useFundingFilter,
          useConfluenceScoring: input.useConfluenceScoring,
          confluenceMinScore: input.confluenceMinScore,
          useMomentumTimingFilter: input.useMomentumTimingFilter,
          trendFilterPeriod: input.trendFilterPeriod,
          tpCalculationMode: input.tpCalculationMode,
          fibonacciTargetLevel: input.fibonacciTargetLevel,
          positionSizePercent: input.positionSizePercent,
          leverage: input.leverage,
          cooldownMinutes: input.cooldownMinutes,
          useCooldown: input.useCooldown,
          minRiskRewardRatio: input.minRiskRewardRatio,
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
          error: serializeError(error),
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
};
