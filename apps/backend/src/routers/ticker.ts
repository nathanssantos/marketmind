import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { get24hrTickerData } from '../services/binance-exchange-info';

export const tickerRouter = router({
  get24h: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      }),
    )
    .query(async ({ input }) => {
      const upperSymbol = input.symbol.toUpperCase();
      const tickers = await get24hrTickerData([upperSymbol], input.marketType);
      const ticker = tickers.get(upperSymbol);
      if (!ticker) return null;
      return {
        symbol: ticker.symbol,
        priceChangePercent: ticker.priceChangePercent,
        lastPrice: ticker.lastPrice,
      };
    }),

  get24hBatch: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string().min(1)).max(200),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      }),
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return [];
      const upperSymbols = input.symbols.map((s) => s.toUpperCase());
      const tickers = await get24hrTickerData(upperSymbols, input.marketType);
      return upperSymbols.flatMap((symbol) => {
        const t = tickers.get(symbol);
        return t ? [{ symbol: t.symbol, priceChangePercent: t.priceChangePercent, lastPrice: t.lastPrice }] : [];
      });
    }),
});
