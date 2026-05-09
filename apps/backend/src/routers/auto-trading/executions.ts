import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../../constants';
import { autoTradingConfig, setupDetections, tradeExecutions } from '../../db/schema';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { walletQueries } from '../../services/database/walletQueries';
import { riskManagerService } from '../../services/risk-manager';
import { protectedProcedure, router } from '../../trpc';
import { generateEntityId } from '../../utils/id';
import { badRequest, notFound } from '../../utils/trpc-errors';
import { calculatePnl } from '@marketmind/utils';
import { parseEnabledSetupTypes } from '../../utils/profile-transformers';
import { log } from './utils';

export const executionsRouter = router({
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
        throw notFound('Setup');
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
        throw notFound('Auto-trading config');
      }

      if (!config.isEnabled) {
        log('! Auto-trading is disabled', { walletId: input.walletId });
        throw badRequest('Auto-trading is not enabled for this wallet');
      }

      const enabledSetupTypes = parseEnabledSetupTypes(config.enabledSetupTypes);
      if (!enabledSetupTypes.includes(setup.setupType)) {
        log('! Setup type not enabled', { setupType: setup.setupType, enabledTypes: enabledSetupTypes });
        throw badRequest(`Setup type ${setup.setupType} is not enabled`);
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
        throw badRequest(`Maximum concurrent positions (${effectiveMaxPositions}) reached`);
      }

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw badRequest(`Cannot execute ${input.marketType} setup on ${wallet.marketType} wallet`);
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
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
        watcherStatus.watchers > 0 ? watcherStatus.watchers : undefined,
        setup.stopLoss && setup.entryPrice
          ? { entryPrice: parseFloat(setup.entryPrice), stopLoss: parseFloat(setup.stopLoss) }
          : undefined
      );

      if (!riskValidation.isValid) {
        log('! Risk validation failed', { reason: riskValidation.reason });
        throw badRequest(`Risk validation failed: ${riskValidation.reason}`);
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
          throw badRequest('Invalid stop loss - stop loss must be below entry for LONG or above entry for SHORT');
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
          throw badRequest(
            `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${TRADING_CONFIG.MIN_RISK_REWARD_RATIO}:1)`,
          );
        }

        log('✓ Risk/Reward ratio validated', {
          setupType: setup.setupType,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        });
      } else if (!setup.stopLoss) {
        log('✗ Missing stop loss', {
          setupType: setup.setupType,
        });
        throw badRequest('Stop loss is required for trade execution');
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
        throw notFound('Execution');
      }

      if (execution.status !== 'open') {
        log('! Cannot cancel - execution not open', { executionId: input.executionId, status: execution.status });
        throw badRequest('Can only cancel open executions');
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
        .orderBy(desc(tradeExecutions.openedAt));

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
        exitOrderId: z.string().optional(),
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
        throw notFound('Execution');
      }

      if (execution.status !== 'open') {
        log('! Cannot close - execution not open', { executionId: input.executionId, status: execution.status });
        throw badRequest('Execution is not open');
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const exitPrice = parseFloat(input.exitPrice);
      const qty = parseFloat(execution.quantity);
      const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
      const leverage = execution.leverage ?? 1;

      const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
        entryPrice,
        exitPrice,
        quantity: qty,
        side: execution.side,
        marketType,
        leverage,
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
});
