import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { createBinanceFuturesClient, getOpenAlgoOrders, getPositions, isPaperWallet, type FuturesAlgoOrder } from './binance-futures-client';
import { logger, serializeError } from './logger';
import { cancelProtectionOrder } from './protection-orders';
import { getWebSocketService } from './websocket';

export interface OrphanOrder {
  algoId: number;
  symbol: string;
  type: string;
  side: string;
  triggerPrice: string;
  quantity: string;
  hasPositionOnExchange: boolean;
}

export interface MismatchedOrder {
  executionId: string;
  symbol: string;
  field: 'stopLoss' | 'takeProfit';
  dbValue: number | null;
  dbAlgoId: number | null;
  exchangeAlgoId: number | null;
  exchangeTriggerPrice: string | null;
}

export interface OrderSyncResult {
  walletId: string;
  synced: boolean;
  orphanOrders: OrphanOrder[];
  mismatchedOrders: MismatchedOrder[];
  cancelledOrphans: number;
  errors: string[];
}

export class OrderSyncService {
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private autoCancelOrphans = false;

  async start(options?: { autoCancelOrphans?: boolean }): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.autoCancelOrphans = options?.autoCancelOrphans ?? false;

    logger.info({ autoCancelOrphans: this.autoCancelOrphans }, '[OrderSync] Starting Order Sync service');

    await this.syncAllWallets();

    this.syncInterval = setInterval(() => {
      void this.syncAllWallets();
    }, 5 * 60 * 1000);
  }

  stop(): void {
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    logger.info('[OrderSync] Service stopped');
  }

  async syncAllWallets(): Promise<OrderSyncResult[]> {
    const results: OrderSyncResult[] = [];

    try {
      const allWallets = await db.select().from(wallets);
      const liveWallets = allWallets.filter(
        (w) =>
          !isPaperWallet(w) &&
          w.apiKeyEncrypted &&
          w.apiSecretEncrypted &&
          w.marketType === 'FUTURES'
      );

      for (const wallet of liveWallets) {
        try {
          const result = await this.syncWallet(wallet);
          results.push(result);

          if (result.orphanOrders.length > 0 || result.mismatchedOrders.length > 0) {
            logger.warn({
              walletId: wallet.id,
              walletName: wallet.name,
              orphanOrders: result.orphanOrders.length,
              mismatchedOrders: result.mismatchedOrders.length,
              cancelledOrphans: result.cancelledOrphans,
            }, '[OrderSync] Sync completed with issues');
          }
        } catch (error) {
          results.push({
            walletId: wallet.id,
            synced: false,
            orphanOrders: [],
            mismatchedOrders: [],
            cancelledOrphans: 0,
            errors: [serializeError(error)],
          });
        }
      }

      const totalOrphans = results.reduce((sum, r) => sum + r.orphanOrders.length, 0);
      const totalMismatched = results.reduce((sum, r) => sum + r.mismatchedOrders.length, 0);
      const totalCancelled = results.reduce((sum, r) => sum + r.cancelledOrphans, 0);

      if (totalOrphans > 0 || totalMismatched > 0) {
        logger.info({
          walletsChecked: liveWallets.length,
          totalOrphanOrders: totalOrphans,
          totalMismatchedOrders: totalMismatched,
          totalCancelledOrphans: totalCancelled,
        }, '[OrderSync] All wallets sync completed');
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, '[OrderSync] Failed to sync wallets');
    }

    return results;
  }

  async syncWallet(wallet: Wallet): Promise<OrderSyncResult> {
    const result: OrderSyncResult = {
      walletId: wallet.id,
      synced: true,
      orphanOrders: [],
      mismatchedOrders: [],
      cancelledOrphans: 0,
      errors: [],
    };

    try {
      const client = createBinanceFuturesClient(wallet);

      const [dbOpenPositions, exchangeOrders, exchangePositions] = await Promise.all([
        db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, wallet.id),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          ),
        getOpenAlgoOrders(client),
        getPositions(client),
      ]);

      const symbolsWithPositionOnExchange = new Set(
        exchangePositions.filter(p => parseFloat(p.positionAmt) !== 0).map(p => p.symbol)
      );

      const dbAlgoIds = new Set<number>();
      const dbOrdersBySymbol = new Map<string, typeof dbOpenPositions[0]>();

      for (const position of dbOpenPositions) {
        dbOrdersBySymbol.set(position.symbol, position);
        if (position.stopLossAlgoId) dbAlgoIds.add(position.stopLossAlgoId);
        if (position.takeProfitAlgoId) dbAlgoIds.add(position.takeProfitAlgoId);
      }

      const exchangeOrdersBySymbol = new Map<string, FuturesAlgoOrder[]>();
      for (const order of exchangeOrders) {
        const orders = exchangeOrdersBySymbol.get(order.symbol) || [];
        orders.push(order);
        exchangeOrdersBySymbol.set(order.symbol, orders);
      }

      for (const order of exchangeOrders) {
        if (!dbAlgoIds.has(order.algoId)) {
          const hasPositionOnExchange = symbolsWithPositionOnExchange.has(order.symbol);

          result.orphanOrders.push({
            algoId: order.algoId,
            symbol: order.symbol,
            type: order.type,
            side: order.side,
            triggerPrice: order.triggerPrice || '',
            quantity: order.quantity,
            hasPositionOnExchange,
          });

          const shouldCancel = this.autoCancelOrphans && !hasPositionOnExchange;

          if (shouldCancel) {
            try {
              await cancelProtectionOrder({
                wallet,
                symbol: order.symbol,
                marketType: 'FUTURES',
                algoId: order.algoId,
              });
              result.cancelledOrphans++;
              logger.info({ algoId: order.algoId, symbol: order.symbol }, '[OrderSync] Cancelled orphan order (no position on exchange)');
            } catch (cancelError) {
              logger.warn({ algoId: order.algoId, error: serializeError(cancelError) }, '[OrderSync] Failed to cancel orphan order');
            }
          } else if (this.autoCancelOrphans && hasPositionOnExchange) {
            logger.warn(
              { algoId: order.algoId, symbol: order.symbol },
              '[OrderSync] Orphan order has position on exchange - NOT cancelling (database may be out of sync)'
            );
          }
        }
      }

      for (const [symbol, position] of dbOrdersBySymbol) {
        const exchangeOrdersForSymbol = exchangeOrdersBySymbol.get(symbol) || [];

        if (position.stopLossAlgoId) {
          const slOrder = exchangeOrdersForSymbol.find(
            (o) => o.algoId === position.stopLossAlgoId && o.type === 'STOP_MARKET'
          );

          if (!slOrder) {
            result.mismatchedOrders.push({
              executionId: position.id,
              symbol,
              field: 'stopLoss',
              dbValue: position.stopLoss ? parseFloat(position.stopLoss) : null,
              dbAlgoId: position.stopLossAlgoId,
              exchangeAlgoId: null,
              exchangeTriggerPrice: null,
            });
          } else {
            const dbSL = position.stopLoss ? parseFloat(position.stopLoss) : 0;
            const exchangeSL = parseFloat(slOrder.triggerPrice || '0');
            if (Math.abs(dbSL - exchangeSL) > 0.00001) {
              result.mismatchedOrders.push({
                executionId: position.id,
                symbol,
                field: 'stopLoss',
                dbValue: dbSL,
                dbAlgoId: position.stopLossAlgoId,
                exchangeAlgoId: slOrder.algoId,
                exchangeTriggerPrice: slOrder.triggerPrice || null,
              });
            }
          }
        }

        if (position.takeProfitAlgoId) {
          const tpOrder = exchangeOrdersForSymbol.find(
            (o) => o.algoId === position.takeProfitAlgoId && o.type === 'TAKE_PROFIT_MARKET'
          );

          if (!tpOrder) {
            result.mismatchedOrders.push({
              executionId: position.id,
              symbol,
              field: 'takeProfit',
              dbValue: position.takeProfit ? parseFloat(position.takeProfit) : null,
              dbAlgoId: position.takeProfitAlgoId,
              exchangeAlgoId: null,
              exchangeTriggerPrice: null,
            });
          } else {
            const dbTP = position.takeProfit ? parseFloat(position.takeProfit) : 0;
            const exchangeTP = parseFloat(tpOrder.triggerPrice || '0');
            if (Math.abs(dbTP - exchangeTP) > 0.00001) {
              result.mismatchedOrders.push({
                executionId: position.id,
                symbol,
                field: 'takeProfit',
                dbValue: dbTP,
                dbAlgoId: position.takeProfitAlgoId,
                exchangeAlgoId: tpOrder.algoId,
                exchangeTriggerPrice: tpOrder.triggerPrice || null,
              });
            }
          }
        }
      }

      if (result.orphanOrders.length > 0) {
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitRiskAlert(wallet.id, {
            type: 'ORPHAN_ORDERS',
            level: 'warning',
            symbol: result.orphanOrders.map((o) => o.symbol).join(', '),
            message: `${result.orphanOrders.length} orphan order(s) found on Binance not tracked in the system.${this.autoCancelOrphans ? ` ${result.cancelledOrphans} cancelled automatically.` : ' Manual review recommended.'}`,
            data: { orphanOrders: result.orphanOrders },
            timestamp: Date.now(),
          });
        }
      }

      if (result.mismatchedOrders.length > 0) {
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitRiskAlert(wallet.id, {
            type: 'ORDER_MISMATCH',
            level: 'warning',
            symbol: result.mismatchedOrders.map((o) => o.symbol).join(', '),
            message: `${result.mismatchedOrders.length} order(s) have mismatched data between database and exchange.`,
            data: { mismatchedOrders: result.mismatchedOrders },
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      const errorMsg = serializeError(error);
      result.synced = false;
      result.errors.push(errorMsg);
      logger.error({ walletId: wallet.id, error: errorMsg }, '[OrderSync] Failed to sync wallet orders');
    }

    return result;
  }

  async runOnce(options?: { autoCancelOrphans?: boolean }): Promise<OrderSyncResult[]> {
    const previousAutoCancelOrphans = this.autoCancelOrphans;
    if (options?.autoCancelOrphans !== undefined) {
      this.autoCancelOrphans = options.autoCancelOrphans;
    }

    const results = await this.syncAllWallets();

    this.autoCancelOrphans = previousAutoCancelOrphans;
    return results;
  }
}

export const orderSyncService = new OrderSyncService();
