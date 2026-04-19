import { z } from 'zod';

export const CONDITION_OPS = [
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
] as const;

export const CONDITION_TIERS = ['required', 'preferred'] as const;

export const CONDITION_SIDES = ['LONG', 'SHORT', 'BOTH'] as const;

export const conditionOpSchema = z.enum(CONDITION_OPS);

export const conditionTierSchema = z.enum(CONDITION_TIERS);

export const conditionSideSchema = z.enum(CONDITION_SIDES);

export const conditionThresholdSchema = z.union([
  z.number(),
  z.tuple([z.number(), z.number()]),
]);

export const checklistConditionSchema = z.object({
  id: z.string(),
  userIndicatorId: z.string(),
  timeframe: z.string(),
  op: conditionOpSchema,
  threshold: conditionThresholdSchema.optional(),
  tier: conditionTierSchema,
  side: conditionSideSchema,
  weight: z.number().positive(),
  enabled: z.boolean(),
  order: z.number().int(),
});
