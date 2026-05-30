import { WebsocketClient } from 'binance';
import { SCALPING_STREAM } from '../constants/scalping';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';

const RECONNECT_DEDUPE_MS = 2000;

/**
 * Shared lifecycle for the public Binance market-data WebSocket streams
 * (book-ticker, agg-trade, depth, mark-price, liquidation). Before this,
 * each service hand-rolled an identical skeleton: construct a
 * WebsocketClient with the same options + silentWsLogger, wire
 * message/error/reconnected handlers, dedupe the reconnect burst, and
 * close on stop. Five near-identical copies → one base.
 *
 * Subclasses implement `handleMessage` (parse + emit) and `onReconnected`
 * (re-establish subscriptions). `onStart` / `onStop` are optional hooks
 * for per-stream extras (snapshot timers, buffer flush intervals, …).
 *
 * Deliberately NOT used by the kline or price streams — those carry
 * bespoke health-watchdog / forced-reconnect / subscription-reconcile /
 * candle-persistence logic and are migrated separately under review.
 */
export abstract class BinanceWebSocketStreamBase {
  protected client: WebsocketClient | null = null;
  private isReconnecting = false;

  /** Human-readable name for log lines, e.g. "BookTicker". */
  protected abstract readonly label: string;
  /** Reconnect backoff handed to the SDK. Override per stream if needed. */
  protected readonly reconnectTimeoutMs: number = SCALPING_STREAM.RECONNECT_DELAY_MS;

  protected abstract handleMessage(data: unknown): void;
  /** Re-establish subscriptions after a reconnect (post-dedupe). */
  protected abstract onReconnected(): void;

  /** Optional: subclass work after the client is wired (timers, initial subs). */
  protected onStart(): void {}
  /** Optional: subclass cleanup before the client is closed (clear state/timers). */
  protected onStop(): void {}

  start(): void {
    if (this.client) return;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: this.reconnectTimeoutMs },
      silentWsLogger,
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // The SDK's typings omit 'error'; cast narrowly to attach the handler.
    (this.client as unknown as { on: (event: string, cb: (arg: unknown) => void) => void }).on(
      'error',
      (error: unknown) => {
        logger.error({ error: serializeError(error) }, `${this.label} WebSocket error`);
      },
    );

    this.client.on('reconnected', () => {
      // Binance fires 'reconnected' once per wsKey; on a multi-stream
      // client that's several events in a burst. Dedupe so resubscribe
      // runs once.
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      try {
        this.onReconnected();
      } catch (error) {
        logger.error({ error: serializeError(error) }, `${this.label} resubscribe failed`);
      }
      setTimeout(() => { this.isReconnecting = false; }, RECONNECT_DEDUPE_MS);
    });

    this.onStart();
    logger.info(`${this.label} stream service started`);
  }

  stop(): void {
    if (!this.client) return;
    this.onStop();
    this.client.closeAll(true);
    this.client = null;
    logger.info(`${this.label} stream service stopped`);
  }
}
