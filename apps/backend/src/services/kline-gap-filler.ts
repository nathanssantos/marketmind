import type { Interval } from '@marketmind/types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { REQUIRED_KLINES, TIME_MS } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI, getIntervalMilliseconds } from './binance-historical';
import { logger } from './logger';

const GAP_CHECK_INTERVAL = 5 * TIME_MS.MINUTE;
const MIN_GAP_SIZE_TO_FILL = 1;
const CORRUPTION_CHECK_KLINES = 200;
const SPIKE_THRESHOLD_PERCENT = 0.15;
const MIN_VOLUME_THRESHOLD = 0.0001;
const VOLUME_ANOMALY_RATIO = 0.01;
const RANGE_ANOMALY_RATIO = 0.05;
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

interface CorruptedKline {
  openTime: Date;
  reason: string;
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

class KlineGapFiller {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.checkInterval) {
      return;
    }

    await this.checkAndFillGaps();

    this.checkInterval = setInterval(async () => {
      await this.checkAndFillGaps();
    }, GAP_CHECK_INTERVAL);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
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
          const gaps = await this.detectGaps(pair);

          if (gaps.length > 0) {
            logger.debug({ symbol: pair.symbol, interval: pair.interval, gaps: gaps.length }, 'Found gaps');

            for (const gap of gaps) {
              await this.fillGap(gap);
            }
          }

          const fixedCorrupted = await this.detectAndFixCorruptedKlines(pair);
          if (fixedCorrupted > 0) {
            logger.debug({ symbol: pair.symbol, interval: pair.interval, fixed: fixedCorrupted }, 'Fixed corrupted klines');
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
    const startTime = new Date(now - lookbackMs);
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
    logger.debug(
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

      logger.debug({ symbol: gap.symbol, interval: gap.interval, inserted }, 'Gap filled');
    } catch (error) {
      logger.error({ gap, error }, 'Error filling gap');
    }
  }

  private isKlineCorrupted(kline: typeof klines.$inferSelect): CorruptedKline | null {
    const open = parseFloat(kline.open);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const close = parseFloat(kline.close);
    const volume = parseFloat(kline.volume);

    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
      return { openTime: kline.openTime, reason: 'NaN values' };
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      return { openTime: kline.openTime, reason: 'Zero or negative prices' };
    }

    if (volume < MIN_VOLUME_THRESHOLD) {
      return { openTime: kline.openTime, reason: `Zero or negligible volume: ${volume}` };
    }

    if (low > high) {
      return { openTime: kline.openTime, reason: 'Low > High' };
    }

    if (open > high || open < low) {
      return { openTime: kline.openTime, reason: 'Open outside High/Low range' };
    }

    if (close > high || close < low) {
      return { openTime: kline.openTime, reason: 'Close outside High/Low range' };
    }

    if (open === high && high === low && low === close) {
      return { openTime: kline.openTime, reason: 'Flat candle (O=H=L=C) - likely corrupted' };
    }

    return null;
  }

  private isKlineSpikeCorrupted(
    kline: typeof klines.$inferSelect,
    prevKline: typeof klines.$inferSelect | null,
    nextKline: typeof klines.$inferSelect | null
  ): CorruptedKline | null {
    if (!prevKline && !nextKline) return null;

    const close = parseFloat(kline.close);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const volume = parseFloat(kline.volume);
    const range = high - low;

    const neighborPrices: number[] = [];
    const neighborVolumes: number[] = [];
    const neighborRanges: number[] = [];

    if (prevKline) {
      neighborPrices.push(parseFloat(prevKline.close), parseFloat(prevKline.high), parseFloat(prevKline.low));
      neighborVolumes.push(parseFloat(prevKline.volume));
      neighborRanges.push(parseFloat(prevKline.high) - parseFloat(prevKline.low));
    }
    if (nextKline) {
      neighborPrices.push(parseFloat(nextKline.close), parseFloat(nextKline.high), parseFloat(nextKline.low));
      neighborVolumes.push(parseFloat(nextKline.volume));
      neighborRanges.push(parseFloat(nextKline.high) - parseFloat(nextKline.low));
    }

    const avgNeighborVolume = neighborVolumes.reduce((a, b) => a + b, 0) / neighborVolumes.length;
    if (avgNeighborVolume > 0 && volume / avgNeighborVolume < VOLUME_ANOMALY_RATIO) {
      return { openTime: kline.openTime, reason: `Anomalous low volume: ${volume.toFixed(2)} vs avg ${avgNeighborVolume.toFixed(2)} (${((volume / avgNeighborVolume) * 100).toFixed(2)}%)` };
    }

    const avgNeighborRange = neighborRanges.reduce((a, b) => a + b, 0) / neighborRanges.length;
    if (avgNeighborRange > 0 && range / avgNeighborRange < RANGE_ANOMALY_RATIO) {
      return { openTime: kline.openTime, reason: `Anomalous small range: ${range.toFixed(2)} vs avg ${avgNeighborRange.toFixed(2)} (${((range / avgNeighborRange) * 100).toFixed(2)}%)` };
    }

    const avgNeighborPrice = neighborPrices.reduce((a, b) => a + b, 0) / neighborPrices.length;
    const maxNeighborHigh = Math.max(...neighborPrices);
    const minNeighborLow = Math.min(...neighborPrices);

    const closeDeviation = Math.abs(close - avgNeighborPrice) / avgNeighborPrice;
    if (closeDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `Close price spike: ${(closeDeviation * 100).toFixed(1)}% deviation` };
    }

    const highDeviation = (high - maxNeighborHigh) / maxNeighborHigh;
    if (highDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `High price spike: ${(highDeviation * 100).toFixed(1)}% above neighbors` };
    }

    const lowDeviation = (minNeighborLow - low) / minNeighborLow;
    if (lowDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `Low price spike: ${(lowDeviation * 100).toFixed(1)}% below neighbors` };
    }

    return null;
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

    let fixed = 0;

    for (let i = 0; i < recentKlines.length; i++) {
      const kline = recentKlines[i];
      if (!kline) continue;

      const prevKline = i > 0 ? recentKlines[i - 1] ?? null : null;
      const nextKline = i < recentKlines.length - 1 ? recentKlines[i + 1] ?? null : null;

      let corruption = this.isKlineCorrupted(kline);
      if (!corruption) {
        corruption = this.isKlineSpikeCorrupted(kline, prevKline, nextKline);
      }

      if (corruption) {
        logger.warn(
          { symbol: pair.symbol, interval: pair.interval, openTime: kline.openTime, reason: corruption.reason },
          'Corrupted kline detected'
        );

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

          logger.debug(
            { symbol: pair.symbol, interval: pair.interval, openTime: kline.openTime },
            'Fixed corrupted kline'
          );
          fixed++;
        }
      }
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

    return { gapsFilled, corruptedFixed };
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

