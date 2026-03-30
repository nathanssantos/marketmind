import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from '@marketmind/types';
import { LIQUIDITY_HEATMAP } from '../constants/heatmap';
import { and, eq, gte } from 'drizzle-orm';
import type { BinanceDepthStreamService } from './binance-depth-stream';
import { db } from '../db/client';
import { liquidityHeatmapBuckets } from '../db/schema';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

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
  unpersisted: LiquidityHeatmapBucket[];
  loadPromise: Promise<void> | null;
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
  Math.floor(timestamp / LIQUIDITY_HEATMAP.BUCKET_DURATION_MS) * LIQUIDITY_HEATMAP.BUCKET_DURATION_MS;

const maxOfRecord = (rec: Record<string, number>): number => {
  let max = 0;
  for (const key in rec) {
    const v = rec[key]!;
    if (v > max) max = v;
  }
  return max;
};

const accumulateIntoBins = (source: Map<number, number>, target: Map<number, number>, binSize: number): void => {
  for (const [price, qty] of source) {
    const binned = Math.round(price / binSize) * binSize;
    target.set(binned, (target.get(binned) ?? 0) + qty);
  }
};

const mapToRecord = (map: Map<number, number>): Record<string, number> => {
  const rec: Record<string, number> = {};
  for (const [k, v] of map) rec[k] = v;
  return rec;
};

export class LiquidityHeatmapAggregator {
  private symbols = new Map<string, SymbolState>();
  private allowedSymbols = new Set<string>();
  private depthService: BinanceDepthStreamService | null = null;
  private unsubscribeDepth: (() => void) | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  start(depthService: BinanceDepthStreamService, initialSymbols: string[]): void {
    this.depthService = depthService;
    for (const s of initialSymbols) this.allowedSymbols.add(s.toUpperCase());

    this.sampleTimer = setInterval(() => this.sampleAll(), LIQUIDITY_HEATMAP.SAMPLE_INTERVAL_MS);
    logger.info({ symbols: [...this.allowedSymbols] }, 'Liquidity heatmap aggregator started');
  }

  addSymbol(symbol: string): void {
    const s = symbol.toUpperCase();
    this.allowedSymbols.add(s);
    if (this.depthService) this.depthService.subscribe(s.toLowerCase());
  }

  removeSymbol(symbol: string): void {
    const s = symbol.toUpperCase();
    this.allowedSymbols.delete(s);
    const state = this.symbols.get(s);
    if (state) {
      if (state.currentBucket) this.finalizeBucket(state);
      if (state.unpersisted.length > 0) void this.persistBatch(s, state);
      this.symbols.delete(s);
    }
  }

  getActiveSymbols(): string[] {
    return [...this.allowedSymbols];
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
    void this.flushAllToDB();
    this.symbols.clear();
    this.depthService = null;
    logger.info('Liquidity heatmap aggregator stopped');
  }

  async getSnapshot(symbol: string): Promise<LiquidityHeatmapSnapshot | null> {
    const state = this.symbols.get(symbol);
    if (!state) return null;

    if (state.loadPromise) await state.loadPromise;

    if (state.buckets.length === 0) return null;

    const maxBuckets = LIQUIDITY_HEATMAP.SNAPSHOT_MAX_BUCKETS;
    const buckets = state.buckets.length > maxBuckets
      ? state.buckets.slice(state.buckets.length - maxBuckets)
      : state.buckets;

    return {
      symbol,
      priceBinSize: state.priceBinSize,
      buckets,
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
        unpersisted: [],
        loadPromise: null,
      };
      this.symbols.set(symbol, state);
      state.loadPromise = this.loadFromDB(symbol, state).finally(() => { state!.loadPromise = null; });
    }
    return state;
  }

  private async loadFromDB(symbol: string, state: SymbolState): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - LIQUIDITY_HEATMAP.MAX_DB_AGE_MS);
      const rows = await db
        .select()
        .from(liquidityHeatmapBuckets)
        .where(and(
          eq(liquidityHeatmapBuckets.symbol, symbol),
          gte(liquidityHeatmapBuckets.bucketTime, cutoff)
        ))
        .orderBy(liquidityHeatmapBuckets.bucketTime);

      if (rows.length === 0) return;

      const existingTimes = new Set(state.buckets.map(b => b.time));
      let max = state.maxQuantity;

      for (const row of rows) {
        const time = row.bucketTime.getTime();
        if (existingTimes.has(time)) continue;

        const bids: Record<string, number> = JSON.parse(row.bids);
        const asks: Record<string, number> = JSON.parse(row.asks);
        state.buckets.push({ time, bids, asks });

        const rowMax = parseFloat(row.maxQuantity);
        if (rowMax > max) max = rowMax;
      }

      state.buckets.sort((a, b) => a.time - b.time);
      if (state.buckets.length > LIQUIDITY_HEATMAP.MAX_BUCKETS_MEMORY) {
        state.buckets.splice(0, state.buckets.length - LIQUIDITY_HEATMAP.MAX_BUCKETS_MEMORY);
      }
      state.maxQuantity = max;

      if (rows.length > 0 && state.priceBinSize === 0) {
        state.priceBinSize = parseFloat(rows[0]!.priceBinSize);
      }

      logger.info({ symbol, loaded: rows.length }, 'Loaded heatmap history from DB');
    } catch (err) {
      logger.error({ error: err, symbol }, 'Failed to load heatmap from DB');
    }
  }

  private sampleAll(): void {
    if (!this.depthService) return;
    const now = Date.now();
    const wsService = getWebSocketService();

    for (const symbol of this.allowedSymbols) {
      const fullBook = this.depthService.getFullBook(symbol);
      if (!fullBook || (fullBook.bids.size === 0 && fullBook.asks.size === 0)) continue;

      const midPrice = this.estimateMidPrice(fullBook.bids, fullBook.asks);
      if (midPrice <= 0) continue;

      const state = this.getOrCreateState(symbol, midPrice);
      if (state.loadPromise) continue;

      const bucketTime = alignToBucket(now);

      if (!state.currentBucket || state.currentBucket.time !== bucketTime) {
        if (state.currentBucket) {
          const evicted = this.finalizeBucket(state);
          const lastBucket = state.buckets[state.buckets.length - 1];
          if (lastBucket && wsService) {
            wsService.emitLiquidityHeatmapBucket(symbol, lastBucket, state.priceBinSize, state.maxQuantity);
          }
          if (evicted) this.recomputeMaxQuantity(state);
          if (state.unpersisted.length >= LIQUIDITY_HEATMAP.PERSIST_BATCH_SIZE) {
            void this.persistBatch(symbol, state);
          }
        }
        state.currentBucket = { time: bucketTime, bidAcc: new Map(), askAcc: new Map() };
      }

      accumulateIntoBins(fullBook.bids, state.currentBucket.bidAcc, state.priceBinSize);
      accumulateIntoBins(fullBook.asks, state.currentBucket.askAcc, state.priceBinSize);

      if (wsService) {
        const liveBucket: LiquidityHeatmapBucket = {
          time: state.currentBucket.time,
          bids: mapToRecord(state.currentBucket.bidAcc),
          asks: mapToRecord(state.currentBucket.askAcc),
        };
        wsService.emitLiquidityHeatmapBucket(symbol, liveBucket, state.priceBinSize, state.maxQuantity);
      }
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

  private finalizeBucket(state: SymbolState): boolean {
    const current = state.currentBucket;
    if (!current || (current.bidAcc.size === 0 && current.askAcc.size === 0)) return false;

    const bids = mapToRecord(current.bidAcc);
    const asks = mapToRecord(current.askAcc);
    const bucketMax = Math.max(maxOfRecord(bids), maxOfRecord(asks));

    const bucket: LiquidityHeatmapBucket = { time: current.time, bids, asks };
    state.buckets.push(bucket);
    state.unpersisted.push(bucket);

    let evicted = false;
    if (state.buckets.length > LIQUIDITY_HEATMAP.MAX_BUCKETS_MEMORY) {
      state.buckets.splice(0, state.buckets.length - LIQUIDITY_HEATMAP.MAX_BUCKETS_MEMORY);
      evicted = true;
    }

    if (bucketMax > state.maxQuantity) state.maxQuantity = bucketMax;

    return evicted;
  }

  private recomputeMaxQuantity(state: SymbolState): void {
    let max = 0;
    for (const bucket of state.buckets) {
      const bMax = maxOfRecord(bucket.bids);
      const aMax = maxOfRecord(bucket.asks);
      const m = bMax > aMax ? bMax : aMax;
      if (m > max) max = m;
    }
    state.maxQuantity = max;
  }

  private async persistBatch(symbol: string, state: SymbolState): Promise<void> {
    const batch = state.unpersisted.splice(0, state.unpersisted.length);
    if (batch.length === 0) return;

    try {
      const values = batch.map(b => ({
        symbol,
        bucketTime: new Date(b.time),
        priceBinSize: String(state.priceBinSize),
        bids: JSON.stringify(b.bids),
        asks: JSON.stringify(b.asks),
        maxQuantity: String(Math.max(maxOfRecord(b.bids), maxOfRecord(b.asks))),
      }));

      await db.insert(liquidityHeatmapBuckets).values(values).onConflictDoNothing();
      logger.trace({ symbol, count: batch.length }, 'Persisted heatmap buckets');
    } catch (err) {
      logger.error({ error: err, symbol }, 'Failed to persist heatmap buckets');
      if (state.unpersisted.length < LIQUIDITY_HEATMAP.MAX_BUCKETS_MEMORY) {
        state.unpersisted.push(...batch);
      }
    }
  }

  private async flushAllToDB(): Promise<void> {
    for (const [symbol, state] of this.symbols) {
      if (state.currentBucket) this.finalizeBucket(state);
      if (state.unpersisted.length > 0) await this.persistBatch(symbol, state);
    }
  }
}

export const liquidityHeatmapAggregator = new LiquidityHeatmapAggregator();
