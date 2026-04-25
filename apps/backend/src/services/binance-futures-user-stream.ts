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
  private static readonly HEALTH_CHECK_INTERVAL_MS = 15_000;
  private static readonly STALE_THRESHOLD_MS = 60_000;
  private static readonly FORCED_RECONNECT_COOLDOWN_MS = 120_000;

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

    const hasProtection = freshExec.stopLoss || freshExec.takeProfit;
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
    }

    logger.info({ executionId: freshExec.id, symbol, newAvgPrice, newQty, deleteExecId }, `[FuturesUserStream] ${logContext || 'Pyramided into existing position'} + emitted WS`);
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
      () => { void this.checkUserStreamHealth(); },
      BinanceFuturesUserStreamService.HEALTH_CHECK_INTERVAL_MS,
    );
  }

  private stopHealthWatchdog(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async checkUserStreamHealth(): Promise<void> {
    const now = Date.now();
    for (const [walletId, health] of this.walletHealth) {
      const silenceMs = now - health.lastMessageAt;

      if (silenceMs > BinanceFuturesUserStreamService.STALE_THRESHOLD_MS && health.healthStatus === 'healthy') {
        health.healthStatus = 'degraded';
        logger.warn(
          { walletId, silenceMs, lastMessageAt: new Date(health.lastMessageAt).toISOString() },
          '[FuturesUserStream] User stream silent — marking degraded',
        );

        if (now - health.lastReconnectAt > BinanceFuturesUserStreamService.FORCED_RECONNECT_COOLDOWN_MS) {
          health.lastReconnectAt = now;
          await this.forceReconnectWallet(walletId, `silent for ${Math.floor(silenceMs / 1000)}s`);
        }
      } else if (silenceMs <= BinanceFuturesUserStreamService.STALE_THRESHOLD_MS && health.healthStatus === 'degraded') {
        health.healthStatus = 'healthy';
        logger.info({ walletId }, '[FuturesUserStream] User stream recovered');
      }
    }
  }

  private async forceReconnectWallet(walletId: string, reason: string): Promise<void> {
    logger.warn({ walletId, reason }, '[FuturesUserStream] Forcing reconnect');
    try {
      this.unsubscribeWallet(walletId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.invalidateWalletCache(walletId);

      const wallet = await this.getCachedWallet(walletId);
      if (!wallet || !wallet.isActive || isPaperWallet(wallet) || wallet.marketType !== 'FUTURES') {
        logger.info({ walletId }, '[FuturesUserStream] Skipping reconnect — wallet no longer eligible');
        return;
      }

      await this.subscribeWallet(wallet);

      try {
        const syncResult = await positionSyncService.syncWallet(wallet);
        logger.info(
          {
            walletId,
            orphanedPositions: syncResult.changes.orphanedPositions.length,
            unknownPositions: syncResult.changes.unknownPositions.length,
            updatedPositions: syncResult.changes.updatedPositions.length,
            balanceUpdated: syncResult.changes.balanceUpdated,
          },
          '[FuturesUserStream] Post-forced-reconnect REST sync completed',
        );
      } catch (syncError) {
        logger.error(
          { walletId, error: serializeError(syncError) },
          '[FuturesUserStream] Post-forced-reconnect REST sync failed',
        );
      }
    } catch (error) {
      logger.error({ walletId, error: serializeError(error) }, '[FuturesUserStream] forceReconnectWallet failed');
    }
  }

  private recordUserStreamActivity(walletId: string): void {
    const existing = this.walletHealth.get(walletId);
    if (!existing) return;
    existing.lastMessageAt = Date.now();
    if (existing.healthStatus === 'degraded') {
      existing.healthStatus = 'healthy';
      logger.info({ walletId }, '[FuturesUserStream] User stream recovered on message receipt');
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
      return;
    }

    if (this.connections.has(wallet.id)) {
      return;
    }

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

      const wsKey: WsKey = walletType === 'testnet' ? 'usdmTestnet' : 'usdm';
      await wsClient.subscribeUsdFuturesUserDataStream(wsKey);

      this.connections.set(wallet.id, { wsClient, apiClient });
      this.walletHealth.set(wallet.id, {
        lastMessageAt: Date.now(),
        lastReconnectAt: 0,
        healthStatus: 'healthy',
      });

      logger.info({ walletId: wallet.id, walletType }, '[FuturesUserStream] Subscribed successfully');
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

  private handleUserDataMessage(walletId: string, data: unknown): void {
    try {
      this.recordUserStreamActivity(walletId);
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;
      const eventType = message['e'] as string;

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
