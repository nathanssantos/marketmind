import { FIBONACCI_PYRAMID_LEVELS, FIBONACCI_TARGET_LEVELS } from '@marketmind/fibonacci';
import { colorize } from '@marketmind/logger';
import { calculateCapitalLimits } from '@marketmind/risk';
import type { ExchangeId } from '@marketmind/types';
import { AUTO_TRADING_CONFIG, CAPITAL_RULES, TRADING_DEFAULTS } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { PROTECTION_CONFIG, TRADING_CONFIG } from '../constants';
import {
    activeWatchers,
    autoTradingConfig,
    klines,
    setupDetections,
    tradeExecutions,
} from '../db/schema';
import { autoTradingService } from '../services/auto-trading';
import { positionMonitorService } from '../services/position-monitor';
import { autoTradingLogBuffer } from '../services/auto-trading-log-buffer';
import { autoTradingScheduler } from '../services/auto-trading-scheduler';
import { getTopSymbolsByVolume } from '../services/binance-exchange-info';
import { cancelAllFuturesAlgoOrders, closePosition, createBinanceFuturesClient, getPositions, isPaperWallet } from '../services/binance-futures-client';
import { getBinanceFuturesDataService } from '../services/binance-futures-data';
import { getAltcoinSeasonIndexService } from '../services/altcoin-season-index';
import { getBTCDominanceDataService } from '../services/btc-dominance-data';
import { getFearGreedDataService } from '../services/fear-greed-data';
import { getOnChainDataService } from '../services/on-chain-data';
import { walletQueries } from '../services/database/walletQueries';
import { getCurrentIndicatorValues } from '../services/dynamic-pyramid-evaluator';
import { getDynamicSymbolRotationService } from '../services/dynamic-symbol-rotation';
import { checkKlineAvailability } from '../services/kline-prefetch';
import { logger } from '../services/logger';
import { getMarketCapDataService } from '../services/market-cap-data';
import { getMinNotionalFilterService } from '../services/min-notional-filter';
import { getOpportunityScoringService } from '../services/opportunity-scoring';
import { getOrderBookAnalyzerService } from '../services/order-book-analyzer';
import { getIndicatorHistoryService } from '../services/indicator-history';
import { riskManagerService } from '../services/risk-manager';
import { protectedProcedure, router } from '../trpc';
import { serializeError } from '../utils/errors';
import { checkAdxCondition } from '../utils/filters/adx-filter';
import { getBtcTrendEmaInfoWithHistory, getEma21Direction, type Ema21TrendResult } from '../utils/filters/btc-correlation-filter';
import { generateEntityId } from '../utils/id';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { calculatePnl } from '../utils/pnl-calculator';
import { parseEnabledSetupTypes, stringifyDynamicSymbolExcluded, stringifyEnabledSetupTypes, transformAutoTradingConfig } from '../utils/profile-transformers';

const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Auto-Trading] ${message}`);
  } else {
    logger.info(`[Auto-Trading] ${message}`);
  }
};

const logApiTable = (endpoint: string, rows: [string, string | number][]): void => {
  const fields = rows.map(([key, value]) => `${key}=${value}`).join(' · ');
  console.log(`  > ${colorize(endpoint, 'cyan')} · ${colorize(fields, 'dim')}`);
};

export const autoTradingRouter = router({
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
        const defaultEnabledSetups = JSON.stringify([
          'larry-williams-9-1',
          'larry-williams-9-2',
          'larry-williams-9-3',
          'larry-williams-9-4',
        ]);

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
        useAdxFilter: z.boolean().optional(),
        useTrendFilter: z.boolean().optional(),
        useVolumeFilter: z.boolean().optional(),
        volumeFilterObvLookbackLong: z.number().min(1).max(20).optional(),
        volumeFilterObvLookbackShort: z.number().min(1).max(20).optional(),
        useObvCheckLong: z.boolean().optional(),
        useObvCheckShort: z.boolean().optional(),
        positionSizePercent: z.string().optional(),
        maxGlobalExposurePercent: z.string().optional(),
        tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
        fibonacciTargetLevel: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciTargetLevelLong: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciTargetLevelShort: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        fibonacciSwingRange: z.enum(['extended', 'nearest']).optional(),
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

      if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
      if (input.maxConcurrentPositions !== undefined)
        {updateData.maxConcurrentPositions = input.maxConcurrentPositions;}
      if (input.maxPositionSize !== undefined)
        {updateData.maxPositionSize = input.maxPositionSize;}
      if (input.dailyLossLimit !== undefined)
        {updateData.dailyLossLimit = input.dailyLossLimit;}
      if (input.enabledSetupTypes !== undefined)
        {updateData.enabledSetupTypes = stringifyEnabledSetupTypes(input.enabledSetupTypes);}
      if (input.positionSizing !== undefined)
        {updateData.positionSizing = input.positionSizing;}
      if (input.useLimitOrders !== undefined)
        {updateData.useLimitOrders = input.useLimitOrders;}
      if (input.useStochasticFilter !== undefined)
        {updateData.useStochasticFilter = input.useStochasticFilter;}
      if (input.useStochasticRecoveryFilter !== undefined)
        {updateData.useStochasticRecoveryFilter = input.useStochasticRecoveryFilter;}
      if (input.useAdxFilter !== undefined)
        {updateData.useAdxFilter = input.useAdxFilter;}
      if (input.useTrendFilter !== undefined)
        {updateData.useTrendFilter = input.useTrendFilter;}
      if (input.useVolumeFilter !== undefined)
        {updateData.useVolumeFilter = input.useVolumeFilter;}
      if (input.volumeFilterObvLookbackLong !== undefined)
        {updateData.volumeFilterObvLookbackLong = input.volumeFilterObvLookbackLong;}
      if (input.volumeFilterObvLookbackShort !== undefined)
        {updateData.volumeFilterObvLookbackShort = input.volumeFilterObvLookbackShort;}
      if (input.useObvCheckLong !== undefined)
        {updateData.useObvCheckLong = input.useObvCheckLong;}
      if (input.useObvCheckShort !== undefined)
        {updateData.useObvCheckShort = input.useObvCheckShort;}
      if (input.positionSizePercent !== undefined)
        {updateData.positionSizePercent = input.positionSizePercent;}
      if (input.maxGlobalExposurePercent !== undefined)
        {updateData.maxGlobalExposurePercent = input.maxGlobalExposurePercent;}
      if (input.tpCalculationMode !== undefined)
        {updateData.tpCalculationMode = input.tpCalculationMode;}
      if (input.fibonacciTargetLevel !== undefined)
        {updateData.fibonacciTargetLevel = input.fibonacciTargetLevel;}
      if (input.fibonacciTargetLevelLong !== undefined)
        {updateData.fibonacciTargetLevelLong = input.fibonacciTargetLevelLong;}
      if (input.fibonacciTargetLevelShort !== undefined)
        {updateData.fibonacciTargetLevelShort = input.fibonacciTargetLevelShort;}
      if (input.fibonacciSwingRange !== undefined)
        {updateData.fibonacciSwingRange = input.fibonacciSwingRange;}
      if (input.useDynamicSymbolSelection !== undefined)
        {updateData.useDynamicSymbolSelection = input.useDynamicSymbolSelection;}
      if (input.dynamicSymbolRotationInterval !== undefined)
        {updateData.dynamicSymbolRotationInterval = input.dynamicSymbolRotationInterval;}
      if (input.dynamicSymbolExcluded !== undefined)
        {updateData.dynamicSymbolExcluded = stringifyDynamicSymbolExcluded(input.dynamicSymbolExcluded);}
      if (input.enableAutoRotation !== undefined)
        {updateData.enableAutoRotation = input.enableAutoRotation;}
      if (input.trailingStopMode !== undefined)
        {updateData.trailingStopMode = input.trailingStopMode;}
      if (input.trailingStopEnabled !== undefined)
        {updateData.trailingStopEnabled = input.trailingStopEnabled;}
      if (input.trailingActivationPercentLong !== undefined)
        {updateData.trailingActivationPercentLong = input.trailingActivationPercentLong;}
      if (input.trailingActivationPercentShort !== undefined)
        {updateData.trailingActivationPercentShort = input.trailingActivationPercentShort;}
      if (input.trailingDistancePercentLong !== undefined)
        {updateData.trailingDistancePercentLong = input.trailingDistancePercentLong;}
      if (input.trailingDistancePercentShort !== undefined)
        {updateData.trailingDistancePercentShort = input.trailingDistancePercentShort;}
      if (input.useAdaptiveTrailing !== undefined)
        {updateData.useAdaptiveTrailing = input.useAdaptiveTrailing;}
      if (input.useProfitLockDistance !== undefined)
        {updateData.useProfitLockDistance = input.useProfitLockDistance;}
      if (input.leverage !== undefined)
        {updateData.leverage = input.leverage;}
      if (input.marginType !== undefined)
        {updateData.marginType = input.marginType;}
      if (input.opportunityCostEnabled !== undefined)
        {updateData.opportunityCostEnabled = input.opportunityCostEnabled;}
      if (input.maxHoldingPeriodBars !== undefined)
        {updateData.maxHoldingPeriodBars = input.maxHoldingPeriodBars;}
      if (input.stalePriceThresholdPercent !== undefined)
        {updateData.stalePriceThresholdPercent = input.stalePriceThresholdPercent;}
      if (input.staleTradeAction !== undefined)
        {updateData.staleTradeAction = input.staleTradeAction;}
      if (input.timeBasedStopTighteningEnabled !== undefined)
        {updateData.timeBasedStopTighteningEnabled = input.timeBasedStopTighteningEnabled;}
      if (input.timeTightenAfterBars !== undefined)
        {updateData.timeTightenAfterBars = input.timeTightenAfterBars;}
      if (input.timeTightenPercentPerBar !== undefined)
        {updateData.timeTightenPercentPerBar = input.timeTightenPercentPerBar;}
      if (input.pyramidingEnabled !== undefined)
        {updateData.pyramidingEnabled = input.pyramidingEnabled;}
      if (input.pyramidingMode !== undefined)
        {updateData.pyramidingMode = input.pyramidingMode;}
      if (input.maxPyramidEntries !== undefined)
        {updateData.maxPyramidEntries = input.maxPyramidEntries;}
      if (input.pyramidProfitThreshold !== undefined)
        {updateData.pyramidProfitThreshold = input.pyramidProfitThreshold;}
      if (input.pyramidScaleFactor !== undefined)
        {updateData.pyramidScaleFactor = input.pyramidScaleFactor;}
      if (input.pyramidMinDistance !== undefined)
        {updateData.pyramidMinDistance = input.pyramidMinDistance;}
      if (input.pyramidUseAtr !== undefined)
        {updateData.pyramidUseAtr = input.pyramidUseAtr;}
      if (input.pyramidUseAdx !== undefined)
        {updateData.pyramidUseAdx = input.pyramidUseAdx;}
      if (input.pyramidUseRsi !== undefined)
        {updateData.pyramidUseRsi = input.pyramidUseRsi;}
      if (input.pyramidAdxThreshold !== undefined)
        {updateData.pyramidAdxThreshold = input.pyramidAdxThreshold;}
      if (input.pyramidRsiLowerBound !== undefined)
        {updateData.pyramidRsiLowerBound = input.pyramidRsiLowerBound;}
      if (input.pyramidRsiUpperBound !== undefined)
        {updateData.pyramidRsiUpperBound = input.pyramidRsiUpperBound;}
      if (input.pyramidFiboLevels !== undefined)
        {updateData.pyramidFiboLevels = JSON.stringify(input.pyramidFiboLevels);}
      if (input.leverageAwarePyramid !== undefined)
        {updateData.leverageAwarePyramid = input.leverageAwarePyramid;}
      if (input.useChoppinessFilter !== undefined)
        {updateData.useChoppinessFilter = input.useChoppinessFilter;}
      if (input.choppinessThresholdHigh !== undefined)
        {updateData.choppinessThresholdHigh = input.choppinessThresholdHigh;}
      if (input.choppinessThresholdLow !== undefined)
        {updateData.choppinessThresholdLow = input.choppinessThresholdLow;}
      if (input.choppinessPeriod !== undefined)
        {updateData.choppinessPeriod = input.choppinessPeriod;}
      if (input.useSessionFilter !== undefined)
        {updateData.useSessionFilter = input.useSessionFilter;}
      if (input.sessionStartUtc !== undefined)
        {updateData.sessionStartUtc = input.sessionStartUtc;}
      if (input.sessionEndUtc !== undefined)
        {updateData.sessionEndUtc = input.sessionEndUtc;}
      if (input.useBollingerSqueezeFilter !== undefined)
        {updateData.useBollingerSqueezeFilter = input.useBollingerSqueezeFilter;}
      if (input.bollingerSqueezeThreshold !== undefined)
        {updateData.bollingerSqueezeThreshold = input.bollingerSqueezeThreshold;}
      if (input.bollingerSqueezePeriod !== undefined)
        {updateData.bollingerSqueezePeriod = input.bollingerSqueezePeriod;}
      if (input.bollingerSqueezeStdDev !== undefined)
        {updateData.bollingerSqueezeStdDev = input.bollingerSqueezeStdDev;}
      if (input.useVwapFilter !== undefined)
        {updateData.useVwapFilter = input.useVwapFilter;}
      if (input.useSuperTrendFilter !== undefined)
        {updateData.useSuperTrendFilter = input.useSuperTrendFilter;}
      if (input.superTrendPeriod !== undefined)
        {updateData.superTrendPeriod = input.superTrendPeriod;}
      if (input.superTrendMultiplier !== undefined)
        {updateData.superTrendMultiplier = input.superTrendMultiplier;}
      if (input.directionMode !== undefined)
        {updateData.directionMode = input.directionMode;}

      await ctx.db
        .update(autoTradingConfig)
        .set(updateData)
        .where(eq(autoTradingConfig.id, config.id));

      if (input.isEnabled !== undefined) {
        log(input.isEnabled ? '✓ Auto-trading ENABLED' : '✗ Auto-trading DISABLED', {
          walletId: input.walletId,
          enabledSetupTypes: input.enabledSetupTypes,
        });
      }

      return { success: true };
    }),

  executeSetup: protectedProcedure
    .input(
      z.object({
        setupId: z.string(),
        walletId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).optional().default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('> executeSetup called', { setupId: input.setupId, walletId: input.walletId });

      const [setup] = await ctx.db
        .select()
        .from(setupDetections)
        .where(
          and(
            eq(setupDetections.id, input.setupId),
            eq(setupDetections.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!setup) {
        log('✗ Setup not found', { setupId: input.setupId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Setup not found',
        });
      }

      log('> Setup found', {
        setupType: setup.setupType,
        symbol: setup.symbol,
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        confidence: setup.confidence,
      });

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
        log('✗ Auto-trading config not found', { walletId: input.walletId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Auto-trading config not found',
        });
      }

      if (!config.isEnabled) {
        log('! Auto-trading is disabled', { walletId: input.walletId });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Auto-trading is not enabled for this wallet',
        });
      }

      const enabledSetupTypes = parseEnabledSetupTypes(config.enabledSetupTypes);
      if (!enabledSetupTypes.includes(setup.setupType)) {
        log('! Setup type not enabled', { setupType: setup.setupType, enabledTypes: enabledSetupTypes });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Setup type ${setup.setupType} is not enabled`,
        });
      }

      const openPositions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.status, 'open')
          )
        );

      const watcherStatus = autoTradingScheduler.getWatcherStatus(input.walletId);
      const effectiveMaxPositions = watcherStatus.watchers > 0 ? watcherStatus.watchers : config.maxConcurrentPositions;

      log('> Current open positions', {
        count: openPositions.length,
        max: effectiveMaxPositions,
        activeWatchers: watcherStatus.watchers,
        configMax: config.maxConcurrentPositions,
      });

      if (openPositions.length >= effectiveMaxPositions) {
        log('! Max concurrent positions reached', { current: openPositions.length, max: effectiveMaxPositions });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum concurrent positions (${effectiveMaxPositions}) reached`,
        });
      }

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot execute ${input.marketType} setup on ${wallet.marketType} wallet`,
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance || '0');
      const maxPositionSizePercent = parseFloat(config.maxPositionSize);

      const perWatcherExposurePercent = watcherStatus.watchers > 0
        ? 100 / watcherStatus.watchers
        : maxPositionSizePercent;
      const effectivePositionSizePercent = Math.min(perWatcherExposurePercent, maxPositionSizePercent);
      const positionValue = (walletBalance * effectivePositionSizePercent) / 100;

      log('> Position sizing', {
        walletBalance: walletBalance.toFixed(2),
        maxPositionSizePercent,
        activeWatchers: watcherStatus.watchers,
        perWatcherExposurePercent: perWatcherExposurePercent.toFixed(1),
        effectivePositionSizePercent: effectivePositionSizePercent.toFixed(1),
        positionValue: positionValue.toFixed(2),
      });

      const riskValidation = await riskManagerService.validateNewPositionLocked(
        input.walletId,
        config,
        positionValue,
        watcherStatus.watchers > 0 ? watcherStatus.watchers : undefined
      );

      if (!riskValidation.isValid) {
        log('! Risk validation failed', { reason: riskValidation.reason });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Risk validation failed: ${riskValidation.reason}`,
        });
      }

      log('✓ Risk validation passed');

      if (setup.stopLoss && setup.takeProfit) {
        const entryPrice = parseFloat(setup.entryPrice);
        const stopLoss = parseFloat(setup.stopLoss);
        const takeProfit = parseFloat(setup.takeProfit);

        let risk: number;
        let reward: number;

        if (setup.direction === 'LONG') {
          risk = entryPrice - stopLoss;
          reward = takeProfit - entryPrice;
        } else {
          risk = stopLoss - entryPrice;
          reward = entryPrice - takeProfit;
        }

        if (risk <= 0) {
          log('✗ Invalid stop loss - no risk', {
            setupType: setup.setupType,
            direction: setup.direction,
            entryPrice,
            stopLoss,
          });
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid stop loss - stop loss must be below entry for LONG or above entry for SHORT',
          });
        }

        const riskRewardRatio = reward / risk;

        if (riskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
          log('✗ Setup rejected - insufficient risk/reward ratio', {
            setupType: setup.setupType,
            direction: setup.direction,
            entryPrice,
            stopLoss,
            takeProfit,
            riskRewardRatio: riskRewardRatio.toFixed(2),
            minRequired: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
          });
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${TRADING_CONFIG.MIN_RISK_REWARD_RATIO}:1)`,
          });
        }

        log('✓ Risk/Reward ratio validated', {
          setupType: setup.setupType,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        });
      } else if (!setup.stopLoss) {
        log('✗ Missing stop loss', {
          setupType: setup.setupType,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Stop loss is required for trade execution',
        });
      } else {
        log('· Setup without take profit - skipping R:R validation', {
          setupType: setup.setupType,
        });
      }

      const executionId = generateEntityId();

      await ctx.db.insert(tradeExecutions).values({
        id: executionId,
        userId: ctx.user.id,
        walletId: input.walletId,
        setupId: input.setupId,
        setupType: setup.setupType,
        symbol: setup.symbol,
        side: setup.direction,
        entryPrice: setup.entryPrice,
        quantity: '0',
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        openedAt: new Date(),
        status: 'open',
        marketType: input.marketType,
        entryInterval: setup.interval,
        originalStopLoss: setup.stopLoss,
        highestPriceSinceEntry: setup.entryPrice,
        lowestPriceSinceEntry: setup.entryPrice,
        triggerKlineOpenTime: setup.detectedAt.getTime(),
      });

      log('✓ Trade execution created', {
        executionId,
        setupType: setup.setupType,
        symbol: setup.symbol,
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
      });

      return {
        executionId,
        message: 'Setup execution created successfully',
      };
    }),

  cancelExecution: protectedProcedure
    .input(
      z.object({
        executionId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('✗ cancelExecution called', { executionId: input.executionId });

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.id, input.executionId),
            eq(tradeExecutions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!execution) {
        log('✗ Execution not found', { executionId: input.executionId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
        log('! Cannot cancel - execution not open', { executionId: input.executionId, status: execution.status });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only cancel open executions',
        });
      }

      await ctx.db
        .update(tradeExecutions)
        .set({
          status: 'cancelled',
          closedAt: new Date(),
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          entryOrderId: null,
        })
        .where(eq(tradeExecutions.id, input.executionId));

      log('✓ Execution cancelled', {
        executionId: input.executionId,
        setupType: execution.setupType,
        symbol: execution.symbol,
      });

      return { success: true };
    }),

  getActiveExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            inArray(tradeExecutions.status, ['open', 'pending'])
          )
        )
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit);

      return executions;
    }),

  getExecutionHistory: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
      ];

      if (input.status) {
        whereConditions.push(eq(tradeExecutions.status, input.status));
      }

      if (input.startDate) {
        whereConditions.push(gte(tradeExecutions.openedAt, new Date(input.startDate)));
      }

      if (input.endDate) {
        whereConditions.push(
          sql`${tradeExecutions.openedAt} <= ${new Date(input.endDate)}`
        );
      }

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit);

      return executions;
    }),

  closeExecution: protectedProcedure
    .input(
      z.object({
        executionId: z.string(),
        exitPrice: z.string(),
        exitOrderId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('> closeExecution called', { executionId: input.executionId, exitPrice: input.exitPrice });

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.id, input.executionId),
            eq(tradeExecutions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!execution) {
        log('✗ Execution not found', { executionId: input.executionId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
        log('! Cannot close - execution not open', { executionId: input.executionId, status: execution.status });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Execution is not open',
        });
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const exitPrice = parseFloat(input.exitPrice);
      const qty = parseFloat(execution.quantity);
      const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';

      const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
        entryPrice,
        exitPrice,
        quantity: qty,
        side: execution.side as 'LONG' | 'SHORT',
        marketType,
      });

      await ctx.db
        .update(tradeExecutions)
        .set({
          exitPrice: input.exitPrice,
          exitOrderId: input.exitOrderId,
          pnl: netPnl.toString(),
          pnlPercent: pnlPercent.toString(),
          fees: totalFees.toString(),
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
        })
        .where(eq(tradeExecutions.id, input.executionId));

      const isWin = netPnl > 0;
      log(`${isWin ? '✓ WIN' : '✗ LOSS'} Execution closed`, {
        executionId: input.executionId,
        setupType: execution.setupType,
        symbol: execution.symbol,
        side: execution.side,
        entryPrice: entryPrice.toFixed(2),
        exitPrice: exitPrice.toFixed(2),
        grossPnl: grossPnl.toFixed(2),
        fees: totalFees.toFixed(4),
        netPnl: netPnl.toFixed(2),
        pnlPercent: `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
      });

      return {
        pnl: netPnl.toString(),
        pnlPercent: pnlPercent.toFixed(2),
      };
    }),

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
      const activeWatchers = autoTradingScheduler.getActiveWatchers().filter(
        w => w.watcherId.startsWith(input.walletId)
      );

      return {
        active: memoryStatus.active,
        watchers: memoryStatus.watchers,
        activeWatchers: memoryStatus.active
          ? activeWatchers
          : dbStatus.watcherDetails.map(w => ({ watcherId: `${input.walletId}-${w.symbol}-${w.interval}`, ...w })),
        persistedWatchers: dbStatus.watchers,
      };
    }),

  getTopSymbols: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(50).default(12),
      })
    )
    .query(async ({ input }) => {
      log('> getTopSymbols called', { marketType: input.marketType, limit: input.limit });
      const symbols = await getTopSymbolsByVolume(input.marketType, input.limit);
      log('✓ Top symbols fetched', { count: symbols.length });
      return symbols;
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

  getTopCoinsByMarketCap: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(100).default(100),
      })
    )
    .query(async ({ input }) => {
      log('> getTopCoinsByMarketCap called', { marketType: input.marketType, limit: input.limit });
      const marketCapService = getMarketCapDataService();
      const coins = await marketCapService.getTopCoinsByMarketCap(input.limit, input.marketType);
      log('✓ Top coins fetched', { count: coins.length });
      return coins;
    }),

  getDynamicSymbolScores: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX * AUTO_TRADING_CONFIG.SYMBOL_FETCH_MULTIPLIER).default(AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT),
      })
    )
    .query(async ({ input }) => {
      const scoringService = getOpportunityScoringService();
      const scores = await scoringService.getSymbolScores(input.marketType, input.limit);
      logApiTable('getDynamicSymbolScores', [
        ['Market Type', input.marketType],
        ['Limit', input.limit],
        ['Scores Fetched', `✓ ${scores.length}`],
      ]);
      return scores;
    }),

  getFilteredSymbolsForQuickStart: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        interval: z.string().default('30m'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX).default(10),
        useBtcCorrelationFilter: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
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

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const positionSizePercent = parseFloat(config?.positionSizePercent ?? String(TRADING_DEFAULTS.POSITION_SIZE_PERCENT));

      const scoringService = getOpportunityScoringService();
      const minNotionalFilter = getMinNotionalFilterService();

      const fetchMultiplier = 10;
      const scores = await scoringService.getSymbolScores(input.marketType, Math.min(input.limit * fetchMultiplier, 200));

      let allSymbols: string[];
      if (scores.length > 0) {
        allSymbols = scores.map(s => s.symbol);
      } else {
        allSymbols = await getTopSymbolsByVolume(input.marketType, Math.min(input.limit * fetchMultiplier, 200));
        logger.info({ count: allSymbols.length }, '[getFilteredSymbolsForQuickStart] Using top symbols by volume as fallback');
      }

      const { maxWatchers, capitalPerWatcher, eligibleSymbols: capitalEligible, excludedSymbols } =
        await minNotionalFilter.calculateMaxWatchersFromSymbols(
          allSymbols,
          walletBalance,
          leverage,
          positionSizePercent,
          input.marketType
        );

      const filteredSymbolSet = new Set(capitalEligible);
      const filteredScores = scores.length > 0
        ? scores.filter(s => filteredSymbolSet.has(s.symbol))
        : allSymbols.filter(s => filteredSymbolSet.has(s)).map(symbol => ({ symbol, score: 0 }));

      let btcTrendInfo: Ema21TrendResult | null = null;

      if (input.useBtcCorrelationFilter) {
        const btcDbKlines = await ctx.db.query.klines.findMany({
          where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, input.interval)),
          orderBy: [desc(klines.openTime)],
          limit: 100,
        });

        if (btcDbKlines.length >= 30) {
          const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
          btcTrendInfo = getEma21Direction(btcKlinesData);
          log('> BTC Correlation Filter - Trend', {
            direction: btcTrendInfo.direction,
            price: btcTrendInfo.price?.toFixed(2),
            ema21: btcTrendInfo.ema21?.toFixed(2),
          });
        } else {
          logger.warn({ count: btcDbKlines.length }, '[getFilteredSymbolsForQuickStart] Insufficient BTC klines for trend analysis');
        }
      }

      const eligibleSymbols: string[] = [];
      const skippedInsufficientKlines: string[] = [];
      const skippedInsufficientCapital = Array.from(excludedSymbols.keys());
      const skippedTrend: { symbol: string; reason: string }[] = [];

      for (const score of filteredScores) {
        const klineCheck = await checkKlineAvailability(
          score.symbol,
          input.interval,
          input.marketType,
          true
        );

        if (!klineCheck.hasSufficient) {
          skippedInsufficientKlines.push(score.symbol);
          continue;
        }

        eligibleSymbols.push(score.symbol);

        if (eligibleSymbols.length >= input.limit * 2) break;
      }

      const btcTrendEmoji = btcTrendInfo?.direction === 'BULLISH' ? '✓' : btcTrendInfo?.direction === 'BEARISH' ? '✗' : '·';

      logApiTable('getFilteredSymbolsForQuickStart', [
        ['Market Type', input.marketType],
        ['Interval', input.interval],
        ['Target Count', input.limit],
        ['Wallet Balance', `$${walletBalance.toFixed(2)}`],
        ['Leverage', `${leverage}x`],
        ['Total Scored', scores.length],
        ['Eligible (Capital)', capitalEligible.length],
        ['Skipped (Capital)', skippedInsufficientCapital.length],
        ['Skipped (Klines)', skippedInsufficientKlines.length],
        ['Final Symbols', eligibleSymbols.length],
        ['Max Affordable', maxWatchers],
        ['BTC Trend', btcTrendInfo ? `${btcTrendEmoji} ${btcTrendInfo.direction}` : 'N/A'],
      ]);

      return {
        symbols: eligibleSymbols,
        skippedInsufficientCapital,
        skippedInsufficientKlines,
        skippedTrend,
        capitalPerWatcher,
        maxAffordableWatchers: maxWatchers,
        btcTrend: btcTrendInfo ? {
          direction: btcTrendInfo.direction,
          isClearTrend: true,
          adx: 0,
          strength: 0,
          rsi: 0,
        } : null,
      };
    }),

  getCapitalLimits: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .query(async ({ input, ctx }) => {
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

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const positionSizePercent = parseFloat(config?.positionSizePercent ?? String(TRADING_DEFAULTS.POSITION_SIZE_PERCENT));

      const limits = calculateCapitalLimits({
        walletBalance,
        leverage,
        positionSizePercent,
        marketType: input.marketType,
      });

      const minNotionalFilter = getMinNotionalFilterService();
      const capitalPerWatcher = minNotionalFilter.getCapitalPerWatcher(
        limits.availableCapital,
        limits.maxAffordableWatchers,
        positionSizePercent
      );

      logApiTable('getCapitalLimits', [
        ['Wallet Balance', `$${walletBalance.toFixed(2)}`],
        ['Leverage', `${leverage}x`],
        ['Position Size', `${positionSizePercent}%`],
        ['Available Capital', `$${limits.availableCapital.toFixed(2)}`],
        [`Max Capital/Position (1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO})`, `$${limits.maxCapitalPerPosition.toFixed(2)}`],
        ['Effective Min Required', `$${limits.effectiveMinRequired.toFixed(2)}`],
        ['Capital Per Watcher', `$${capitalPerWatcher.toFixed(2)}`],
        ['Max Affordable Watchers', limits.maxAffordableWatchers],
      ]);

      return {
        walletBalance,
        leverage,
        positionSizePercent,
        availableCapital: limits.availableCapital,
        maxAffordableWatchers: limits.maxAffordableWatchers,
        capitalPerWatcher,
        maxCapitalPerPosition: limits.maxCapitalPerPosition,
      };
    }),

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
          marketType: (wallet.marketType as 'SPOT' | 'FUTURES') || 'FUTURES',
          interval: rotationConfig.interval,
          profileId: undefined,
          leverage: config.leverage ?? 1,
          positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
          walletBalance: parseFloat(wallet.currentBalance ?? '0'),
          useBtcCorrelationFilter: config.useBtcCorrelationFilter ?? true,
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

  getBtcTrendStatus: protectedProcedure
    .input(z.object({ interval: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const interval = input?.interval ?? '4h';
      const btcKlinesData = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, interval)),
        orderBy: [desc(klines.openTime)],
        limit: 50,
      });

      const mappedKlines = mapDbKlinesReversed(btcKlinesData);
      const trendInfo = getBtcTrendEmaInfoWithHistory(mappedKlines);
      const trendEmoji = trendInfo.trend === 'BULLISH' ? '✓' : trendInfo.trend === 'BEARISH' ? '✗' : '·';
      logApiTable('getBtcTrendStatus', [
        ['Interval', interval],
        ['Trend', `${trendEmoji} ${trendInfo.trend}`],
        ['EMA21 Filter', `canLong: ${trendInfo.canLong}, canShort: ${trendInfo.canShort}`],
        ['History Points', trendInfo.history.length],
      ]);

      return trendInfo;
    }),

  getBatchFundingRates: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX * AUTO_TRADING_CONFIG.SYMBOL_FETCH_MULTIPLIER),
      })
    )
    .query(async ({ input }) => {
      const futuresService = getBinanceFuturesDataService();
      const allMarkPrices = await futuresService.getAllMarkPrices();

      const EXTREME_FUNDING_THRESHOLD = 0.001;

      const results = input.symbols.map((symbol) => {
        const info = allMarkPrices.find((p) => p.symbol === symbol);
        const rate = info?.lastFundingRate !== undefined ? info.lastFundingRate / 100 : null;
        const isExtreme = rate !== null && Math.abs(rate) >= EXTREME_FUNDING_THRESHOLD;

        return {
          symbol,
          rate,
          isExtreme,
          blocksLong: isExtreme && rate !== null && rate > 0,
          blocksShort: isExtreme && rate !== null && rate < 0,
        };
      });

      const extremeCount = results.filter((r) => r.isExtreme).length;
      logApiTable('getBatchFundingRates', [
        ['Symbols', input.symbols.length],
        ['Total Fetched', `✓ ${results.length}`],
        ['Extreme Rates', extremeCount > 0 ? `! ${extremeCount}` : `${extremeCount}`],
      ]);

      return results;
    }),

  emergencyStop: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      log('! EMERGENCY STOP initiated', { walletId: input.walletId });

      const result = {
        watchersStopped: 0,
        algoOrdersCancelled: 0,
        positionsClosed: 0,
        errors: [] as string[],
      };

      try {
        await autoTradingScheduler.stopAllWatchersForWallet(input.walletId);
        result.watchersStopped = 1;
        log(`✗ Stopped all watchers for wallet`, { walletId: input.walletId });
      } catch (error) {
        const errorMsg = serializeError(error);
        result.errors.push(`Failed to stop watchers: ${errorMsg}`);
        logger.error({ error: errorMsg }, '[EmergencyStop] Failed to stop watchers');
      }

      const walletMarketType = wallet.marketType || 'FUTURES';

      const openExecutions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, walletMarketType)
          )
        );

      if (!isPaperWallet(wallet) && walletMarketType === 'FUTURES') {
        try {
          const client = createBinanceFuturesClient(wallet);

          const uniqueSymbols = [...new Set(openExecutions.map((e) => e.symbol))];

          for (const symbol of uniqueSymbols) {
            try {
              await cancelAllFuturesAlgoOrders(client, symbol);
              result.algoOrdersCancelled++;
              log(`✗ Cancelled algo orders for ${symbol}`, { walletId: input.walletId, symbol });
            } catch (error) {
              const errorMsg = serializeError(error);
              if (!errorMsg.includes('No algo orders')) {
                result.errors.push(`Failed to cancel algo orders for ${symbol}: ${errorMsg}`);
              }
            }
          }

          const exitPricesBySymbol = new Map<string, string>();

          const minNotionalFilter = getMinNotionalFilterService();
          const symbolFilters = await minNotionalFilter.getSymbolFilters('FUTURES');

          const exchangePositions = await getPositions(client);
          for (const position of exchangePositions) {
            if (parseFloat(position.positionAmt) === 0) continue;

            try {
              const filters = symbolFilters.get(position.symbol);
              const stepSize = filters?.stepSize?.toString();

              const closeResult = await closePosition(
                client,
                position.symbol,
                position.positionAmt,
                stepSize
              );
              exitPricesBySymbol.set(position.symbol, closeResult.avgPrice);
              result.positionsClosed++;
              log(`▼ Closed position ${position.symbol}`, {
                walletId: input.walletId,
                symbol: position.symbol,
                amount: position.positionAmt,
                exitPrice: closeResult.avgPrice,
              });
            } catch (error) {
              const errorMsg = serializeError(error);
              result.errors.push(`Failed to close position ${position.symbol}: ${errorMsg}`);
              logger.error(
                { error: errorMsg, symbol: position.symbol },
                '[EmergencyStop] Failed to close position'
              );
            }
          }

          for (const execution of openExecutions) {
            const exitPrice = exitPricesBySymbol.get(execution.symbol);
            if (exitPrice) {
              const entryPrice = parseFloat(execution.entryPrice);
              const exitPriceNum = parseFloat(exitPrice);
              const qty = parseFloat(execution.quantity || '0');
              const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';

              const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
                entryPrice,
                exitPrice: exitPriceNum,
                quantity: qty,
                side: execution.side as 'LONG' | 'SHORT',
                marketType,
              });

              await ctx.db
                .update(tradeExecutions)
                .set({
                  status: 'closed',
                  exitSource: 'MANUAL',
                  exitReason: 'EMERGENCY_STOP',
                  exitPrice: exitPrice,
                  pnl: netPnl.toString(),
                  pnlPercent: pnlPercent.toString(),
                  fees: totalFees.toString(),
                  closedAt: new Date(),
                  updatedAt: new Date(),
                  stopLossAlgoId: null,
                  stopLossOrderId: null,
                  takeProfitAlgoId: null,
                  takeProfitOrderId: null,
                })
                .where(eq(tradeExecutions.id, execution.id));

              log(`> Emergency closed execution`, {
                executionId: execution.id,
                symbol: execution.symbol,
                side: execution.side,
                entryPrice,
                exitPrice: exitPriceNum,
                grossPnl: grossPnl.toFixed(2),
                fees: totalFees.toFixed(2),
                netPnl: netPnl.toFixed(2),
                pnlPercent: pnlPercent.toFixed(2),
              });
            } else {
              await ctx.db
                .update(tradeExecutions)
                .set({
                  status: 'closed',
                  exitSource: 'MANUAL',
                  exitReason: 'EMERGENCY_STOP',
                  closedAt: new Date(),
                  updatedAt: new Date(),
                  stopLossAlgoId: null,
                  stopLossOrderId: null,
                  takeProfitAlgoId: null,
                  takeProfitOrderId: null,
                })
                .where(eq(tradeExecutions.id, execution.id));
            }
          }
        } catch (error) {
          const errorMsg = serializeError(error);
          result.errors.push(`Exchange operation failed: ${errorMsg}`);
          logger.error({ error: errorMsg }, '[EmergencyStop] Exchange operation failed');
        }
      } else {
        if (!isPaperWallet(wallet) && walletMarketType === 'SPOT') {
          log('! SPOT wallet emergency stop - positions NOT closed on exchange, manual close required', {
            walletId: input.walletId,
            openExecutions: openExecutions.length,
          });
          result.errors.push('SPOT positions must be manually closed on exchange');
        }

        for (const execution of openExecutions) {
          await ctx.db
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitSource: 'MANUAL',
              exitReason: 'EMERGENCY_STOP',
              closedAt: new Date(),
              updatedAt: new Date(),
              stopLossAlgoId: null,
              stopLossOrderId: null,
              takeProfitAlgoId: null,
              takeProfitOrderId: null,
            })
            .where(eq(tradeExecutions.id, execution.id));
        }
      }

      const [config] = await ctx.db
        .select()
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, input.walletId))
        .limit(1);

      if (config) {
        await ctx.db
          .update(autoTradingConfig)
          .set({
            isEnabled: false,
            updatedAt: new Date(),
          })
          .where(eq(autoTradingConfig.id, config.id));
      }

      log('! EMERGENCY STOP completed', {
        walletId: input.walletId,
        ...result,
      });

      return {
        success: result.errors.length === 0,
        ...result,
      };
    }),

  getPyramidIndicators: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      interval: z.string().default('1h'),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ ctx, input }) => {
      const dbKlines = await ctx.db
        .select()
        .from(klines)
        .where(and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval),
          eq(klines.marketType, input.marketType)
        ))
        .orderBy(desc(klines.openTime))
        .limit(100);

      if (dbKlines.length < 30) {
        return {
          symbol: input.symbol,
          interval: input.interval,
          atr: null,
          adx: null,
          rsi: null,
          plusDI: null,
          minusDI: null,
          trendStrength: 'unknown' as const,
          message: 'Insufficient kline data for indicator calculation',
        };
      }

      const mappedKlines = mapDbKlinesReversed(dbKlines);
      const indicators = getCurrentIndicatorValues(mappedKlines);

      let trendStrength: 'strong' | 'moderate' | 'weak' | 'unknown' = 'unknown';
      if (indicators.adx !== null) {
        if (indicators.adx >= 40) trendStrength = 'strong';
        else if (indicators.adx >= 25) trendStrength = 'moderate';
        else trendStrength = 'weak';
      }

      return {
        symbol: input.symbol,
        interval: input.interval,
        ...indicators,
        trendStrength,
        message: null,
      };
    }),

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

  recoverUnprotectedPosition: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      stopLoss: z.number().optional(),
      takeProfit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      log('# recoverUnprotectedPosition called', { executionId: input.executionId });

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.id, input.executionId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open')
        ))
        .limit(1);

      if (!execution) {
        log('✗ Execution not found or not open', { executionId: input.executionId });
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Open execution not found' });
      }

      if (execution.stopLoss) {
        log('! Execution already has stop loss', { executionId: input.executionId, stopLoss: execution.stopLoss });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Execution already has a stop loss' });
      }

      const wallet = await walletQueries.getByIdAndUser(execution.walletId, ctx.user.id);
      const marketType = (execution.marketType || 'FUTURES') as 'SPOT' | 'FUTURES';

      const currentPrice = await positionMonitorService.getCurrentPrice(execution.symbol, marketType);

      const stopLoss = input.stopLoss ?? (
        execution.side === 'LONG'
          ? currentPrice * (1 - PROTECTION_CONFIG.EMERGENCY_SL_PERCENT)
          : currentPrice * (1 + PROTECTION_CONFIG.EMERGENCY_SL_PERCENT)
      );

      log('> Recovery parameters', {
        executionId: input.executionId,
        symbol: execution.symbol,
        side: execution.side,
        currentPrice,
        calculatedStopLoss: stopLoss,
        userProvidedSL: input.stopLoss,
      });

      const slResult = await autoTradingService.createStopLossOrder(
        wallet,
        execution.symbol,
        parseFloat(execution.quantity),
        stopLoss,
        execution.side as 'LONG' | 'SHORT',
        marketType
      );

      const algoId = slResult.isAlgoOrder ? slResult.algoId : null;
      const orderId = slResult.isAlgoOrder ? null : slResult.orderId;

      await ctx.db
        .update(tradeExecutions)
        .set({
          stopLoss: stopLoss.toString(),
          stopLossAlgoId: algoId,
          stopLossOrderId: orderId,
          stopLossIsAlgo: slResult.isAlgoOrder,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.executionId));

      log('✓ Stop loss added to unprotected position', {
        executionId: input.executionId,
        symbol: execution.symbol,
        stopLoss,
        algoId,
        orderId,
      });

      return {
        success: true,
        stopLoss,
        algoId,
        orderId,
      };
    }),

  getFearGreedIndex: protectedProcedure.query(async () => {
    const service = getFearGreedDataService();
    const result = await service.getFearGreedIndex();
    if (result.current) {
      logApiTable('getFearGreedIndex', [
        ['Value', result.current.value],
        ['Classification', result.current.valueClassification],
      ]);
    }
    return result;
  }),

  getBtcDominance: protectedProcedure.query(async () => {
    const service = getBTCDominanceDataService();
    const result = await service.getBTCDominanceResult();
    const trendEmoji = result.trend === 'increasing' ? '▲' : result.trend === 'decreasing' ? '▼' : '·';
    logApiTable('getBtcDominance', [
      ['Current', result.current !== null ? `${result.current.toFixed(2)}%` : 'N/A'],
      ['Change 24h', result.change24h !== null ? `${result.change24h >= 0 ? '+' : ''}${result.change24h.toFixed(2)}%` : 'N/A'],
      ['Trend', `${trendEmoji} ${result.trend}`],
    ]);
    return result;
  }),

  getAltcoinSeasonIndex: protectedProcedure.query(async () => {
    const service = getAltcoinSeasonIndexService();
    const historyService = getIndicatorHistoryService();
    const result = await service.getAltcoinSeasonIndex();
    const history = await historyService.getIndicatorHistory('ALTCOIN_SEASON', 31);

    const seasonIcon = result.seasonType === 'ALT_SEASON' ? '>' : result.seasonType === 'BTC_SEASON' ? '#' : '~';
    logApiTable('getAltcoinSeasonIndex', [
      ['Season', `${seasonIcon} ${result.seasonType}`],
      ['Index', `${result.altSeasonIndex.toFixed(1)}%`],
      ['Alts > BTC', `${result.altsOutperformingBtc}/${result.totalAltsAnalyzed}`],
      ['BTC 24h', `${result.btcPerformance24h >= 0 ? '+' : ''}${result.btcPerformance24h.toFixed(2)}%`],
      ['Avg Alt 24h', `${result.avgAltPerformance24h >= 0 ? '+' : ''}${result.avgAltPerformance24h.toFixed(2)}%`],
      ['History Points', history.history.length.toString()],
    ]);

    return {
      ...result,
      history: history.history,
      change24h: history.change24h,
    };
  }),

  getBtcAdxTrendStrength: protectedProcedure
    .input(z.object({ interval: z.string().default('12h') }))
    .query(async ({ input, ctx }) => {
      const historyService = getIndicatorHistoryService();
      const history = await historyService.getIndicatorHistory('ADX', 31);

      const btcDbKlines = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, input.interval)),
        orderBy: [desc(klines.openTime)],
        limit: 100,
      });

      if (btcDbKlines.length < 50) {
        return {
          adx: null,
          plusDI: null,
          minusDI: null,
          isStrongTrend: false,
          isBullish: false,
          isBearish: false,
          isChoppy: true,
          reason: 'Insufficient data',
          history: history.history,
          change24h: history.change24h,
        };
      }

      const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
      const adxResult = checkAdxCondition(btcKlinesData, 'LONG');
      const isChoppy = adxResult.adx !== null && adxResult.adx < 20;

      logApiTable('getBtcAdxTrendStrength', [
        ['ADX', adxResult.adx !== null ? adxResult.adx.toFixed(2) : 'N/A'],
        ['+DI', adxResult.plusDI !== null ? adxResult.plusDI.toFixed(2) : 'N/A'],
        ['-DI', adxResult.minusDI !== null ? adxResult.minusDI.toFixed(2) : 'N/A'],
        ['Strong Trend', adxResult.isStrongTrend ? '✓' : '✗'],
        ['Choppy', isChoppy ? '! Yes' : 'No'],
        ['History Points', history.history.length.toString()],
      ]);

      return {
        adx: adxResult.adx,
        plusDI: adxResult.plusDI,
        minusDI: adxResult.minusDI,
        isStrongTrend: adxResult.isStrongTrend,
        isBullish: adxResult.isBullish,
        isBearish: adxResult.isBearish,
        isChoppy,
        reason: adxResult.reason,
        history: history.history,
        change24h: history.change24h,
      };
    }),

  getOrderBookAnalysis: protectedProcedure
    .input(z.object({
      symbol: z.string().default('BTCUSDT'),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ input }) => {
      const service = getOrderBookAnalyzerService();
      const result = await service.getOrderBookAnalysis(input.symbol, input.marketType);

      const pressureEmoji = result.pressure === 'BUYING' ? '▲' : result.pressure === 'SELLING' ? '▼' : '·';
      logApiTable('getOrderBookAnalysis', [
        ['Symbol', result.symbol],
        ['Pressure', `${pressureEmoji} ${result.pressure}`],
        ['Imbalance', result.imbalanceRatio.toFixed(2)],
        ['Bid Volume', `$${(result.bidVolume / 1e6).toFixed(2)}M`],
        ['Ask Volume', `$${(result.askVolume / 1e6).toFixed(2)}M`],
        ['Spread', `${result.spreadPercent.toFixed(4)}%`],
        ['Bid Walls', result.bidWalls.length.toString()],
        ['Ask Walls', result.askWalls.length.toString()],
      ]);

      return result;
    }),

  getOpenInterest: protectedProcedure
    .input(z.object({ symbol: z.string().default('BTCUSDT') }))
    .query(async ({ input }) => {
      const service = getBinanceFuturesDataService();
      const current = await service.getCurrentOpenInterest(input.symbol);
      const history = await service.getOpenInterest(input.symbol);

      let change24h: number | null = null;
      if (history.length > 0 && current) {
        const oldest = history[0];
        if (oldest) {
          change24h = ((current.openInterest - oldest.value) / oldest.value) * 100;
        }
      }

      logApiTable('getOpenInterest', [
        ['Symbol', input.symbol],
        ['Current OI', current ? `${(current.openInterest / 1000).toFixed(2)}K` : 'N/A'],
        ['Change 24h', change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : 'N/A'],
      ]);

      return {
        symbol: input.symbol,
        current: current?.openInterest ?? null,
        change24h,
        history: history.slice(-24),
      };
    }),

  getLongShortRatio: protectedProcedure
    .input(z.object({
      symbol: z.string().default('BTCUSDT'),
      period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).default('1h'),
    }))
    .query(async ({ input }) => {
      const service = getBinanceFuturesDataService();
      const [globalRatio, topTraderRatio] = await Promise.all([
        service.getLongShortRatio(input.symbol, input.period),
        service.getTopTraderLongShortRatio(input.symbol, input.period),
      ]);

      const latestGlobal = globalRatio[globalRatio.length - 1];
      const latestTopTrader = topTraderRatio[topTraderRatio.length - 1];

      logApiTable('getLongShortRatio', [
        ['Symbol', input.symbol],
        ['Period', input.period],
        ['Global L/S', latestGlobal ? `${(latestGlobal.longAccount * 100).toFixed(1)}% / ${(latestGlobal.shortAccount * 100).toFixed(1)}%` : 'N/A'],
        ['Top Traders L/S', latestTopTrader ? `${(latestTopTrader.longAccount * 100).toFixed(1)}% / ${(latestTopTrader.shortAccount * 100).toFixed(1)}%` : 'N/A'],
      ]);

      return {
        symbol: input.symbol,
        period: input.period,
        global: latestGlobal ? {
          longAccount: latestGlobal.longAccount,
          shortAccount: latestGlobal.shortAccount,
          ratio: latestGlobal.longShortRatio,
        } : null,
        topTraders: latestTopTrader ? {
          longAccount: latestTopTrader.longAccount,
          shortAccount: latestTopTrader.shortAccount,
          ratio: latestTopTrader.longShortRatio,
        } : null,
        globalHistory: globalRatio.slice(-24),
        topTraderHistory: topTraderRatio.slice(-24),
      };
    }),

  getMvrvRatio: protectedProcedure.query(async () => {
    const service = getOnChainDataService();
    const result = await service.getOnChainMetrics();
    logApiTable('getMvrvRatio', [
      ['Current', result.mvrv.current !== null ? result.mvrv.current.toFixed(2) : 'N/A'],
      ['History Points', result.mvrv.history.length.toString()],
    ]);
    return result.mvrv;
  }),

  getBtcProductionCost: protectedProcedure.query(async () => {
    const service = getOnChainDataService();
    const result = await service.getOnChainMetrics();
    logApiTable('getBtcProductionCost', [
      ['Cost', result.productionCost.currentCost !== null ? `$${result.productionCost.currentCost.toFixed(0)}` : 'N/A'],
      ['Price', result.productionCost.currentPrice !== null ? `$${result.productionCost.currentPrice.toFixed(0)}` : 'N/A'],
      ['History Points', result.productionCost.history.length.toString()],
    ]);
    return result.productionCost;
  }),

  saveIndicatorSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
    const historyService = getIndicatorHistoryService();
    const altSeasonService = getAltcoinSeasonIndexService();
    const orderBookService = getOrderBookAnalyzerService();

    const btcDbKlines = await ctx.db.query.klines.findMany({
      where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, '12h')),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    let adxSaved = false;
    if (btcDbKlines.length >= 50) {
      const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
      const adxResult = checkAdxCondition(btcKlinesData, 'LONG');
      if (adxResult.adx !== null) {
        await historyService.saveIndicatorValue('ADX', adxResult.adx, {
          plusDI: adxResult.plusDI,
          minusDI: adxResult.minusDI,
          isStrongTrend: adxResult.isStrongTrend,
        });
        adxSaved = true;
      }
    }

    const altSeason = await altSeasonService.getAltcoinSeasonIndex();
    await historyService.saveIndicatorValue('ALTCOIN_SEASON', altSeason.altSeasonIndex, {
      seasonType: altSeason.seasonType,
      altsOutperformingBtc: altSeason.altsOutperformingBtc,
      totalAltsAnalyzed: altSeason.totalAltsAnalyzed,
    });

    const orderBook = await orderBookService.getOrderBookAnalysis('BTCUSDT', 'FUTURES');
    await historyService.saveIndicatorValue('ORDER_BOOK_IMBALANCE', orderBook.imbalanceRatio, {
      pressure: orderBook.pressure,
      bidWalls: orderBook.bidWalls.length,
      askWalls: orderBook.askWalls.length,
    });

    logApiTable('saveIndicatorSnapshot', [
      ['ADX', adxSaved ? '✓' : '✗'],
      ['Altcoin Season', '✓'],
      ['Order Book', '✓'],
    ]);

    return { success: true, adxSaved, altSeasonSaved: true, orderBookSaved: true };
  }),

  getMinActiveWatcherInterval: protectedProcedure.query(async () => {
    const activeWatchers = autoTradingScheduler.getActiveWatchers();

    if (activeWatchers.length === 0) {
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

    for (const watcher of activeWatchers) {
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
      activeWatcherCount: activeWatchers.length,
    };
  }),
});
