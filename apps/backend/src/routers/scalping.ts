import { z } from 'zod';
import { eq, and, asc, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc';
import { db } from '../db';
import { scalpingConfig, aggTrades as aggTradesTable, wallets } from '../db/schema';
import { getScalpingScheduler } from '../services/scalping/scalping-scheduler';

const verifyWalletOwnership = async (walletId: string, userId: string): Promise<void> => {
  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.id, walletId), eq(wallets.userId, userId)),
  });
  if (!wallet) throw new TRPCError({ code: 'NOT_FOUND', message: 'Wallet not found' });
};

const scalpingConfigSchema = z.object({
  walletId: z.string(),
  isEnabled: z.boolean().optional(),
  symbols: z.array(z.string()).optional(),
  enabledStrategies: z.array(z.string()).optional(),
  executionMode: z.enum(['POST_ONLY', 'IOC', 'MARKET']).optional(),
  positionSizePercent: z.number().min(0.1).max(100).optional(),
  maxConcurrentPositions: z.number().int().min(1).max(10).optional(),
  maxDailyTrades: z.number().int().min(1).max(500).optional(),
  maxDailyLossPercent: z.number().min(0.1).max(100).optional(),
  leverage: z.number().int().min(1).max(125).optional(),
  marginType: z.enum(['CROSSED', 'ISOLATED']).optional(),
  imbalanceThreshold: z.number().min(0).max(1).optional(),
  cvdDivergenceBars: z.number().int().min(3).max(100).optional(),
  vwapDeviationSigma: z.number().min(0.5).max(5).optional(),
  largeTradeMult: z.number().min(1).max(50).optional(),
  absorptionThreshold: z.number().min(1).max(20).optional(),
  maxSpreadPercent: z.number().min(0).max(1).optional(),
  microTrailingTicks: z.number().int().min(1).max(50).optional(),
  ticksPerBar: z.number().int().min(1).max(10000).optional(),
  volumePerBar: z.number().min(1).optional(),
  depthLevels: z.number().int().min(5).max(100).optional(),
  circuitBreakerEnabled: z.boolean().optional(),
  circuitBreakerLossPercent: z.number().min(0.1).max(100).optional(),
  circuitBreakerMaxTrades: z.number().int().min(1).max(1000).optional(),
  signalInterval: z.enum(['1m', '3m', '5m', '15m']).optional(),
  directionMode: z.enum(['auto', 'long_only', 'short_only']).optional(),
});

export const scalpingRouter = router({
  getConfig: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await db.query.scalpingConfig.findFirst({
        where: and(
          eq(scalpingConfig.walletId, input.walletId),
          eq(scalpingConfig.userId, ctx.user.id),
        ),
      });

      if (!config) return null;

      return {
        ...config,
        symbols: JSON.parse(config.symbols) as string[],
        enabledStrategies: JSON.parse(config.enabledStrategies) as string[],
      };
    }),

  upsertConfig: protectedProcedure
    .input(scalpingConfigSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);

      const existing = await db.query.scalpingConfig.findFirst({
        where: and(
          eq(scalpingConfig.walletId, input.walletId),
          eq(scalpingConfig.userId, ctx.user.id),
        ),
      });

      const data = {
        ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
        ...(input.symbols && { symbols: JSON.stringify(input.symbols) }),
        ...(input.enabledStrategies && { enabledStrategies: JSON.stringify(input.enabledStrategies) }),
        ...(input.executionMode && { executionMode: input.executionMode as 'POST_ONLY' | 'IOC' | 'MARKET' }),
        ...(input.positionSizePercent !== undefined && { positionSizePercent: String(input.positionSizePercent) }),
        ...(input.maxConcurrentPositions !== undefined && { maxConcurrentPositions: input.maxConcurrentPositions }),
        ...(input.maxDailyTrades !== undefined && { maxDailyTrades: input.maxDailyTrades }),
        ...(input.maxDailyLossPercent !== undefined && { maxDailyLossPercent: String(input.maxDailyLossPercent) }),
        ...(input.leverage !== undefined && { leverage: input.leverage }),
        ...(input.marginType && { marginType: input.marginType as 'CROSSED' | 'ISOLATED' }),
        ...(input.imbalanceThreshold !== undefined && { imbalanceThreshold: String(input.imbalanceThreshold) }),
        ...(input.cvdDivergenceBars !== undefined && { cvdDivergenceBars: input.cvdDivergenceBars }),
        ...(input.vwapDeviationSigma !== undefined && { vwapDeviationSigma: String(input.vwapDeviationSigma) }),
        ...(input.largeTradeMult !== undefined && { largeTradeMult: String(input.largeTradeMult) }),
        ...(input.absorptionThreshold !== undefined && { absorptionThreshold: String(input.absorptionThreshold) }),
        ...(input.maxSpreadPercent !== undefined && { maxSpreadPercent: String(input.maxSpreadPercent) }),
        ...(input.microTrailingTicks !== undefined && { microTrailingTicks: input.microTrailingTicks }),
        ...(input.ticksPerBar !== undefined && { ticksPerBar: input.ticksPerBar }),
        ...(input.volumePerBar !== undefined && { volumePerBar: String(input.volumePerBar) }),
        ...(input.depthLevels !== undefined && { depthLevels: input.depthLevels }),
        ...(input.circuitBreakerEnabled !== undefined && { circuitBreakerEnabled: input.circuitBreakerEnabled }),
        ...(input.circuitBreakerLossPercent !== undefined && { circuitBreakerLossPercent: String(input.circuitBreakerLossPercent) }),
        ...(input.circuitBreakerMaxTrades !== undefined && { circuitBreakerMaxTrades: input.circuitBreakerMaxTrades }),
        ...(input.signalInterval && { signalInterval: input.signalInterval }),
        ...(input.directionMode && { directionMode: input.directionMode }),
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db.update(scalpingConfig)
          .set(data)
          .where(eq(scalpingConfig.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db.insert(scalpingConfig)
        .values({
          id: randomUUID(),
          userId: ctx.user.id,
          walletId: input.walletId,
          ...data,
        })
        .returning();
      return created;
    }),

  start: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      await scheduler.startScalping(input.walletId);
      return { success: true };
    }),

  stop: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      await scheduler.stopScalping(input.walletId);
      return { success: true };
    }),

  getStatus: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      return scheduler.getStatus(input.walletId);
    }),

  getMetrics: protectedProcedure
    .input(z.object({ walletId: z.string(), symbol: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      return scheduler.getMetrics(input.walletId, input.symbol);
    }),

  getVolumeProfile: protectedProcedure
    .input(z.object({ walletId: z.string(), symbol: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      return scheduler.getVolumeProfile(input.walletId, input.symbol);
    }),

  getAggTradeHistory: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      from: z.number(),
      to: z.number(),
      limit: z.number().int().min(1).max(10000).default(5000),
    }))
    .query(async ({ input }) => {
      const trades = await db.select()
        .from(aggTradesTable)
        .where(and(
          eq(aggTradesTable.symbol, input.symbol),
          gte(aggTradesTable.timestamp, new Date(input.from)),
          lte(aggTradesTable.timestamp, new Date(input.to)),
        ))
        .orderBy(asc(aggTradesTable.timestamp))
        .limit(input.limit);

      return trades.map((t) => ({
        tradeId: t.tradeId,
        symbol: t.symbol,
        price: parseFloat(t.price),
        quantity: parseFloat(t.quantity),
        quoteQuantity: parseFloat(t.quoteQuantity),
        isBuyerMaker: t.isBuyerMaker,
        timestamp: t.timestamp.getTime(),
        marketType: t.marketType ?? 'FUTURES',
      }));
    }),

  resetCircuitBreaker: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWalletOwnership(input.walletId, ctx.user.id);
      const scheduler = getScalpingScheduler();
      scheduler.resetCircuitBreaker(input.walletId);
      return { success: true };
    }),
});
