import { TRPCError } from '@trpc/server';
import { MainClient, USDMClient } from 'binance';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders } from '../../db/schema';
import { createMarketClient } from '../../services/market-client-factory';
import { walletQueries } from '../../services/database/walletQueries';
import { isPaperWallet } from '../../services/binance-client';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';

export const ordersRouter = router({
  create: protectedProcedure
    .input(
      z.object({
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
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        reduceOnly: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (!wallet.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wallet is inactive' });
      }

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot create ${input.marketType} order on ${wallet.marketType} wallet`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          const now = Date.now();
          const simulatedOrderId = String(now);
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
            time: now,
            updateTime: now,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: input.marketType,
            reduceOnly: input.reduceOnly,
          });

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
          };
        }

        const marketClient = createMarketClient(wallet, input.marketType);

        const binanceOrder = await marketClient.createOrder({
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: parseFloat(input.quantity),
          price: input.price ? parseFloat(input.price) : undefined,
          stopPrice: input.stopPrice ? parseFloat(input.stopPrice) : undefined,
          timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
          reduceOnly: input.reduceOnly,
        });

        await ctx.db.insert(orders).values({
          orderId: binanceOrder.orderId,
          userId: ctx.user.id,
          walletId: input.walletId,
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
          setupId: input.setupId,
          setupType: input.setupType,
          marketType: input.marketType,
          reduceOnly: input.reduceOnly,
        });

        return {
          orderId: binanceOrder.orderId,
          symbol: binanceOrder.symbol,
          side: binanceOrder.side,
          type: binanceOrder.type,
          status: binanceOrder.status,
          price: binanceOrder.price,
          quantity: binanceOrder.origQty,
          executedQty: binanceOrder.executedQty,
          marketType: input.marketType,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create order',
          cause: error,
        });
      }
    }),

  cancel: protectedProcedure
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
            .set({ status: 'CANCELED', updateTime: Date.now() })
            .where(eq(orders.orderId, input.orderId));

          return { orderId: input.orderId, symbol: input.symbol, status: 'CANCELED' };
        }

        const marketClient = createMarketClient(wallet, input.marketType);
        const canceledOrder = await marketClient.cancelOrder(input.symbol, input.orderId);

        await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(eq(orders.orderId, input.orderId));

        return canceledOrder;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
          cause: error,
        });
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(orders.userId, ctx.user.id),
        eq(orders.walletId, input.walletId),
      ];

      if (input.symbol) {
        whereConditions.push(eq(orders.symbol, input.symbol));
      }

      const userOrders = await ctx.db
        .select()
        .from(orders)
        .where(and(...whereConditions))
        .orderBy(desc(orders.time))
        .limit(input.limit);

      return userOrders;
    }),

  getById: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        orderId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.orderId, input.orderId),
            eq(orders.userId, ctx.user.id),
            eq(orders.walletId, input.walletId)
          )
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }

      return order;
    }),

  sync: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot sync ${input.marketType} orders on ${wallet.marketType} wallet`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          return { synced: 0, message: 'Paper wallets do not sync with Binance' };
        }

        const marketClient = createMarketClient(wallet, input.marketType);
        const binanceOrders = await marketClient.getAllOrders(input.symbol, 100);

        for (const binanceOrder of binanceOrders) {
          const [existingOrder] = await ctx.db
            .select()
            .from(orders)
            .where(eq(orders.orderId, binanceOrder.orderId))
            .limit(1);

          if (existingOrder) {
            await ctx.db
              .update(orders)
              .set({
                status: binanceOrder.status,
                executedQty: binanceOrder.executedQty,
                updateTime: binanceOrder.updateTime,
              })
              .where(eq(orders.orderId, binanceOrder.orderId));
          } else {
            await ctx.db.insert(orders).values({
              orderId: binanceOrder.orderId,
              userId: ctx.user.id,
              walletId: input.walletId,
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
              marketType: input.marketType,
              reduceOnly: binanceOrder.reduceOnly,
            });
          }
        }

        return { synced: binanceOrders.length };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync orders',
          cause: error,
        });
      }
    }),

  getTickerPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return {};

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000;

      const fetchPrices = async (attempt: number): Promise<Record<string, string>> => {
        try {
          const prices: Record<string, string> = {};

          if (input.marketType === 'FUTURES') {
            const client = new USDMClient({ disableTimeSync: true });
            const tickers = await client.getSymbolPriceTicker();
            const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

            for (const symbol of input.symbols) {
              const ticker = tickersArray.find((t) => t.symbol === symbol);
              if (ticker?.price) prices[symbol] = ticker.price.toString();
            }

            return prices;
          }

          const client = new MainClient({ disableTimeSync: true });
          const tickers = await client.getSymbolPriceTicker();
          const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

          for (const symbol of input.symbols) {
            const ticker = tickersArray.find((t) => t.symbol === symbol);
            if (ticker?.price) prices[symbol] = ticker.price.toString();
          }

          return prices;
        } catch (error) {
          const errorMessage = serializeError(error);
          const isRetryable = errorMessage.includes('ETIMEDOUT') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('socket hang up');

          if (isRetryable && attempt < MAX_RETRIES) {
            logger.warn({
              attempt,
              maxRetries: MAX_RETRIES,
              errorMessage,
              symbols: input.symbols,
            }, 'Retrying ticker price fetch after network error');
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            return fetchPrices(attempt + 1);
          }

          throw error;
        }
      };

      try {
        return await fetchPrices(1);
      } catch (error) {
        const errorMessage = serializeError(error);
        logger.error({
          errorMessage,
          symbols: input.symbols,
          marketType: input.marketType,
        }, 'Failed to fetch ticker prices from Binance after retries');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch ticker prices: ${errorMessage}`,
          cause: error,
        });
      }
    }),
});
