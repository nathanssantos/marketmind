import type { TradingSetup } from '@marketmind/types';
import { randomUUID } from 'crypto';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { klines, setupDetections } from '../db/schema';
import {
    SetupDetectionService,
    createDefaultSetupDetectionConfig,
} from '../services/setup-detection/SetupDetectionService';
import { protectedProcedure, router } from '../trpc';

const setupTypeSchema = z.enum([
  'setup91',
  'setup92',
  'setup93',
  'setup94',
  'pattern123',
  'bullTrap',
  'bearTrap',
  'breakoutRetest',
]);

const setupDirectionSchema = z.enum(['LONG', 'SHORT']);

const setupDetectionConfigSchema = z.object({
  minConfidence: z.number().min(0).max(100).optional(),
  minRiskReward: z.number().min(0).optional(),
  setupCooldownPeriod: z.number().min(0).optional(),
  trendFilterEnabled: z.boolean().optional(),
  trendFilterPeriod: z.number().min(1).optional(),

  setup91: z.object({
    enabled: z.boolean(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    atrMultiplier: z.number(),
    stopLossATRMultiplier: z.number(),
    takeProfitATRMultiplier: z.number(),
  }).optional(),

  setup92: z.object({
    enabled: z.boolean(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    atrMultiplier: z.number(),
    stopLossATRMultiplier: z.number(),
    takeProfitATRMultiplier: z.number(),
  }).optional(),

  setup93: z.object({
    enabled: z.boolean(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    atrMultiplier: z.number(),
    stopLossATRMultiplier: z.number(),
    takeProfitATRMultiplier: z.number(),
  }).optional(),

  setup94: z.object({
    enabled: z.boolean(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    atrMultiplier: z.number(),
    stopLossATRMultiplier: z.number(),
    takeProfitATRMultiplier: z.number(),
  }).optional(),

  pattern123: z.object({
    enabled: z.boolean(),
    pivotLookback: z.number(),
    breakoutConfirmation: z.number(),
    minRR: z.number(),
  }).optional(),

  bullTrap: z.object({
    enabled: z.boolean(),
    lookbackPeriod: z.number(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    reversalKlines: z.number(),
    minRR: z.number(),
  }).optional(),

  bearTrap: z.object({
    enabled: z.boolean(),
    lookbackPeriod: z.number(),
    emaPeriod: z.number(),
    volumeMultiplier: z.number(),
    reversalKlines: z.number(),
    minRR: z.number(),
  }).optional(),

  breakoutRetest: z.object({
    enabled: z.boolean(),
    lookbackPeriod: z.number(),
    volumeMultiplier: z.number(),
    retestWindowMin: z.number(),
    retestWindowMax: z.number(),
    retestTolerance: z.number(),
    minRR: z.number(),
  }).optional(),

});

export const setupRouter = router({
  detectCurrent: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        config: setupDetectionConfigSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { symbol, interval } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, symbol), eq(klines.interval, interval)),
        orderBy: [desc(klines.openTime)],
        limit: 500,
      });

      if (klinesData.length === 0) {
        return {
          setups: [] as TradingSetup[],
          detectedAt: new Date(),
        };
      }

      klinesData.reverse();

      const mappedKlines = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval,
        openTime: k.openTime.getTime(),
        closeTime: k.openTime.getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume ?? '0',
        trades: k.trades ?? 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
      }));

      const service = new SetupDetectionService();
      const setups = service.detectSetups(mappedKlines);

      if (setups.length > 0) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const detections = setups.map((setup) => ({
          id: randomUUID(),
          userId: ctx.user.id,
          symbol,
          interval,
          setupType: setup.type,
          direction: setup.direction,
          entryPrice: setup.entryPrice.toString(),
          stopLoss: setup.stopLoss.toString(),
          takeProfit: setup.takeProfit.toString(),
          confidence: setup.confidence,
          riskReward: setup.riskRewardRatio.toString(),
          metadata: JSON.stringify(setup.setupData),
          expiresAt,
        }));

        await ctx.db.insert(setupDetections).values(detections);

        if (ctx.websocket) {
          setups.forEach((setup) => {
            ctx.websocket!.emitSetupDetected(ctx.user.id, {
              symbol,
              interval,
              setup: {
                id: setup.id,
                setupType: setup.type,
                direction: setup.direction,
                entryPrice: setup.entryPrice,
                stopLoss: setup.stopLoss,
                takeProfit: setup.takeProfit,
                confidence: setup.confidence,
                riskRewardRatio: setup.riskRewardRatio,
                detectedAt: new Date(),
              },
            });
          });
        }
      }

      return {
        setups,
        detectedAt: new Date(),
      };
    }),

  detectRange: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        startTime: z.date(),
        endTime: z.date(),
        config: setupDetectionConfigSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { symbol, interval, startTime, endTime } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          gte(klines.openTime, startTime),
          lte(klines.openTime, endTime),
        ),
        orderBy: [desc(klines.openTime)],
      });

      if (klinesData.length === 0) {
        return {
          setups: [] as TradingSetup[],
          processedKlines: 0,
          detectedAt: new Date(),
        };
      }

      klinesData.reverse();

      const mappedKlines = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval,
        openTime: k.openTime.getTime(),
        closeTime: k.openTime.getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume ?? '0',
        trades: k.trades ?? 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
      }));

      const service = new SetupDetectionService();
      const setups = service.detectSetupsInRange(
        mappedKlines,
        0,
        mappedKlines.length - 1,
      );

      return {
        setups,
        processedKlines: klinesData.length,
        detectedAt: new Date(),
      };
    }),

  getConfig: protectedProcedure.query(async () => {
    const defaultConfig = createDefaultSetupDetectionConfig();
    return defaultConfig;
  }),

  updateConfig: protectedProcedure
    .input(setupDetectionConfigSchema)
    .mutation(async ({ input }) => {
      return {
        success: true,
        config: input,
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        symbol: z.string().optional(),
        setupType: setupTypeSchema.optional(),
        direction: setupDirectionSchema.optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(1000).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(setupDetections.userId, ctx.user.id)];

      if (input.symbol) {
        conditions.push(eq(setupDetections.symbol, input.symbol));
      }
      if (input.setupType) {
        conditions.push(eq(setupDetections.setupType, input.setupType));
      }
      if (input.direction) {
        conditions.push(eq(setupDetections.direction, input.direction));
      }
      if (input.startDate) {
        conditions.push(gte(setupDetections.detectedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(setupDetections.detectedAt, input.endDate));
      }

      const results = await ctx.db.query.setupDetections.findMany({
        where: and(...conditions),
        orderBy: [desc(setupDetections.detectedAt)],
        limit: input.limit,
      });

      return {
        setups: results.map((r) => ({
          id: r.id,
          type: r.setupType,
          symbol: r.symbol,
          interval: r.interval,
          direction: r.direction,
          entryPrice: parseFloat(r.entryPrice),
          stopLoss: parseFloat(r.stopLoss),
          takeProfit: parseFloat(r.takeProfit),
          confidence: r.confidence,
          riskRewardRatio: r.riskReward ? parseFloat(r.riskReward) : 0,
          detectedAt: r.detectedAt,
          viewed: r.viewed ?? false,
        })),
        total: results.length,
      };
    }),

  getStats: protectedProcedure
    .input(
      z.object({
        symbol: z.string().optional(),
        setupType: setupTypeSchema.optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(setupDetections.userId, ctx.user.id)];

      if (input.symbol) {
        conditions.push(eq(setupDetections.symbol, input.symbol));
      }
      if (input.setupType) {
        conditions.push(eq(setupDetections.setupType, input.setupType));
      }
      if (input.startDate) {
        conditions.push(gte(setupDetections.detectedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(setupDetections.detectedAt, input.endDate));
      }

      const results = await ctx.db.query.setupDetections.findMany({
        where: and(...conditions),
      });

      const byType: Record<string, number> = {};
      const byDirection = { LONG: 0, SHORT: 0 };
      let totalConfidence = 0;
      let totalRiskReward = 0;

      for (const result of results) {
        byType[result.setupType] = (byType[result.setupType] || 0) + 1;
        byDirection[result.direction] += 1;
        totalConfidence += result.confidence;
        if (result.riskReward) {
          totalRiskReward += parseFloat(result.riskReward);
        }
      }

      return {
        totalSetups: results.length,
        byType,
        byDirection,
        avgConfidence: results.length > 0 ? totalConfidence / results.length : 0,
        avgRiskReward: results.length > 0 ? totalRiskReward / results.length : 0,
      };
    }),
});
