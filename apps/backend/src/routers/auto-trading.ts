import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BINANCE_FEES } from '@marketmind/types';
import {
  autoTradingConfig,
  tradeExecutions,
  setupDetections,
} from '../db/schema';
import { riskManagerService } from '../services/risk-manager';
import { autoTradingScheduler } from '../services/auto-trading-scheduler';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';
import { transformAutoTradingConfig, parseEnabledSetupTypes, stringifyEnabledSetupTypes } from '../utils/profile-transformers';
import { walletQueries } from '../services/database/walletQueries';

const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Auto-Trading] ${message}`);
  } else {
    logger.info(`[Auto-Trading] ${message}`);
  }
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
        maxConcurrentPositions: z.number().min(1).max(20).optional(),
        maxPositionSize: z.string().optional(),
        dailyLossLimit: z.string().optional(),
        enabledSetupTypes: z.array(z.string()).optional(),
        positionSizing: z.enum(['fixed', 'percentage', 'kelly']).optional(),
        useLimitOrders: z.boolean().optional(),
        useStochasticFilter: z.boolean().optional(),
        useAdxFilter: z.boolean().optional(),
        useTrendFilter: z.boolean().optional(),
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

      const riskValidation = await riskManagerService.validateNewPosition(
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

      const MIN_RISK_REWARD_RATIO = 1.25;

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

        if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
          log('❌ Setup rejected - insufficient risk/reward ratio', {
            setupType: setup.setupType,
            direction: setup.direction,
            entryPrice,
            stopLoss,
            takeProfit,
            riskRewardRatio: riskRewardRatio.toFixed(2),
            minRequired: MIN_RISK_REWARD_RATIO,
          });
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${MIN_RISK_REWARD_RATIO}:1)`,
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

      let grossPnl = 0;
      if (execution.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * qty;
      } else {
        grossPnl = (entryPrice - exitPrice) * qty;
      }

      const entryValue = entryPrice * qty;
      const exitValue = exitPrice * qty;
      const feeRate = execution.marketType === 'FUTURES'
        ? BINANCE_FEES.FUTURES.VIP_0.taker
        : BINANCE_FEES.SPOT.VIP_0.taker;
      const entryFee = entryValue * feeRate;
      const exitFee = exitValue * feeRate;
      const totalFees = entryFee + exitFee;
      const netPnl = grossPnl - totalFees;

      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

      await ctx.db
        .update(tradeExecutions)
        .set({
          exitPrice: input.exitPrice,
          exitOrderId: input.exitOrderId,
          pnl: netPnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
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
        pnlPercent: `${adjustedPnlPercent >= 0 ? '+' : ''}${adjustedPnlPercent.toFixed(2)}%`,
      });

      return {
        pnl: netPnl.toString(),
        pnlPercent: adjustedPnlPercent.toFixed(2),
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

      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

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
        input.marketType
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🛑 stopWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval });

      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      await autoTradingScheduler.stopWatcher(input.walletId, input.symbol, input.interval);

      log('✅ Watcher stopped', { walletId: input.walletId, symbol: input.symbol, interval: input.interval });

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
});
