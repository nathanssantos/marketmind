import { calculatePnl } from '@marketmind/utils';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { tradeExecutions, wallets } from '../../db/schema';
import { env } from '../../env';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { walletQueries } from '../../services/database/walletQueries';
import { emitPositionClose } from '../../services/income-events';
import { logger } from '../../services/logger';
import { cancelAllProtectionOrders } from '../../services/protection-orders';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { getWebSocketService } from '../../services/websocket';
import { cancelFuturesExecutionOrders, cancelSpotExecutionOrders } from './cancel-execution-helpers';

export const executionsRouter = router({
  getTradeExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        search: z.string().optional(),
        status: z.enum(['pending', 'open', 'closed', 'cancelled']).optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.walletId, input.walletId),
      ];

      if (input.symbol) whereConditions.push(eq(tradeExecutions.symbol, input.symbol));
      if (input.search) whereConditions.push(ilike(tradeExecutions.symbol, `%${input.search}%`));
      if (input.status) whereConditions.push(eq(tradeExecutions.status, input.status));

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit)
        .offset(input.offset);

      return executions;
    }),

  closeTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        exitPrice: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade execution not found',
        });
      }

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trade execution is not open or pending',
        });
      }

      const wallet = await walletQueries.getById(execution.walletId);

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const leverage = execution.leverage || 1;

      if (execution.status === 'pending') {
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          entryOrderId: execution.entryOrderId,
          stopLossOrderId: execution.stopLossOrderId,
          takeProfitOrderId: execution.takeProfitOrderId,
          marketType: execution.marketType,
        }, 'Cancelling pending execution and associated orders');

        if (shouldExecuteReal) {
          if (isFutures) {
            await cancelFuturesExecutionOrders(execution, wallet);
          } else {
            const client = getSpotClient(wallet);
            const orderIdsToCancel = [
              execution.entryOrderId,
              execution.stopLossOrderId,
              execution.takeProfitOrderId,
            ].filter((id): id is string => id !== null);

            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder(execution.symbol, orderId);
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: serializeError(error),
                }, 'Failed to cancel Binance order (may already be filled/cancelled)');
              }
            }
          }
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
          .where(eq(tradeExecutions.id, input.id));

        const wsService = getWebSocketService();
        wsService?.emitPositionClosed(execution.walletId, {
          positionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          exitReason: 'MANUAL_CANCEL',
          pnl: 0,
          pnlPercent: 0,
        });

        const openExecutionsAfterCancel = await ctx.db
          .select()
          .from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, execution.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return {
          pnl: '0',
          grossPnl: '0',
          fees: '0',
          pnlPercent: '0.00',
          exitOrderId: null,
          exitPrice: '0',
          cancelled: true,
          walletId: execution.walletId,
          openExecutions: openExecutionsAfterCancel,
        };
      }

      const siblingExecutions = isFutures
        ? await ctx.db
            .select()
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, execution.walletId),
                eq(tradeExecutions.symbol, execution.symbol),
                eq(tradeExecutions.side, execution.side),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
        : [execution];

      const allExecutionsToClose = siblingExecutions.length > 0 ? siblingExecutions : [execution];
      const totalQty = allExecutionsToClose.reduce((sum, e) => sum + parseFloat(e.quantity), 0);
      const weightedEntryPrice = allExecutionsToClose.reduce(
        (sum, e) => sum + parseFloat(e.entryPrice) * parseFloat(e.quantity), 0
      ) / (totalQty || 1);

      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: string | null = null;

      if (shouldExecuteReal) {
        try {
          const orderSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
          const marketType = execution.marketType as 'SPOT' | 'FUTURES';

          await Promise.allSettled(
            allExecutionsToClose.map((exec) =>
              cancelAllProtectionOrders({
                wallet,
                symbol: exec.symbol,
                marketType,
                stopLossAlgoId: exec.stopLossAlgoId,
                stopLossOrderId: exec.stopLossOrderId,
                takeProfitAlgoId: exec.takeProfitAlgoId,
                takeProfitOrderId: exec.takeProfitOrderId,
              })
            )
          );

          if (isFutures) {
            const client = getFuturesClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: String(totalQty),
              reduceOnly: true,
              newOrderRespType: 'RESULT',
            });

            exitOrderId = order.orderId;
            const filledPrice = parseFloat(order.avgPrice?.toString() || order.price?.toString() || '0');
            if (filledPrice > 0) exitPrice = filledPrice;

          } else {
            const client = getSpotClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: totalQty,
            });

            exitOrderId = order.orderId;
            const filledPrice = order.price ? parseFloat(order.price) : 0;
            if (filledPrice > 0) exitPrice = filledPrice;
          }

          logger.info({
            executionId: execution.id,
            orderId: exitOrderId,
            symbol: execution.symbol,
            side: orderSide,
            quantity: totalQty,
            executionCount: allExecutionsToClose.length,
            exitPrice,
            marketType: execution.marketType,
            leverage,
          }, 'Manual close: Binance exit order executed for all sibling executions');
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: serializeError(error),
          }, 'Failed to execute Binance exit order');

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute exit order on Binance',
          });
        }
      } else {
        if (!input.exitPrice) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Exit price is required for paper trading',
          });
        }
        logger.info({
          executionId: execution.id,
          walletType: wallet.walletType,
          liveEnabled: env.ENABLE_LIVE_TRADING,
          marketType: execution.marketType,
          leverage,
          executionCount: allExecutionsToClose.length,
        }, 'Manual close: Paper/disabled mode - simulating exit');
      }

      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      let totalNetPnl = 0;
      let totalGrossPnl = 0;
      let totalAllFees = 0;
      const paperCloseEmits: Array<{
        executionId: string;
        userId: string;
        symbol: string;
        grossPnl: number;
        totalFees: number;
      }> = [];

      await ctx.db.transaction(async (tx) => {
        for (const exec of allExecutionsToClose) {
          const execEntryPrice = parseFloat(exec.entryPrice);
          const execQty = parseFloat(exec.quantity);
          const execLeverage = exec.leverage || 1;

          const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
            entryPrice: execEntryPrice,
            exitPrice,
            quantity: execQty,
            side: exec.side,
            marketType,
            leverage: execLeverage,
          });

          totalNetPnl += netPnl;
          totalGrossPnl += grossPnl;
          totalAllFees += totalFees;

          const existingPartialPnl = parseFloat(exec.partialClosePnl || '0');
          const finalPnl = netPnl + existingPartialPnl;

          await tx
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitPrice: exitPrice.toString(),
              exitOrderId,
              pnl: finalPnl.toString(),
              pnlPercent: pnlPercent.toString(),
              fees: totalFees.toString(),
              exitSource: 'MANUAL',
              exitReason: 'MANUAL_CLOSE',
              closedAt: new Date(),
              updatedAt: new Date(),
              stopLossAlgoId: null,
              stopLossOrderId: null,
              takeProfitAlgoId: null,
              takeProfitOrderId: null,
            })
            .where(eq(tradeExecutions.id, exec.id));

          paperCloseEmits.push({
            executionId: exec.id,
            userId: ctx.user.id,
            symbol: exec.symbol,
            grossPnl,
            totalFees,
          });
        }

        const currentBalance = parseFloat(wallet.currentBalance || '0');
        const newBalance = currentBalance + totalNetPnl;

        await tx
          .update(wallets)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
      });

      for (const emit of paperCloseEmits) {
        await emitPositionClose({
          wallet,
          execution: { id: emit.executionId, userId: emit.userId, symbol: emit.symbol },
          grossPnl: emit.grossPnl,
          totalFees: emit.totalFees,
        });
      }

      const wsService = getWebSocketService();
      for (const exec of allExecutionsToClose) {
        const execPnl = calculatePnl({
          entryPrice: parseFloat(exec.entryPrice),
          exitPrice,
          quantity: parseFloat(exec.quantity),
          side: exec.side,
          marketType,
          leverage: exec.leverage || 1,
        });
        wsService?.emitPositionClosed(execution.walletId, {
          positionId: exec.id,
          symbol: exec.symbol,
          side: exec.side,
          exitReason: 'MANUAL_CLOSE',
          pnl: execPnl.netPnl,
          pnlPercent: execPnl.pnlPercent,
        });
      }

      const totalPnlPercent = weightedEntryPrice > 0
        ? (totalNetPnl / (weightedEntryPrice * totalQty / leverage)) * 100
        : 0;

      const openExecutionsAfterClose = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.walletId, execution.walletId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open'),
        ));

      return {
        pnl: totalNetPnl.toString(),
        grossPnl: totalGrossPnl.toString(),
        fees: totalAllFees.toString(),
        pnlPercent: totalPnlPercent.toFixed(2),
        exitOrderId,
        exitPrice: exitPrice.toString(),
        leverage: isFutures ? leverage : undefined,
        marketType: execution.marketType,
        walletId: execution.walletId,
        openExecutions: openExecutionsAfterClose,
      };
    }),

  cancelTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade execution not found',
        });
      }

      const wallet = await walletQueries.findById(execution.walletId);

      if (wallet && !isPaperWallet(wallet) && env.ENABLE_LIVE_TRADING) {
        const isFutures = execution.marketType === 'FUTURES';

        if (isFutures) {
          await cancelFuturesExecutionOrders(execution, wallet);
        } else {
          await cancelSpotExecutionOrders(execution, wallet);
        }
      }

      await ctx.db
        .update(tradeExecutions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          entryOrderId: null,
        })
        .where(eq(tradeExecutions.id, input.id));

      const openExecutionsAfterCancel = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.walletId, execution.walletId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open'),
        ));

      return { success: true, walletId: execution.walletId, openExecutions: openExecutionsAfterCancel };
    }),
});
