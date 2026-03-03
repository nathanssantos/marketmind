import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, positions, orders, type Wallet } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { createBinanceFuturesClient, isPaperWallet, getWalletType, cancelFuturesAlgoOrder, getOrderEntryFee, getLastClosingTrade, getAllTradeFeesForPosition, getPosition, closePosition } from './binance-futures-client';
import { createStopLossOrder, createTakeProfitOrder, cancelProtectionOrder } from './protection-orders';
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
import { positionMonitorService } from './position-monitor';
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

          if (existingOpen) {
            const oldQty = parseFloat(existingOpen.quantity);
            const oldPrice = parseFloat(existingOpen.entryPrice);
            const newQty = oldQty + fillQty;
            const newAvgPrice = ((oldQty * oldPrice) + (fillQty * fillPrice)) / newQty;

            const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
            if (!walletRow) return;

            const slPrice = existingOpen.stopLoss ? parseFloat(existingOpen.stopLoss) : null;
            const tpPrice = existingOpen.takeProfit ? parseFloat(existingOpen.takeProfit) : null;

            if (existingOpen.stopLossAlgoId || existingOpen.stopLossOrderId) {
              await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: existingOpen.stopLossAlgoId, orderId: existingOpen.stopLossOrderId }).catch((_e) => {});
            }
            if (existingOpen.takeProfitAlgoId || existingOpen.takeProfitOrderId) {
              await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: existingOpen.takeProfitAlgoId, orderId: existingOpen.takeProfitOrderId }).catch((_e) => {});
            }

            let newSlResult: import('./protection-orders').ProtectionOrderResult | null = null;
            let newTpResult: import('./protection-orders').ProtectionOrderResult | null = null;

            if (slPrice) {
              try {
                newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: existingOpen.side, quantity: newQty, triggerPrice: slPrice, marketType: 'FUTURES' });
              } catch (e) {
                logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated SL after LIMIT pyramid');
              }
            }
            if (tpPrice) {
              try {
                newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: existingOpen.side, quantity: newQty, triggerPrice: tpPrice, marketType: 'FUTURES' });
              } catch (e) {
                logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated TP after LIMIT pyramid');
              }
            }

            await db.update(tradeExecutions).set({
              entryPrice: newAvgPrice.toString(),
              quantity: newQty.toString(),
              stopLossAlgoId: newSlResult?.isAlgoOrder ? (newSlResult.algoId ?? null) : (slPrice ? null : existingOpen.stopLossAlgoId),
              takeProfitAlgoId: newTpResult?.isAlgoOrder ? (newTpResult.algoId ?? null) : (tpPrice ? null : existingOpen.takeProfitAlgoId),
              stopLossOrderId: (newSlResult && !newSlResult.isAlgoOrder) ? (newSlResult.orderId ?? null) : (slPrice ? null : existingOpen.stopLossOrderId),
              takeProfitOrderId: (newTpResult && !newTpResult.isAlgoOrder) ? (newTpResult.orderId ?? null) : (tpPrice ? null : existingOpen.takeProfitOrderId),
              stopLossIsAlgo: newSlResult?.isAlgoOrder ?? existingOpen.stopLossIsAlgo ?? false,
              takeProfitIsAlgo: newTpResult?.isAlgoOrder ?? existingOpen.takeProfitIsAlgo ?? false,
              updatedAt: new Date(),
            }).where(eq(tradeExecutions.id, existingOpen.id));

            await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingExecution.id));

            logger.info({ executionId: existingOpen.id, symbol, newAvgPrice, newQty }, '[FuturesUserStream] Pyramided via LIMIT order into existing position');
            return;
          }

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

          const needsSlPlacement = !pendingExecution.stopLossAlgoId && !pendingExecution.stopLossOrderId && pendingExecution.stopLoss;
          const needsTpPlacement = !pendingExecution.takeProfitAlgoId && !pendingExecution.takeProfitOrderId && pendingExecution.takeProfit;

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

          const stopLossIntent = manualOrder.stopLossIntent ? parseFloat(manualOrder.stopLossIntent) : null;
          const takeProfitIntent = manualOrder.takeProfitIntent ? parseFloat(manualOrder.takeProfitIntent) : null;

          let slResult: import('./protection-orders').ProtectionOrderResult | null = null;
          let tpResult: import('./protection-orders').ProtectionOrderResult | null = null;

          if (manualOrder.type !== 'MARKET' && (stopLossIntent || takeProfitIntent)) {
            if (stopLossIntent) {
              try {
                slResult = await createStopLossOrder({ wallet: walletRow, symbol, side: direction, quantity: fillQty, triggerPrice: stopLossIntent, marketType: 'FUTURES' });
              } catch (e) {
                logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place SL for manual LIMIT fill');
              }
            }
            if (takeProfitIntent) {
              try {
                tpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: direction, quantity: fillQty, triggerPrice: takeProfitIntent, marketType: 'FUTURES' });
              } catch (e) {
                logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place TP for manual LIMIT fill');
              }
            }
          }

          await db.insert(tradeExecutions).values({
            id: generateEntityId(),
            userId: walletRow.userId,
            walletId,
            symbol,
            side: direction,
            entryOrderId: Number(orderId),
            entryPrice: fillPrice.toString(),
            quantity: fillQty.toString(),
            stopLoss: stopLossIntent?.toString(),
            takeProfit: takeProfitIntent?.toString(),
            stopLossAlgoId: slResult?.isAlgoOrder ? (slResult.algoId ?? null) : null,
            takeProfitAlgoId: tpResult?.isAlgoOrder ? (tpResult.algoId ?? null) : null,
            stopLossOrderId: slResult && !slResult.isAlgoOrder ? (slResult.orderId ?? null) : null,
            takeProfitOrderId: tpResult && !tpResult.isAlgoOrder ? (tpResult.orderId ?? null) : null,
            stopLossIsAlgo: slResult?.isAlgoOrder ?? false,
            takeProfitIsAlgo: tpResult?.isAlgoOrder ?? false,
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
              const fillPrice = parseFloat(avgPrice || lastFilledPrice);
              const fillQty = parseFloat(executedQty || '0');
              const oldQty = parseFloat(execution.quantity);
              const oldPrice = parseFloat(execution.entryPrice);
              const newQty = oldQty + fillQty;
              const newAvgPrice = ((oldQty * oldPrice) + (fillQty * fillPrice)) / newQty;

              const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
              if (!walletRow) return;

              const slPrice = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
              const tpPrice = execution.takeProfit ? parseFloat(execution.takeProfit) : null;

              if (execution.stopLossAlgoId || execution.stopLossOrderId) {
                await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: execution.stopLossAlgoId, orderId: execution.stopLossOrderId }).catch((_e) => {});
              }
              if (execution.takeProfitAlgoId || execution.takeProfitOrderId) {
                await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: execution.takeProfitAlgoId, orderId: execution.takeProfitOrderId }).catch((_e) => {});
              }

              let newSlResult: import('./protection-orders').ProtectionOrderResult | null = null;
              let newTpResult: import('./protection-orders').ProtectionOrderResult | null = null;

              if (slPrice) {
                try {
                  newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: execution.side, quantity: newQty, triggerPrice: slPrice, marketType: 'FUTURES' });
                } catch (e) {
                  logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated SL after pyramid');
                }
              }
              if (tpPrice) {
                try {
                  newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: execution.side, quantity: newQty, triggerPrice: tpPrice, marketType: 'FUTURES' });
                } catch (e) {
                  logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated TP after pyramid');
                }
              }

              await db.update(tradeExecutions).set({
                entryPrice: newAvgPrice.toString(),
                quantity: newQty.toString(),
                stopLossAlgoId: newSlResult?.isAlgoOrder ? (newSlResult.algoId ?? null) : (slPrice ? null : execution.stopLossAlgoId),
                takeProfitAlgoId: newTpResult?.isAlgoOrder ? (newTpResult.algoId ?? null) : (tpPrice ? null : execution.takeProfitAlgoId),
                stopLossOrderId: (newSlResult && !newSlResult.isAlgoOrder) ? (newSlResult.orderId ?? null) : (slPrice ? null : execution.stopLossOrderId),
                takeProfitOrderId: (newTpResult && !newTpResult.isAlgoOrder) ? (newTpResult.orderId ?? null) : (tpPrice ? null : execution.takeProfitOrderId),
                stopLossIsAlgo: newSlResult?.isAlgoOrder ?? execution.stopLossIsAlgo ?? false,
                takeProfitIsAlgo: newTpResult?.isAlgoOrder ?? execution.takeProfitIsAlgo ?? false,
                updatedAt: new Date(),
              }).where(eq(tradeExecutions.id, execution.id));

              logger.info({ executionId: execution.id, symbol, newAvgPrice, newQty }, '[FuturesUserStream] Pyramided into existing position');
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
        const quantity = parseFloat(executedQty);
        const entryPrice = parseFloat(execution.entryPrice);
        const leverage = execution.leverage || 1;

        let grossPnl = 0;
        if (execution.side === 'LONG') {
          grossPnl = (exitPrice - entryPrice) * quantity;
        } else {
          grossPnl = (entryPrice - exitPrice) * quantity;
        }

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

        const totalFees = actualEntryFee + actualExitFee;

        const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');
        const pnl = grossPnl - totalFees + accumulatedFunding;

        const entryValue = entryPrice * quantity;
        const marginValue = entryValue / leverage;
        const pnlPercent = (pnl / marginValue) * 100;

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
        positionMonitorService.clearDeferredExit(execution.id);

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

      for (const posUpdate of positionUpdates) {
        const [position] = await db
          .select()
          .from(positions)
          .where(
            and(
              eq(positions.walletId, walletId),
              eq(positions.symbol, posUpdate.s),
              eq(positions.status, 'open')
            )
          )
          .limit(1);

        if (position) {
          await db
            .update(positions)
            .set({
              currentPrice: posUpdate.ep,
              pnl: posUpdate.up,
              updatedAt: new Date(),
            })
            .where(eq(positions.id, position.id));
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
          const oldQty = parseFloat(existingOpen.quantity);
          const oldPrice = parseFloat(existingOpen.entryPrice);
          const newQty = oldQty + parseFloat(pendingEntryExecution.quantity);
          const newAvgPrice = ((oldQty * oldPrice) + (parseFloat(pendingEntryExecution.quantity) * parseFloat(pendingEntryExecution.entryPrice))) / newQty;

          const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
          if (!walletRow) return;

          const slPrice = existingOpen.stopLoss ? parseFloat(existingOpen.stopLoss) : null;
          const tpPrice = existingOpen.takeProfit ? parseFloat(existingOpen.takeProfit) : null;

          if (existingOpen.stopLossAlgoId || existingOpen.stopLossOrderId) {
            await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: existingOpen.stopLossAlgoId, orderId: existingOpen.stopLossOrderId }).catch((_e) => {});
          }
          if (existingOpen.takeProfitAlgoId || existingOpen.takeProfitOrderId) {
            await cancelProtectionOrder({ wallet: walletRow, symbol, marketType: 'FUTURES', algoId: existingOpen.takeProfitAlgoId, orderId: existingOpen.takeProfitOrderId }).catch((_e) => {});
          }

          let newSlResult: import('./protection-orders').ProtectionOrderResult | null = null;
          let newTpResult: import('./protection-orders').ProtectionOrderResult | null = null;

          if (slPrice) {
            try {
              newSlResult = await createStopLossOrder({ wallet: walletRow, symbol, side: existingOpen.side, quantity: newQty, triggerPrice: slPrice, marketType: 'FUTURES' });
            } catch (e) {
              logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated SL after STOP_MARKET pyramid');
            }
          }
          if (tpPrice) {
            try {
              newTpResult = await createTakeProfitOrder({ wallet: walletRow, symbol, side: existingOpen.side, quantity: newQty, triggerPrice: tpPrice, marketType: 'FUTURES' });
            } catch (e) {
              logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place updated TP after STOP_MARKET pyramid');
            }
          }

          await db.update(tradeExecutions).set({
            entryPrice: newAvgPrice.toString(),
            quantity: newQty.toString(),
            stopLossAlgoId: newSlResult?.isAlgoOrder ? (newSlResult.algoId ?? null) : (slPrice ? null : existingOpen.stopLossAlgoId),
            takeProfitAlgoId: newTpResult?.isAlgoOrder ? (newTpResult.algoId ?? null) : (tpPrice ? null : existingOpen.takeProfitAlgoId),
            stopLossOrderId: (newSlResult && !newSlResult.isAlgoOrder) ? (newSlResult.orderId ?? null) : (slPrice ? null : existingOpen.stopLossOrderId),
            takeProfitOrderId: (newTpResult && !newTpResult.isAlgoOrder) ? (newTpResult.orderId ?? null) : (tpPrice ? null : existingOpen.takeProfitOrderId),
            stopLossIsAlgo: newSlResult?.isAlgoOrder ?? existingOpen.stopLossIsAlgo ?? false,
            takeProfitIsAlgo: newTpResult?.isAlgoOrder ?? existingOpen.takeProfitIsAlgo ?? false,
            updatedAt: new Date(),
          }).where(eq(tradeExecutions.id, existingOpen.id));

          await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id));

          const wsService = getWebSocketService();
          if (wsService) {
            const [updated] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, existingOpen.id)).limit(1);
            if (updated) wsService.emitPositionUpdate(walletId, updated);
          }

          logger.info({ executionId: existingOpen.id, symbol, newAvgPrice, newQty }, '[FuturesUserStream] Pyramided via STOP_MARKET algo order into existing position');
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

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitPositionUpdate(walletId, {
            ...pendingEntryExecution,
            status: 'open',
          });
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

      if (orderToCancel) {
        const apiClient = this.connections.get(walletId)?.apiClient;
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
      positionMonitorService.clearDeferredExit(execution.id);

      logger.info(
        {
          executionId: execution.id,
          clearedFields: Object.keys(clearFields),
        },
        '[FuturesUserStream] Cleared triggered protection order IDs and unblocked deferral'
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

      const totalFees = entryFee + exitFee;
      const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');

      const grossPnl = side === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;

      const pnl = grossPnl - totalFees + accumulatedFunding;
      const entryValue = entryPrice * quantity;
      const marginValue = entryValue / leverage;
      const pnlPercent = marginValue > 0 ? (pnl / marginValue) * 100 : 0;

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
