import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { userLayouts, userLayoutsAudit, userLayoutsHistory } from '../db/schema';
import { protectedProcedure, router } from '../trpc';

const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex');

// v1.10 starter templates (trading / autotrading / scalping) replaced the
// old single / dual / quad presets. We accept either set so an existing
// user's persisted-but-untouched-default layout still triggers the
// overwrite guard, but new users (post-#423) match the new ids.
const DEFAULT_PRESET_IDS_V1 = ['dual', 'quad', 'single'];
const DEFAULT_PRESET_IDS_V2 = ['autotrading', 'scalping', 'trading'];

const isDefaultLayoutData = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw) as {
      symbolTabs?: Array<{ id?: string; symbol?: string }>;
      layoutPresets?: Array<{ id?: string }>;
    };
    const tabs = parsed.symbolTabs ?? [];
    const presets = parsed.layoutPresets ?? [];
    if (tabs.length !== 1) return false;
    if (tabs[0]?.id !== 'default' || tabs[0]?.symbol !== 'BTCUSDT') return false;
    if (presets.length !== 3) return false;
    const presetIds = presets.map((p) => p.id).sort();
    const matches = (expected: string[]): boolean =>
      presetIds[0] === expected[0] && presetIds[1] === expected[1] && presetIds[2] === expected[2];
    return matches(DEFAULT_PRESET_IDS_V1) || matches(DEFAULT_PRESET_IDS_V2);
  } catch {
    return false;
  }
};

export const layoutRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const layout = await ctx.db.query.userLayouts.findFirst({
      where: eq(userLayouts.userId, ctx.user.id),
    });

    if (!layout) return null;

    try {
      return JSON.parse(layout.data);
    } catch {
      return null;
    }
  }),

  save: protectedProcedure
    .input(z.object({
      data: z.string(),
      source: z.string().max(64).optional(),
      clientVersion: z.string().max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userLayouts.findFirst({
        where: eq(userLayouts.userId, ctx.user.id),
      });

      if (existing && !isDefaultLayoutData(existing.data) && isDefaultLayoutData(input.data)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Refusing to overwrite a non-default layout with the default state. This typically indicates a hydration race; reload the app and try again.',
        });
      }

      if (existing) {
        const ageMs = Date.now() - existing.updatedAt.getTime();
        if (ageMs >= SNAPSHOT_INTERVAL_MS && existing.data !== input.data) {
          await ctx.db.insert(userLayoutsHistory).values({
            userId: ctx.user.id,
            data: existing.data,
          });
          const cutoff = new Date(Date.now() - HISTORY_RETENTION_MS);
          await ctx.db
            .delete(userLayoutsHistory)
            .where(and(eq(userLayoutsHistory.userId, ctx.user.id), lt(userLayoutsHistory.snapshotAt, cutoff)));
        }
      }

      const [result] = await ctx.db
        .insert(userLayouts)
        .values({
          userId: ctx.user.id,
          data: input.data,
        })
        .onConflictDoUpdate({
          target: [userLayouts.userId],
          set: { data: input.data, updatedAt: new Date() },
        })
        .returning();

      await ctx.db.insert(userLayoutsAudit).values({
        userId: ctx.user.id,
        prevDataHash: existing ? sha256(existing.data) : null,
        newDataHash: sha256(input.data),
        source: input.source ?? 'renderer',
        clientVersion: input.clientVersion ?? null,
      });

      const auditCutoff = new Date(Date.now() - AUDIT_RETENTION_MS);
      await ctx.db
        .delete(userLayoutsAudit)
        .where(and(eq(userLayoutsAudit.userId, ctx.user.id), lt(userLayoutsAudit.ts, auditCutoff)));

      return { success: true, id: result!.id };
    }),

  listSnapshots: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: userLayoutsHistory.id,
        snapshotAt: userLayoutsHistory.snapshotAt,
      })
      .from(userLayoutsHistory)
      .where(eq(userLayoutsHistory.userId, ctx.user.id))
      .orderBy(desc(userLayoutsHistory.snapshotAt));
    return rows;
  }),

  restoreSnapshot: protectedProcedure
    .input(z.object({ snapshotId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.db.query.userLayoutsHistory.findFirst({
        where: and(
          eq(userLayoutsHistory.id, input.snapshotId),
          eq(userLayoutsHistory.userId, ctx.user.id),
        ),
      });

      if (!snapshot) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Snapshot not found' });
      }

      const existing = await ctx.db.query.userLayouts.findFirst({
        where: eq(userLayouts.userId, ctx.user.id),
      });

      if (existing) {
        await ctx.db.insert(userLayoutsHistory).values({
          userId: ctx.user.id,
          data: existing.data,
        });
      }

      await ctx.db
        .insert(userLayouts)
        .values({ userId: ctx.user.id, data: snapshot.data })
        .onConflictDoUpdate({
          target: [userLayouts.userId],
          set: { data: snapshot.data, updatedAt: new Date() },
        });

      await ctx.db.insert(userLayoutsAudit).values({
        userId: ctx.user.id,
        prevDataHash: existing ? sha256(existing.data) : null,
        newDataHash: sha256(snapshot.data),
        source: 'restore',
      });

      return { success: true };
    }),
});
