import type { Interval } from '@marketmind/types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import {
  REQUIRED_KLINES,
  TIME_MS,
  COOLDOWN_GAP_CHECK,
  COOLDOWN_CORRUPTION_CHECK,
  CORRUPTION_CHECK_KLINES,
  API_VALIDATION_RECENT_COUNT,
} from '../constants';
import { db } from '../db';
import { klines, pairMaintenanceLog } from '../db/schema';
import { fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI, getIntervalMilliseconds } from './binance-historical';
import { binanceKlineStreamService, binanceFuturesKlineStreamService } from './binance-kline-stream';
import { KlineValidator } from './kline-validator';
import { logger, serializeError } from './logger';
import type { OHLCMismatchEntry, ReconnectionValidationResult } from '@marketmind/logger';
import {
  MaintenanceLogBuffer,
  outputMaintenanceResults,
  outputReconnectionValidationResults,
  type CorruptionFixEntry,
} from './watcher-batch-logger';

const GAP_CHECK_INTERVAL = 5 * TIME_MS.MINUTE;
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

export interface KlineMaintenanceStartOptions {
  skipStartupSync?: boolean;
  delayMs?: number;
}

class KlineMaintenance {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start(options: KlineMaintenanceStartOptions = {}): Promise<void> {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      await this.checkAndFillGaps();
    }, GAP_CHECK_INTERVAL);

    if (options.skipStartupSync) {
      if (options.delayMs) {
        setTimeout(() => void this.runStartupSync(), options.delayMs);
      }
      return;
    }

    await this.runStartupSync();
  }

  private async runStartupSync(): Promise<void> {
    const logBuffer = new MaintenanceLogBuffer('startup');

    const [gapResults] = await Promise.all([
      this.checkAllStoredPairs(logBuffer),
      this.checkCorruptionOnStartup(logBuffer),
    ]);

    logBuffer.setPairsChecked(gapResults.pairsChecked);

    outputMaintenanceResults(logBuffer.toResult());

    await this.checkAndFillGaps();
  }

  private async checkCorruptionOnStartup(logBuffer?: MaintenanceLogBuffer): Promise<{ pairsChecked: number }> {
    try {
      const activePairs = await this.getActivePairs();

      if (activePairs.length === 0) return { pairsChecked: 0 };

      for (const pair of activePairs) {
        try {
          const { corruptedFound, fixed } = await this.detectAndFixCorruptedKlines(pair, true);

          await this.updateMaintenanceLog(pair, { corruptedFixed: fixed, checkType: 'corruption' });

          if (logBuffer && corruptedFound > 0) {
            const entry: CorruptionFixEntry = {
              symbol: pair.symbol,
              interval: pair.interval,
              marketType: pair.marketType,
              corruptedFound,
              fixed,
              status: fixed === corruptedFound ? 'success' : fixed > 0 ? 'partial' : 'error',
            };
            logBuffer.addCorruptionFix(entry);
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking corruption for pair on startup');
        }
      }

      return { pairsChecked: activePairs.length };
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in startup corruption check');
      return { pairsChecked: 0 };
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

  private async checkAllStoredPairs(logBuffer?: MaintenanceLogBuffer): Promise<{ pairsChecked: number }> {
    try {
      const activePairs = await this.getActivePairsWithSubscriptions();

      for (const activePair of activePairs) {
        try {
          if (!(await this.shouldCheckGaps(activePair))) {
            if (logBuffer) {
              logBuffer.addGapFill({
                symbol: activePair.symbol,
                interval: activePair.interval,
                marketType: activePair.marketType,
                gapsFound: 0,
                candlesFilled: 0,
                status: 'skipped',
                reason: 'Cooldown active',
              });
            }
            continue;
          }

          const gaps = await this.detectGaps(activePair);
          let totalFilled = 0;

          const GAP_BATCH_SIZE = 3;
          for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
            const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
            const results = await Promise.all(batch.map(gap => this.fillGap(gap, true).catch(() => 0)));
            totalFilled += results.reduce((sum, n) => sum + n, 0);
          }

          await this.updateMaintenanceLog(activePair, { gapsFound: gaps.length, checkType: 'gap' });

          if (logBuffer && (gaps.length > 0 || totalFilled > 0)) {
            logBuffer.addGapFill({
              symbol: activePair.symbol,
              interval: activePair.interval,
              marketType: activePair.marketType,
              gapsFound: gaps.length,
              candlesFilled: totalFilled,
              status: totalFilled > 0 ? 'success' : gaps.length > 0 ? 'partial' : 'success',
            });
          }
        } catch (error) {
          logger.error({ activePair, error }, 'Error checking gaps for active pair');
          if (logBuffer) {
            logBuffer.addGapFill({
              symbol: activePair.symbol,
              interval: activePair.interval,
              marketType: activePair.marketType,
              gapsFound: 0,
              candlesFilled: 0,
              status: 'error',
              reason: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return { pairsChecked: activePairs.length };
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in initial gap check');
      return { pairsChecked: 0 };
    }
  }

  async checkAndFillGaps(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      const activePairs = await this.getActivePairs();
      if (activePairs.length === 0) return;

      const logBuffer = new MaintenanceLogBuffer('periodic');
      logBuffer.setPairsChecked(activePairs.length);

      for (const pair of activePairs) {
        try {
          if (await this.shouldCheckGaps(pair)) {
            const gaps = await this.detectGaps(pair);
            let totalFilled = 0;

            const GAP_BATCH_SIZE = 3;
            for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
              const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
              const results = await Promise.all(batch.map(gap => this.fillGap(gap, true).catch(() => 0)));
              totalFilled += results.reduce((sum, n) => sum + n, 0);
            }

            await this.updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });

            if (gaps.length > 0 || totalFilled > 0) {
              logBuffer.addGapFill({
                symbol: pair.symbol,
                interval: pair.interval,
                marketType: pair.marketType,
                gapsFound: gaps.length,
                candlesFilled: totalFilled,
                status: totalFilled > 0 ? 'success' : gaps.length > 0 ? 'partial' : 'success',
              });
            }
          }

          if (await this.shouldCheckCorruption(pair)) {
            const { corruptedFound, fixed } = await this.detectAndFixCorruptedKlines(pair, true);

            await this.updateMaintenanceLog(pair, { corruptedFixed: fixed, checkType: 'corruption' });

            if (corruptedFound > 0) {
              logBuffer.addCorruptionFix({
                symbol: pair.symbol,
                interval: pair.interval,
                marketType: pair.marketType,
                corruptedFound,
                fixed,
                status: fixed === corruptedFound ? 'success' : fixed > 0 ? 'partial' : 'error',
              });
            }
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking gaps for pair');
        }
      }

      outputMaintenanceResults(logBuffer.toResult());
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in gap check cycle');
    } finally {
      this.isRunning = false;
    }
  }

  private async getActivePairs(): Promise<ActivePair[]> {
    return this.getActivePairsWithSubscriptions();
  }

  private async getActivePairsWithSubscriptions(): Promise<ActivePair[]> {
    const pairs: ActivePair[] = [];
    const seen = new Set<string>();

    const watchers = await db.query.activeWatchers.findMany();
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

    try {
      const spotSubs = binanceKlineStreamService.getActiveSubscriptions();
      for (const sub of spotSubs) {
        const key = `${sub.symbol}@${sub.interval}@SPOT`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ symbol: sub.symbol, interval: sub.interval as Interval, marketType: 'SPOT' });
        }
      }

      const futuresSubs = binanceFuturesKlineStreamService.getActiveSubscriptions();
      for (const sub of futuresSubs) {
        const key = `${sub.symbol}@${sub.interval}@FUTURES`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ symbol: sub.symbol, interval: sub.interval as Interval, marketType: 'FUTURES' });
        }
      }
    } catch (error) {
      logger.trace({ error: serializeError(error) }, '[KlineMaintenance] Stream services not available (expected during startup)');
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

    if (firstKline && !knownEarliestDate && firstKline.openTime.getTime() > startTime.getTime()) {
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

  private async fillGap(gap: GapInfo, silent = false): Promise<number> {
    if (!silent) {
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
    }

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
        }
        return 0;
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
          logger.error({ error: serializeError(error) }, 'Error inserting kline');
        }
      }

      if (inserted > 0) {
        if (!silent) {
          logger.info({ symbol: gap.symbol, interval: gap.interval, marketType: gap.marketType, inserted }, 'Gap filled successfully');
        }

        const firstKline = await db.query.klines.findFirst({
          where: and(
            eq(klines.symbol, gap.symbol),
            eq(klines.interval, gap.interval),
            eq(klines.marketType, gap.marketType)
          ),
          orderBy: [asc(klines.openTime)],
        });

        if (firstKline) {
          await db
            .insert(pairMaintenanceLog)
            .values({
              symbol: gap.symbol,
              interval: gap.interval,
              marketType: gap.marketType,
              earliestKlineDate: firstKline.openTime,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [pairMaintenanceLog.symbol, pairMaintenanceLog.interval, pairMaintenanceLog.marketType],
              set: { earliestKlineDate: firstKline.openTime, updatedAt: new Date() },
            });
        }
      }

      return inserted;
    } catch (error) {
      logger.error({ gap, error }, 'Error filling gap');
      return 0;
    }
  }

  private async detectAndFixCorruptedKlines(pair: ActivePair, silent = false): Promise<{ corruptedFound: number; fixed: number }> {
    const intervalMs = getIntervalMilliseconds(pair.interval);
    const lookbackMs = CORRUPTION_CHECK_KLINES * intervalMs;
    const startTime = new Date(Date.now() - lookbackMs);
    const now = Date.now();

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

      const prevKline = i > 0 ? recentKlines[i - 1] ?? null : null;
      const nextKline = i < recentKlines.length - 1 ? recentKlines[i + 1] ?? null : null;

      const corruption = KlineValidator.isKlineCorrupted(kline);
      if (corruption) {
        corruptedKlines.push({ kline, reason: corruption.reason });
        continue;
      }

      const staleCorruption = KlineValidator.isKlineStaleCorrupted(kline, prevKline, nextKline);
      if (staleCorruption) {
        corruptedKlines.push({ kline, reason: staleCorruption.reason });
        continue;
      }

      const spikeCorruption = KlineValidator.isKlineSpikeCorrupted(kline, prevKline, nextKline);
      if (spikeCorruption) {
        corruptedKlines.push({ kline, reason: spikeCorruption.reason });
      }
    }

    const closedKlines = recentKlines.filter((k) => {
      const closeTime = k.closeTime.getTime();
      return now >= closeTime + 2000;
    });

    const recentClosedKlines = closedKlines.slice(-API_VALIDATION_RECENT_COUNT);

    if (recentClosedKlines.length > 0) {
      const klinesToValidate = recentClosedKlines.filter(
        (k) => !corruptedKlines.some((c) => c.kline.openTime.getTime() === k.openTime.getTime())
      );

      if (klinesToValidate.length > 0) {
        const sortedForBatch = [...klinesToValidate].sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
        const firstKline = sortedForBatch[0];
        const lastKline = sortedForBatch[sortedForBatch.length - 1];

        if (firstKline && lastKline) {
          const apiKlinesMap = await KlineValidator.fetchBinanceKlinesBatch(
            pair.symbol,
            pair.interval,
            firstKline.openTime.getTime(),
            lastKline.openTime.getTime(),
            pair.marketType
          );

          const TOLERANCE = 0.001;
          const VOLUME_TOLERANCE = 0.9;

          for (const kline of klinesToValidate) {
            const apiKline = apiKlinesMap.get(kline.openTime.getTime());
            if (!apiKline) continue;

            const dbOHLC = {
              open: parseFloat(kline.open),
              high: parseFloat(kline.high),
              low: parseFloat(kline.low),
              close: parseFloat(kline.close),
              volume: parseFloat(kline.volume),
            };

            const apiOHLC = {
              open: parseFloat(apiKline.open),
              high: parseFloat(apiKline.high),
              low: parseFloat(apiKline.low),
              close: parseFloat(apiKline.close),
              volume: parseFloat(apiKline.volume),
            };

            const mismatchFields: string[] = [];
            if (apiOHLC.volume > 0 && dbOHLC.volume < apiOHLC.volume * VOLUME_TOLERANCE) mismatchFields.push('volume');
            if (apiOHLC.open > 0 && Math.abs(dbOHLC.open - apiOHLC.open) / apiOHLC.open > TOLERANCE) mismatchFields.push('open');
            if (apiOHLC.high > 0 && Math.abs(dbOHLC.high - apiOHLC.high) / apiOHLC.high > TOLERANCE) mismatchFields.push('high');
            if (apiOHLC.low > 0 && Math.abs(dbOHLC.low - apiOHLC.low) / apiOHLC.low > TOLERANCE) mismatchFields.push('low');
            if (apiOHLC.close > 0 && Math.abs(dbOHLC.close - apiOHLC.close) / apiOHLC.close > TOLERANCE) mismatchFields.push('close');

            if (mismatchFields.length > 0) {
              const mismatchDetails = mismatchFields
                .map((f) => `${f}: ${dbOHLC[f as keyof typeof dbOHLC]} vs ${apiOHLC[f as keyof typeof apiOHLC]}`)
                .join(', ');
              corruptedKlines.push({ kline, reason: `API validation mismatch: ${mismatchDetails}` });
            }
          }
        }
      }
    }

    if (corruptedKlines.length === 0) return { corruptedFound: 0, fixed: 0 };

    let fixed = 0;

    const sortedCorrupted = [...corruptedKlines].sort((a, b) => a.kline.openTime.getTime() - b.kline.openTime.getTime());
    const firstCorrupted = sortedCorrupted[0];
    const lastCorrupted = sortedCorrupted[sortedCorrupted.length - 1];

    if (firstCorrupted && lastCorrupted) {
      const fixKlinesMap = await KlineValidator.fetchBinanceKlinesBatch(
        pair.symbol,
        pair.interval,
        firstCorrupted.kline.openTime.getTime(),
        lastCorrupted.kline.openTime.getTime(),
        pair.marketType
      );

      for (const { kline } of corruptedKlines) {
        const binanceKline = fixKlinesMap.get(kline.openTime.getTime());
        if (!binanceKline) continue;

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

    if (!silent && fixed > 0) {
      logger.info(
        { symbol: pair.symbol, interval: pair.interval, marketType: pair.marketType, fixed, total: corruptedKlines.length },
        'Fixed corrupted klines (batch)'
      );
    }

    return { corruptedFound: corruptedKlines.length, fixed };
  }

  async forceCheckSymbol(symbol: string, interval: Interval, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<{ gapsFilled: number; corruptedFixed: number }> {
    const pair: ActivePair = { symbol, interval, marketType };

    const gaps = await this.detectGaps(pair);
    let gapsFilled = 0;

    const GAP_BATCH_SIZE = 3;
    for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
      const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
      const results = await Promise.all(batch.map(gap => this.fillGap(gap).catch(() => 0)));
      gapsFilled += results.reduce((sum, n) => sum + n, 0);
    }

    const { fixed: corruptedFixed } = await this.detectAndFixCorruptedKlines(pair, true);


    await this.updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });
    await this.updateMaintenanceLog(pair, { corruptedFixed, checkType: 'corruption' });

    return { gapsFilled, corruptedFixed };
  }

  async checkAfterReconnection(): Promise<{ checked: number; fixed: number }> {
    const startTime = new Date();
    const activePairs = await this.getActivePairs();
    let totalChecked = 0;
    let totalFixed = 0;
    const mismatches: OHLCMismatchEntry[] = [];
    const API_DELAY_MS = 100;

    for (const pair of activePairs) {
      const intervalMs = getIntervalMilliseconds(pair.interval);
      const lookbackMs = 1000 * intervalMs;
      const lookbackStart = new Date(Date.now() - lookbackMs);

      const recentKlines = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, pair.symbol),
          eq(klines.interval, pair.interval),
          eq(klines.marketType, pair.marketType),
          gte(klines.openTime, lookbackStart)
        ),
        orderBy: [asc(klines.openTime)],
      });

      if (recentKlines.length === 0) continue;

      totalChecked += recentKlines.length;

      const sortedKlines = [...recentKlines].sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
      const firstKline = sortedKlines[0];
      const lastKline = sortedKlines[sortedKlines.length - 1];
      if (!firstKline || !lastKline) continue;
      const batchStartTime = firstKline.openTime.getTime();
      const batchEndTime = lastKline.openTime.getTime();

      const apiKlinesMap = await KlineValidator.fetchBinanceKlinesBatch(
        pair.symbol,
        pair.interval,
        batchStartTime,
        batchEndTime,
        pair.marketType
      );

      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));

      for (const kline of recentKlines) {
        const openTimeMs = kline.openTime.getTime();
        const apiKline = apiKlinesMap.get(openTimeMs);

        if (!apiKline) continue;

        const dbOHLC = {
          open: parseFloat(kline.open),
          high: parseFloat(kline.high),
          low: parseFloat(kline.low),
          close: parseFloat(kline.close),
          volume: parseFloat(kline.volume),
        };

        const apiOHLC = {
          open: parseFloat(apiKline.open),
          high: parseFloat(apiKline.high),
          low: parseFloat(apiKline.low),
          close: parseFloat(apiKline.close),
          volume: parseFloat(apiKline.volume),
        };

        const mismatchFields: Array<'open' | 'high' | 'low' | 'close' | 'volume'> = [];
        const TOLERANCE = 0.001;
        const VOLUME_TOLERANCE = 0.9;

        if (apiOHLC.volume > 0 && dbOHLC.volume < apiOHLC.volume * VOLUME_TOLERANCE) mismatchFields.push('volume');
        if (apiOHLC.open > 0 && Math.abs(dbOHLC.open - apiOHLC.open) / apiOHLC.open > TOLERANCE) mismatchFields.push('open');
        if (apiOHLC.high > 0 && Math.abs(dbOHLC.high - apiOHLC.high) / apiOHLC.high > TOLERANCE) mismatchFields.push('high');
        if (apiOHLC.low > 0 && Math.abs(dbOHLC.low - apiOHLC.low) / apiOHLC.low > TOLERANCE) mismatchFields.push('low');
        if (apiOHLC.close > 0 && Math.abs(dbOHLC.close - apiOHLC.close) / apiOHLC.close > TOLERANCE) mismatchFields.push('close');

        if (mismatchFields.length > 0) {
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

          for (const field of mismatchFields) {
            mismatches.push({
              symbol: pair.symbol,
              interval: pair.interval,
              marketType: pair.marketType,
              openTime: kline.openTime,
              field,
              dbValue: dbOHLC[field],
              apiValue: apiOHLC[field],
              diffPercent: apiOHLC[field] > 0 ? Math.abs(dbOHLC[field] - apiOHLC[field]) / apiOHLC[field] * 100 : 0,
              fixed: true,
            });
          }
        }
      }
    }

    const result: ReconnectionValidationResult = {
      startTime,
      endTime: new Date(),
      pairsChecked: activePairs.length,
      klinesChecked: totalChecked,
      totalMismatches: mismatches.length,
      totalFixed,
      mismatches,
    };

    outputReconnectionValidationResults(result);

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
