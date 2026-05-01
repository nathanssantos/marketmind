import type { BacktestConfig, SimpleBacktestInput } from '@marketmind/types';
import { simpleBacktestInputSchema } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_ENABLED_SETUPS } from '../../constants';
import { backtestRuns } from '../../db/schema';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { BacktestProgressReporter } from '../../services/backtesting/BacktestProgressReporter';
import { logger } from '../../services/logger';
import { protectedProcedure } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { generateEntityId } from '../../utils/id';
import { backtestResults, findRunForUser, inFlightRuns, listRunsForUser, persistTerminalRun, setCacheEntry } from './shared';

const buildBacktestConfig = (input: SimpleBacktestInput): BacktestConfig => ({
  ...input,
  setupTypes: input.setupTypes ?? [...DEFAULT_ENABLED_SETUPS],
  marketType: input.marketType ?? 'FUTURES',
});

export const simpleProcedures = {
  run: protectedProcedure
    .input(simpleBacktestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const backtestId = generateEntityId();
      const startTime = Date.now();
      const userId = String(ctx.user.id);

      setCacheEntry(backtestId, {
        id: backtestId,
        status: 'RUNNING',
        config: input,
        startTime: new Date(startTime).toISOString(),
      });

      logger.info({
        backtestId,
        symbol: input.symbol,
        interval: input.interval,
        startDate: input.startDate,
        endDate: input.endDate,
      }, 'Starting backtest');

      const reporter = new BacktestProgressReporter({
        backtestId,
        userId,
        wsService: ctx.websocket,
      });

      const runPromise = (async () => {
        try {
          const config = buildBacktestConfig(input);
          const engine = new BacktestEngine();
          const result = await engine.run(config, undefined, reporter);

          const completedEntry = {
            ...result,
            id: backtestId,
            status: 'COMPLETED' as const,
            config: input,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date().toISOString(),
            duration: Date.now() - startTime,
          };
          setCacheEntry(backtestId, completedEntry);
          await persistTerminalRun(userId, completedEntry);

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

          reporter.complete(backtestId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';

          logger.error({
            backtestId,
            error: serializeError(error),
            stack: error instanceof Error ? error.stack : undefined,
          }, 'Backtest failed');

          const failedEntry = {
            id: backtestId,
            status: 'FAILED' as const,
            config: input,
            error: message,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date().toISOString(),
            duration: Date.now() - startTime,
          };
          setCacheEntry(backtestId, failedEntry);
          await persistTerminalRun(userId, failedEntry);

          reporter.fail(message);
        } finally {
          inFlightRuns.delete(backtestId);
        }
      })();
      inFlightRuns.set(backtestId, runPromise);
      void runPromise;

      return { backtestId };
    }),

  getResult: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await findRunForUser(input.id, String(ctx.user.id));

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return result;
    }),

  getActiveRuns: protectedProcedure.query(async () => {
    const active = Array.from(backtestResults.entries())
      .filter(([, entry]) => entry.data.status === 'RUNNING')
      .map(([id, entry]) => ({
        id,
        symbol: entry.data.config?.symbol ?? '',
        interval: entry.data.config?.interval ?? '',
        startTime: entry.data.startTime ?? '',
      }))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return active;
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = String(ctx.user.id);
    const entries = await listRunsForUser(userId);
    const results = entries
      .map((result) => {
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
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user.id);

      // If the run is still going, let the IIFE settle (cache write +
      // DB persistence) before we try to delete — otherwise a delete
      // racing with persistence leaves an orphaned DB row.
      const inflight = inFlightRuns.get(input.id);
      if (inflight) {
        await inflight.catch(() => {});
      }

      const cacheDeleted = backtestResults.delete(input.id);

      const dbResult = await ctx.db
        .delete(backtestRuns)
        .where(and(eq(backtestRuns.id, input.id), eq(backtestRuns.userId, userId)))
        .returning({ id: backtestRuns.id });

      if (!cacheDeleted && dbResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return { success: true };
    }),
};
