import { TRPCError } from '@trpc/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { signalSuggestions } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

export const signalSuggestionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      status: z.enum(['pending', 'accepted', 'rejected', 'expired']).optional(),
      limit: z.number().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(signalSuggestions.userId, ctx.user.id),
        eq(signalSuggestions.walletId, input.walletId),
      ];

      if (input.status) {
        conditions.push(eq(signalSuggestions.status, input.status));
      }

      const suggestions = await db
        .select()
        .from(signalSuggestions)
        .where(and(...conditions))
        .orderBy(desc(signalSuggestions.createdAt))
        .limit(input.limit ?? 50);

      return suggestions;
    }),

  accept: protectedProcedure
    .input(z.object({
      id: z.string(),
      positionSizePercent: z.number().min(0.1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [suggestion] = await db
        .select()
        .from(signalSuggestions)
        .where(and(
          eq(signalSuggestions.id, input.id),
          eq(signalSuggestions.userId, ctx.user.id),
        ))
        .limit(1);

      if (!suggestion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' });
      }

      if (suggestion.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Suggestion is already ${suggestion.status}` });
      }

      if (suggestion.expiresAt && suggestion.expiresAt < new Date()) {
        await db
          .update(signalSuggestions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(signalSuggestions.id, input.id));
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Suggestion has expired' });
      }

      await db
        .update(signalSuggestions)
        .set({
          status: 'accepted',
          positionSizePercent: input.positionSizePercent?.toString() ?? suggestion.positionSizePercent,
          updatedAt: new Date(),
        })
        .where(eq(signalSuggestions.id, input.id));

      const [updated] = await db
        .select()
        .from(signalSuggestions)
        .where(eq(signalSuggestions.id, input.id))
        .limit(1);

      return updated!;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [suggestion] = await db
        .select()
        .from(signalSuggestions)
        .where(and(
          eq(signalSuggestions.id, input.id),
          eq(signalSuggestions.userId, ctx.user.id),
        ))
        .limit(1);

      if (!suggestion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' });
      }

      if (suggestion.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Suggestion is already ${suggestion.status}` });
      }

      await db
        .update(signalSuggestions)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(signalSuggestions.id, input.id));

      return { success: true };
    }),

  expireStale: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();

    await db
      .update(signalSuggestions)
      .set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(signalSuggestions.userId, ctx.user.id),
        eq(signalSuggestions.status, 'pending'),
        lt(signalSuggestions.expiresAt, now),
      ));

    return { success: true };
  }),

  clearAll: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(signalSuggestions)
        .where(and(
          eq(signalSuggestions.userId, ctx.user.id),
          eq(signalSuggestions.walletId, input.walletId),
        ));

      return { success: true };
    }),
});
