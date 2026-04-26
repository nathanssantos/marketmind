import { multiWatcherBacktestInputSchema } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { MultiWatcherBacktestEngine } from '../../services/backtesting/MultiWatcherBacktestEngine';
import { buildMultiWatcherConfigFromWatchers, loadMultiWatcherConfigFromAutoTrading } from '../../services/backtesting/configLoader';
import { logger } from '../../services/logger';
import { protectedProcedure } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { generateEntityId } from '../../utils/id';
import { multiWatcherResults } from './shared';

export const multiProcedures = {
  multiWatcher: protectedProcedure
    .input(multiWatcherBacktestInputSchema)
    .mutation(async ({ input }) => {
      const backtestId = generateEntityId();

      try {
        let config;
        const initialCapital = input.initialCapital ?? 10_000;

        if (input.walletId) {
          config = await loadMultiWatcherConfigFromAutoTrading(
            input.walletId,
            {
              startDate: input.startDate,
              endDate: input.endDate,
              initialCapital,
            },
            {
              tpCalculationMode: input.tpCalculationMode,
              fibonacciTargetLevel: input.fibonacciTargetLevel,
              useMtfFilter: input.useMtfFilter,
              useBtcCorrelationFilter: input.useBtcCorrelationFilter,
              useMarketRegimeFilter: input.useMarketRegimeFilter,
              useVolumeFilter: input.useVolumeFilter,
              useFundingFilter: input.useFundingFilter,
              useConfluenceScoring: input.useConfluenceScoring,
              confluenceMinScore: input.confluenceMinScore,
              useMomentumTimingFilter: input.useMomentumTimingFilter,
              useTrendFilter: input.useTrendFilter,
              useStochasticFilter: input.useStochasticFilter,
              useAdxFilter: input.useAdxFilter,
            }
          );
        } else if (input.watchers && input.watchers.length > 0) {
          config = buildMultiWatcherConfigFromWatchers(input.watchers, {
            startDate: input.startDate,
            endDate: input.endDate,
            initialCapital,
            positionSizePercent: input.positionSizePercent,
            useStochasticFilter: input.useStochasticFilter,
            useAdxFilter: input.useAdxFilter,
            useTrendFilter: input.useTrendFilter,
            minRiskRewardRatio: input.minRiskRewardRatio,
            cooldownMinutes: input.cooldownMinutes,
            marketType: input.marketType,
            leverage: input.leverage,
            tpCalculationMode: input.tpCalculationMode,
            fibonacciTargetLevel: input.fibonacciTargetLevel,
            useMtfFilter: input.useMtfFilter,
            useBtcCorrelationFilter: input.useBtcCorrelationFilter,
            useMarketRegimeFilter: input.useMarketRegimeFilter,
            useVolumeFilter: input.useVolumeFilter,
            useFundingFilter: input.useFundingFilter,
            useConfluenceScoring: input.useConfluenceScoring,
            confluenceMinScore: input.confluenceMinScore,
            useMomentumTimingFilter: input.useMomentumTimingFilter,
            trendFilterPeriod: input.trendFilterPeriod,
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
            finalEquity: initialCapital + result.metrics.totalPnl,
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
            error: serializeError(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Multi-watcher backtest failed'
        );

        multiWatcherResults.set(backtestId, {
          createdAt: Date.now(),
          data: {
            id: backtestId,
            status: 'FAILED',
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
};
