import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { autoTradingConfig, orders, tradeExecutions, wallets, type Wallet } from '../db/schema';
import { BinanceIpBannedError } from './binance-api-cache';
import { createBinanceFuturesClient, getOpenAlgoOrders, getPositions, isPaperWallet, type FuturesAlgoOrder } from './binance-futures-client';
import { getOpenOrders as getBinanceOpenOrders } from './binance-futures-orders';
import { clearProtectionOrderIds, syncProtectionOrderIdFromExchange } from './execution-manager';
import { logger, serializeError } from './logger';
import { cancelProtectionOrder } from './protection-orders';
import { getWebSocketService } from './websocket';
export type { OrphanOrder, MismatchedOrder, FixedOrder, OrderSyncResult, OrderSyncServiceStartOptions } from './order-sync-types';
import { type OrderSyncResult, type OrderSyncServiceStartOptions, createEmptyOrderSyncResult } from './order-sync-types';

export class OrderSyncService {
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private autoCancelOrphans = false;
  private autoFixMismatches = false;

  async start(options?: OrderSyncServiceStartOptions): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.autoCancelOrphans = options?.autoCancelOrphans ?? false;
    this.autoFixMismatches = options?.autoFixMismatches ?? false;

    // 30s — was 5min. Faster reconciliation when the user-stream WS
    // loses an ORDER_TRADE_UPDATE event (reconnect gap, IP ban, etc.).
    // Each sync hits Binance for getOpenOrders + getOpenAlgoOrders +
    // getPositions per wallet (3 weights). 30s × 3 weights × N wallets
    // is well under the 1200/min Binance limit for typical use.
    this.syncInterval = setInterval(() => {
      void this.syncAllWallets();
    }, 30 * 1000);

    if (options?.delayFirstSync) {
      setTimeout(() => void this.syncAllWallets(), options.delayFirstSync);
    } else {
      await this.syncAllWallets();
    }
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

          const hasActionableIssues = result.orphanOrders.length > 0 || result.fixedOrders.length > 0 || result.cancelledOrphans > 0;
          if (hasActionableIssues) {
            logger.warn({
              walletId: wallet.id,
              walletName: wallet.name,
              orphanOrders: result.orphanOrders.length,
              fixedOrders: result.fixedOrders.length,
              cancelledOrphans: result.cancelledOrphans,
            }, '[OrderSync] Sync found issues');
          }
        } catch (error) {
          if (error instanceof BinanceIpBannedError) {
            logger.warn({ walletId: wallet.id }, '[OrderSync] Skipping wallet sync - IP banned');
            continue;
          }
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

      if ((totalOrphans > 0 || totalMismatched > 0 || totalFixed > 0) && liveWallets.length > 1) {
        logger.info({
          walletsChecked: liveWallets.length,
          totalOrphanOrders: totalOrphans,
          totalMismatchedOrders: totalMismatched,
          totalFixedOrders: totalFixed,
          totalCancelledOrphans: totalCancelled,
        }, '[OrderSync] All wallets sync completed');
      }
    } catch (error) {
      if (error instanceof BinanceIpBannedError) {
        logger.warn('[OrderSync] Skipping - IP banned');
        return results;
      }
      logger.error({ error: serializeError(error) }, '[OrderSync] Failed to sync wallets');
    }

    return results;
  }

  async syncWallet(wallet: Wallet): Promise<OrderSyncResult> {
    const result = createEmptyOrderSyncResult(wallet.id);

    try {
      const [walletConfig] = await db.select({ autoCancelOrphans: autoTradingConfig.autoCancelOrphans })
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, wallet.id))
        .limit(1);
      const effectiveAutoCancelOrphans = walletConfig?.autoCancelOrphans ?? this.autoCancelOrphans;

      const client = createBinanceFuturesClient(wallet);

      const [dbOpenPositions, exchangeOrders, exchangePositions, exchangeRegularOrders] = await Promise.all([
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
        getBinanceOpenOrders(client),
      ]);

      await this.reconcileOrdersTable(wallet.id, wallet, exchangeRegularOrders, exchangeOrders);

      const symbolsWithPositionOnExchange = new Set(
        exchangePositions.filter(p => parseFloat(p.positionAmt) !== 0).map(p => p.symbol)
      );

      const dbAlgoIds = new Set<string>();
      const dbOrdersBySymbol = new Map<string, typeof dbOpenPositions[0]>();

      for (const position of dbOpenPositions) {
        dbOrdersBySymbol.set(position.symbol, position);
        if (position.stopLossAlgoId) dbAlgoIds.add(position.stopLossAlgoId);
        if (position.takeProfitAlgoId) dbAlgoIds.add(position.takeProfitAlgoId);
      }

      const exchangeOrdersBySymbol = new Map<string, FuturesAlgoOrder[]>();
      for (const order of exchangeOrders) {
        const orders = exchangeOrdersBySymbol.get(order.symbol) ?? [];
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
            triggerPrice: order.triggerPrice ?? '',
            quantity: order.quantity,
            hasPositionOnExchange,
          });

          const shouldCancel = effectiveAutoCancelOrphans && !hasPositionOnExchange;

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
          } else if (effectiveAutoCancelOrphans && hasPositionOnExchange) {
            logger.warn(
              { algoId: order.algoId, symbol: order.symbol },
              '[OrderSync] Orphan order has position on exchange - NOT cancelling (database may be out of sync)'
            );
          }
        }
      }

      for (const [symbol, position] of dbOrdersBySymbol) {
        const exchangeOrdersForSymbol = exchangeOrdersBySymbol.get(symbol) ?? [];

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
                  parseFloat(anySlOrder.triggerPrice ?? '0')
                );
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'stopLoss',
                  oldAlgoId: position.stopLossAlgoId,
                  newAlgoId: anySlOrder.algoId,
                  newTriggerPrice: anySlOrder.triggerPrice ?? '',
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
                  newAlgoId: '',
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
            const exchangeSL = parseFloat(slOrder.triggerPrice ?? '0');
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
                    newTriggerPrice: slOrder.triggerPrice ?? '',
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
                    exchangeTriggerPrice: slOrder.triggerPrice ?? null,
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
                  exchangeTriggerPrice: slOrder.triggerPrice ?? null,
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
                  parseFloat(anyTpOrder.triggerPrice ?? '0')
                );
                result.fixedOrders.push({
                  executionId: position.id,
                  symbol,
                  field: 'takeProfit',
                  oldAlgoId: position.takeProfitAlgoId,
                  newAlgoId: anyTpOrder.algoId,
                  newTriggerPrice: anyTpOrder.triggerPrice ?? '',
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
                  newAlgoId: '',
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
            const exchangeTP = parseFloat(tpOrder.triggerPrice ?? '0');
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
                    newTriggerPrice: tpOrder.triggerPrice ?? '',
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
                    exchangeTriggerPrice: tpOrder.triggerPrice ?? null,
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
                  exchangeTriggerPrice: tpOrder.triggerPrice ?? null,
                });
              }
            }
          }
        }
      }

      const dangerousOrphans = result.orphanOrders.filter((o) => !o.hasPositionOnExchange);
      if (dangerousOrphans.length > 0) {
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitRiskAlert(wallet.id, {
            type: 'ORPHAN_ORDERS',
            level: 'warning',
            symbol: dangerousOrphans.map((o) => o.symbol).join(', '),
            message: `${dangerousOrphans.length} orphan order(s) found on Binance with no open position.${effectiveAutoCancelOrphans ? ` ${result.cancelledOrphans} cancelled automatically.` : ' Manual review recommended.'}`,
            data: { orphanOrders: dangerousOrphans },
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
      if (error instanceof BinanceIpBannedError) {
        logger.warn({ walletId: wallet.id }, '[OrderSync] Skipping wallet sync - IP banned');
        return result;
      }
      const errorMsg = serializeError(error);
      result.synced = false;
      result.errors.push(errorMsg);
      logger.error({ walletId: wallet.id, error: errorMsg }, '[OrderSync] Failed to sync wallet orders');
    }

    return result;
  }

  /**
   * Mark DB orders that no longer exist on Binance as EXPIRED.
   * Without this, orders accumulate forever in NEW status whenever the
   * user-stream loses an ORDER_TRADE_UPDATE event (reconnect gap, ban
   * window, server restart). 11k+ stale rows had built up in one wallet
   * by 2026-05-07. Runs as part of the normal periodic sync — covers
   * regular orders + algo (STOP_MARKET / TAKE_PROFIT_MARKET) orders.
   */
  private async reconcileOrdersTable(
    walletId: string,
    wallet: Wallet,
    binanceOpenOrders: ReadonlyArray<{ orderId: number | string }>,
    binanceOpenAlgos: ReadonlyArray<FuturesAlgoOrder>,
  ): Promise<void> {
    const liveIds = new Set<string>([
      ...binanceOpenOrders.map((o) => String(o.orderId)),
      ...binanceOpenAlgos.map((a) => String(a.algoId)),
    ]);

    const dbActiveOrders = await db
      .select({ orderId: orders.orderId, symbol: orders.symbol })
      .from(orders)
      .where(
        and(
          eq(orders.walletId, walletId),
          or(eq(orders.status, 'NEW'), eq(orders.status, 'PARTIALLY_FILLED')),
        ),
      );

    const staleRows = dbActiveOrders.filter((r) => !liveIds.has(r.orderId));
    if (staleRows.length === 0) return;

    // For each stale order, query Binance for the actual final status.
    // Earlier this just bulk-set everything to EXPIRED — but a stale
    // DB row can mean three different things in reality:
    //   FILLED   — order executed (the user-stream event was lost)
    //   CANCELED — user cancelled
    //   EXPIRED  — GTC time-in-force timeout
    // Marking a FILLED order as EXPIRED produced misleading toasts
    // ("order expired" when it was actually executed) and left
    // tradeExecution rows in a stale state. Now we resolve each
    // staleId individually via getOrder → real status. Bounded by
    // current backlog; in practice 0–3 stale orders per wallet.
    const client = createBinanceFuturesClient(wallet);
    let fixed = 0;
    let filled = 0;
    let canceled = 0;
    let expired = 0;
    const wsService = getWebSocketService();

    for (const row of staleRows) {
      let realStatus: 'FILLED' | 'CANCELED' | 'EXPIRED' = 'EXPIRED';
      let avgPrice = '0';
      let executedQty = '0';
      try {
        const order = await client.getOrder({ symbol: row.symbol, orderId: Number(row.orderId) });
        const binanceStatus = String(order.status ?? '').toUpperCase();
        if (binanceStatus === 'FILLED') {
          realStatus = 'FILLED';
          avgPrice = String(order.avgPrice ?? '0');
          executedQty = String(order.executedQty ?? '0');
          filled++;
        } else if (binanceStatus === 'CANCELED') {
          realStatus = 'CANCELED';
          canceled++;
        } else {
          // EXPIRED, REJECTED, NEW (rare race) — mark expired by default
          realStatus = 'EXPIRED';
          expired++;
        }
      } catch (err) {
        // getOrder can fail if the order is older than Binance's retention
        // window or if the symbol changed — fall back to EXPIRED so the
        // stale row doesn't keep blocking the renderer's pending list.
        logger.warn(
          { walletId, orderId: row.orderId, symbol: row.symbol, error: serializeError(err) },
          '[OrderSync] getOrder failed for stale orderId — falling back to EXPIRED',
        );
        expired++;
      }

      const updateValues: { status: string; updateTime: number; avgPrice?: string; executedQty?: string } = {
        status: realStatus,
        updateTime: Date.now(),
      };
      if (realStatus === 'FILLED') {
        updateValues.avgPrice = avgPrice;
        updateValues.executedQty = executedQty;
      }

      await db
        .update(orders)
        .set(updateValues)
        .where(
          and(
            eq(orders.walletId, walletId),
            eq(orders.orderId, row.orderId),
            or(eq(orders.status, 'NEW'), eq(orders.status, 'PARTIALLY_FILLED')),
          ),
        );

      // Cascade to any matching pending tradeExecution. Without this,
      // an EXPIRED / CANCELED order leaves its tradeExecution stuck at
      // 'pending' — and the renderer keeps showing the order line on
      // the chart. The handle-order-update WS path (CANCELED/EXPIRED/
      // REJECTED branch) does the same cascade for live events; this
      // covers the fallback path when WS missed the event.
      if (realStatus === 'CANCELED' || realStatus === 'EXPIRED') {
        const cancelledExecs = await db
          .update(tradeExecutions)
          .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.entryOrderId, row.orderId),
            ),
          )
          .returning();
        if (cancelledExecs.length > 0 && wsService) {
          for (const exec of cancelledExecs) {
            wsService.emitOrderUpdate(walletId, { id: exec.id, status: 'cancelled' });
            wsService.emitPositionUpdate(walletId, exec);
          }
        }
      }

      // Emit so the renderer's optimistic cache patches the row to
      // its real final status WITHOUT waiting for a query refetch.
      // For FILLED specifically, this is what the user wants: the
      // chart line disappears immediately as the order completes.
      if (wsService) {
        if (realStatus === 'FILLED') {
          wsService.emitOrderUpdate(walletId, {
            orderId: row.orderId,
            symbol: row.symbol,
            status: 'FILLED',
            executedQty,
            avgPrice,
          });
        } else if (realStatus === 'CANCELED') {
          wsService.emitOrderCancelled(walletId, row.orderId);
        } else {
          wsService.emitOrderUpdate(walletId, {
            orderId: row.orderId,
            symbol: row.symbol,
            status: 'EXPIRED',
          });
        }
      }
      fixed++;
    }

    logger.info(
      { walletId, fixed, filled, canceled, expired },
      '[OrderSync] Reconciled stale orders with real Binance status',
    );
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
