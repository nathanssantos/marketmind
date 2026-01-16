import type { MarketType } from '@marketmind/types';
import { createBinanceClientForPrices, createBinanceFuturesClientForPrices } from './binance-client';

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

interface SymbolKey {
  symbol: string;
  marketType: MarketType;
}

const DEFAULT_MAX_AGE_MS = 3000;

class InMemoryPriceCache {
  private prices: Map<string, PriceCacheEntry> = new Map();
  private readonly maxAgeMs: number;

  constructor(maxAgeMs: number = DEFAULT_MAX_AGE_MS) {
    this.maxAgeMs = maxAgeMs;
  }

  private getCacheKey(symbol: string, marketType: MarketType): string {
    return `${symbol}-${marketType}`;
  }

  updateFromWebSocket(symbol: string, marketType: MarketType, price: number): void {
    const key = this.getCacheKey(symbol, marketType);
    this.prices.set(key, { price, timestamp: Date.now() });
  }

  getPrice(symbol: string, marketType: MarketType): number | null {
    const key = this.getCacheKey(symbol, marketType);
    const entry = this.prices.get(key);
    if (!entry || Date.now() - entry.timestamp > this.maxAgeMs) {
      return null;
    }
    return entry.price;
  }

  async fetchPrice(symbol: string, marketType: MarketType): Promise<number | null> {
    const cached = this.getPrice(symbol, marketType);
    if (cached !== null) return cached;

    try {
      let price: number;
      if (marketType === 'FUTURES') {
        const client = createBinanceFuturesClientForPrices();
        const ticker = await client.getMarkPrice({ symbol });
        price = parseFloat(String(ticker.markPrice));
      } else {
        const client = createBinanceClientForPrices();
        const ticker = await client.getSymbolPriceTicker({ symbol });
        price = parseFloat(String(Array.isArray(ticker) ? ticker[0]?.price : ticker.price));
      }

      if (price > 0) {
        this.updateFromWebSocket(symbol, marketType, price);
        return price;
      }
      return null;
    } catch {
      return null;
    }
  }

  async batchFetch(symbols: SymbolKey[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const toFetch: SymbolKey[] = [];

    for (const s of symbols) {
      const cached = this.getPrice(s.symbol, s.marketType);
      if (cached !== null) {
        result.set(this.getCacheKey(s.symbol, s.marketType), cached);
      } else {
        toFetch.push(s);
      }
    }

    if (toFetch.length === 0) return result;

    const spotSymbols = toFetch.filter(s => s.marketType === 'SPOT').map(s => s.symbol);
    const futuresSymbols = toFetch.filter(s => s.marketType === 'FUTURES').map(s => s.symbol);

    const fetchPromises: Promise<void>[] = [];

    if (spotSymbols.length > 0) {
      fetchPromises.push(
        (async () => {
          try {
            const client = createBinanceClientForPrices();
            const tickers = await client.getSymbolPriceTicker();
            const pricesMap = new Map(
              (Array.isArray(tickers) ? tickers : [tickers]).map(t => [t.symbol, parseFloat(String(t.price))])
            );
            for (const symbol of spotSymbols) {
              const price = pricesMap.get(symbol);
              if (price && price > 0) {
                this.updateFromWebSocket(symbol, 'SPOT', price);
                result.set(this.getCacheKey(symbol, 'SPOT'), price);
              }
            }
          } catch {
            for (const symbol of spotSymbols) {
              const price = await this.fetchPrice(symbol, 'SPOT');
              if (price !== null) {
                result.set(this.getCacheKey(symbol, 'SPOT'), price);
              }
            }
          }
        })()
      );
    }

    if (futuresSymbols.length > 0) {
      fetchPromises.push(
        (async () => {
          try {
            const client = createBinanceFuturesClientForPrices();
            const markPrices = await client.getMarkPrice();
            const priceMap = new Map(
              (Array.isArray(markPrices) ? markPrices : [markPrices]).map(p => [p.symbol, parseFloat(String(p.markPrice))])
            );
            for (const symbol of futuresSymbols) {
              const price = priceMap.get(symbol);
              if (price && price > 0) {
                this.updateFromWebSocket(symbol, 'FUTURES', price);
                result.set(this.getCacheKey(symbol, 'FUTURES'), price);
              }
            }
          } catch {
            for (const symbol of futuresSymbols) {
              const price = await this.fetchPrice(symbol, 'FUTURES');
              if (price !== null) {
                result.set(this.getCacheKey(symbol, 'FUTURES'), price);
              }
            }
          }
        })()
      );
    }

    await Promise.all(fetchPromises);
    return result;
  }

  prewarm(symbols: SymbolKey[]): Promise<Map<string, number>> {
    return this.batchFetch(symbols);
  }

  clear(): void {
    this.prices.clear();
  }

  getStats(): { size: number; oldestEntry: number | null } {
    let oldest: number | null = null;
    for (const entry of this.prices.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }
    return { size: this.prices.size, oldestEntry: oldest };
  }
}

export const priceCache = new InMemoryPriceCache();
