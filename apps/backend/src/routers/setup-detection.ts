import type {
  StrategyEducation,
  StrategyPerformanceStats,
  StrategyVisualizationData,
  TradingSetup,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { klines, strategyPerformance, tradeExecutions } from '../db/schema';
import { detectSetups as detectSetupsUnified } from '../services/indicator-engine';
import { PineStrategyLoader } from '../services/pine/PineStrategyLoader';
import { protectedProcedure, publicProcedure, router } from '../trpc';
import { mapDbKlinesToApi } from '../utils/kline-mapper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');
const sharedStrategyLoader = new PineStrategyLoader([STRATEGIES_DIR]);

const strategyStatusSchema = z.enum(['active', 'experimental', 'deprecated', 'unprofitable']);

const detectSetupsInputSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  marketType: z.enum(['SPOT', 'FUTURES']),
  enabledStrategies: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  minRiskReward: z.number().min(0).optional(),
});

const getStrategyDetailsInputSchema = z.object({
  strategyId: z.string(),
});

const listStrategiesInputSchema = z.object({
  includeStatuses: z.array(strategyStatusSchema).optional(),
  excludeStatuses: z.array(strategyStatusSchema).optional(),
  includeUnprofitable: z.boolean().optional(),
});

export const setupDetectionRouter = router({
  listStrategies: publicProcedure
    .input(listStrategiesInputSchema.optional())
    .query(async ({ input }) => {
      const strategies = await sharedStrategyLoader.loadAllCached();

      let filtered = strategies;
      type StrategyStatus = z.infer<typeof strategyStatusSchema>;
      if (input?.includeStatuses?.length) {
        filtered = filtered.filter((s) => input.includeStatuses!.includes(s.metadata.status as StrategyStatus));
      }
      if (input?.excludeStatuses?.length) {
        filtered = filtered.filter((s) => !input.excludeStatuses!.includes(s.metadata.status as StrategyStatus));
      }

      return filtered.map((strategy) => ({
        id: strategy.metadata.id,
        name: strategy.metadata.name,
        version: strategy.metadata.version,
        description: strategy.metadata.description,
        author: strategy.metadata.author,
        tags: strategy.metadata.tags,
        status: strategy.metadata.status,
        enabled: strategy.metadata.enabled,
        recommendedTimeframes: strategy.metadata.recommendedTimeframes,
        // Surface multi-TF dependencies so the UI can render a "HTF: 4h"
        // badge and the user knows extra kline data will load on each
        // backtest tick.
        requiresTimeframes: strategy.metadata.requiresTimeframes ?? [],
        // Tunable parameters for the strategyParams override editor in
        // BacktestDialog. Each entry mirrors the `input.int/float(...)`
        // signature from the .pine source.
        parameters: Object.entries(strategy.metadata.parameters ?? {}).map(([key, def]) => ({
          key,
          default: def.default,
          min: def.min,
          max: def.max,
          step: def.step,
          description: def.description,
        })),
      }));
    }),

  getStrategyDetails: publicProcedure
    .input(getStrategyDetailsInputSchema)
    .query(async ({ input }) => {
      const strategies = await sharedStrategyLoader.loadAllCached();
      const strategy = strategies.find((s) => s.metadata.id === input.strategyId);

      if (!strategy) {
        throw new Error(`Strategy not found: ${input.strategyId}`);
      }

      return strategy.metadata;
    }),

  detectSetups: protectedProcedure
    .input(detectSetupsInputSchema)
    .query(async ({ ctx, input }) => {
      const { symbol, interval, marketType, enabledStrategies, minConfidence = 50, minRiskReward = 1.0 } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, symbol), eq(klines.interval, interval), eq(klines.marketType, marketType)),
        orderBy: [desc(klines.openTime)],
        limit: 500,
      });

      if (klinesData.length === 0) {
        return {
          setups: [] as TradingSetup[],
          detectedAt: new Date(),
          strategiesUsed: 0,
        };
      }

      klinesData.reverse();

      const mappedKlines = mapDbKlinesToApi(klinesData);

      const strategies = await sharedStrategyLoader.loadAllCached();

      const filteredStrategies = enabledStrategies
        ? strategies.filter((s) => enabledStrategies.includes(s.metadata.id))
        : strategies;

      const results = await detectSetupsUnified({
        klines: mappedKlines,
        strategies: filteredStrategies,
        config: { minConfidence, minRiskReward },
      });

      const setups = results
        .filter((r) => r.setup && r.confidence >= minConfidence)
        .map((r) => r.setup!)
        .sort((a, b) => b.confidence - a.confidence);

      return {
        setups,
        detectedAt: new Date(),
        strategiesUsed: filteredStrategies.length,
      };
    }),

  detectSetupsInRange: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        marketType: z.enum(['SPOT', 'FUTURES']),
        enabledStrategies: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { symbol, interval, startTime, endTime, marketType, enabledStrategies, minConfidence = 50 } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType),
        ),
        orderBy: [desc(klines.openTime)],
        limit: 2000,
      });

      if (klinesData.length === 0) {
        return { setups: [] as TradingSetup[] };
      }

      klinesData.reverse();

      const mappedKlines = mapDbKlinesToApi(klinesData);

      const strategies = await sharedStrategyLoader.loadAllCached();

      const filteredStrategies = enabledStrategies
        ? strategies.filter((s) => enabledStrategies.includes(s.metadata.id))
        : strategies;

      const startIdx = mappedKlines.findIndex((k) => k.openTime >= startTime);
      const endIdx = mappedKlines.findIndex((k) => k.openTime > endTime);

      const actualStartIdx = startIdx === -1 ? 0 : startIdx;
      const actualEndIdx = endIdx === -1 ? mappedKlines.length - 1 : endIdx - 1;

      const { SetupDetectionService } = await import('../services/setup-detection/SetupDetectionService');
      const service = new SetupDetectionService({ minConfidence, minRiskReward: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO });
      for (const s of filteredStrategies) service.loadPineStrategy(s);

      const setups = await service.detectSetupsInRange(mappedKlines, actualStartIdx, actualEndIdx);

      return { setups };
    }),

  validateStrategy: publicProcedure
    .input(z.object({ strategySource: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const loader = new PineStrategyLoader([]);
        const strategy = loader.loadFromString(input.strategySource);

        if (!input.strategySource.includes('//@version=5') && !input.strategySource.includes("//@version=5")) {
          return {
            valid: false,
            errors: [{ path: 'source', message: 'Missing //@version=5 declaration', severity: 'error' as const }],
            warnings: [],
            strategy: null,
          };
        }

        if (!input.strategySource.includes("indicator(") && !input.strategySource.includes("indicator (")) {
          return {
            valid: false,
            errors: [{ path: 'source', message: 'Missing indicator() declaration', severity: 'error' as const }],
            warnings: [],
            strategy: null,
          };
        }

        return {
          valid: true,
          errors: [],
          warnings: [],
          strategy: strategy.metadata,
        };
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              path: 'source',
              message: error instanceof Error ? error.message : 'Invalid Pine source',
              severity: 'error' as const,
            },
          ],
          warnings: [],
          strategy: null,
        };
      }
    }),

  getStrategyEducation: publicProcedure
    .input(z.object({ strategyId: z.string() }))
    .query(async ({ input }): Promise<{ education: StrategyEducation | null; strategyName: string }> => {
      const strategies = await sharedStrategyLoader.loadAllCached();
      const strategy = strategies.find((s) => s.metadata.id === input.strategyId);

      if (!strategy) {
        return { education: null, strategyName: input.strategyId };
      }

      return {
        education: (strategy.metadata.education as unknown as StrategyEducation) ?? null,
        strategyName: strategy.metadata.name,
      };
    }),

  getTradeVisualizationData: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      symbol: z.string().optional(),
      interval: z.string().optional(),
    }))
    .query(async ({ ctx, input }): Promise<StrategyVisualizationData | null> => {
      const execution = await ctx.db.query.tradeExecutions.findFirst({
        where: and(
          eq(tradeExecutions.id, input.executionId),
          eq(tradeExecutions.userId, ctx.user.id),
        ),
      });

      if (!execution) return null;

      const strategies = await sharedStrategyLoader.loadAllCached();
      const strategy = strategies.find((s) => s.metadata.id === execution.setupType);

      let patternCandles: TriggerCandleSnapshot[] = [];
      let indicatorValues: TriggerIndicatorValues = {};

      if (execution.triggerCandleData) {
        try {
          patternCandles = JSON.parse(execution.triggerCandleData) as TriggerCandleSnapshot[];
        } catch {
          patternCandles = [];
        }
      }

      if (execution.triggerIndicatorValues) {
        try {
          indicatorValues = JSON.parse(execution.triggerIndicatorValues) as TriggerIndicatorValues;
        } catch {
          indicatorValues = {};
        }
      }

      let performance: StrategyPerformanceStats | null = null;
      if (execution.setupType && (input.symbol || execution.symbol)) {
        const perfRecord = await ctx.db.query.strategyPerformance.findFirst({
          where: and(
            eq(strategyPerformance.strategyId, execution.setupType),
            eq(strategyPerformance.symbol, input.symbol ?? execution.symbol),
          ),
        });

        if (perfRecord) {
          performance = {
            totalTrades: perfRecord.totalTrades,
            winRate: parseFloat(perfRecord.winRate),
            avgWinPercent: parseFloat(perfRecord.avgWin),
            avgLossPercent: parseFloat(perfRecord.avgLoss),
            avgRiskReward: parseFloat(perfRecord.avgRr),
            maxDrawdown: parseFloat(perfRecord.maxDrawdown),
            lastTradeAt: perfRecord.lastTradeAt?.toISOString(),
          };
        }
      }

      return {
        strategyId: execution.setupType ?? 'unknown',
        strategyName: strategy?.metadata.name ?? execution.setupType ?? 'Unknown Strategy',
        triggerKlineIndex: execution.triggerKlineIndex ?? 0,
        triggerOpenTime: execution.triggerKlineOpenTime ?? execution.openedAt.getTime(),
        patternCandles,
        indicatorValues,
        education: (strategy?.metadata.education as unknown as StrategyEducation) ?? null,
        performance,
      };
    }),
});
