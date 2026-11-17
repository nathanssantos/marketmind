import { and, desc, eq } from 'drizzle-orm';
import { INDICATOR_CACHE, BTC_KLINE_QUERY, ADX_TREND, TIME_MS } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { checkAdxCondition } from '../utils/filters/adx-filter';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { getAltcoinSeasonIndexService } from './altcoin-season-index';
import { getIndicatorHistoryService } from './indicator-history';
import { logger } from './logger';
import { getOrderBookAnalyzerService } from './order-book-analyzer';

const SNAPSHOT_INTERVAL_MS = INDICATOR_CACHE.SNAPSHOT_INTERVAL;

class IndicatorSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isSaving = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[IndicatorScheduler] Already running');
      return;
    }

    this.isRunning = true;

    await this.saveSnapshot();

    this.intervalId = setInterval(async () => {
      await this.saveSnapshot();
    }, SNAPSHOT_INTERVAL_MS);

    logger.info({
      intervalMinutes: SNAPSHOT_INTERVAL_MS / TIME_MS.MINUTE,
    }, '[IndicatorScheduler] Started - saving snapshots every 30 minutes');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[IndicatorScheduler] Stopped');
  }

  private async saveSnapshot(): Promise<void> {
    if (this.isSaving) {
      logger.trace('[IndicatorScheduler] Skip - already saving');
      return;
    }

    this.isSaving = true;

    try {
      const historyService = getIndicatorHistoryService();
      const altSeasonService = getAltcoinSeasonIndexService();
      const orderBookService = getOrderBookAnalyzerService();

      const btcDbKlines = await db.query.klines.findMany({
        where: and(eq(klines.symbol, BTC_KLINE_QUERY.SYMBOL), eq(klines.interval, '12h')),
        orderBy: [desc(klines.openTime)],
        limit: BTC_KLINE_QUERY.LIMIT,
      });

      let adxSaved = false;
      if (btcDbKlines.length >= ADX_TREND.MIN_KLINES_REQUIRED) {
        const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
        const adxResult = await checkAdxCondition(btcKlinesData, 'LONG');
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

      const orderBook = await orderBookService.getOrderBookAnalysis(BTC_KLINE_QUERY.SYMBOL, 'FUTURES');
      await historyService.saveIndicatorValue('ORDER_BOOK_IMBALANCE', orderBook.imbalanceRatio, {
        pressure: orderBook.pressure,
        bidWalls: orderBook.bidWalls.length,
        askWalls: orderBook.askWalls.length,
      });

      logger.info({
        adx: adxSaved,
        altcoinSeason: altSeason.altSeasonIndex.toFixed(1),
        orderBookImbalance: orderBook.imbalanceRatio.toFixed(2),
      }, '[IndicatorScheduler] Snapshot saved');
    } catch (error) {
      logger.error({ error }, '[IndicatorScheduler] Failed to save snapshot');
    } finally {
      this.isSaving = false;
    }
  }

  async saveNow(): Promise<void> {
    await this.saveSnapshot();
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const indicatorSchedulerService = new IndicatorSchedulerService();
