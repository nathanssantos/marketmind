import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { chartDrawings } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

const drawingTypeSchema = z.enum([
  'line', 'rectangle', 'pencil', 'fibonacci', 'ruler', 'area', 'arrow', 'text',
  'ray', 'horizontalLine', 'channel',
  'trendLine', 'priceRange', 'verticalLine', 'highlighter', 'ellipse', 'pitchfork', 'gannFan',
]);

export const drawingRouter = router({
  listBySymbol: protectedProcedure
    .input(z.object({ symbol: z.string(), interval: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.query.chartDrawings.findMany({
        where: and(
          eq(chartDrawings.userId, ctx.user.id),
          eq(chartDrawings.symbol, input.symbol),
          eq(chartDrawings.interval, input.interval),
        ),
        orderBy: (t, { asc }) => [asc(t.zIndex)],
      });
    }),

  create: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      interval: z.string(),
      type: drawingTypeSchema,
      data: z.string(),
      visible: z.boolean().default(true),
      locked: z.boolean().default(false),
      zIndex: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [drawing] = await db.insert(chartDrawings).values({
        userId: ctx.user.id,
        symbol: input.symbol,
        interval: input.interval,
        type: input.type,
        data: input.data,
        visible: input.visible,
        locked: input.locked,
        zIndex: input.zIndex,
      }).returning();

      return drawing!;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.string().optional(),
      visible: z.boolean().optional(),
      locked: z.boolean().optional(),
      zIndex: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await db
        .update(chartDrawings)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(chartDrawings.id, id), eq(chartDrawings.userId, ctx.user.id)))
        .returning();

      if (!updated) throw new Error('Drawing not found');
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(chartDrawings)
        .where(and(eq(chartDrawings.id, input.id), eq(chartDrawings.userId, ctx.user.id)))
        .returning();

      if (!deleted) throw new Error('Drawing not found');
      return { success: true };
    }),
});
