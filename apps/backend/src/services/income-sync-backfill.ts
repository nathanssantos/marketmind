import { eq, and, gte } from 'drizzle-orm';
import { TIME_MS } from '../constants';
import { db } from '../db';
import { tradeExecutions, wallets } from '../db/schema';
import type { Wallet } from '../db/schema';
import {
  createBinanceFuturesClient,
  getIncomeHistory,
  isPaperWallet,
  type IncomeHistoryRecord,
} from './binance-futures-client';
import { logger } from './logger';
import { serializeError } from '../utils/errors';

const BACKFILL_LOOKBACK_DAYS = 30;

export const backfillAllTrades = async (
  startTime: number | undefined,
  updateTradesWithActualFees: (
    walletId: string,
    commissionHistory: IncomeHistoryRecord[],
    fundingHistory: IncomeHistoryRecord[],
    lookbackMs: number,
  ) => Promise<number>,
): Promise<{ tradesProcessed: number; tradesUpdated: number }> => {
  const lookbackTime = startTime || Date.now() - (BACKFILL_LOOKBACK_DAYS * 24 * TIME_MS.HOUR);

  logger.info({
    lookbackTime: new Date(lookbackTime).toISOString(),
  }, '[IncomeSyncService] Starting backfill of actual fees');

  let totalProcessed = 0;
  let totalUpdated = 0;

  const liveWallets = await db
    .select()
    .from(wallets)
    .where(eq(wallets.marketType, 'FUTURES'));

  const realWallets = liveWallets.filter(w => !isPaperWallet(w));

  for (const wallet of realWallets) {
    try {
      const client = createBinanceFuturesClient(wallet);

      const [commissionHistory, fundingHistory] = await Promise.all([
        getIncomeHistory(client, {
          incomeType: 'COMMISSION',
          startTime: lookbackTime,
          endTime: Date.now(),
          limit: 1000,
        }),
        getIncomeHistory(client, {
          incomeType: 'FUNDING_FEE',
          startTime: lookbackTime,
          endTime: Date.now(),
          limit: 1000,
        }),
      ]);

      const trades = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, wallet.id),
            eq(tradeExecutions.marketType, 'FUTURES'),
            gte(tradeExecutions.createdAt, new Date(lookbackTime))
          )
        );

      totalProcessed += trades.length;

      const lookbackMs = Date.now() - lookbackTime;
      const updated = await updateTradesWithActualFees(
        wallet.id,
        commissionHistory,
        fundingHistory,
        lookbackMs
      );

      totalUpdated += updated;

      logger.info({
        walletId: wallet.id,
        walletName: wallet.name,
        tradesProcessed: trades.length,
        tradesUpdated: updated,
        commissionRecords: commissionHistory.length,
        fundingRecords: fundingHistory.length,
      }, '[IncomeSyncService] Wallet backfill completed');
    } catch (error) {
      logger.error({
        walletId: wallet.id,
        error: serializeError(error),
      }, '[IncomeSyncService] Failed to backfill wallet');
    }
  }

  logger.info({
    totalProcessed,
    totalUpdated,
  }, '[IncomeSyncService] Backfill completed');

  return { tradesProcessed: totalProcessed, tradesUpdated: totalUpdated };
};

export const backfillTransfers = async (
  walletId?: string,
): Promise<{ walletsProcessed: number; totalDeposits: number; totalWithdrawals: number }> => {
  const TRANSFER_LOOKBACK_DAYS = 90;

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let walletsProcessed = 0;

  const query = walletId
    ? db.select().from(wallets).where(and(eq(wallets.id, walletId), eq(wallets.marketType, 'FUTURES')))
    : db.select().from(wallets).where(eq(wallets.marketType, 'FUTURES'));

  const liveWallets = await query;
  const realWallets = liveWallets.filter((w: Wallet) => !isPaperWallet(w));

  for (const wallet of realWallets) {
    try {
      const client = createBinanceFuturesClient(wallet);

      const walletCreatedAt = wallet.createdAt.getTime();
      const maxLookback = Date.now() - (TRANSFER_LOOKBACK_DAYS * 24 * TIME_MS.HOUR);
      const startTime = Math.max(walletCreatedAt, maxLookback);

      const transferHistory = await getIncomeHistory(client, {
        incomeType: 'TRANSFER',
        startTime,
        endTime: Date.now(),
        limit: 1000,
      });

      let walletDeposits = 0;
      let walletWithdrawals = 0;

      for (const record of transferHistory) {
        if (record.time < walletCreatedAt) continue;

        const income = parseFloat(record.income);
        if (income > 0) {
          walletDeposits += income;
        } else {
          walletWithdrawals += Math.abs(income);
        }
      }

      await db
        .update(wallets)
        .set({
          totalDeposits: walletDeposits.toString(),
          totalWithdrawals: walletWithdrawals.toString(),
          lastTransferSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      totalDeposits += walletDeposits;
      totalWithdrawals += walletWithdrawals;
      walletsProcessed++;
    } catch (error) {
      logger.error({
        walletId: wallet.id,
        error: serializeError(error),
      }, '[IncomeSyncService] Failed to backfill wallet transfers');
    }
  }

  logger.info({
    walletsProcessed,
    totalDeposits: totalDeposits.toFixed(4),
    totalWithdrawals: totalWithdrawals.toFixed(4),
  }, '[IncomeSyncService] Transfer backfill completed');

  return { walletsProcessed, totalDeposits, totalWithdrawals };
};
