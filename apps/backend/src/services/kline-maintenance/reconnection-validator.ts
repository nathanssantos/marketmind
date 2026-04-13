import { and, asc, eq, gte } from 'drizzle-orm';
import type { OHLCMismatchEntry, ReconnectionValidationResult } from '@marketmind/logger';
import { db } from '../../db';
import { klines } from '../../db/schema';
import { getIntervalMilliseconds } from '../binance-historical';
import { KlineValidator } from '../kline-validator';
import { logger } from '../logger';
import { outputReconnectionValidationResults } from '../watcher-batch-logger';
import { detectGaps, fillGap } from './gap-detection';
import { updateMaintenanceLog } from './maintenance-log';
import type { ActivePair } from './types';

export const checkAfterReconnection = async (activePairs: ActivePair[]): Promise<{ checked: number; fixed: number }> => {
  const startTime = new Date();
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

  for (const pair of activePairs) {
    try {
      const gaps = await detectGaps(pair);
      for (let i = 0; i < gaps.length; i += 3) {
        const batch = gaps.slice(i, i + 3);
        const results = await Promise.all(batch.map(gap => fillGap(gap, true).catch(() => 0)));
        totalFixed += results.reduce((sum, n) => sum + n, 0);
      }
      if (gaps.length > 0) await updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });
    } catch (error) {
      logger.error({ pair, error }, '[checkAfterReconnection] Error filling gaps for pair');
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
};
