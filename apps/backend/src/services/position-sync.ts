import type { FuturesPosition } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { createBinanceFuturesClient, isPaperWallet, getPositions } from './binance-futures-client';
import { logger } from './logger';
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
    const results: SyncResult[] = [];

    try {
      const allWallets = await db.select().from(wallets);
      const liveWallets = allWallets.filter(
        (w) => !isPaperWallet(w) && w.apiKeyEncrypted && w.apiSecretEncrypted
      );

      for (const wallet of liveWallets) {
        try {
          const result = await this.syncWallet(wallet);
          results.push(result);
        } catch (error) {
          results.push({
            walletId: wallet.id,
            synced: false,
            changes: {
              orphanedPositions: [],
              unknownPositions: [],
              updatedPositions: [],
              balanceUpdated: false,
            },
            errors: [error instanceof Error ? error.message : String(error)],
          });
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
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
          logger.warn(
            {
              walletId: wallet.id,
              executionId: dbPosition.id,
              symbol: dbPosition.symbol,
            },
            '[PositionSync] ⚠️ Orphaned position detected - in DB but not on exchange'
          );
          result.changes.orphanedPositions.push(dbPosition.id);

          await db
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitSource: 'SYNC',
              exitReason: 'ORPHANED_POSITION',
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
            });
          }
        } else {
          const dbQty = parseFloat(dbPosition.quantity);
          const exchangeQty = Math.abs(parseFloat(String(exchangePosition.positionAmt)));
          const dbEntryPrice = parseFloat(dbPosition.entryPrice);
          const exchangeEntryPrice = parseFloat(String(exchangePosition.entryPrice));

          if (Math.abs(dbQty - exchangeQty) > 0.00001 || Math.abs(dbEntryPrice - exchangeEntryPrice) > 0.01) {
            logger.info(
              {
                walletId: wallet.id,
                executionId: dbPosition.id,
                symbol: dbPosition.symbol,
                dbQty,
                exchangeQty,
                dbEntryPrice,
                exchangeEntryPrice,
              },
              '[PositionSync] Position data updated from exchange'
            );

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
          }

          exchangePositionsBySymbol.delete(dbPosition.symbol);
        }
      }

      for (const [symbol, position] of exchangePositionsBySymbol) {
        logger.warn(
          {
            walletId: wallet.id,
            symbol,
            positionAmt: position.positionAmt,
            entryPrice: position.entryPrice,
          },
          '[PositionSync] ⚠️ Unknown position detected - on exchange but not in DB'
        );
        result.changes.unknownPositions.push(symbol);
      }

      if (result.changes.orphanedPositions.length > 0 || result.changes.unknownPositions.length > 0) {
        logger.warn(
          {
            walletId: wallet.id,
            orphanedCount: result.changes.orphanedPositions.length,
            unknownCount: result.changes.unknownPositions.length,
          },
          '[PositionSync] ⚠️ Position discrepancies found'
        );
      }
    } catch (error) {
      result.synced = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      logger.error(
        {
          walletId: wallet.id,
          error: error instanceof Error ? error.message : String(error),
        },
        '[PositionSync] Failed to sync wallet'
      );
    }

    return result;
  }
}

export const positionSyncService = new PositionSyncService();
