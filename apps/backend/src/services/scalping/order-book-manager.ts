import type { DepthUpdate, DepthLevel } from '@marketmind/types';
import type { ImbalanceResult, AbsorptionEvent } from './types';
import { SCALPING_DEFAULTS } from '@marketmind/types';

export class OrderBookManager {
  private books = new Map<string, { bids: Map<number, number>; asks: Map<number, number> }>();
  private previousBidVolumes = new Map<string, Map<number, number>>();
  private previousAskVolumes = new Map<string, Map<number, number>>();

  processDepthUpdate(update: DepthUpdate): void {
    const symbol = update.symbol;
    let book = this.books.get(symbol);
    if (!book) {
      book = { bids: new Map(), asks: new Map() };
      this.books.set(symbol, book);
    }

    this.previousBidVolumes.set(symbol, new Map(book.bids));
    this.previousAskVolumes.set(symbol, new Map(book.asks));

    book.bids.clear();
    book.asks.clear();

    for (const level of update.bids) {
      book.bids.set(level.price, level.quantity);
    }
    for (const level of update.asks) {
      book.asks.set(level.price, level.quantity);
    }
  }

  getImbalance(symbol: string, levels: number = SCALPING_DEFAULTS.DEPTH_LEVELS): ImbalanceResult {
    const book = this.books.get(symbol);
    if (!book) return { ratio: 0, bidVolume: 0, askVolume: 0 };

    const bidEntries = Array.from(book.bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, levels);
    const askEntries = Array.from(book.asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, levels);

    const bidVolume = bidEntries.reduce((sum, [_, qty]) => sum + qty, 0);
    const askVolume = askEntries.reduce((sum, [_, qty]) => sum + qty, 0);
    const total = bidVolume + askVolume;

    return {
      ratio: total > 0 ? (bidVolume - askVolume) / total : 0,
      bidVolume,
      askVolume,
    };
  }

  getMicroprice(symbol: string): number {
    const book = this.books.get(symbol);
    if (!book) return 0;

    const bestBid = this.getBestBid(book.bids);
    const bestAsk = this.getBestAsk(book.asks);
    if (!bestBid || !bestAsk) return 0;

    const totalQty = bestBid.quantity + bestAsk.quantity;
    if (totalQty === 0) return (bestBid.price + bestAsk.price) / 2;

    return (bestBid.price * bestAsk.quantity + bestAsk.price * bestBid.quantity) / totalQty;
  }

  getSpread(symbol: string): { spread: number; spreadPercent: number } {
    const book = this.books.get(symbol);
    if (!book) return { spread: 0, spreadPercent: 0 };

    const bestBid = this.getBestBid(book.bids);
    const bestAsk = this.getBestAsk(book.asks);
    if (!bestBid || !bestAsk) return { spread: 0, spreadPercent: 0 };

    const spread = bestAsk.price - bestBid.price;
    const spreadPercent = bestAsk.price > 0 ? (spread / bestAsk.price) * 100 : 0;

    return { spread, spreadPercent };
  }

  getWalls(symbol: string, threshold: number): DepthLevel[] {
    const book = this.books.get(symbol);
    if (!book) return [];

    const allLevels: DepthLevel[] = [];
    for (const [price, quantity] of book.bids) {
      allLevels.push({ price, quantity });
    }
    for (const [price, quantity] of book.asks) {
      allLevels.push({ price, quantity });
    }

    const avgQty = allLevels.reduce((sum, l) => sum + l.quantity, 0) / (allLevels.length || 1);
    return allLevels.filter((l) => l.quantity > avgQty * threshold);
  }

  detectAbsorption(symbol: string): AbsorptionEvent | null {
    const book = this.books.get(symbol);
    const prevBids = this.previousBidVolumes.get(symbol);
    const prevAsks = this.previousAskVolumes.get(symbol);
    if (!book || !prevBids || !prevAsks) return null;

    const bestBid = this.getBestBid(book.bids);
    const bestAsk = this.getBestAsk(book.asks);
    if (!bestBid || !bestAsk) return null;

    const bidAbsorption = this.checkSideAbsorption(bestBid.price, bestBid.quantity, prevBids, book.bids, 'bid');
    if (bidAbsorption) return bidAbsorption;

    const askAbsorption = this.checkSideAbsorption(bestAsk.price, bestAsk.quantity, prevAsks, book.asks, 'ask');
    if (askAbsorption) return askAbsorption;

    return null;
  }

  private checkSideAbsorption(
    price: number,
    currentQty: number,
    prevVolumes: Map<number, number>,
    currentLevels: Map<number, number>,
    side: 'bid' | 'ask',
  ): AbsorptionEvent | null {
    const prevQty = prevVolumes.get(price) ?? 0;
    if (prevQty <= 0 || currentQty < prevQty * 0.8) return null;

    const avgQty = this.getAvgQuantity(currentLevels);
    const score = avgQty > 0 ? prevQty / avgQty : 0;

    if (score >= SCALPING_DEFAULTS.ABSORPTION_VOLUME_THRESHOLD) {
      return { price, volume: prevQty, side, priceHeld: true, score };
    }
    return null;
  }

  private getBestBid(bids: Map<number, number>): DepthLevel | null {
    let best: DepthLevel | null = null;
    for (const [price, quantity] of bids) {
      if (!best || price > best.price) best = { price, quantity };
    }
    return best;
  }

  private getBestAsk(asks: Map<number, number>): DepthLevel | null {
    let best: DepthLevel | null = null;
    for (const [price, quantity] of asks) {
      if (!best || price < best.price) best = { price, quantity };
    }
    return best;
  }

  private getAvgQuantity(levels: Map<number, number>): number {
    if (levels.size === 0) return 0;
    let sum = 0;
    for (const qty of levels.values()) sum += qty;
    return sum / levels.size;
  }

  hasBook(symbol: string): boolean {
    return this.books.has(symbol);
  }

  clear(): void {
    this.books.clear();
    this.previousBidVolumes.clear();
    this.previousAskVolumes.clear();
  }
}
