import type { ScreenerConfig, TimeInterval } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { SCREENER } from '../constants/screener';
import { userPreferences } from '../db/schema';
import { getScreenerService, getIndicatorCatalog, getPresets, getPresetById } from '../services/screener';
import { protectedProcedure, router } from '../trpc';

const screenerIndicatorIdSchema = z.enum([
  'RSI', 'ADX', 'EMA', 'SMA', 'MACD_HISTOGRAM', 'MACD_SIGNAL',
  'BOLLINGER_WIDTH', 'BOLLINGER_UPPER', 'BOLLINGER_LOWER',
  'ATR', 'ATR_PERCENT', 'STOCHASTIC_K', 'STOCHASTIC_D',
  'CCI', 'MFI', 'CMF', 'OBV', 'VWAP', 'ROC',
  'WILLIAMS_R', 'CHOPPINESS', 'TSI', 'SUPERTREND',
  'PRICE_CLOSE', 'PRICE_CHANGE_24H', 'PRICE_CHANGE_PERCENT_24H',
  'VOLUME_24H', 'QUOTE_VOLUME_24H', 'VOLUME_RATIO', 'MARKET_CAP_RANK',
  'BTC_CORRELATION', 'FUNDING_RATE',
]);

const screenerOperatorSchema = z.enum([
  'ABOVE', 'BELOW', 'BETWEEN', 'CROSSES_ABOVE', 'CROSSES_BELOW', 'INCREASING', 'DECREASING',
]);

const filterConditionSchema = z.object({
  id: z.string(),
  indicator: screenerIndicatorIdSchema,
  indicatorParams: z.record(z.string(), z.number()).optional(),
  operator: screenerOperatorSchema,
  value: z.number().optional(),
  valueMax: z.number().optional(),
  compareIndicator: screenerIndicatorIdSchema.optional(),
  compareIndicatorParams: z.record(z.string(), z.number()).optional(),
  logicGroup: z.string().optional(),
});

const screenerConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  assetClass: z.enum(['CRYPTO', 'STOCKS']),
  marketType: z.enum(['SPOT', 'FUTURES']),
  exchange: z.enum(['BINANCE', 'INTERACTIVE_BROKERS']).optional(),
  interval: z.string(),
  filters: z.array(filterConditionSchema).max(SCREENER.MAX_FILTERS),
  sortBy: z.enum([
    'symbol', 'price', 'priceChange24h', 'volume24h', 'marketCapRank',
    'rsi', 'adx', 'atrPercent', 'compositeScore', 'volumeRatio', 'quoteVolume24h',
  ]).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(SCREENER.MAX_SYMBOLS_PER_SCAN).optional(),
  isPreset: z.boolean().optional(),
  presetId: z.string().optional(),
});

const SCREENER_CATEGORY = SCREENER.PREFERENCES_CATEGORY;

export const screenerRouter = router({
  run: protectedProcedure
    .input(screenerConfigSchema)
    .query(async ({ input }) => {
      const service = getScreenerService();
      return service.runScreener(input as ScreenerConfig);
    }),

  runPreset: protectedProcedure
    .input(z.object({
      presetId: z.string(),
      assetClass: z.enum(['CRYPTO', 'STOCKS']),
      marketType: z.enum(['SPOT', 'FUTURES']),
      interval: z.string(),
    }))
    .query(async ({ input }) => {
      const preset = getPresetById(input.presetId);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });

      const config: ScreenerConfig = {
        ...preset.config,
        assetClass: input.assetClass,
        marketType: input.marketType,
        interval: input.interval as TimeInterval,
        isPreset: true,
        presetId: input.presetId,
      };

      const service = getScreenerService();
      return service.runScreener(config);
    }),

  getPresets: protectedProcedure
    .input(z.object({ assetClass: z.enum(['CRYPTO', 'STOCKS']).optional() }).optional())
    .query(({ input }) => getPresets(input?.assetClass)),

  getAvailableIndicators: protectedProcedure
    .input(z.object({ assetClass: z.enum(['CRYPTO', 'STOCKS']).optional() }).optional())
    .query(({ input }) => getIndicatorCatalog(input?.assetClass)),

  saveScreener: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      config: screenerConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userPreferences.findMany({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, SCREENER_CATEGORY),
        ),
      });

      if (existing.length >= SCREENER.SAVED_SCREENER_MAX) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Maximum ${SCREENER.SAVED_SCREENER_MAX} saved screeners allowed`,
        });
      }

      const id = `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const value = JSON.stringify({
        id,
        name: input.name,
        config: input.config,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert(userPreferences).values({
        userId: ctx.user.id,
        category: SCREENER_CATEGORY,
        key: id,
        value,
      });

      return { id, name: input.name };
    }),

  getSavedScreeners: protectedProcedure
    .query(async ({ ctx }) => {
      const prefs = await ctx.db.query.userPreferences.findMany({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, SCREENER_CATEGORY),
        ),
      });

      return prefs
        .map((p) => {
          try {
            return JSON.parse(p.value) as { id: string; name: string; config: unknown; createdAt: string; updatedAt: string };
          } catch {
            return null;
          }
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
    }),

  deleteScreener: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userPreferences)
        .where(
          and(
            eq(userPreferences.userId, ctx.user.id),
            eq(userPreferences.category, SCREENER_CATEGORY),
            eq(userPreferences.key, input.id),
          ),
        );

      return { success: true };
    }),
});
