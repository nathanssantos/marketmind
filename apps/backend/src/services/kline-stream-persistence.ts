import type { Interval, MarketType } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines } from '../db/schema';
import { serializeError } from '../utils/errors';
import { binanceApiCache, binanceRateLimiter } from './binance-api-cache';
import { KlineValidator, compareOHLC } from './kline-validator';
import { logger } from './logger';
import type { KlineUpdate } from './binance-kline-stream';

export class ReconnectionGuard {
  private isInGracePeriod = false;
  private readonly GRACE_PERIOD_MS = 10 * 1000;

  onReconnect(marketType: MarketType): void {
    this.isInGracePeriod = true;

    logger.warn({ marketType }, 'WebSocket reconnected - entering grace period (10s)');

    setTimeout(() => {
      this.isInGracePeriod = false;
      logger.trace({ marketType }, 'Grace period ended - resuming normal kline persistence');

      void this.triggerPostReconnectionCheck();
    }, this.GRACE_PERIOD_MS);
  }

  shouldPersistKline(): boolean {
    return !this.isInGracePeriod;
  }

  private async triggerPostReconnectionCheck(): Promise<void> {
    const { getKlineMaintenance } = await import('./kline-maintenance');
    const maintenance = getKlineMaintenance();
    await maintenance.checkAfterReconnection();
  }
}

export const fetchKlineFromREST = async (
  symbol: string,
  interval: string,
  openTime: number,
  marketType: MarketType
): Promise<{
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
} | null> => {
  try {
    if (binanceApiCache.isBanned()) return null;
    if (binanceRateLimiter.isOverLimit()) return null;

    const baseUrl = marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

    binanceRateLimiter.recordRequest();
    const response = await fetch(`${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${openTime}&limit=1`);
    if (response.status === 418 || response.status === 429) {
      binanceApiCache.checkAndSetBan(await response.text());
      return null;
    }
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.length) return null;

    const k = data[0];
    const returnedOpenTime = k[0] as number;

    if (returnedOpenTime !== openTime) {
      logger.warn({
        symbol,
        interval,
        marketType,
        requestedTime: new Date(openTime).toISOString(),
        returnedTime: new Date(returnedOpenTime).toISOString(),
        diffMs: returnedOpenTime - openTime,
      }, 'REST API returned kline for different timestamp - rejecting to prevent data corruption');
      return null;
    }

    return {
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
};

export const parseKlineMessage = (data: unknown, marketType: MarketType): KlineUpdate | null => {
  if (typeof data !== 'object' || data === null) return null;

  const message = data as Record<string, unknown>;

  if (message['e'] !== 'kline' || typeof message['k'] !== 'object') return null;

  const klineData = message['k'] as Record<string, unknown>;

  return {
    symbol: klineData['s'] as string,
    interval: klineData['i'] as string,
    marketType,
    openTime: klineData['t'] as number,
    closeTime: klineData['T'] as number,
    open: klineData['o'] as string,
    high: klineData['h'] as string,
    low: klineData['l'] as string,
    close: klineData['c'] as string,
    volume: klineData['v'] as string,
    quoteVolume: klineData['q'] as string,
    trades: klineData['n'] as number,
    takerBuyBaseVolume: klineData['V'] as string,
    takerBuyQuoteVolume: klineData['Q'] as string,
    isClosed: klineData['x'] as boolean,
    timestamp: Date.now(),
  };
};

export const persistKline = async (
  update: KlineUpdate,
  reconnectionGuard: ReconnectionGuard,
  marketType: MarketType
): Promise<void> => {
  try {
    if (!update.isClosed) {
      logger.warn({
        symbol: update.symbol,
        interval: update.interval,
        openTime: new Date(update.openTime).toISOString(),
      }, `! CRITICAL: Attempted to persist an OPEN ${marketType === 'FUTURES' ? 'futures ' : ''}candle - This should NEVER happen!`);
      return;
    }

    if (!reconnectionGuard.shouldPersistKline()) {
      logger.trace({
        symbol: update.symbol,
        interval: update.interval,
        openTime: new Date(update.openTime).toISOString(),
      }, `Skipping ${marketType === 'FUTURES' ? 'FUTURES ' : ''}persistence during grace period`);
      return;
    }

    const openTime = new Date(update.openTime);
    const interval = update.interval as Interval;

    const existing = await db.query.klines.findFirst({
      where: and(
        eq(klines.symbol, update.symbol),
        eq(klines.interval, interval),
        eq(klines.marketType, marketType),
        eq(klines.openTime, openTime)
      ),
    });

    const restData = await fetchKlineFromREST(update.symbol, update.interval, update.openTime, marketType);

    let finalData = {
      open: update.open,
      high: update.high,
      low: update.low,
      close: update.close,
      volume: update.volume,
      closeTime: new Date(update.closeTime),
      quoteVolume: update.quoteVolume,
      trades: update.trades,
      takerBuyBaseVolume: update.takerBuyBaseVolume,
      takerBuyQuoteVolume: update.takerBuyQuoteVolume,
    };

    if (restData) {
      const comparison = compareOHLC(update, restData);

      if (comparison.hasMismatch) {
        logger.warn({
          symbol: update.symbol,
          interval: update.interval,
          openTime: openTime.toISOString(),
          mismatchFields: comparison.mismatchFields.join(', '),
          ws: comparison.ws,
          rest: comparison.rest,
        }, 'WebSocket data differs from REST API, using REST data');

        finalData = {
          open: restData.open,
          high: restData.high,
          low: restData.low,
          close: restData.close,
          volume: restData.volume,
          closeTime: new Date(restData.closeTime),
          quoteVolume: restData.quoteVolume,
          trades: restData.trades,
          takerBuyBaseVolume: restData.takerBuyBaseVolume,
          takerBuyQuoteVolume: restData.takerBuyQuoteVolume,
        };
      }
    } else {
      const suspiciousCheck = KlineValidator.isKlineDataSuspicious(update, existing ?? undefined);
      if (!suspiciousCheck.isValid) {
        logger.warn({
          symbol: update.symbol,
          interval: update.interval,
          openTime: openTime.toISOString(),
          wsVolume: update.volume,
          reason: suspiciousCheck.reason,
        }, `Suspicious ${marketType === 'FUTURES' ? 'futures ' : ''}kline data and REST API unavailable - SKIPPING save to prevent corruption`);
        return;
      }
    }

    const klineData = {
      symbol: update.symbol,
      interval,
      marketType,
      openTime,
      ...finalData,
    };

    if (existing) {
      await db
        .update(klines)
        .set(klineData)
        .where(
          and(
            eq(klines.symbol, update.symbol),
            eq(klines.interval, interval),
            eq(klines.marketType, marketType),
            eq(klines.openTime, openTime)
          )
        );
    } else {
      await db.insert(klines).values(klineData);
    }
  } catch (error) {
    logger.error({
      symbol: update.symbol,
      interval: update.interval,
      error: serializeError(error),
    }, `Error persisting ${marketType === 'FUTURES' ? 'futures ' : ''}kline to database`);
  }
};
