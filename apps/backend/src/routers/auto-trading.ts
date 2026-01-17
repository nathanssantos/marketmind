import { colorize, createTable } from '@marketmind/logger';
import { AUTO_TRADING_CONFIG, FIBONACCI_TARGET_LEVELS } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../constants';
import {
    activeWatchers,
    autoTradingConfig,
    klines,
    setupDetections,
    tradeExecutions,
} from '../db/schema';
import { autoTradingScheduler } from '../services/auto-trading-scheduler';
import { getTopSymbolsByVolume } from '../services/binance-exchange-info';
import { cancelAllFuturesAlgoOrders, closePosition, createBinanceFuturesClient, getPositions, isPaperWallet } from '../services/binance-futures-client';
import { getBinanceFuturesDataService } from '../services/binance-futures-data';
import { walletQueries } from '../services/database/walletQueries';
import { getCurrentIndicatorValues } from '../services/dynamic-pyramid-evaluator';
import { getDynamicSymbolRotationService } from '../services/dynamic-symbol-rotation';
import { checkKlineAvailability } from '../services/kline-prefetch';
import { logger } from '../services/logger';
import { getMarketCapDataService } from '../services/market-cap-data';
import { getMinNotionalFilterService } from '../services/min-notional-filter';
import { getOpportunityScoringService } from '../services/opportunity-scoring';
import { riskManagerService } from '../services/risk-manager';
import { protectedProcedure, router } from '../trpc';
import { serializeError } from '../utils/errors';
import { getBtcTrendInfo } from '../utils/filters/btc-correlation-filter';
import { generateEntityId } from '../utils/id';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { calculatePnl } from '../utils/pnl-calculator';
import { parseEnabledSetupTypes, stringifyDynamicSymbolExcluded, stringifyEnabledSetupTypes, transformAutoTradingConfig } from '../utils/profile-transformers';

const PYRAMID_FIBO_LEVELS = ['1', '1.272', '1.618', '2', '2.618'] as const;

const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Auto-Trading] ${message}`);
  } else {
    logger.info(`[Auto-Trading] ${message}`);
  }
};

const logApiTable = (endpoint: string, rows: [string, string | number][]): void => {
  const table = createTable({ head: ['Field', 'Value'], headColor: 'cyan', colWidths: [25, 30] });
  rows.forEach(row => table.push([colorize(row[0], 'dim'), String(row[1])]));
  console.log(`\n  📊 ${colorize(endpoint, 'cyan')}`);
  console.log(table.toString());
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
        useAdxFilter: z.boolean().optional(),
        useTrendFilter: z.boolean().optional(),
        exposureMultiplier: z.string().optional(),
        tpCalculationMode: z.enum(['default', 'fibonacci']).optional(),
        fibonacciTargetLevel: z.enum(FIBONACCI_TARGET_LEVELS).optional(),
        useDynamicSymbolSelection: z.boolean().optional(),
        dynamicSymbolLimit: z.number().min(AUTO_TRADING_CONFIG.DYNAMIC_SYMBOL_LIMIT.MIN).max(AUTO_TRADING_CONFIG.DYNAMIC_SYMBOL_LIMIT.MAX).optional(),
        dynamicSymbolRotationInterval: z.enum(['1h', '4h', '1d']).optional(),
        dynamicSymbolExcluded: z.array(z.string()).optional(),
        enableAutoRotation: z.boolean().optional(),
        trailingStopMode: z.enum(['local', 'binance']).optional(),
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
        pyramidFiboLevels: z.array(z.enum(PYRAMID_FIBO_LEVELS)).optional(),
        leverageAwarePyramid: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('📝 updateConfig called', { walletId: input.walletId, isEnabled: input.isEnabled });

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
        log('❌ Config not found for wallet', { walletId: input.walletId });
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
      if (input.useAdxFilter !== undefined)
        {updateData.useAdxFilter = input.useAdxFilter;}
      if (input.useTrendFilter !== undefined)
        {updateData.useTrendFilter = input.useTrendFilter;}
      if (input.exposureMultiplier !== undefined)
        {updateData.exposureMultiplier = input.exposureMultiplier;}
      if (input.tpCalculationMode !== undefined)
        {updateData.tpCalculationMode = input.tpCalculationMode;}
      if (input.fibonacciTargetLevel !== undefined)
        {updateData.fibonacciTargetLevel = input.fibonacciTargetLevel;}
      if (input.useDynamicSymbolSelection !== undefined)
        {updateData.useDynamicSymbolSelection = input.useDynamicSymbolSelection;}
      if (input.dynamicSymbolLimit !== undefined)
        {updateData.dynamicSymbolLimit = input.dynamicSymbolLimit;}
      if (input.dynamicSymbolRotationInterval !== undefined)
        {updateData.dynamicSymbolRotationInterval = input.dynamicSymbolRotationInterval;}
      if (input.dynamicSymbolExcluded !== undefined)
        {updateData.dynamicSymbolExcluded = stringifyDynamicSymbolExcluded(input.dynamicSymbolExcluded);}
      if (input.enableAutoRotation !== undefined)
        {updateData.enableAutoRotation = input.enableAutoRotation;}
      if (input.trailingStopMode !== undefined)
        {updateData.trailingStopMode = input.trailingStopMode;}
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

      await ctx.db
        .update(autoTradingConfig)
        .set(updateData)
        .where(eq(autoTradingConfig.id, config.id));

      if (input.isEnabled !== undefined) {
        log(input.isEnabled ? '🟢 Auto-trading ENABLED' : '🔴 Auto-trading DISABLED', {
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
        marketType: z.enum(['SPOT', 'FUTURES']).optional().default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🚀 executeSetup called', { setupId: input.setupId, walletId: input.walletId });

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
        log('❌ Setup not found', { setupId: input.setupId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Setup not found',
        });
      }

      log('📍 Setup found', {
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
        log('❌ Auto-trading config not found', { walletId: input.walletId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Auto-trading config not found',
        });
      }

      if (!config.isEnabled) {
        log('⚠️ Auto-trading is disabled', { walletId: input.walletId });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Auto-trading is not enabled for this wallet',
        });
      }

      const enabledSetupTypes = parseEnabledSetupTypes(config.enabledSetupTypes);
      if (!enabledSetupTypes.includes(setup.setupType)) {
        log('⚠️ Setup type not enabled', { setupType: setup.setupType, enabledTypes: enabledSetupTypes });
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

      log('📊 Current open positions', {
        count: openPositions.length,
        max: effectiveMaxPositions,
        activeWatchers: watcherStatus.watchers,
        configMax: config.maxConcurrentPositions,
      });

      if (openPositions.length >= effectiveMaxPositions) {
        log('⚠️ Max concurrent positions reached', { current: openPositions.length, max: effectiveMaxPositions });
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

      log('💰 Position sizing', {
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
        log('⚠️ Risk validation failed', { reason: riskValidation.reason });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Risk validation failed: ${riskValidation.reason}`,
        });
      }

      log('✅ Risk validation passed');

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
          log('❌ Invalid stop loss - no risk', {
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
          log('❌ Setup rejected - insufficient risk/reward ratio', {
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

        log('✅ Risk/Reward ratio validated', {
          setupType: setup.setupType,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        });
      } else if (!setup.stopLoss) {
        log('❌ Missing stop loss', {
          setupType: setup.setupType,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Stop loss is required for trade execution',
        });
      } else {
        log('ℹ️ Setup without take profit - skipping R:R validation', {
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

      log('✅ Trade execution created', {
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
      log('🚫 cancelExecution called', { executionId: input.executionId });

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
        log('❌ Execution not found', { executionId: input.executionId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
        log('⚠️ Cannot cancel - execution not open', { executionId: input.executionId, status: execution.status });
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
        })
        .where(eq(tradeExecutions.id, input.executionId));

      log('✅ Execution cancelled', {
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
      log('🏁 closeExecution called', { executionId: input.executionId, exitPrice: input.exitPrice });

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
        log('❌ Execution not found', { executionId: input.executionId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
        log('⚠️ Cannot close - execution not open', { executionId: input.executionId, status: execution.status });
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
        })
        .where(eq(tradeExecutions.id, input.executionId));

      const isWin = netPnl > 0;
      log(`${isWin ? '💚 WIN' : '❤️ LOSS'} Execution closed`, {
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🚀 startWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, profileId: input.profileId, marketType: input.marketType });

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start ${input.marketType} watcher on ${wallet.marketType} wallet`,
        });
      }

      const klineCheck = await checkKlineAvailability(input.symbol, input.interval, input.marketType);

      if (!klineCheck.hasSufficient) {
        log('⚠️ Symbol has insufficient klines', {
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

      await autoTradingScheduler.startWatcher(
        input.walletId,
        ctx.user.id,
        input.symbol,
        input.interval,
        input.profileId,
        false,
        input.marketType,
        true
      );

      log('✅ Watcher started', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, profileId: input.profileId, marketType: input.marketType });

      return { success: true };
    }),

  stopWatcher: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        interval: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🛑 stopWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, marketType: input.marketType });

      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      await autoTradingScheduler.stopWatcher(input.walletId, input.symbol, input.interval, input.marketType);

      log('✅ Watcher stopped', { walletId: input.walletId, symbol: input.symbol, interval: input.interval, marketType: input.marketType });

      return { success: true };
    }),

  stopAllWatchers: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      log('🛑 stopAllWatchers called', { walletId: input.walletId });

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

      log('✅ All watchers stopped', { walletId: input.walletId });

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
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
        limit: z.number().min(1).max(50).default(12),
      })
    )
    .query(async ({ input }) => {
      log('📊 getTopSymbols called', { marketType: input.marketType, limit: input.limit });
      const symbols = await getTopSymbolsByVolume(input.marketType, input.limit);
      log('✅ Top symbols fetched', { count: symbols.length });
      return symbols;
    }),

  startWatchersBulk: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbols: z.array(z.string()).min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX),
        interval: z.string(),
        profileId: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
        targetCount: z.number().min(AUTO_TRADING_CONFIG.TARGET_COUNT.MIN).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX).optional(),
        isManual: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const targetCount = input.targetCount ?? input.symbols.length;

      log('🚀 startWatchersBulk called', {
        walletId: input.walletId,
        symbols: input.symbols,
        interval: input.interval,
        profileId: input.profileId,
        marketType: input.marketType,
        targetCount,
      });

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot start ${input.marketType} watchers on ${wallet.marketType} wallet`,
        });
      }

      const [config] = await ctx.db
        .select({
          useDynamicSymbolSelection: autoTradingConfig.useDynamicSymbolSelection,
          dynamicSymbolLimit: autoTradingConfig.dynamicSymbolLimit,
          dynamicSymbolExcluded: autoTradingConfig.dynamicSymbolExcluded,
          dynamicSymbolRotationInterval: autoTradingConfig.dynamicSymbolRotationInterval,
          enableAutoRotation: autoTradingConfig.enableAutoRotation,
          leverage: autoTradingConfig.leverage,
          exposureMultiplier: autoTradingConfig.exposureMultiplier,
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
      const configDynamicLimit = config?.dynamicSymbolLimit ?? AUTO_TRADING_CONFIG.DYNAMIC_SYMBOL_LIMIT.DEFAULT;
      const dynamicLimit = input.targetCount !== undefined ? Math.max(input.targetCount, configDynamicLimit) : configDynamicLimit;

      log('📊 Config loaded', { useDynamicSelection, configDynamicLimit, dynamicLimit, inputTargetCount: input.targetCount });

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
      const availableSlots = Math.max(0, dynamicLimit - existingCount);
      const effectiveTargetCount = Math.min(targetCount, availableSlots);

      log('📊 Watcher limits', {
        existingCount,
        dynamicLimit,
        availableSlots,
        requestedTarget: targetCount,
        effectiveTargetCount,
      });

      if (availableSlots === 0) {
        log('⚠️ No available slots for new watchers', { existingCount, dynamicLimit });
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
          dynamicLimit,
          message: `Limit reached: ${existingCount}/${dynamicLimit} watchers already active`,
        };
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const exposureMultiplier = parseFloat(config?.exposureMultiplier ?? '1.5');

      const minNotionalFilter = getMinNotionalFilterService();
      const capitalFilterResult = await minNotionalFilter.filterSymbolsByCapital(
        input.symbols,
        {
          walletBalance,
          leverage,
          targetWatchersCount: dynamicLimit,
          exposureMultiplier,
        },
        input.marketType
      );

      const skippedCapitalSymbols = capitalFilterResult.filtered;
      const symbolsToTry = capitalFilterResult.eligible;
      const capitalLimitedTarget = Math.min(effectiveTargetCount, capitalFilterResult.maxAffordableWatchers);

      if (skippedCapitalSymbols.length > 0 || capitalFilterResult.maxAffordableWatchers < effectiveTargetCount) {
        log('💰 Capital filter applied', {
          skippedSymbols: skippedCapitalSymbols.length,
          capitalPerWatcher: capitalFilterResult.capitalPerWatcher.toFixed(2),
          walletBalance,
          leverage,
          maxAffordableWatchers: capitalFilterResult.maxAffordableWatchers,
          originalTarget: effectiveTargetCount,
          capitalLimitedTarget,
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
            isManualWatcher
          );

          startedSymbols.add(symbol);
          results.push({ symbol, success: true, fromRanking });
          return true;
        } catch (error) {
          const errorMessage = serializeError(error);
          results.push({ symbol, success: false, error: errorMessage, fromRanking });
          log('❌ Failed to start watcher', { symbol, error: errorMessage, fromRanking });
          return false;
        }
      };

      for (const symbol of skippedCapitalSymbols) {
        results.push({
          symbol,
          success: false,
          error: `Capital per watcher (${capitalFilterResult.capitalPerWatcher.toFixed(2)} USDT) below minNotional`,
          skippedReason: 'insufficient_capital',
          fromRanking: false,
        });
      }

      for (const symbol of symbolsToTry) {
        if (startedSymbols.size >= capitalLimitedTarget) break;
        await tryStartWatcher(symbol, false);
      }

      if (startedSymbols.size < capitalLimitedTarget) {
        log('🔄 Fetching additional symbols from ranking', {
          current: startedSymbols.size,
          target: capitalLimitedTarget,
          needed: capitalLimitedTarget - startedSymbols.size,
        });

        const scoringService = getOpportunityScoringService();
        const scores = await scoringService.getSymbolScores(input.marketType, capitalLimitedTarget * 4);

        const rankingSymbols = scores.map(s => s.symbol).filter(s => !attemptedSymbols.has(s));
        const rankingFilterResult = await minNotionalFilter.filterSymbolsByCapital(
          rankingSymbols,
          {
            walletBalance,
            leverage,
            targetWatchersCount: dynamicLimit,
            exposureMultiplier,
          },
          input.marketType
        );

        for (const symbol of rankingFilterResult.filtered) {
          results.push({
            symbol,
            success: false,
            error: `Capital per watcher (${rankingFilterResult.capitalPerWatcher.toFixed(2)} USDT) below minNotional`,
            skippedReason: 'insufficient_capital',
            fromRanking: true,
          });
          attemptedSymbols.add(symbol);
        }

        for (const symbol of rankingFilterResult.eligible) {
          if (startedSymbols.size >= capitalLimitedTarget) break;
          await tryStartWatcher(symbol, true);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const skippedKlinesCount = results.filter(r => r.skippedReason === 'insufficient_klines').length;
      const skippedCapitalCount = results.filter(r => r.skippedReason === 'insufficient_capital').length;
      const fromRankingCount = results.filter(r => r.success && r.fromRanking).length;
      const targetMet = successCount >= capitalLimitedTarget;

      log('✅ Bulk watcher creation complete', {
        total: results.length,
        success: successCount,
        capitalLimitedTarget,
        maxAffordableWatchers: capitalFilterResult.maxAffordableWatchers,
        existingCount,
        dynamicLimit,
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
            dynamicSymbolLimit: dynamicLimit,
            dynamicSymbolExcluded: config?.dynamicSymbolExcluded ?? null,
            marketType: input.marketType,
            interval: input.interval,
            profileId: input.profileId,
            enableAutoRotation: config?.enableAutoRotation ?? true,
            leverage: config?.leverage ?? 1,
            exposureMultiplier: parseFloat(config?.exposureMultiplier ?? '1.5'),
            walletBalance: parseFloat(wallet.currentBalance ?? '0'),
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
        dynamicLimit,
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
      log('📊 getTopCoinsByMarketCap called', { marketType: input.marketType, limit: input.limit });
      const marketCapService = getMarketCapDataService();
      const coins = await marketCapService.getTopCoinsByMarketCap(input.limit, input.marketType);
      log('✅ Top coins fetched', { count: coins.length });
      return coins;
    }),

  getDynamicSymbolScores: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX * AUTO_TRADING_CONFIG.SYMBOL_FETCH_MULTIPLIER).default(AUTO_TRADING_CONFIG.DYNAMIC_SYMBOL_LIMIT.DEFAULT),
      })
    )
    .query(async ({ input }) => {
      const scoringService = getOpportunityScoringService();
      const scores = await scoringService.getSymbolScores(input.marketType, input.limit);
      logApiTable('getDynamicSymbolScores', [
        ['Market Type', input.marketType],
        ['Limit', input.limit],
        ['Scores Fetched', `✅ ${scores.length}`],
      ]);
      return scores;
    }),

  triggerSymbolRotation: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🔄 triggerSymbolRotation called', { walletId: input.walletId });

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

      const result = await autoTradingScheduler.triggerManualRotation(
        input.walletId,
        ctx.user.id,
        {
          dynamicSymbolLimit: transformedConfig.dynamicSymbolLimit,
          dynamicSymbolExcluded: config.dynamicSymbolExcluded,
          marketType: (wallet.marketType as 'SPOT' | 'FUTURES') || 'FUTURES',
          interval: config.dynamicSymbolRotationInterval,
          profileId: undefined,
          leverage: config.leverage ?? 1,
          exposureMultiplier: parseFloat(config.exposureMultiplier ?? '1.5'),
          walletBalance: parseFloat(wallet.currentBalance ?? '0'),
        }
      );

      log('✅ Symbol rotation completed', {
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

  getBtcTrendStatus: protectedProcedure.query(async ({ ctx }) => {
    const btcKlinesData = await ctx.db.query.klines.findMany({
      where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, '4h')),
      orderBy: [desc(klines.openTime)],
      limit: 50,
    });

    const mappedKlines = mapDbKlinesReversed(btcKlinesData);
    const trendInfo = getBtcTrendInfo(mappedKlines);
    const trendEmoji = trendInfo.trend === 'BULLISH' ? '🟢' : trendInfo.trend === 'BEARISH' ? '🔴' : '⚪';
    logApiTable('getBtcTrendStatus', [
      ['Trend', `${trendEmoji} ${trendInfo.trend}`],
      ['Score', trendInfo.score],
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
        ['Total Fetched', `✅ ${results.length}`],
        ['Extreme Rates', extremeCount > 0 ? `⚠️ ${extremeCount}` : `${extremeCount}`],
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

      log('🚨 EMERGENCY STOP initiated', { walletId: input.walletId });

      const result = {
        watchersStopped: 0,
        algoOrdersCancelled: 0,
        positionsClosed: 0,
        errors: [] as string[],
      };

      try {
        await autoTradingScheduler.stopAllWatchersForWallet(input.walletId);
        result.watchersStopped = 1;
        log(`⏹️ Stopped all watchers for wallet`, { walletId: input.walletId });
      } catch (error) {
        const errorMsg = serializeError(error);
        result.errors.push(`Failed to stop watchers: ${errorMsg}`);
        logger.error({ error: errorMsg }, '[EmergencyStop] Failed to stop watchers');
      }

      const walletMarketType = wallet.marketType || 'SPOT';

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
              log(`❌ Cancelled algo orders for ${symbol}`, { walletId: input.walletId, symbol });
            } catch (error) {
              const errorMsg = serializeError(error);
              if (!errorMsg.includes('No algo orders')) {
                result.errors.push(`Failed to cancel algo orders for ${symbol}: ${errorMsg}`);
              }
            }
          }

          const exitPricesBySymbol = new Map<string, string>();

          const exchangePositions = await getPositions(client);
          for (const position of exchangePositions) {
            if (parseFloat(position.positionAmt) === 0) continue;

            try {
              const closeResult = await closePosition(
                client,
                position.symbol,
                position.positionAmt
              );
              exitPricesBySymbol.set(position.symbol, closeResult.avgPrice);
              result.positionsClosed++;
              log(`📉 Closed position ${position.symbol}`, {
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
                })
                .where(eq(tradeExecutions.id, execution.id));

              log(`📊 Emergency closed execution`, {
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
          log('⚠️ SPOT wallet emergency stop - positions NOT closed on exchange, manual close required', {
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

      log('🚨 EMERGENCY STOP completed', {
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
});
