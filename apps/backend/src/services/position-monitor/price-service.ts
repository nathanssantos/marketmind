import type { MarketType } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { priceCache as priceCacheTable } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { BinanceIpBannedError } from '../binance-api-cache';
import { createBinanceClientForPrices, createBinanceFuturesClientForPrices } from '../binance-client';
import { getBinanceFuturesDataService } from '../binance-futures-data';
import { logger } from '../logger';
import { priceCache } from '../price-cache';

export const getCurrentPrice = async (symbol: string, marketType: MarketType = 'FUTURES'): Promise<number> => {
  try {
    const inMemoryCached = priceCache.getPrice(symbol, marketType);
    if (inMemoryCached !== null) return inMemoryCached;

    const cacheKey = marketType === 'FUTURES' ? `${symbol}_FUTURES` : symbol;

    const [cached] = await db
      .select()
      .from(priceCacheTable)
      .where(eq(priceCacheTable.symbol, cacheKey))
      .limit(1);

    const cacheAge = cached
      ? Date.now() - new Date(cached.timestamp).getTime()
      : Infinity;

    if (cached && cacheAge < 3000) {
      const price = parseFloat(cached.price);
      priceCache.updateFromWebSocket(symbol, marketType, price);
      return price;
    }

    let price: number;

    if (marketType === 'FUTURES') {
      const markPriceData = await getBinanceFuturesDataService().getMarkPrice(symbol);
      if (markPriceData) {
        price = markPriceData.markPrice;
      } else {
        const client = createBinanceFuturesClientForPrices();
        const ticker = await client.get24hrChangeStatistics({ symbol });
        price = parseFloat(String(ticker.lastPrice));
      }
    } else {
      const client = createBinanceClientForPrices();
      const ticker = await client.get24hrChangeStatistics({ symbol });
      price = parseFloat(String(ticker.lastPrice));
    }

    priceCache.updateFromWebSocket(symbol, marketType, price);

    await db
      .insert(priceCacheTable)
      .values({
        symbol: cacheKey,
        price: price.toString(),
        timestamp: new Date(),
      })
      .onConflictDoUpdate({
        target: priceCacheTable.symbol,
        set: {
          price: price.toString(),
          timestamp: new Date(),
          updatedAt: new Date(),
        },
      });

    return price;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) {
      logger.warn({ symbol }, '[PositionMonitor] Skipping price fetch - IP banned');
      throw error;
    }
    logger.error({
      symbol,
      marketType,
      error: serializeError(error),
    }, 'Failed to get current price');
    throw error;
  }
};

export const updatePrice = async (symbol: string, price: number): Promise<void> => {
  try {
    await db
      .insert(priceCacheTable)
      .values({
        symbol,
        price: price.toString(),
        timestamp: new Date(),
      })
      .onConflictDoUpdate({
        target: priceCacheTable.symbol,
        set: {
          price: price.toString(),
          timestamp: new Date(),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    logger.error({
      symbol,
      price,
      error: serializeError(error),
    }, 'Failed to update price cache');
  }
};

export const invalidatePriceCache = async (symbol?: string): Promise<void> => {
  try {
    if (symbol) {
      await db
        .update(priceCacheTable)
        .set({ timestamp: new Date(0) })
        .where(eq(priceCacheTable.symbol, symbol));
    } else {
      await db.update(priceCacheTable).set({ timestamp: new Date(0) });
    }
  } catch (error) {
    logger.error({
      symbol,
      error: serializeError(error),
    }, 'Failed to invalidate price cache');
  }
};
