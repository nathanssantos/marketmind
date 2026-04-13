import { FIBONACCI_PYRAMID_LEVELS, FIBONACCI_TARGET_LEVELS } from '@marketmind/fibonacci';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_ENABLED_SETUPS } from '../../constants';
import { autoTradingConfig } from '../../db/schema';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';
import { applyConfigFieldsToUpdate } from '../../utils/config-field-registry';
import { applyFilterInputToUpdate } from '../../utils/filters/filter-registry';
import { generateEntityId } from '../../utils/id';
import { transformAutoTradingConfig } from '../../utils/profile-transformers';
import { log } from './utils';

export const configRouter = router({
  getConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      let [config] = await ctx.db
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
        const configId = generateEntityId();
        const defaultEnabledSetups = JSON.stringify([...DEFAULT_ENABLED_SETUPS]);

        await ctx.db.insert(autoTradingConfig).values({
          id: configId,
          userId: ctx.user.id,
          walletId: input.walletId,
          isEnabled: false,
          maxConcurrentPositions: 3,
          maxPositionSize: '10',
          dailyLossLimit: '5',
          enabledSetupTypes: defaultEnabledSetups,
          positionSizing: 'percentage',
          leverage: 1,
          marginType: 'CROSSED',
        });

        [config] = await ctx.db
          .select()
          .from(autoTradingConfig)
          .where(eq(autoTradingConfig.id, configId))
          .limit(1);
      }

      if (!config) {
        throw new Error('Config not found');
      }

      return transformAutoTradingConfig(config);
    }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        isEnabled: z.boolean().optional(),
        maxConcurrentPositions: z.number().min(AUTO_TRADING_CONFIG.CONCURRENT_POSITIONS.MIN).max(AUTO_TRADING_CONFIG.CONCURRENT_POSITIONS.MAX).optional(),
        maxPositionSize: z.string().optional(),
        dailyLossLimit: z.string().optional(),
        enabledSetupTypes: z.array(z.string()).optional(),
        positionSizing: z.enum(['fixed', 'percentage', 'kelly']).optional(),
        useLimitOrders: z.boolean().optional(),
        useStochasticFilter: z.boolean().optional(),
        useStochasticRecoveryFilter: z.boolean().optional(),
        useStochasticHtfFilter: z.boolean().optional(),
        useStochasticRecoveryHtfFilter: z.boolean().optional(),
        useAdxFilter: z.boolean().optional(),
        useTrendFilter: z.boolean().optional(),
        useVolumeFilter: z.boolean().optional(),
        volumeFilterObvLookbackLong: z.number().min(1).max(20).optional(),
        volumeFilterObvLookbackShort: z.number().min(1).max(20).optional(),
        useObvCheckLong: z.boolean().optional(),
        useObvCheckShort: z.boolean().optional(),
        positionSizePercent: z.string().optional(),
        manualPositionSizePercent: z.string().optional(),
        maxGlobalExposurePercent: z.string().optional(),
        tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
        fibonacciTargetLevel: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciTargetLevelLong: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciTargetLevelShort: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciSwingRange: z.enum(['extended', 'nearest']).optional(),
        initialStopMode: z.enum(['fibo_target', 'nearest_swing']).optional(),
        useDynamicSymbolSelection: z.boolean().optional(),
        dynamicSymbolRotationInterval: z.enum(['1h', '4h', '1d']).optional(),
        dynamicSymbolExcluded: z.array(z.string()).optional(),
        enableAutoRotation: z.boolean().optional(),
        trailingStopMode: z.enum(['local', 'binance']).optional(),
        trailingStopEnabled: z.boolean().optional(),
        trailingActivationPercentLong: z.string().optional(),
        trailingActivationPercentShort: z.string().optional(),
        trailingDistancePercentLong: z.string().optional(),
        trailingDistancePercentShort: z.string().optional(),
        useAdaptiveTrailing: z.boolean().optional(),
        useProfitLockDistance: z.boolean().optional(),
        trailingDistanceMode: z.enum(['auto', 'fixed']).optional(),
        trailingStopOffsetPercent: z.string().optional(),
        trailingActivationModeLong: z.enum(['auto', 'manual']).optional(),
        trailingActivationModeShort: z.enum(['auto', 'manual']).optional(),
        trailingStopIndicatorInterval: z.string().optional(),
        leverage: z.number().min(AUTO_TRADING_CONFIG.LEVERAGE.MIN).max(AUTO_TRADING_CONFIG.LEVERAGE.MAX).optional(),
        marginType: z.enum(['ISOLATED', 'CROSSED']).optional(),
        opportunityCostEnabled: z.boolean().optional(),
        maxHoldingPeriodBars: z.number().min(AUTO_TRADING_CONFIG.HOLDING_PERIOD_BARS.MIN).max(AUTO_TRADING_CONFIG.HOLDING_PERIOD_BARS.MAX).optional(),
        stalePriceThresholdPercent: z.string().optional(),
        staleTradeAction: z.enum(['ALERT_ONLY', 'TIGHTEN_STOP', 'AUTO_CLOSE']).optional(),
        timeBasedStopTighteningEnabled: z.boolean().optional(),
        timeTightenAfterBars: z.number().min(AUTO_TRADING_CONFIG.TIGHTEN_AFTER_BARS.MIN).max(AUTO_TRADING_CONFIG.TIGHTEN_AFTER_BARS.MAX).optional(),
        timeTightenPercentPerBar: z.string().optional(),
        pyramidingEnabled: z.boolean().optional(),
        pyramidingMode: z.enum(['static', 'dynamic', 'fibonacci']).optional(),
        maxPyramidEntries: z.number().min(AUTO_TRADING_CONFIG.PYRAMID_ENTRIES.MIN).max(AUTO_TRADING_CONFIG.PYRAMID_ENTRIES.MAX).optional(),
        pyramidProfitThreshold: z.string().optional(),
        pyramidScaleFactor: z.string().optional(),
        pyramidMinDistance: z.string().optional(),
        pyramidUseAtr: z.boolean().optional(),
        pyramidUseAdx: z.boolean().optional(),
        pyramidUseRsi: z.boolean().optional(),
        pyramidAdxThreshold: z.number().min(AUTO_TRADING_CONFIG.ADX_THRESHOLD.MIN).max(AUTO_TRADING_CONFIG.ADX_THRESHOLD.MAX).optional(),
        pyramidRsiLowerBound: z.number().min(AUTO_TRADING_CONFIG.RSI_BOUNDS.LOWER.MIN).max(AUTO_TRADING_CONFIG.RSI_BOUNDS.LOWER.MAX).optional(),
        pyramidRsiUpperBound: z.number().min(AUTO_TRADING_CONFIG.RSI_BOUNDS.UPPER.MIN).max(AUTO_TRADING_CONFIG.RSI_BOUNDS.UPPER.MAX).optional(),
        pyramidFiboLevels: z.array(z.enum(FIBONACCI_PYRAMID_LEVELS)).optional(),
        leverageAwarePyramid: z.boolean().optional(),
        useChoppinessFilter: z.boolean().optional(),
        choppinessThresholdHigh: z.string().optional(),
        choppinessThresholdLow: z.string().optional(),
        choppinessPeriod: z.number().min(5).max(50).optional(),
        useSessionFilter: z.boolean().optional(),
        sessionStartUtc: z.number().min(0).max(23).optional(),
        sessionEndUtc: z.number().min(0).max(23).optional(),
        useBollingerSqueezeFilter: z.boolean().optional(),
        bollingerSqueezeThreshold: z.string().optional(),
        bollingerSqueezePeriod: z.number().min(5).max(50).optional(),
        bollingerSqueezeStdDev: z.string().optional(),
        useVwapFilter: z.boolean().optional(),
        useSuperTrendFilter: z.boolean().optional(),
        superTrendPeriod: z.number().min(5).max(50).optional(),
        superTrendMultiplier: z.string().optional(),
        directionMode: z.enum(['auto', 'long_only', 'short_only']).optional(),
        minRiskRewardRatioLong: z.string().optional(),
        minRiskRewardRatioShort: z.string().optional(),
        maxFibonacciEntryProgressPercentLong: z.number().min(0).max(150).optional(),
        maxFibonacciEntryProgressPercentShort: z.number().min(0).max(150).optional(),
        useBtcCorrelationFilter: z.boolean().optional(),
        useFundingFilter: z.boolean().optional(),
        useMtfFilter: z.boolean().optional(),
        useMarketRegimeFilter: z.boolean().optional(),
        useDirectionFilter: z.boolean().optional(),
        useMomentumTimingFilter: z.boolean().optional(),
        useConfluenceScoring: z.boolean().optional(),
        enableLongInBearMarket: z.boolean().optional(),
        enableShortInBullMarket: z.boolean().optional(),
        confluenceMinScore: z.number().min(0).max(100).optional(),
        maxDrawdownEnabled: z.boolean().optional(),
        maxDrawdownPercent: z.string().optional(),
        maxRiskPerStopEnabled: z.boolean().optional(),
        maxRiskPerStopPercent: z.string().optional(),
        marginTopUpEnabled: z.boolean().optional(),
        marginTopUpThreshold: z.string().optional(),
        marginTopUpPercent: z.string().optional(),
        marginTopUpMaxCount: z.number().min(1).max(10).optional(),
        positionMode: z.enum(['ONE_WAY', 'HEDGE']).optional(),
        tradingMode: z.enum(['auto', 'semi_assisted']).optional(),
        useFvgFilter: z.boolean().optional(),
        useCooldown: z.boolean().optional(),
        cooldownMinutes: z.number().min(1).max(1440).optional(),
        sessionScanEnabled: z.boolean().optional(),
        sessionScanMarkets: z.string().optional(),
        autoCancelOrphans: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('> updateConfig called', { walletId: input.walletId, isEnabled: input.isEnabled });

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
        log('✗ Config not found for wallet', { walletId: input.walletId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Auto-trading config not found. Please get config first.',
        });
      }

      const updateData: Partial<typeof autoTradingConfig.$inferInsert> = {
        updatedAt: new Date(),
      };

      applyConfigFieldsToUpdate(input as Record<string, unknown>, updateData as Record<string, unknown>);
      applyFilterInputToUpdate(input as Record<string, unknown>, updateData as Record<string, unknown>);

      await ctx.db
        .update(autoTradingConfig)
        .set(updateData)
        .where(eq(autoTradingConfig.id, config.id));

      autoTradingScheduler.invalidateConfigCache(input.walletId);

      if (input.isEnabled !== undefined) {
        log(input.isEnabled ? '✓ Auto-trading ENABLED' : '✗ Auto-trading DISABLED', {
          walletId: input.walletId,
          enabledSetupTypes: input.enabledSetupTypes,
        });
      }

      return { success: true };
    }),
});
