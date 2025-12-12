import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  autoTradingConfig,
  tradeExecutions,
  wallets,
  setupDetections,
} from '../db/schema';
import { riskManagerService } from '../services/risk-manager';
import { autoTradingScheduler } from '../services/auto-trading-scheduler';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

const log = (message: string, data?: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[Auto-Trading] [${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[Auto-Trading] [${timestamp}] ${message}`);
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
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

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
        const configId = generateId(21);
        const defaultEnabledSetups = JSON.stringify([
          'Setup91',
          'Setup92',
          'Setup93',
          'Setup94',
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

      return {
        ...config,
        enabledSetupTypes: JSON.parse(config.enabledSetupTypes) as string[],
      };
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
        {updateData.enabledSetupTypes = JSON.stringify(input.enabledSetupTypes);}
      if (input.positionSizing !== undefined)
        {updateData.positionSizing = input.positionSizing;}

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

      const enabledSetupTypes = JSON.parse(config.enabledSetupTypes) as string[];
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

      log('📊 Current open positions', { count: openPositions.length, max: config.maxConcurrentPositions });

      if (openPositions.length >= config.maxConcurrentPositions) {
        log('⚠️ Max concurrent positions reached', { current: openPositions.length, max: config.maxConcurrentPositions });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum concurrent positions (${config.maxConcurrentPositions}) reached`,
        });
      }

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(eq(wallets.id, input.walletId))
        .limit(1);

      if (!wallet) {
        log('❌ Wallet not found', { walletId: input.walletId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance || '0');
      const maxPositionSizePercent = parseFloat(config.maxPositionSize);
      const positionValue = (walletBalance * maxPositionSizePercent) / 100;

      log('💰 Position sizing', {
        walletBalance: walletBalance.toFixed(2),
        maxPositionSizePercent,
        positionValue: positionValue.toFixed(2),
      });

      const riskValidation = await riskManagerService.validateNewPosition(
        input.walletId,
        config,
        positionValue
      );

      if (!riskValidation.isValid) {
        log('⚠️ Risk validation failed', { reason: riskValidation.reason });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Risk validation failed: ${riskValidation.reason}`,
        });
      }

      log('✅ Risk validation passed');

      const executionId = generateId(21);

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
            eq(tradeExecutions.status, 'open')
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

      let pnl = 0;
      if (execution.side === 'LONG') {
        pnl = (exitPrice - entryPrice) * qty;
      } else {
        pnl = (entryPrice - exitPrice) * qty;
      }

      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

      await ctx.db
        .update(tradeExecutions)
        .set({
          exitPrice: input.exitPrice,
          exitOrderId: input.exitOrderId,
          pnl: pnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.executionId));

      const isWin = pnl > 0;
      log(`${isWin ? '💚 WIN' : '❤️ LOSS'} Execution closed`, {
        executionId: input.executionId,
        setupType: execution.setupType,
        symbol: execution.symbol,
        side: execution.side,
        entryPrice: entryPrice.toFixed(2),
        exitPrice: exitPrice.toFixed(2),
        pnl: pnl.toFixed(2),
        pnlPercent: `${adjustedPnlPercent >= 0 ? '+' : ''}${adjustedPnlPercent.toFixed(2)}%`,
      });

      return {
        pnl: pnl.toString(),
        pnlPercent: adjustedPnlPercent.toFixed(2),
      };
    }),

  startWatcher: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        interval: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log('🚀 startWatcher called', { walletId: input.walletId, symbol: input.symbol, interval: input.interval });

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        log('❌ Wallet not found', { walletId: input.walletId });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
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
        input.interval
      );

      log('✅ Watcher started', { walletId: input.walletId, symbol: input.symbol, interval: input.interval });

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

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      await autoTradingScheduler.stopWatcher(input.walletId, input.symbol, input.interval);

      log('✅ Watcher stopped', { walletId: input.walletId, symbol: input.symbol, interval: input.interval });

      return { success: true };
    }),

  stopAllWatchers: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      log('🛑 stopAllWatchers called', { walletId: input.walletId });

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

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
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

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
