import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { marketContextConfig } from '../db/schema';
import { marketContextFilter } from '../services/market-context-filter';
import { protectedProcedure, router } from '../trpc';

const marketContextActionSchema = z.enum(['reduce_size', 'block', 'penalize', 'warn_only']);

const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  shadowMode: z.boolean().optional(),
  fearGreed: z.object({
    enabled: z.boolean().optional(),
    thresholdLow: z.number().min(0).max(100).optional(),
    thresholdHigh: z.number().min(0).max(100).optional(),
    action: marketContextActionSchema.optional(),
    sizeReduction: z.number().min(0).max(100).optional(),
  }).optional(),
  fundingRate: z.object({
    enabled: z.boolean().optional(),
    threshold: z.number().min(0).optional(),
    action: marketContextActionSchema.optional(),
    penalty: z.number().min(0).max(100).optional(),
  }).optional(),
  btcDominance: z.object({
    enabled: z.boolean().optional(),
    changeThreshold: z.number().min(0).optional(),
    action: marketContextActionSchema.optional(),
    sizeReduction: z.number().min(0).max(100).optional(),
  }).optional(),
  openInterest: z.object({
    enabled: z.boolean().optional(),
    changeThreshold: z.number().min(0).optional(),
    action: marketContextActionSchema.optional(),
  }).optional(),
});

export const marketContextRouter = router({
  getConfig: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input }) => {
      const config = await marketContextFilter.getConfig(input.walletId);
      return config;
    }),

  updateConfig: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      config: updateConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.userId;
      const { walletId, config: updates } = input;

      const [existing] = await db
        .select()
        .from(marketContextConfig)
        .where(and(
          eq(marketContextConfig.walletId, walletId),
          eq(marketContextConfig.userId, userId)
        ))
        .limit(1);

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.shadowMode !== undefined) updateData.shadowMode = updates.shadowMode;

      if (updates.fearGreed) {
        if (updates.fearGreed.enabled !== undefined) updateData.fearGreedEnabled = updates.fearGreed.enabled;
        if (updates.fearGreed.thresholdLow !== undefined) updateData.fearGreedThresholdLow = updates.fearGreed.thresholdLow;
        if (updates.fearGreed.thresholdHigh !== undefined) updateData.fearGreedThresholdHigh = updates.fearGreed.thresholdHigh;
        if (updates.fearGreed.action !== undefined) updateData.fearGreedAction = updates.fearGreed.action;
        if (updates.fearGreed.sizeReduction !== undefined) updateData.fearGreedSizeReduction = updates.fearGreed.sizeReduction;
      }

      if (updates.fundingRate) {
        if (updates.fundingRate.enabled !== undefined) updateData.fundingRateEnabled = updates.fundingRate.enabled;
        if (updates.fundingRate.threshold !== undefined) updateData.fundingRateThreshold = updates.fundingRate.threshold.toString();
        if (updates.fundingRate.action !== undefined) updateData.fundingRateAction = updates.fundingRate.action;
        if (updates.fundingRate.penalty !== undefined) updateData.fundingRatePenalty = updates.fundingRate.penalty;
      }

      if (updates.btcDominance) {
        if (updates.btcDominance.enabled !== undefined) updateData.btcDominanceEnabled = updates.btcDominance.enabled;
        if (updates.btcDominance.changeThreshold !== undefined) updateData.btcDominanceChangeThreshold = updates.btcDominance.changeThreshold.toString();
        if (updates.btcDominance.action !== undefined) updateData.btcDominanceAction = updates.btcDominance.action;
        if (updates.btcDominance.sizeReduction !== undefined) updateData.btcDominanceSizeReduction = updates.btcDominance.sizeReduction;
      }

      if (updates.openInterest) {
        if (updates.openInterest.enabled !== undefined) updateData.openInterestEnabled = updates.openInterest.enabled;
        if (updates.openInterest.changeThreshold !== undefined) updateData.openInterestChangeThreshold = updates.openInterest.changeThreshold.toString();
        if (updates.openInterest.action !== undefined) updateData.openInterestAction = updates.openInterest.action;
      }

      if (existing) {
        await db
          .update(marketContextConfig)
          .set(updateData)
          .where(eq(marketContextConfig.id, existing.id));
      } else {
        const id = randomBytes(16).toString('hex');
        await db.insert(marketContextConfig).values({
          id,
          userId,
          walletId,
          ...updateData,
        });
      }

      marketContextFilter.invalidateCache(walletId);

      return marketContextFilter.getConfig(walletId);
    }),

  getMarketData: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      return marketContextFilter.fetchMarketData(input.symbol);
    }),

  testFilter: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      symbol: z.string(),
      direction: z.enum(['LONG', 'SHORT']),
    }))
    .query(async ({ input }) => {
      const mockSetup = {
        type: 'test-setup',
        direction: input.direction,
        confidence: 70,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        riskReward: 2,
      } as any;

      const marketData = await marketContextFilter.fetchMarketData(input.symbol);
      const result = await marketContextFilter.validateSetup(mockSetup, input.symbol, input.walletId);

      return {
        marketData,
        filterResult: result,
      };
    }),
});
