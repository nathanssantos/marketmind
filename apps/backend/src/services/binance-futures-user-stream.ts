import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, orders, type Wallet } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { calculatePnl } from '../utils/pnl-calculator';
import { createBinanceFuturesClient, isPaperWallet, getWalletType, cancelFuturesAlgoOrder, getOrderEntryFee, getLastClosingTrade, getAllTradeFeesForPosition, getPosition, closePosition } from './binance-futures-client';
import { createStopLossOrder, createTakeProfitOrder, cancelAllOpenProtectionOrdersOnExchange, cancelAllProtectionOrders } from './protection-orders';
import { generateEntityId } from '../utils/id';
import { decryptApiKey } from './encryption';
import {
  detectExitReason,
  isClosingSide,
  clearProtectionOrderIds,
  type ProtectionOrderField,
} from './execution-manager';
import { logger, serializeError } from './logger';
import { positionSyncService } from './position-sync';
import { binancePriceStreamService } from './binance-price-stream';
import { getWebSocketService } from './websocket';

interface FuturesAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;
  T: number;
  a: {
    m: string;
    B: Array<{ a: string; wb: string; cw: string; bc: string }>;
    P: Array<{
      s: string;
      pa: string;
      ep: string;
      cr: string;
      up: string;
      mt: string;
      iw: string;
      ps: string;
    }>;
  };
}

interface FuturesOrderUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;
  T: number;
  o: {
    s: string;
    c: string;
    S: 'BUY' | 'SELL';
    o: string;
    f: string;
    q: string;
    p: string;
    ap: string;
    sp: string;
    x: string;
    X: string;
    i: number;
    l: string;
    z: string;
    L: string;
    n: string;
    N: string;
    T: number;
    t: number;
    rp: string;
    ps: 'LONG' | 'SHORT' | 'BOTH';
  };
}

interface FuturesMarginCall {
  e: 'MARGIN_CALL';
  E: number;
  cw: string;
  p: Array<{
    s: string;
    ps: string;
    pa: string;
    mt: string;
    iw: string;
    mp: string;
    up: string;
    mm: string;
  }>;
}

interface FuturesAccountConfigUpdate {
  e: 'ACCOUNT_CONFIG_UPDATE';
  E: number;
  T: number;
  ac?: {
    s: string;
    l: number;
  };
  ai?: {
    j: boolean;
  };
}

interface FuturesAlgoOrderUpdate {
  e: 'ALGO_UPDATE';
  E: number;
  T: number;
  o: {
    aid: number;
    caid: string;
    at: string;
    s: string;
    S: 'BUY' | 'SELL';
    o: string;
    ps: 'LONG' | 'SHORT' | 'BOTH';
    f: string;
    q: string;
    X: 'NEW' | 'CANCELED' | 'TRIGGERING' | 'TRIGGERED' | 'FINISHED' | 'REJECTED' | 'EXPIRED';
    ai: string;
    ap: string;
    aq: string;
    tp: string;
    p: string;
    wt: string;
    R: boolean;
    cp: boolean;
    pP: boolean;
  };
}

interface FuturesConditionalOrderReject {
  e: 'CONDITIONAL_ORDER_TRIGGER_REJECT';
  E: number;
  T: number;
  or: {
    s: string;
    i: number;
    r: string;
  };
}

export class BinanceFuturesUserStreamService {
  private connections: Map<string, { wsClient: WebsocketClient; apiClient: USDMClient }> = new Map();
  private isRunning = false;
  private walletSubscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private pyramidLocks = new Map<string, Promise<void>>();
  private pendingSlTpUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  private recentAlgoEntrySymbols = new Map<string, number>();

  private static readonly PYRAMID_SLTP_DEBOUNCE_MS = 3000;

  private async withPyramidLock<T>(walletId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
    const key = `${walletId}:${symbol}`;
    while (this.pyramidLocks.has(key)) {
      await this.pyramidLocks.get(key);
    }
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });
    this.pyramidLocks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      releaseLock!();
      this.pyramidLocks.delete(key);
    }
  }

  private scheduleDebouncedSlTpUpdate(executionId: string, walletId: string, symbol: string): void {
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

        const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
        if (!walletRow) return;

        const slPrice = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
        const tpPrice = execution.takeProfit ? parseFloat(execution.takeProfit) : null;
        if (!slPrice && !tpPrice) return;

        const qty = parseFloat(execution.quantity);

        await cancelAllOpenProtectionOrdersOnExchange({ wallet: walletRow, symbol, marketType: 'FUTURES' });

        let newSlResult: import('./protection-orders').ProtectionOrderResult | null = null;
        let newTpResult: import('./protection-orders').ProtectionOrderResult | null = null;

        if (slPrice) {
          try {
            newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: slPrice, marketType: 'FUTURES' });
          } catch (e) {
            logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place debounced SL after pyramid');
          }
        }
        if (tpPrice) {
          try {
            newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: tpPrice, marketType: 'FUTURES' });
          } catch (e) {
            logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place debounced TP after pyramid');
          }
        }

        await db.update(tradeExecutions).set({
          stopLossAlgoId: newSlResult?.isAlgoOrder ? (newSlResult.algoId ?? null) : (slPrice ? null : execution.stopLossAlgoId),
          takeProfitAlgoId: newTpResult?.isAlgoOrder ? (newTpResult.algoId ?? null) : (tpPrice ? null : execution.takeProfitAlgoId),
          stopLossOrderId: (newSlResult && !newSlResult.isAlgoOrder) ? (newSlResult.orderId ?? null) : (slPrice ? null : execution.stopLossOrderId),
          takeProfitOrderId: (newTpResult && !newTpResult.isAlgoOrder) ? (newTpResult.orderId ?? null) : (tpPrice ? null : execution.takeProfitOrderId),
          stopLossIsAlgo: newSlResult?.isAlgoOrder ?? execution.stopLossIsAlgo ?? false,
          takeProfitIsAlgo: newTpResult?.isAlgoOrder ?? execution.takeProfitIsAlgo ?? false,
          updatedAt: new Date(),
        }).where(eq(tradeExecutions.id, executionId));

        logger.info({ executionId, symbol, qty }, '[FuturesUserStream] Debounced SL/TP update after pyramid');
      } catch (e) {
        logger.error({ error: serializeError(e), executionId, symbol }, '[FuturesUserStream] Debounced SL/TP update failed');
      }
    }, BinanceFuturesUserStreamService.PYRAMID_SLTP_DEBOUNCE_MS);

    this.pendingSlTpUpdates.set(key, timer);
  }

  private async mergeIntoExistingPosition(
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

    let newQty = parseFloat(freshExec.quantity) + addedQty;
    let newAvgPrice = ((parseFloat(freshExec.quantity) * parseFloat(freshExec.entryPrice)) + (addedQty * addedPrice)) / newQty;

    const connection = this.connections.get(walletId);
    if (connection) {
      try {
        const exchangePos = await getPosition(connection.apiClient, symbol);
        if (exchangePos) {
          const exchangeQty = Math.abs(parseFloat(exchangePos.positionAmt));
          const exchangePrice = parseFloat(exchangePos.entryPrice);
          if (exchangeQty > 0) {
            newQty = exchangeQty;
            newAvgPrice = exchangePrice;
          }
        }
      } catch (e) {
        logger.warn({ symbol, error: serializeError(e) }, '[FuturesUserStream] Failed to sync position from exchange after pyramid - using calculated values');
      }
    }

    await db.update(tradeExecutions).set({
      entryPrice: newAvgPrice.toString(),
      quantity: newQty.toString(),
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, freshExec.id));

    if (deleteExecId) {
      await db.delete(tradeExecutions).where(eq(tradeExecutions.id, deleteExecId));
    }

    const hasProtection = freshExec.stopLoss || freshExec.takeProfit;
    if (hasProtection) this.scheduleDebouncedSlTpUpdate(freshExec.id, walletId, symbol);

    logger.info({ executionId: freshExec.id, symbol, newAvgPrice, newQty }, `[FuturesUserStream] ${logContext || 'Pyramided into existing position'}`);
  }

  private async syncPositionFromExchange(walletId: string, symbol: string, executionId: string, logContext: string): Promise<boolean> {
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

      if (Math.abs(currentQty - exchangeQty) < 1e-6 && Math.abs(currentPrice - exchangePrice) < 1e-8) {
        logger.trace({ executionId, symbol }, `[FuturesUserStream] ${logContext} — already in sync`);
        return false;
      }

      await db.update(tradeExecutions).set({
        quantity: exchangeQty.toString(),
        entryPrice: exchangePrice.toString(),
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
            const [currentWallet] = await db.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1);
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
          void this.handleOrderUpdate(walletId, message as unknown as FuturesOrderUpdate);
          break;
        case 'ACCOUNT_UPDATE':
          void this.handleAccountUpdate(walletId, message as unknown as FuturesAccountUpdate);
          break;
        case 'MARGIN_CALL':
          void this.handleMarginCall(walletId, message as unknown as FuturesMarginCall);
          break;
        case 'ACCOUNT_CONFIG_UPDATE':
          this.handleConfigUpdate(walletId, message as unknown as FuturesAccountConfigUpdate);
          break;
        case 'ALGO_UPDATE':
          void this.handleAlgoOrderUpdate(walletId, message as unknown as FuturesAlgoOrderUpdate);
          break;
        case 'CONDITIONAL_ORDER_TRIGGER_REJECT':
          void this.handleConditionalOrderReject(walletId, message as unknown as FuturesConditionalOrderReject);
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

  private async handleOrderUpdate(walletId: string, event: FuturesOrderUpdate): Promise<void> {
    try {
      const {
        o: {
          s: symbol,
          S: orderSide,
          X: status,
          x: execType,
          i: orderId,
          L: lastFilledPrice,
          z: executedQty,
          ap: avgPrice,
          rp: realizedProfit,
          ps: positionSide,
          n: commission,
          N: commissionAsset,
        },
      } = event;

      logger.info(
        {
          walletId,
          symbol,
          orderId,
          status,
          execType,
          positionSide,
        },
        '[FuturesUserStream] Order update received'
      );

      if (status === 'CANCELED') {
        await db
          .update(tradeExecutions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.entryOrderId, Number(orderId))
            )
          );
        return;
      }

      if (execType === 'TRADE' && status === 'PARTIALLY_FILLED') {
        const {
          o: { q: origQty },
        } = event;
        const filledQty = parseFloat(executedQty);
        const originalQty = parseFloat(origQty);

        const [pendingExec] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.marketType, 'FUTURES'),
              eq(tradeExecutions.entryOrderId, Number(orderId))
            )
          )
          .limit(1);

        if (pendingExec) {
          await db.update(tradeExecutions).set({
            quantity: filledQty.toString(),
            updatedAt: new Date(),
          }).where(eq(tradeExecutions.id, pendingExec.id));

          logger.info({
            executionId: pendingExec.id,
            symbol,
            filledQty,
            originalQty,
            remaining: originalQty - filledQty,
          }, '[FuturesUserStream] Partial fill - updated quantity with filled amount');
        }
        return;
      }

      if (execType === 'TRADE' && status === 'FILLED') {
        const [pendingExecution] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.marketType, 'FUTURES'),
              eq(tradeExecutions.entryOrderId, Number(orderId))
            )
          )
          .limit(1);

        if (pendingExecution) {
          const fillPrice = parseFloat(avgPrice || lastFilledPrice);
          const fillQty = parseFloat(executedQty || pendingExecution.quantity);
          let entryFee = parseFloat(commission || '0');

          try {
            const connection = this.connections.get(walletId);
            if (connection) {
              const feeResult = await getOrderEntryFee(connection.apiClient, symbol, Number(orderId));
              if (feeResult && feeResult.entryFee > 0) entryFee = feeResult.entryFee;
            }
          } catch (_e) { /* entry fee fetch is best-effort */ }

          const [existingOpen] = await db
            .select()
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, walletId),
                eq(tradeExecutions.symbol, symbol),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
            .limit(1);

          if (existingOpen && existingOpen.side === pendingExecution.side) {
            await this.withPyramidLock(walletId, symbol, async () => {
              await this.mergeIntoExistingPosition(walletId, symbol, existingOpen.id, fillQty, fillPrice, pendingExecution.id, 'Pyramided via LIMIT order into existing position');
            });
            return;
          }

          if (existingOpen && existingOpen.side !== pendingExecution.side) {
            await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingExecution.id));
            logger.info(
              { executionId: pendingExecution.id, symbol, orderId, existingSide: existingOpen.side },
              '[FuturesUserStream] Reduce order filled — deleted pending execution, close handled via rp path'
            );
          } else {
            logger.info(
              {
                executionId: pendingExecution.id,
                symbol,
                orderId,
                fillPrice,
                entryFee,
                commissionAsset,
              },
              '[FuturesUserStream] ✓ Pending LIMIT order FILLED - activating position'
            );

            let activationSlAlgoId = pendingExecution.stopLossAlgoId;
            let activationTpAlgoId = pendingExecution.takeProfitAlgoId;
            let activationSlOrderId = pendingExecution.stopLossOrderId;
            let activationTpOrderId = pendingExecution.takeProfitOrderId;
            let activationSlIsAlgo = pendingExecution.stopLossIsAlgo;
            let activationTpIsAlgo = pendingExecution.takeProfitIsAlgo;

            const needsSlPlacement = !!pendingExecution.setupId && !pendingExecution.stopLossAlgoId && !pendingExecution.stopLossOrderId && pendingExecution.stopLoss;
            const needsTpPlacement = !!pendingExecution.setupId && !pendingExecution.takeProfitAlgoId && !pendingExecution.takeProfitOrderId && pendingExecution.takeProfit;

            if (needsSlPlacement || needsTpPlacement) {
              const [walletForActivation] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
              if (walletForActivation) {
                if (needsSlPlacement) {
                  try {
                    const slRes = await createStopLossOrder({ wallet: walletForActivation, symbol, side: pendingExecution.side, quantity: parseFloat(pendingExecution.quantity), triggerPrice: parseFloat(pendingExecution.stopLoss!), marketType: 'FUTURES' });
                    activationSlAlgoId = slRes.isAlgoOrder ? (slRes.algoId ?? null) : null;
                    activationSlOrderId = !slRes.isAlgoOrder ? (slRes.orderId ?? null) : null;
                    activationSlIsAlgo = slRes.isAlgoOrder;
                  } catch (e) {
                    logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place SL on manual LIMIT activation');
                  }
                }
                if (needsTpPlacement) {
                  try {
                    const tpRes = await createTakeProfitOrder({ wallet: walletForActivation, symbol, side: pendingExecution.side, quantity: parseFloat(pendingExecution.quantity), triggerPrice: parseFloat(pendingExecution.takeProfit!), marketType: 'FUTURES' });
                    activationTpAlgoId = tpRes.isAlgoOrder ? (tpRes.algoId ?? null) : null;
                    activationTpOrderId = !tpRes.isAlgoOrder ? (tpRes.orderId ?? null) : null;
                    activationTpIsAlgo = tpRes.isAlgoOrder;
                  } catch (e) {
                    logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place TP on manual LIMIT activation');
                  }
                }
              }
            }

            await db
              .update(tradeExecutions)
              .set({
                status: 'open',
                entryPrice: fillPrice.toString(),
                quantity: fillQty.toString(),
                entryFee: entryFee.toString(),
                commissionAsset: commissionAsset || 'USDT',
                openedAt: new Date(),
                updatedAt: new Date(),
                stopLossAlgoId: activationSlAlgoId,
                takeProfitAlgoId: activationTpAlgoId,
                stopLossOrderId: activationSlOrderId,
                takeProfitOrderId: activationTpOrderId,
                stopLossIsAlgo: activationSlIsAlgo,
                takeProfitIsAlgo: activationTpIsAlgo,
              })
              .where(eq(tradeExecutions.id, pendingExecution.id));

            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitPositionUpdate(walletId, {
                ...pendingExecution,
                status: 'open',
                entryPrice: fillPrice.toString(),
              });
            }

            return;
          }
        }

        const openExecutions = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          );

        const executionByOrderId = openExecutions.find(e =>
          (e.stopLossOrderId && Number(e.stopLossOrderId) === Number(orderId)) ||
          (e.stopLossAlgoId && Number(e.stopLossAlgoId) === Number(orderId)) ||
          (e.takeProfitOrderId && Number(e.takeProfitOrderId) === Number(orderId)) ||
          (e.takeProfitAlgoId && Number(e.takeProfitAlgoId) === Number(orderId))
        );

        const executionByExitReason = !executionByOrderId
          ? openExecutions.find(e => e.exitReason === 'STOP_LOSS' || e.exitReason === 'TAKE_PROFIT')
          : undefined;

        const execution = executionByOrderId || executionByExitReason || openExecutions[0];

        if (!execution) {
          const rp = parseFloat(realizedProfit || '0');
          if (rp !== 0) {
            logger.info({ walletId, symbol, orderId }, '[FuturesUserStream] Untracked close fill - ignoring');
            return;
          }

          const [manualOrder] = await db
            .select()
            .from(orders)
            .where(and(eq(orders.walletId, walletId), eq(orders.orderId, Number(orderId))))
            .limit(1);

          if (!manualOrder) {
            logger.warn({ walletId, symbol, orderId, openCount: openExecutions.length }, '[FuturesUserStream] No open execution found');
            return;
          }

          const direction: 'LONG' | 'SHORT' = orderSide === 'BUY' ? 'LONG' : 'SHORT';
          const fillPrice = parseFloat(avgPrice || lastFilledPrice);
          const fillQty = parseFloat(executedQty || manualOrder.origQty || '0');

          const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
          if (!walletRow) return;

          await db.insert(tradeExecutions).values({
            id: generateEntityId(),
            userId: walletRow.userId,
            walletId,
            symbol,
            side: direction,
            entryOrderId: Number(orderId),
            entryPrice: fillPrice.toString(),
            quantity: fillQty.toString(),
            status: 'open',
            openedAt: new Date(),
            entryOrderType: manualOrder.type === 'MARKET' ? 'MARKET' : 'LIMIT',
            marketType: 'FUTURES',
          });

          logger.info({ symbol, orderId, direction, fillPrice, fillQty }, '[FuturesUserStream] Created tradeExecution for manual order fill');
          return;
        }

        let isSLOrder = (execution.stopLossOrderId && Number(execution.stopLossOrderId) === Number(orderId)) ||
          (execution.stopLossAlgoId && Number(execution.stopLossAlgoId) === Number(orderId));
        let isTPOrder = (execution.takeProfitOrderId && Number(execution.takeProfitOrderId) === Number(orderId)) ||
          (execution.takeProfitAlgoId && Number(execution.takeProfitAlgoId) === Number(orderId));
        const isAlgoTriggerFill = !isSLOrder && !isTPOrder && execution.exitReason;

        if (!isSLOrder && !isTPOrder && !isAlgoTriggerFill) {
          const rpValue = parseFloat(realizedProfit || '0');
          const isClosingOrder = isClosingSide(execution.side, orderSide);

          if (rpValue !== 0 && isClosingOrder) {
            const exitPrice = parseFloat(avgPrice || lastFilledPrice);
            const entryPrice = parseFloat(execution.entryPrice);

            const detectedExitReason = detectExitReason(execution.side, entryPrice, exitPrice);

            isSLOrder = detectedExitReason === 'STOP_LOSS';
            isTPOrder = detectedExitReason === 'TAKE_PROFIT';

            logger.warn(
              {
                executionId: execution.id,
                symbol,
                orderId,
                realizedProfit: rpValue,
                exitPrice,
                entryPrice,
                detectedExitReason,
              },
              '[FuturesUserStream] ! Detected closing order via realizedProfit fallback - ALGO_UPDATE may have been missed'
            );
          } else {
            const isEntryFill = !isClosingOrder && rpValue === 0;

            if (isEntryFill && execution.entryOrderId && Number(execution.entryOrderId) === Number(orderId)) {
              logger.info({ executionId: execution.id, orderId }, '[FuturesUserStream] Entry fill for already-tracked manual execution - skipping');
              return;
            }

            if (isEntryFill) {
              const recentKey = `${walletId}:${symbol}`;
              const recentAlgoTime = this.recentAlgoEntrySymbols.get(recentKey);
              if (recentAlgoTime && Date.now() - recentAlgoTime < 10000) {
                this.recentAlgoEntrySymbols.delete(recentKey);
                await this.withPyramidLock(walletId, symbol, async () => {
                  await this.syncPositionFromExchange(walletId, symbol, execution.id, 'Synced position from exchange (algo entry fill followup)');
                });
                return;
              }

              await this.withPyramidLock(walletId, symbol, async () => {
                const fillPrice = parseFloat(avgPrice || lastFilledPrice);
                const fillQty = parseFloat(executedQty || '0');
                await this.mergeIntoExistingPosition(walletId, symbol, execution.id, fillQty, fillPrice, undefined, 'Pyramided into existing position');
              });
              return;
            }

            logger.warn(
              { walletId, symbol, orderId, executionId: execution.id },
              '[FuturesUserStream] Order not recognized as SL or TP'
            );
            return;
          }
        }

        if (isAlgoTriggerFill) {
          logger.info(
            {
              executionId: execution.id,
              orderId,
              exitReason: execution.exitReason,
            },
            '[FuturesUserStream] Processing fill from algo order trigger'
          );
        }

        const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

        if (!wallet) {
          throw new Error(`Wallet not found: ${walletId}`);
        }

        const apiClient = this.connections.get(walletId)?.apiClient;

        const shouldCancelTP = isSLOrder;
        const oppositeIsAlgo = shouldCancelTP ? execution.takeProfitIsAlgo : execution.stopLossIsAlgo;
        const orderToCancel = shouldCancelTP
          ? (execution.takeProfitIsAlgo ? execution.takeProfitAlgoId : execution.takeProfitOrderId)
          : (execution.stopLossIsAlgo ? execution.stopLossAlgoId : execution.stopLossOrderId);

        if (orderToCancel && apiClient && !isAlgoTriggerFill) {
          const maxRetries = 3;
          let cancelSuccess = false;

          for (let attempt = 1; attempt <= maxRetries && !cancelSuccess; attempt++) {
            try {
              if (oppositeIsAlgo) {
                await cancelFuturesAlgoOrder(apiClient, orderToCancel);
              } else {
                await apiClient.cancelOrder({ symbol, orderId: orderToCancel });
              }
              cancelSuccess = true;
              logger.info(
                {
                  executionId: execution.id,
                  cancelledOrderId: orderToCancel,
                  isAlgoOrder: oppositeIsAlgo,
                  reason: isSLOrder ? 'SL filled, cancelling TP' : 'TP filled, cancelling SL',
                },
                '[FuturesUserStream] Opposite order cancelled'
              );
            } catch (cancelError) {
              const errorMessage = serializeError(cancelError);
              if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist')) {
                cancelSuccess = true;
                logger.info(
                  { orderToCancel, isAlgoOrder: oppositeIsAlgo },
                  '[FuturesUserStream] Order already cancelled or executed'
                );
              } else if (attempt < maxRetries) {
                logger.warn(
                  { error: errorMessage, orderToCancel, attempt, maxRetries },
                  '[FuturesUserStream] Retry cancelling opposite order'
                );
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              } else {
                logger.error(
                  { error: errorMessage, orderToCancel, isAlgoOrder: oppositeIsAlgo },
                  '[FuturesUserStream] ! CRITICAL: Failed to cancel opposite order after retries - MANUAL CHECK REQUIRED'
                );
              }
            }
          }
        }

        const exitPrice = parseFloat(avgPrice || lastFilledPrice);
        const closedQty = parseFloat(executedQty);
        const entryPrice = parseFloat(execution.entryPrice);
        const leverage = execution.leverage || 1;
        const executionQty = parseFloat(execution.quantity);

        const connection = this.connections.get(walletId);
        if (connection) {
          try {
            const exchangePos = await getPosition(connection.apiClient, symbol);
            if (exchangePos) {
              const remainingQty = Math.abs(parseFloat(exchangePos.positionAmt));
              const exchangeEntryPrice = parseFloat(exchangePos.entryPrice);

              if (remainingQty > 0 && remainingQty < executionQty) {
                const partialPnl = execution.side === 'LONG'
                  ? (exitPrice - entryPrice) * closedQty
                  : (entryPrice - exitPrice) * closedQty;

                await db
                  .update(tradeExecutions)
                  .set({
                    quantity: remainingQty.toString(),
                    entryPrice: exchangeEntryPrice.toString(),
                    updatedAt: new Date(),
                  })
                  .where(eq(tradeExecutions.id, execution.id));

                await db
                  .update(wallets)
                  .set({
                    currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${partialPnl}`,
                    updatedAt: new Date(),
                  })
                  .where(eq(wallets.id, walletId));

                logger.info(
                  {
                    executionId: execution.id,
                    symbol,
                    closedQty,
                    remainingQty,
                    partialPnl: partialPnl.toFixed(4),
                    newEntryPrice: exchangeEntryPrice,
                  },
                  '[FuturesUserStream] Partial close detected — updated quantity, position remains open'
                );

                const hasProtection = execution.stopLoss || execution.takeProfit;
                if (hasProtection) this.scheduleDebouncedSlTpUpdate(execution.id, walletId, symbol);

                binancePriceStreamService.invalidateExecutionCache(symbol);

                const wsService = getWebSocketService();
                if (wsService) {
                  wsService.emitPositionUpdate(walletId, {
                    ...execution,
                    quantity: remainingQty.toString(),
                    entryPrice: exchangeEntryPrice.toString(),
                  });
                }

                return;
              }
            }
          } catch (_e) {
            logger.warn({ walletId, symbol }, '[FuturesUserStream] Failed to check exchange position for partial close detection');
          }
        }

        const quantity = closedQty;
        let actualExitFee = parseFloat(commission || '0');
        let actualEntryFee = parseFloat(execution.entryFee || '0');

        try {
          const connection = this.connections.get(walletId);
          if (connection) {
            const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
            const allFees = await getAllTradeFeesForPosition(connection.apiClient, symbol, execution.side, openedAt);
            if (allFees) {
              if (allFees.exitFee > 0) actualExitFee = allFees.exitFee;
              if (allFees.entryFee > 0) actualEntryFee = allFees.entryFee;
              logger.info({
                walletId, symbol, executionId: execution.id,
                eventCommission: parseFloat(commission || '0'),
                actualExitFee, actualEntryFee,
              }, '[FuturesUserStream] Fetched accurate fees from REST API');
            }
          }
        } catch (_e) {
          logger.warn({ walletId, symbol, executionId: execution.id }, '[FuturesUserStream] Failed to fetch accurate fees - using event commission');
        }

        if (actualEntryFee === 0 && execution.entryOrderId) {
          try {
            const connection = this.connections.get(walletId);
            if (connection) {
              const feeResult = await getOrderEntryFee(connection.apiClient, symbol, Number(execution.entryOrderId));
              if (feeResult) actualEntryFee = feeResult.entryFee;
            }
          } catch (_e) { /* entry fee fetch is best-effort */ }
        }

        const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');

        const pnlResult = calculatePnl({
          entryPrice,
          exitPrice,
          quantity,
          side: execution.side,
          marketType: 'FUTURES',
          leverage,
          accumulatedFunding,
          entryFee: actualEntryFee,
          exitFee: actualExitFee,
        });
        const pnl = pnlResult.netPnl;
        const pnlPercent = pnlResult.pnlPercent;
        const totalFees = actualEntryFee + actualExitFee;

        const determinedExitReason = isAlgoTriggerFill
          ? execution.exitReason
          : isSLOrder
            ? 'STOP_LOSS'
            : 'TAKE_PROFIT';

        const closeResult = await db
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: exitPrice.toString(),
            closedAt: new Date(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
            fees: totalFees.toString(),
            entryFee: actualEntryFee.toString(),
            exitFee: actualExitFee.toString(),
            exitSource: 'ALGORITHM',
            exitReason: determinedExitReason,
            stopLossAlgoId: null,
            stopLossOrderId: null,
            takeProfitAlgoId: null,
            takeProfitOrderId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(tradeExecutions.id, execution.id), eq(tradeExecutions.status, 'open')))
          .returning({ id: tradeExecutions.id });

        if (closeResult.length === 0) {
          logger.info(
            { executionId: execution.id, symbol },
            '[FuturesUserStream] Position already closed by another process - skipping'
          );
          return;
        }

        await db
          .update(wallets)
          .set({
            currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnl}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, walletId));

        logger.info(
          { walletId, pnl: pnl.toFixed(2) },
          '[FuturesUserStream] > Wallet balance updated atomically'
        );

        binancePriceStreamService.invalidateExecutionCache(symbol);

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitPositionUpdate(walletId, {
            ...execution,
            status: 'closed',
            exitPrice: exitPrice.toString(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
          });

          wsService.emitOrderUpdate(walletId, {
            id: execution.id,
            symbol,
            status: 'closed',
            exitPrice: exitPrice.toString(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
            exitReason: isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT',
          });
        }

        logger.info(
          {
            executionId: execution.id,
            symbol,
            exitPrice: exitPrice.toFixed(2),
            pnl: pnl.toFixed(2),
            pnlPercent: pnlPercent.toFixed(2),
            exitReason: isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT',
          },
          '[FuturesUserStream] Position closed via order fill'
        );

        void this.cancelPendingEntryOrders(walletId, symbol, execution.id);

        setTimeout(() => {
          void this.closeResidualPosition(walletId, symbol, execution.id);
        }, 3000);
      }
    } catch (error) {
      logger.error(
        {
          walletId,
          error: serializeError(error),
        },
        '[FuturesUserStream] Error handling order update'
      );
    }
  }

  private async handleAccountUpdate(walletId: string, event: FuturesAccountUpdate): Promise<void> {
    try {
      const { a: accountData } = event;
      const { m: reason, B: balances, P: positionUpdates } = accountData;

      logger.info(
        {
          walletId,
          reason,
          balanceCount: balances.length,
          positionCount: positionUpdates.length,
        },
        '[FuturesUserStream] Account update received'
      );

      for (const balance of balances) {
        if (balance.a === 'USDT') {
          const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

          if (wallet) {
            const newBalance = parseFloat(balance.wb);
            await db
              .update(wallets)
              .set({
                currentBalance: newBalance.toString(),
                updatedAt: new Date(),
              })
              .where(eq(wallets.id, walletId));

            logger.trace(
              { walletId, newBalance, reason },
              '[FuturesUserStream] Wallet balance synced from account update'
            );
          }
        }
      }

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitWalletUpdate(walletId, { reason, balances, positions: positionUpdates });
      }
    } catch (error) {
      logger.error(
        {
          walletId,
          error: serializeError(error),
        },
        '[FuturesUserStream] Error handling account update'
      );
    }
  }

  private async handleMarginCall(walletId: string, event: FuturesMarginCall): Promise<void> {
    try {
      const { cw: crossWalletBalance, p: positionsAtRisk } = event;

      logger.warn(
        {
          walletId,
          crossWalletBalance,
          positionsAtRiskCount: positionsAtRisk.length,
        },
        '[FuturesUserStream] ! MARGIN CALL received'
      );

      const wsService = getWebSocketService();
      if (wsService) {
        for (const pos of positionsAtRisk) {
          wsService.emitRiskAlert(walletId, {
            type: 'LIQUIDATION_RISK',
            level: 'critical',
            positionId: undefined,
            symbol: pos.s,
            message: `Margin call: ${pos.s} at risk. Maintenance margin: ${pos.mm}, Mark price: ${pos.mp}`,
            data: {
              symbol: pos.s,
              positionSide: pos.ps,
              positionAmount: pos.pa,
              marginType: pos.mt,
              isolatedWallet: pos.iw,
              markPrice: pos.mp,
              unrealizedPnl: pos.up,
              maintenanceMargin: pos.mm,
            },
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      logger.error(
        {
          walletId,
          error: serializeError(error),
        },
        '[FuturesUserStream] Error handling margin call'
      );
    }
  }

  private handleConfigUpdate(walletId: string, event: FuturesAccountConfigUpdate): void {
    if (event.ac) {
      logger.info(
        {
          walletId,
          symbol: event.ac.s,
          leverage: event.ac.l,
        },
        '[FuturesUserStream] Leverage updated'
      );
    }

    if (event.ai) {
      logger.info(
        {
          walletId,
          multiAssetMode: event.ai.j,
        },
        '[FuturesUserStream] Multi-asset mode updated'
      );
    }
  }

  private async handleAlgoOrderUpdate(walletId: string, event: FuturesAlgoOrderUpdate): Promise<void> {
    const { o: algoData } = event;
    const { s: symbol, aid: algoId, X: status, o: orderType, ps: positionSide } = algoData;

    logger.info(
      {
        walletId,
        symbol,
        algoId,
        status,
        orderType,
        positionSide,
      },
      '[FuturesUserStream] Algo order update received'
    );

    if (status === 'REJECTED' || status === 'EXPIRED') {
      await db
        .update(tradeExecutions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.entryOrderId, Number(algoId))
          )
        );
      logger.warn({ walletId, symbol, algoId, status }, '[FuturesUserStream] Algo entry order rejected/expired — pending execution cancelled');
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitRiskAlert(walletId, {
          type: 'ORDER_REJECTED',
          level: 'critical',
          symbol,
          message: status === 'REJECTED'
            ? `Entry order REJECTED by Binance — insufficient margin or invalid price at trigger time. Order for ${symbol} cancelled.`
            : `Entry order EXPIRED for ${symbol}. Order was not filled within its validity window.`,
          data: { algoId, orderType, status },
          timestamp: Date.now(),
        });
        wsService.emitPositionUpdate(walletId, { id: String(algoId), status: 'cancelled' } as Parameters<typeof wsService.emitPositionUpdate>[1]);
      }
      return;
    }

    if (status !== 'TRIGGERED') {
      return;
    }

    try {
      const [pendingEntryExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.marketType, 'FUTURES'),
            eq(tradeExecutions.entryOrderId, Number(algoId))
          )
        )
        .limit(1);

      if (pendingEntryExecution) {
        const [existingOpen] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES'),
              eq(tradeExecutions.side, pendingEntryExecution.side)
            )
          )
          .limit(1);

        if (existingOpen) {
          await this.withPyramidLock(walletId, symbol, async () => {
            await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id));
            await this.syncPositionFromExchange(walletId, symbol, existingOpen.id, 'Synced after algo pyramid trigger');
            const wsService = getWebSocketService();
            if (wsService) {
              const [updated] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, existingOpen.id)).limit(1);
              if (updated) wsService.emitPositionUpdate(walletId, updated);
            }
          });
          this.recentAlgoEntrySymbols.set(`${walletId}:${symbol}`, Date.now());
          return;
        }

        const [existingOpposite] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          )
          .limit(1);

        if (existingOpposite && existingOpposite.side !== pendingEntryExecution.side) {
          await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id));
          logger.info(
            { executionId: pendingEntryExecution.id, algoId, symbol, existingSide: existingOpposite.side },
            '[FuturesUserStream] Reduce algo order triggered — deleted pending execution, close handled via ORDER_TRADE_UPDATE'
          );
          return;
        }

        logger.info(
          { executionId: pendingEntryExecution.id, algoId, symbol },
          '[FuturesUserStream] Algo entry order TRIGGERED — activating pending execution'
        );

        await db
          .update(tradeExecutions)
          .set({
            status: 'open',
            openedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, pendingEntryExecution.id));

        try {
          await this.syncPositionFromExchange(walletId, symbol, pendingEntryExecution.id, 'Synced fill price after algo activation');
        } catch (_e) { /* ORDER_TRADE_UPDATE will correct */ }

        this.recentAlgoEntrySymbols.set(`${walletId}:${symbol}`, Date.now());

        const wsService = getWebSocketService();
        if (wsService) {
          const [activated] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id)).limit(1);
          if (activated) wsService.emitPositionUpdate(walletId, activated);
        }

        return;
      }

      const algoOpenExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        );

      const executionByAlgoId = algoOpenExecutions.find(e =>
        Number(e.stopLossAlgoId) === Number(algoId) ||
        Number(e.stopLossOrderId) === Number(algoId) ||
        Number(e.takeProfitAlgoId) === Number(algoId) ||
        Number(e.takeProfitOrderId) === Number(algoId)
      );

      const execution = executionByAlgoId || algoOpenExecutions[0];

      if (!execution) {
        logger.warn({ walletId, symbol, algoId, openCount: algoOpenExecutions.length }, '[FuturesUserStream] No open execution found for algo order');
        return;
      }

      const isSLOrder = Number(execution.stopLossAlgoId) === Number(algoId) || Number(execution.stopLossOrderId) === Number(algoId);
      const isTPOrder = Number(execution.takeProfitAlgoId) === Number(algoId) || Number(execution.takeProfitOrderId) === Number(algoId);

      if (!isSLOrder && !isTPOrder) {
        logger.trace(
          { walletId, symbol, algoId, stopLossAlgoId: execution.stopLossAlgoId, takeProfitAlgoId: execution.takeProfitAlgoId },
          '[FuturesUserStream] Algo order not recognized as SL or TP for this execution'
        );
        return;
      }

      const orderToCancel = isSLOrder
        ? (execution.takeProfitAlgoId || execution.takeProfitOrderId)
        : (execution.stopLossAlgoId || execution.stopLossOrderId);
      const exitReason = isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT';

      logger.info(
        {
          executionId: execution.id,
          algoId,
          isSLOrder,
          isTPOrder,
          exitReason,
          orderToCancel,
        },
        `[FuturesUserStream] > Algo ${exitReason} order TRIGGERED`
      );

      const apiClient = this.connections.get(walletId)?.apiClient;

      if (orderToCancel) {
        if (apiClient) {
          const maxRetries = 3;
          let cancelSuccess = false;

          for (let attempt = 1; attempt <= maxRetries && !cancelSuccess; attempt++) {
            try {
              await cancelFuturesAlgoOrder(apiClient, orderToCancel);
              cancelSuccess = true;
              logger.info(
                {
                  executionId: execution.id,
                  cancelledAlgoId: orderToCancel,
                  reason: isSLOrder ? 'SL triggered, cancelling TP algo' : 'TP triggered, cancelling SL algo',
                },
                '[FuturesUserStream] Opposite algo order cancelled'
              );
            } catch (cancelError) {
              const errorMessage = serializeError(cancelError);
              if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist') || errorMessage.includes('not found')) {
                cancelSuccess = true;
                logger.info(
                  { orderToCancel },
                  '[FuturesUserStream] Algo order already cancelled or executed'
                );
              } else if (attempt < maxRetries) {
                logger.warn(
                  { error: errorMessage, orderToCancel, attempt, maxRetries },
                  '[FuturesUserStream] Retry cancelling opposite algo order'
                );
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              } else {
                logger.error(
                  { error: errorMessage, orderToCancel },
                  '[FuturesUserStream] ! CRITICAL: Failed to cancel opposite algo order after retries - MANUAL CHECK REQUIRED'
                );
              }
            }
          }
        }
      }

      const clearFields = isSLOrder
        ? { stopLossAlgoId: null, stopLossOrderId: null }
        : { takeProfitAlgoId: null, takeProfitOrderId: null };

      await db
        .update(tradeExecutions)
        .set({
          exitReason,
          ...clearFields,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));

      binancePriceStreamService.invalidateExecutionCache(symbol);

      logger.info(
        {
          executionId: execution.id,
          clearedFields: Object.keys(clearFields),
        },
        '[FuturesUserStream] Cleared triggered protection order IDs'
      );

      const executionId = execution.id;
      const executionSide = execution.side as 'LONG' | 'SHORT';
      const openedAt = execution.openedAt ? new Date(execution.openedAt).getTime() : execution.createdAt ? new Date(execution.createdAt).getTime() : 0;

      setTimeout(() => {
        void this.verifyAlgoFillProcessed(walletId, executionId, symbol, executionSide, openedAt, exitReason);
      }, 10_000);
    } catch (error) {
      logger.error(
        {
          walletId,
          algoId,
          error: serializeError(error),
        },
        '[FuturesUserStream] Error handling algo order update'
      );
    }
  }

  private async verifyAlgoFillProcessed(
    walletId: string,
    executionId: string,
    symbol: string,
    side: 'LONG' | 'SHORT',
    openedAt: number,
    exitReason: string
  ): Promise<void> {
    try {
      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.id, executionId),
            eq(tradeExecutions.status, 'open')
          )
        )
        .limit(1);

      if (!execution) return;

      logger.warn(
        { walletId, executionId, symbol, exitReason },
        '[FuturesUserStream] ! Position still open 10s after algo trigger - fetching fill from REST API'
      );

      const apiClient = this.connections.get(walletId)?.apiClient;
      if (!apiClient) {
        logger.error({ walletId, executionId }, '[FuturesUserStream] No API client for delayed verification - falling back to position sync');
        const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
        if (wallet) await positionSyncService.syncWallet(wallet);
        return;
      }

      const closingTrade = await getLastClosingTrade(apiClient, symbol, side, openedAt);

      if (!closingTrade) {
        logger.warn({ walletId, executionId, symbol }, '[FuturesUserStream] No closing trade found yet - scheduling retry');
        setTimeout(() => {
          void this.verifyAlgoFillProcessed(walletId, executionId, symbol, side, openedAt, exitReason);
        }, 10_000);
        return;
      }

      const exitPrice = closingTrade.price;
      const exitFee = closingTrade.commission;
      const entryPrice = parseFloat(execution.entryPrice);
      const quantity = parseFloat(execution.quantity);
      const leverage = execution.leverage || 1;
      let entryFee = parseFloat(execution.entryFee || '0');

      if (entryFee === 0 && execution.entryOrderId) {
        try {
          const feeResult = await getOrderEntryFee(apiClient, symbol, Number(execution.entryOrderId));
          if (feeResult && feeResult.entryFee > 0) entryFee = feeResult.entryFee;
        } catch (_e) { /* entry fee fetch is best-effort */ }
      }

      const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');

      const pnlResult = calculatePnl({
        entryPrice,
        exitPrice,
        quantity,
        side,
        marketType: 'FUTURES',
        leverage,
        accumulatedFunding,
        entryFee: entryFee,
        exitFee,
      });
      const pnl = pnlResult.netPnl;
      const pnlPercent = pnlResult.pnlPercent;
      const totalFees = entryFee + exitFee;

      const closeResult = await db
        .update(tradeExecutions)
        .set({
          status: 'closed',
          exitPrice: exitPrice.toString(),
          closedAt: new Date(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          fees: totalFees.toString(),
          entryFee: entryFee.toString(),
          exitFee: exitFee.toString(),
          exitSource: 'ALGO_VERIFICATION',
          exitReason,
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          trailingStopAlgoId: null,
          updatedAt: new Date(),
        })
        .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.status, 'open')))
        .returning({ id: tradeExecutions.id });

      if (closeResult.length === 0) {
        logger.info({ executionId }, '[FuturesUserStream] Position already closed by ORDER_TRADE_UPDATE - verification no-op');
        return;
      }

      await db
        .update(wallets)
        .set({
          currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnl}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId));

      binancePriceStreamService.invalidateExecutionCache(symbol);

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitPositionUpdate(walletId, {
          ...execution,
          status: 'closed',
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          exitReason,
        });

        wsService.emitOrderUpdate(walletId, {
          id: execution.id,
          symbol,
          status: 'closed',
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          exitReason,
        });
      }

      logger.warn(
        {
          executionId,
          symbol,
          exitPrice: exitPrice.toFixed(4),
          pnl: pnl.toFixed(2),
          pnlPercent: pnlPercent.toFixed(2),
          exitReason,
        },
        '[FuturesUserStream] ! Position closed via ALGO_VERIFICATION (ORDER_TRADE_UPDATE was missed)'
      );

      void this.cancelPendingEntryOrders(walletId, symbol, executionId);

      setTimeout(() => {
        void this.closeResidualPosition(walletId, symbol, executionId);
      }, 3000);
    } catch (error) {
      logger.error(
        { executionId, symbol, error: serializeError(error) },
        '[FuturesUserStream] Error in algo fill verification'
      );
    }
  }

  private async cancelPendingEntryOrders(walletId: string, symbol: string, closedExecutionId: string): Promise<void> {
    try {
      const pendingEntries = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        );

      if (pendingEntries.length === 0) {
        logger.trace({ walletId, symbol, closedExecutionId }, '[FuturesUserStream] No pending entries to cancel after close');
        return;
      }

      const apiClient = this.connections.get(walletId)?.apiClient;
      const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

      for (const pending of pendingEntries) {
        if (apiClient && pending.entryOrderId) {
          try {
            const entryOrderType = pending.entryOrderType;
            const isAlgoEntry = entryOrderType === 'STOP_MARKET' || entryOrderType === 'TAKE_PROFIT_MARKET';
            if (isAlgoEntry) {
              await cancelFuturesAlgoOrder(apiClient, pending.entryOrderId);
            } else {
              await apiClient.cancelOrder({ symbol, orderId: pending.entryOrderId });
            }
            logger.info({ walletId, symbol, entryOrderId: pending.entryOrderId, isAlgoEntry }, '[FuturesUserStream] Cancelled pending entry order');
          } catch (cancelErr) {
            const msg = serializeError(cancelErr);
            if (!msg.includes('Unknown order') && !msg.includes('Order does not exist') && !msg.includes('not found'))
              logger.warn({ walletId, symbol, entryOrderId: pending.entryOrderId, error: msg }, '[FuturesUserStream] Failed to cancel pending entry order on exchange');
          }
        }

        if (walletRow && (pending.stopLossAlgoId || pending.stopLossOrderId || pending.takeProfitAlgoId || pending.takeProfitOrderId)) {
          await cancelAllProtectionOrders({
            wallet: walletRow,
            symbol,
            marketType: 'FUTURES',
            stopLossAlgoId: pending.stopLossAlgoId,
            stopLossOrderId: pending.stopLossOrderId,
            takeProfitAlgoId: pending.takeProfitAlgoId,
            takeProfitOrderId: pending.takeProfitOrderId,
          });
        }

        await db.update(tradeExecutions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(tradeExecutions.id, pending.id));
        logger.info({ walletId, symbol, executionId: pending.id, closedExecutionId }, '[FuturesUserStream] Cancelled pending entry execution after position close');
      }
    } catch (error) {
      logger.error(
        { walletId, symbol, closedExecutionId, error: serializeError(error) },
        '[FuturesUserStream] Failed to cancel pending entry orders'
      );
    }
  }

  private async closeResidualPosition(walletId: string, symbol: string, executionId: string): Promise<void> {
    try {
      const apiClient = this.connections.get(walletId)?.apiClient;
      if (!apiClient) return;

      const otherOpen = await db
        .select({ id: tradeExecutions.id })
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        )
        .limit(1);

      if (otherOpen.length > 0) return;

      const position = await getPosition(apiClient, symbol);
      if (!position) return;

      const positionAmt = parseFloat(String(position.positionAmt));
      if (positionAmt === 0) return;

      logger.warn(
        { walletId, symbol, executionId, residualQty: positionAmt },
        '[FuturesUserStream] Residual position detected after close - closing automatically'
      );

      await closePosition(apiClient, symbol, String(positionAmt));

      logger.info(
        { walletId, symbol, executionId, closedQty: positionAmt },
        '[FuturesUserStream] Residual position closed successfully'
      );
    } catch (error) {
      logger.error(
        { walletId, symbol, executionId, error: serializeError(error) },
        '[FuturesUserStream] Failed to close residual position'
      );
    }
  }

  private async handleConditionalOrderReject(walletId: string, event: FuturesConditionalOrderReject): Promise<void> {
    const { or: orderReject } = event;
    const { s: symbol, i: orderId, r: reason } = orderReject;

    try {
      const [pendingEntry] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.entryOrderId, Number(orderId))
          )
        )
        .limit(1);

      if (pendingEntry) {
        await db
          .update(tradeExecutions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(tradeExecutions.id, pendingEntry.id));
        logger.warn(
          { walletId, symbol, orderId, reason },
          '[FuturesUserStream] Entry conditional order rejected — pending execution cancelled'
        );
        return;
      }
    } catch (error) {
      logger.error({ walletId, orderId, error: serializeError(error) }, '[FuturesUserStream] Error checking entry execution for conditional reject');
    }

    logger.error(
      {
        walletId,
        symbol,
        orderId,
        reason,
      },
      '[FuturesUserStream] ! CRITICAL: Conditional order (TP/SL) was REJECTED'
    );

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitRiskAlert(walletId, {
        type: 'ORDER_REJECTED',
        level: 'critical',
        symbol,
        message: `TP/SL order rejected: ${reason}`,
        data: { orderId, reason },
        timestamp: Date.now(),
      });
    }

    try {
      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        )
        .limit(1);

      if (execution) {
        const isSLReject = Number(execution.stopLossOrderId) === Number(orderId) || Number(execution.stopLossAlgoId) === Number(orderId);
        const isTPReject = Number(execution.takeProfitOrderId) === Number(orderId) || Number(execution.takeProfitAlgoId) === Number(orderId);

        if (isSLReject || isTPReject) {
          const field: ProtectionOrderField = isSLReject ? 'stopLoss' : 'takeProfit';
          await clearProtectionOrderIds(execution.id, field);

          logger.error(
            {
              executionId: execution.id,
              symbol,
              orderId,
              isSLReject,
              isTPReject,
              reason,
              clearedField: field,
            },
            '[FuturesUserStream] ! CRITICAL: Position protection order REJECTED - IDs cleared, MANUAL INTERVENTION REQUIRED'
          );
        }
      }
    } catch (error) {
      logger.error(
        { walletId, orderId, error: serializeError(error) },
        '[FuturesUserStream] Error handling conditional order reject'
      );
    }
  }

  private async resubscribeWallet(walletId: string): Promise<void> {
    try {
      this.unsubscribeWallet(walletId);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
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
