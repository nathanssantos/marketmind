import type { Interval } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { CHART_INITIAL_KLINES } from '../../constants';
import { db } from '../../db';
import { customSymbols, klines } from '../../db/schema';
import { symbolSearch } from '../../exchange/interactive-brokers/symbol-search';
import { aggregateYearlyKlines, getIntervalMilliseconds } from '../../services/binance-historical';
import { getCustomSymbolService } from '../../services/custom-symbol-service';
import { prefetchKlines } from '../../services/kline-prefetch';
import { logger } from '../../services/logger';

const isCustomSymbol = (symbol: string): boolean =>
  getCustomSymbolService()?.isCustomSymbolSync(symbol) ?? false;
import { demoOrProtectedProcedure, protectedProcedure } from '../../trpc';
import {
  assetClassSchema,
  intervalSchema,
  marketTypeSchema,
  subscribeToStream,
  symbolsCache,
  triggerCorruptionCheck,
} from './shared';

export const queryProcedures = {
  list: demoOrProtectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        limit: z.number().min(1).max(50_000).default(CHART_INITIAL_KLINES),
      })
    )
    .query(async ({ input }) => {
      const isCustom = isCustomSymbol(input.symbol);
      const marketType = isCustom ? 'SPOT' : input.marketType;

      if (input.interval === '1y') {
        await prefetchKlines({ symbol: input.symbol, interval: '1M', targetCount: input.limit * 12, marketType });
        const yearlyKlines = await aggregateYearlyKlines(input.symbol, marketType, input.limit);
        logger.trace({ symbol: input.symbol, interval: '1y', marketType, count: yearlyKlines.length }, 'Yearly klines aggregated from monthly data');
        return yearlyKlines;
      }

      await prefetchKlines({
        symbol: input.symbol,
        interval: input.interval,
        targetCount: input.limit,
        marketType,
      });

      const conditions = [
        eq(klines.symbol, input.symbol),
        eq(klines.interval, input.interval as Interval),
        eq(klines.marketType, marketType),
      ];

      if (input.startTime) {
        conditions.push(gte(klines.openTime, input.startTime));
      }

      if (input.endTime) {
        conditions.push(lte(klines.openTime, input.endTime));
      }

      const result = await db.query.klines.findMany({
        where: and(...conditions),
        orderBy: [desc(klines.openTime)],
        limit: input.limit,
      });

      result.sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

      subscribeToStream(input.symbol, input.interval, marketType);

      triggerCorruptionCheck(input.symbol, input.interval, marketType);

      return result;
    }),

  latest: demoOrProtectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = isCustomSymbol(input.symbol) ? 'SPOT' : input.marketType;

      const latest = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval),
          eq(klines.marketType, marketType)
        ),
        orderBy: [desc(klines.openTime)],
      });

      return latest;
    }),

  count: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType;

      const result = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval),
          eq(klines.marketType, marketType)
        ),
      });

      return { count: result.length };
    }),

  sync: demoOrProtectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        since: z.number(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType;
      const sinceDate = new Date(input.since);
      const now = Date.now();
      const intervalMs = getIntervalMilliseconds(input.interval);

      const result = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval),
          eq(klines.marketType, marketType),
          gte(klines.closeTime, sinceDate)
        ),
        orderBy: [desc(klines.openTime)],
        limit: input.limit,
      });

      const closedKlines = result.filter((k) => {
        const closeTime = k.closeTime.getTime();
        return now >= closeTime + 2000;
      });

      closedKlines.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());

      const latestClosed = closedKlines[closedKlines.length - 1];
      const nextExpectedOpen = latestClosed
        ? latestClosed.openTime.getTime() + intervalMs
        : input.since;

      return {
        klines: closedKlines,
        latestCloseTime: latestClosed?.closeTime.getTime() ?? input.since,
        nextExpectedOpen,
        serverTime: now,
      };
    }),

  searchSymbols: demoOrProtectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(20),
        marketType: marketTypeSchema,
        assetClass: assetClassSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType;
      const assetClass = input.assetClass;

      if (assetClass === 'STOCKS') {
        try {
          const results = await symbolSearch.searchStocks(input.query, 50);
          return results.map((r) => ({
            symbol: r.symbol,
            baseAsset: r.symbol,
            quoteAsset: r.currency,
            displayName: r.description ?? r.symbol,
            conId: r.conId,
            secType: r.secType,
            primaryExchange: r.primaryExchange,
          }));
        } catch (error) {
          logger.warn({ query: input.query, error }, 'IB symbol search failed, returning empty results');
          return [];
        }
      }

      const cacheKey = `symbols_${marketType}`;

      let symbols = symbolsCache.get(cacheKey);

      if (!symbols) {
        const baseUrl = marketType === 'FUTURES'
          ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
          : 'https://api.binance.com/api/v3/exchangeInfo';

        const response = await fetch(baseUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch exchange info: ${response.status}`);
        }

        interface ExchangeSymbolInfo {
          symbol: string;
          baseAsset: string;
          quoteAsset: string;
          status?: string;
          contractStatus?: string;
        }
        const data = (await response.json()) as { symbols: ExchangeSymbolInfo[] };
        const fetchedSymbols = data.symbols
          .filter((s) => s.status === 'TRADING' || s.contractStatus === 'TRADING')
          .map((s) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            displayName: `${s.baseAsset}/${s.quoteAsset}`,
          }));

        symbolsCache.set(cacheKey, fetchedSymbols);
        symbols = fetchedSymbols;
        logger.info({ marketType, count: fetchedSymbols.length }, 'Cached exchange symbols');
      }

      const query = input.query.toUpperCase();
      const symbolList = symbols ?? [];
      const filtered = symbolList.filter((s) =>
        s.symbol.includes(query) ||
        s.baseAsset.includes(query) ||
        s.quoteAsset.includes(query)
      );

      const customSymbolRows = await db.query.customSymbols.findMany({
        where: eq(customSymbols.isActive, true),
      });
      const customMatches = customSymbolRows
        .filter(cs => cs.symbol.includes(query) || cs.name.toUpperCase().includes(query))
        .map(cs => ({
          symbol: cs.symbol,
          baseAsset: cs.symbol,
          quoteAsset: 'INDEX',
          displayName: cs.name,
          isCustom: true,
        }));

      return [...customMatches, ...filtered.slice(0, 50)];
    }),
};
