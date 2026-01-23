import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { userPreferences } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

const categorySchema = z.enum(['trading', 'ui', 'chart', 'notifications', 'recent']);

const parseJsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const preferencesRouter = router({
  get: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string().min(1).max(100),
    }))
    .query(async ({ ctx, input }) => {
      const pref = await ctx.db.query.userPreferences.findFirst({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
          eq(userPreferences.key, input.key),
        ),
      });

      return pref ? parseJsonValue(pref.value) : null;
    }),

  getByCategory: protectedProcedure
    .input(z.object({ category: categorySchema }))
    .query(async ({ ctx, input }) => {
      const prefs = await ctx.db.query.userPreferences.findMany({
        where: and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
        ),
      });

      return Object.fromEntries(
        prefs.map(p => [p.key, parseJsonValue(p.value)])
      );
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const prefs = await ctx.db.query.userPreferences.findMany({
        where: eq(userPreferences.userId, ctx.user.id),
      });

      const result: Record<string, Record<string, unknown>> = {};

      for (const pref of prefs) {
        if (!result[pref.category]) result[pref.category] = {};
        result[pref.category][pref.key] = parseJsonValue(pref.value);
      }

      return result;
    }),

  set: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string().min(1).max(100),
      value: z.unknown(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stringValue = stringifyValue(input.value);

      const [pref] = await ctx.db
        .insert(userPreferences)
        .values({
          userId: ctx.user.id,
          category: input.category,
          key: input.key,
          value: stringValue,
        })
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.category, userPreferences.key],
          set: { value: stringValue, updatedAt: new Date() },
        })
        .returning();

      if (!pref) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save preference',
        });
      }

      return { success: true, id: pref.id };
    }),

  delete: protectedProcedure
    .input(z.object({
      category: categorySchema,
      key: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userPreferences)
        .where(and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
          eq(userPreferences.key, input.key),
        ));

      return { success: true };
    }),

  bulkSet: protectedProcedure
    .input(z.object({
      category: categorySchema,
      preferences: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const entries = Object.entries(input.preferences);

      if (entries.length === 0) return { success: true, count: 0 };

      await Promise.all(entries.map(([key, value]) =>
        ctx.db
          .insert(userPreferences)
          .values({
            userId: ctx.user.id,
            category: input.category,
            key,
            value: stringifyValue(value),
          })
          .onConflictDoUpdate({
            target: [userPreferences.userId, userPreferences.category, userPreferences.key],
            set: { value: stringifyValue(value), updatedAt: new Date() },
          })
      ));

      return { success: true, count: entries.length };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ category: categorySchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userPreferences)
        .where(and(
          eq(userPreferences.userId, ctx.user.id),
          eq(userPreferences.category, input.category),
        ));

      return { success: true };
    }),

  clearAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db
        .delete(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),
});
