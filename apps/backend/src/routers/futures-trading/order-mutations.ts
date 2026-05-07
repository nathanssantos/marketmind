import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, tradeExecutions } from '../../db/schema';
import { mapBinanceErrorToTRPC } from '../../utils/binanceErrorHandler';
import {
  cancelAllFuturesAlgoOrders,
  cancelAllFuturesOrders,
  cancelFuturesAlgoOrder,
  cancelFuturesOrder,
  createBinanceFuturesClient,
  getConfiguredLeverage,
  getOpenAlgoOrders,
  isPaperWallet,
  setLeverage,
  setMarginType,
  submitFuturesOrder,
} from '../../services/binance-futures-client';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { getScalpingScheduler } from '../../services/scalping/scalping-scheduler';
import { syncLiveWalletSnapshot } from '../../services/wallet-snapshot';
import { getWebSocketService } from '../../services/websocket';
import { protectedProcedure, router } from '../../trpc';
import { formatPriceForBinance, formatQuantityForBinance } from '../../utils/formatters';
import { generateEntityId } from '../../utils/id';
import { handleConditionalOrder, handleMarketOrderProtection } from './order-helpers';

export const orderMutationsRouter = router({
  createOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        side: z.enum(['BUY', 'SELL']),
        type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_MARKET', 'TAKE_PROFIT', 'TAKE_PROFIT_MARKET']),
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        reduceOnly: z.boolean().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
        leverage: z.number().min(1).max(125).optional(),
        marginType: z.enum(['ISOLATED', 'CROSSED']).optional(),
        stopLoss: z.string().optional(),
        takeProfit: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (!wallet.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wallet is inactive' });
      }

      if (!input.reduceOnly && getScalpingScheduler().isSymbolBeingScalped(input.walletId, input.symbol)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Cannot trade ${input.symbol}: scalping is active on this symbol. Stop scalping first.`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          const simulatedTimestamp = Date.now();
          const simulatedOrderId = String(simulatedTimestamp);
          const price = input.price ?? '0';
          const quantity = input.quantity;

          await ctx.db.insert(orders).values({
            orderId: simulatedOrderId,
            userId: ctx.user.id,
            walletId: input.walletId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            price,
            origQty: quantity,
            executedQty: input.type === 'MARKET' ? quantity : '0',
            status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
            timeInForce: input.type === 'LIMIT' ? 'GTC' : undefined,
            time: simulatedTimestamp,
            updateTime: simulatedTimestamp,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: 'FUTURES',
            reduceOnly: input.reduceOnly ?? false,
            stopLossIntent: input.stopLoss,
            takeProfitIntent: input.takeProfit,
          });

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          const paperWsService = getWebSocketService();
          if (paperWsService) {
            paperWsService.emitOrderCreated(input.walletId, {
              orderId: simulatedOrderId,
              symbol: input.symbol,
              side: input.side,
              type: input.type,
              status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
              price,
              origQty: quantity,
              executedQty: input.type === 'MARKET' ? quantity : '0',
              marketType: 'FUTURES',
            });
          }

          return {
            orderId: simulatedOrderId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
            price,
            quantity,
            executedQty: input.type === 'MARKET' ? quantity : '0',
            openExecutions: paperOpenExecutions,
          };
        }

        const client = createBinanceFuturesClient(wallet);

        if (input.leverage) await setLeverage(client, input.symbol, input.leverage);
        await setMarginType(client, input.symbol, 'CROSSED');

        // Read post-setLeverage value from accountInfoV3 — V3 positionRisk
        // dropped leverage entirely, so we can't use the position wrapper
        // for "what leverage will this order use" anymore.
        const actualLeverage = await getConfiguredLeverage(client, input.symbol);

        const symbolFiltersMap = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const filters = symbolFiltersMap.get(input.symbol);
        const tickSize = filters?.tickSize?.toString();
        const stepSize = filters?.stepSize?.toString();

        const isConditionalOrder =
          input.type === 'STOP_MARKET' || input.type === 'TAKE_PROFIT_MARKET';

        if (isConditionalOrder) {
          return await handleConditionalOrder(ctx, input, client, tickSize, stepSize, actualLeverage);
        }

        const futuresOrder = await submitFuturesOrder(client, {
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: formatQuantityForBinance(parseFloat(input.quantity), stepSize),
          price: input.price ? formatPriceForBinance(parseFloat(input.price), tickSize) : undefined,
          stopPrice: input.stopPrice ? formatPriceForBinance(parseFloat(input.stopPrice), tickSize) : undefined,
          reduceOnly: input.reduceOnly,
          timeInForce: input.type === 'LIMIT' ? 'GTC' : undefined,
        });

        await ctx.db.insert(orders).values({
          orderId: futuresOrder.orderId,
          userId: ctx.user.id,
          walletId: input.walletId,
          symbol: futuresOrder.symbol,
          side: futuresOrder.side,
          type: futuresOrder.type,
          price: futuresOrder.price,
          origQty: futuresOrder.origQty,
          executedQty: futuresOrder.executedQty,
          status: futuresOrder.status,
          timeInForce: futuresOrder.timeInForce,
          time: futuresOrder.time,
          updateTime: futuresOrder.updateTime,
          setupId: input.setupId,
          setupType: input.setupType,
          marketType: 'FUTURES',
          reduceOnly: futuresOrder.reduceOnly,
          stopLossIntent: input.stopLoss,
          takeProfitIntent: input.takeProfit,
        });

        const orderDirection = input.side === 'BUY' ? 'LONG' : 'SHORT';
        const oppositeDirection = orderDirection === 'LONG' ? 'SHORT' : 'LONG';

        if (input.type !== 'MARKET' && futuresOrder.status === 'NEW') {
          const [existingOpposite] = await ctx.db
            .select({ id: tradeExecutions.id })
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, input.walletId),
                eq(tradeExecutions.symbol, input.symbol),
                eq(tradeExecutions.side, oppositeDirection),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
            .limit(1);

          const isReduceOrder = input.reduceOnly ?? !!existingOpposite;

          if (!isReduceOrder) {
            await ctx.db.insert(tradeExecutions).values({
              id: generateEntityId(),
              userId: ctx.user.id,
              walletId: input.walletId,
              symbol: input.symbol,
              side: orderDirection,
              entryOrderId: futuresOrder.orderId,
              entryPrice: input.price ?? '0',
              limitEntryPrice: input.price,
              quantity: input.quantity,
              stopLoss: input.stopLoss,
              takeProfit: input.takeProfit,
              status: 'pending',
              openedAt: new Date(),
              entryOrderType: 'LIMIT',
              marketType: 'FUTURES',
              leverage: actualLeverage,
            });
            logger.info({ symbol: input.symbol, orderId: futuresOrder.orderId }, '[createOrder] Created pending tradeExecution for manual LIMIT order');
          } else {
            logger.info({ symbol: input.symbol, orderId: futuresOrder.orderId, existingOpposite: existingOpposite?.id }, '[createOrder] Skipped pending execution — reduce order against existing position');
          }
        }

        if (input.type === 'MARKET') {
          await handleMarketOrderProtection(ctx, input, futuresOrder, wallet, orderDirection, actualLeverage);
        }

        const orderResult = {
          orderId: futuresOrder.orderId,
          symbol: futuresOrder.symbol,
          side: futuresOrder.side,
          type: futuresOrder.type,
          status: futuresOrder.status,
          price: futuresOrder.price,
          quantity: futuresOrder.origQty,
          executedQty: futuresOrder.executedQty,
        };

        const wsService = getWebSocketService();
        if (wsService) wsService.emitOrderCreated(input.walletId, orderResult);

        // Synchronous wallet refresh — MARKET fills move balance/margin
        // immediately; LIMIT/STOP locks/unlocks margin too. Either way
        // the frontend's max-position-size sizer needs the fresh
        // capital before the user clicks again.
        const walletSnapshot = await syncLiveWalletSnapshot(ctx, wallet, client);

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return { ...orderResult, openExecutions, walletSnapshot };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  cancelOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        orderId: z.string(),
        isAlgo: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet)) {
          await ctx.db
            .update(orders)
            .set({ status: 'CANCELED', updateTime: Date.now() })
            .where(eq(orders.orderId, input.orderId));

          const paperCancelledExecs = await ctx.db
            .update(tradeExecutions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(and(eq(tradeExecutions.entryOrderId, input.orderId), eq(tradeExecutions.status, 'pending')))
            .returning();

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          const paperWsService = getWebSocketService();
          if (paperWsService) {
            paperWsService.emitOrderCancelled(input.walletId, input.orderId);
            for (const exec of paperCancelledExecs) {
              paperWsService.emitOrderUpdate(input.walletId, { id: exec.id, status: 'cancelled' });
              paperWsService.emitPositionUpdate(input.walletId, exec);
            }
          }

          return { orderId: input.orderId, symbol: input.symbol, status: 'CANCELED', walletId: input.walletId, openExecutions: paperOpenExecutions };
        }

        const [dbOrder] = await ctx.db.select().from(orders).where(eq(orders.orderId, input.orderId)).limit(1);
        const isAlgoOrder = input.isAlgo ?? (dbOrder && (dbOrder.type === 'STOP_MARKET' || dbOrder.type === 'TAKE_PROFIT_MARKET'));

        const client = createBinanceFuturesClient(wallet);
        if (isAlgoOrder) {
          await cancelFuturesAlgoOrder(client, input.orderId);
        } else {
          await cancelFuturesOrder(client, input.symbol, input.orderId);
        }

        await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(eq(orders.orderId, input.orderId));

        const cancelledExecs = await ctx.db
          .update(tradeExecutions)
          .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
          .where(and(eq(tradeExecutions.entryOrderId, input.orderId), eq(tradeExecutions.status, 'pending')))
          .returning();

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        const cancelWsService = getWebSocketService();
        if (cancelWsService) {
          cancelWsService.emitOrderCancelled(input.walletId, input.orderId);
          for (const exec of cancelledExecs) {
            cancelWsService.emitOrderUpdate(input.walletId, { id: exec.id, status: 'cancelled' });
            cancelWsService.emitPositionUpdate(input.walletId, exec);
          }
        }

        return { orderId: input.orderId, symbol: input.symbol, status: 'CANCELED', walletId: input.walletId, openExecutions };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  cancelAllAlgoOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        logger.info({ symbol: input.symbol }, 'Paper wallet - skipping algo order cancellation');
        return { success: true, cancelled: 0 };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        const openOrders = await getOpenAlgoOrders(client, input.symbol);
        const orderCount = openOrders.length;

        if (orderCount === 0) {
          logger.info({ symbol: input.symbol }, 'No algo orders to cancel');
          return { success: true, cancelled: 0 };
        }

        await cancelAllFuturesAlgoOrders(client, input.symbol);
        logger.info({ symbol: input.symbol, cancelled: orderCount }, 'Cancelled all algo orders for symbol');

        return { success: true, cancelled: orderCount };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  cancelAllOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const cancelled = await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(
            and(
              eq(orders.walletId, input.walletId),
              eq(orders.symbol, input.symbol),
              eq(orders.status, 'NEW')
            )
          )
          .returning();

        logger.info({ symbol: input.symbol, cancelled: cancelled.length }, 'Paper wallet - cancelled pending orders');
        return { success: true, cancelled: cancelled.length };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        await cancelAllFuturesOrders(client, input.symbol);
        logger.info({ symbol: input.symbol }, 'Cancelled all regular orders for symbol');
        return { success: true };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),
});
