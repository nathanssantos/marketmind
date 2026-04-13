import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines, priceCache } from '../db/schema';
import { logger } from './logger';

export const fetchPriceFromApi = async (symbol: string, marketType: 'SPOT' | 'FUTURES'): Promise<number> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    if (marketType === 'FUTURES') {
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { markPrice: string };
      return parseFloat(data.markPrice);
    } else {
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { price: string };
      return parseFloat(data.price);
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getLastKlinePrice = async (symbol: string, marketType: 'SPOT' | 'FUTURES'): Promise<number | null> => {
  try {
    const lastKline = await db.query.klines.findFirst({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.marketType, marketType)
      ),
      orderBy: [desc(klines.openTime)],
    });

    if (lastKline) {
      const age = Date.now() - lastKline.openTime.getTime();
      const maxAge = 5 * 60 * 1000;
      if (age < maxAge) {
        return parseFloat(lastKline.close);
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const getCurrentPrice = async (symbol: string, marketType: 'SPOT' | 'FUTURES' = 'FUTURES'): Promise<number> => {
  const cacheKey = marketType === 'FUTURES' ? `${symbol}_FUTURES` : symbol;
  const maxRetries = 3;
  const retryDelayMs = 1000;

  const cached = await db.query.priceCache.findFirst({
    where: eq(priceCache.symbol, cacheKey),
  });

  if (cached) {
    const age = Date.now() - cached.timestamp.getTime();
    if (age < 60000) {
      return parseFloat(cached.price);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const price = await fetchPriceFromApi(symbol, marketType);

      await db.insert(priceCache)
        .values({
          symbol: cacheKey,
          price: price.toString(),
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCache.symbol,
          set: {
            price: price.toString(),
            timestamp: new Date(),
            updatedAt: new Date(),
          },
        });

      return price;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        { symbol, marketType, attempt, maxRetries, error: lastError.message },
        'Price fetch attempt failed, retrying...'
      );

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  const fallbackPrice = await getLastKlinePrice(symbol, marketType);
  if (fallbackPrice !== null) {
    logger.info(
      { symbol, marketType, fallbackPrice },
      'Using last kline close price as fallback'
    );
    return fallbackPrice;
  }

  if (cached) {
    logger.warn(
      { symbol, marketType, cachedPrice: cached.price, cacheAge: Date.now() - cached.timestamp.getTime() },
      'Using stale cached price as last resort fallback'
    );
    return parseFloat(cached.price);
  }

  logger.error(
    { symbol, marketType, error: lastError?.message },
    'Failed to fetch current price after all retries and fallbacks'
  );
  throw lastError ?? new Error('Failed to fetch price');
};
