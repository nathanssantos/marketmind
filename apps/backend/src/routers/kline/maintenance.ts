import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { pairMaintenanceLog } from '../../db/schema';
import { getKlineMaintenance } from '../../services/kline-maintenance';
import { prefetchKlines, runBatchBackfill } from '../../services/kline-prefetch';
import { logger } from '../../services/logger';
import { getOpportunityScoringService } from '../../services/opportunity-scoring';
import { protectedProcedure } from '../../trpc';
import { intervalSchema, marketTypeSchema } from './shared';
import type { MarketType } from '@marketmind/types';
import { CHART_INITIAL_KLINES } from '../../constants';

export const maintenanceProcedures = {
  backfill: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        periodsBack: z.number().min(1).default(CHART_INITIAL_KLINES),
      })
    )
    .mutation(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      const result = await prefetchKlines({
        symbol: input.symbol,
        interval: input.interval,
        targetCount: input.periodsBack,
        marketType,
      });

      return {
        success: result.success,
        downloaded: result.downloaded,
        totalInDb: result.totalInDb,
        gaps: result.gaps,
        alreadyComplete: result.alreadyComplete,
      };
    }),

  auditAndRepair: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        limit: z.number().min(1).max(500).default(100),
        autoFix: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const gapFiller = getKlineMaintenance();
      const marketType = input.marketType as MarketType;

      const result = await gapFiller.forceCheckSymbol(
        input.symbol,
        input.interval as import('@marketmind/types').Interval,
        marketType
      );

      return {
        success: true,
        gapsFilled: result.gapsFilled,
        corruptedFixed: result.corruptedFixed,
      };
    }),

  repairAll: protectedProcedure
    .mutation(async () => {
      const maintenance = getKlineMaintenance();
      return maintenance.repairAll();
    }),

  getMaintenanceStatus: protectedProcedure
    .query(async () => {
      const maintenance = getKlineMaintenance();
      return maintenance.getStatusEntries();
    }),

  getCooldowns: protectedProcedure
    .query(() => {
      return getKlineMaintenance().getCooldowns();
    }),

  setCooldowns: protectedProcedure
    .input(
      z.object({
        gapCheckMs: z.number().min(30 * 60 * 1000).max(24 * 60 * 60 * 1000),
        corruptionCheckMs: z.number().min(30 * 60 * 1000).max(24 * 60 * 60 * 1000),
      })
    )
    .mutation(({ input }) => {
      getKlineMaintenance().setCooldowns(input.gapCheckMs, input.corruptionCheckMs);
      return { success: true };
    }),

  getDbSize: protectedProcedure.query(async () => {
    const result = await db.execute(
      sql`SELECT pg_total_relation_size('klines') as bytes`
    );
    const bytes = Number((result.rows[0] as { bytes: string }).bytes);
    return { bytes };
  }),

  clearKlines: protectedProcedure.mutation(async () => {
    await db.execute(sql`TRUNCATE TABLE klines`);
    await db.delete(pairMaintenanceLog);
    return { success: true };
  }),

  backfillTopSymbols: protectedProcedure
    .input(z.object({
      walletId: z.string(),
      limit: z.number().min(1).max(500).default(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX),
      interval: intervalSchema.default('1h'),
      marketType: marketTypeSchema,
    }))
    .mutation(async ({ input }) => {
      const scoringService = getOpportunityScoringService();
      const symbols = await scoringService.getTopSymbolsByScore(input.marketType, input.limit);

      runBatchBackfill(input.walletId, symbols, input.interval, input.marketType).catch(err => {
        logger.error({ error: err }, 'Batch backfill failed');
      });

      return { symbolCount: symbols.length };
    }),
};
