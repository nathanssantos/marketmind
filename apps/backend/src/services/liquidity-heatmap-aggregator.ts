import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from '@marketmind/types';
import type { BinanceDepthStreamService } from './binance-depth-stream';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

const BUCKET_DURATION_MS = 60_000;
const MAX_BUCKETS = 500;
const SAMPLE_INTERVAL_MS = 2_000;

interface CurrentBucket {
  time: number;
  bidAcc: Map<number, number>;
  askAcc: Map<number, number>;
}

interface SymbolState {
  priceBinSize: number;
  currentBucket: CurrentBucket | null;
  buckets: LiquidityHeatmapBucket[];
  maxQuantity: number;
}

const computePriceBinSize = (price: number): number => {
  if (price <= 0) return 0.01;
  if (price >= 10000) return 10;
  if (price >= 1000) return 1;
  if (price >= 100) return 0.1;
  if (price >= 10) return 0.01;
  if (price >= 1) return 0.001;
  return 0.0001;
};

const alignToBucket = (timestamp: number): number =>
  Math.floor(timestamp / BUCKET_DURATION_MS) * BUCKET_DURATION_MS;

export class LiquidityHeatmapAggregator {
  private symbols = new Map<string, SymbolState>();
  private depthService: BinanceDepthStreamService | null = null;
  private unsubscribeDepth: (() => void) | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  start(depthService: BinanceDepthStreamService): void {
    this.depthService = depthService;

    this.unsubscribeDepth = depthService.onDepthUpdate((update) => {
      const state = this.symbols.get(update.symbol);
      if (!state) {
        const refPrice = update.bids[0]?.price ?? update.asks[0]?.price ?? 0;
        if (refPrice > 0) this.getOrCreateState(update.symbol, refPrice);
      }
    });

    this.sampleTimer = setInterval(() => this.sampleAll(), SAMPLE_INTERVAL_MS);
    logger.info('Liquidity heatmap aggregator started');
  }

  stop(): void {
    if (this.unsubscribeDepth) {
      this.unsubscribeDepth();
      this.unsubscribeDepth = null;
    }
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    this.symbols.clear();
    this.depthService = null;
    logger.info('Liquidity heatmap aggregator stopped');
  }

  getSnapshot(symbol: string): LiquidityHeatmapSnapshot | null {
    const state = this.symbols.get(symbol);
    if (!state || state.buckets.length === 0) return null;

    return {
      symbol,
      priceBinSize: state.priceBinSize,
      buckets: state.buckets,
      maxQuantity: state.maxQuantity,
    };
  }

  private getOrCreateState(symbol: string, referencePrice: number): SymbolState {
    let state = this.symbols.get(symbol);
    if (!state) {
      state = {
        priceBinSize: computePriceBinSize(referencePrice),
        currentBucket: null,
        buckets: [],
        maxQuantity: 0,
      };
      this.symbols.set(symbol, state);
    }
    return state;
  }

  private sampleAll(): void {
    if (!this.depthService) return;
    const now = Date.now();
    const wsService = getWebSocketService();

    const depthSymbols = this.depthService.getSubscribedSymbols();
    for (const rawSymbol of depthSymbols) {
      const symbol = rawSymbol.toUpperCase();
      const fullBook = this.depthService.getFullBook(symbol);
      if (!fullBook) continue;

      const midPrice = this.estimateMidPrice(fullBook.bids, fullBook.asks);
      if (midPrice <= 0) continue;

      const state = this.getOrCreateState(symbol, midPrice);
      const bucketTime = alignToBucket(now);

      if (!state.currentBucket || state.currentBucket.time !== bucketTime) {
        if (state.currentBucket) {
          this.finalizeBucket(state);
          const lastBucket = state.buckets[state.buckets.length - 1];
          if (lastBucket && wsService) {
            wsService.emitLiquidityHeatmapBucket(symbol, lastBucket, state.priceBinSize, state.maxQuantity);
          }
        }
        state.currentBucket = { time: bucketTime, bidAcc: new Map(), askAcc: new Map() };
      }

      this.ingestFullBook(state, fullBook.bids, fullBook.asks);
    }
  }

  private estimateMidPrice(bids: Map<number, number>, asks: Map<number, number>): number {
    let bestBid = 0;
    let bestAsk = Infinity;
    for (const price of bids.keys()) if (price > bestBid) bestBid = price;
    for (const price of asks.keys()) if (price < bestAsk) bestAsk = price;
    if (bestBid === 0 && bestAsk === Infinity) return 0;
    if (bestBid === 0) return bestAsk;
    if (bestAsk === Infinity) return bestBid;
    return (bestBid + bestAsk) / 2;
  }

  private ingestFullBook(state: SymbolState, bids: Map<number, number>, asks: Map<number, number>): void {
    const bucket = state.currentBucket!;
    const binSize = state.priceBinSize;

    for (const [price, qty] of bids) {
      const binned = Math.round(price / binSize) * binSize;
      const existing = bucket.bidAcc.get(binned) ?? 0;
      bucket.bidAcc.set(binned, existing + qty);
    }

    for (const [price, qty] of asks) {
      const binned = Math.round(price / binSize) * binSize;
      const existing = bucket.askAcc.get(binned) ?? 0;
      bucket.askAcc.set(binned, existing + qty);
    }
  }

  private finalizeBucket(state: SymbolState): void {
    const current = state.currentBucket;
    if (!current || (current.bidAcc.size === 0 && current.askAcc.size === 0)) return;

    const bids: Record<number, number> = {};
    const asks: Record<number, number> = {};
    let bucketMax = 0;

    for (const [price, qty] of current.bidAcc) {
      bids[price] = qty;
      if (qty > bucketMax) bucketMax = qty;
    }

    for (const [price, qty] of current.askAcc) {
      asks[price] = qty;
      if (qty > bucketMax) bucketMax = qty;
    }

    const bucket: LiquidityHeatmapBucket = { time: current.time, bids, asks };
    state.buckets.push(bucket);

    if (state.buckets.length > MAX_BUCKETS) {
      state.buckets.splice(0, state.buckets.length - MAX_BUCKETS);
    }

    if (bucketMax > state.maxQuantity) {
      state.maxQuantity = bucketMax;
    } else {
      this.recomputeMaxQuantity(state);
    }
  }

  private recomputeMaxQuantity(state: SymbolState): void {
    let max = 0;
    for (const bucket of state.buckets) {
      for (const qty of Object.values(bucket.bids)) if (qty > max) max = qty;
      for (const qty of Object.values(bucket.asks)) if (qty > max) max = qty;
    }
    state.maxQuantity = max;
  }
}

export const liquidityHeatmapAggregator = new LiquidityHeatmapAggregator();
