import { z } from 'zod';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { protectedProcedure, router } from '../../trpc';
import { mapBinanceErrorToTRPC } from '../../utils/binanceErrorHandler';

export const marketDataRouter = router({
  getMarkPrice: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const dataService = getBinanceFuturesDataService();
        return await dataService.getMarkPrice(input.symbol);
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  getFundingRate: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const dataService = getBinanceFuturesDataService();
        return await dataService.getCurrentFundingRate(input.symbol);
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  getExchangeInfo: protectedProcedure.query(async () => {
    try {
      const dataService = getBinanceFuturesDataService();
      return await dataService.getExchangeInfo();
    } catch (error) {
      throw mapBinanceErrorToTRPC(error);
    }
  }),
});
