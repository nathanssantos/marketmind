import type { ExchangeId } from '@marketmind/types';
import { AUTO_TRADING_CONFIG, TRADING_DEFAULTS } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { activeWatchers, autoTradingConfig } from '../../db/schema';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { checkKlineAvailability } from '../../services/kline-prefetch';
import { walletQueries } from '../../services/database/walletQueries';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { getOpportunityScoringService } from '../../services/opportunity-scoring';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { log } from './utils';

export const watchersRouter = router({
  startWatcher: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        interval: z.string(),
        profileId: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('> startWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, profileId: input.profileId, marketType: input.marketType });

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start ${input.marketType} watcher on ${wallet.marketType} wallet`,
        });
      }

      const klineCheck = await checkKlineAvailability(input.symbol, input.interval, input.marketType);

      if (!klineCheck.hasSufficient) {
        log('! Symbol has insufficient klines', {
          symbol: input.symbol,
          interval: input.interval,
          marketType: input.marketType,
          totalAvailable: klineCheck.totalAvailable,
          required: klineCheck.required,
          apiExhausted: klineCheck.apiExhausted,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Symbol ${input.symbol} has insufficient historical data: ${klineCheck.totalAvailable}/${klineCheck.required} klines available`,
        });
      }

      await ctx.db
        .update(autoTradingConfig)
        .set({ isEnabled: true, updatedAt: new Date() })
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        );

      const exchange = (wallet.exchange as ExchangeId) ?? 'BINANCE';

      await autoTradingScheduler.startWatcher(
        input.walletId,
        ctx.user.id,
        input.symbol,
        input.interval,
        input.profileId,
        false,
        input.marketType,
        true,
        false,
        false,
        undefined,
        exchange
      );

      log('✓ Watcher started', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, profileId: input.profileId, marketType: input.marketType, exchange });

      return { success: true };
    }),

  stopWatcher: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        interval: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('✗ stopWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, marketType: input.marketType });

      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      await autoTradingScheduler.stopWatcher(input.walletId, input.symbol, input.interval, input.marketType);

      log('✓ Watcher stopped', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, marketType: input.marketType });

      return { success: true };
    }),

  stopAllWatchers: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      log('✗ stopAllWatchers called', { walletId: input.walletId });

      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      await ctx.db
        .update(autoTradingConfig)
        .set({ isEnabled: false, updatedAt: new Date() })
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        );

      await autoTradingScheduler.stopAllWatchersForWallet(input.walletId);

      log('✓ All watchers stopped', { walletId: input.walletId });

      return { success: true };
    }),

  getWatcherStatus: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const memoryStatus = autoTradingScheduler.getWatcherStatus(input.walletId);
      const dbStatus = await autoTradingScheduler.getWatcherStatusFromDb(input.walletId);
      const activeWatchersList = autoTradingScheduler.getActiveWatchers().filter(
        w => w.watcherId.startsWith(input.walletId)
      );

      return {
        active: memoryStatus.active,
        watchers: memoryStatus.watchers,
        activeWatchers: memoryStatus.active
          ? activeWatchersList
          : dbStatus.watcherDetails.map(w => ({ watcherId: `${input.walletId}-${w.symbol}-${w.interval}`, ...w })),
        persistedWatchers: dbStatus.watchers,
      };
    }),

  startWatchersBulk: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbols: z.array(z.string()).min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX),
        interval: z.string(),
        profileId: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        targetCount: z.number().min(AUTO_TRADING_CONFIG.TARGET_COUNT.MIN).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX).optional(),
        isManual: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const targetCount = input.targetCount ?? input.symbols.length;

      log('> startWatchersBulk called', {
        walletId: input.walletId,
        symbols: input.symbols,
        interval: input.interval,
        profileId: input.profileId,
        marketType: input.marketType,
        targetCount,
      });

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
      const walletExchange = (wallet.exchange as ExchangeId) ?? 'BINANCE';

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start ${input.marketType} watchers on ${wallet.marketType} wallet`,
        });
      }

      const [config] = await ctx.db
        .select({
          useDynamicSymbolSelection: autoTradingConfig.useDynamicSymbolSelection,
          dynamicSymbolExcluded: autoTradingConfig.dynamicSymbolExcluded,
          dynamicSymbolRotationInterval: autoTradingConfig.dynamicSymbolRotationInterval,
          enableAutoRotation: autoTradingConfig.enableAutoRotation,
          leverage: autoTradingConfig.leverage,
          positionSizePercent: autoTradingConfig.positionSizePercent,
          useBtcCorrelationFilter: autoTradingConfig.useBtcCorrelationFilter,
          directionMode: autoTradingConfig.directionMode,
        })
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        )
        .limit(1);

      const useDynamicSelection = config?.useDynamicSymbolSelection ?? false;
      const maxWatcherLimit = AUTO_TRADING_CONFIG.TARGET_COUNT.MAX;

      log('> Config loaded', { useDynamicSelection, maxWatcherLimit, inputTargetCount: input.targetCount });

      const existingWatchers = await ctx.db
        .select({ symbol: activeWatchers.symbol })
        .from(activeWatchers)
        .where(
          and(
            eq(activeWatchers.walletId, input.walletId),
            eq(activeWatchers.marketType, input.marketType)
          )
        );

      const existingSymbols = new Set(existingWatchers.map(w => w.symbol));
      const existingCount = existingSymbols.size;
      const availableSlots = Math.max(0, maxWatcherLimit - existingCount);
      const effectiveTargetCount = Math.min(targetCount, availableSlots);

      log('> Watcher limits', {
        existingCount,
        maxWatcherLimit,
        availableSlots,
        requestedTarget: targetCount,
        effectiveTargetCount,
      });

      if (availableSlots === 0) {
        log('! No available slots for new watchers', { existingCount, maxWatcherLimit });
        return {
          results: [],
          successCount: 0,
          failedCount: 0,
          skippedKlinesCount: 0,
          skippedCapitalCount: 0,
          fromRankingCount: 0,
          targetCount,
          targetMet: false,
          existingCount,
          maxWatcherLimit,
          message: `Limit reached: ${existingCount}/${maxWatcherLimit} watchers already active`,
        };
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const positionSizePercent = parseFloat(config?.positionSizePercent ?? String(TRADING_DEFAULTS.POSITION_SIZE_PERCENT));

      const minNotionalFilter = getMinNotionalFilterService();
      const { maxWatchers, capitalPerWatcher, eligibleSymbols, excludedSymbols } =
        await minNotionalFilter.calculateMaxWatchersFromSymbols(
          input.symbols,
          walletBalance,
          leverage,
          positionSizePercent,
          input.marketType
        );

      const skippedCapitalSymbols = Array.from(excludedSymbols.keys());
      const symbolsToTry = eligibleSymbols;
      const capitalLimitedTarget = effectiveTargetCount;

      if (skippedCapitalSymbols.length > 0) {
        log('> Capital filter applied to initial symbols', {
          skippedSymbols: skippedCapitalSymbols.length,
          capitalPerWatcher: capitalPerWatcher.toFixed(2),
          walletBalance,
          leverage,
          eligibleFromInput: eligibleSymbols.length,
          targetCount: capitalLimitedTarget,
        });
      }

      await ctx.db
        .update(autoTradingConfig)
        .set({ isEnabled: true, useDynamicSymbolSelection: true, updatedAt: new Date() })
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        );

      const results: Array<{ symbol: string; success: boolean; error?: string; skippedReason?: string; fromRanking?: boolean }> = [];
      const startedSymbols = new Set<string>();
      const attemptedSymbols = new Set<string>(existingSymbols);

      const tryStartWatcher = async (symbol: string, fromRanking: boolean = false): Promise<boolean> => {
        if (attemptedSymbols.has(symbol) || startedSymbols.has(symbol)) return false;
        attemptedSymbols.add(symbol);

        try {
          const klineCheck = await checkKlineAvailability(symbol, input.interval, input.marketType, true);

          if (!klineCheck.hasSufficient) {
            results.push({
              symbol,
              success: false,
              error: `Insufficient klines: ${klineCheck.totalAvailable}/${klineCheck.required}`,
              skippedReason: 'insufficient_klines',
              fromRanking,
            });
            return false;
          }

          const isManualWatcher = input.isManual ?? (useDynamicSelection ? false : !fromRanking);

          await autoTradingScheduler.startWatcher(
            input.walletId,
            ctx.user.id,
            symbol,
            input.interval,
            input.profileId,
            false,
            input.marketType,
            isManualWatcher,
            false,
            false,
            undefined,
            walletExchange
          );

          startedSymbols.add(symbol);
          results.push({ symbol, success: true, fromRanking });
          return true;
        } catch (error) {
          const errorMessage = serializeError(error);
          results.push({ symbol, success: false, error: errorMessage, fromRanking });
          log('✗ Failed to start watcher', { symbol, error: errorMessage, fromRanking });
          return false;
        }
      };

      for (const symbol of skippedCapitalSymbols) {
        results.push({
          symbol,
          success: false,
          error: `Capital per watcher ($${capitalPerWatcher.toFixed(2)} USDT) below minNotional`,
          skippedReason: 'insufficient_capital',
          fromRanking: false,
        });
      }

      for (const symbol of symbolsToTry) {
        if (startedSymbols.size >= capitalLimitedTarget) break;
        await tryStartWatcher(symbol, false);
      }

      if (startedSymbols.size < capitalLimitedTarget) {
        log('> Fetching additional symbols from ranking', {
          current: startedSymbols.size,
          target: capitalLimitedTarget,
          needed: capitalLimitedTarget - startedSymbols.size,
        });

        const scoringService = getOpportunityScoringService();
        const scores = await scoringService.getSymbolScores(input.marketType, capitalLimitedTarget * 4);

        const rankingSymbols = scores.map(s => s.symbol).filter(s => !attemptedSymbols.has(s));
        const { eligibleSymbols: rankingEligible, excludedSymbols: rankingExcluded, capitalPerWatcher: rankingCapitalPerWatcher } =
          await minNotionalFilter.calculateMaxWatchersFromSymbols(
            rankingSymbols,
            walletBalance,
            leverage,
            positionSizePercent,
            input.marketType
          );

        for (const symbol of rankingExcluded.keys()) {
          results.push({
            symbol,
            success: false,
            error: `Capital per watcher ($${rankingCapitalPerWatcher.toFixed(2)} USDT) below minNotional`,
            skippedReason: 'insufficient_capital',
            fromRanking: true,
          });
          attemptedSymbols.add(symbol);
        }

        for (const symbol of rankingEligible) {
          if (startedSymbols.size >= capitalLimitedTarget) break;
          await tryStartWatcher(symbol, true);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const skippedKlinesCount = results.filter(r => r.skippedReason === 'insufficient_klines').length;
      const skippedCapitalCount = results.filter(r => r.skippedReason === 'insufficient_capital').length;
      const fromRankingCount = results.filter(r => r.success && r.fromRanking).length;
      const targetMet = successCount >= capitalLimitedTarget;

      log('✓ Bulk watcher creation complete', {
        total: results.length,
        success: successCount,
        capitalLimitedTarget,
        maxAffordableWatchers: maxWatchers,
        existingCount,
        maxWatcherLimit,
        targetMet,
        fromRanking: fromRankingCount,
        skippedInsufficientKlines: skippedKlinesCount,
        skippedInsufficientCapital: skippedCapitalCount,
      });

      if (useDynamicSelection && successCount > 0) {
        await autoTradingScheduler.startDynamicRotation(
          input.walletId,
          ctx.user.id,
          {
            useDynamicSymbolSelection: true,
            targetWatcherCount: capitalLimitedTarget,
            dynamicSymbolExcluded: config?.dynamicSymbolExcluded ?? null,
            marketType: input.marketType,
            interval: input.interval,
            profileId: input.profileId,
            enableAutoRotation: config?.enableAutoRotation ?? true,
            leverage: config?.leverage ?? 1,
            positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
            walletBalance: parseFloat(wallet.currentBalance ?? '0'),
            useBtcCorrelationFilter: config?.useBtcCorrelationFilter ?? true,
            directionMode: config?.directionMode,
          }
        );
      }

      return {
        results,
        successCount,
        failedCount: results.length - successCount,
        skippedKlinesCount,
        skippedCapitalCount,
        fromRankingCount,
        targetCount,
        effectiveTargetCount,
        existingCount,
        maxWatcherLimit,
        targetMet,
      };
    }),
});
