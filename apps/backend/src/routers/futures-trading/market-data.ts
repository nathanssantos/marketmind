import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { BinanceIpBannedError } from '../../services/binance-api-cache';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { protectedProcedure, router } from '../../trpc';

export const marketDataRouter = router({
  getMarkPrice: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const dataService = getBinanceFuturesDataService();
        return await dataService.getMarkPrice(input.symbol);
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw error;
      }
    }),

  getFundingRate: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const dataService = getBinanceFuturesDataService();
        return await dataService.getCurrentFundingRate(input.symbol);
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw error;
      }
    }),

  getExchangeInfo: protectedProcedure.query(async () => {
    try {
      const dataService = getBinanceFuturesDataService();
      return await dataService.getExchangeInfo();
    } catch (error) {
      if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
      throw error;
    }
  }),
});
