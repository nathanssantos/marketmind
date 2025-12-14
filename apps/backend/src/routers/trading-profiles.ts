import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { activeWatchers, tradingProfiles } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

const generateId = (): string => randomBytes(16).toString('base64url').slice(0, 21);

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabledSetupTypes: z.array(z.string()).min(1),
  maxPositionSize: z.number().min(1).max(100).optional(),
  maxConcurrentPositions: z.number().min(1).max(10).optional(),
  isDefault: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  enabledSetupTypes: z.array(z.string()).min(1).optional(),
  maxPositionSize: z.number().min(1).max(100).nullable().optional(),
  maxConcurrentPositions: z.number().min(1).max(10).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const tradingProfilesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const profiles = await db
      .select()
      .from(tradingProfiles)
      .where(eq(tradingProfiles.userId, ctx.user.id))
      .orderBy(tradingProfiles.createdAt);

    return profiles.map((p) => ({
      ...p,
      enabledSetupTypes: JSON.parse(p.enabledSetupTypes) as string[],
      maxPositionSize: p.maxPositionSize ? parseFloat(p.maxPositionSize) : null,
    }));
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

      return {
        ...profile,
        enabledSetupTypes: JSON.parse(profile.enabledSetupTypes) as string[],
        maxPositionSize: profile.maxPositionSize ? parseFloat(profile.maxPositionSize) : null,
      };
    }),

  create: protectedProcedure.input(createProfileSchema).mutation(async ({ ctx, input }) => {
    const id = generateId();

    if (input.isDefault) {
      await db
        .update(tradingProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(tradingProfiles.userId, ctx.user.id), eq(tradingProfiles.isDefault, true)));
    }

    await db.insert(tradingProfiles).values({
      id,
      userId: ctx.user.id,
      name: input.name,
      description: input.description ?? null,
      enabledSetupTypes: JSON.stringify(input.enabledSetupTypes),
      maxPositionSize: input.maxPositionSize?.toString() ?? null,
      maxConcurrentPositions: input.maxConcurrentPositions ?? null,
      isDefault: input.isDefault ?? false,
    });

    const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, id)).limit(1);

    return {
      ...profile!,
      enabledSetupTypes: JSON.parse(profile!.enabledSetupTypes) as string[],
      maxPositionSize: profile!.maxPositionSize ? parseFloat(profile!.maxPositionSize) : null,
    };
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

    if (input.name !== undefined) updateData['name'] = input.name;
    if (input.description !== undefined) updateData['description'] = input.description;
    if (input.enabledSetupTypes !== undefined) updateData['enabledSetupTypes'] = JSON.stringify(input.enabledSetupTypes);
    if (input.maxPositionSize !== undefined) updateData['maxPositionSize'] = input.maxPositionSize?.toString() ?? null;
    if (input.maxConcurrentPositions !== undefined) updateData['maxConcurrentPositions'] = input.maxConcurrentPositions;
    if (input.isDefault !== undefined) updateData['isDefault'] = input.isDefault;

    await db.update(tradingProfiles).set(updateData).where(eq(tradingProfiles.id, input.id));

    const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, input.id)).limit(1);

    return {
      ...profile!,
      enabledSetupTypes: JSON.parse(profile!.enabledSetupTypes) as string[],
      maxPositionSize: profile!.maxPositionSize ? parseFloat(profile!.maxPositionSize) : null,
    };
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

      const id = generateId();

      await db.insert(tradingProfiles).values({
        id,
        userId: ctx.user.id,
        name: input.newName,
        description: existing.description,
        enabledSetupTypes: existing.enabledSetupTypes,
        maxPositionSize: existing.maxPositionSize,
        maxConcurrentPositions: existing.maxConcurrentPositions,
        isDefault: false,
      });

      const [profile] = await db.select().from(tradingProfiles).where(eq(tradingProfiles.id, id)).limit(1);

      return {
        ...profile!,
        enabledSetupTypes: JSON.parse(profile!.enabledSetupTypes) as string[],
        maxPositionSize: profile!.maxPositionSize ? parseFloat(profile!.maxPositionSize) : null,
      };
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
