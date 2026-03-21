import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { orders, tradeExecutions } from '../../db/schema';
import { isPaperWallet } from '../../services/binance-client';
import { createMarketClient } from '../../services/market-client-factory';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';

export const orderQueriesRouter = router({
  getOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(orders.userId, ctx.user.id),
        eq(orders.walletId, input.walletId),
      ];

      if (input.symbol) whereConditions.push(eq(orders.symbol, input.symbol));
      if (input.search) whereConditions.push(ilike(orders.symbol, `%${input.search}%`));

      const userOrders = await ctx.db
        .select()
        .from(orders)
        .where(and(...whereConditions))
        .orderBy(desc(orders.time))
        .limit(input.limit)
        .offset(input.offset);

      return userOrders;
    }),

  getOrdersStats: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [ordersCount] = await ctx.db
        .select({ count: count() })
        .from(orders)
        .where(and(eq(orders.userId, ctx.user.id), eq(orders.walletId, input.walletId)));
      const [executionsCount] = await ctx.db
        .select({ count: count() })
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.userId, ctx.user.id), eq(tradeExecutions.walletId, input.walletId)));
      return {
        ordersCount: ordersCount?.count ?? 0,
        executionsCount: executionsCount?.count ?? 0,
      };
    }),

  getOrderById: protectedProcedure
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      return order;
    }),

  syncOrders: protectedProcedure
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
});
