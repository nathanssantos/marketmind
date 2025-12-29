import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { wallets } from '../db/schema';
import { protectedProcedure, publicProcedure, router } from '../trpc';
import {
  FeeService,
  fetchSpotFees,
  fetchFuturesFees,
  fetchAllFees,
  getDefaultFees,
  getCachedFees,
  clearFeeCache,
  getBacktestFee,
} from '../services/fee-service';
import { BINANCE_FEES, getDefaultFee } from '@marketmind/types';

export const feesRouter = router({
  defaults: publicProcedure.query(() => ({
    spot: {
      maker: BINANCE_FEES.SPOT.VIP_0.maker,
      taker: BINANCE_FEES.SPOT.VIP_0.taker,
      makerPercent: BINANCE_FEES.SPOT.VIP_0.maker * 100,
      takerPercent: BINANCE_FEES.SPOT.VIP_0.taker * 100,
    },
    futures: {
      maker: BINANCE_FEES.FUTURES.VIP_0.maker,
      taker: BINANCE_FEES.FUTURES.VIP_0.taker,
      makerPercent: BINANCE_FEES.FUTURES.VIP_0.maker * 100,
      takerPercent: BINANCE_FEES.FUTURES.VIP_0.taker * 100,
    },
    bnbDiscount: BINANCE_FEES.BNB_DISCOUNT * 100,
  })),

  forWallet: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const fees = await fetchAllFees(wallet);

      return {
        spot: {
          maker: fees.spot.maker,
          taker: fees.spot.taker,
          makerPercent: fees.spot.maker * 100,
          takerPercent: fees.spot.taker * 100,
        },
        futures: {
          maker: fees.futures.maker,
          taker: fees.futures.taker,
          makerPercent: fees.futures.maker * 100,
          takerPercent: fees.futures.taker * 100,
        },
        vipLevel: fees.vipLevel,
        hasBnbDiscount: fees.hasBnbDiscount,
        lastUpdated: fees.lastUpdated.toISOString(),
      };
    }),

  refreshForWallet: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      clearFeeCache(wallet.id);

      const fees = await fetchAllFees(wallet);

      return {
        spot: {
          maker: fees.spot.maker,
          taker: fees.spot.taker,
          makerPercent: fees.spot.maker * 100,
          takerPercent: fees.spot.taker * 100,
        },
        futures: {
          maker: fees.futures.maker,
          taker: fees.futures.taker,
          makerPercent: fees.futures.maker * 100,
          takerPercent: fees.futures.taker * 100,
        },
        vipLevel: fees.vipLevel,
        hasBnbDiscount: fees.hasBnbDiscount,
        lastUpdated: fees.lastUpdated.toISOString(),
      };
    }),

  forBacktest: publicProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']),
        useBnbDiscount: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      const makerFee = getBacktestFee(input.marketType, 'MAKER', input.useBnbDiscount);
      const takerFee = getBacktestFee(input.marketType, 'TAKER', input.useBnbDiscount);

      return {
        maker: makerFee,
        taker: takerFee,
        makerPercent: makerFee * 100,
        takerPercent: takerFee * 100,
        marketType: input.marketType,
        useBnbDiscount: input.useBnbDiscount,
      };
    }),
});
