import {
  PatternParseError,
  parsePatternExpression,
  type PatternDefinition,
} from '@marketmind/trading-core';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { userPatterns } from '../db/schema';
import { seedDefaultUserPatterns } from '../services/user-patterns';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';
import { badRequest, notFound } from '../utils/trpc-errors';

const PATTERN_CATEGORIES = ['reversal-single', 'reversal-multi', 'continuation', 'indecision'] as const;
const PATTERN_SENTIMENTS = ['bullish', 'bearish', 'neutral'] as const;

const definitionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  label: z.string().min(1).max(120),
  category: z.enum(PATTERN_CATEGORIES),
  sentiment: z.enum(PATTERN_SENTIMENTS),
  bars: z.number().int().min(1).max(5),
  params: z.array(
    z.object({
      key: z.string().min(1).max(64),
      label: z.string().min(1).max(120),
      type: z.literal('number'),
      default: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      description: z.string().optional(),
    }),
  ),
  constraints: z.array(z.string().min(1)).min(1),
  description: z.string().optional(),
});

const validateConstraints = (def: z.infer<typeof definitionSchema>): void => {
  for (const c of def.constraints) {
    try { parsePatternExpression(c); }
    catch (err) {
      const msg = err instanceof PatternParseError ? err.message : 'Invalid expression';
      throw badRequest(`Invalid constraint "${c}": ${msg}`);
    }
  }
};

const parseRow = (row: typeof userPatterns.$inferSelect): {
  id: string;
  patternId: string;
  label: string;
  definition: PatternDefinition;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
} => {
  let definition: PatternDefinition;
  try { definition = JSON.parse(row.definition) as PatternDefinition; }
  catch { definition = { id: row.patternId, label: row.label, category: 'indecision', sentiment: 'neutral', bars: 1, params: [], constraints: ['1 = 1'] }; }
  return {
    id: row.id,
    patternId: row.patternId,
    label: row.label,
    definition,
    isCustom: row.isCustom,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const userPatternsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await seedDefaultUserPatterns(ctx.user.id);
    const rows = await db
      .select()
      .from(userPatterns)
      .where(eq(userPatterns.userId, ctx.user.id))
      .orderBy(asc(userPatterns.createdAt));
    return rows.map(parseRow);
  }),

  create: protectedProcedure
    .input(z.object({ definition: definitionSchema }))
    .mutation(async ({ ctx, input }) => {
      validateConstraints(input.definition);
      const now = new Date();
      const [row] = await db
        .insert(userPatterns)
        .values({
          id: generateEntityId(),
          userId: ctx.user.id,
          patternId: input.definition.id,
          label: input.definition.label,
          definition: JSON.stringify(input.definition),
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return parseRow(row!);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), definition: definitionSchema }))
    .mutation(async ({ ctx, input }) => {
      validateConstraints(input.definition);
      const [row] = await db
        .update(userPatterns)
        .set({
          patternId: input.definition.id,
          label: input.definition.label,
          definition: JSON.stringify(input.definition),
          updatedAt: new Date(),
        })
        .where(and(eq(userPatterns.id, input.id), eq(userPatterns.userId, ctx.user.id)))
        .returning();
      if (!row) throw notFound('Pattern');
      return parseRow(row);
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [source] = await db
        .select()
        .from(userPatterns)
        .where(and(eq(userPatterns.id, input.id), eq(userPatterns.userId, ctx.user.id)))
        .limit(1);
      if (!source) throw notFound('Pattern');
      const now = new Date();
      const [row] = await db
        .insert(userPatterns)
        .values({
          id: generateEntityId(),
          userId: ctx.user.id,
          patternId: `${source.patternId}-copy`,
          label: `${source.label} (copy)`,
          definition: source.definition,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return parseRow(row!);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Built-ins (is_custom=false) cannot be deleted — they are seeded
      // back on next list() anyway. Only custom user-created patterns
      // can be removed permanently.
      const [row] = await db
        .delete(userPatterns)
        .where(and(
          eq(userPatterns.id, input.id),
          eq(userPatterns.userId, ctx.user.id),
          eq(userPatterns.isCustom, true),
        ))
        .returning({ id: userPatterns.id });
      if (!row) throw notFound('Pattern (or pattern is a built-in and cannot be deleted)');
      return { id: row.id };
    }),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(userPatterns).where(eq(userPatterns.userId, ctx.user.id));
    await seedDefaultUserPatterns(ctx.user.id);
    const rows = await db
      .select()
      .from(userPatterns)
      .where(eq(userPatterns.userId, ctx.user.id))
      .orderBy(asc(userPatterns.createdAt));
    return rows.map(parseRow);
  }),
});
