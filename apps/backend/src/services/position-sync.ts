import type { OrphanedPositionEntry, PositionSyncResult, UnknownPositionEntry, UpdatedPositionEntry, WalletSyncEntry } from '@marketmind/logger';
import type { FuturesPosition, PositionSide } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { STARTUP_CONFIG } from '../constants';
import { db } from '../db';
import { tradeExecutions, wallets, type Wallet } from '../db/schema';
import { calculatePnl } from '@marketmind/utils';
import { BinanceIpBannedError } from './binance-api-cache';
import { createBinanceFuturesClient, isPaperWallet, getPositions, closePosition, getAllTradeFeesForPosition } from './binance-futures-client';
import { logger, serializeError } from './logger';
import { cancelAllProtectionOrders } from './protection-orders';
import { type SyncResult, createEmptySyncResult, createFailedSyncResult, processIntentOrderForAdoptedPosition } from './position-sync-helpers';
import { incrementWalletBalanceAndBroadcast } from './wallet-broadcast';
import { outputPositionSyncResults } from './watcher-batch-logger';
import { getWebSocketService } from './websocket';

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
          results.push(createFailedSyncResult(wallet.id, errorMsg));

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
    const result = createEmptySyncResult(wallet.id);

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

      const processedSymbolsForUpdate = new Set<string>();
      for (const dbPosition of dbOpenPositions) {
        const exchangePosition = exchangePositionsBySymbol.get(dbPosition.symbol);

        if (!exchangePosition) {
          result.changes.orphanedPositions.push(dbPosition.id);

          let pnl = 0;
          let pnlPercent = 0;
          let exitPrice = 0;
          let totalFees = 0;
          let actualEntryFee = parseFloat(dbPosition.entryFee ?? '0');
          let actualExitFee = 0;
          const entryPrice = parseFloat(dbPosition.entryPrice);
          const quantity = parseFloat(dbPosition.quantity);
          const accumulatedFunding = parseFloat(dbPosition.accumulatedFunding ?? '0');

          try {
            const openedAt = dbPosition.openedAt?.getTime() || dbPosition.createdAt?.getTime() || Date.now();
            // Pass entryOrderId so the fee lookup scopes only to trades
            // belonging to THIS position's entry order — not every same-
            // side trade in the multi-hour window. Without this an
            // orphaned 2h SHORT was summing every unrelated SELL the
            // user did in that window (other reverses, scalps, manual
            // entries) and inflating the fees ~2.5×.
            const realFees = await getAllTradeFeesForPosition(client, dbPosition.symbol, dbPosition.side, openedAt, undefined, dbPosition.entryOrderId, dbPosition.exitOrderId).catch(() => null);

            if (realFees && realFees.exitPrice > 0) {
              exitPrice = realFees.exitPrice;
              if (realFees.entryFee > 0) actualEntryFee = realFees.entryFee;
              if (realFees.exitFee > 0) actualExitFee = realFees.exitFee;
            } else {
              // Previous behaviour fell back to the CURRENT mark price as
              // the orphan's exit price. That's catastrophic for stop-loss
              // / take-profit fills: the price spikes briefly to trigger
              // the order, fills the position, then mean-reverts within
              // seconds. By the time position-sync runs (every 30s), mark
              // price is already back near entry — so a $200 LOSS got
              // booked as a $179 PROFIT (incident 2026-05-07T23:38).
              //
              // Better to leave exitPrice / pnl null and book the exec as
              // 'SYNC_INCOMPLETE'; the reconcile-execs-with-binance.ts
              // maintenance script can backfill from real fills later.
              logger.warn(
                { walletId: wallet.id, symbol: dbPosition.symbol, executionId: dbPosition.id, entryOrderId: dbPosition.entryOrderId, exitOrderId: dbPosition.exitOrderId },
                '[PositionSync] Could not derive exit price from Binance trades — leaving exec SYNC_INCOMPLETE (run reconcile script to backfill)',
              );
            }

            if (exitPrice > 0) {
              const leverage = dbPosition.leverage ?? 1;

              const pnlResult = calculatePnl({
                entryPrice,
                exitPrice,
                quantity,
                side: dbPosition.side,
                marketType: 'FUTURES',
                leverage,
                accumulatedFunding,
                entryFee: actualEntryFee,
                exitFee: actualExitFee,
              });
              const existingPartialPnl = parseFloat(dbPosition.partialClosePnl ?? '0');
              pnl = pnlResult.netPnl + existingPartialPnl;
              pnlPercent = pnlResult.pnlPercent;
              totalFees = pnlResult.totalFees;

              await incrementWalletBalanceAndBroadcast(wallet.id, pnl);
              result.changes.balanceUpdated = true;
            }
          } catch (error) {
            logger.warn(
              { walletId: wallet.id, symbol: dbPosition.symbol, error: serializeError(error) },
              '[PositionSync] Failed to fetch mark price for orphaned position PnL calculation'
            );
          }

          const hasProtectionOrders = dbPosition.stopLossAlgoId ?? dbPosition.stopLossOrderId ??
            dbPosition.takeProfitAlgoId ?? dbPosition.takeProfitOrderId;
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
              // SYNC_INCOMPLETE = sync detected orphan but couldn't
              // derive a reliable exit price from Binance fills. Avoids
              // booking phantom PnL; reconcile-execs-with-binance.ts
              // backfills these later from authoritative trades.
              exitReason: exitPrice > 0 ? 'ORPHANED_POSITION' : 'SYNC_INCOMPLETE',
              exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
              pnl: pnl !== 0 ? pnl.toString() : null,
              pnlPercent: pnlPercent !== 0 ? pnlPercent.toString() : null,
              fees: totalFees > 0 ? totalFees.toString() : null,
              entryFee: actualEntryFee > 0 ? actualEntryFee.toString() : null,
              exitFee: actualExitFee > 0 ? actualExitFee.toString() : null,
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
          if (processedSymbolsForUpdate.has(dbPosition.symbol)) continue;
          processedSymbolsForUpdate.add(dbPosition.symbol);

          const dbQty = parseFloat(dbPosition.quantity);
          const exchangeQty = Math.abs(parseFloat(String(exchangePosition.positionAmt)));
          const dbEntryPrice = parseFloat(dbPosition.entryPrice);
          const exchangeEntryPrice = parseFloat(String(exchangePosition.entryPrice));
          const dbLeverage = dbPosition.leverage ?? 1;
          const exchangeLeverage = Number(exchangePosition.leverage) || 1;

          const qtyChanged = Math.abs(dbQty - exchangeQty) > 0.00001;
          const priceChanged = Math.abs(dbEntryPrice - exchangeEntryPrice) > 0.01;
          const exchangeLiqPrice = exchangePosition.liquidationPrice?.toString();
          const liqPriceMissing = !dbPosition.liquidationPrice && !!exchangeLiqPrice;
          // Reconcile leverage too — handles execs created before the
          // V3 leverage-storage fix landed (those rows have leverage=1
          // even though the position is running at e.g. 10× on Binance).
          // Without this, the chart's PnL% line keeps showing the raw
          // notional move on a leveraged position until the position
          // is closed and re-opened.
          const leverageChanged = exchangeLeverage > 0 && dbLeverage !== exchangeLeverage;

          if (qtyChanged || priceChanged || liqPriceMissing || leverageChanged) {
            const updateSet: Record<string, unknown> = {
              liquidationPrice: exchangeLiqPrice,
              updatedAt: new Date(),
            };
            if (qtyChanged) updateSet['quantity'] = exchangeQty.toString();
            if (priceChanged) updateSet['entryPrice'] = exchangeEntryPrice.toString();
            if (leverageChanged) updateSet['leverage'] = exchangeLeverage;

            await db
              .update(tradeExecutions)
              .set(updateSet)
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
            if (leverageChanged) {
              result.detailedUpdated?.push({
                walletId: wallet.id,
                executionId: dbPosition.id,
                symbol: dbPosition.symbol,
                field: 'Leverage',
                oldValue: dbLeverage,
                newValue: exchangeLeverage,
              });
            }

            // Push the corrected exec to the renderer so the chart
            // line and Portfolio panel update without waiting for the
            // next tRPC poll.
            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitPositionUpdate(wallet.id, {
                ...dbPosition,
                ...(qtyChanged ? { quantity: exchangeQty.toString() } : {}),
                ...(priceChanged ? { entryPrice: exchangeEntryPrice.toString() } : {}),
                ...(leverageChanged ? { leverage: exchangeLeverage } : {}),
                ...(exchangeLiqPrice ? { liquidationPrice: exchangeLiqPrice } : {}),
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
          const side: PositionSide = positionAmt > 0 ? 'LONG' : 'SHORT';

          // Race guard: dbOpenPositions was read at the start of this
          // sync. If user-stream's handleManualOrderFill committed an
          // exec between then and now, our snapshot is stale — re-check
          // immediately before insert. Without this the Portfolio
          // briefly summed two open execs (handleManualOrderFill +
          // position-sync) and showed double exposure for the symbol.
          const [recentlyInserted] = await db
            .select({ id: tradeExecutions.id })
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, wallet.id),
                eq(tradeExecutions.symbol, symbol),
                eq(tradeExecutions.side, side),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
            .limit(1);

          if (recentlyInserted) {
            logger.info(
              { walletId: wallet.id, symbol, side, existing: recentlyInserted.id },
              '[PositionSync] Skipped unknown-position insert — same-side exec was inserted by user-stream concurrently'
            );
            continue;
          }

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

            await processIntentOrderForAdoptedPosition(wallet, symbol, side, positionAmt, executionId);
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
