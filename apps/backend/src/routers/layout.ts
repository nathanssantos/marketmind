import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { userLayouts } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

export const layoutRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const layout = await ctx.db.query.userLayouts.findFirst({
      where: eq(userLayouts.userId, ctx.user.id),
    });

    if (!layout) return null;

    try {
      return JSON.parse(layout.data);
    } catch {
      return null;
    }
  }),

  save: protectedProcedure
    .input(z.object({
      data: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .insert(userLayouts)
        .values({
          userId: ctx.user.id,
          data: input.data,
        })
        .onConflictDoUpdate({
          target: [userLayouts.userId],
          set: { data: input.data, updatedAt: new Date() },
        })
        .returning();

      return { success: true, id: result!.id };
    }),
});
