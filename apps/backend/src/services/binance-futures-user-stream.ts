import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, positions, type Wallet } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { createBinanceFuturesClient, isPaperWallet, getWalletType, cancelFuturesAlgoOrder } from './binance-futures-client';
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

      wsClient.on('formattedMessage', (data) => {
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

      if (execType === 'TRADE' && status === 'FILLED') {
        const [pendingExecution] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          )
          .limit(1);

        if (pendingExecution && Number(pendingExecution.entryOrderId) === Number(orderId)) {
          const fillPrice = parseFloat(avgPrice || lastFilledPrice);
          const entryFee = parseFloat(commission || '0');
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

          await db
            .update(tradeExecutions)
            .set({
              status: 'open',
              entryPrice: fillPrice.toString(),
              entryFee: entryFee.toString(),
              commissionAsset: commissionAsset || 'USDT',
              openedAt: new Date(),
              updatedAt: new Date(),
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

        if (!execution) {
          logger.warn({ walletId, symbol, orderId }, '[FuturesUserStream] No open execution found');
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

        const actualExitFee = parseFloat(commission || '0');
        const actualEntryFee = parseFloat(execution.entryFee || '0');
        const totalFees = actualEntryFee + actualExitFee;

        const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');
        const pnl = grossPnl - totalFees + accumulatedFunding;

        const entryValue = entryPrice * quantity;
        const marginValue = entryValue / leverage;
        const pnlPercent = (pnl / marginValue) * 100;

        const currentBalance = parseFloat(wallet.currentBalance || '0');
        const newBalance = currentBalance + pnl;

        await db
          .update(wallets)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, walletId));

        logger.info(
          {
            walletId,
            pnl: pnl.toFixed(2),
            oldBalance: currentBalance.toFixed(2),
            newBalance: newBalance.toFixed(2),
          },
          '[FuturesUserStream] > Wallet balance updated'
        );

        const determinedExitReason = isAlgoTriggerFill
          ? execution.exitReason
          : isSLOrder
            ? 'STOP_LOSS'
            : 'TAKE_PROFIT';

        await db
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: exitPrice.toString(),
            closedAt: new Date(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
            fees: totalFees.toString(),
            exitFee: actualExitFee.toString(),
            exitSource: 'ALGORITHM',
            exitReason: determinedExitReason,
            stopLossAlgoId: null,
            stopLossOrderId: null,
            takeProfitAlgoId: null,
            takeProfitOrderId: null,
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, execution.id));

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

    if (status !== 'TRIGGERED' && status !== 'TRIGGERING') {
      return;
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

      if (!execution) {
        logger.warn({ walletId, symbol, algoId }, '[FuturesUserStream] No open execution found for algo order');
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

      await db
        .update(tradeExecutions)
        .set({
          exitReason,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));
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

  private async handleConditionalOrderReject(walletId: string, event: FuturesConditionalOrderReject): Promise<void> {
    const { or: orderReject } = event;
    const { s: symbol, i: orderId, r: reason } = orderReject;

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
