import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../trpc';
import { mlService } from '../services/ml';
import type { Kline, TradingSetup } from '@marketmind/types';
import type { MarketContext } from '@marketmind/ml';

const klineSchema = z.object({
  openTime: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  closeTime: z.number(),
  quoteAssetVolume: z.string(),
  numberOfTrades: z.number(),
  takerBuyBaseAssetVolume: z.string(),
  takerBuyQuoteAssetVolume: z.string(),
});

const setupSchema = z.object({
  id: z.string(),
  type: z.string(),
  symbol: z.string().optional(),
  interval: z.string().optional(),
  direction: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  confidence: z.number(),
  riskRewardRatio: z.number(),
  volumeConfirmation: z.boolean(),
  indicatorConfluence: z.number(),
  openTime: z.number(),
  klineIndex: z.number(),
});

const marketContextSchema = z
  .object({
    fundingRate: z.number().optional(),
    openInterest: z.number().optional(),
    openInterestChange1h: z.number().optional(),
    openInterestChange24h: z.number().optional(),
    takerBuyRatio: z.number().optional(),
    fearGreedIndex: z.number().optional(),
    btcDominance: z.number().optional(),
    btcDominanceChange24h: z.number().optional(),
    btcDominanceChange7d: z.number().optional(),
    longLiquidations24h: z.number().optional(),
    shortLiquidations24h: z.number().optional(),
  })
  .optional();

export const mlRouter = router({
  initialize: protectedProcedure
    .input(
      z
        .object({
          modelType: z.enum(['setup-classifier', 'confidence-enhancer']).optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const result = await mlService.initialize(input?.modelType);
      return result;
    }),

  predictSetup: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        klines: z.array(klineSchema),
        setup: setupSchema,
        marketContext: marketContextSchema,
      })
    )
    .mutation(async ({ input }) => {
      const klines = input.klines as unknown as Kline[];
      const setup = input.setup as unknown as TradingSetup;
      const marketContext = input.marketContext as MarketContext | undefined;

      const prediction = await mlService.predictSetup(
        klines,
        setup,
        marketContext,
        input.symbol,
        input.interval
      );

      return {
        setupId: prediction.setupId,
        prediction: {
          probability: prediction.probability,
          confidence: prediction.confidence,
          label: prediction.label,
          latencyMs: prediction.latencyMs,
        },
      };
    }),

  enhanceConfidence: protectedProcedure
    .input(
      z.object({
        klines: z.array(klineSchema),
        setups: z.array(setupSchema),
        blendWeight: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const klines = input.klines as unknown as Kline[];
      const setups = input.setups as unknown as TradingSetup[];
      const blendWeight = input.blendWeight;

      const enhanced = await mlService.enhanceSetups(klines, setups, undefined, blendWeight);

      return enhanced.map((setup) => ({
        id: setup.id,
        type: setup.type,
        direction: setup.direction,
        originalConfidence: setup.originalConfidence,
        mlConfidence: setup.mlConfidence,
        confidence: setup.confidence,
        blendedConfidence: setup.blendedConfidence,
        mlPrediction: setup.mlPrediction
          ? {
              probability: setup.mlPrediction.probability,
              confidence: setup.mlPrediction.confidence,
              label: setup.mlPrediction.label,
              latencyMs: setup.mlPrediction.latencyMs,
            }
          : undefined,
      }));
    }),

  filterSetups: protectedProcedure
    .input(
      z.object({
        klines: z.array(klineSchema),
        setups: z.array(setupSchema),
        minProbability: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const klines = input.klines as unknown as Kline[];
      const setups = input.setups as unknown as TradingSetup[];
      const minProbability = input.minProbability ?? 0.5;

      const filtered = await mlService.filterByMLConfidence(klines, setups, minProbability);

      return {
        original: setups.length,
        filtered: filtered.length,
        setups: filtered.map((s) => ({
          id: s.id,
          type: s.type,
          direction: s.direction,
          confidence: s.confidence,
        })),
      };
    }),

  rankSetups: protectedProcedure
    .input(
      z.object({
        klines: z.array(klineSchema),
        setups: z.array(setupSchema),
      })
    )
    .mutation(async ({ input }) => {
      const klines = input.klines as unknown as Kline[];
      const setups = input.setups as unknown as TradingSetup[];

      const ranked = await mlService.rankSetups(klines, setups);

      return ranked.map((r, index) => ({
        rank: index + 1,
        setupId: r.setup.id,
        setupType: r.setup.type,
        direction: r.setup.direction,
        probability: r.prediction.probability,
        confidence: r.prediction.confidence,
        label: r.prediction.label,
      }));
    }),

  getModelInfo: publicProcedure.query(async () => {
    return mlService.getModelInfo();
  }),

  listModels: protectedProcedure.query(async () => {
    return mlService.listModels();
  }),

  switchModel: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .mutation(async ({ input }) => {
      return mlService.switchModel(input.modelId);
    }),

  recordOutcome: protectedProcedure
    .input(
      z.object({
        predictionId: z.string(),
        actualLabel: z.number().int().min(0).max(1),
      })
    )
    .mutation(async ({ input }) => {
      await mlService.recordOutcome(input.predictionId, input.actualLabel);
      return { success: true };
    }),

  getFeatureInfo: protectedProcedure.query(() => {
    return {
      featureNames: mlService.getFeatureNames(),
      featureCount: mlService.getFeatureCount(),
    };
  }),

  getStatus: publicProcedure.query(() => {
    return {
      isReady: mlService.isReady(),
      cacheSize: mlService.getCacheSize(),
    };
  }),

  clearCache: protectedProcedure.mutation(() => {
    mlService.clearCache();
    return { success: true };
  }),

  dispose: protectedProcedure.mutation(async () => {
    await mlService.dispose();
    return { success: true };
  }),
});
