import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { klines } from '../../db/schema';
import { getAltcoinSeasonIndexService } from '../../services/altcoin-season-index';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { getBTCDominanceDataService } from '../../services/btc-dominance-data';
import { getCurrentIndicatorValues } from '../../services/dynamic-pyramid-evaluator';
import { getFearGreedDataService } from '../../services/fear-greed-data';
import { getIndicatorHistoryService } from '../../services/indicator-history';
import { getOnChainDataService } from '../../services/on-chain-data';
import { getOrderBookAnalyzerService } from '../../services/order-book-analyzer';
import { protectedProcedure, router } from '../../trpc';
import { checkAdxCondition } from '../../utils/filters/adx-filter';
import { getBtcTrendEmaInfoWithHistory } from '../../utils/filters/btc-correlation-filter';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { logApiTable } from './utils';

export const marketIntelligenceRouter = router({
  getBtcTrendStatus: protectedProcedure
    .input(z.object({ interval: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const interval = input?.interval ?? '4h';
      const btcKlinesData = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, interval)),
        orderBy: [desc(klines.openTime)],
        limit: 50,
      });

      const mappedKlines = mapDbKlinesReversed(btcKlinesData);
      const trendInfo = getBtcTrendEmaInfoWithHistory(mappedKlines);
      const trendEmoji = trendInfo.trend === 'BULLISH' ? '✓' : trendInfo.trend === 'BEARISH' ? '✗' : '·';
      logApiTable('getBtcTrendStatus', [
        ['Interval', interval],
        ['Trend', `${trendEmoji} ${trendInfo.trend}`],
        ['EMA21 Filter', `canLong: ${trendInfo.canLong}, canShort: ${trendInfo.canShort}`],
        ['History Points', trendInfo.history.length],
      ]);

      return trendInfo;
    }),

  getBatchFundingRates: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()).max(AUTO_TRADING_CONFIG.TARGET_COUNT.MAX * AUTO_TRADING_CONFIG.SYMBOL_FETCH_MULTIPLIER),
      })
    )
    .query(async ({ input }) => {
      const futuresService = getBinanceFuturesDataService();
      const allMarkPrices = await futuresService.getAllMarkPrices();

      const EXTREME_FUNDING_THRESHOLD = 0.001;

      const results = input.symbols.map((symbol) => {
        const info = allMarkPrices.find((p) => p.symbol === symbol);
        const rate = info?.lastFundingRate !== undefined ? info.lastFundingRate / 100 : null;
        const isExtreme = rate !== null && Math.abs(rate) >= EXTREME_FUNDING_THRESHOLD;

        return {
          symbol,
          rate,
          isExtreme,
          blocksLong: isExtreme && rate !== null && rate > 0,
          blocksShort: isExtreme && rate !== null && rate < 0,
        };
      });

      const extremeCount = results.filter((r) => r.isExtreme).length;
      logApiTable('getBatchFundingRates', [
        ['Symbols', input.symbols.length],
        ['Total Fetched', `✓ ${results.length}`],
        ['Extreme Rates', extremeCount > 0 ? `! ${extremeCount}` : `${extremeCount}`],
      ]);

      return results;
    }),

  getFearGreedIndex: protectedProcedure.query(async () => {
    const service = getFearGreedDataService();
    const result = await service.getFearGreedIndex();
    if (result.current) {
      logApiTable('getFearGreedIndex', [
        ['Value', result.current.value],
        ['Classification', result.current.valueClassification],
      ]);
    }
    return result;
  }),

  getBtcDominance: protectedProcedure.query(async () => {
    const service = getBTCDominanceDataService();
    const result = await service.getBTCDominanceResult();
    const trendEmoji = result.trend === 'increasing' ? '▲' : result.trend === 'decreasing' ? '▼' : '·';
    logApiTable('getBtcDominance', [
      ['Current', result.current !== null ? `${result.current.toFixed(2)}%` : 'N/A'],
      ['Change 24h', result.change24h !== null ? `${result.change24h >= 0 ? '+' : ''}${result.change24h.toFixed(2)}%` : 'N/A'],
      ['Trend', `${trendEmoji} ${result.trend}`],
    ]);
    return result;
  }),

  getAltcoinSeasonIndex: protectedProcedure.query(async () => {
    const service = getAltcoinSeasonIndexService();
    const historyService = getIndicatorHistoryService();
    const result = await service.getAltcoinSeasonIndex();
    const history = await historyService.getIndicatorHistory('ALTCOIN_SEASON', 31);

    const seasonIcon = result.seasonType === 'ALT_SEASON' ? '>' : result.seasonType === 'BTC_SEASON' ? '#' : '~';
    logApiTable('getAltcoinSeasonIndex', [
      ['Season', `${seasonIcon} ${result.seasonType}`],
      ['Index', `${result.altSeasonIndex.toFixed(1)}%`],
      ['Alts > BTC', `${result.altsOutperformingBtc}/${result.totalAltsAnalyzed}`],
      ['BTC 24h', `${result.btcPerformance24h >= 0 ? '+' : ''}${result.btcPerformance24h.toFixed(2)}%`],
      ['Avg Alt 24h', `${result.avgAltPerformance24h >= 0 ? '+' : ''}${result.avgAltPerformance24h.toFixed(2)}%`],
      ['History Points', history.history.length.toString()],
    ]);

    return {
      ...result,
      history: history.history,
      change24h: history.change24h,
    };
  }),

  getBtcAdxTrendStrength: protectedProcedure
    .input(z.object({ interval: z.string().default('12h') }))
    .query(async ({ input, ctx }) => {
      const historyService = getIndicatorHistoryService();
      const history = await historyService.getIndicatorHistory('ADX', 31);

      const btcDbKlines = await ctx.db.query.klines.findMany({
        where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, input.interval)),
        orderBy: [desc(klines.openTime)],
        limit: 100,
      });

      if (btcDbKlines.length < 50) {
        return {
          adx: null,
          plusDI: null,
          minusDI: null,
          isStrongTrend: false,
          isBullish: false,
          isBearish: false,
          isChoppy: true,
          reason: 'Insufficient data',
          history: history.history,
          change24h: history.change24h,
        };
      }

      const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
      const adxResult = checkAdxCondition(btcKlinesData, 'LONG');
      const isChoppy = adxResult.adx !== null && adxResult.adx < 20;

      logApiTable('getBtcAdxTrendStrength', [
        ['ADX', adxResult.adx !== null ? adxResult.adx.toFixed(2) : 'N/A'],
        ['+DI', adxResult.plusDI !== null ? adxResult.plusDI.toFixed(2) : 'N/A'],
        ['-DI', adxResult.minusDI !== null ? adxResult.minusDI.toFixed(2) : 'N/A'],
        ['Strong Trend', adxResult.isStrongTrend ? '✓' : '✗'],
        ['Choppy', isChoppy ? '! Yes' : 'No'],
        ['History Points', history.history.length.toString()],
      ]);

      return {
        adx: adxResult.adx,
        plusDI: adxResult.plusDI,
        minusDI: adxResult.minusDI,
        isStrongTrend: adxResult.isStrongTrend,
        isBullish: adxResult.isBullish,
        isBearish: adxResult.isBearish,
        isChoppy,
        reason: adxResult.reason,
        history: history.history,
        change24h: history.change24h,
      };
    }),

  getOrderBookAnalysis: protectedProcedure
    .input(z.object({
      symbol: z.string().default('BTCUSDT'),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ input }) => {
      const service = getOrderBookAnalyzerService();
      const result = await service.getOrderBookAnalysis(input.symbol, input.marketType);

      const pressureEmoji = result.pressure === 'BUYING' ? '▲' : result.pressure === 'SELLING' ? '▼' : '·';
      logApiTable('getOrderBookAnalysis', [
        ['Symbol', result.symbol],
        ['Pressure', `${pressureEmoji} ${result.pressure}`],
        ['Imbalance', result.imbalanceRatio.toFixed(2)],
        ['Bid Volume', `$${(result.bidVolume / 1e6).toFixed(2)}M`],
        ['Ask Volume', `$${(result.askVolume / 1e6).toFixed(2)}M`],
        ['Spread', `${result.spreadPercent.toFixed(4)}%`],
        ['Bid Walls', result.bidWalls.length.toString()],
        ['Ask Walls', result.askWalls.length.toString()],
      ]);

      return result;
    }),

  getOpenInterest: protectedProcedure
    .input(z.object({ symbol: z.string().default('BTCUSDT') }))
    .query(async ({ input }) => {
      const service = getBinanceFuturesDataService();
      const current = await service.getCurrentOpenInterest(input.symbol);
      const history = await service.getOpenInterest(input.symbol);

      let change24h: number | null = null;
      if (history.length > 0 && current) {
        const oldest = history[0];
        if (oldest) {
          change24h = ((current.openInterest - oldest.value) / oldest.value) * 100;
        }
      }

      logApiTable('getOpenInterest', [
        ['Symbol', input.symbol],
        ['Current OI', current ? `${(current.openInterest / 1000).toFixed(2)}K` : 'N/A'],
        ['Change 24h', change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : 'N/A'],
      ]);

      return {
        symbol: input.symbol,
        current: current?.openInterest ?? null,
        change24h,
        history: history.slice(-24),
      };
    }),

  getLongShortRatio: protectedProcedure
    .input(z.object({
      symbol: z.string().default('BTCUSDT'),
      period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).default('1h'),
    }))
    .query(async ({ input }) => {
      const service = getBinanceFuturesDataService();
      const [globalRatio, topTraderRatio] = await Promise.all([
        service.getLongShortRatio(input.symbol, input.period),
        service.getTopTraderLongShortRatio(input.symbol, input.period),
      ]);

      const latestGlobal = globalRatio[globalRatio.length - 1];
      const latestTopTrader = topTraderRatio[topTraderRatio.length - 1];

      logApiTable('getLongShortRatio', [
        ['Symbol', input.symbol],
        ['Period', input.period],
        ['Global L/S', latestGlobal ? `${(latestGlobal.longAccount * 100).toFixed(1)}% / ${(latestGlobal.shortAccount * 100).toFixed(1)}%` : 'N/A'],
        ['Top Traders L/S', latestTopTrader ? `${(latestTopTrader.longAccount * 100).toFixed(1)}% / ${(latestTopTrader.shortAccount * 100).toFixed(1)}%` : 'N/A'],
      ]);

      return {
        symbol: input.symbol,
        period: input.period,
        global: latestGlobal ? {
          longAccount: latestGlobal.longAccount,
          shortAccount: latestGlobal.shortAccount,
          ratio: latestGlobal.longShortRatio,
        } : null,
        topTraders: latestTopTrader ? {
          longAccount: latestTopTrader.longAccount,
          shortAccount: latestTopTrader.shortAccount,
          ratio: latestTopTrader.longShortRatio,
        } : null,
        globalHistory: globalRatio.slice(-24),
        topTraderHistory: topTraderRatio.slice(-24),
      };
    }),

  getMvrvRatio: protectedProcedure.query(async () => {
    const service = getOnChainDataService();
    const result = await service.getOnChainMetrics();
    logApiTable('getMvrvRatio', [
      ['Current', result.mvrv.current !== null ? result.mvrv.current.toFixed(2) : 'N/A'],
      ['History Points', result.mvrv.history.length.toString()],
    ]);
    return result.mvrv;
  }),

  getBtcProductionCost: protectedProcedure.query(async () => {
    const service = getOnChainDataService();
    const result = await service.getOnChainMetrics();
    logApiTable('getBtcProductionCost', [
      ['Cost', result.productionCost.currentCost !== null ? `$${result.productionCost.currentCost.toFixed(0)}` : 'N/A'],
      ['Price', result.productionCost.currentPrice !== null ? `$${result.productionCost.currentPrice.toFixed(0)}` : 'N/A'],
      ['History Points', result.productionCost.history.length.toString()],
    ]);
    return result.productionCost;
  }),

  saveIndicatorSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
    const historyService = getIndicatorHistoryService();
    const altSeasonService = getAltcoinSeasonIndexService();
    const orderBookService = getOrderBookAnalyzerService();

    const btcDbKlines = await ctx.db.query.klines.findMany({
      where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, '12h')),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    let adxSaved = false;
    if (btcDbKlines.length >= 50) {
      const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
      const adxResult = checkAdxCondition(btcKlinesData, 'LONG');
      if (adxResult.adx !== null) {
        await historyService.saveIndicatorValue('ADX', adxResult.adx, {
          plusDI: adxResult.plusDI,
          minusDI: adxResult.minusDI,
          isStrongTrend: adxResult.isStrongTrend,
        });
        adxSaved = true;
      }
    }

    const altSeason = await altSeasonService.getAltcoinSeasonIndex();
    await historyService.saveIndicatorValue('ALTCOIN_SEASON', altSeason.altSeasonIndex, {
      seasonType: altSeason.seasonType,
      altsOutperformingBtc: altSeason.altsOutperformingBtc,
      totalAltsAnalyzed: altSeason.totalAltsAnalyzed,
    });

    const orderBook = await orderBookService.getOrderBookAnalysis('BTCUSDT', 'FUTURES');
    await historyService.saveIndicatorValue('ORDER_BOOK_IMBALANCE', orderBook.imbalanceRatio, {
      pressure: orderBook.pressure,
      bidWalls: orderBook.bidWalls.length,
      askWalls: orderBook.askWalls.length,
    });

    logApiTable('saveIndicatorSnapshot', [
      ['ADX', adxSaved ? '✓' : '✗'],
      ['Altcoin Season', '✓'],
      ['Order Book', '✓'],
    ]);

    return { success: true, adxSaved, altSeasonSaved: true, orderBookSaved: true };
  }),

  getPyramidIndicators: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      interval: z.string().default('1h'),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ ctx, input }) => {
      const dbKlines = await ctx.db
        .select()
        .from(klines)
        .where(and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval),
          eq(klines.marketType, input.marketType)
        ))
        .orderBy(desc(klines.openTime))
        .limit(100);

      if (dbKlines.length < 30) {
        return {
          symbol: input.symbol,
          interval: input.interval,
          atr: null,
          adx: null,
          rsi: null,
          plusDI: null,
          minusDI: null,
          trendStrength: 'unknown' as const,
          message: 'Insufficient kline data for indicator calculation',
        };
      }

      const mappedKlines = mapDbKlinesReversed(dbKlines);
      const indicators = getCurrentIndicatorValues(mappedKlines);

      let trendStrength: 'strong' | 'moderate' | 'weak' | 'unknown' = 'unknown';
      if (indicators.adx !== null) {
        if (indicators.adx >= 40) trendStrength = 'strong';
        else if (indicators.adx >= 25) trendStrength = 'moderate';
        else trendStrength = 'weak';
      }

      return {
        symbol: input.symbol,
        interval: input.interval,
        ...indicators,
        trendStrength,
        message: null,
      };
    }),
});
