import type { MarketType } from '@marketmind/types';
import { USDMClient, MainClient } from 'binance';
import { INDICATOR_CACHE, ORDER_BOOK } from '../constants';
import { KeyedCache } from '../utils/cache';
import { logger, serializeError } from './logger';

export interface LiquidityWall {
  price: number;
  quantity: number;
  totalValue: number;
  percentFromPrice: number;
}

export interface OrderBookAnalysis {
  symbol: string;
  imbalanceRatio: number;
  bidWalls: LiquidityWall[];
  askWalls: LiquidityWall[];
  bidVolume: number;
  askVolume: number;
  spread: number;
  spreadPercent: number;
  midPrice: number;
  depth: number;
  pressure: 'BUYING' | 'SELLING' | 'NEUTRAL';
  timestamp: Date;
}

export interface OrderBookConfig {
  wallThresholdMultiplier?: number;
  depthLimit?: number;
  imbalanceNeutralThreshold?: number;
}

const DEFAULT_CONFIG: Required<OrderBookConfig> = {
  wallThresholdMultiplier: ORDER_BOOK.WALL_THRESHOLD_MULTIPLIER,
  depthLimit: ORDER_BOOK.DEFAULT_DEPTH_LIMIT,
  imbalanceNeutralThreshold: ORDER_BOOK.IMBALANCE_NEUTRAL_THRESHOLD,
};

interface OrderBookLevel {
  price: number;
  quantity: number;
}

export class OrderBookAnalyzerService {
  private futuresClient: USDMClient;
  private spotClient: MainClient;
  private cache = new KeyedCache<OrderBookAnalysis>(INDICATOR_CACHE.ORDER_BOOK_TTL);

  constructor() {
    this.futuresClient = new USDMClient({ disableTimeSync: true });
    this.spotClient = new MainClient({ disableTimeSync: true });
  }

  async getOrderBookAnalysis(
    symbol: string,
    marketType: MarketType = 'FUTURES',
    config: OrderBookConfig = {}
  ): Promise<OrderBookAnalysis> {
    const cacheKey = `${symbol}:${marketType}`;
    const cached = this.cache.get(cacheKey);

    if (cached) return cached;

    const result = await this.analyzeOrderBook(symbol, marketType, config);
    this.cache.set(cacheKey, result);
    return result;
  }

  private async analyzeOrderBook(
    symbol: string,
    marketType: MarketType,
    config: OrderBookConfig
  ): Promise<OrderBookAnalysis> {
    const { wallThresholdMultiplier, depthLimit, imbalanceNeutralThreshold } = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    try {
      const orderBook = await this.fetchOrderBook(symbol, marketType, depthLimit);

      if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        return this.createEmptyResult(symbol);
      }

      const bids: OrderBookLevel[] = orderBook.bids.map((b) => ({
        price: parseFloat(b[0] ?? '0'),
        quantity: parseFloat(b[1] ?? '0'),
      }));

      const asks: OrderBookLevel[] = orderBook.asks.map((a) => ({
        price: parseFloat(a[0] ?? '0'),
        quantity: parseFloat(a[1] ?? '0'),
      }));

      const bestBid = bids[0]!.price;
      const bestAsk = asks[0]!.price;
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const spreadPercent = (spread / midPrice) * 100;

      const bidVolume = bids.reduce((sum, b) => sum + b.quantity * b.price, 0);
      const askVolume = asks.reduce((sum, a) => sum + a.quantity * a.price, 0);
      const totalVolume = bidVolume + askVolume;

      const imbalanceRatio = totalVolume > 0 ? bidVolume / askVolume : 1;

      const avgBidQuantity = bids.reduce((sum, b) => sum + b.quantity, 0) / bids.length;
      const avgAskQuantity = asks.reduce((sum, a) => sum + a.quantity, 0) / asks.length;

      const bidWalls = this.detectWalls(bids, avgBidQuantity, wallThresholdMultiplier, midPrice);
      const askWalls = this.detectWalls(asks, avgAskQuantity, wallThresholdMultiplier, midPrice);

      let pressure: 'BUYING' | 'SELLING' | 'NEUTRAL' = 'NEUTRAL';
      const imbalanceDiff = Math.abs(imbalanceRatio - 1);

      if (imbalanceDiff > imbalanceNeutralThreshold) {
        pressure = imbalanceRatio > 1 ? 'BUYING' : 'SELLING';
      }

      const analysis: OrderBookAnalysis = {
        symbol,
        imbalanceRatio,
        bidWalls,
        askWalls,
        bidVolume,
        askVolume,
        spread,
        spreadPercent,
        midPrice,
        depth: depthLimit,
        pressure,
        timestamp: new Date(),
      };

      logger.trace({
        symbol,
        imbalanceRatio: imbalanceRatio.toFixed(2),
        pressure,
        bidWalls: bidWalls.length,
        askWalls: askWalls.length,
        spreadPercent: spreadPercent.toFixed(4),
      }, '[OrderBook] Analysis complete');

      return analysis;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, '[OrderBook] Error analyzing order book');
      return this.createEmptyResult(symbol);
    }
  }

  private async fetchOrderBook(
    symbol: string,
    marketType: MarketType,
    limit: number
  ): Promise<{ bids: string[][]; asks: string[][] } | null> {
    const validLimit = this.getValidLimit(limit);
    try {
      if (marketType === 'FUTURES') {
        const response = await this.futuresClient.getOrderBook({ symbol, limit: validLimit });
        return {
          bids: response.bids.map((b) => [String(b[0]), String(b[1])]),
          asks: response.asks.map((a) => [String(a[0]), String(a[1])]),
        };
      } else {
        const response = await this.spotClient.getOrderBook({ symbol, limit: validLimit });
        return {
          bids: response.bids.map((b) => [String(b[0]), String(b[1])]),
          asks: response.asks.map((a) => [String(a[0]), String(a[1])]),
        };
      }
    } catch (error) {
      logger.warn({ error: serializeError(error), symbol, marketType }, '[OrderBook] Failed to fetch order book');
      return null;
    }
  }

  private detectWalls(
    levels: OrderBookLevel[],
    avgQuantity: number,
    multiplier: number,
    midPrice: number
  ): LiquidityWall[] {
    const walls: LiquidityWall[] = [];
    const threshold = avgQuantity * multiplier;

    for (const level of levels) {
      if (level.quantity >= threshold) {
        const percentFromPrice = Math.abs((level.price - midPrice) / midPrice) * 100;
        walls.push({
          price: level.price,
          quantity: level.quantity,
          totalValue: level.price * level.quantity,
          percentFromPrice,
        });
      }
    }

    return walls.sort((a, b) => b.totalValue - a.totalValue).slice(0, ORDER_BOOK.MAX_WALLS_RETURNED);
  }

  private getValidLimit(limit: number): 5 | 10 | 20 | 50 | 100 | 500 | 1000 | 5000 {
    const validLimits = ORDER_BOOK.VALID_LIMITS;
    const closest = validLimits.reduce((prev, curr) =>
      Math.abs(curr - limit) < Math.abs(prev - limit) ? curr : prev
    );
    return closest;
  }

  private createEmptyResult(symbol: string): OrderBookAnalysis {
    return {
      symbol,
      imbalanceRatio: 1,
      bidWalls: [],
      askWalls: [],
      bidVolume: 0,
      askVolume: 0,
      spread: 0,
      spreadPercent: 0,
      midPrice: 0,
      depth: 0,
      pressure: 'NEUTRAL',
      timestamp: new Date(),
    };
  }

  async getBatchOrderBookAnalysis(
    symbols: string[],
    marketType: MarketType = 'FUTURES',
    config: OrderBookConfig = {}
  ): Promise<Map<string, OrderBookAnalysis>> {
    const results = new Map<string, OrderBookAnalysis>();

    const analyzeWithDelay = async (symbol: string, index: number) => {
      if (index > 0) {
        await new Promise((r) => setTimeout(r, ORDER_BOOK.BATCH_DELAY_MS));
      }
      const analysis = await this.getOrderBookAnalysis(symbol, marketType, config);
      results.set(symbol, analysis);
    };

    await Promise.all(symbols.map((symbol, index) => analyzeWithDelay(symbol, index)));

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheTTL(ttl: number): void {
    this.cache.setTTL(ttl);
  }
}

let orderBookAnalyzerService: OrderBookAnalyzerService | null = null;

export const getOrderBookAnalyzerService = (): OrderBookAnalyzerService => {
  orderBookAnalyzerService ??= new OrderBookAnalyzerService();
  return orderBookAnalyzerService;
};
