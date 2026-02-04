import { calculatePnl } from '../../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { tradeExecutions, wallets } from '../../db/schema';
import { env } from '../../env';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { clearProtectionOrderIds } from '../../services/execution-manager';
import { cancelAllProtectionOrders, cancelProtectionOrder, updateStopLossOrder, updateTakeProfitOrder } from '../../services/protection-orders';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';

export const executionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        status: z.enum(['pending', 'open', 'closed', 'cancelled']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.walletId, input.walletId),
      ];

      if (input.symbol) {
        whereConditions.push(eq(tradeExecutions.symbol, input.symbol));
      }

      if (input.status) {
        whereConditions.push(eq(tradeExecutions.status, input.status));
      }

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit);

      return executions;
    }),

  close: protectedProcedure
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
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trade execution not found' });
      }

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trade execution is not open or pending' });
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
          const orderIdsToCancel = [
            execution.entryOrderId,
            execution.stopLossOrderId,
            execution.takeProfitOrderId,
          ].filter((id): id is number => id !== null);

          if (isFutures) {
            const client = getFuturesClient(wallet);
            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder(execution.symbol, orderId);
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance Futures order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: serializeError(error),
                }, 'Failed to cancel Binance Futures order (may already be filled/cancelled)');
              }
            }
          } else {
            const client = getSpotClient(wallet);
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

        return {
          pnl: '0',
          grossPnl: '0',
          fees: '0',
          pnlPercent: '0.00',
          exitOrderId: null,
          exitPrice: '0',
          cancelled: true,
        };
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const qty = parseFloat(execution.quantity);
      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: number | null = null;

      if (shouldExecuteReal) {
        try {
          const orderSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
          const marketType = execution.marketType as 'SPOT' | 'FUTURES';

          await cancelAllProtectionOrders({
            wallet,
            symbol: execution.symbol,
            marketType,
            stopLossAlgoId: execution.stopLossAlgoId,
            stopLossOrderId: execution.stopLossOrderId,
            takeProfitAlgoId: execution.takeProfitAlgoId,
            takeProfitOrderId: execution.takeProfitOrderId,
          });

          if (isFutures) {
            const client = getFuturesClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: String(qty),
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
              quantity: qty,
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
            quantity: qty,
            exitPrice,
            marketType: execution.marketType,
            leverage,
          }, 'Manual close: Binance exit order executed');
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
        }, 'Manual close: Paper/disabled mode - simulating exit');
      }

      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
        entryPrice,
        exitPrice,
        quantity: qty,
        side: execution.side as 'LONG' | 'SHORT',
        marketType,
        leverage,
      });

      const currentBalance = parseFloat(wallet.currentBalance || '0');
      const newBalance = currentBalance + netPnl;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: exitPrice.toString(),
            exitOrderId,
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
          .where(eq(tradeExecutions.id, input.id));

        await tx
          .update(wallets)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
      });

      return {
        pnl: netPnl.toString(),
        grossPnl: grossPnl.toString(),
        fees: totalFees.toString(),
        pnlPercent: pnlPercent.toFixed(2),
        exitOrderId,
        exitPrice: exitPrice.toString(),
        leverage: isFutures ? leverage : undefined,
        marketType: execution.marketType,
      };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trade execution not found' });
      }

      const wallet = await walletQueries.findById(execution.walletId);

      if (wallet && !isPaperWallet(wallet) && env.ENABLE_LIVE_TRADING) {
        const isFutures = execution.marketType === 'FUTURES';
        const orderIdsToCancel = [
          execution.entryOrderId,
          execution.stopLossOrderId,
          execution.takeProfitOrderId,
        ].filter((id): id is number => id !== null);

        if (isFutures) {
          const client = getFuturesClient(wallet);

          for (const orderId of orderIdsToCancel) {
            try {
              await client.cancelOrder(execution.symbol, orderId);
              logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance Futures order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId,
                symbol: execution.symbol,
                error: serializeError(error),
              }, 'Failed to cancel Binance Futures order (may already be filled/cancelled)');
            }
          }
        } else {
          const client = getSpotClient(wallet);

          for (const orderId of orderIdsToCancel) {
            try {
              await client.cancelOrder(execution.symbol, orderId);
              logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId,
                symbol: execution.symbol,
                error: serializeError(error),
              }, 'Failed to cancel Binance order (may already be filled/cancelled)');
            }
          }

          if (execution.orderListId) {
            try {
              const { createBinanceClient } = await import('../../services/binance-client');
              const binanceClient = createBinanceClient(wallet);
              await binanceClient.cancelOCO({ symbol: execution.symbol, orderListId: execution.orderListId });
              logger.info({ orderListId: execution.orderListId, symbol: execution.symbol }, 'Cancelled OCO order list');
            } catch (error) {
              logger.warn({
                orderListId: execution.orderListId,
                symbol: execution.symbol,
                error: serializeError(error),
              }, 'Failed to cancel OCO order list (may already be executed)');
            }
          }
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

      return { success: true };
    }),

  updateSLTP: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        stopLoss: z.number().optional(),
        takeProfit: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.stopLoss === undefined && input.takeProfit === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one of stopLoss or takeProfit must be provided',
        });
      }

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trade execution not found' });
      }

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trade execution is not open or pending' });
      }

      const wallet = await walletQueries.getById(execution.walletId);
      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const marketType = execution.marketType as 'SPOT' | 'FUTURES';
      const qty = parseFloat(execution.quantity);
      const side = execution.side as 'LONG' | 'SHORT';

      let newStopLossOrderId: number | null = execution.stopLossOrderId;
      let newStopLossAlgoId: number | null = execution.stopLossAlgoId;
      let newTakeProfitOrderId: number | null = execution.takeProfitOrderId;
      let newTakeProfitAlgoId: number | null = execution.takeProfitAlgoId;

      if (shouldExecuteReal) {
        try {
          if (input.stopLoss !== undefined) {
            const result = await updateStopLossOrder({
              wallet,
              symbol: execution.symbol,
              side,
              quantity: qty,
              triggerPrice: input.stopLoss,
              marketType,
              currentAlgoId: execution.stopLossAlgoId,
              currentOrderId: execution.stopLossOrderId,
            });

            if (isFutures) {
              newStopLossAlgoId = result.algoId ?? null;
            } else {
              newStopLossOrderId = result.orderId ?? null;
            }
          }

          if (input.takeProfit !== undefined) {
            const result = await updateTakeProfitOrder({
              wallet,
              symbol: execution.symbol,
              side,
              quantity: qty,
              triggerPrice: input.takeProfit,
              marketType,
              currentAlgoId: execution.takeProfitAlgoId,
              currentOrderId: execution.takeProfitOrderId,
            });

            if (isFutures) {
              newTakeProfitAlgoId = result.algoId ?? null;
            } else {
              newTakeProfitOrderId = result.orderId ?? null;
            }
          }
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: serializeError(error),
          }, 'Failed to update SL/TP orders on Binance');

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update orders on Binance',
          });
        }
      }

      const updateData: {
        updatedAt: Date;
        stopLoss?: string;
        stopLossOrderId?: number | null;
        stopLossAlgoId?: number | null;
        takeProfit?: string;
        takeProfitOrderId?: number | null;
        takeProfitAlgoId?: number | null;
      } = {
        updatedAt: new Date(),
      };

      if (input.stopLoss !== undefined) {
        updateData.stopLoss = input.stopLoss.toString();
        if (isFutures) {
          updateData.stopLossAlgoId = newStopLossAlgoId;
        } else {
          updateData.stopLossOrderId = newStopLossOrderId;
        }
      }

      if (input.takeProfit !== undefined) {
        updateData.takeProfit = input.takeProfit.toString();
        if (isFutures) {
          updateData.takeProfitAlgoId = newTakeProfitAlgoId;
        } else {
          updateData.takeProfitOrderId = newTakeProfitOrderId;
        }
      }

      await ctx.db
        .update(tradeExecutions)
        .set(updateData)
        .where(eq(tradeExecutions.id, input.id));

      logger.debug({
        executionId: execution.id,
        symbol: execution.symbol,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        isLive: shouldExecuteReal,
        isFutures,
        newStopLossOrderId: isFutures ? newStopLossAlgoId : newStopLossOrderId,
        newTakeProfitOrderId: isFutures ? newTakeProfitAlgoId : newTakeProfitOrderId,
      }, 'Updated trade execution SL/TP');

      return {
        success: true,
        stopLoss: input.stopLoss?.toString(),
        takeProfit: input.takeProfit?.toString(),
        stopLossOrderId: isFutures ? newStopLossAlgoId : newStopLossOrderId,
        takeProfitOrderId: isFutures ? newTakeProfitAlgoId : newTakeProfitOrderId,
      };
    }),

  cancelProtectionOrder: protectedProcedure
    .input(
      z.object({
        executionIds: z.array(z.string()),
        type: z.enum(['stopLoss', 'takeProfit']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const results: { executionId: string; success: boolean; error?: string }[] = [];

      for (const executionId of input.executionIds) {
        try {
          const [execution] = await ctx.db
            .select()
            .from(tradeExecutions)
            .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.userId, ctx.user.id)))
            .limit(1);

          if (!execution) {
            results.push({ executionId, success: false, error: 'Execution not found' });
            continue;
          }

          if (execution.status !== 'open' && execution.status !== 'pending') {
            results.push({ executionId, success: false, error: 'Execution is not open or pending' });
            continue;
          }

          const wallet = await walletQueries.getById(execution.walletId);
          const walletSupportsLive = !isPaperWallet(wallet);
          const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
          const marketType = execution.marketType as 'SPOT' | 'FUTURES';

          const algoId = input.type === 'stopLoss' ? execution.stopLossAlgoId : execution.takeProfitAlgoId;
          const orderId = input.type === 'stopLoss' ? execution.stopLossOrderId : execution.takeProfitOrderId;

          if (!algoId && !orderId) {
            results.push({ executionId, success: true });
            continue;
          }

          if (shouldExecuteReal) {
            const cancelled = await cancelProtectionOrder({
              wallet,
              symbol: execution.symbol,
              marketType,
              algoId,
              orderId,
            });

            if (!cancelled) {
              logger.warn({ executionId, type: input.type, algoId, orderId }, 'Failed to cancel protection order on exchange - may already be filled');
            }
          }

          await clearProtectionOrderIds(executionId, input.type);

          logger.info({
            executionId,
            type: input.type,
            algoId,
            orderId,
            isLive: shouldExecuteReal,
          }, 'Cancelled individual protection order');

          results.push({ executionId, success: true });
        } catch (error) {
          logger.error({ executionId, type: input.type, error: serializeError(error) }, 'Error cancelling protection order');
          results.push({ executionId, success: false, error: serializeError(error) });
        }
      }

      return { results };
    }),
});
