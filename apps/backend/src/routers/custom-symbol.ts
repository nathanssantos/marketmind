import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { customSymbolComponents, customSymbols } from '../db/schema';
import {
  computeWeights,
  fetchBinancePrice,
  fetchMarketCaps,
  getCustomSymbolService,
} from '../services/custom-symbol-service';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const weightingMethodSchema = z.enum(['EQUAL', 'MARKET_CAP', 'CAPPED_MARKET_CAP', 'SQRT_MARKET_CAP', 'MANUAL']);
const categorySchema = z.enum(['politics', 'defi', 'gaming', 'ai', 'other']);

const componentSchema = z.object({
  symbol: z.string().toUpperCase(),
  marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
  coingeckoId: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
});

const resolveWeights = async (
  method: string,
  components: Array<{ coingeckoId?: string; weight?: number }>,
  capPercent?: number,
): Promise<number[]> => {
  if (method === 'MANUAL') return components.map(c => c.weight ?? 1 / components.length);

  const coingeckoIds = components.filter(c => c.coingeckoId).map(c => c.coingeckoId!);
  if (coingeckoIds.length === 0) return components.map(() => 1 / components.length);

  const caps = await fetchMarketCaps(coingeckoIds);
  const orderedCaps = components.map(c => c.coingeckoId ? (caps.get(c.coingeckoId) ?? 0) : 0);
  return computeWeights(
    method as 'EQUAL' | 'MARKET_CAP' | 'CAPPED_MARKET_CAP' | 'SQRT_MARKET_CAP' | 'MANUAL',
    orderedCaps,
    capPercent,
  );
};

export const customSymbolRouter = router({
  list: protectedProcedure.query(async () => {
    const symbols = await db.query.customSymbols.findMany({
      where: eq(customSymbols.isActive, true),
    });

    if (symbols.length === 0) return [];

    const allComponents = await db.query.customSymbolComponents.findMany({
      where: eq(customSymbolComponents.isActive, true),
    });

    const componentsBySymbolId = new Map<number, typeof allComponents>();
    for (const c of allComponents) {
      const existing = componentsBySymbolId.get(c.customSymbolId) ?? [];
      existing.push(c);
      componentsBySymbolId.set(c.customSymbolId, existing);
    }

    return symbols.map((cs) => ({
      ...cs,
      baseValue: parseFloat(cs.baseValue),
      capPercent: cs.capPercent ? parseFloat(cs.capPercent) : null,
      components: (componentsBySymbolId.get(cs.id) ?? []).map(c => ({
        ...c,
        weight: parseFloat(c.weight),
        basePrice: c.basePrice ? parseFloat(c.basePrice) : null,
      })),
    }));
  }),

  computeWeights: protectedProcedure
    .input(z.object({
      components: z.array(z.object({ coingeckoId: z.string(), symbol: z.string() })),
      method: weightingMethodSchema,
      capPercent: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const coingeckoIds = input.components.map(c => c.coingeckoId);
      const caps = await fetchMarketCaps(coingeckoIds);
      const orderedCaps = input.components.map(c => caps.get(c.coingeckoId) ?? 0);
      const weights = computeWeights(input.method, orderedCaps, input.capPercent);

      return input.components.map((c, i) => ({
        symbol: c.symbol,
        coingeckoId: c.coingeckoId,
        weight: weights[i]!,
        marketCap: orderedCaps[i]!,
      }));
    }),

  create: protectedProcedure
    .input(z.object({
      symbol: z.string().min(2).max(30).toUpperCase(),
      name: z.string().min(2).max(100),
      description: z.string().optional(),
      category: categorySchema,
      baseValue: z.number().positive().default(100),
      weightingMethod: weightingMethodSchema.default('CAPPED_MARKET_CAP'),
      capPercent: z.number().min(1).max(100).optional(),
      rebalanceIntervalDays: z.number().min(1).default(30),
      components: z.array(componentSchema).min(2),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.query.customSymbols.findFirst({
        where: eq(customSymbols.symbol, input.symbol),
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: `Symbol ${input.symbol} already exists` });

      const weights = await resolveWeights(input.weightingMethod, input.components, input.capPercent);

      const basePrices = new Map<string, number>();
      for (const c of input.components) {
        try {
          const price = await fetchBinancePrice(c.symbol);
          basePrices.set(c.symbol, price);
        } catch (err) {
          logger.warn({ symbol: c.symbol, error: err }, 'Failed to fetch base price for component');
        }
      }

      const [created] = await db.insert(customSymbols).values({
        symbol: input.symbol,
        name: input.name,
        description: input.description,
        category: input.category,
        baseValue: input.baseValue.toString(),
        weightingMethod: input.weightingMethod,
        capPercent: input.capPercent?.toString(),
        rebalanceIntervalDays: input.rebalanceIntervalDays,
        lastRebalancedAt: new Date(),
      }).returning();

      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create custom symbol' });

      await db.insert(customSymbolComponents).values(
        input.components.map((c, i) => ({
          customSymbolId: created.id,
          symbol: c.symbol,
          marketType: c.marketType ?? ('SPOT' as const),
          coingeckoId: c.coingeckoId,
          weight: weights[i]!.toString(),
          basePrice: basePrices.get(c.symbol)?.toString() ?? null,
        }))
      );

      await getCustomSymbolService()?.hotLoad(input.symbol);
      void getCustomSymbolService()?.backfillKlines(input.symbol, '1h', 'SPOT');

      return created;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: categorySchema.optional(),
      weightingMethod: weightingMethodSchema.optional(),
      capPercent: z.number().optional(),
      rebalanceIntervalDays: z.number().optional(),
      components: z.array(componentSchema).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, components, ...updates } = input;

      const updateData: Partial<typeof customSymbols.$inferInsert> = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.weightingMethod !== undefined) updateData.weightingMethod = updates.weightingMethod;
      if (updates.capPercent !== undefined) updateData.capPercent = updates.capPercent?.toString();
      if (updates.rebalanceIntervalDays !== undefined) updateData.rebalanceIntervalDays = updates.rebalanceIntervalDays;

      const [updated] = await db.update(customSymbols)
        .set(updateData)
        .where(eq(customSymbols.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Custom symbol not found' });

      if (components) {
        const existingComponents = await db.query.customSymbolComponents.findMany({
          where: eq(customSymbolComponents.customSymbolId, id),
        });
        const basePriceMap = new Map(
          existingComponents.map(c => [c.symbol, c.basePrice])
        );

        await db.delete(customSymbolComponents)
          .where(eq(customSymbolComponents.customSymbolId, id));

        const method = updates.weightingMethod ?? updated.weightingMethod;
        const capPct = updates.capPercent ?? (updated.capPercent ? parseFloat(updated.capPercent) : undefined);
        const weights = await resolveWeights(method, components, capPct);

        await db.insert(customSymbolComponents).values(
          components.map((c, i) => ({
            customSymbolId: id,
            symbol: c.symbol,
            marketType: c.marketType ?? ('SPOT' as const),
            coingeckoId: c.coingeckoId,
            weight: weights[i]!.toString(),
            basePrice: basePriceMap.get(c.symbol) ?? null,
          }))
        );
      }

      await getCustomSymbolService()?.hotLoad(updated.symbol);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db.update(customSymbols)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(customSymbols.id, input.id))
        .returning();

      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Custom symbol not found' });

      await getCustomSymbolService()?.remove(deleted.symbol);
      return { success: true };
    }),

  rebalance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const service = getCustomSymbolService();
      if (!service) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Custom symbol service not available' });

      const cs = await db.query.customSymbols.findFirst({
        where: eq(customSymbols.id, input.id),
      });
      if (!cs) throw new TRPCError({ code: 'NOT_FOUND', message: 'Custom symbol not found' });

      const state = service.getDefinition(cs.symbol);
      if (!state) throw new TRPCError({ code: 'NOT_FOUND', message: 'Custom symbol not loaded' });

      await service.rebalanceSymbol(state);

      return { success: true };
    }),
});
