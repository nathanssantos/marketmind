import type { Kline, TradingSetup } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { klines } from '../db/schema';
import { StrategyInterpreter, StrategyLoader } from '../services/setup-detection/dynamic';
import { protectedProcedure, publicProcedure, router } from '../trpc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');

const strategyStatusSchema = z.enum(['active', 'experimental', 'deprecated', 'unprofitable']);

const detectSetupsInputSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
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
        recommendedTimeframes: strategy.recommendedTimeframes,
        optimizedParams: strategy.optimizedParams,
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
      const { symbol, interval, enabledStrategies, minConfidence = 50, minRiskReward = 1.0 } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, symbol), eq(klines.interval, interval)),
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

      const mappedKlines: Kline[] = klinesData.map((k) => ({
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
        enabledStrategies: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { symbol, interval, startTime, endTime, enabledStrategies, minConfidence = 50 } = input;

      const klinesData = await ctx.db.query.klines.findMany({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
        ),
        orderBy: [desc(klines.openTime)],
        limit: 2000,
      });

      if (klinesData.length === 0) {
        return { setups: [] as TradingSetup[] };
      }

      klinesData.reverse();

      const mappedKlines: Kline[] = klinesData.map((k) => ({
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
            minRiskReward: 1.0,
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
});
