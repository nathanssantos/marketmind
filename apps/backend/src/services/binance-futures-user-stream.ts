import type { PositionSide } from '@marketmind/types';
import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { createBinanceFuturesClient, isPaperWallet, getWalletType, getPosition } from './binance-futures-client';
import { decryptApiKey } from './encryption';
import { logBinanceEvent } from './binance-event-logger';
import { logger, serializeError } from './logger';
import { positionSyncService } from './position-sync';
import { getWebSocketService } from './websocket';
import type {
  FuturesAccountUpdate,
  FuturesOrderUpdate,
  FuturesMarginCall,
  FuturesAccountConfigUpdate,
  FuturesAlgoOrderUpdate,
  FuturesConditionalOrderReject,
  UserStreamContext,
} from './user-stream/types';
import { handleOrderUpdate as handleOrderUpdateFn } from './user-stream/handle-order-update';
import { handleAlgoOrderUpdate as handleAlgoOrderUpdateFn } from './user-stream/handle-algo-update';
import { verifyAlgoFillProcessed as verifyAlgoFillProcessedFn, closeResidualPosition as closeResidualPositionFn } from './user-stream/position-lifecycle';
import { handleAccountUpdate as handleAccountUpdateFn, handleMarginCall as handleMarginCallFn, handleConfigUpdate as handleConfigUpdateFn, handleConditionalOrderReject as handleConditionalOrderRejectFn, cancelPendingEntryOrders as cancelPendingEntryOrdersFn } from './user-stream/handle-account-events';
import { executeDebouncedSlTpUpdate } from './user-stream/debounced-sltp-update';
import { emitPositionPyramidedToast } from './user-stream/emit-position-toast';

interface WalletHealthState {
  lastMessageAt: number;
  lastReconnectAt: number;
  healthStatus: 'healthy' | 'degraded';
}

export class BinanceFuturesUserStreamService implements UserStreamContext {
  connections: Map<string, { wsClient: WebsocketClient; apiClient: USDMClient }> = new Map();
  private isRunning = false;
  private walletSubscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private walletHealth: Map<string, WalletHealthState> = new Map();
  private pyramidQueues = new Map<string, Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }>>();
  private pyramidActive = new Set<string>();
  private pendingSlTpUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  recentAlgoEntrySymbols = new Map<string, number>();
  private walletCache = new Map<string, { wallet: Wallet; cachedAt: number }>();

  private static readonly PYRAMID_SLTP_DEBOUNCE_MS = 3000;
  private static readonly PYRAMID_LOCK_TIMEOUT_MS = 30_000;
  private static readonly WALLET_CACHE_TTL_MS = 60_000;
  private static readonly HEALTH_CHECK_INTERVAL_MS = 60_000;
  // Binance's user-data stream is event-driven, NOT a heartbeat — it
  // only emits when account state changes. The SDK's internal heartbeat
  // (pingInterval=10s + pongTimeout=5s + reconnectTimeout=500ms) is the
  // authoritative liveness signal: when the socket genuinely dies, the
  // SDK closes + reconnects within ~15s and fires our `'reconnected'`
  // listener, which triggers the post-reconnect REST sync (positions,
  // orders, income). A forced reconnect from *our side* based on
  // `silenceMs > threshold` is harmful: idle wallets produce no events
  // for hours of normal operation, so the threshold fires falsely and
  // each unsubscribe → 500ms wait → resubscribe creates a ~1-3s window
  // where a real ORDER_TRADE_UPDATE / ACCOUNT_UPDATE *can* arrive and
  // be lost. The user then sees the operation "only fire via reconcile,
  // never on the spot". Production logs proved this: 15,450 forced
  // reconnects in a single day vs. 0 genuine SDK auto-reconnects.
  // We keep STALE_THRESHOLD_MS only for the renderer's UI health dot —
  // it never forces a reconnect.
  private static readonly STALE_THRESHOLD_MS = 1_800_000;

  async getCachedWallet(walletId: string): Promise<Wallet | null> {
    const cached = this.walletCache.get(walletId);
    if (cached && Date.now() - cached.cachedAt < BinanceFuturesUserStreamService.WALLET_CACHE_TTL_MS) return cached.wallet;
    const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
    if (walletRow) this.walletCache.set(walletId, { wallet: walletRow, cachedAt: Date.now() });
    return walletRow ?? null;
  }

  invalidateWalletCache(walletId: string): void {
    this.walletCache.delete(walletId);
  }

  async withPyramidLock<T>(walletId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
    const key = `${walletId}:${symbol}`;

    if (this.pyramidActive.has(key)) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          const queue = this.pyramidQueues.get(key);
          if (queue) {
            const idx = queue.findIndex(item => item.resolve === resolve);
            if (idx !== -1) queue.splice(idx, 1);
            if (queue.length === 0) this.pyramidQueues.delete(key);
          }
          resolve();
        }, BinanceFuturesUserStreamService.PYRAMID_LOCK_TIMEOUT_MS);

        const queue = this.pyramidQueues.get(key) ?? [];
        queue.push({ resolve, timer });
        this.pyramidQueues.set(key, queue);
      });
    }

    this.pyramidActive.add(key);
    try {
      return await fn();
    } finally {
      this.pyramidActive.delete(key);
      const queue = this.pyramidQueues.get(key);
      if (queue && queue.length > 0) {
        const next = queue.shift()!;
        clearTimeout(next.timer);
        if (queue.length === 0) this.pyramidQueues.delete(key);
        next.resolve();
      }
    }
  }

  shutdown(): void {
    for (const [, timer] of this.pendingSlTpUpdates) clearTimeout(timer);
    this.pendingSlTpUpdates.clear();
    this.pyramidQueues.clear();
    this.pyramidActive.clear();
    this.walletCache.clear();
  }

  scheduleDebouncedSlTpUpdate(executionId: string, walletId: string, symbol: string): void {
    const key = `${walletId}:${symbol}`;
    const existing = this.pendingSlTpUpdates.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pendingSlTpUpdates.delete(key);
      void executeDebouncedSlTpUpdate(this, executionId, walletId, symbol);
    }, BinanceFuturesUserStreamService.PYRAMID_SLTP_DEBOUNCE_MS);

    this.pendingSlTpUpdates.set(key, timer);
  }

  async mergeIntoExistingPosition(
    walletId: string,
    symbol: string,
    existingExecId: string,
    addedQty: number,
    addedPrice: number,
    deleteExecId?: string,
    logContext?: string
  ): Promise<void> {
    const [freshExec] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, existingExecId)).limit(1);
    if (!freshExec) return;

    const existingQty = parseFloat(freshExec.quantity);
    const existingPrice = parseFloat(freshExec.entryPrice);
    const newQty = existingQty + addedQty;
    const newAvgPrice = existingPrice > 0 && newQty > 0
      ? ((existingQty * existingPrice) + (addedQty * addedPrice)) / newQty
      : addedPrice;

    let pyramidLiquidationPrice: string | undefined;
    const pyramidConn = this.connections.get(walletId);
    if (pyramidConn) {
      try {
        const pos = await getPosition(pyramidConn.apiClient, symbol);
        if (pos) {
          const lp = parseFloat(pos.liquidationPrice || '0');
          if (lp > 0) pyramidLiquidationPrice = lp.toString();
        }
      } catch { /* best-effort */ }
    }

    await db.update(tradeExecutions).set({
      entryPrice: newAvgPrice.toString(),
      quantity: newQty.toString(),
      liquidationPrice: pyramidLiquidationPrice ?? freshExec.liquidationPrice,
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, freshExec.id));

    if (deleteExecId) {
      await db.delete(tradeExecutions).where(eq(tradeExecutions.id, deleteExecId));
    }

    const hasProtection = freshExec.stopLoss ?? freshExec.takeProfit;
    if (hasProtection) this.scheduleDebouncedSlTpUpdate(freshExec.id, walletId, symbol);

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitPositionUpdate(walletId, {
        ...freshExec,
        entryPrice: newAvgPrice.toString(),
        quantity: newQty.toString(),
        liquidationPrice: pyramidLiquidationPrice ?? freshExec.liquidationPrice,
      });
      if (deleteExecId) {
        wsService.emitPositionUpdate(walletId, { id: deleteExecId, status: 'merged' });
      }

      // v1.6 Track F.4 — pyramid toast. User just added to an existing
      // position; explicit feedback so they don't mistake it for a
      // separate fill.
      emitPositionPyramidedToast(wsService, walletId, {
        executionId: freshExec.id,
        symbol,
        side: freshExec.side,
        addedQuantity: addedQty,
        addedPrice,
        newAvgEntryPrice: newAvgPrice,
        newQuantity: newQty,
      });
    }

    logger.info({ executionId: freshExec.id, symbol, newAvgPrice, newQty, deleteExecId }, `[FuturesUserStream] ${logContext ?? 'Pyramided into existing position'} + emitted WS`);
  }

  async syncPositionFromExchange(walletId: string, symbol: string, executionId: string, logContext: string): Promise<boolean> {
    const connection = this.connections.get(walletId);
    if (!connection) return false;

    try {
      const exchangePos = await getPosition(connection.apiClient, symbol);
      if (!exchangePos) return false;

      const exchangeQty = Math.abs(parseFloat(exchangePos.positionAmt));
      const exchangePrice = parseFloat(exchangePos.entryPrice);
      if (exchangeQty === 0) return false;

      const [freshExec] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, executionId)).limit(1);
      if (freshExec?.status !== 'open') return false;

      const currentQty = parseFloat(freshExec.quantity);
      const currentPrice = parseFloat(freshExec.entryPrice);

      const otherOpenExecs = await db.select().from(tradeExecutions).where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
        )
      );

      if (otherOpenExecs.length > 1) {
        logger.info({ executionId, symbol, openCount: otherOpenExecs.length }, `[FuturesUserStream] ${logContext} — multiple open executions, skipping exchange sync to avoid qty overwrite`);
        return false;
      }

      if (Math.abs(currentQty - exchangeQty) < 1e-6 && Math.abs(currentPrice - exchangePrice) < 1e-8) {
        logger.trace({ executionId, symbol }, `[FuturesUserStream] ${logContext} — already in sync`);
        return false;
      }

      const lp = parseFloat(exchangePos.liquidationPrice || '0');
      const syncLiquidationPrice = lp > 0 ? lp.toString() : freshExec.liquidationPrice;

      await db.update(tradeExecutions).set({
        quantity: exchangeQty.toString(),
        entryPrice: exchangePrice.toString(),
        liquidationPrice: syncLiquidationPrice,
        updatedAt: new Date(),
      }).where(eq(tradeExecutions.id, executionId));

      if (freshExec.stopLoss || freshExec.takeProfit) this.scheduleDebouncedSlTpUpdate(executionId, walletId, symbol);

      logger.info({ executionId, symbol, oldQty: currentQty, newQty: exchangeQty, oldPrice: currentPrice, newPrice: exchangePrice }, `[FuturesUserStream] ${logContext}`);
      return true;
    } catch (e) {
      logger.warn({ symbol, executionId, error: serializeError(e) }, `[FuturesUserStream] ${logContext} — exchange sync failed`);
      return false;
    }
  }

  async cancelPendingEntryOrders(walletId: string, symbol: string, closedExecutionId: string): Promise<void> {
    return cancelPendingEntryOrdersFn(this, walletId, symbol, closedExecutionId);
  }

  async closeResidualPosition(walletId: string, symbol: string, executionId: string): Promise<void> {
    return closeResidualPositionFn(this, walletId, symbol, executionId);
  }

  async verifyAlgoFillProcessed(walletId: string, executionId: string, symbol: string, side: PositionSide, openedAt: number, exitReason: string): Promise<void> {
    return verifyAlgoFillProcessedFn(this, walletId, executionId, symbol, side, openedAt, exitReason);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('[FuturesUserStream] Starting Binance Futures User Stream service');
    await this.subscribeAllActiveWallets();

    this.walletSubscriptionInterval = setInterval(() => {
      void this.subscribeAllActiveWallets();
    }, 60000);

    this.startHealthWatchdog();
  }

  stop(): void {
    this.isRunning = false;

    if (this.walletSubscriptionInterval) {
      clearInterval(this.walletSubscriptionInterval);
      this.walletSubscriptionInterval = null;
    }

    this.stopHealthWatchdog();

    for (const [walletId, connection] of this.connections) {
      connection.wsClient.closeAll(true);
      this.connections.delete(walletId);
    }
    this.walletHealth.clear();

    this.shutdown();
    logger.info('[FuturesUserStream] Service stopped');
  }

  private startHealthWatchdog(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(
      () => { this.checkUserStreamHealth(); },
      BinanceFuturesUserStreamService.HEALTH_CHECK_INTERVAL_MS,
    );
  }

  private stopHealthWatchdog(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkUserStreamHealth(): void {
    const now = Date.now();
    for (const [walletId, health] of this.walletHealth) {
      const silenceMs = now - health.lastMessageAt;

      if (silenceMs > BinanceFuturesUserStreamService.STALE_THRESHOLD_MS && health.healthStatus === 'healthy') {
        health.healthStatus = 'degraded';
        logger.warn(
          { walletId, silenceMs, lastMessageAt: new Date(health.lastMessageAt).toISOString() },
          '[FuturesUserStream] User stream silent — marking degraded (UI only; SDK heartbeat owns reconnect)',
        );
      } else if (silenceMs <= BinanceFuturesUserStreamService.STALE_THRESHOLD_MS && health.healthStatus === 'degraded') {
        health.healthStatus = 'healthy';
        logger.info({ walletId }, '[FuturesUserStream] User stream recovered');
      }
    }
  }

  private recordUserStreamActivity(walletId: string): void {
    const existing = this.walletHealth.get(walletId);
    if (!existing) return;
    const wasDegraded = existing.healthStatus === 'degraded';
    const silenceMs = Date.now() - existing.lastMessageAt;
    existing.lastMessageAt = Date.now();
    if (wasDegraded) {
      existing.healthStatus = 'healthy';
      logger.info({ walletId, silenceMs }, '[FuturesUserStream] User stream recovered on message receipt');
      // v1.6 Track F.2 — signal renderer to force-refresh trading
      // queries. Without this, after a stream gap the chart can stay
      // stale until the next BACKUP_POLLING_INTERVAL tick (5s) —
      // which is fine, but a deliberate refresh on reconnect cuts the
      // worst case to "as fast as the server can answer".
      const wsService = getWebSocketService();
      wsService?.emitStreamReconnected(walletId, {
        source: 'user',
        reason: 'recovered_message',
        silenceMs,
      });
    }
  }

  private async subscribeAllActiveWallets(): Promise<void> {
    try {
      const allWallets = await db.select().from(wallets);

      const futuresWallets = allWallets.filter(
        (w) =>
          !isPaperWallet(w) &&
          w.apiKeyEncrypted &&
          w.apiSecretEncrypted &&
          w.marketType === 'FUTURES'
      );

      for (const wallet of futuresWallets) {
        if (!this.connections.has(wallet.id)) {
          await this.subscribeWallet(wallet);
        }
      }
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        '[FuturesUserStream] Error subscribing active wallets'
      );
    }
  }

  async subscribeWallet(wallet: Wallet): Promise<void> {
    if (isPaperWallet(wallet)) {
      logger.warn({ walletId: wallet.id }, '[FuturesUserStream] Skipping subscribe — paper wallet');
      return;
    }

    if (this.connections.has(wallet.id)) {
      logger.warn({ walletId: wallet.id }, '[FuturesUserStream] Skipping subscribe — wallet already connected');
      return;
    }
    logger.warn({ walletId: wallet.id, marketType: wallet.marketType, exchange: wallet.exchange }, '[FuturesUserStream] subscribeWallet starting');

    try {
      const apiClient = createBinanceFuturesClient(wallet);

      const positionMode = await apiClient.getCurrentPositionMode();
      if (positionMode.dualSidePosition) {
        logger.error(
          { walletId: wallet.id },
          '[FuturesUserStream] Wallet is in hedge mode — MarketMind only supports one-way mode. Refusing to subscribe.'
        );
        return;
      }

      const walletType = getWalletType(wallet);

      const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
      const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

      const wsClient = new WebsocketClient(
        { api_key: apiKey, api_secret: apiSecret, beautify: true, testnet: walletType === 'testnet' },
        silentWsLogger
      );

      wsClient.on('message', (data) => {
        this.handleUserDataMessage(wallet.id, data);
      });

      wsClient.on('exception', (error) => {
        logger.error(
          {
            walletId: wallet.id,
            error: serializeError(error),
          },
          '[FuturesUserStream] WebSocket exception'
        );
      });

      // The SDK fires `'open'` on every socket attach — both the initial
      // connect and every internal reconnect from its pong-timeout path.
      // Refresh lastMessageAt here so the UI doesn't show `degraded` after
      // a clean SDK-driven reconnect on an otherwise-idle wallet.
      wsClient.on('open', (ctx) => {
        const health = this.walletHealth.get(wallet.id);
        if (health) {
          health.lastMessageAt = Date.now();
          if (health.healthStatus === 'degraded') {
            health.healthStatus = 'healthy';
          }
        }
        logger.warn({ walletId: wallet.id, wsKey: (ctx as { wsKey?: string } | undefined)?.wsKey }, '[FuturesUserStream] Socket open');
      });

      wsClient.on('reconnecting', () => {
        const health = this.walletHealth.get(wallet.id);
        if (health) {
          health.healthStatus = 'degraded';
          health.lastReconnectAt = Date.now();
        }
        logger.warn({ walletId: wallet.id }, '[FuturesUserStream] SDK reconnecting');
      });

      wsClient.on('close', (ctx) => {
        logger.warn({ walletId: wallet.id, wsKey: (ctx as { wsKey?: string } | undefined)?.wsKey }, '[FuturesUserStream] Socket close');
      });

      wsClient.on('response', (response) => {
        logger.warn({ walletId: wallet.id, response: JSON.stringify(response).slice(0, 500) }, '[FuturesUserStream] SDK response');
      });

      wsClient.on('reconnected', () => {
        logger.info({ walletId: wallet.id }, '[FuturesUserStream] Reconnected - triggering full sync');

        void (async () => {
          try {
            this.invalidateWalletCache(wallet.id);
            const currentWallet = await this.getCachedWallet(wallet.id);
            if (currentWallet) {
              const syncResult = await positionSyncService.syncWallet(currentWallet);
              logger.info(
                {
                  walletId: wallet.id,
                  orphanedPositions: syncResult.changes.orphanedPositions.length,
                  unknownPositions: syncResult.changes.unknownPositions.length,
                  updatedPositions: syncResult.changes.updatedPositions.length,
                  balanceUpdated: syncResult.changes.balanceUpdated,
                },
                '[FuturesUserStream] Post-reconnect sync completed'
              );

              // Order-table reconciliation. Same as forceReconnectWallet —
              // see that path for full rationale. Without this, fills /
              // cancellations that arrived during the disconnect leave
              // orders rows stuck at NEW until the next 30s periodic
              // sweep, and the chart's pending lines stay visible.
              try {
                const { orderSyncService } = await import('./order-sync');
                const orderResult = await orderSyncService.syncWallet(currentWallet);
                if (orderResult.synced) {
                  logger.info(
                    { walletId: wallet.id, orphanOrders: orderResult.orphanOrders.length, fixedOrders: orderResult.fixedOrders.length },
                    '[FuturesUserStream] Post-reconnect order sync completed',
                  );
                }
              } catch (orderSyncError) {
                logger.error(
                  { walletId: wallet.id, error: serializeError(orderSyncError) },
                  '[FuturesUserStream] Post-reconnect order sync failed',
                );
              }

              // Same income-event recovery as forceReconnectWallet —
              // funding / commission / realized-pnl events flow on a
              // separate Binance channel and may have been missed
              // during the disconnect.
              try {
                const { syncWalletIncome } = await import('./income-events/syncFromBinance');
                const incomeResult = await syncWalletIncome(currentWallet);
                if (incomeResult.inserted > 0 || incomeResult.linked > 0) {
                  logger.info(
                    {
                      walletId: wallet.id,
                      fetched: incomeResult.fetched,
                      inserted: incomeResult.inserted,
                      linked: incomeResult.linked,
                    },
                    '[FuturesUserStream] Post-reconnect income recovery completed',
                  );
                }
              } catch (incomeError) {
                logger.error(
                  { walletId: wallet.id, error: serializeError(incomeError) },
                  '[FuturesUserStream] Post-reconnect income recovery failed',
                );
              }
            }
          } catch (syncError) {
            logger.error(
              {
                walletId: wallet.id,
                error: serializeError(syncError),
              },
              '[FuturesUserStream] Post-reconnect sync failed'
            );
          }
        })();
      });

      // User-data must go through the private subdomain — Binance split
      // the USDM URL on 2026-03-06 (legacy `usdm` deprecated 2026-04-23).
      // The SDK ≥3.5.6 coerces `usdm` → `usdmPrivate` defensively, but we
      // pick the explicit private key to be safe + clear at the call site.
      const wsKey: WsKey = walletType === 'testnet' ? 'usdmTestnetPrivate' : 'usdmPrivate';
      await wsClient.subscribeUsdFuturesUserDataStream(wsKey);

      this.connections.set(wallet.id, { wsClient, apiClient });
      this.walletHealth.set(wallet.id, {
        lastMessageAt: Date.now(),
        lastReconnectAt: 0,
        healthStatus: 'healthy',
      });

      logger.warn({ walletId: wallet.id, walletType }, '[FuturesUserStream] Subscribed successfully');
    } catch (error) {
      logger.error(
        {
          walletId: wallet.id,
          error: serializeError(error),
        },
        '[FuturesUserStream] Failed to subscribe'
      );
    }
  }

  private firstMessageLoggedFor = new Set<string>();

  private handleUserDataMessage(walletId: string, data: unknown): void {
    try {
      this.recordUserStreamActivity(walletId);
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;
      const eventType = message['e'] as string;

      // One-shot warn-level confirmation that the WS stream is actually
      // delivering — without this, a silently-broken subscribe just shows
      // up as a quiet stream and "events never arrived" is the only signal.
      if (!this.firstMessageLoggedFor.has(walletId)) {
        this.firstMessageLoggedFor.add(walletId);
        logger.warn({ walletId, eventType }, '[FuturesUserStream] First WS event received');
      }

      // Persist every WS event before dispatch so we can reconstruct
      // exactly what arrived from Binance during any reported incident.
      // Cheap (one JSON line per event); rotates daily by UTC date.
      logBinanceEvent(walletId, 'usdm', message);

      switch (eventType) {
        case 'ORDER_TRADE_UPDATE':
          void handleOrderUpdateFn(this, walletId, message as unknown as FuturesOrderUpdate);
          break;
        case 'ACCOUNT_UPDATE':
          void handleAccountUpdateFn(this, walletId, message as unknown as FuturesAccountUpdate);
          break;
        case 'MARGIN_CALL':
          void handleMarginCallFn(this, walletId, message as unknown as FuturesMarginCall);
          break;
        case 'ACCOUNT_CONFIG_UPDATE':
          handleConfigUpdateFn(this, walletId, message as unknown as FuturesAccountConfigUpdate);
          break;
        case 'ALGO_UPDATE':
          void handleAlgoOrderUpdateFn(this, walletId, message as unknown as FuturesAlgoOrderUpdate);
          break;
        case 'CONDITIONAL_ORDER_TRIGGER_REJECT':
          void handleConditionalOrderRejectFn(this, walletId, message as unknown as FuturesConditionalOrderReject);
          break;
        case 'listenKeyExpired':
          logger.warn({ walletId }, '[FuturesUserStream] Listen key expired - will reconnect');
          void this.resubscribeWallet(walletId);
          break;
        case 'TRADE_LITE':
        case 'STRATEGY_UPDATE':
        case 'GRID_UPDATE':
          logger.trace({ walletId, eventType }, '[FuturesUserStream] Known non-essential event — ignored');
          break;
        default:
          logger.warn({ walletId, eventType }, '[FuturesUserStream] Unhandled event type');
      }
    } catch (error) {
      logger.error(
        {
          walletId,
          error: serializeError(error),
        },
        '[FuturesUserStream] Error handling message'
      );
    }
  }

  private async resubscribeWallet(walletId: string): Promise<void> {
    try {
      this.unsubscribeWallet(walletId);
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.invalidateWalletCache(walletId);
      const wallet = await this.getCachedWallet(walletId);
      if (wallet && wallet.isActive && !isPaperWallet(wallet) && wallet.marketType === 'FUTURES') {
        await this.subscribeWallet(wallet);
        logger.info({ walletId }, '[FuturesUserStream] Successfully resubscribed after listenKey expiry');
        // v1.6 Track F.2 — listenKey expiry means missed events while
        // we were offline. Force the renderer to re-fetch state.
        const wsService = getWebSocketService();
        wsService?.emitStreamReconnected(walletId, {
          source: 'user',
          reason: 'listenkey_expired',
        });
      }
    } catch (error) {
      logger.error(
        { walletId, error: serializeError(error) },
        '[FuturesUserStream] Failed to resubscribe wallet'
      );
    }
  }

  unsubscribeWallet(walletId: string): void {
    const connection = this.connections.get(walletId);
    if (connection) {
      connection.wsClient.closeAll(true);
      this.connections.delete(walletId);
      this.walletHealth.delete(walletId);
      logger.info({ walletId }, '[FuturesUserStream] Unsubscribed');
    }
  }

  isWalletSubscribed(walletId: string): boolean {
    return this.connections.has(walletId);
  }

  getHealthSnapshot(): Array<{ walletId: string; healthStatus: 'healthy' | 'degraded'; silenceMs: number; lastReconnectAt: number }> {
    const now = Date.now();
    return Array.from(this.walletHealth.entries()).map(([walletId, state]) => ({
      walletId,
      healthStatus: state.healthStatus,
      silenceMs: now - state.lastMessageAt,
      lastReconnectAt: state.lastReconnectAt,
    }));
  }
}

export const binanceFuturesUserStreamService = new BinanceFuturesUserStreamService();
