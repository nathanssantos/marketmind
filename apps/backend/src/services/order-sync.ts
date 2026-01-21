import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { createBinanceFuturesClient, getOpenAlgoOrders, getPositions, isPaperWallet, type FuturesAlgoOrder } from './binance-futures-client';
import { clearProtectionOrderIds, syncProtectionOrderIdFromExchange } from './execution-manager';
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

export interface FixedOrder {
  executionId: string;
  symbol: string;
  field: 'stopLoss' | 'takeProfit';
  oldAlgoId: number | null;
  newAlgoId: number;
  newTriggerPrice: string;
}

export interface OrderSyncResult {
  walletId: string;
  synced: boolean;
  orphanOrders: OrphanOrder[];
  mismatchedOrders: MismatchedOrder[];
  fixedOrders: FixedOrder[];
  cancelledOrphans: number;
  errors: string[];
}

export class OrderSyncService {
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private autoCancelOrphans = false;
  private autoFixMismatches = false;

  async start(options?: { autoCancelOrphans?: boolean; autoFixMismatches?: boolean }): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.autoCancelOrphans = options?.autoCancelOrphans ?? false;
    this.autoFixMismatches = options?.autoFixMismatches ?? false;

    logger.info({ autoCancelOrphans: this.autoCancelOrphans, autoFixMismatches: this.autoFixMismatches }, '[OrderSync] Starting Order Sync service');

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

          if (result.orphanOrders.length > 0 || result.mismatchedOrders.length > 0 || result.fixedOrders.length > 0) {
            logger.warn({
              walletId: wallet.id,
              walletName: wallet.name,
              orphanOrders: result.orphanOrders.length,
              mismatchedOrders: result.mismatchedOrders.length,
              fixedOrders: result.fixedOrders.length,
              cancelledOrphans: result.cancelledOrphans,
            }, '[OrderSync] Sync completed with issues');
          }
        } catch (error) {
          results.push({
            walletId: wallet.id,
            synced: false,
            orphanOrders: [],
            mismatchedOrders: [],
            fixedOrders: [],
            cancelledOrphans: 0,
            errors: [serializeError(error)],
          });
        }
      }

      const totalOrphans = results.reduce((sum, r) => sum + r.orphanOrders.length, 0);
      const totalMismatched = results.reduce((sum, r) => sum + r.mismatchedOrders.length, 0);
      const totalFixed = results.reduce((sum, r) => sum + r.fixedOrders.length, 0);
      const totalCancelled = results.reduce((sum, r) => sum + r.cancelledOrphans, 0);

      if (totalOrphans > 0 || totalMismatched > 0 || totalFixed > 0) {
        logger.info({
          walletsChecked: liveWallets.length,
          totalOrphanOrders: totalOrphans,
          totalMismatchedOrders: totalMismatched,
          totalFixedOrders: totalFixed,
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
      fixedOrders: [],
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
            const anySlOrder = exchangeOrdersForSymbol.find((o) => o.type === 'STOP_MARKET');

            if (this.autoFixMismatches && anySlOrder) {
              try {
                await syncProtectionOrderIdFromExchange(
                  position.id,
                  'stopLoss',
                  anySlOrder.algoId,
                  parseFloat(anySlOrder.triggerPrice || '0')
                );
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'stopLoss',
                  oldAlgoId: position.stopLossAlgoId,
                  newAlgoId: anySlOrder.algoId,
                  newTriggerPrice: anySlOrder.triggerPrice || '',
                });
                logger.info({ executionId: position.id, symbol, oldAlgoId: position.stopLossAlgoId, newAlgoId: anySlOrder.algoId }, '[OrderSync] Auto-fixed SL order ID from exchange');
              } catch (fixError) {
                logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to auto-fix SL order');
                result.mismatchedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'stopLoss',
                  dbValue: position.stopLoss ? parseFloat(position.stopLoss) : null,
                  dbAlgoId: position.stopLossAlgoId,
                  exchangeAlgoId: null,
                  exchangeTriggerPrice: null,
                });
              }
            } else if (this.autoFixMismatches) {
              try {
                await clearProtectionOrderIds(position.id, 'stopLoss');
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'stopLoss',
                  oldAlgoId: position.stopLossAlgoId,
                  newAlgoId: 0,
                  newTriggerPrice: '',
                });
                logger.info({ executionId: position.id, symbol, oldAlgoId: position.stopLossAlgoId }, '[OrderSync] Cleared stale SL order ID (no matching order on exchange)');
              } catch (fixError) {
                logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to clear SL order ID');
                result.mismatchedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'stopLoss',
                  dbValue: position.stopLoss ? parseFloat(position.stopLoss) : null,
                  dbAlgoId: position.stopLossAlgoId,
                  exchangeAlgoId: null,
                  exchangeTriggerPrice: null,
                });
              }
            } else {
              result.mismatchedOrders.push({
                executionId: position.id,
                symbol,
                field: 'stopLoss',
                dbValue: position.stopLoss ? parseFloat(position.stopLoss) : null,
                dbAlgoId: position.stopLossAlgoId,
                exchangeAlgoId: null,
                exchangeTriggerPrice: null,
              });
            }
          } else {
            const dbSL = position.stopLoss ? parseFloat(position.stopLoss) : 0;
            const exchangeSL = parseFloat(slOrder.triggerPrice || '0');
            if (Math.abs(dbSL - exchangeSL) > 0.00001) {
              if (this.autoFixMismatches) {
                try {
                  await syncProtectionOrderIdFromExchange(position.id, 'stopLoss', slOrder.algoId, exchangeSL);
                  result.fixedOrders.push({
                    executionId: position.id,
                    symbol,
                    field: 'stopLoss',
                    oldAlgoId: position.stopLossAlgoId,
                    newAlgoId: slOrder.algoId,
                    newTriggerPrice: slOrder.triggerPrice || '',
                  });
                  logger.info({ executionId: position.id, symbol, dbValue: dbSL, exchangeValue: exchangeSL }, '[OrderSync] Auto-fixed SL trigger price from exchange');
                } catch (fixError) {
                  logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to auto-fix SL trigger price');
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
              } else {
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
        }

        if (position.takeProfitAlgoId) {
          const tpOrder = exchangeOrdersForSymbol.find(
            (o) => o.algoId === position.takeProfitAlgoId && o.type === 'TAKE_PROFIT_MARKET'
          );

          if (!tpOrder) {
            const anyTpOrder = exchangeOrdersForSymbol.find((o) => o.type === 'TAKE_PROFIT_MARKET');

            if (this.autoFixMismatches && anyTpOrder) {
              try {
                await syncProtectionOrderIdFromExchange(
                  position.id,
                  'takeProfit',
                  anyTpOrder.algoId,
                  parseFloat(anyTpOrder.triggerPrice || '0')
                );
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'takeProfit',
                  oldAlgoId: position.takeProfitAlgoId,
                  newAlgoId: anyTpOrder.algoId,
                  newTriggerPrice: anyTpOrder.triggerPrice || '',
                });
                logger.info({ executionId: position.id, symbol, oldAlgoId: position.takeProfitAlgoId, newAlgoId: anyTpOrder.algoId }, '[OrderSync] Auto-fixed TP order ID from exchange');
              } catch (fixError) {
                logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to auto-fix TP order');
                result.mismatchedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'takeProfit',
                  dbValue: position.takeProfit ? parseFloat(position.takeProfit) : null,
                  dbAlgoId: position.takeProfitAlgoId,
                  exchangeAlgoId: null,
                  exchangeTriggerPrice: null,
                });
              }
            } else if (this.autoFixMismatches) {
              try {
                await clearProtectionOrderIds(position.id, 'takeProfit');
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'takeProfit',
                  oldAlgoId: position.takeProfitAlgoId,
                  newAlgoId: 0,
                  newTriggerPrice: '',
                });
                logger.info({ executionId: position.id, symbol, oldAlgoId: position.takeProfitAlgoId }, '[OrderSync] Cleared stale TP order ID (no matching order on exchange)');
              } catch (fixError) {
                logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to clear TP order ID');
                result.mismatchedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'takeProfit',
                  dbValue: position.takeProfit ? parseFloat(position.takeProfit) : null,
                  dbAlgoId: position.takeProfitAlgoId,
                  exchangeAlgoId: null,
                  exchangeTriggerPrice: null,
                });
              }
            } else {
              result.mismatchedOrders.push({
                executionId: position.id,
                symbol,
                field: 'takeProfit',
                dbValue: position.takeProfit ? parseFloat(position.takeProfit) : null,
                dbAlgoId: position.takeProfitAlgoId,
                exchangeAlgoId: null,
                exchangeTriggerPrice: null,
              });
            }
          } else {
            const dbTP = position.takeProfit ? parseFloat(position.takeProfit) : 0;
            const exchangeTP = parseFloat(tpOrder.triggerPrice || '0');
            if (Math.abs(dbTP - exchangeTP) > 0.00001) {
              if (this.autoFixMismatches) {
                try {
                  await syncProtectionOrderIdFromExchange(position.id, 'takeProfit', tpOrder.algoId, exchangeTP);
                  result.fixedOrders.push({
                    executionId: position.id,
                    symbol,
                    field: 'takeProfit',
                    oldAlgoId: position.takeProfitAlgoId,
                    newAlgoId: tpOrder.algoId,
                    newTriggerPrice: tpOrder.triggerPrice || '',
                  });
                  logger.info({ executionId: position.id, symbol, dbValue: dbTP, exchangeValue: exchangeTP }, '[OrderSync] Auto-fixed TP trigger price from exchange');
                } catch (fixError) {
                  logger.warn({ executionId: position.id, error: serializeError(fixError) }, '[OrderSync] Failed to auto-fix TP trigger price');
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
              } else {
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

  async runOnce(options?: { autoCancelOrphans?: boolean; autoFixMismatches?: boolean }): Promise<OrderSyncResult[]> {
    const previousAutoCancelOrphans = this.autoCancelOrphans;
    const previousAutoFixMismatches = this.autoFixMismatches;

    if (options?.autoCancelOrphans !== undefined) {
      this.autoCancelOrphans = options.autoCancelOrphans;
    }
    if (options?.autoFixMismatches !== undefined) {
      this.autoFixMismatches = options.autoFixMismatches;
    }

    const results = await this.syncAllWallets();

    this.autoCancelOrphans = previousAutoCancelOrphans;
    this.autoFixMismatches = previousAutoFixMismatches;
    return results;
  }
}

export const orderSyncService = new OrderSyncService();
