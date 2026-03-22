import { eq, and, gte, desc } from 'drizzle-orm';
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
import { backfillAllTrades, backfillTransfers } from './income-sync-backfill';

const SYNC_INTERVAL_MS = TIME_MS.HOUR;
const INCOME_LOOKBACK_MS = 24 * TIME_MS.HOUR;

export interface IncomeSyncResult {
  walletId: string;
  walletName: string;
  commissionRecords: number;
  fundingRecords: number;
  transferRecords: number;
  totalCommission: number;
  totalFunding: number;
  totalDeposits: number;
  totalWithdrawals: number;
  tradesUpdated: number;
  errors: string[];
}

export interface IncomeSyncServiceStartOptions {
  delayFirstSync?: number;
}

class IncomeSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastSyncTime: Map<string, number> = new Map();

  start(options: IncomeSyncServiceStartOptions = {}): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.syncInterval = setInterval(() => {
      void this.syncAllWallets();
    }, SYNC_INTERVAL_MS);

    if (options.delayFirstSync) {
      setTimeout(() => void this.syncAllWallets(), options.delayFirstSync);
    } else {
      void this.syncAllWallets();
    }
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.info('[IncomeSyncService] Stopped');
  }

  async syncAllWallets(): Promise<IncomeSyncResult[]> {
    const results: IncomeSyncResult[] = [];

    try {
      const liveWallets = await db
        .select()
        .from(wallets)
        .where(eq(wallets.marketType, 'FUTURES'));

      const realWallets = liveWallets.filter(w => !isPaperWallet(w));

      if (realWallets.length === 0) {
        logger.trace('[IncomeSyncService] No live futures wallets to sync');
        return results;
      }

      for (const wallet of realWallets) {
        try {
          const result = await this.syncWalletIncome(wallet);
          results.push(result);
        } catch (error) {
          logger.error({
            walletId: wallet.id,
            error: serializeError(error),
          }, '[IncomeSyncService] Failed to sync wallet income');
          results.push({
            walletId: wallet.id,
            walletName: wallet.name,
            commissionRecords: 0,
            fundingRecords: 0,
            transferRecords: 0,
            totalCommission: 0,
            totalFunding: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            tradesUpdated: 0,
            errors: [serializeError(error)],
          });
        }
      }

      const totalCommission = results.reduce((sum, r) => sum + r.totalCommission, 0);
      const totalFunding = results.reduce((sum, r) => sum + r.totalFunding, 0);
      const totalDeposits = results.reduce((sum, r) => sum + r.totalDeposits, 0);
      const totalWithdrawals = results.reduce((sum, r) => sum + r.totalWithdrawals, 0);
      const totalTradesUpdated = results.reduce((sum, r) => sum + r.tradesUpdated, 0);

      logger.info({
        walletsProcessed: results.length,
        totalCommission: totalCommission.toFixed(4),
        totalFunding: totalFunding.toFixed(4),
        totalDeposits: totalDeposits.toFixed(4),
        totalWithdrawals: totalWithdrawals.toFixed(4),
        totalTradesUpdated,
      }, '[IncomeSyncService] Income sync completed');

      return results;
    } catch (error) {
      logger.error({ error: serializeError(error) }, '[IncomeSyncService] Failed to sync all wallets');
      return results;
    }
  }

  async syncWalletIncome(wallet: Wallet): Promise<IncomeSyncResult> {
    const result: IncomeSyncResult = {
      walletId: wallet.id,
      walletName: wallet.name,
      commissionRecords: 0,
      fundingRecords: 0,
      transferRecords: 0,
      totalCommission: 0,
      totalFunding: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      tradesUpdated: 0,
      errors: [],
    };

    try {
      const client = createBinanceFuturesClient(wallet);
      const lastSync = this.lastSyncTime.get(wallet.id) || (Date.now() - INCOME_LOOKBACK_MS);
      const now = Date.now();

      const [commissionHistory, fundingHistory, transferHistory] = await Promise.all([
        getIncomeHistory(client, {
          incomeType: 'COMMISSION',
          startTime: lastSync,
          endTime: now,
          limit: 1000,
        }),
        getIncomeHistory(client, {
          incomeType: 'FUNDING_FEE',
          startTime: lastSync,
          endTime: now,
          limit: 1000,
        }),
        getIncomeHistory(client, {
          incomeType: 'TRANSFER',
          startTime: lastSync,
          endTime: now,
          limit: 1000,
        }),
      ]);

      result.commissionRecords = commissionHistory.length;
      result.fundingRecords = fundingHistory.length;
      result.transferRecords = transferHistory.length;

      for (const record of commissionHistory) {
        const income = parseFloat(record.income);
        result.totalCommission += Math.abs(income);
      }

      for (const record of fundingHistory) {
        const income = parseFloat(record.income);
        result.totalFunding += income;
      }

      const walletCreatedAt = wallet.createdAt.getTime();
      for (const record of transferHistory) {
        if (record.time < walletCreatedAt) continue;

        const income = parseFloat(record.income);
        if (income > 0) {
          result.totalDeposits += income;
        } else {
          result.totalWithdrawals += Math.abs(income);
        }
      }

      if (result.totalDeposits > 0 || result.totalWithdrawals > 0) {
        const currentDeposits = parseFloat(wallet.totalDeposits ?? '0');
        const currentWithdrawals = parseFloat(wallet.totalWithdrawals ?? '0');

        await db
          .update(wallets)
          .set({
            totalDeposits: (currentDeposits + result.totalDeposits).toString(),
            totalWithdrawals: (currentWithdrawals + result.totalWithdrawals).toString(),
            lastTransferSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));

        logger.info({
          walletId: wallet.id,
          walletName: wallet.name,
          transferRecords: result.transferRecords,
          newDeposits: result.totalDeposits.toFixed(4),
          newWithdrawals: result.totalWithdrawals.toFixed(4),
          totalDeposits: (currentDeposits + result.totalDeposits).toFixed(4),
          totalWithdrawals: (currentWithdrawals + result.totalWithdrawals).toFixed(4),
        }, '[IncomeSyncService] Wallet transfers synced');
      }

      const tradesUpdated = await this.updateTradesWithActualFees(
        wallet.id,
        commissionHistory,
        fundingHistory
      );
      result.tradesUpdated = tradesUpdated;

      this.lastSyncTime.set(wallet.id, now);


      return result;
    } catch (error) {
      result.errors.push(serializeError(error));
      throw error;
    }
  }

  private async updateTradesWithActualFees(
    walletId: string,
    commissionHistory: IncomeHistoryRecord[],
    fundingHistory: IncomeHistoryRecord[],
    lookbackMs: number = INCOME_LOOKBACK_MS
  ): Promise<number> {
    let updatedCount = 0;

    const symbolCommissions = new Map<string, { total: number; records: IncomeHistoryRecord[] }>();
    for (const record of commissionHistory) {
      if (!record.symbol) continue;
      const existing = symbolCommissions.get(record.symbol) || { total: 0, records: [] };
      existing.total += Math.abs(parseFloat(record.income));
      existing.records.push(record);
      symbolCommissions.set(record.symbol, existing);
    }

    const symbolFunding = new Map<string, { total: number; records: IncomeHistoryRecord[] }>();
    for (const record of fundingHistory) {
      if (!record.symbol) continue;
      const existing = symbolFunding.get(record.symbol) || { total: 0, records: [] };
      existing.total += parseFloat(record.income);
      existing.records.push(record);
      symbolFunding.set(record.symbol, existing);
    }

    const recentTrades = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.marketType, 'FUTURES'),
          gte(tradeExecutions.createdAt, new Date(Date.now() - lookbackMs))
        )
      )
      .orderBy(desc(tradeExecutions.createdAt));

    logger.trace({
      walletId,
      tradesFound: recentTrades.length,
      commissionSymbols: Array.from(symbolCommissions.keys()),
      fundingSymbols: Array.from(symbolFunding.keys()),
    }, '[IncomeSyncService] Matching trades with income records');

    for (const trade of recentTrades) {
      if (trade.status === 'closed') continue;

      const commissionData = symbolCommissions.get(trade.symbol);
      const fundingData = symbolFunding.get(trade.symbol);

      if (!commissionData && !fundingData) {
        logger.trace({
          tradeId: trade.id,
          symbol: trade.symbol,
          availableSymbols: [...symbolCommissions.keys(), ...symbolFunding.keys()],
        }, '[IncomeSyncService] No commission/funding data for trade symbol');
        continue;
      }

      const tradeOpenTime = trade.openedAt?.getTime() || trade.createdAt.getTime();
      const tradeCloseTime = trade.closedAt?.getTime() || Date.now();

      let tradeCommission = 0;
      if (commissionData) {
        for (const record of commissionData.records) {
          if (record.time >= tradeOpenTime && record.time <= tradeCloseTime) {
            tradeCommission += Math.abs(parseFloat(record.income));
          }
        }
      }

      let tradeFunding = 0;
      if (fundingData) {
        for (const record of fundingData.records) {
          if (record.time >= tradeOpenTime && record.time <= tradeCloseTime) {
            tradeFunding += parseFloat(record.income);
          }
        }
      }

      if (tradeCommission > 0 || tradeFunding !== 0) {
        const currentFees = parseFloat(trade.fees || '0');
        const currentFunding = parseFloat(trade.accumulatedFunding || '0');
        const currentPnl = parseFloat(trade.pnl || '0');

        const entryPrice = parseFloat(trade.entryPrice);
        const exitPrice = parseFloat(trade.exitPrice || trade.entryPrice);
        const quantity = parseFloat(trade.quantity);
        const grossPnl = trade.side === 'LONG'
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;

        const actualFees = tradeCommission > 0 ? tradeCommission : currentFees;
        const actualFunding = currentFunding + tradeFunding;
        const expectedPnl = grossPnl - actualFees + actualFunding;

        const feesNeedUpdate =
          (tradeCommission > 0 && Math.abs(tradeCommission - currentFees) > 0.0001) ||
          (tradeFunding !== 0);

        const pnlNeedsRecalculation = Math.abs(expectedPnl - currentPnl) > 0.0001;

        if (feesNeedUpdate || pnlNeedsRecalculation) {
          await db
            .update(tradeExecutions)
            .set({
              fees: actualFees.toString(),
              accumulatedFunding: actualFunding.toString(),
              pnl: expectedPnl.toFixed(8),
              updatedAt: new Date(),
            })
            .where(eq(tradeExecutions.id, trade.id));

          updatedCount++;
        }
      }
    }

    return updatedCount;
  }

  async backfillAllTrades(startTime?: number): Promise<{ tradesProcessed: number; tradesUpdated: number }> {
    return backfillAllTrades(startTime, this.updateTradesWithActualFees.bind(this));
  }

  async backfillTransfers(walletId?: string): Promise<{ walletsProcessed: number; totalDeposits: number; totalWithdrawals: number }> {
    return backfillTransfers(walletId);
  }

  async runOnce(): Promise<IncomeSyncResult[]> {
    return this.syncAllWallets();
  }
}

export const incomeSyncService = new IncomeSyncService();
