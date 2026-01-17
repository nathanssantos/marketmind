import type { OrphanedPositionEntry, PositionSyncResult, UnknownPositionEntry, UpdatedPositionEntry, WalletSyncEntry } from '@marketmind/logger';
import type { FuturesPosition } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { createBinanceFuturesClient, isPaperWallet, getPositions } from './binance-futures-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger, serializeError } from './logger';
import { outputPositionSyncResults } from './watcher-batch-logger';
import { getWebSocketService } from './websocket';

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

    this.syncInterval = setInterval(() => {
      void this.syncAllWallets();
    }, 60000);
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

      for (const dbPosition of dbOpenPositions) {
        const exchangePosition = exchangePositionsBySymbol.get(dbPosition.symbol);

        if (!exchangePosition) {
          result.changes.orphanedPositions.push(dbPosition.id);

          let pnl = 0;
          let pnlPercent = 0;
          let exitPrice = 0;
          const entryPrice = parseFloat(dbPosition.entryPrice);
          const quantity = parseFloat(dbPosition.quantity);

          try {
            const markPriceData = await getBinanceFuturesDataService().getMarkPrice(dbPosition.symbol);
            if (markPriceData) {
              exitPrice = markPriceData.markPrice;
              const leverage = dbPosition.leverage || 1;

              if (dbPosition.side === 'LONG') {
                pnl = (exitPrice - entryPrice) * quantity;
              } else {
                pnl = (entryPrice - exitPrice) * quantity;
              }

              const entryValue = entryPrice * quantity;
              const marginValue = entryValue / leverage;
              pnlPercent = marginValue > 0 ? (pnl / marginValue) * 100 : 0;

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

        result.detailedUnknown?.push({
          walletId: wallet.id,
          symbol,
          positionAmt: parseFloat(String(position.positionAmt)),
          entryPrice: parseFloat(String(position.entryPrice)),
          unrealizedPnl: parseFloat(String(position.unrealizedPnl || 0)),
          leverage: position.leverage || 1,
          marginType: position.marginType || 'ISOLATED',
        });

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitRiskAlert(wallet.id, {
            type: 'UNKNOWN_POSITION',
            level: 'critical',
            symbol,
            message: `Unknown position detected on exchange: ${symbol} with ${position.positionAmt} qty. This position is NOT tracked in the system - MANUAL CHECK REQUIRED.`,
            data: {
              positionAmt: position.positionAmt,
              entryPrice: position.entryPrice,
              unrealizedPnl: position.unrealizedPnl,
              leverage: position.leverage,
              marginType: position.marginType,
            },
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
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
