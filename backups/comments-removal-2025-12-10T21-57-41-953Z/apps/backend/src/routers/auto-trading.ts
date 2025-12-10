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
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Setup not found',
        });
      }

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

      if (!config.isEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Auto-trading is not enabled for this wallet',
        });
      }

      const enabledSetupTypes = JSON.parse(config.enabledSetupTypes) as string[];
      if (!enabledSetupTypes.includes(setup.setupType)) {
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

      if (openPositions.length >= config.maxConcurrentPositions) {
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance || '0');
      const maxPositionSizePercent = parseFloat(config.maxPositionSize);
      const positionValue = (walletBalance * maxPositionSizePercent) / 100;

      const riskValidation = await riskManagerService.validateNewPosition(
        input.walletId,
        config,
        positionValue
      );

      if (!riskValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Risk validation failed: ${riskValidation.reason}`,
        });
      }

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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Execution not found',
        });
      }

      if (execution.status !== 'open') {
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

      return {
        pnl: pnl.toString(),
        pnlPercent: adjustedPnlPercent.toFixed(2),
      };
    }),
});
