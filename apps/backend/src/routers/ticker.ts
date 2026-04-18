import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { getDailyCandles } from '../services/daily-candle';

const marketTypeSchema = z.enum(['SPOT', 'FUTURES']).default('FUTURES');

export const tickerRouter = router({
  getDaily: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1),
        marketType: marketTypeSchema,
      }),
    )
    .query(async ({ input }) => {
      const upperSymbol = input.symbol.toUpperCase();
      const candles = await getDailyCandles([upperSymbol], input.marketType);
      const candle = candles.get(upperSymbol);
      if (!candle) return null;
      return {
        symbol: candle.symbol,
        dailyOpen: candle.open,
        lastPrice: candle.close,
        openTime: candle.openTime,
      };
    }),

  getDailyBatch: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string().min(1)).max(200),
        marketType: marketTypeSchema,
      }),
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return [];
      const upperSymbols = input.symbols.map((s) => s.toUpperCase());
      const candles = await getDailyCandles(upperSymbols, input.marketType);
      return upperSymbols.flatMap((symbol) => {
        const c = candles.get(symbol);
        return c
          ? [{ symbol: c.symbol, dailyOpen: c.open, lastPrice: c.close, openTime: c.openTime }]
          : [];
      });
    }),
});
