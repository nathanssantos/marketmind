/* eslint-disable @typescript-eslint/no-base-to-string -- Binance WS message values are unknown but documented strings; explicit cast at every read would be 50+ lines of noise */
import type { LiquidityHeatmapLiquidation } from '@marketmind/types';
import { serializeError } from '../utils/errors';
import { logger } from './logger';
import { BinanceWebSocketStreamBase } from './binance-ws-stream-base';

type LiquidationObserver = (event: LiquidityHeatmapLiquidation) => void;

const MAX_HISTORY = 500;

export class BinanceLiquidationStreamService extends BinanceWebSocketStreamBase {
  protected readonly label = 'Liquidation';
  private observers: LiquidationObserver[] = [];
  private history: LiquidityHeatmapLiquidation[] = [];

  protected override onStart(): void {
    void this.client!.subscribeAllLiquidationOrders('usdm');
  }

  protected override onStop(): void {
    this.history = [];
  }

  protected onReconnected(): void {
    void this.client!.subscribeAllLiquidationOrders('usdm');
  }

  onLiquidation(handler: LiquidationObserver): () => void {
    this.observers.push(handler);
    return () => {
      const idx = this.observers.indexOf(handler);
      if (idx >= 0) this.observers.splice(idx, 1);
    };
  }

  getHistory(symbol: string, since: number): LiquidityHeatmapLiquidation[] {
    return this.history.filter(e => e.time >= since && symbol === (e as LiquidityHeatmapLiquidation & { symbol?: string }).symbol);
  }

  getHistoryForSymbol(symbol: string): LiquidityHeatmapLiquidation[] {
    return (this.history as Array<LiquidityHeatmapLiquidation & { _symbol: string }>).filter(e => e._symbol === symbol);
  }

  protected handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;
      const eventType = msg['eventType'] ?? msg['e'];
      if (eventType !== 'forceOrder') return;

      const order = (msg['order'] ?? msg['o']) as Record<string, unknown> | undefined;
      if (!order) return;

      const symbol = String(order['symbol'] ?? order['s'] ?? '').toUpperCase();
      const side = String(order['side'] ?? order['S'] ?? '') as 'BUY' | 'SELL';
      const price = parseFloat(String(order['averagePrice'] ?? order['ap'] ?? order['price'] ?? order['p'] ?? '0'));
      const quantity = parseFloat(String(order['lastFilledQuantity'] ?? order['l'] ?? order['originalQuantity'] ?? order['q'] ?? '0'));
      const time = Number(msg['eventTime'] ?? msg['E'] ?? Date.now());

      if (!symbol || price <= 0 || quantity <= 0) return;

      const event: LiquidityHeatmapLiquidation & { _symbol: string } = { price, quantity, side, time, _symbol: symbol };

      this.history.push(event);
      if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);

      for (const observer of this.observers) {
        try {
          observer(event);
        } catch (err) {
          logger.warn({ error: err }, 'Liquidation observer error');
        }
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling liquidation message');
    }
  }
}

export const binanceLiquidationStreamService = new BinanceLiquidationStreamService();
