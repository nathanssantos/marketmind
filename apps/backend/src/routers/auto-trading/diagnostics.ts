import { z } from 'zod';
import { autoTradingLogBuffer } from '../../services/auto-trading-log-buffer';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';

export const diagnosticsRouter = router({
  getRecentLogs: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        limit: z.number().min(10).max(500).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
      return autoTradingLogBuffer.getRecentLogs(input.walletId, input.limit);
    }),

  getMinActiveWatcherInterval: protectedProcedure.query(async () => {
    const activeWatchersList = autoTradingScheduler.getActiveWatchers();

    if (activeWatchersList.length === 0) {
      return {
        hasActiveWatchers: false,
        minInterval: '4h',
        minIntervalMs: 4 * 60 * 60 * 1000,
        halfIntervalMs: 2 * 60 * 60 * 1000,
        activeWatcherCount: 0,
      };
    }

    const intervalToMs: Record<string, number> = {
      '1m': 60_000,
      '3m': 180_000,
      '5m': 300_000,
      '15m': 900_000,
      '30m': 1_800_000,
      '1h': 3_600_000,
      '2h': 7_200_000,
      '4h': 14_400_000,
      '6h': 21_600_000,
      '8h': 28_800_000,
      '12h': 43_200_000,
      '1d': 86_400_000,
      '3d': 259_200_000,
      '1w': 604_800_000,
    };

    let minIntervalMs = Number.MAX_SAFE_INTEGER;
    let minInterval = '4h';

    for (const watcher of activeWatchersList) {
      const intervalMs = intervalToMs[watcher.interval] ?? 14_400_000;
      if (intervalMs < minIntervalMs) {
        minIntervalMs = intervalMs;
        minInterval = watcher.interval;
      }
    }

    const halfIntervalMs = Math.floor(minIntervalMs / 2);
    const minHalfInterval = 5 * 60 * 1000;
    const effectiveHalfInterval = Math.max(halfIntervalMs, minHalfInterval);

    return {
      hasActiveWatchers: true,
      minInterval,
      minIntervalMs,
      halfIntervalMs: effectiveHalfInterval,
      activeWatcherCount: activeWatchersList.length,
    };
  }),
});
