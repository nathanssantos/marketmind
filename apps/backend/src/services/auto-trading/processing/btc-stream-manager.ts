import type { Interval, MarketType } from '@marketmind/types';
import { calculateRequiredKlines } from '../../../utils/kline-calculator';
import { getKlineMaintenance } from '../../kline-maintenance';
import { prefetchKlines } from '../../kline-prefetch';
import { serializeError } from '../../../utils/errors';
import type { ActiveWatcher, BtcStreamManagerDeps } from '../types';
import { log } from '../utils';

export class BtcStreamManager {
  private btcStreamSubscribed: Set<string> = new Set();

  constructor(private deps: BtcStreamManagerDeps) {}

  async ensureBtcKlineStream(
    walletId: string,
    userId: string,
    interval: string,
    marketType: MarketType
  ): Promise<void> {
    const config = await this.deps.getCachedConfig(walletId, userId);
    if (!config?.useBtcCorrelationFilter) return;

    const btcKey = `BTCUSDT-${interval}-${marketType}`;
    if (this.btcStreamSubscribed.has(btcKey)) return;

    const activeWatchers = this.deps.getActiveWatchers();
    const hasBtcWatcher = Array.from(activeWatchers.values()).some(
      (w: ActiveWatcher) => w.symbol === 'BTCUSDT' && w.interval === interval && w.marketType === marketType
    );

    if (hasBtcWatcher) return;

    const requiredKlines = calculateRequiredKlines();

    await prefetchKlines({
      symbol: 'BTCUSDT',
      interval,
      marketType,
      targetCount: requiredKlines,
      silent: true,
    });

    try {
      const klineMaintenance = getKlineMaintenance();
      await klineMaintenance.forceCheckSymbol('BTCUSDT', interval as Interval, marketType);
    } catch (error) {
      log('! [BTC Correlation] Maintenance check failed for BTCUSDT', { error: serializeError(error) });
    }

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('../../binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.subscribe('BTCUSDT', interval);
    } else {
      binanceKlineStreamService.subscribe('BTCUSDT', interval);
    }

    this.btcStreamSubscribed.add(btcKey);
  }

  async cleanupBtcKlineStreamIfNeeded(interval: string, marketType: MarketType): Promise<void> {
    const btcKey = `BTCUSDT-${interval}-${marketType}`;
    if (!this.btcStreamSubscribed.has(btcKey)) return;

    const activeWatchers = this.deps.getActiveWatchers();
    const hasActiveWatchersForInterval = Array.from(activeWatchers.values()).some(
      (w: ActiveWatcher) => w.interval === interval && w.marketType === marketType
    );

    if (hasActiveWatchersForInterval) return;

    const hasBtcWatcher = Array.from(activeWatchers.values()).some(
      (w: ActiveWatcher) => w.symbol === 'BTCUSDT' && w.interval === interval && w.marketType === marketType
    );

    if (hasBtcWatcher) return;

    const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('../../binance-kline-stream');
    if (marketType === 'FUTURES') {
      binanceFuturesKlineStreamService.unsubscribe('BTCUSDT', interval);
    } else {
      binanceKlineStreamService.unsubscribe('BTCUSDT', interval);
    }

    this.btcStreamSubscribed.delete(btcKey);
    log('> Unsubscribed from BTCUSDT kline stream (no more watchers)', { interval, marketType });
  }

  isStreamSubscribed(symbol: string, interval: string, marketType: MarketType): boolean {
    return this.btcStreamSubscribed.has(`${symbol}-${interval}-${marketType}`);
  }
}
