import type { USDMClient} from 'binance';
import { WebsocketClient } from 'binance';
import type { WsKey } from 'binance/lib/util/websockets/websocket-util';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, positions, type Wallet } from '../db/schema';
import { createBinanceFuturesClient, isPaperWallet, getWalletType } from './binance-futures-client';
import { decryptApiKey } from './encryption';
import { logger, serializeError } from './logger';
import { getWebSocketService } from './websocket';
import { FUTURES_DEFAULTS } from '@marketmind/types';

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

export class BinanceFuturesUserStreamService {
  private connections: Map<string, { wsClient: WebsocketClient; apiClient: USDMClient }> = new Map();
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('[FuturesUserStream] Starting Binance Futures User Stream service');
    await this.subscribeAllActiveWallets();

    setInterval(() => {
      void this.subscribeAllActiveWallets();
    }, 60000);
  }

  stop(): void {
    this.isRunning = false;
    for (const [walletId, connection] of this.connections) {
      connection.wsClient.closeAll(true);
      this.connections.delete(walletId);
    }
    logger.info('[FuturesUserStream] Service stopped');
  }

  private async subscribeAllActiveWallets(): Promise<void> {
    try {
      const allWallets = await db.select().from(wallets);

      const liveWallets = allWallets.filter(
        (w) => !isPaperWallet(w) && w.apiKeyEncrypted && w.apiSecretEncrypted
      );

      for (const wallet of liveWallets) {
        if (!this.connections.has(wallet.id)) {
          await this.subscribeWallet(wallet);
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
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

      const wsClient = new WebsocketClient({
        api_key: apiKey,
        api_secret: apiSecret,
        beautify: true,
        testnet: walletType === 'testnet',
      });

      wsClient.on('formattedMessage', (data) => {
        this.handleUserDataMessage(wallet.id, data);
      });

      wsClient.on('exception', (error) => {
        logger.error(
          {
            walletId: wallet.id,
            error: error instanceof Error ? error.message : String(error),
          },
          '[FuturesUserStream] WebSocket exception'
        );
      });

      wsClient.on('reconnected', () => {
        logger.info({ walletId: wallet.id }, '[FuturesUserStream] Reconnected');
      });

      const wsKey: WsKey = walletType === 'testnet' ? 'usdmTestnet' : 'usdm';
      await wsClient.subscribeUsdFuturesUserDataStream(wsKey);

      this.connections.set(wallet.id, { wsClient, apiClient });

      logger.info({ walletId: wallet.id, walletType }, '[FuturesUserStream] Subscribed successfully');
    } catch (error) {
      logger.error(
        {
          walletId: wallet.id,
          error: error instanceof Error ? error.message : String(error),
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
        default:
          logger.debug({ walletId, eventType }, '[FuturesUserStream] Unhandled event type');
      }
    } catch (error) {
      logger.error(
        {
          walletId,
          error: error instanceof Error ? error.message : String(error),
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
          X: status,
          x: execType,
          i: orderId,
          L: lastFilledPrice,
          z: executedQty,
          ap: avgPrice,
          rp: _realizedProfit,
          ps: positionSide,
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

        if (pendingExecution?.entryOrderId === orderId) {
          const fillPrice = parseFloat(avgPrice || lastFilledPrice);
          logger.info(
            {
              executionId: pendingExecution.id,
              symbol,
              orderId,
              fillPrice,
            },
            '[FuturesUserStream] ✅ Pending LIMIT order FILLED - activating position'
          );

          await db
            .update(tradeExecutions)
            .set({
              status: 'open',
              entryPrice: fillPrice.toString(),
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

        const isSLOrder = execution.stopLossOrderId && execution.stopLossOrderId === orderId;
        const isTPOrder = execution.takeProfitOrderId && execution.takeProfitOrderId === orderId;

        if (!isSLOrder && !isTPOrder) {
          logger.warn(
            { walletId, symbol, orderId, executionId: execution.id },
            '[FuturesUserStream] Order not recognized as SL or TP'
          );
          return;
        }

        const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

        if (!wallet) {
          throw new Error(`Wallet not found: ${walletId}`);
        }

        const apiClient = this.connections.get(walletId)?.apiClient;
        const orderToCancel = isSLOrder ? execution.takeProfitOrderId : execution.stopLossOrderId;

        if (orderToCancel && apiClient) {
          try {
            await apiClient.cancelOrder({ symbol, orderId: orderToCancel });
            logger.info(
              {
                executionId: execution.id,
                cancelledOrderId: orderToCancel,
                reason: isSLOrder ? 'SL filled, cancelling TP' : 'TP filled, cancelling SL',
              },
              '[FuturesUserStream] Opposite order cancelled'
            );
          } catch (cancelError) {
            logger.error(
              {
                error: cancelError instanceof Error ? cancelError.message : String(cancelError),
                orderToCancel,
              },
              '[FuturesUserStream] Failed to cancel opposite order'
            );
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

        const entryValue = entryPrice * quantity;
        const exitValue = exitPrice * quantity;
        const takerFee = FUTURES_DEFAULTS.TAKER_FEE;
        const entryFee = entryValue * takerFee;
        const exitFee = exitValue * takerFee;
        const totalFees = entryFee + exitFee;

        const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');
        const pnl = grossPnl - totalFees + accumulatedFunding;

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
          '[FuturesUserStream] 💰 Wallet balance updated'
        );

        await db
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: exitPrice.toString(),
            closedAt: new Date(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
            fees: totalFees.toString(),
            exitSource: 'ALGORITHM',
            exitReason: isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT',
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, execution.id));

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

            logger.debug(
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
        '[FuturesUserStream] ⚠️ MARGIN CALL received'
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
