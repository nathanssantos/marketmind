import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { activeWatchers, tradingProfiles } from '../db/schema';
import { protectedProcedure, router } from '../trpc';
import type { NewTradingProfileRow } from '../db/schema';
import { generateEntityId } from '../utils/id';
import {
  transformTradingProfile,
  stringifyChecklistConditions,
  stringifyEnabledSetupTypes,
} from '../utils/profile-transformers';
import { applyProfileFieldsToUpdate } from '../utils/config-field-registry';
import { materializeDefaultChecklist } from '../services/user-indicators';
import { FIB_LEVELS } from '@marketmind/types';

const fibLevelSchema = z.enum(FIB_LEVELS);

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

const conditionThresholdSchema = z.union([
  z.number(),
  z.tuple([z.number(), z.number()]),
]);

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

const profileConfigFields = {
  tradingMode: z.enum(['auto', 'semi_assisted']).optional().nullable(),
  directionMode: z.enum(['auto', 'long_only', 'short_only']).optional().nullable(),
  positionSizePercent: z.number().min(0.1).max(100).optional().nullable(),
  useTrendFilter: z.boolean().optional().nullable(),
  useAdxFilter: z.boolean().optional().nullable(),
  useChoppinessFilter: z.boolean().optional().nullable(),
  useVwapFilter: z.boolean().optional().nullable(),
  useStochasticFilter: z.boolean().optional().nullable(),
  useStochasticRecoveryFilter: z.boolean().optional().nullable(),
  useMomentumTimingFilter: z.boolean().optional().nullable(),
  useBtcCorrelationFilter: z.boolean().optional().nullable(),
  useVolumeFilter: z.boolean().optional().nullable(),
  useDirectionFilter: z.boolean().optional().nullable(),
  useSuperTrendFilter: z.boolean().optional().nullable(),
  useMarketRegimeFilter: z.boolean().optional().nullable(),
  useBollingerSqueezeFilter: z.boolean().optional().nullable(),
  useMtfFilter: z.boolean().optional().nullable(),
  useStochasticHtfFilter: z.boolean().optional().nullable(),
  useStochasticRecoveryHtfFilter: z.boolean().optional().nullable(),
  useFundingFilter: z.boolean().optional().nullable(),
  useFvgFilter: z.boolean().optional().nullable(),
  useConfluenceScoring: z.boolean().optional().nullable(),
  confluenceMinScore: z.number().min(0).max(100).optional().nullable(),
  useCooldown: z.boolean().optional().nullable(),
  cooldownMinutes: z.number().min(1).max(1440).optional().nullable(),
  fibonacciTargetLevelLong: fibLevelSchema.optional().nullable(),
  fibonacciTargetLevelShort: fibLevelSchema.optional().nullable(),
  fibonacciSwingRange: z.enum(['nearest', 'extended']).optional().nullable(),
  maxFibonacciEntryProgressPercentLong: z.number().min(0).max(200).optional().nullable(),
  maxFibonacciEntryProgressPercentShort: z.number().min(0).max(200).optional().nullable(),
  initialStopMode: z.enum(['fibo_target', 'nearest_swing']).optional().nullable(),
  tpCalculationMode: z.enum(['default', 'fibonacci']).optional().nullable(),
  minRiskRewardRatioLong: z.number().min(0).max(10).optional().nullable(),
  minRiskRewardRatioShort: z.number().min(0).max(10).optional().nullable(),
  trailingStopEnabled: z.boolean().optional().nullable(),
  trailingStopMode: z.enum(['local', 'binance']).optional().nullable(),
  trailingActivationPercentLong: z.number().min(0).max(10).optional().nullable(),
  trailingActivationPercentShort: z.number().min(0).max(10).optional().nullable(),
  trailingDistancePercentLong: z.number().min(0).max(10).optional().nullable(),
  trailingDistancePercentShort: z.number().min(0).max(10).optional().nullable(),
  trailingDistanceMode: z.enum(['auto', 'fixed']).optional().nullable(),
  trailingStopOffsetPercent: z.number().min(0).max(1).optional().nullable(),
  trailingActivationModeLong: z.enum(['auto', 'manual']).optional().nullable(),
  trailingActivationModeShort: z.enum(['auto', 'manual']).optional().nullable(),
  useAdaptiveTrailing: z.boolean().optional().nullable(),
  maxDrawdownEnabled: z.boolean().optional().nullable(),
  maxDrawdownPercent: z.number().min(1).max(100).optional().nullable(),
  dailyLossLimit: z.number().min(0.1).max(100).optional().nullable(),
  maxRiskPerStopEnabled: z.boolean().optional().nullable(),
  maxRiskPerStopPercent: z.number().min(0.1).max(50).optional().nullable(),
  choppinessThresholdHigh: z.number().min(30).max(80).optional().nullable(),
  choppinessThresholdLow: z.number().min(20).max(60).optional().nullable(),
  volumeFilterObvLookbackLong: z.number().min(1).max(50).optional().nullable(),
  volumeFilterObvLookbackShort: z.number().min(1).max(50).optional().nullable(),
  useObvCheckLong: z.boolean().optional().nullable(),
  useObvCheckShort: z.boolean().optional().nullable(),
};

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabledSetupTypes: z.array(z.string()).min(1),
  maxPositionSize: z.number().min(1).max(100).optional(),
  maxConcurrentPositions: z.number().min(1).max(10).optional(),
  isDefault: z.boolean().optional(),
  ...profileConfigFields,
});

const updateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  enabledSetupTypes: z.array(z.string()).min(1).optional(),
  maxPositionSize: z.number().min(1).max(100).nullable().optional(),
  maxConcurrentPositions: z.number().min(1).max(10).nullable().optional(),
  isDefault: z.boolean().optional(),
  ...profileConfigFields,
});

const importFromBacktestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabledSetupTypes: z.array(z.string()).min(1),
  ...profileConfigFields,
});

export const tradingProfilesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const profiles = await db
      .select()
      .from(tradingProfiles)
      .where(eq(tradingProfiles.userId, ctx.user.id))
      .orderBy(tradingProfiles.createdAt);

    return profiles.map(transformTradingProfile);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await db
        .select()
        .from(tradingProfiles)
        .where(and(eq(tradingProfiles.id, input.id), eq(tradingProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return transformTradingProfile(profile);
    }),

  create: protectedProcedure.input(createProfileSchema).mutation(async ({ ctx, input }) => {
    const id = generateEntityId();

    if (input.isDefault) {
      await db
        .update(tradingProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(tradingProfiles.userId, ctx.user.id), eq(tradingProfiles.isDefault, true)));
    }

    const defaultChecklist = await materializeDefaultChecklist(ctx.user.id);

    const values: NewTradingProfileRow = {
      id,
      userId: ctx.user.id,
      name: input.name,
      description: input.description ?? null,
      enabledSetupTypes: stringifyEnabledSetupTypes(input.enabledSetupTypes),
      maxPositionSize: input.maxPositionSize?.toString() ?? null,
      maxConcurrentPositions: input.maxConcurrentPositions ?? null,
      isDefault: input.isDefault ?? false,
      checklistConditions: stringifyChecklistConditions(defaultChecklist),
    };

    const configFieldKeys = Object.keys(profileConfigFields) as (keyof typeof profileConfigFields)[];
    for (const key of configFieldKeys) {
      const val = (input as Record<string, unknown>)[key];
      if (val !== undefined) {
        (values as Record<string, unknown>)[key] = val;
      }
    }

    await db.insert(tradingProfiles).values(values);

    const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, id)).limit(1);

    return transformTradingProfile(profile!);
  }),

  update: protectedProcedure.input(updateProfileSchema).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(tradingProfiles)
      .where(and(eq(tradingProfiles.id, input.id), eq(tradingProfiles.userId, ctx.user.id)))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    if (input.isDefault) {
      await db
        .update(tradingProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(tradingProfiles.userId, ctx.user.id), eq(tradingProfiles.isDefault, true)));
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    applyProfileFieldsToUpdate(input as Record<string, unknown>, updateData);

    await db.update(tradingProfiles).set(updateData).where(eq(tradingProfiles.id, input.id));

    const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, input.id)).limit(1);

    return transformTradingProfile(profile!);
  }),

  updateChecklist: protectedProcedure
    .input(z.object({ id: z.string(), checklistConditions: z.array(checklistConditionSchema) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(tradingProfiles)
        .where(and(eq(tradingProfiles.id, input.id), eq(tradingProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      await db
        .update(tradingProfiles)
        .set({
          checklistConditions: stringifyChecklistConditions(input.checklistConditions),
          updatedAt: new Date(),
        })
        .where(eq(tradingProfiles.id, input.id));

      const [profile] = await db
        .select()
        .from(tradingProfiles)
        .where(eq(tradingProfiles.id, input.id))
        .limit(1);

      return transformTradingProfile(profile!);
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(tradingProfiles)
      .where(and(eq(tradingProfiles.id, input.id), eq(tradingProfiles.userId, ctx.user.id)))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    await db.delete(tradingProfiles).where(eq(tradingProfiles.id, input.id));

    return { success: true };
  }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string(), newName: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(tradingProfiles)
        .where(and(eq(tradingProfiles.id, input.id), eq(tradingProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      const id = generateEntityId();

      const { id: _existingId, userId: _userId, createdAt: _created, updatedAt: _updated, ...fieldsToClone } = existing;

      await db.insert(tradingProfiles).values({
        ...fieldsToClone,
        id,
        userId: ctx.user.id,
        name: input.newName,
        isDefault: false,
      });

      const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, id)).limit(1);

      return transformTradingProfile(profile!);
    }),

  importFromBacktest: protectedProcedure
    .input(importFromBacktestSchema)
    .mutation(async ({ ctx, input }) => {
      const id = generateEntityId();
      const defaultChecklist = await materializeDefaultChecklist(ctx.user.id);

      const values: NewTradingProfileRow = {
        id,
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        enabledSetupTypes: stringifyEnabledSetupTypes(input.enabledSetupTypes),
        isDefault: false,
        checklistConditions: stringifyChecklistConditions(defaultChecklist),
      };

      const configFieldKeys = Object.keys(profileConfigFields) as (keyof typeof profileConfigFields)[];
      for (const key of configFieldKeys) {
        const val = (input as Record<string, unknown>)[key];
        if (val !== undefined) {
          (values as Record<string, unknown>)[key] = val;
        }
      }

      await db.insert(tradingProfiles).values(values);

      const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, id)).limit(1);

      return transformTradingProfile(profile!);
    }),

  assignToWatcher: protectedProcedure
    .input(z.object({ watcherId: z.string(), profileId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [watcher] = await db
        .select()
        .from(activeWatchers)
        .where(and(eq(activeWatchers.id, input.watcherId), eq(activeWatchers.userId, ctx.user.id)))
        .limit(1);

      if (!watcher) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Watcher not found' });
      }

      if (input.profileId) {
        const [profile] = await db
          .select()
          .from(tradingProfiles)
          .where(and(eq(tradingProfiles.id, input.profileId), eq(tradingProfiles.userId, ctx.user.id)))
          .limit(1);

        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
        }
      }

      await db
        .update(activeWatchers)
        .set({ profileId: input.profileId })
        .where(eq(activeWatchers.id, input.watcherId));

      return { success: true };
    }),
});
