import { checklistConditionSchema, conditionSideSchema } from '@marketmind/trading-core';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { checklistScoreHistory } from '../../db/schema';
import { tradingProfileQueries } from '../../services/database/tradingProfileQueries';
import { evaluateChecklist } from '../../services/checklist/evaluate-checklist';
import { logger, serializeError } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';
import { parseChecklistConditions } from '../../utils/profile-transformers';

export const checklistRouter = router({
  evaluateChecklist: protectedProcedure
    .input(
      z
        .object({
          symbol: z.string().min(1),
          interval: z.string().min(1),
          marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
          side: conditionSideSchema.optional(),
          profileId: z.string().optional(),
          conditions: z.array(checklistConditionSchema).optional(),
        })
        .refine((v) => v.profileId !== undefined || v.conditions !== undefined, {
          message: 'Either profileId or conditions must be provided',
        }),
    )
    .query(async ({ ctx, input }) => {
      let conditions = input.conditions;

      if (!conditions && input.profileId) {
        const profile = await tradingProfileQueries.getByIdAndUser(input.profileId, ctx.user.id);
        conditions = parseChecklistConditions(profile.checklistConditions);
      }

      const result = await evaluateChecklist({
        userId: ctx.user.id,
        symbol: input.symbol,
        interval: input.interval,
        marketType: input.marketType,
        side: input.side,
        conditions: conditions ?? [],
      });

      // Write-through to history. Skipped when no profileId is bound
      // (ad-hoc evaluations don't get persisted — the chart needs a
      // stable {profile, symbol, interval} key to query against). The
      // table has a unique (profile,symbol,interval,marketType,recordedAt)
      // constraint; ON CONFLICT DO NOTHING absorbs near-simultaneous
      // calls (rare with the 15s frontend refetch but possible).
      if (input.profileId && Number.isFinite(result.scoreLong.score) && Number.isFinite(result.scoreShort.score)) {
        try {
          await db
            .insert(checklistScoreHistory)
            .values({
              userId: ctx.user.id,
              profileId: input.profileId,
              symbol: input.symbol,
              interval: input.interval,
              marketType: input.marketType,
              scoreLong: result.scoreLong.score.toFixed(2),
              scoreShort: result.scoreShort.score.toFixed(2),
              source: 'live',
            })
            .onConflictDoNothing();
        } catch (e) {
          logger.warn(
            { error: serializeError(e), profileId: input.profileId, symbol: input.symbol },
            '[checklist] history write-through failed',
          );
        }
      }

      return result;
    }),

  getScoreHistory: protectedProcedure
    .input(
      z.object({
        profileId: z.string(),
        symbol: z.string().min(1),
        interval: z.string().min(1),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        sinceMs: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(5000).default(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = input.sinceMs ? new Date(input.sinceMs) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          recordedAt: checklistScoreHistory.recordedAt,
          scoreLong: checklistScoreHistory.scoreLong,
          scoreShort: checklistScoreHistory.scoreShort,
          source: checklistScoreHistory.source,
        })
        .from(checklistScoreHistory)
        .where(
          and(
            eq(checklistScoreHistory.userId, ctx.user.id),
            eq(checklistScoreHistory.profileId, input.profileId),
            eq(checklistScoreHistory.symbol, input.symbol),
            eq(checklistScoreHistory.interval, input.interval),
            eq(checklistScoreHistory.marketType, input.marketType),
            gte(checklistScoreHistory.recordedAt, since),
          ),
        )
        .orderBy(sql`${checklistScoreHistory.recordedAt} ASC`)
        .limit(input.limit);

      return rows.map((r) => ({
        t: r.recordedAt.getTime(),
        long: parseFloat(r.scoreLong),
        short: parseFloat(r.scoreShort),
        source: r.source,
      }));
    }),
});
