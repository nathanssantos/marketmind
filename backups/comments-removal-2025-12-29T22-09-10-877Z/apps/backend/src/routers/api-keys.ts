import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiKeys } from '../db/schema';
import { decryptApiKey, encryptApiKey } from '../services/encryption';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

const providerSchema = z.enum(['openai', 'anthropic', 'gemini']);

export const apiKeyRouter = router({
  set: protectedProcedure
    .input(z.object({
      provider: providerSchema,
      key: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const encrypted = encryptApiKey(input.key);

      const existing = await ctx.db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, ctx.user.id),
          eq(apiKeys.provider, input.provider)
        ))
        .limit(1);

      const existingKey = existing[0];
      if (existingKey) {
        await ctx.db
          .update(apiKeys)
          .set({
            keyEncrypted: encrypted,
            updatedAt: new Date(),
          })
          .where(eq(apiKeys.id, existingKey.id));
      } else {
        await ctx.db.insert(apiKeys).values({
          id: generateEntityId(),
          userId: ctx.user.id,
          provider: input.provider,
          keyEncrypted: encrypted,
        });
      }

      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({
      provider: providerSchema,
    }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ keyEncrypted: apiKeys.keyEncrypted })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, ctx.user.id),
          eq(apiKeys.provider, input.provider)
        ))
        .limit(1);

      if (!row) return { key: null };

      return { key: decryptApiKey(row.keyEncrypted) };
    }),

  delete: protectedProcedure
    .input(z.object({
      provider: providerSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(apiKeys)
        .where(and(
          eq(apiKeys.userId, ctx.user.id),
          eq(apiKeys.provider, input.provider)
        ));

      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ provider: apiKeys.provider })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id));

    const providers = ['openai', 'anthropic', 'gemini'] as const;
    return providers.reduce((acc, p) => {
      acc[p] = rows.some(r => r.provider === p);
      return acc;
    }, {} as Record<string, boolean>);
  }),

  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id));

    return { success: true };
  }),
});
