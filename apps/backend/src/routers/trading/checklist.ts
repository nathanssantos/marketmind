import type { MarketType } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { tradingProfiles } from '../../db/schema';
import { evaluateChecklist } from '../../services/checklist/evaluate-checklist';
import { protectedProcedure, router } from '../../trpc';
import { parseChecklistConditions } from '../../utils/profile-transformers';

const conditionOpSchema = z.enum([
  'gt',
  'lt',
  'between',
  'outside',
  'crossAbove',
  'crossBelow',
  'oversold',
  'overbought',
  'rising',
  'falling',
  'priceAbove',
  'priceBelow',
]);

const conditionThresholdSchema = z.union([z.number(), z.tuple([z.number(), z.number()])]);

const checklistConditionSchema = z.object({
  id: z.string(),
  userIndicatorId: z.string(),
  timeframe: z.string(),
  op: conditionOpSchema,
  threshold: conditionThresholdSchema.optional(),
  tier: z.enum(['required', 'preferred']),
  side: z.enum(['LONG', 'SHORT', 'BOTH']),
  enabled: z.boolean(),
  order: z.number().int(),
});

export const checklistRouter = router({
  evaluateChecklist: protectedProcedure
    .input(
      z
        .object({
          symbol: z.string().min(1),
          interval: z.string().min(1),
          marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
          side: z.enum(['LONG', 'SHORT', 'BOTH']).optional(),
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
        const [profile] = await db
          .select()
          .from(tradingProfiles)
          .where(
            and(
              eq(tradingProfiles.id, input.profileId),
              eq(tradingProfiles.userId, ctx.user.id),
            ),
          )
          .limit(1);

        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
        }

        conditions = parseChecklistConditions(profile.checklistConditions);
      }

      return evaluateChecklist({
        userId: ctx.user.id,
        symbol: input.symbol,
        interval: input.interval,
        marketType: input.marketType as MarketType,
        side: input.side,
        conditions: conditions ?? [],
      });
    }),
});
