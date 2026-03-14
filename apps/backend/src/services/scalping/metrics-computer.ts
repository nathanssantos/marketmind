import type { AggTrade, BookTickerUpdate, DepthUpdate, ScalpingMetrics, VolumeProfile, VolumeProfileLevel } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_ENGINE } from '../../constants/scalping';
import { OrderBookManager } from './order-book-manager';
import type { CVDState } from './types';
import { getWebSocketService } from '../websocket';

export class MetricsComputer {
  private orderBookManager = new OrderBookManager();
  private cvdStates = new Map<string, CVDState>();
  private latestBookTicker = new Map<string, BookTickerUpdate>();
  private tradeBuffer = new Map<string, AggTrade[]>();
  private volumeProfiles = new Map<string, Map<number, { buy: number; sell: number }>>();
  private emitTimers = new Map<string, ReturnType<typeof setInterval>>();
  private largeBuyVol = new Map<string, number>();
  private largeSellVol = new Map<string, number>();
  private avgTradeQty = new Map<string, { sum: number; count: number }>();

  startForSymbol(symbol: string): void {
    if (this.emitTimers.has(symbol)) return;

    this.cvdStates.set(symbol, { value: 0, history: [], priceHistory: [] });
    this.tradeBuffer.set(symbol, []);
    this.volumeProfiles.set(symbol, new Map());
    this.largeBuyVol.set(symbol, 0);
    this.largeSellVol.set(symbol, 0);
    this.avgTradeQty.set(symbol, { sum: 0, count: 0 });

    const timer = setInterval(() => {
      this.emitMetrics(symbol);
    }, SCALPING_DEFAULTS.METRICS_EMIT_INTERVAL_MS);

    this.emitTimers.set(symbol, timer);
  }

  stopForSymbol(symbol: string): void {
    const timer = this.emitTimers.get(symbol);
    if (timer) clearInterval(timer);
    this.emitTimers.delete(symbol);
    this.cvdStates.delete(symbol);
    this.tradeBuffer.delete(symbol);
    this.volumeProfiles.delete(symbol);
    this.largeBuyVol.delete(symbol);
    this.largeSellVol.delete(symbol);
    this.avgTradeQty.delete(symbol);
    this.latestBookTicker.delete(symbol);
  }

  processAggTrade(trade: AggTrade): void {
    const symbol = trade.symbol;
    const cvdState = this.cvdStates.get(symbol);
    if (!cvdState) return;

    const delta = trade.isBuyerMaker ? -trade.quantity : trade.quantity;
    cvdState.value += delta;
    cvdState.history.push({ value: cvdState.value, timestamp: trade.timestamp });
    cvdState.priceHistory.push({ price: trade.price, timestamp: trade.timestamp });

    if (cvdState.history.length > SCALPING_ENGINE.CVD_HISTORY_BARS) {
      cvdState.history.shift();
    }
    if (cvdState.priceHistory.length > SCALPING_ENGINE.CVD_HISTORY_BARS) {
      cvdState.priceHistory.shift();
    }

    const buffer = this.tradeBuffer.get(symbol);
    if (buffer) {
      buffer.push(trade);
      const cutoff = Date.now() - 5 * 60 * 1000;
      while (buffer.length > 0 && (buffer[0]?.timestamp ?? 0) < cutoff) buffer.shift();
    }

    const avg = this.avgTradeQty.get(symbol);
    if (avg) {
      avg.sum += trade.quantity;
      avg.count += 1;
      if (avg.count > 2000) {
        avg.sum = (avg.sum / avg.count) * 1000;
        avg.count = 1000;
      }
    }

    const avgQty = avg && avg.count > 0 ? avg.sum / avg.count : 0;
    const isLarge = avgQty > 0 && trade.quantity > avgQty * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER;

    if (isLarge) {
      if (trade.isBuyerMaker) {
        this.largeSellVol.set(symbol, (this.largeSellVol.get(symbol) ?? 0) + trade.quantity);
      } else {
        this.largeBuyVol.set(symbol, (this.largeBuyVol.get(symbol) ?? 0) + trade.quantity);
      }
    }

    const profile = this.volumeProfiles.get(symbol);
    if (profile) {
      const tickSize = SCALPING_ENGINE.VOLUME_PROFILE_TICK_SIZE;
      const bucket = Math.round(trade.price / tickSize) * tickSize;
      const existing = profile.get(bucket) ?? { buy: 0, sell: 0 };
      if (trade.isBuyerMaker) existing.sell += trade.quantity;
      else existing.buy += trade.quantity;
      profile.set(bucket, existing);

      if (profile.size > SCALPING_ENGINE.VOLUME_PROFILE_MAX_LEVELS) {
        const entries = Array.from(profile.entries());
        entries.sort((a, b) => (a[1].buy + a[1].sell) - (b[1].buy + b[1].sell));
        const toRemove = entries.slice(0, entries.length - SCALPING_ENGINE.VOLUME_PROFILE_MAX_LEVELS);
        for (const [key] of toRemove) profile.delete(key);
      }
    }
  }

  processBookTicker(update: BookTickerUpdate): void {
    this.latestBookTicker.set(update.symbol, update);
  }

  processDepthUpdate(update: DepthUpdate): void {
    this.orderBookManager.processDepthUpdate(update);
  }

  getMetrics(symbol: string): ScalpingMetrics {
    const imbalance = this.orderBookManager.getImbalance(symbol);
    const { spread, spreadPercent } = this.orderBookManager.getSpread(symbol);
    const microprice = this.orderBookManager.getMicroprice(symbol);
    const cvdState = this.cvdStates.get(symbol);
    const absorption = this.orderBookManager.detectAbsorption(symbol);

    return {
      cvd: cvdState?.value ?? 0,
      imbalanceRatio: imbalance.ratio,
      microprice,
      spread,
      spreadPercent,
      largeBuyVol: this.largeBuyVol.get(symbol) ?? 0,
      largeSellVol: this.largeSellVol.get(symbol) ?? 0,
      absorptionScore: absorption?.score ?? 0,
      exhaustionScore: this.computeExhaustion(symbol),
      timestamp: Date.now(),
    };
  }

  getCVDState(symbol: string): CVDState | null {
    return this.cvdStates.get(symbol) ?? null;
  }

  getVolumeProfile(symbol: string): VolumeProfile | null {
    const profile = this.volumeProfiles.get(symbol);
    if (!profile || profile.size === 0) return null;

    const levels: VolumeProfileLevel[] = [];
    let totalVolume = 0;

    for (const [price, vol] of profile) {
      const volume = vol.buy + vol.sell;
      levels.push({ price, volume, buyVolume: vol.buy, sellVolume: vol.sell });
      totalVolume += volume;
    }

    levels.sort((a, b) => b.volume - a.volume);
    const firstLevel = levels[0];
    if (!firstLevel) return null;
    const poc = firstLevel.price;

    levels.sort((a, b) => a.price - b.price);

    let valueAreaVolume = 0;
    const targetVolume = totalVolume * 0.7;
    const sortedByVol = [...levels].sort((a, b) => b.volume - a.volume);
    const valueAreaPrices: number[] = [];

    for (const level of sortedByVol) {
      if (valueAreaVolume >= targetVolume) break;
      valueAreaVolume += level.volume;
      valueAreaPrices.push(level.price);
    }

    const valueAreaHigh = Math.max(...valueAreaPrices);
    const valueAreaLow = Math.min(...valueAreaPrices);

    return { levels, poc, valueAreaHigh, valueAreaLow };
  }

  getOrderBookManager(): OrderBookManager {
    return this.orderBookManager;
  }

  getTradeBuffer(symbol: string): AggTrade[] | null {
    return this.tradeBuffer.get(symbol) ?? null;
  }

  private computeExhaustion(symbol: string): number {
    const cvdState = this.cvdStates.get(symbol);
    if (!cvdState || cvdState.history.length < SCALPING_ENGINE.EXHAUSTION_LOOKBACK) return 0;

    const recent = cvdState.history.slice(-SCALPING_ENGINE.EXHAUSTION_LOOKBACK);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i]!.value - recent[i - 1]!.value);
    }

    if (deltas.length < 2) return 0;

    const firstHalf = deltas.slice(0, Math.floor(deltas.length / 2));
    const secondHalf = deltas.slice(Math.floor(deltas.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (Math.abs(avgFirst) < 0.001) return 0;

    const tapering = 1 - Math.abs(avgSecond) / Math.abs(avgFirst);
    return Math.max(0, Math.min(1, tapering));
  }

  private emitMetrics(symbol: string): void {
    const metrics = this.getMetrics(symbol);
    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitScalpingMetrics(symbol, metrics);
    }
  }

  stopAll(): void {
    const symbols = Array.from(this.emitTimers.keys());
    for (const symbol of symbols) {
      this.stopForSymbol(symbol);
    }
    this.latestBookTicker.clear();
    this.orderBookManager.clear();
  }
}
