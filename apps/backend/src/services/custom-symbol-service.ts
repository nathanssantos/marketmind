import type { Interval, MarketType } from '@marketmind/types';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  customSymbolComponents,
  customSymbols,
  klines as klinesTable,
} from '../db/schema';
import {
  type CustomSymbolState,
  KLINE_INTERVALS,
  computeIndexPrice,
  computeWeights,
  fetchBinancePrice,
  fetchMarketCaps,
  mapDbComponentToState,
  mapDbSymbolToState,
} from './custom-symbol-helpers';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

export { computeWeights, fetchBinancePrice, fetchMarketCaps } from './custom-symbol-helpers';

class CustomSymbolService {
  private definitions = new Map<string, CustomSymbolState>();
  private customSymbolSet = new Set<string>();
  private priceObserverRegistered = false;

  async start(): Promise<void> {
    await this.seedPolitifi();
    await this.loadFromDb();
    await this.initializeBasePrices();
    await this.rebalanceIfNeeded();
    await this.subscribeToComponentStreams();
    void this.backfillAllActiveSymbols();
    logger.info({ symbolCount: this.definitions.size }, 'Custom symbol service started');
  }

  isCustomSymbolSync(symbol: string): boolean {
    return this.customSymbolSet.has(symbol.toUpperCase());
  }

  getDefinitions(): CustomSymbolState[] {
    return Array.from(this.definitions.values());
  }

  getDefinition(symbol: string): CustomSymbolState | undefined {
    return this.definitions.get(symbol.toUpperCase());
  }

  async hotLoad(symbol: string): Promise<void> {
    const cs = await db.query.customSymbols.findFirst({
      where: and(eq(customSymbols.symbol, symbol.toUpperCase()), eq(customSymbols.isActive, true)),
    });
    if (!cs) return;

    const components = await db.query.customSymbolComponents.findMany({
      where: and(eq(customSymbolComponents.customSymbolId, cs.id), eq(customSymbolComponents.isActive, true)),
    });

    const state = mapDbSymbolToState(cs, components.map(mapDbComponentToState));
    this.definitions.set(state.symbol, state);
    this.customSymbolSet.add(state.symbol);
    await this.initializeBasePricesForState(state);
  }

  async remove(symbol: string): Promise<void> {
    this.definitions.delete(symbol.toUpperCase());
    this.customSymbolSet.delete(symbol.toUpperCase());
  }

  private async loadFromDb(): Promise<void> {
    const allSymbols = await db.query.customSymbols.findMany({
      where: eq(customSymbols.isActive, true),
    });

    for (const cs of allSymbols) {
      const components = await db.query.customSymbolComponents.findMany({
        where: and(
          eq(customSymbolComponents.customSymbolId, cs.id),
          eq(customSymbolComponents.isActive, true),
        ),
      });

      const state = mapDbSymbolToState(cs, components.map(mapDbComponentToState));
      this.definitions.set(state.symbol, state);
      this.customSymbolSet.add(state.symbol);
    }
  }

  private async initializeBasePrices(): Promise<void> {
    for (const state of this.definitions.values()) {
      await this.initializeBasePricesForState(state);
    }
  }

  private async initializeBasePricesForState(state: CustomSymbolState): Promise<void> {
    for (const c of state.components) {
      if (c.basePrice <= 0) {
        try {
          const price = await fetchBinancePrice(c.symbol);
          c.basePrice = price;
          c.currentPrice = price;
          await db.update(customSymbolComponents)
            .set({ basePrice: price.toString() })
            .where(eq(customSymbolComponents.id, c.id));
        } catch (err) {
          logger.warn({ symbol: c.symbol, error: err }, 'Failed to fetch base price');
        }
      } else {
        c.currentPrice = c.basePrice;
      }
    }
  }

  private async rebalanceIfNeeded(): Promise<void> {
    for (const state of this.definitions.values()) {
      if (state.weightingMethod === 'MANUAL') continue;

      const daysSinceRebalance = state.lastRebalancedAt
        ? (Date.now() - state.lastRebalancedAt.getTime()) / (24 * 60 * 60 * 1000)
        : Infinity;

      if (daysSinceRebalance < state.rebalanceIntervalDays) continue;

      await this.rebalanceSymbol(state);
    }
  }

  async rebalanceSymbol(state: CustomSymbolState): Promise<void> {
    const coingeckoIds = state.components
      .filter(c => c.coingeckoId)
      .map(c => c.coingeckoId!);

    if (coingeckoIds.length === 0) return;

    try {
      const caps = await fetchMarketCaps(coingeckoIds);
      const orderedCaps = state.components.map(c =>
        c.coingeckoId ? (caps.get(c.coingeckoId) ?? 0) : 0
      );
      const weights = computeWeights(state.weightingMethod, orderedCaps, state.capPercent ?? undefined);

      for (let i = 0; i < state.components.length; i++) {
        state.components[i]!.weight = weights[i]!;
        await db.update(customSymbolComponents)
          .set({ weight: weights[i]!.toString() })
          .where(eq(customSymbolComponents.id, state.components[i]!.id));
      }

      await db.update(customSymbols)
        .set({ lastRebalancedAt: new Date(), updatedAt: new Date() })
        .where(eq(customSymbols.id, state.id));

      state.lastRebalancedAt = new Date();
      logger.info({ symbol: state.symbol, weights }, 'Custom symbol rebalanced');
    } catch (err) {
      logger.warn({ symbol: state.symbol, error: err }, 'Failed to rebalance custom symbol');
    }
  }

  private async subscribeToComponentStreams(): Promise<void> {
    if (this.priceObserverRegistered) return;
    this.priceObserverRegistered = true;

    const { binancePriceStreamService } = await import('./binance-price-stream');

    binancePriceStreamService.onPriceUpdate((symbol: string, price: number, timestamp: number) => {
      this.onComponentPriceUpdate(symbol, price, timestamp);
    });

    for (const state of this.definitions.values()) {
      for (const component of state.components) {
        binancePriceStreamService.subscribeSymbol(component.symbol);
      }
    }
  }

  private onComponentPriceUpdate(symbol: string, price: number, timestamp: number): void {
    for (const state of this.definitions.values()) {
      const component = state.components.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
      if (!component) continue;

      component.currentPrice = price;
      const indexPrice = computeIndexPrice(state);

      if (indexPrice <= 0 || isNaN(indexPrice)) continue;

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitPriceUpdate(state.symbol, indexPrice, timestamp);
      }
    }
  }

  async ensureKlinesBackfilled(
    symbol: string,
    interval: Interval,
    _marketType: MarketType,
    targetCount: number,
  ): Promise<void> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM klines
      WHERE symbol = ${symbol.toUpperCase()}
        AND interval = ${interval}
        AND market_type = 'SPOT'
    `);
    const count = Number((result.rows[0] as { count: string }).count);

    if (count >= targetCount * 0.5) return;

    await this.backfillKlines(symbol, interval, 'SPOT');
  }

  async backfillKlines(
    customSymbol: string,
    interval: Interval,
    _marketType: MarketType,
    startTime?: Date,
    endTime?: Date,
  ): Promise<void> {
    const state = this.definitions.get(customSymbol.toUpperCase());
    if (!state) return;

    interface ComponentKline {
      openTime: Date;
      closeTime: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      quoteVolume: number;
    }

    const componentKlinesMap = new Map<string, ComponentKline[]>();

    for (const c of state.components) {
      const conditions = [
        eq(klinesTable.symbol, c.symbol),
        eq(klinesTable.interval, interval),
        eq(klinesTable.marketType, c.marketType),
      ];
      if (startTime) conditions.push(gte(klinesTable.openTime, startTime));
      if (endTime) conditions.push(lte(klinesTable.openTime, endTime));

      const rows = await db.query.klines.findMany({
        where: and(...conditions),
        orderBy: [desc(klinesTable.openTime)],
        limit: 20_000,
      });

      componentKlinesMap.set(c.symbol, rows.map(r => ({
        openTime: r.openTime,
        closeTime: r.closeTime,
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
        quoteVolume: r.quoteVolume ? parseFloat(r.quoteVolume) : 0,
      })).reverse());
    }

    const allTimestampSets = Array.from(componentKlinesMap.values()).map(
      klines => new Set(klines.map(k => k.openTime.getTime()))
    );
    if (allTimestampSets.length === 0) return;

    const commonTimestamps = allTimestampSets.reduce((acc, s) => {
      const result = new Set<number>();
      for (const t of acc) if (s.has(t)) result.add(t);
      return result;
    });

    if (commonTimestamps.size === 0) return;

    const sortedTimestamps = Array.from(commonTimestamps).sort((a, b) => a - b);

    const componentKlinesByTime = new Map<string, Map<number, ComponentKline>>();
    for (const [sym, klines] of componentKlinesMap) {
      const byTime = new Map<number, ComponentKline>();
      for (const k of klines) byTime.set(k.openTime.getTime(), k);
      componentKlinesByTime.set(sym, byTime);
    }

    const syntheticKlines: Array<{
      symbol: string;
      interval: string;
      marketType: 'SPOT';
      openTime: Date;
      closeTime: Date;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      quoteVolume: string;
      trades: number;
      takerBuyBaseVolume: string;
      takerBuyQuoteVolume: string;
    }> = [];

    for (const ts of sortedTimestamps) {
      let open = 0, high = 0, low = 0, close = 0, volume = 0;
      let closeTime = new Date(ts);
      let valid = true;

      for (const c of state.components) {
        const byTime = componentKlinesByTime.get(c.symbol);
        const k = byTime?.get(ts);
        if (!k || c.basePrice <= 0) { valid = false; break; }

        open += c.weight * (k.open / c.basePrice);
        high += c.weight * (k.high / c.basePrice);
        low += c.weight * (k.low / c.basePrice);
        close += c.weight * (k.close / c.basePrice);
        volume += c.weight * k.quoteVolume;
        closeTime = k.closeTime;
      }

      if (!valid) continue;

      syntheticKlines.push({
        symbol: state.symbol,
        interval,
        marketType: 'SPOT',
        openTime: new Date(ts),
        closeTime,
        open: (state.baseValue * open).toFixed(8),
        high: (state.baseValue * high).toFixed(8),
        low: (state.baseValue * low).toFixed(8),
        close: (state.baseValue * close).toFixed(8),
        volume: volume.toFixed(8),
        quoteVolume: volume.toFixed(8),
        trades: 0,
        takerBuyBaseVolume: '0',
        takerBuyQuoteVolume: '0',
      });
    }

    if (syntheticKlines.length === 0) return;

    const BATCH_SIZE = 500;
    for (let i = 0; i < syntheticKlines.length; i += BATCH_SIZE) {
      const batch = syntheticKlines.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(klinesTable)
          .values(batch)
          .onConflictDoUpdate({
            target: [klinesTable.symbol, klinesTable.interval, klinesTable.marketType, klinesTable.openTime],
            set: {
              open: sql`excluded.open`,
              high: sql`excluded.high`,
              low: sql`excluded.low`,
              close: sql`excluded.close`,
              volume: sql`excluded.volume`,
            },
          });
      } catch (err) {
        logger.warn({ error: err, batchSize: batch.length }, 'Batch kline insert failed, falling back to individual inserts');
        for (const kline of batch) {
          await db.insert(klinesTable).values(kline).onConflictDoNothing().catch(() => {});
        }
      }
    }

    logger.info({
      symbol: state.symbol,
      interval,
      count: syntheticKlines.length,
    }, 'Custom symbol klines backfilled');
  }

  private async backfillAllActiveSymbols(): Promise<void> {
    for (const state of this.definitions.values()) {
      for (const interval of KLINE_INTERVALS) {
        try {
          await this.backfillKlines(state.symbol, interval, 'SPOT');
        } catch (err) {
          logger.warn({ symbol: state.symbol, interval, error: err }, 'Failed to backfill custom symbol klines');
        }
      }
    }
  }

  private async seedPolitifi(): Promise<void> {
    const existing = await db.query.customSymbols.findFirst({
      where: eq(customSymbols.symbol, 'POLITIFI'),
    });
    if (existing) return;

    const componentDefs = [
      { symbol: 'WLFIUSDT', marketType: 'SPOT' as const, coingeckoId: 'world-liberty-financial' },
      { symbol: 'TRUMPUSDT', marketType: 'SPOT' as const, coingeckoId: 'official-trump' },
      { symbol: 'MELANIAUSDT', marketType: 'SPOT' as const, coingeckoId: 'official-melania-meme' },
      { symbol: 'PEOPLEUSDT', marketType: 'SPOT' as const, coingeckoId: 'constitutiondao' },
      { symbol: 'PNUTUSDT', marketType: 'SPOT' as const, coingeckoId: 'peanut-the-squirrel' },
    ];

    let weights: number[];
    try {
      const caps = await fetchMarketCaps(componentDefs.map(c => c.coingeckoId));
      const orderedCaps = componentDefs.map(c => caps.get(c.coingeckoId) ?? 0);
      weights = computeWeights('CAPPED_MARKET_CAP', orderedCaps, 40);
    } catch {
      weights = componentDefs.map(() => 1 / componentDefs.length);
      logger.warn('CoinGecko unavailable, using equal weights for POLITIFI seed');
    }

    const basePrices = new Map<string, number>();
    for (const c of componentDefs) {
      try {
        const price = await fetchBinancePrice(c.symbol);
        basePrices.set(c.symbol, price);
      } catch {
        logger.warn({ symbol: c.symbol }, 'Could not fetch base price for POLITIFI component');
      }
    }

    const [politifi] = await db.insert(customSymbols).values({
      symbol: 'POLITIFI',
      name: 'Political Token Index',
      description: 'A basket of top PolitiFi tokens weighted by capped market cap',
      category: 'politics',
      baseValue: '100',
      weightingMethod: 'CAPPED_MARKET_CAP',
      capPercent: '40',
      rebalanceIntervalDays: 30,
      lastRebalancedAt: new Date(),
    }).returning();

    if (!politifi) return;

    await db.insert(customSymbolComponents).values(
      componentDefs.map((c, i) => ({
        customSymbolId: politifi.id,
        symbol: c.symbol,
        marketType: c.marketType,
        coingeckoId: c.coingeckoId,
        weight: weights[i]!.toString(),
        basePrice: basePrices.get(c.symbol)?.toString() ?? null,
      }))
    );

    logger.info({ components: componentDefs.length }, 'POLITIFI index seeded');
  }
}

let instance: CustomSymbolService | null = null;

export const getCustomSymbolService = (): CustomSymbolService | null => instance;

export const startCustomSymbolService = async (): Promise<CustomSymbolService> => {
  instance = new CustomSymbolService();
  await instance.start();
  return instance;
};
