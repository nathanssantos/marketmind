import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders } from '../../db/schema';
import { BinanceIpBannedError, binanceApiCache } from '../../services/binance-api-cache';
import {
  createBinanceFuturesClient,
  getOpenAlgoOrders,
  getOpenOrders,
  isPaperWallet,
} from '../../services/binance-futures-client';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';

export const orderQueriesRouter = router({
  getOpenOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const whereConditions = [
          eq(orders.userId, ctx.user.id),
          eq(orders.walletId, input.walletId),
          eq(orders.marketType, 'FUTURES'),
          eq(orders.status, 'NEW'),
        ];

        if (input.symbol) {
          whereConditions.push(eq(orders.symbol, input.symbol));
        }

        return ctx.db.select().from(orders).where(and(...whereConditions));
      }

      try {
        if (binanceApiCache.isBanned()) {
          const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `IP banned by Binance. Try again in ${waitSeconds} seconds.`,
          });
        }

        const cacheKey = input.symbol || 'all';
        const cached = binanceApiCache.get<Awaited<ReturnType<typeof getOpenOrders>>>('OPEN_ORDERS', input.walletId, cacheKey);
        if (cached) return cached;

        const client = createBinanceFuturesClient(wallet);
        const openOrders = await getOpenOrders(client, input.symbol);
        binanceApiCache.set('OPEN_ORDERS', input.walletId, openOrders, cacheKey);
        return openOrders;
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('418') || errorMessage.includes('banned') || errorMessage.includes('-1003')) {
          const banMatch = errorMessage.match(/until\s+(\d+)/);
          const banExpiry = banMatch?.[1] ? parseInt(banMatch[1], 10) : Date.now() + 5 * 60 * 1000;
          binanceApiCache.setBanned(banExpiry);
        }
        logger.error({ error: errorMessage }, 'Failed to get open futures orders');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          cause: error,
        });
      }
    }),

  getOpenAlgoOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return [];
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getOpenAlgoOrders(client, input.symbol);
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get open algo orders',
          cause: error,
        });
      }
    }),

  getOpenDbOrderIds: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(
          and(
            eq(orders.userId, ctx.user.id),
            eq(orders.walletId, input.walletId),
            eq(orders.status, 'NEW'),
            eq(orders.marketType, 'FUTURES')
          )
        );
      return result.map((r) => r.orderId);
    }),
});
