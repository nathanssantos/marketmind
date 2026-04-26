import type { BacktestConfig, SimpleBacktestInput } from '@marketmind/types';
import { simpleBacktestInputSchema } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DEFAULT_ENABLED_SETUPS } from '../../constants';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { logger } from '../../services/logger';
import { protectedProcedure } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { generateEntityId } from '../../utils/id';
import { backtestResults, getCacheEntry, setCacheEntry } from './shared';

const buildBacktestConfig = (input: SimpleBacktestInput): BacktestConfig => ({
  ...input,
  setupTypes: input.setupTypes ?? [...DEFAULT_ENABLED_SETUPS],
  marketType: input.marketType ?? 'FUTURES',
});

export const simpleProcedures = {
  run: protectedProcedure
    .input(simpleBacktestInputSchema)
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

        const config = buildBacktestConfig(input);

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
