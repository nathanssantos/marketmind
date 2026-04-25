import { checklistConditionSchema, conditionSideSchema } from '@marketmind/trading-core';
import { z } from 'zod';
import { tradingProfileQueries } from '../../services/database/tradingProfileQueries';
import { evaluateChecklist } from '../../services/checklist/evaluate-checklist';
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

      return evaluateChecklist({
        userId: ctx.user.id,
        symbol: input.symbol,
        interval: input.interval,
        marketType: input.marketType,
        side: input.side,
        conditions: conditions ?? [],
      });
    }),
});
