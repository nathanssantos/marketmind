import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { positions } from '../../db/schema';
import { BinanceIpBannedError, binanceApiCache } from '../../services/binance-api-cache';
import {
  createBinanceFuturesClient,
  getPositions as getFuturesPositions,
  getPosition,
  isPaperWallet,
} from '../../services/binance-futures-client';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';

export const positionQueriesRouter = router({
  getPositions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const dbPositions = await ctx.db
          .select()
          .from(positions)
          .where(
            and(
              eq(positions.userId, ctx.user.id),
              eq(positions.walletId, input.walletId),
              eq(positions.status, 'open'),
              eq(positions.marketType, 'FUTURES')
            )
          )
          .orderBy(desc(positions.createdAt));

        return dbPositions;
      }

      if (binanceApiCache.isBanned()) {
        const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `IP banned by Binance. Try again in ${waitSeconds} seconds.`,
        });
      }

      const cached = binanceApiCache.get<Awaited<ReturnType<typeof getFuturesPositions>>>('POSITIONS', input.walletId);
      if (cached) return cached;

      try {
        const client = createBinanceFuturesClient(wallet);
        const exchangePositions = await getFuturesPositions(client);
        binanceApiCache.set('POSITIONS', input.walletId, exchangePositions);
        return exchangePositions;
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('418') || errorMessage.includes('-1003') || errorMessage.includes('Way too many requests')) {
          const banMatch = errorMessage.match(/until\s+(\d+)/);
          const banExpiry = banMatch?.[1] ? parseInt(banMatch[1], 10) : Date.now() + 5 * 60 * 1000;
          binanceApiCache.setBanned(banExpiry);
        }
        logger.error({ error: errorMessage }, 'Failed to get futures positions');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          cause: error,
        });
      }
    }),

  getPosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const [dbPosition] = await ctx.db
          .select()
          .from(positions)
          .where(
            and(
              eq(positions.userId, ctx.user.id),
              eq(positions.walletId, input.walletId),
              eq(positions.symbol, input.symbol),
              eq(positions.status, 'open'),
              eq(positions.marketType, 'FUTURES')
            )
          )
          .limit(1);

        return dbPosition || null;
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getPosition(client, input.symbol);
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get futures position',
          cause: error,
        });
      }
    }),
});
