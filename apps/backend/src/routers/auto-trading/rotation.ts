import type { MarketType } from '@marketmind/types';
import { AUTO_TRADING_CONFIG, TRADING_DEFAULTS } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { autoTradingConfig } from '../../db/schema';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { walletQueries } from '../../services/database/walletQueries';
import { getDynamicSymbolRotationService } from '../../services/dynamic-symbol-rotation';
import { protectedProcedure, router } from '../../trpc';
import { transformAutoTradingConfig } from '../../utils/profile-transformers';
import { log } from './utils';

export const rotationRouter = router({
  triggerSymbolRotation: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('> triggerSymbolRotation called', { walletId: input.walletId });

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const [config] = await ctx.db
        .select()
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Auto-trading config not found',
        });
      }

      const transformedConfig = transformAutoTradingConfig(config);

      if (!transformedConfig.useDynamicSymbolSelection) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dynamic symbol selection is not enabled',
        });
      }

      const activeCount = autoTradingScheduler.getDynamicWatcherCount(input.walletId);
      const targetCount = activeCount > 0 ? activeCount : AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT;

      const rotationConfig = autoTradingScheduler.getRotationConfig(input.walletId);
      if (!rotationConfig) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No active rotation found. Start watchers first.',
        });
      }

      const result = await autoTradingScheduler.triggerManualRotation(
        input.walletId,
        ctx.user.id,
        {
          targetWatcherCount: targetCount,
          dynamicSymbolExcluded: config.dynamicSymbolExcluded,
          marketType: (wallet.marketType as MarketType) || 'FUTURES',
          interval: rotationConfig.interval,
          profileId: undefined,
          leverage: config.leverage ?? 1,
          positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
          walletBalance: parseFloat(wallet.currentBalance ?? '0'),
          useBtcCorrelationFilter: config.useBtcCorrelationFilter ?? true,
          directionMode: config.directionMode,
        }
      );

      log('✓ Symbol rotation completed', {
        walletId: input.walletId,
        added: result.added.length,
        removed: result.removed.length,
      });

      return result;
    }),

  getRotationHistory: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const rotationService = getDynamicSymbolRotationService();
      const history = rotationService.getRotationHistory(input.walletId, input.limit);
      const nextRotation = autoTradingScheduler.getNextRotationTime(input.walletId);
      const isActive = autoTradingScheduler.isRotationActive(input.walletId);

      return {
        history,
        nextRotation,
        isActive,
      };
    }),

  getRotationStatus: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const nextRotation = autoTradingScheduler.getNextRotationTime(input.walletId);
      const isActive = autoTradingScheduler.isRotationActive(input.walletId);

      return {
        isActive,
        nextRotation,
      };
    }),
});
