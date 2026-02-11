
import { WebsocketClient } from 'binance';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { createBinanceClient, isPaperWallet, silentWsLogger } from './binance-client';
import { logger, serializeError } from './logger';
import { getWebSocketService } from './websocket';
import { binancePriceStreamService } from './binance-price-stream';
import { positionMonitorService } from './position-monitor';
import { TIME_MS } from '../constants';

interface OrderUpdateEvent {
  e: 'executionReport';
  E: number;
  s: string;
  c: string;
  S: 'BUY' | 'SELL';
  o: string;
  f: string;
  q: string;
  p: string;
  P: string;
  F: string;
  g: number;
  C: string;
  x: string;
  X: string;
  r: string;
  i: number;
  l: string;
  z: string;
  L: string;
  n: string;
  N: string | null;
  T: number;
  t: number;
  I: number;
  w: boolean;
  m: boolean;
  M: boolean;
  O: number;
  Z: string;
  Y: string;
  Q: string;
}

export class BinanceUserStreamService {
  private connections: Map<string, { client: WebsocketClient; listenKey: string }> = new Map();
  private listenKeyRefreshIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private readonly LISTEN_KEY_REFRESH_INTERVAL = 30 * TIME_MS.MINUTE;

  async start(): Promise<void> {
    logger.trace('Starting Binance User Stream service');
    await this.subscribeAllActiveWallets();

    setInterval(() => {
      void this.subscribeAllActiveWallets();
    }, 60000);
  }

  stop(): void {
    for (const [walletId, connection] of this.connections) {
      connection.client.closeAll(true);
      this.connections.delete(walletId);

      const interval = this.listenKeyRefreshIntervals.get(walletId);
      if (interval) {
        clearInterval(interval);
        this.listenKeyRefreshIntervals.delete(walletId);
      }
    }
    logger.info('Binance User Stream service stopped');
  }

  private async subscribeAllActiveWallets(): Promise<void> {
    try {
      const allWallets = await db.select().from(wallets);

      const spotWallets = allWallets.filter(
        (w) =>
          !isPaperWallet(w) &&
          w.apiKeyEncrypted &&
          w.apiSecretEncrypted &&
          w.marketType === 'SPOT'
      );

      for (const wallet of spotWallets) {
        if (!this.connections.has(wallet.id)) {
          await this.subscribeWallet(wallet);
        }
      }
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error subscribing active wallets');
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
      const client = createBinanceClient(wallet);
      const response = await client.getSpotUserDataListenKey();
      const listenKey = response.listenKey;

      const wsClient = new WebsocketClient(
        { beautify: true, reconnectTimeout: 5000 },
        silentWsLogger
      );

      wsClient.on('message', (data) => {
        this.handleUserDataMessage(wallet.id, data);
      });

      wsClient.on('exception', (error) => {
        logger.error({
          walletId: wallet.id,
          error: serializeError(error),
        }, 'Binance User Stream exception');
      });

      wsClient.on('reconnected', () => {
        logger.info({ walletId: wallet.id }, 'Binance User Stream reconnected');
      });

      const wsKey = wallet.walletType === 'testnet' ? 'mainTestnetUserData' : 'main';
      wsClient.subscribeSpotUserDataStreamWithListenKey(wsKey, listenKey);

      this.connections.set(wallet.id, { client: wsClient, listenKey });

      const refreshInterval = setInterval(() => {
        void this.refreshListenKey(wallet, listenKey);
      }, this.LISTEN_KEY_REFRESH_INTERVAL);

      this.listenKeyRefreshIntervals.set(wallet.id, refreshInterval);

      logger.info({ walletId: wallet.id }, 'Subscribed to Binance User Stream');
    } catch (error) {
      logger.error({
        walletId: wallet.id,
        error: serializeError(error),
      }, 'Failed to subscribe to Binance User Stream');
    }
  }

  private async refreshListenKey(wallet: Wallet, listenKey: string): Promise<void> {
    try {
      const client = createBinanceClient(wallet);
      await client.keepAliveSpotUserDataListenKey(listenKey);
      logger.trace({ walletId: wallet.id }, 'Listen key refreshed');
    } catch (error) {
      logger.error({
        walletId: wallet.id,
        error: serializeError(error),
      }, 'Failed to refresh listen key');
    }
  }

  private handleUserDataMessage(walletId: string, data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;

      if (message['e'] === 'executionReport') {
        void this.handleOrderUpdate(walletId, message as unknown as OrderUpdateEvent);
      }
    } catch (error) {
      logger.error({
        walletId,
        error: serializeError(error),
      }, 'Error handling user data message');
    }
  }

  private async handleOrderUpdate(walletId: string, event: OrderUpdateEvent): Promise<void> {
    try {
      const { s: symbol, X: status, x: execType, i: orderId, L: lastFilledPrice, z: executedQty, o: orderType, n: commissionAmount, N: commissionAsset } = event;

      logger.info({
        walletId,
        symbol,
        orderId,
        status,
        execType,
        orderType,
      }, 'Order update received');

      if (execType === 'TRADE' && status === 'FILLED') {
        const [pendingExecution] = await db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.status, 'pending'),
            )
          )
          .limit(1);

        if (pendingExecution?.entryOrderId === orderId) {
          const fillPrice = parseFloat(lastFilledPrice);
          const entryFee = parseFloat(commissionAmount || '0');
          logger.info({
            executionId: pendingExecution.id,
            symbol,
            orderId,
            fillPrice,
            entryFee,
            commissionAsset,
          }, '✓ Pending LIMIT order FILLED via WebSocket - activating position');

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
            )
          )
          .limit(1);

        if (!execution) {
          logger.warn({ walletId, symbol, orderId }, 'No open execution found for order');
          return;
        }

        const isSLOrder = execution.stopLossOrderId && execution.stopLossOrderId === orderId;
        const isTPOrder = execution.takeProfitOrderId && execution.takeProfitOrderId === orderId;

        if (!isSLOrder && !isTPOrder) {
          logger.warn({ walletId, symbol, orderId, executionId: execution.id }, 'Order not recognized as SL or TP');
          return;
        }

        const [wallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.id, walletId))
          .limit(1);

        if (!wallet) {
          throw new Error(`Wallet not found: ${walletId}`);
        }

        const client = createBinanceClient(wallet);
        const orderToCancel = isSLOrder ? execution.takeProfitOrderId : execution.stopLossOrderId;

        if (orderToCancel) {
          try {
            await client.cancelOrder({ symbol, orderId: orderToCancel });
            logger.info({
              executionId: execution.id,
              cancelledOrderId: orderToCancel,
              reason: isSLOrder ? 'SL filled, cancelling TP' : 'TP filled, cancelling SL',
            }, 'Opposite order cancelled');
          } catch (cancelError) {
            logger.error({
              error: serializeError(cancelError),
              orderToCancel,
            }, 'Failed to cancel opposite order');
          }
        }

        const exitPrice = parseFloat(lastFilledPrice);
        const quantity = parseFloat(executedQty);
        const entryPrice = parseFloat(execution.entryPrice);

        let grossPnl = 0;
        if (execution.side === 'LONG') {
          grossPnl = (exitPrice - entryPrice) * quantity;
        } else {
          grossPnl = (entryPrice - exitPrice) * quantity;
        }

        const actualExitFee = parseFloat(commissionAmount || '0');
        const actualEntryFee = parseFloat(execution.entryFee || '0');
        const totalFees = actualEntryFee + actualExitFee;
        const pnl = grossPnl - totalFees;

        const pnlPercent = (pnl / (entryPrice * quantity)) * 100;

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
            stopLossOrderId: null,
            takeProfitOrderId: null,
            stopLossAlgoId: null,
            takeProfitAlgoId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(tradeExecutions.id, execution.id), eq(tradeExecutions.status, 'open')))
          .returning({ id: tradeExecutions.id });

        if (closeResult.length === 0) {
          logger.info({ executionId: execution.id, symbol }, 'Position already closed by another process - skipping');
          return;
        }

        await db
          .update(wallets)
          .set({
            currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnl}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, walletId));

        logger.info({
          walletId,
          walletType: wallet.walletType,
          pnl,
        }, '> Wallet balance updated atomically via user stream');

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
        }

        logger.info({
          executionId: execution.id,
          symbol,
          exitPrice,
          pnl: pnl.toFixed(2),
          pnlPercent: pnlPercent.toFixed(2),
        }, 'Position closed via Binance order fill');
      }
    } catch (error) {
      logger.error({
        walletId,
        error: serializeError(error),
      }, 'Error handling order update');
    }
  }

  unsubscribeWallet(walletId: string): void {
    const connection = this.connections.get(walletId);
    if (connection) {
      connection.client.closeAll(true);
      this.connections.delete(walletId);

      const interval = this.listenKeyRefreshIntervals.get(walletId);
      if (interval) {
        clearInterval(interval);
        this.listenKeyRefreshIntervals.delete(walletId);
      }

      logger.info({ walletId }, 'Unsubscribed from Binance User Stream');
    }
  }
}

export const binanceUserStreamService = new BinanceUserStreamService();
