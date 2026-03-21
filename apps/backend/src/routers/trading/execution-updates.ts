import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, tradeExecutions } from '../../db/schema';
import { env } from '../../env';
import { isPaperWallet } from '../../services/binance-client';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { formatPriceForBinance } from '../../utils/formatters';
import { clearProtectionOrderIds } from '../../services/execution-manager';
import { cancelProtectionOrder, updateStopLossOrder, updateTakeProfitOrder } from '../../services/protection-orders';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';

export const executionUpdatesRouter = router({
  updateTradeExecutionSLTP: protectedProcedure
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
      const marketType = execution.marketType as 'SPOT' | 'FUTURES';
      const qty = parseFloat(execution.quantity);
      const side = execution.side as 'LONG' | 'SHORT';

      let newStopLossOrderId: string | null = execution.stopLossOrderId;
      let newStopLossAlgoId: string | null = execution.stopLossAlgoId;
      let newTakeProfitOrderId: string | null = execution.takeProfitOrderId;
      let newTakeProfitAlgoId: string | null = execution.takeProfitAlgoId;

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
        stopLossOrderId?: string | null;
        stopLossAlgoId?: string | null;
        takeProfit?: string;
        takeProfitOrderId?: string | null;
        takeProfitAlgoId?: string | null;
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

      logger.trace({
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

  updatePendingEntry: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newPrice: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.id, input.id),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'pending')
          )
        )
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pending trade execution not found',
        });
      }

      if (execution.marketType !== 'FUTURES') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only FUTURES pending orders can be moved',
        });
      }

      const wallet = await walletQueries.getById(execution.walletId);
      const isAlgoEntry = execution.entryOrderType === 'STOP_MARKET' || execution.entryOrderType === 'TAKE_PROFIT_MARKET';
      const symbolFiltersMap = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
      const filters = symbolFiltersMap.get(execution.symbol);
      const tickSize = filters?.tickSize?.toString();
      const formattedPrice = formatPriceForBinance(input.newPrice, tickSize);

      const formattedQty = execution.quantity;

      if (isPaperWallet(wallet) || !env.ENABLE_LIVE_TRADING) {
        await ctx.db
          .update(tradeExecutions)
          .set({ entryPrice: formattedPrice, limitEntryPrice: formattedPrice, updatedAt: new Date() })
          .where(eq(tradeExecutions.id, input.id));
        return { success: true };
      }

      const { createBinanceFuturesClient, cancelFuturesAlgoOrder, cancelFuturesOrder, submitFuturesAlgoOrder, submitFuturesOrder } = await import('../../services/binance-futures-client');
      const apiClient = createBinanceFuturesClient(wallet);

      const binarySide = execution.side === 'LONG' ? 'BUY' : 'SELL';
      let newOrderId: string;

      try {
        if (isAlgoEntry) {
          const algoOrder = await submitFuturesAlgoOrder(apiClient, {
            symbol: execution.symbol,
            side: binarySide,
            type: execution.entryOrderType as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            triggerPrice: formattedPrice,
            quantity: formattedQty,
            workingType: 'CONTRACT_PRICE',
          });
          newOrderId = algoOrder.algoId;
          await ctx.db.insert(orders).values({
            orderId: algoOrder.algoId,
            userId: ctx.user.id,
            walletId: execution.walletId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            price: algoOrder.triggerPrice ?? formattedPrice,
            origQty: algoOrder.quantity,
            executedQty: '0',
            status: 'NEW',
            time: algoOrder.createTime,
            updateTime: algoOrder.updateTime,
            marketType: 'FUTURES',
            stopLossIntent: execution.stopLoss ?? null,
            takeProfitIntent: execution.takeProfit ?? null,
          });
        } else {
          const futuresOrder = await submitFuturesOrder(apiClient, {
            symbol: execution.symbol,
            side: binarySide,
            type: 'LIMIT',
            quantity: formattedQty,
            price: formattedPrice,
            timeInForce: 'GTC',
          });
          newOrderId = futuresOrder.orderId;
          await ctx.db.insert(orders).values({
            orderId: futuresOrder.orderId,
            userId: ctx.user.id,
            walletId: execution.walletId,
            symbol: futuresOrder.symbol,
            side: futuresOrder.side,
            type: futuresOrder.type,
            price: futuresOrder.price,
            origQty: futuresOrder.origQty,
            executedQty: '0',
            status: 'NEW',
            timeInForce: futuresOrder.timeInForce,
            time: futuresOrder.time,
            updateTime: futuresOrder.updateTime,
            marketType: 'FUTURES',
            stopLossIntent: execution.stopLoss ?? null,
            takeProfitIntent: execution.takeProfit ?? null,
          });
        }
      } catch (error) {
        logger.error({
          executionId: execution.id,
          symbol: execution.symbol,
          error: serializeError(error),
        }, 'Failed to create new entry order for pending entry move');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create new entry order',
        });
      }

      const oldEntryOrderId = execution.entryOrderId;

      await ctx.db
        .update(tradeExecutions)
        .set({
          entryOrderId: newOrderId,
          entryPrice: formattedPrice,
          limitEntryPrice: formattedPrice,
          quantity: formattedQty,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.id));

      if (oldEntryOrderId) {
        try {
          if (isAlgoEntry) {
            await cancelFuturesAlgoOrder(apiClient, oldEntryOrderId);
          } else {
            await cancelFuturesOrder(apiClient, execution.symbol, oldEntryOrderId);
          }
          logger.info({ orderId: oldEntryOrderId, symbol: execution.symbol }, 'Cancelled old entry order for pending entry move');
        } catch (error) {
          logger.warn({
            orderId: oldEntryOrderId,
            symbol: execution.symbol,
            error: serializeError(error),
          }, 'Failed to cancel old entry order (may already be filled/cancelled)');
        }
      }

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        newOrderId,
        newPrice: formattedPrice,
        newQty: formattedQty,
      }, 'Updated pending entry order price and quantity');

      return { success: true };
    }),

  cancelIndividualProtectionOrder: protectedProcedure
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
