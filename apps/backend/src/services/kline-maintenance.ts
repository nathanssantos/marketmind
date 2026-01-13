import type { Interval } from '@marketmind/types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import {
  ABSOLUTE_MINIMUM_KLINES,
  REQUIRED_KLINES,
  TIME_MS,
  COOLDOWN_GAP_CHECK,
  COOLDOWN_CORRUPTION_CHECK,
  CORRUPTION_CHECK_KLINES,
} from '../constants';
import { db } from '../db';
import { klines, pairMaintenanceLog } from '../db/schema';
import { fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI, getIntervalMilliseconds } from './binance-historical';
import { KlineValidator } from './kline-validator';
import { logger } from './logger';

const GAP_CHECK_INTERVAL = 5 * TIME_MS.MINUTE;
const MIN_GAP_SIZE_TO_FILL = 1;
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';
const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';

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

interface BinanceKlineResponse {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

class KlineMaintenance {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.checkInterval) {
      return;
    }

    logger.info('Starting kline maintenance service...');
    await this.checkAllStoredPairs();
    await this.checkCorruptionOnStartup();
    await this.checkAndFillGaps();

    this.checkInterval = setInterval(async () => {
      await this.checkAndFillGaps();
    }, GAP_CHECK_INTERVAL);
  }

  private async checkCorruptionOnStartup(): Promise<void> {
    try {
      const activePairs = await this.getActivePairs();

      if (activePairs.length === 0) {
        logger.info('No active pairs for corruption check on startup');
        return;
      }

      logger.info({ pairsCount: activePairs.length }, 'Running corruption check on startup');

      for (const pair of activePairs) {
        try {
          const fixedCorrupted = await this.detectAndFixCorruptedKlines(pair);

          if (fixedCorrupted > 0) {
            logger.info({ symbol: pair.symbol, interval: pair.interval, fixed: fixedCorrupted }, 'Fixed corrupted klines on startup');
          }

          await this.updateMaintenanceLog(pair, { corruptedFixed: fixedCorrupted, checkType: 'corruption' });
        } catch (error) {
          logger.error({ pair, error }, 'Error checking corruption for pair on startup');
        }
      }

      logger.info('Startup corruption check complete');
    } catch (error) {
      logger.error({ error }, 'Error in startup corruption check');
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async shouldCheckGaps(pair: ActivePair): Promise<boolean> {
    const log = await db.query.pairMaintenanceLog.findFirst({
      where: and(
        eq(pairMaintenanceLog.symbol, pair.symbol),
        eq(pairMaintenanceLog.interval, pair.interval),
        eq(pairMaintenanceLog.marketType, pair.marketType)
      ),
    });

    if (!log?.lastGapCheck) return true;

    const elapsed = Date.now() - log.lastGapCheck.getTime();
    return elapsed >= COOLDOWN_GAP_CHECK;
  }

  private async shouldCheckCorruption(pair: ActivePair): Promise<boolean> {
    const log = await db.query.pairMaintenanceLog.findFirst({
      where: and(
        eq(pairMaintenanceLog.symbol, pair.symbol),
        eq(pairMaintenanceLog.interval, pair.interval),
        eq(pairMaintenanceLog.marketType, pair.marketType)
      ),
    });

    if (!log?.lastCorruptionCheck) return true;

    const elapsed = Date.now() - log.lastCorruptionCheck.getTime();
    return elapsed >= COOLDOWN_CORRUPTION_CHECK;
  }

  private async updateMaintenanceLog(
    pair: ActivePair,
    updates: { gapsFound?: number; corruptedFixed?: number; checkType: 'gap' | 'corruption' }
  ): Promise<void> {
    const now = new Date();
    const setClause: Record<string, unknown> = { updatedAt: now };

    if (updates.checkType === 'gap') {
      setClause['lastGapCheck'] = now;
      if (updates.gapsFound !== undefined) {
        setClause['gapsFound'] = updates.gapsFound;
      }
    } else {
      setClause['lastCorruptionCheck'] = now;
      if (updates.corruptedFixed !== undefined) {
        setClause['corruptedFixed'] = updates.corruptedFixed;
      }
    }

    await db
      .insert(pairMaintenanceLog)
      .values({
        symbol: pair.symbol,
        interval: pair.interval,
        marketType: pair.marketType,
        lastGapCheck: updates.checkType === 'gap' ? now : undefined,
        lastCorruptionCheck: updates.checkType === 'corruption' ? now : undefined,
        gapsFound: updates.gapsFound ?? 0,
        corruptedFixed: updates.corruptedFixed ?? 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pairMaintenanceLog.symbol, pairMaintenanceLog.interval, pairMaintenanceLog.marketType],
        set: setClause,
      });
  }

  private async checkAllStoredPairs(): Promise<void> {
    try {
      const distinctPairs = await db
        .selectDistinct({
          symbol: klines.symbol,
          interval: klines.interval,
          marketType: klines.marketType,
        })
        .from(klines);

      logger.info({ pairsCount: distinctPairs.length }, 'Found stored pairs to check');

      for (const pair of distinctPairs) {
        try {
          const activePair: ActivePair = {
            symbol: pair.symbol,
            interval: pair.interval as Interval,
            marketType: pair.marketType,
          };

          if (!(await this.shouldCheckGaps(activePair))) {
            logger.debug({ symbol: pair.symbol, interval: pair.interval, marketType: pair.marketType }, 'Skipping gap check (cooldown)');
            continue;
          }

          const gaps = await this.detectGaps(activePair);

          if (gaps.length > 0) {
            logger.info({ symbol: pair.symbol, interval: pair.interval, marketType: pair.marketType, gaps: gaps.length }, 'Found gaps in stored pair');

            for (const gap of gaps) {
              await this.fillGap(gap);
            }
          }

          await this.updateMaintenanceLog(activePair, { gapsFound: gaps.length, checkType: 'gap' });
        } catch (error) {
          logger.error({ pair, error }, 'Error checking gaps for stored pair');
        }
      }

      logger.info('Initial gap check complete');
    } catch (error) {
      logger.error({ error }, 'Error in initial gap check');
    }
  }

  async checkAndFillGaps(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const activePairs = await this.getActivePairs();

      if (activePairs.length === 0) {
        return;
      }

      for (const pair of activePairs) {
        try {
          if (await this.shouldCheckGaps(pair)) {
            const gaps = await this.detectGaps(pair);

            if (gaps.length > 0) {
              logger.debug({ symbol: pair.symbol, interval: pair.interval, gaps: gaps.length }, 'Found gaps');

              for (const gap of gaps) {
                await this.fillGap(gap);
              }
            }

            await this.updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });
          }

          if (await this.shouldCheckCorruption(pair)) {
            const fixedCorrupted = await this.detectAndFixCorruptedKlines(pair);

            if (fixedCorrupted > 0) {
              logger.debug({ symbol: pair.symbol, interval: pair.interval, fixed: fixedCorrupted }, 'Fixed corrupted klines');
            }

            await this.updateMaintenanceLog(pair, { corruptedFixed: fixedCorrupted, checkType: 'corruption' });
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking gaps for pair');
        }
      }
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

    const BINANCE_SPOT_START = new Date('2017-08-17').getTime();
    const BINANCE_FUTURES_START = new Date('2019-09-08').getTime();
    const defaultMinStartTime = pair.marketType === 'FUTURES' ? BINANCE_FUTURES_START : BINANCE_SPOT_START;

    const maintenanceLog = await db.query.pairMaintenanceLog.findFirst({
      where: and(
        eq(pairMaintenanceLog.symbol, pair.symbol),
        eq(pairMaintenanceLog.interval, pair.interval),
        eq(pairMaintenanceLog.marketType, pair.marketType)
      ),
    });

    const knownEarliestDate = maintenanceLog?.earliestKlineDate?.getTime();
    const minStartTime = knownEarliestDate ?? defaultMinStartTime;

    const calculatedStartTime = now - lookbackMs;
    const startTime = new Date(Math.max(calculatedStartTime, minStartTime));
    const endTime = new Date(now);

    const dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, pair.symbol),
        eq(klines.interval, pair.interval),
        eq(klines.marketType, pair.marketType),
        gte(klines.openTime, startTime),
        lte(klines.openTime, endTime)
      ),
      orderBy: [asc(klines.openTime)],
    });

    if (dbKlines.length === 0) {
      if (knownEarliestDate) {
        return [];
      }
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
    const firstKline = dbKlines[0];
    const hasSufficientData = dbKlines.length >= ABSOLUTE_MINIMUM_KLINES;

    if (!hasSufficientData && !knownEarliestDate && dbKlines.length < REQUIRED_KLINES && firstKline) {
      if (firstKline.openTime.getTime() > startTime.getTime()) {
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
        marketType: gap.marketType,
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
        const firstExistingKline = await db.query.klines.findFirst({
          where: and(
            eq(klines.symbol, gap.symbol),
            eq(klines.interval, gap.interval),
            eq(klines.marketType, gap.marketType)
          ),
          orderBy: [asc(klines.openTime)],
        });

        if (firstExistingKline) {
          logger.info(
            { symbol: gap.symbol, interval: gap.interval, marketType: gap.marketType, earliestDate: firstExistingKline.openTime.toISOString() },
            'No older data available, storing earliest kline date'
          );

          await db
            .insert(pairMaintenanceLog)
            .values({
              symbol: gap.symbol,
              interval: gap.interval,
              marketType: gap.marketType,
              earliestKlineDate: firstExistingKline.openTime,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [pairMaintenanceLog.symbol, pairMaintenanceLog.interval, pairMaintenanceLog.marketType],
              set: { earliestKlineDate: firstExistingKline.openTime, updatedAt: new Date() },
            });
        } else {
          logger.warn({ gap }, 'No klines fetched for gap');
        }
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

      logger.info({ symbol: gap.symbol, interval: gap.interval, marketType: gap.marketType, inserted }, 'Gap filled successfully');
    } catch (error) {
      logger.error({ gap, error }, 'Error filling gap');
    }
  }

  private async fetchBinanceKline(
    symbol: string,
    interval: string,
    timestamp: number,
    marketType: 'SPOT' | 'FUTURES'
  ): Promise<BinanceKlineResponse | null> {
    const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
    const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${timestamp}&limit=1`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.length === 0) return null;

      const k = data[0];
      return {
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteVolume: k[7],
        trades: k[8],
        takerBuyBaseVolume: k[9],
        takerBuyQuoteVolume: k[10],
      };
    } catch {
      return null;
    }
  }

  private async detectAndFixCorruptedKlines(pair: ActivePair): Promise<number> {
    const intervalMs = getIntervalMilliseconds(pair.interval);
    const lookbackMs = CORRUPTION_CHECK_KLINES * intervalMs;
    const startTime = new Date(Date.now() - lookbackMs);

    const recentKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, pair.symbol),
        eq(klines.interval, pair.interval),
        eq(klines.marketType, pair.marketType),
        gte(klines.openTime, startTime)
      ),
      orderBy: [asc(klines.openTime)],
    });

    interface CorruptedKlineInfo {
      kline: typeof recentKlines[0];
      reason: string;
    }

    const corruptedKlines: CorruptedKlineInfo[] = [];

    for (let i = 0; i < recentKlines.length; i++) {
      const kline = recentKlines[i];
      if (!kline) continue;

      const corruption = KlineValidator.isKlineCorrupted(kline);

      if (corruption) {
        corruptedKlines.push({ kline, reason: corruption.reason });
      }
    }

    if (corruptedKlines.length === 0) return 0;

    const reasonCounts = corruptedKlines.reduce((acc, { reason }) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    logger.warn(
      {
        symbol: pair.symbol,
        interval: pair.interval,
        marketType: pair.marketType,
        totalCorrupted: corruptedKlines.length,
        reasons: reasonCounts,
      },
      'Corrupted klines detected (batch)'
    );

    let fixed = 0;

    for (const { kline } of corruptedKlines) {
      const binanceKline = await this.fetchBinanceKline(
        pair.symbol,
        pair.interval,
        kline.openTime.getTime(),
        pair.marketType
      );

      if (binanceKline) {
        await db
          .update(klines)
          .set({
            open: binanceKline.open,
            high: binanceKline.high,
            low: binanceKline.low,
            close: binanceKline.close,
            volume: binanceKline.volume,
            quoteVolume: binanceKline.quoteVolume,
            trades: binanceKline.trades,
            takerBuyBaseVolume: binanceKline.takerBuyBaseVolume,
            takerBuyQuoteVolume: binanceKline.takerBuyQuoteVolume,
            closeTime: new Date(binanceKline.closeTime),
          })
          .where(
            and(
              eq(klines.symbol, pair.symbol),
              eq(klines.interval, pair.interval),
              eq(klines.marketType, pair.marketType),
              eq(klines.openTime, kline.openTime)
            )
          );

        fixed++;
      }
    }

    if (fixed > 0) {
      logger.info(
        { symbol: pair.symbol, interval: pair.interval, marketType: pair.marketType, fixed, total: corruptedKlines.length },
        'Fixed corrupted klines (batch)'
      );
    }

    return fixed;
  }

  async forceCheckSymbol(symbol: string, interval: Interval, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<{ gapsFilled: number; corruptedFixed: number }> {
    const pair: ActivePair = { symbol, interval, marketType };

    const gaps = await this.detectGaps(pair);
    let gapsFilled = 0;

    for (const gap of gaps) {
      await this.fillGap(gap);
      gapsFilled += gap.missingCandles;
    }

    const corruptedFixed = await this.detectAndFixCorruptedKlines(pair);

    if (gapsFilled > 0 || corruptedFixed > 0) {
      logger.debug({ symbol, interval, marketType, gapsFilled, corruptedFixed }, 'Force check completed');
    }

    await this.updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });
    await this.updateMaintenanceLog(pair, { corruptedFixed, checkType: 'corruption' });

    return { gapsFilled, corruptedFixed };
  }

  async checkAfterReconnection(): Promise<{ checked: number; fixed: number }> {
    logger.info('Running post-reconnection validation');

    const activePairs = await this.getActivePairs();
    let totalChecked = 0;
    let totalFixed = 0;

    for (const pair of activePairs) {
      const intervalMs = getIntervalMilliseconds(pair.interval);
      const lookbackMs = 50 * intervalMs;
      const startTime = new Date(Date.now() - lookbackMs);

      const recentKlines = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, pair.symbol),
          eq(klines.interval, pair.interval),
          eq(klines.marketType, pair.marketType),
          gte(klines.openTime, startTime)
        ),
        orderBy: [asc(klines.openTime)],
      });

      totalChecked += recentKlines.length;

      for (const kline of recentKlines) {
        const isValid = await KlineValidator.validateAgainstAPI(
          kline,
          pair.symbol,
          pair.interval,
          pair.marketType
        );

        if (!isValid) {
          const apiKline = await this.fetchBinanceKline(
            pair.symbol,
            pair.interval,
            kline.openTime.getTime(),
            pair.marketType
          );

          if (apiKline) {
            await db
              .update(klines)
              .set({
                open: apiKline.open,
                high: apiKline.high,
                low: apiKline.low,
                close: apiKline.close,
                volume: apiKline.volume,
                quoteVolume: apiKline.quoteVolume,
                trades: apiKline.trades,
                takerBuyBaseVolume: apiKline.takerBuyBaseVolume,
                takerBuyQuoteVolume: apiKline.takerBuyQuoteVolume,
                closeTime: new Date(apiKline.closeTime),
              })
              .where(
                and(
                  eq(klines.symbol, pair.symbol),
                  eq(klines.interval, pair.interval),
                  eq(klines.marketType, pair.marketType),
                  eq(klines.openTime, kline.openTime)
                )
              );

            totalFixed++;
            logger.info({
              symbol: pair.symbol,
              interval: pair.interval,
              openTime: kline.openTime,
            }, 'Fixed corrupted kline after reconnection');
          }
        }
      }
    }

    logger.info({ totalChecked, totalFixed }, 'Post-reconnection check complete');
    return { checked: totalChecked, fixed: totalFixed };
  }
}

let klineMaintenanceInstance: KlineMaintenance | null = null;

export const getKlineMaintenance = (): KlineMaintenance => {
  if (!klineMaintenanceInstance) {
    klineMaintenanceInstance = new KlineMaintenance();
  }
  return klineMaintenanceInstance;
};

export const initializeKlineMaintenance = (): KlineMaintenance => {
  klineMaintenanceInstance = new KlineMaintenance();
  return klineMaintenanceInstance;
};

export const getKlineGapFiller = getKlineMaintenance;
export const initializeKlineGapFiller = initializeKlineMaintenance;

export { KlineMaintenance };
export type { ActivePair, GapInfo };
