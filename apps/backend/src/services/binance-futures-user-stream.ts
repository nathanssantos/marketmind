import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { createBinanceFuturesClient, isPaperWallet, getWalletType, getPosition } from './binance-futures-client';
import { createStopLossOrder, createTakeProfitOrder, cancelAllOpenProtectionOrdersOnExchange } from './protection-orders';
import type { ProtectionOrderResult } from './protection-orders';
import { decryptApiKey } from './encryption';
import { logger, serializeError } from './logger';
import { positionSyncService } from './position-sync';
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

export class BinanceFuturesUserStreamService implements UserStreamContext {
  connections: Map<string, { wsClient: WebsocketClient; apiClient: USDMClient }> = new Map();
  private isRunning = false;
  private walletSubscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private pyramidQueues = new Map<string, Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }>>();
  private pyramidActive = new Set<string>();
  private pendingSlTpUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  recentAlgoEntrySymbols = new Map<string, number>();
  private walletCache = new Map<string, { wallet: Wallet; cachedAt: number }>();

  private static readonly PYRAMID_SLTP_DEBOUNCE_MS = 3000;
  private static readonly PYRAMID_LOCK_TIMEOUT_MS = 30_000;
  private static readonly WALLET_CACHE_TTL_MS = 60_000;

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

    const timer = setTimeout(async () => {
      this.pendingSlTpUpdates.delete(key);
      try {
        const [execution] = await db
          .select()
          .from(tradeExecutions)
          .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.status, 'open')))
          .limit(1);
        if (!execution) return;

        const walletRow = await this.getCachedWallet(walletId);
        if (!walletRow) return;

        const slPrice = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
        const tpPrice = execution.takeProfit ? parseFloat(execution.takeProfit) : null;
        if (!slPrice && !tpPrice) return;

        const qty = parseFloat(execution.quantity);

        await cancelAllOpenProtectionOrdersOnExchange({ wallet: walletRow, symbol, marketType: 'FUTURES' });

        let newSlResult: ProtectionOrderResult | null = null;
        let newTpResult: ProtectionOrderResult | null = null;

        if (slPrice) {
          try {
            newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: slPrice, marketType: 'FUTURES' });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('Unknown order') || msg.includes('-2011')) {
              await new Promise(r => setTimeout(r, 100));
              try {
                newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: slPrice, marketType: 'FUTURES' });
              } catch (retryErr) {
                logger.error({ error: serializeError(retryErr), symbol, executionId }, '[FuturesUserStream] CRITICAL: Failed to place debounced SL after retry');
              }
            } else {
              logger.error({ error: serializeError(e), symbol, executionId }, '[FuturesUserStream] CRITICAL: Failed to place debounced SL — position may be unprotected');
            }
          }
        }
        if (tpPrice) {
          try {
            newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: tpPrice, marketType: 'FUTURES' });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('Unknown order') || msg.includes('-2011')) {
              await new Promise(r => setTimeout(r, 100));
              try {
                newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: tpPrice, marketType: 'FUTURES' });
              } catch (retryErr) {
                logger.error({ error: serializeError(retryErr), symbol, executionId }, '[FuturesUserStream] CRITICAL: Failed to place debounced TP after retry');
              }
            } else {
              logger.error({ error: serializeError(e), symbol, executionId }, '[FuturesUserStream] CRITICAL: Failed to place debounced TP — position may be unprotected');
            }
          }
        }

        const slUpdate: Record<string, unknown> = {};
        if (newSlResult) {
          slUpdate.stopLossAlgoId = newSlResult.isAlgoOrder ? (newSlResult.algoId ?? null) : null;
          slUpdate.stopLossOrderId = newSlResult.isAlgoOrder ? null : (newSlResult.orderId ?? null);
          slUpdate.stopLossIsAlgo = newSlResult.isAlgoOrder;
        } else if (slPrice) {
          slUpdate.stopLossAlgoId = null;
          slUpdate.stopLossOrderId = null;
          slUpdate.stopLossIsAlgo = false;
        }

        const tpUpdate: Record<string, unknown> = {};
        if (newTpResult) {
          tpUpdate.takeProfitAlgoId = newTpResult.isAlgoOrder ? (newTpResult.algoId ?? null) : null;
          tpUpdate.takeProfitOrderId = newTpResult.isAlgoOrder ? null : (newTpResult.orderId ?? null);
          tpUpdate.takeProfitIsAlgo = newTpResult.isAlgoOrder;
        } else if (tpPrice) {
          tpUpdate.takeProfitAlgoId = null;
          tpUpdate.takeProfitOrderId = null;
          tpUpdate.takeProfitIsAlgo = false;
        }

        await db.update(tradeExecutions).set({
          ...slUpdate,
          ...tpUpdate,
          updatedAt: new Date(),
        }).where(eq(tradeExecutions.id, executionId));

        logger.info({ executionId, symbol, qty }, '[FuturesUserStream] Debounced SL/TP update after pyramid');
      } catch (e) {
        logger.error({ error: serializeError(e), executionId, symbol }, '[FuturesUserStream] Debounced SL/TP update failed');
      }
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
      } catch {}
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

    logger.info({ executionId: freshExec.id, symbol, newAvgPrice, newQty }, `[FuturesUserStream] ${logContext || 'Pyramided into existing position'}`);
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
      if (!freshExec || freshExec.status !== 'open') return false;

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

  async verifyAlgoFillProcessed(walletId: string, executionId: string, symbol: string, side: 'LONG' | 'SHORT', openedAt: number, exitReason: string): Promise<void> {
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
  }

  stop(): void {
    this.isRunning = false;

    if (this.walletSubscriptionInterval) {
      clearInterval(this.walletSubscriptionInterval);
      this.walletSubscriptionInterval = null;
    }

    for (const [walletId, connection] of this.connections) {
      connection.wsClient.closeAll(true);
      this.connections.delete(walletId);
    }

    this.shutdown();
    logger.info('[FuturesUserStream] Service stopped');
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
        default:
          logger.trace({ walletId, eventType }, '[FuturesUserStream] Unhandled event type');
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
        await this.subscribeWallet(wallet as Wallet);
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
      logger.info({ walletId }, '[FuturesUserStream] Unsubscribed');
    }
  }

  isWalletSubscribed(walletId: string): boolean {
    return this.connections.has(walletId);
  }
}

export const binanceFuturesUserStreamService = new BinanceFuturesUserStreamService();
