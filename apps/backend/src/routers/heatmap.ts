import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { heatmapAlwaysCollectSymbols } from '../db/schema';
import { liquidityHeatmapAggregator } from '../services/liquidity-heatmap-aggregator';
import { protectedProcedure, router } from '../trpc';

export const heatmapRouter = router({
  getAlwaysCollectSymbols: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db.select().from(heatmapAlwaysCollectSymbols);
      return rows.map(r => r.symbol);
    }),

  addAlwaysCollectSymbol: protectedProcedure
    .input(z.object({ symbol: z.string().min(1).max(20).transform(s => s.toUpperCase()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(heatmapAlwaysCollectSymbols)
        .values({ symbol: input.symbol })
        .onConflictDoNothing();
      liquidityHeatmapAggregator.addSymbol(input.symbol);
      return { success: true };
    }),

  getActiveSymbols: protectedProcedure
    .query(() => liquidityHeatmapAggregator.getActiveSymbols()),

  removeAlwaysCollectSymbol: protectedProcedure
    .input(z.object({ symbol: z.string().min(1).max(20).transform(s => s.toUpperCase()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(heatmapAlwaysCollectSymbols)
        .where(eq(heatmapAlwaysCollectSymbols.symbol, input.symbol));
      liquidityHeatmapAggregator.removeSymbol(input.symbol);
      return { success: true };
    }),
});
