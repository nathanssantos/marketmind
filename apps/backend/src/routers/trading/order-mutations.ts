import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ALGO_ORDER_DEFAULTS } from '../../constants/algo-orders';
import { orders, tradeExecutions } from '../../db/schema';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient } from '../../exchange';
import { createMarketClient } from '../../services/market-client-factory';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { formatPriceForBinance, formatQuantityForBinance } from '../../utils/formatters';
import { calculateQtyFromPercent } from '../../services/trading/order-quantity';
import { protectedProcedure, router } from '../../trpc';
import { generateEntityId } from '../../utils/id';

let paperOrderCounter = 0;
const generatePaperOrderId = (): string => {
  paperOrderCounter = (paperOrderCounter + 1) % 10000;
  return String(Date.now() * 10000 + paperOrderCounter);
};

export const orderMutationsRouter = router({
  createOrder: protectedProcedure
    .input(
      z
        .object({
          walletId: z.string(),
          symbol: z.string(),
          side: z.enum(['BUY', 'SELL']),
          type: z.enum([
            'LIMIT',
            'MARKET',
            'STOP_LOSS',
            'STOP_LOSS_LIMIT',
            'TAKE_PROFIT',
            'TAKE_PROFIT_LIMIT',
            'STOP_MARKET',
            'TAKE_PROFIT_MARKET',
          ]),
          quantity: z.string().optional(),
          percent: z.number().min(0.01).max(100).optional(),
          referencePrice: z.number().positive().optional(),
          price: z.string().optional(),
          stopPrice: z.string().optional(),
          setupId: z.string().optional(),
          setupType: z.string().optional(),
          marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
          reduceOnly: z.boolean().optional(),
        })
        .refine(
          (v) => (v.quantity !== undefined) !== (v.percent !== undefined),
          { message: 'Exactly one of quantity or percent must be provided' }
        )
    )
    .mutation(async ({ input: rawInput, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(rawInput.walletId, ctx.user.id);

      if (!wallet.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wallet is inactive',
        });
      }

      if (wallet.marketType && wallet.marketType !== rawInput.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot create ${rawInput.marketType} order on ${wallet.marketType} wallet`,
        });
      }

      let resolvedQuantity = rawInput.quantity;
      if (rawInput.percent !== undefined) {
        const refPrice =
          rawInput.referencePrice ??
          (rawInput.price ? parseFloat(rawInput.price) : 0) ??
          (rawInput.stopPrice ? parseFloat(rawInput.stopPrice) : 0);
        if (!refPrice || refPrice <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'referencePrice (or price/stopPrice) is required when percent is provided',
          });
        }
        const computed = await calculateQtyFromPercent({
          wallet,
          symbol: rawInput.symbol,
          marketType: rawInput.marketType,
          percent: rawInput.percent,
          price: refPrice,
        });
        resolvedQuantity = computed.quantity;
        logger.info({ walletId: wallet.id, symbol: rawInput.symbol, percent: rawInput.percent, leverage: computed.leverage, balance: computed.balance, notional: computed.notional, quantity: resolvedQuantity }, 'Computed quantity from percent (server-side)');
      }

      if (!resolvedQuantity) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quantity resolution failed' });
      }

      const input = { ...rawInput, quantity: resolvedQuantity };

      try {
        if (isPaperWallet(wallet)) {
          const simulatedTimestamp = Date.now();
          const simulatedOrderId = generatePaperOrderId();
          const price = input.price || '0';
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
            timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
            time: simulatedTimestamp,
            updateTime: simulatedTimestamp,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: input.marketType,
            reduceOnly: input.reduceOnly,
          });

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            orderId: simulatedOrderId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
            price,
            quantity,
            executedQty: input.type === 'MARKET' ? quantity : '0',
            marketType: input.marketType,
            openExecutions: paperOpenExecutions,
          };
        }

        const symbolFiltersMap = await getMinNotionalFilterService().getSymbolFilters(input.marketType);
        const filters = symbolFiltersMap.get(input.symbol);
        const tickSize = filters?.tickSize?.toString();
        const stepSize = filters?.stepSize?.toString();

        let futuresLeverage = 1;
        if (input.marketType === 'FUTURES') {
          const { createBinanceFuturesClient, setMarginType } = await import('../../services/binance-futures-client');
          const { guardBinanceCall } = await import('../../services/binance-api-cache');
          const futuresClient = createBinanceFuturesClient(wallet);
          try {
            await setMarginType(futuresClient, input.symbol, 'CROSSED');
          } catch {
            logger.warn({ symbol: input.symbol }, 'Could not apply margin type — proceeding with current settings');
          }
          try {
            const positionsForLev = await guardBinanceCall(() => futuresClient.getPositions({ symbol: input.symbol }));
            const posForLev = positionsForLev.find(p => p.symbol === input.symbol);
            if (posForLev) futuresLeverage = Number(posForLev.leverage);
          } catch {
            logger.warn({ symbol: input.symbol }, 'Could not read leverage from exchange');
          }
        }

        let orderInput = { ...input };
        if (orderInput.marketType === 'FUTURES' && orderInput.type === 'LIMIT' && orderInput.price) {
          const { createBinanceFuturesClient } = await import('../../services/binance-futures-client');
          const markClient = createBinanceFuturesClient(wallet);
          const ticker = await markClient.getMarkPrice({ symbol: orderInput.symbol });
          const markPrice = parseFloat(String(ticker.markPrice));
          const orderPrice = parseFloat(orderInput.price);

          if (markPrice > 0) {
            const wouldCrossSpread =
              (orderInput.side === 'SELL' && orderPrice < markPrice) ||
              (orderInput.side === 'BUY' && orderPrice > markPrice);

            if (wouldCrossSpread) {
              logger.info({ symbol: orderInput.symbol, side: orderInput.side, orderPrice, markPrice }, 'Auto-correcting LIMIT to STOP_MARKET — order would cross spread');
              orderInput = {
                ...orderInput,
                type: 'STOP_MARKET',
                stopPrice: orderInput.price,
                price: undefined,
              };
            }
          }
        }

        const isConditionalFuturesOrder =
          orderInput.marketType === 'FUTURES' &&
          (orderInput.type === 'STOP_MARKET' || orderInput.type === 'TAKE_PROFIT_MARKET');

        if (isConditionalFuturesOrder) {
          const triggerPrice = orderInput.stopPrice
            ? formatPriceForBinance(parseFloat(orderInput.stopPrice), tickSize)
            : orderInput.price
              ? formatPriceForBinance(parseFloat(orderInput.price), tickSize)
              : undefined;

          if (!triggerPrice) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'stopPrice is required for STOP_MARKET / TAKE_PROFIT_MARKET orders',
            });
          }

          const triggerPriceNum = parseFloat(triggerPrice);
          const requestedQty = parseFloat(orderInput.quantity);
          const notional = requestedQty * triggerPriceNum;
          const minNotional = filters?.minNotional ?? 5;
          if (notional < minNotional) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order notional ($${notional.toFixed(2)}) is below the minimum of $${minNotional} for ${orderInput.symbol}. Increase your position size % or deposit more funds.`,
            });
          }

          const futuresClient = getFuturesClient(wallet);
          const algoOrder = await futuresClient.submitAlgoOrder({
            symbol: orderInput.symbol,
            side: orderInput.side,
            type: orderInput.type as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            triggerPrice,
            quantity: formatQuantityForBinance(requestedQty, stepSize),
            workingType: ALGO_ORDER_DEFAULTS.workingType,
            priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
            ...(orderInput.reduceOnly && { reduceOnly: true }),
          });

          await ctx.db.insert(orders).values({
            orderId: algoOrder.algoId,
            userId: ctx.user.id,
            walletId: orderInput.walletId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            price: algoOrder.triggerPrice ?? triggerPrice,
            origQty: algoOrder.quantity,
            executedQty: '0',
            status: 'NEW',
            time: algoOrder.createTime,
            updateTime: algoOrder.updateTime,
            setupId: orderInput.setupId,
            setupType: orderInput.setupType,
            marketType: orderInput.marketType,
            reduceOnly: orderInput.reduceOnly,
          });

          if (!orderInput.reduceOnly) {
            const intendedSide: 'LONG' | 'SHORT' = orderInput.side === 'BUY' ? 'LONG' : 'SHORT';
            const oppositeDirection = intendedSide === 'LONG' ? 'SHORT' : 'LONG';
            const [existingOpposite] = await ctx.db
              .select({ id: tradeExecutions.id })
              .from(tradeExecutions)
              .where(
                and(
                  eq(tradeExecutions.walletId, orderInput.walletId),
                  eq(tradeExecutions.symbol, orderInput.symbol),
                  eq(tradeExecutions.side, oppositeDirection),
                  eq(tradeExecutions.status, 'open'),
                  eq(tradeExecutions.marketType, orderInput.marketType)
                )
              )
              .limit(1);

            if (existingOpposite) {
              await ctx.db.update(orders).set({ reduceOnly: true }).where(eq(orders.orderId, algoOrder.algoId));
            } else {
              await ctx.db.insert(tradeExecutions).values({
                id: generateEntityId(),
                userId: ctx.user.id,
                walletId: orderInput.walletId,
                symbol: orderInput.symbol,
                side: intendedSide,
                entryPrice: algoOrder.triggerPrice ?? triggerPrice,
                limitEntryPrice: algoOrder.triggerPrice ?? triggerPrice,
                quantity: String(algoOrder.quantity || orderInput.quantity),
                entryOrderId: algoOrder.algoId,
                entryOrderType: orderInput.type as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
                status: 'pending',
                marketType: orderInput.marketType,
                openedAt: new Date(),
                leverage: futuresLeverage,
              });
            }
          }

          const algoOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, orderInput.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            orderId: algoOrder.algoId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            status: 'NEW',
            price: algoOrder.triggerPrice ?? triggerPrice,
            quantity: algoOrder.quantity,
            executedQty: '0',
            marketType: orderInput.marketType,
            openExecutions: algoOpenExecutions,
          };
        }

        const orderQty = parseFloat(orderInput.quantity);
        const orderPrice = parseFloat(orderInput.price ?? orderInput.stopPrice ?? '0');
        if (orderPrice > 0) {
          const notional = orderQty * orderPrice;
          const minNotional = filters?.minNotional ?? 5;
          if (notional < minNotional) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order notional ($${notional.toFixed(2)}) is below the minimum of $${minNotional} for ${orderInput.symbol}. Increase your position size % or deposit more funds.`,
            });
          }
        }

        const marketClient = createMarketClient(wallet, orderInput.marketType);

        const binanceOrder = await marketClient.createOrder({
          symbol: orderInput.symbol,
          side: orderInput.side,
          type: orderInput.type,
          quantity: parseFloat(formatQuantityForBinance(orderQty, stepSize)),
          price: orderInput.price ? parseFloat(formatPriceForBinance(parseFloat(orderInput.price), tickSize)) : undefined,
          stopPrice: orderInput.stopPrice ? parseFloat(formatPriceForBinance(parseFloat(orderInput.stopPrice), tickSize)) : undefined,
          timeInForce: orderInput.type.includes('LIMIT') ? 'GTC' : undefined,
          reduceOnly: orderInput.reduceOnly,
        });

        await ctx.db.insert(orders).values({
          orderId: binanceOrder.orderId,
          userId: ctx.user.id,
          walletId: orderInput.walletId,
          symbol: binanceOrder.symbol,
          side: binanceOrder.side,
          type: binanceOrder.type,
          price: binanceOrder.price,
          origQty: binanceOrder.origQty,
          executedQty: binanceOrder.executedQty,
          status: binanceOrder.status,
          timeInForce: binanceOrder.timeInForce,
          time: binanceOrder.time,
          updateTime: binanceOrder.updateTime,
          setupId: orderInput.setupId,
          setupType: orderInput.setupType,
          marketType: orderInput.marketType,
          reduceOnly: orderInput.reduceOnly,
        });

        if (binanceOrder.status === 'NEW' && !orderInput.reduceOnly) {
          const rawTargetPrice = orderInput.stopPrice ?? orderInput.price ?? binanceOrder.price;
          const targetPrice = rawTargetPrice && rawTargetPrice !== '0' ? rawTargetPrice : null;
          if (targetPrice) {
            const intendedSide: 'LONG' | 'SHORT' = orderInput.side === 'BUY' ? 'LONG' : 'SHORT';
            const oppositeDirection = intendedSide === 'LONG' ? 'SHORT' : 'LONG';
            const [existingOpposite] = await ctx.db
              .select({ id: tradeExecutions.id })
              .from(tradeExecutions)
              .where(
                and(
                  eq(tradeExecutions.walletId, orderInput.walletId),
                  eq(tradeExecutions.symbol, orderInput.symbol),
                  eq(tradeExecutions.side, oppositeDirection),
                  eq(tradeExecutions.status, 'open'),
                  eq(tradeExecutions.marketType, orderInput.marketType)
                )
              )
              .limit(1);

            if (existingOpposite) {
              await ctx.db.update(orders).set({ reduceOnly: true }).where(eq(orders.orderId, binanceOrder.orderId));
            } else {
              await ctx.db.insert(tradeExecutions).values({
                id: generateEntityId(),
                userId: ctx.user.id,
                walletId: orderInput.walletId,
                symbol: orderInput.symbol,
                side: intendedSide,
                entryPrice: String(targetPrice),
                limitEntryPrice: String(targetPrice),
                quantity: String(binanceOrder.origQty || orderInput.quantity),
                entryOrderId: binanceOrder.orderId,
                entryOrderType: 'LIMIT',
                status: 'pending',
                marketType: orderInput.marketType,
                openedAt: new Date(),
                leverage: futuresLeverage,
              });
            }
          }
        }

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, orderInput.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return {
          orderId: binanceOrder.orderId,
          symbol: binanceOrder.symbol,
          side: binanceOrder.side,
          type: binanceOrder.type,
          status: binanceOrder.status,
          price: binanceOrder.price,
          quantity: binanceOrder.origQty,
          executedQty: binanceOrder.executedQty,
          marketType: orderInput.marketType,
          openExecutions,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const binanceCode = (error as { code?: number })?.code;
        const binanceMessage = (error as { message?: string })?.message;
        throw new TRPCError({
          code: typeof binanceCode === 'number' && binanceCode < 0 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
          message: binanceMessage ?? 'Failed to create order',
          cause: error,
        });
      }
    }),

  cancelOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        orderId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel ${input.marketType} order on ${wallet.marketType} wallet`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          await ctx.db
            .update(orders)
            .set({
              status: 'CANCELED',
              updateTime: Date.now(),
            })
            .where(eq(orders.orderId, input.orderId));

          const paperOpenExecs = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            orderId: input.orderId,
            symbol: input.symbol,
            status: 'CANCELED',
            walletId: input.walletId,
            openExecutions: paperOpenExecs,
          };
        }

        const [dbOrder] = await ctx.db.select().from(orders).where(eq(orders.orderId, input.orderId)).limit(1);
        const isAlgoFuturesOrder = input.marketType === 'FUTURES' && dbOrder && (dbOrder.type === 'STOP_MARKET' || dbOrder.type === 'TAKE_PROFIT_MARKET');

        let cancelSucceeded = false;
        if (isAlgoFuturesOrder) {
          const { createBinanceFuturesClient, cancelFuturesAlgoOrder } = await import('../../services/binance-futures-client');
          const apiClient = createBinanceFuturesClient(wallet);
          try {
            await cancelFuturesAlgoOrder(apiClient, input.orderId);
            cancelSucceeded = true;
          } catch (cancelError) {
            const msg = (cancelError as Error)?.message ?? '';
            if (!msg.includes('Unknown order') && !msg.includes('Order does not exist') && !msg.includes('not found')) throw cancelError;
          }
        } else {
          const marketClient = createMarketClient(wallet, input.marketType);
          try {
            await marketClient.cancelOrder(input.symbol, input.orderId);
            cancelSucceeded = true;
          } catch (cancelError) {
            const binanceCode = (cancelError as { cause?: { code?: number } })?.cause?.code;
            if (binanceCode !== -2011) throw cancelError;
          }
        }

        await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(eq(orders.orderId, input.orderId));

        await ctx.db
          .update(tradeExecutions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.entryOrderId, input.orderId),
              eq(tradeExecutions.status, 'pending')
            )
          );

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return {
          orderId: input.orderId,
          symbol: input.symbol,
          status: cancelSucceeded ? 'CANCELED' : 'ALREADY_FILLED',
          walletId: input.walletId,
          openExecutions,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
          cause: error,
        });
      }
    }),
});
