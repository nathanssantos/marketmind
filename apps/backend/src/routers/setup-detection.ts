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
import { StrategyInterpreter, StrategyLoader } from '../services/setup-detection/dynamic';
import { protectedProcedure, publicProcedure, router } from '../trpc';
import { mapDbKlinesToApi } from '../utils/kline-mapper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');

const strategyStatusSchema = z.enum(['active', 'experimental', 'deprecated', 'unprofitable']);

const detectSetupsInputSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
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
      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({
        includeStatuses: input?.includeStatuses,
        excludeStatuses: input?.excludeStatuses,
        includeUnprofitable: input?.includeUnprofitable ?? false,
      });

      return strategies.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        version: strategy.version,
        description: strategy.description,
        author: strategy.author,
        tags: strategy.tags,
        status: strategy.status ?? 'active',
        enabled: strategy.enabled ?? false,
        group: strategy.group,
        recommendedTimeframes: strategy.recommendedTimeframes,
      }));
    }),

  getStrategyDetails: publicProcedure
    .input(getStrategyDetailsInputSchema)
    .query(async ({ input }) => {
      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({ includeUnprofitable: true });
      const strategy = strategies.find((s) => s.id === input.strategyId);

      if (!strategy) {
        throw new Error(`Strategy not found: ${input.strategyId}`);
      }

      return strategy;
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

      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({ includeUnprofitable: false });

      const filteredStrategies = enabledStrategies
        ? strategies.filter((s) => enabledStrategies.includes(s.id))
        : strategies;

      const setups: TradingSetup[] = [];
      const currentIndex = mappedKlines.length - 1;

      for (const strategy of filteredStrategies) {
        const interpreter = new StrategyInterpreter({
          enabled: true,
          minConfidence,
          minRiskReward,
          strategy,
        });

        const result = interpreter.detect(mappedKlines, currentIndex);

        if (result.setup && result.confidence >= minConfidence) {
          setups.push(result.setup);
        }
      }

      setups.sort((a, b) => b.confidence - a.confidence);

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
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
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

      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({ includeUnprofitable: false });

      const filteredStrategies = enabledStrategies
        ? strategies.filter((s) => enabledStrategies.includes(s.id))
        : strategies;

      const setups: TradingSetup[] = [];

      const startIdx = mappedKlines.findIndex((k) => k.openTime >= startTime);
      const endIdx = mappedKlines.findIndex((k) => k.openTime > endTime);

      const actualStartIdx = startIdx === -1 ? 0 : startIdx;
      const actualEndIdx = endIdx === -1 ? mappedKlines.length - 1 : endIdx - 1;

      for (let i = actualStartIdx; i <= actualEndIdx; i += 1) {
        for (const strategy of filteredStrategies) {
          const interpreter = new StrategyInterpreter({
            enabled: true,
            minConfidence,
            minRiskReward: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
            strategy,
          });

          const result = interpreter.detect(mappedKlines, i);

          if (result.setup && result.confidence >= minConfidence) {
            setups.push(result.setup);
          }
        }
      }

      setups.sort((a, b) => b.confidence - a.confidence);

      return { setups };
    }),

  validateStrategy: publicProcedure
    .input(z.object({ strategyJson: z.string() }))
    .mutation(async ({ input }) => {
      const loader = new StrategyLoader([]);

      try {
        const strategy = loader.loadFromString(input.strategyJson);
        const validation = loader.validateStrategy(strategy);

        return {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          strategy: validation.valid ? strategy : null,
        };
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              path: 'json',
              message: error instanceof Error ? error.message : 'Invalid JSON',
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
      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({ includeUnprofitable: true });
      const strategy = strategies.find((s) => s.id === input.strategyId);

      if (!strategy) {
        return { education: null, strategyName: input.strategyId };
      }

      return {
        education: strategy.education ?? null,
        strategyName: strategy.name,
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

      const loader = new StrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll({ includeUnprofitable: true });
      const strategy = strategies.find((s) => s.id === execution.setupType);

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
        strategyName: strategy?.name ?? execution.setupType ?? 'Unknown Strategy',
        triggerKlineIndex: execution.triggerKlineIndex ?? 0,
        triggerOpenTime: execution.triggerKlineOpenTime ?? execution.openedAt.getTime(),
        patternCandles,
        indicatorValues,
        education: strategy?.education ?? null,
        performance,
      };
    }),
});
