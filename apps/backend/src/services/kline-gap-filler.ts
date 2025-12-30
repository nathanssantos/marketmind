import type { Interval } from '@marketmind/types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { REQUIRED_KLINES } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI, getIntervalMilliseconds } from './binance-historical';
import { logger } from './logger';

const GAP_CHECK_INTERVAL = 5 * 60 * 1000;
const MIN_GAP_SIZE_TO_FILL = 1;

interface GapInfo {
  symbol: string;
  interval: Interval;
  marketType: 'SPOT' | 'FUTURES';
  gapStart: Date;
  gapEnd: Date;
  missingCandles: number;
}

interface ActivePair {
  symbol: string;
  interval: Interval;
  marketType: 'SPOT' | 'FUTURES';
}

class KlineGapFiller {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.checkInterval) {
      // logger.debug('Gap filler already running');
      return;
    }

    // logger.info('Starting KlineGapFiller service');

    await this.checkAndFillGaps();

    this.checkInterval = setInterval(async () => {
      await this.checkAndFillGaps();
    }, GAP_CHECK_INTERVAL);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      // logger.info('KlineGapFiller service stopped');
    }
  }

  async checkAndFillGaps(): Promise<void> {
    if (this.isRunning) {
      // logger.debug('Gap check already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // logger.debug('Starting gap check cycle');

      const activePairs = await this.getActivePairs();

      if (activePairs.length === 0) {
        // logger.debug('No active watchers found, skipping gap check');
        return;
      }

      // logger.info({ pairs: activePairs.length }, 'Checking gaps for active pairs');

      for (const pair of activePairs) {
        try {
          const gaps = await this.detectGaps(pair);

          if (gaps.length > 0) {
            logger.info({ symbol: pair.symbol, interval: pair.interval, gaps: gaps.length }, 'Found gaps');

            for (const gap of gaps) {
              await this.fillGap(gap);
            }
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking gaps for pair');
        }
      }

      // logger.debug('Gap check cycle complete');
    } catch (error) {
      logger.error({ error }, 'Error in gap check cycle');
    } finally {
      this.isRunning = false;
    }
  }

  private async getActivePairs(): Promise<ActivePair[]> {
    const watchers = await db.query.activeWatchers.findMany();

    const pairs: ActivePair[] = [];
    const seen = new Set<string>();

    for (const watcher of watchers) {
      const key = `${watcher.symbol}@${watcher.interval}@${watcher.marketType}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({
          symbol: watcher.symbol,
          interval: watcher.interval as Interval,
          marketType: watcher.marketType,
        });
      }
    }

    return pairs;
  }

  private async detectGaps(pair: ActivePair): Promise<GapInfo[]> {
    const now = Date.now();
    const intervalMs = getIntervalMilliseconds(pair.interval);
    const lookbackMs = REQUIRED_KLINES * intervalMs;
    const startTime = new Date(now - lookbackMs);
    const endTime = new Date(now);

    const dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, pair.symbol),
        eq(klines.interval, pair.interval),
        gte(klines.openTime, startTime),
        lte(klines.openTime, endTime)
      ),
      orderBy: [asc(klines.openTime)],
    });

    if (dbKlines.length === 0) {
      return [
        {
          ...pair,
          gapStart: startTime,
          gapEnd: endTime,
          missingCandles: REQUIRED_KLINES,
        },
      ];
    }

    const gaps: GapInfo[] = [];

    if (dbKlines.length < REQUIRED_KLINES) {
      const firstKline = dbKlines[0];
      if (firstKline && firstKline.openTime.getTime() > startTime.getTime()) {
        const missingAtStart = Math.floor((firstKline.openTime.getTime() - startTime.getTime()) / intervalMs);
        if (missingAtStart >= MIN_GAP_SIZE_TO_FILL) {
          gaps.push({
            ...pair,
            gapStart: startTime,
            gapEnd: new Date(firstKline.openTime.getTime() - intervalMs),
            missingCandles: missingAtStart,
          });
        }
      }
    }

    for (let i = 1; i < dbKlines.length; i++) {
      const prevKline = dbKlines[i - 1];
      const currKline = dbKlines[i];
      if (!prevKline || !currKline) continue;
      const prevTime = prevKline.openTime.getTime();
      const currTime = currKline.openTime.getTime();
      const expectedNextTime = prevTime + intervalMs;

      if (currTime > expectedNextTime) {
        const missingCandles = Math.floor((currTime - expectedNextTime) / intervalMs) + 1;

        if (missingCandles >= MIN_GAP_SIZE_TO_FILL) {
          gaps.push({
            ...pair,
            gapStart: new Date(expectedNextTime),
            gapEnd: new Date(currTime - intervalMs),
            missingCandles,
          });
        }
      }
    }

    const lastKline = dbKlines[dbKlines.length - 1];
    if (!lastKline) return gaps;

    const lastKlineTime = lastKline.openTime.getTime();
    const expectedLatestTime = Math.floor(now / intervalMs) * intervalMs;
    const missingAtEnd = Math.floor((expectedLatestTime - lastKlineTime) / intervalMs);

    if (missingAtEnd >= MIN_GAP_SIZE_TO_FILL + 1) {
      gaps.push({
        ...pair,
        gapStart: new Date(lastKlineTime + intervalMs),
        gapEnd: new Date(expectedLatestTime),
        missingCandles: missingAtEnd,
      });
    }

    return gaps;
  }

  private async fillGap(gap: GapInfo): Promise<void> {
    logger.info(
      {
        symbol: gap.symbol,
        interval: gap.interval,
        gapStart: gap.gapStart.toISOString(),
        gapEnd: gap.gapEnd.toISOString(),
        missingCandles: gap.missingCandles,
      },
      'Filling gap'
    );

    try {
      const fetchFn = gap.marketType === 'FUTURES' ? fetchFuturesKlinesFromAPI : fetchHistoricalKlinesFromAPI;

      const fetchedKlines = await fetchFn(gap.symbol, gap.interval, gap.gapStart, gap.gapEnd);

      if (fetchedKlines.length === 0) {
        logger.warn({ gap }, 'No klines fetched for gap');
        return;
      }

      let inserted = 0;

      for (const kline of fetchedKlines) {
        try {
          await db
            .insert(klines)
            .values({
              symbol: gap.symbol,
              interval: gap.interval,
              marketType: gap.marketType,
              openTime: new Date(kline.openTime),
              open: kline.open,
              high: kline.high,
              low: kline.low,
              close: kline.close,
              volume: kline.volume,
              closeTime: new Date(kline.closeTime),
              quoteVolume: kline.quoteVolume,
              trades: kline.trades,
              takerBuyBaseVolume: kline.takerBuyBaseVolume || '0',
              takerBuyQuoteVolume: kline.takerBuyQuoteVolume || '0',
            })
            .onConflictDoNothing();
          inserted++;
        } catch (error) {
          logger.error({ kline, error }, 'Error inserting kline');
        }
      }

      logger.info({ symbol: gap.symbol, interval: gap.interval, inserted }, 'Gap filled');
    } catch (error) {
      logger.error({ gap, error }, 'Error filling gap');
    }
  }

  async forceCheckSymbol(symbol: string, interval: Interval, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<number> {
    const pair: ActivePair = { symbol, interval, marketType };
    const gaps = await this.detectGaps(pair);
    let totalFilled = 0;

    for (const gap of gaps) {
      await this.fillGap(gap);
      totalFilled += gap.missingCandles;
    }

    return totalFilled;
  }
}

let klineGapFillerInstance: KlineGapFiller | null = null;

export const getKlineGapFiller = (): KlineGapFiller => {
  if (!klineGapFillerInstance) {
    klineGapFillerInstance = new KlineGapFiller();
  }
  return klineGapFillerInstance;
};

export const initializeKlineGapFiller = (): KlineGapFiller => {
  klineGapFillerInstance = new KlineGapFiller();
  return klineGapFillerInstance;
};

export type { ActivePair, GapInfo };

