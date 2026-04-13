import { calculateCapitalLimits } from '@marketmind/risk';
import { AUTO_TRADING_CONFIG, CAPITAL_RULES, TRADING_DEFAULTS } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { autoTradingConfig, klines } from '../../db/schema';
import { getTopSymbolsByVolume } from '../../services/binance-exchange-info';
import { walletQueries } from '../../services/database/walletQueries';
import { checkKlineAvailability } from '../../services/kline-prefetch';
import { logger } from '../../services/logger';
import { getMarketCapDataService } from '../../services/market-cap-data';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { getOpportunityScoringService } from '../../services/opportunity-scoring';
import { protectedProcedure, router } from '../../trpc';
import { getEma21Direction, type Ema21TrendResult } from '../../utils/filters/btc-correlation-filter';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { log, logApiTable } from './utils';

export const symbolSelectionRouter = router({
  getTopSymbols: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(50).default(12),
      })
    )
    .query(async ({ input }) => {
      log('> getTopSymbols called', { marketType: input.marketType, limit: input.limit });
      const symbols = await getTopSymbolsByVolume(input.marketType, input.limit);
      log('✓ Top symbols fetched', { count: symbols.length });
      return symbols;
    }),

  getTopCoinsByMarketCap: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX).default(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX),
      })
    )
    .query(async ({ input }) => {
      log('> getTopCoinsByMarketCap called', { marketType: input.marketType, limit: input.limit });
      const marketCapService = getMarketCapDataService();
      const coins = await marketCapService.getTopCoinsByMarketCap(input.limit, input.marketType);
      log('✓ Top coins fetched', { count: coins.length });
      return coins;
    }),

  getDynamicSymbolScores: protectedProcedure
    .input(
      z.object({
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX * AUTO_TRADING_CONFIG.SYMBOL_FETCH_MULTIPLIER).default(AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT),
      })
    )
    .query(async ({ input }) => {
      const scoringService = getOpportunityScoringService();
      const scores = await scoringService.getSymbolScores(input.marketType, input.limit);
      logApiTable('getDynamicSymbolScores', [
        ['Market Type', input.marketType],
        ['Limit', input.limit],
        ['Scores Fetched', `✓ ${scores.length}`],
      ]);
      return scores;
    }),

  getFilteredSymbolsForQuickStart: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        interval: z.string().default('30m'),
        limit: z.number().min(1).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX).default(10),
        useBtcCorrelationFilter: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const [config] = await ctx.db
        .select()
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        )
        .limit(1);

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const positionSizePercent = parseFloat(config?.positionSizePercent ?? String(TRADING_DEFAULTS.POSITION_SIZE_PERCENT));

      const scoringService = getOpportunityScoringService();
      const minNotionalFilter = getMinNotionalFilterService();

      const fetchMultiplier = 10;
      const scores = await scoringService.getSymbolScores(input.marketType, Math.min(input.limit * fetchMultiplier, 200));

      let allSymbols: string[];
      if (scores.length > 0) {
        allSymbols = scores.map(s => s.symbol);
      } else {
        allSymbols = await getTopSymbolsByVolume(input.marketType, Math.min(input.limit * fetchMultiplier, 200));
        logger.info({ count: allSymbols.length }, '[getFilteredSymbolsForQuickStart] Using top symbols by volume as fallback');
      }

      const { maxWatchers, capitalPerWatcher, eligibleSymbols: capitalEligible, excludedSymbols } =
        await minNotionalFilter.calculateMaxWatchersFromSymbols(
          allSymbols,
          walletBalance,
          leverage,
          positionSizePercent,
          input.marketType
        );

      const filteredSymbolSet = new Set(capitalEligible);
      const filteredScores = scores.length > 0
        ? scores.filter(s => filteredSymbolSet.has(s.symbol))
        : allSymbols.filter(s => filteredSymbolSet.has(s)).map(symbol => ({ symbol, score: 0 }));

      let btcTrendInfo: Ema21TrendResult | null = null;

      if (input.useBtcCorrelationFilter) {
        const btcDbKlines = await ctx.db.query.klines.findMany({
          where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, input.interval)),
          orderBy: [desc(klines.openTime)],
          limit: 100,
        });

        if (btcDbKlines.length >= 30) {
          const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
          btcTrendInfo = await getEma21Direction(btcKlinesData);
          log('> BTC Correlation Filter - Trend', {
            direction: btcTrendInfo.direction,
            price: btcTrendInfo.price?.toFixed(2),
            ema21: btcTrendInfo.ema21?.toFixed(2),
          });
        } else {
          logger.warn({ count: btcDbKlines.length }, '[getFilteredSymbolsForQuickStart] Insufficient BTC klines for trend analysis');
        }
      }

      const eligibleSymbols: string[] = [];
      const skippedInsufficientKlines: string[] = [];
      const skippedInsufficientCapital = Array.from(excludedSymbols.keys());
      const skippedTrend: { symbol: string; reason: string }[] = [];

      for (const score of filteredScores) {
        const klineCheck = await checkKlineAvailability(
          score.symbol,
          input.interval,
          input.marketType,
          true
        );

        if (!klineCheck.hasSufficient) {
          skippedInsufficientKlines.push(score.symbol);
          continue;
        }

        eligibleSymbols.push(score.symbol);

        if (eligibleSymbols.length >= input.limit * 2) break;
      }

      const btcTrendEmoji = btcTrendInfo?.direction === 'BULLISH' ? '✓' : btcTrendInfo?.direction === 'BEARISH' ? '✗' : '·';

      logApiTable('getFilteredSymbolsForQuickStart', [
        ['Market Type', input.marketType],
        ['Interval', input.interval],
        ['Target Count', input.limit],
        ['Wallet Balance', `$${walletBalance.toFixed(2)}`],
        ['Leverage', `${leverage}x`],
        ['Total Scored', scores.length],
        ['Eligible (Capital)', capitalEligible.length],
        ['Skipped (Capital)', skippedInsufficientCapital.length],
        ['Skipped (Klines)', skippedInsufficientKlines.length],
        ['Final Symbols', eligibleSymbols.length],
        ['Max Affordable', maxWatchers],
        ['BTC Trend', btcTrendInfo ? `${btcTrendEmoji} ${btcTrendInfo.direction}` : 'N/A'],
      ]);

      return {
        symbols: eligibleSymbols,
        skippedInsufficientCapital,
        skippedInsufficientKlines,
        skippedTrend,
        capitalPerWatcher,
        maxAffordableWatchers: maxWatchers,
        btcTrend: btcTrendInfo ? {
          direction: btcTrendInfo.direction,
          isClearTrend: true,
          adx: 0,
          strength: 0,
          rsi: 0,
        } : null,
      };
    }),

  getCapitalLimits: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const [config] = await ctx.db
        .select()
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, input.walletId),
            eq(autoTradingConfig.userId, ctx.user.id)
          )
        )
        .limit(1);

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = config?.leverage ?? 1;
      const positionSizePercent = parseFloat(config?.positionSizePercent ?? String(TRADING_DEFAULTS.POSITION_SIZE_PERCENT));

      const limits = calculateCapitalLimits({
        walletBalance,
        leverage,
        positionSizePercent,
        marketType: input.marketType,
      });

      const minNotionalFilter = getMinNotionalFilterService();
      const capitalPerWatcher = minNotionalFilter.getCapitalPerWatcher(
        limits.availableCapital,
        limits.maxAffordableWatchers,
        positionSizePercent
      );

      logApiTable('getCapitalLimits', [
        ['Wallet Balance', `$${walletBalance.toFixed(2)}`],
        ['Leverage', `${leverage}x`],
        ['Position Size', `${positionSizePercent}%`],
        ['Available Capital', `$${limits.availableCapital.toFixed(2)}`],
        [`Max Capital/Position (1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO})`, `$${limits.maxCapitalPerPosition.toFixed(2)}`],
        ['Effective Min Required', `$${limits.effectiveMinRequired.toFixed(2)}`],
        ['Capital Per Watcher', `$${capitalPerWatcher.toFixed(2)}`],
        ['Max Affordable Watchers', limits.maxAffordableWatchers],
      ]);

      return {
        walletBalance,
        leverage,
        positionSizePercent,
        availableCapital: limits.availableCapital,
        maxAffordableWatchers: limits.maxAffordableWatchers,
        capitalPerWatcher,
        maxCapitalPerPosition: limits.maxCapitalPerPosition,
      };
    }),
});
