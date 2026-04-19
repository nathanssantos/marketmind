import { INDICATOR_CATALOG, sanitizeIndicatorParams } from '@marketmind/trading-core';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { userIndicators } from '../db/schema';
import { seedDefaultUserIndicators } from '../services/user-indicators';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';
import { parseIndicatorParams, stringifyIndicatorParams } from '../utils/profile-transformers';

const rawParamsSchema = z.record(z.string(), z.unknown());

const assertCatalogType = (catalogType: string): void => {
  if (!INDICATOR_CATALOG[catalogType]) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown indicator type: ${catalogType}`,
    });
  }
};

const validateParams = (
  catalogType: string,
  raw: Record<string, unknown> | undefined,
): Record<string, IndicatorParamValue> => {
  const { params, errors } = sanitizeIndicatorParams(catalogType, raw ?? {});
  const blocking = errors.filter((e) => !e.message.startsWith('Unknown param'));
  if (blocking.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid params: ${blocking.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
    });
  }
  return params;
};

const parseIndicator = (row: typeof userIndicators.$inferSelect) => ({
  id: row.id,
  catalogType: row.catalogType,
  label: row.label,
  params: parseIndicatorParams(row.params),
  isCustom: row.isCustom,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const userIndicatorsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await seedDefaultUserIndicators(ctx.user.id);

    const rows = await db
      .select()
      .from(userIndicators)
      .where(eq(userIndicators.userId, ctx.user.id))
      .orderBy(asc(userIndicators.createdAt));

    return rows.map(parseIndicator);
  }),

  create: protectedProcedure
    .input(
      z.object({
        catalogType: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        params: rawParamsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCatalogType(input.catalogType);
      const validated = validateParams(input.catalogType, input.params);

      const now = new Date();
      const [row] = await db
        .insert(userIndicators)
        .values({
          id: generateEntityId(),
          userId: ctx.user.id,
          catalogType: input.catalogType,
          label: input.label,
          params: stringifyIndicatorParams(validated),
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return parseIndicator(row!);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(120).optional(),
        params: rawParamsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, label, params } = input;

      const updates: Partial<typeof userIndicators.$inferInsert> = { updatedAt: new Date() };
      if (label !== undefined) updates.label = label;

      if (params !== undefined) {
        const [existing] = await db
          .select({ catalogType: userIndicators.catalogType })
          .from(userIndicators)
          .where(and(eq(userIndicators.id, id), eq(userIndicators.userId, ctx.user.id)))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Indicator not found' });
        }
        updates.params = stringifyIndicatorParams(validateParams(existing.catalogType, params));
      }

      const [row] = await db
        .update(userIndicators)
        .set(updates)
        .where(and(eq(userIndicators.id, id), eq(userIndicators.userId, ctx.user.id)))
        .returning();

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Indicator not found' });
      }

      return parseIndicator(row);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .delete(userIndicators)
        .where(and(eq(userIndicators.id, input.id), eq(userIndicators.userId, ctx.user.id)))
        .returning({ id: userIndicators.id });

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Indicator not found' });
      }

      return { id: row.id };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [source] = await db
        .select()
        .from(userIndicators)
        .where(and(eq(userIndicators.id, input.id), eq(userIndicators.userId, ctx.user.id)))
        .limit(1);

      if (!source) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Indicator not found' });
      }

      const now = new Date();
      const [row] = await db
        .insert(userIndicators)
        .values({
          id: generateEntityId(),
          userId: ctx.user.id,
          catalogType: source.catalogType,
          label: `${source.label} (copy)`,
          params: source.params,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return parseIndicator(row!);
    }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(userIndicators).where(eq(userIndicators.userId, ctx.user.id));
    await seedDefaultUserIndicators(ctx.user.id);

    const rows = await db
      .select()
      .from(userIndicators)
      .where(eq(userIndicators.userId, ctx.user.id))
      .orderBy(asc(userIndicators.createdAt));

    return rows.map(parseIndicator);
  }),
});
