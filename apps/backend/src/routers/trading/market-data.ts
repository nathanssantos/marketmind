import { MainClient, USDMClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { symbolTrailingStopOverrides } from '../../db/schema';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { internalServerError } from '../../utils/trpc-errors';

export const marketDataRouter = router({
  getTickerPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        exchange: z.enum(['BINANCE', 'INTERACTIVE_BROKERS']).default('BINANCE'),
      })
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return {};

      if (input.exchange === 'INTERACTIVE_BROKERS') return {};

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
        throw internalServerError(`Failed to fetch ticker prices: ${errorMessage}`, error);
      }
    }),

  getSymbolTrailingConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const override = await ctx.db.query.symbolTrailingStopOverrides.findFirst({
        where: and(
          eq(symbolTrailingStopOverrides.walletId, input.walletId),
          eq(symbolTrailingStopOverrides.symbol, input.symbol)
        ),
      });

      return override ?? null;
    }),

  updateSymbolTrailingConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        useIndividualConfig: z.boolean().optional(),
        trailingStopEnabled: z.boolean().nullable().optional(),
        trailingActivationPercentLong: z.string().nullable().optional(),
        trailingActivationPercentShort: z.string().nullable().optional(),
        trailingDistancePercentLong: z.string().nullable().optional(),
        trailingDistancePercentShort: z.string().nullable().optional(),
        useAdaptiveTrailing: z.boolean().nullable().optional(),
        useProfitLockDistance: z.boolean().nullable().optional(),
        trailingDistanceMode: z.enum(['auto', 'fixed']).nullable().optional(),
        trailingStopOffsetPercent: z.string().nullable().optional(),
        trailingActivationModeLong: z.enum(['auto', 'manual']).nullable().optional(),
        trailingActivationModeShort: z.enum(['auto', 'manual']).nullable().optional(),
        manualTrailingActivatedLong: z.boolean().nullable().optional(),
        manualTrailingActivatedShort: z.boolean().nullable().optional(),
        indicatorInterval: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const { walletId, symbol, ...fields } = input;

      const existing = await ctx.db.query.symbolTrailingStopOverrides.findFirst({
        where: and(
          eq(symbolTrailingStopOverrides.walletId, walletId),
          eq(symbolTrailingStopOverrides.symbol, symbol)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(symbolTrailingStopOverrides)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(symbolTrailingStopOverrides.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(symbolTrailingStopOverrides)
        .values({
          walletId,
          symbol,
          useIndividualConfig: fields.useIndividualConfig ?? false,
          trailingStopEnabled: fields.trailingStopEnabled ?? null,
          trailingActivationPercentLong: fields.trailingActivationPercentLong ?? null,
          trailingActivationPercentShort: fields.trailingActivationPercentShort ?? null,
          trailingDistancePercentLong: fields.trailingDistancePercentLong ?? null,
          trailingDistancePercentShort: fields.trailingDistancePercentShort ?? null,
          useAdaptiveTrailing: fields.useAdaptiveTrailing ?? null,
          useProfitLockDistance: fields.useProfitLockDistance ?? null,
          trailingDistanceMode: fields.trailingDistanceMode ?? null,
          trailingStopOffsetPercent: fields.trailingStopOffsetPercent ?? null,
          trailingActivationModeLong: fields.trailingActivationModeLong ?? null,
          trailingActivationModeShort: fields.trailingActivationModeShort ?? null,
          manualTrailingActivatedLong: fields.manualTrailingActivatedLong ?? null,
          manualTrailingActivatedShort: fields.manualTrailingActivatedShort ?? null,
          indicatorInterval: fields.indicatorInterval ?? null,
        })
        .returning();
      return created!;
    }),

  getSymbolFilters: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ input }) => {
      const service = getMinNotionalFilterService();
      const filtersMap = await service.getSymbolFilters(input.marketType);
      const filters = filtersMap.get(input.symbol);
      if (!filters) return { minNotional: input.marketType === 'FUTURES' ? 5 : 10, minQty: 0, stepSize: 0, tickSize: 0 };
      return filters;
    }),
});
