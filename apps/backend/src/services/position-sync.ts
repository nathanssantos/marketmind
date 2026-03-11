import type { OrphanedPositionEntry, PositionSyncResult, UnknownPositionEntry, UpdatedPositionEntry, WalletSyncEntry } from '@marketmind/logger';
import type { FuturesPosition } from '@marketmind/types';
import { and, desc, eq, gte, isNotNull, or } from 'drizzle-orm';
import { STARTUP_CONFIG } from '../constants';
import { db } from '../db';
import { orders, tradeExecutions, wallets, type Wallet } from '../db/schema';
import { calculatePnl } from '../utils/pnl-calculator';
import { BinanceIpBannedError } from './binance-api-cache';
import { createBinanceFuturesClient, isPaperWallet, getPositions, closePosition } from './binance-futures-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger, serializeError } from './logger';
import { cancelAllProtectionOrders } from './protection-orders';
import { outputPositionSyncResults } from './watcher-batch-logger';
import { getWebSocketService } from './websocket';
import { autoTradingService } from './auto-trading';

interface SyncResult {
  walletId: string;
  synced: boolean;
  changes: {
    orphanedPositions: string[];
    unknownPositions: string[];
    updatedPositions: string[];
    balanceUpdated: boolean;
  };
  errors: string[];
  detailedOrphaned?: OrphanedPositionEntry[];
  detailedUnknown?: UnknownPositionEntry[];
  detailedUpdated?: UpdatedPositionEntry[];
}

export class PositionSyncService {
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('[PositionSync] Starting Position Sync service');

    void this.syncAllWallets();

    this.syncInterval = setInterval(() => {
      void this.syncAllWallets();
    }, STARTUP_CONFIG.POSITION_SYNC_INTERVAL_MS);
  }

  stop(): void {
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    logger.info('[PositionSync] Service stopped');
  }

  async syncAllWallets(): Promise<SyncResult[]> {
    const startTime = new Date();
    const results: SyncResult[] = [];
    const walletSummaries: WalletSyncEntry[] = [];
    const allOrphaned: OrphanedPositionEntry[] = [];
    const allUnknown: UnknownPositionEntry[] = [];
    const allUpdated: UpdatedPositionEntry[] = [];

    try {
      const allWallets = await db.select().from(wallets);
      const liveWallets = allWallets.filter(
        (w) =>
          !isPaperWallet(w) &&
          w.apiKeyEncrypted &&
          w.apiSecretEncrypted &&
          w.marketType === 'FUTURES'
      );

      const syncResults = await Promise.allSettled(
        liveWallets.map(async (wallet) => {
          const result = await this.syncWallet(wallet);
          return { wallet, result };
        })
      );

      for (const settledResult of syncResults) {
        if (settledResult.status === 'fulfilled') {
          const { wallet, result } = settledResult.value;
          results.push(result);

          walletSummaries.push({
            walletId: wallet.id,
            walletName: wallet.name,
            synced: result.synced,
            orphanedCount: result.changes.orphanedPositions.length,
            unknownCount: result.changes.unknownPositions.length,
            updatedCount: result.changes.updatedPositions.length,
            error: result.errors[0],
          });

          if (result.detailedOrphaned) allOrphaned.push(...result.detailedOrphaned);
          if (result.detailedUnknown) allUnknown.push(...result.detailedUnknown);
          if (result.detailedUpdated) allUpdated.push(...result.detailedUpdated);
        } else {
          const wallet = liveWallets[syncResults.indexOf(settledResult)];
          if (!wallet) continue;
          const errorMsg = serializeError(settledResult.reason);
          results.push({
            walletId: wallet.id,
            synced: false,
            changes: {
              orphanedPositions: [],
              unknownPositions: [],
              updatedPositions: [],
              balanceUpdated: false,
            },
            errors: [errorMsg],
          });

          walletSummaries.push({
            walletId: wallet.id,
            walletName: wallet.name,
            synced: false,
            orphanedCount: 0,
            unknownCount: 0,
            updatedCount: 0,
            error: errorMsg,
          });
        }
      }

      const syncResult: PositionSyncResult = {
        startTime,
        endTime: new Date(),
        walletsChecked: liveWallets.length,
        totalOrphaned: allOrphaned.length,
        totalUnknown: allUnknown.length,
        totalUpdated: allUpdated.length,
        walletSummaries,
        orphanedPositions: allOrphaned,
        unknownPositions: allUnknown,
        updatedPositions: allUpdated,
      };

      outputPositionSyncResults(syncResult);
    } catch (error) {
      if (error instanceof BinanceIpBannedError) {
        logger.warn('[PositionSync] Skipping - IP banned');
        return results;
      }
      logger.error(
        { error: serializeError(error) },
        '[PositionSync] Failed to sync wallets'
      );
    }

    return results;
  }

  async syncWallet(wallet: Wallet): Promise<SyncResult> {
    const result: SyncResult = {
      walletId: wallet.id,
      synced: true,
      changes: {
        orphanedPositions: [],
        unknownPositions: [],
        updatedPositions: [],
        balanceUpdated: false,
      },
      errors: [],
      detailedOrphaned: [],
      detailedUnknown: [],
      detailedUpdated: [],
    };

    try {
      const client = createBinanceFuturesClient(wallet);

      const [dbOpenPositions, exchangePositions] = await Promise.all([
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
        getPositions(client),
      ]);

      const exchangePositionsBySymbol = new Map<string, FuturesPosition>(
        exchangePositions.map((p) => [p.symbol, p])
      );

      const processedSymbols = new Set<string>();
      for (const dbPosition of dbOpenPositions) {
        if (processedSymbols.has(dbPosition.symbol)) continue;
        processedSymbols.add(dbPosition.symbol);
        const exchangePosition = exchangePositionsBySymbol.get(dbPosition.symbol);

        if (!exchangePosition) {
          result.changes.orphanedPositions.push(dbPosition.id);

          let pnl = 0;
          let pnlPercent = 0;
          let exitPrice = 0;
          let totalFees = 0;
          const actualEntryFee = parseFloat(dbPosition.entryFee || '0');
          let estimatedExitFee = 0;
          const entryPrice = parseFloat(dbPosition.entryPrice);
          const quantity = parseFloat(dbPosition.quantity);
          const accumulatedFunding = parseFloat(dbPosition.accumulatedFunding || '0');

          try {
            const markPriceData = await getBinanceFuturesDataService().getMarkPrice(dbPosition.symbol);
            if (markPriceData) {
              exitPrice = markPriceData.markPrice;
              const leverage = dbPosition.leverage || 1;

              const pnlResult = calculatePnl({
                entryPrice,
                exitPrice,
                quantity,
                side: dbPosition.side,
                marketType: 'FUTURES',
                leverage,
                accumulatedFunding,
              });
              pnl = pnlResult.netPnl;
              pnlPercent = pnlResult.pnlPercent;
              totalFees = pnlResult.totalFees;
              estimatedExitFee = totalFees - actualEntryFee;

              const currentBalance = parseFloat(wallet.currentBalance || '0');
              const newBalance = currentBalance + pnl;

              await db
                .update(wallets)
                .set({
                  currentBalance: newBalance.toString(),
                  updatedAt: new Date(),
                })
                .where(eq(wallets.id, wallet.id));

              result.changes.balanceUpdated = true;
            }
          } catch (error) {
            logger.warn(
              { walletId: wallet.id, symbol: dbPosition.symbol, error: serializeError(error) },
              '[PositionSync] Failed to fetch mark price for orphaned position PnL calculation'
            );
          }

          const hasProtectionOrders = dbPosition.stopLossAlgoId || dbPosition.stopLossOrderId ||
            dbPosition.takeProfitAlgoId || dbPosition.takeProfitOrderId;
          if (hasProtectionOrders && !isPaperWallet(wallet)) {
            try {
              await cancelAllProtectionOrders({
                wallet,
                symbol: dbPosition.symbol,
                marketType: 'FUTURES',
                stopLossAlgoId: dbPosition.stopLossAlgoId,
                stopLossOrderId: dbPosition.stopLossOrderId,
                takeProfitAlgoId: dbPosition.takeProfitAlgoId,
                takeProfitOrderId: dbPosition.takeProfitOrderId,
              });
            } catch (cancelError) {
              logger.warn({
                executionId: dbPosition.id,
                error: serializeError(cancelError),
              }, '[PositionSync] Failed to cancel protection orders for orphaned position');
            }
          }

          result.detailedOrphaned?.push({
            walletId: wallet.id,
            executionId: dbPosition.id,
            symbol: dbPosition.symbol,
            side: dbPosition.side,
            entryPrice,
            exitPrice,
            quantity,
            pnl,
            pnlPercent,
          });

          await db
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitSource: 'SYNC',
              exitReason: 'ORPHANED_POSITION',
              exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
              pnl: pnl !== 0 ? pnl.toString() : null,
              pnlPercent: pnlPercent !== 0 ? pnlPercent.toString() : null,
              fees: totalFees > 0 ? totalFees.toString() : null,
              entryFee: actualEntryFee > 0 ? actualEntryFee.toString() : null,
              exitFee: estimatedExitFee > 0 ? estimatedExitFee.toString() : null,
              stopLossAlgoId: null,
              stopLossOrderId: null,
              takeProfitAlgoId: null,
              takeProfitOrderId: null,
              closedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(tradeExecutions.id, dbPosition.id));

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(wallet.id, {
              ...dbPosition,
              status: 'closed',
              exitReason: 'ORPHANED_POSITION',
              pnl: pnl.toString(),
              pnlPercent: pnlPercent.toString(),
            });
          }
        } else {
          const dbQty = parseFloat(dbPosition.quantity);
          const exchangeQty = Math.abs(parseFloat(String(exchangePosition.positionAmt)));
          const dbEntryPrice = parseFloat(dbPosition.entryPrice);
          const exchangeEntryPrice = parseFloat(String(exchangePosition.entryPrice));

          const qtyChanged = Math.abs(dbQty - exchangeQty) > 0.00001;
          const priceChanged = Math.abs(dbEntryPrice - exchangeEntryPrice) > 0.01;

          if (qtyChanged || priceChanged) {
            await db
              .update(tradeExecutions)
              .set({
                quantity: exchangeQty.toString(),
                entryPrice: exchangeEntryPrice.toString(),
                liquidationPrice: exchangePosition.liquidationPrice?.toString(),
                updatedAt: new Date(),
              })
              .where(eq(tradeExecutions.id, dbPosition.id));

            result.changes.updatedPositions.push(dbPosition.id);

            if (qtyChanged) {
              result.detailedUpdated?.push({
                walletId: wallet.id,
                executionId: dbPosition.id,
                symbol: dbPosition.symbol,
                field: 'Quantity',
                oldValue: dbQty,
                newValue: exchangeQty,
              });
            }
            if (priceChanged) {
              result.detailedUpdated?.push({
                walletId: wallet.id,
                executionId: dbPosition.id,
                symbol: dbPosition.symbol,
                field: 'Entry Price',
                oldValue: dbEntryPrice,
                newValue: exchangeEntryPrice,
              });
            }
          }

          exchangePositionsBySymbol.delete(dbPosition.symbol);
        }
      }

      for (const [symbol, position] of exchangePositionsBySymbol) {
        result.changes.unknownPositions.push(symbol);

        const positionAmt = parseFloat(String(position.positionAmt));
        const entryPrice = parseFloat(String(position.entryPrice));
        const notionalValue = Math.abs(positionAmt * entryPrice);

        result.detailedUnknown?.push({
          walletId: wallet.id,
          symbol,
          positionAmt,
          entryPrice,
          unrealizedPnl: parseFloat(String(position.unrealizedPnl || 0)),
          leverage: position.leverage || 1,
          marginType: position.marginType || 'ISOLATED',
        });

        const DUST_NOTIONAL_THRESHOLD = 5;
        const isDust = notionalValue < DUST_NOTIONAL_THRESHOLD;

        if (isDust) {
          try {
            await closePosition(client, symbol, String(position.positionAmt));
            logger.info(
              { walletId: wallet.id, symbol, positionAmt, notionalValue: notionalValue.toFixed(4) },
              '[PositionSync] Auto-closed dust position'
            );
          } catch (closeError) {
            logger.warn(
              { walletId: wallet.id, symbol, positionAmt, error: serializeError(closeError) },
              '[PositionSync] Failed to auto-close dust position'
            );
          }
        } else {
          const side: 'LONG' | 'SHORT' = positionAmt > 0 ? 'LONG' : 'SHORT';
          const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          try {
            await db.insert(tradeExecutions).values({
              id: executionId,
              userId: wallet.userId,
              walletId: wallet.id,
              symbol,
              side,
              entryPrice: entryPrice.toString(),
              quantity: Math.abs(positionAmt).toFixed(8),
              openedAt: new Date(),
              status: 'open',
              entryOrderType: 'MARKET',
              marketType: 'FUTURES',
              leverage: position.leverage || 1,
              highestPriceSinceEntry: entryPrice.toString(),
              lowestPriceSinceEntry: entryPrice.toString(),
              exitSource: 'MANUAL',
            });

            logger.info(
              { walletId: wallet.id, symbol, executionId, side, positionAmt, entryPrice, notionalValue: notionalValue.toFixed(2) },
              '[PositionSync] Adopted unknown position into DB'
            );

            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitRiskAlert(wallet.id, {
                type: 'UNKNOWN_POSITION',
                level: 'warning',
                symbol,
                message: `Unknown position adopted: ${symbol} ${side} ${Math.abs(positionAmt)} qty ($${notionalValue.toFixed(2)}) - now tracked as ${executionId}.`,
                data: {
                  positionAmt: position.positionAmt,
                  entryPrice: position.entryPrice,
                  unrealizedPnl: position.unrealizedPnl,
                  leverage: position.leverage,
                  marginType: position.marginType,
                  executionId,
                },
                timestamp: Date.now(),
              });
            }

            try {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const intentOrder = await db.query.orders.findFirst({
                where: and(
                  eq(orders.walletId, wallet.id),
                  eq(orders.symbol, symbol),
                  eq(orders.side, side === 'LONG' ? 'BUY' : 'SELL'),
                  or(isNotNull(orders.stopLossIntent), isNotNull(orders.takeProfitIntent)),
                  gte(orders.createdAt, sevenDaysAgo),
                ),
                orderBy: [desc(orders.createdAt)],
              });

              if (intentOrder) {
                const qty = Math.abs(positionAmt);
                let stopLossAlgoId: number | null = null;
                let takeProfitAlgoId: number | null = null;
                let stopLossOrderId: number | null = null;
                let takeProfitOrderId: number | null = null;
                let stopLossIsAlgo = false;
                let takeProfitIsAlgo = false;

                if (intentOrder.stopLossIntent) {
                  try {
                    const slResult = await autoTradingService.createStopLossOrder(wallet, symbol, qty, parseFloat(intentOrder.stopLossIntent), side, 'FUTURES');
                    if (slResult.isAlgoOrder) {
                      stopLossAlgoId = slResult.algoId;
                      stopLossIsAlgo = true;
                    } else {
                      stopLossOrderId = slResult.orderId;
                    }
                    logger.info({ executionId, symbol, stopLossIntent: intentOrder.stopLossIntent }, '[PositionSync] Placed SL from intent');
                  } catch (slError) {
                    logger.error({ executionId, symbol, error: serializeError(slError) }, '[PositionSync] Failed to place SL from intent');
                  }
                }

                if (intentOrder.takeProfitIntent) {
                  try {
                    const tpResult = await autoTradingService.createTakeProfitOrder(wallet, symbol, qty, parseFloat(intentOrder.takeProfitIntent), side, 'FUTURES');
                    if (tpResult.isAlgoOrder) {
                      takeProfitAlgoId = tpResult.algoId;
                      takeProfitIsAlgo = true;
                    } else {
                      takeProfitOrderId = tpResult.orderId;
                    }
                    logger.info({ executionId, symbol, takeProfitIntent: intentOrder.takeProfitIntent }, '[PositionSync] Placed TP from intent');
                  } catch (tpError) {
                    logger.error({ executionId, symbol, error: serializeError(tpError) }, '[PositionSync] Failed to place TP from intent');
                  }
                }

                await db.update(tradeExecutions).set({
                  stopLoss: intentOrder.stopLossIntent ?? undefined,
                  takeProfit: intentOrder.takeProfitIntent ?? undefined,
                  stopLossAlgoId,
                  stopLossOrderId,
                  takeProfitAlgoId,
                  takeProfitOrderId,
                  stopLossIsAlgo,
                  takeProfitIsAlgo,
                  updatedAt: new Date(),
                }).where(eq(tradeExecutions.id, executionId));

                await db.update(orders).set({
                  stopLossIntent: null,
                  takeProfitIntent: null,
                }).where(eq(orders.orderId, intentOrder.orderId));
              }
            } catch (intentError) {
              logger.error({ executionId, symbol, error: serializeError(intentError) }, '[PositionSync] Failed to process intent order for adopted position');
            }
          } catch (adoptError) {
            logger.error(
              { walletId: wallet.id, symbol, positionAmt, error: serializeError(adoptError) },
              '[PositionSync] Failed to adopt unknown position'
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof BinanceIpBannedError) {
        logger.warn({ walletId: wallet.id }, '[PositionSync] Skipping wallet sync - IP banned');
        return result;
      }
      const errorMsg = serializeError(error);
      result.synced = false;
      result.errors.push(errorMsg);
      logger.error(
        { walletId: wallet.id, walletName: wallet.name, error: errorMsg },
        '[PositionSync] Failed to sync wallet positions'
      );
    }

    return result;
  }
}

export const positionSyncService = new PositionSyncService();
