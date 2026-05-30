import type { MarketType } from '@marketmind/types';
import type { KlineInterval } from 'binance';
import { logger } from './logger';
import { ReconnectionGuard } from './kline-stream-persistence';
import { BinanceKlineStreamBase, type KlineUpdate } from './binance-kline-stream-base';

export type { KlineUpdate } from './binance-kline-stream-base';

const spotReconnectionGuard = new ReconnectionGuard();
const futuresReconnectionGuard = new ReconnectionGuard();

export class BinanceKlineStreamService extends BinanceKlineStreamBase {
  protected readonly marketType: MarketType = 'SPOT';
  protected readonly reconnectionGuard = spotReconnectionGuard;
  protected readonly logLabel = 'kline';

  protected subscribeOnClient(symbol: string, interval: string): void {
    void this.client!.subscribeSpotKline(symbol, interval as KlineInterval);
  }
}

export const binanceKlineStreamService = new BinanceKlineStreamService();

type KlineCloseHandler = (update: KlineUpdate) => void;

export class BinanceFuturesKlineStreamService extends BinanceKlineStreamBase {
  protected readonly marketType: MarketType = 'FUTURES';
  protected readonly reconnectionGuard = futuresReconnectionGuard;
  protected readonly logLabel = 'futures kline';
  // FUTURES subscribers (auto-trading, scalping) may subscribe before the
  // service is explicitly started; mirror the original lazy-start behavior.
  protected override readonly autoStartOnSubscribe = true;

  private klineCloseHandlers: KlineCloseHandler[] = [];

  onKlineClose(handler: KlineCloseHandler): () => void {
    this.klineCloseHandlers.push(handler);
    return () => {
      const idx = this.klineCloseHandlers.indexOf(handler);
      if (idx >= 0) this.klineCloseHandlers.splice(idx, 1);
    };
  }

  protected subscribeOnClient(symbol: string, interval: string): void {
    void this.client!.subscribeKlines(symbol, interval as KlineInterval, 'usdm');
  }

  protected override onKlineClosed(update: KlineUpdate): void {
    for (const handler of this.klineCloseHandlers) {
      try {
        handler(update);
      } catch (err) {
        // Per-handler isolation so one bad handler doesn't skip persist.
        logger.warn({ error: err }, 'Kline close handler error');
      }
    }
  }

  protected override onStopCleanup(): void {
    this.klineCloseHandlers = [];
  }
}

export const binanceFuturesKlineStreamService = new BinanceFuturesKlineStreamService();
