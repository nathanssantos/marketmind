import { and, asc, eq, gte } from 'drizzle-orm';
import { API_VALIDATION_RECENT_COUNT, CORRUPTION_CHECK_KLINES, MAINTENANCE_KLINES } from '../../constants';
import { db } from '../../db';
import { klines } from '../../db/schema';
import { getIntervalMilliseconds } from '../binance-historical';
import { KlineValidator } from '../kline-validator';
import { logger } from '../logger';
import type { ActivePair } from './types';

export const detectAndFixCorruptedKlines = async (pair: ActivePair, silent = false): Promise<{ corruptedFound: number; fixed: number }> => {
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
};

export const detectAndFixMisalignedKlines = async (pair: ActivePair): Promise<number> => {
  const NON_UNIFORM_INTERVALS = ['1w', '1M', '1y'];
  if (NON_UNIFORM_INTERVALS.includes(pair.interval)) return 0;

  const intervalMs = getIntervalMilliseconds(pair.interval);
  const lookbackMs = MAINTENANCE_KLINES * intervalMs;
  const startTime = new Date(Date.now() - lookbackMs);
  const ALIGNMENT_TOLERANCE_MS = 1000;

  const recentKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, pair.symbol),
      eq(klines.interval, pair.interval),
      eq(klines.marketType, pair.marketType),
      gte(klines.openTime, startTime),
    ),
    orderBy: [asc(klines.openTime)],
  });

  const misaligned = recentKlines.filter((kline) => {
    const openTimeMs = kline.openTime.getTime();
    const alignedTime = Math.round(openTimeMs / intervalMs) * intervalMs;
    return Math.abs(openTimeMs - alignedTime) > ALIGNMENT_TOLERANCE_MS;
  });

  if (misaligned.length === 0) return 0;

  let deleted = 0;
  for (const kline of misaligned) {
    try {
      await db.delete(klines).where(
        and(
          eq(klines.symbol, pair.symbol),
          eq(klines.interval, pair.interval),
          eq(klines.marketType, pair.marketType),
          eq(klines.openTime, kline.openTime)
        )
      );
      deleted++;
      logger.info({ symbol: pair.symbol, interval: pair.interval, openTime: kline.openTime.toISOString() }, '[KlineMaintenance] Deleted misaligned kline (temporal gap)');
    } catch (error) {
      logger.error({ kline: { openTime: kline.openTime }, error }, '[KlineMaintenance] Error deleting misaligned kline');
    }
  }

  return deleted;
};
