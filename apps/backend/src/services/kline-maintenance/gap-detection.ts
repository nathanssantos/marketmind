import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { MAINTENANCE_KLINES } from '../../constants';
import { db } from '../../db';
import { klines, pairMaintenanceLog } from '../../db/schema';
import { fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI, getIntervalMilliseconds } from '../binance-historical';
import { logger, serializeError } from '../logger';
import type { ActivePair, GapInfo } from './types';

const MIN_GAP_SIZE_TO_FILL = 1;

export const detectGaps = async (pair: ActivePair): Promise<GapInfo[]> => {
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(pair.interval);
  const lookbackMs = MAINTENANCE_KLINES * intervalMs;

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
    if (knownEarliestDate) return [];
    return [
      {
        ...pair,
        gapStart: startTime,
        gapEnd: endTime,
        missingCandles: MAINTENANCE_KLINES,
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
};

export const fillGap = async (gap: GapInfo, silent = false): Promise<number> => {
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
};
