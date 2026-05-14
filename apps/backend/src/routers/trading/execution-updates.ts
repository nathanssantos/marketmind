import type { MarketType } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ALGO_ORDER_DEFAULTS } from '../../constants/algo-orders';
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
import { badRequest, internalServerError, notFound } from '../../utils/trpc-errors';

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
        throw badRequest('At least one of stopLoss or takeProfit must be provided');
      }

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) throw notFound('Trade execution');

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw badRequest('Trade execution is not open or pending');
      }

      const wallet = await walletQueries.getById(execution.walletId);
      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const marketType = execution.marketType as MarketType;
      const qty = parseFloat(execution.quantity);
      const side = execution.side;

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

          throw internalServerError(
            error instanceof Error ? error.message : 'Failed to update orders on Binance',
            error,
          );
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

      const openExecutionsAfterUpdate = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.walletId, execution.walletId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open'),
        ));

      return {
        success: true,
        stopLoss: input.stopLoss?.toString(),
        takeProfit: input.takeProfit?.toString(),
        stopLossOrderId: isFutures ? newStopLossAlgoId : newStopLossOrderId,
        takeProfitOrderId: isFutures ? newTakeProfitAlgoId : newTakeProfitOrderId,
        walletId: execution.walletId,
        openExecutions: openExecutionsAfterUpdate,
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

      if (!execution) throw notFound('Pending trade execution');

      if (execution.marketType !== 'FUTURES') {
        throw badRequest('Only FUTURES pending orders can be moved');
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
        return {
          success: true,
          oldOrderId: null,
          newOrderId: null,
          symbol: execution.symbol,
          newPrice: formattedPrice,
          newQty: formattedQty,
        };
      }

      const { createBinanceFuturesClient, cancelFuturesAlgoOrder, cancelFuturesOrder, submitFuturesAlgoOrder, submitFuturesOrder } = await import('../../services/binance-futures-client');
      const apiClient = createBinanceFuturesClient(wallet);

      const binarySide = execution.side === 'LONG' ? 'BUY' : 'SELL';
      const oldEntryOrderId = execution.entryOrderId;

      if (oldEntryOrderId) {
        // Detach entryOrderId from the exec BEFORE cancelling on Binance.
        // The WS `ORDER_TRADE_UPDATE x=CANCELED` that arrives within ms
        // hits `handle-order-update.ts` CANCELED branch, whose UPDATE
        // matches `entryOrderId=oldOrderId AND status='pending'` —
        // without this detach the WHERE clause matches and flips THIS
        // exec to status='cancelled' (then emits position:update with
        // status='cancelled'). The mutation continues, sets entryOrderId
        // to the new orderId BUT does NOT reset status, so the exec
        // ends up permanently 'cancelled' in the DB and getActiveExecutions
        // drops it on the next refetch — user sees the chart line vanish
        // briefly and (worse) the underlying pending exec is gone even
        // though the order on Binance is live. Detaching here is the
        // minimum surgical fix: WHERE clause finds no match → no flip,
        // no spurious position:update.
        await ctx.db
          .update(tradeExecutions)
          .set({ entryOrderId: null, updatedAt: new Date() })
          .where(eq(tradeExecutions.id, input.id));

        try {
          if (isAlgoEntry) {
            await cancelFuturesAlgoOrder(apiClient, oldEntryOrderId);
          } else {
            await cancelFuturesOrder(apiClient, execution.symbol, oldEntryOrderId);
          }
          logger.info({ orderId: oldEntryOrderId, symbol: execution.symbol }, 'Cancelled old entry order before replacing for pending entry move');
        } catch (error) {
          logger.warn({
            orderId: oldEntryOrderId,
            symbol: execution.symbol,
            error: serializeError(error),
          }, 'Failed to cancel old entry order (may already be filled/cancelled)');
        }
      }

      let newOrderId: string;

      try {
        if (isAlgoEntry) {
          const algoOrder = await submitFuturesAlgoOrder(apiClient, {
            symbol: execution.symbol,
            side: binarySide,
            type: execution.entryOrderType as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            triggerPrice: formattedPrice,
            quantity: formattedQty,
            workingType: ALGO_ORDER_DEFAULTS.workingType,
            priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
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
        await ctx.db
          .update(tradeExecutions)
          .set({ entryOrderId: null, updatedAt: new Date() })
          .where(eq(tradeExecutions.id, input.id));

        logger.error({
          executionId: execution.id,
          symbol: execution.symbol,
          error: serializeError(error),
        }, 'Failed to create new entry order for pending entry move');
        throw internalServerError(
          error instanceof Error ? error.message : 'Failed to create new entry order',
          error,
        );
      }

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

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        newOrderId,
        newPrice: formattedPrice,
        newQty: formattedQty,
      }, 'Updated pending entry order price and quantity');

      // Return both orderIds so the renderer can immediately remove
      // the cancelled order from its open-orders cache (and not wait
      // for the eventually-consistent refetch). Without this, the
      // chart paints both the old and new entry lines for ~200-500ms
      // after the move — the user perceives it as a "ghost copy" of
      // the order at the previous price that disappears later.
      return {
        success: true,
        oldOrderId: oldEntryOrderId ?? null,
        newOrderId,
        symbol: execution.symbol,
        newPrice: formattedPrice,
        newQty: formattedQty,
      };
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
      let resolvedWalletId: string | null = null;

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

          resolvedWalletId ??= execution.walletId;
          const wallet = await walletQueries.getById(execution.walletId);
          const walletSupportsLive = !isPaperWallet(wallet);
          const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
          const marketType = execution.marketType as MarketType;

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

      let openExecutions;
      if (resolvedWalletId) {
        openExecutions = await ctx.db
          .select()
          .from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, resolvedWalletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));
      }

      return { results, walletId: resolvedWalletId, openExecutions };
    }),
});
