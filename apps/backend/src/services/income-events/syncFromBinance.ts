import { desc, eq } from 'drizzle-orm';
import { TIME_MS } from '../../constants';
import { db } from '../../db';
import { incomeEvents, wallets } from '../../db/schema';
import type { Wallet } from '../../db/schema';
import {
  createBinanceFuturesClient,
  getIncomeHistory,
  isPaperWallet,
  type IncomeHistoryRecord,
} from '../binance-futures-client';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import { INCOME_TYPES, type IncomeType } from '../../constants/income-types';
import { insertIncomeEventsBatch, type InsertIncomeEventInput } from './insertIncomeEvent';
import { linkIncomeToExecution } from './matcher';

const DEFAULT_LOOKBACK_MS = 24 * TIME_MS.HOUR;
const MAX_INITIAL_LOOKBACK_MS = 30 * 24 * TIME_MS.HOUR;

const INCOME_TYPE_SET = new Set<string>(INCOME_TYPES);

const isKnownIncomeType = (type: string): type is IncomeType => INCOME_TYPE_SET.has(type);

export interface WalletSyncResult {
  walletId: string;
  walletName: string;
  fetched: number;
  inserted: number;
  linked: number;
  totalDeposits: number;
  totalWithdrawals: number;
  errors: string[];
}

export interface SyncOptions {
  startTime?: number;
  endTime?: number;
}

const getLastSyncedTime = async (walletId: string): Promise<number | null> => {
  const [latest] = await db
    .select({ t: incomeEvents.incomeTime })
    .from(incomeEvents)
    .where(eq(incomeEvents.walletId, walletId))
    .orderBy(desc(incomeEvents.incomeTime))
    .limit(1);

  return latest?.t ? latest.t.getTime() : null;
};

const toInsertRows = (wallet: Wallet, records: IncomeHistoryRecord[]): InsertIncomeEventInput[] => {
  const rows: InsertIncomeEventInput[] = [];
  for (const record of records) {
    if (!isKnownIncomeType(record.incomeType)) {
      logger.warn(
        { walletId: wallet.id, incomeType: record.incomeType, tranId: record.tranId },
        '[IncomeSync] Unknown income type — skipping',
      );
      continue;
    }

    rows.push({
      walletId: wallet.id,
      userId: wallet.userId,
      binanceTranId: record.tranId,
      incomeType: record.incomeType,
      amount: record.income,
      asset: record.asset,
      symbol: record.symbol ?? null,
      info: record.info ?? null,
      tradeId: record.tradeId ?? null,
      source: 'binance',
      incomeTime: new Date(record.time),
    });
  }
  return rows;
};

const updateTransferTotals = async (wallet: Wallet, records: IncomeHistoryRecord[]): Promise<{ deposits: number; withdrawals: number }> => {
  const walletCreatedAt = wallet.createdAt.getTime();
  let deposits = 0;
  let withdrawals = 0;

  for (const record of records) {
    if (record.incomeType !== 'TRANSFER') continue;
    if (record.time < walletCreatedAt) continue;

    const amount = parseFloat(record.income);
    if (amount > 0) deposits += amount;
    else withdrawals += Math.abs(amount);
  }

  if (deposits === 0 && withdrawals === 0) return { deposits, withdrawals };

  const currentDeposits = parseFloat(wallet.totalDeposits ?? '0');
  const currentWithdrawals = parseFloat(wallet.totalWithdrawals ?? '0');

  await db
    .update(wallets)
    .set({
      totalDeposits: (currentDeposits + deposits).toString(),
      totalWithdrawals: (currentWithdrawals + withdrawals).toString(),
      lastTransferSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id));

  return { deposits, withdrawals };
};

export const syncWalletIncome = async (wallet: Wallet, options: SyncOptions = {}): Promise<WalletSyncResult> => {
  const result: WalletSyncResult = {
    walletId: wallet.id,
    walletName: wallet.name,
    fetched: 0,
    inserted: 0,
    linked: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    errors: [],
  };

  if (isPaperWallet(wallet)) return result;

  try {
    const lastSynced = options.startTime ?? (await getLastSyncedTime(wallet.id));
    const now = options.endTime ?? Date.now();
    const defaultStart = now - DEFAULT_LOOKBACK_MS;
    const maxInitial = now - MAX_INITIAL_LOOKBACK_MS;
    const startTime = lastSynced ? Math.max(lastSynced + 1, maxInitial) : defaultStart;

    const client = createBinanceFuturesClient(wallet);
    const records: IncomeHistoryRecord[] = [];
    let pageStart = startTime;
    const MAX_PAGES = 50;
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await getIncomeHistory(client, {
        startTime: pageStart,
        endTime: now,
        limit: 1000,
      });
      records.push(...batch);
      if (batch.length < 1000) break;
      const lastTime = batch[batch.length - 1]?.time ?? pageStart;
      if (lastTime <= pageStart) break;
      pageStart = lastTime;
    }

    result.fetched = records.length;

    const insertRows = toInsertRows(wallet, records);
    result.inserted = await insertIncomeEventsBatch(insertRows);

    const { deposits, withdrawals } = await updateTransferTotals(wallet, records);
    result.totalDeposits = deposits;
    result.totalWithdrawals = withdrawals;

    for (const row of insertRows) {
      if (!row.symbol) continue;
      const id = await linkIncomeToExecution({
        walletId: row.walletId,
        symbol: row.symbol,
        incomeType: row.incomeType,
        incomeTime: row.incomeTime,
        binanceTranId: row.binanceTranId,
      });
      if (id) result.linked++;
    }

    return result;
  } catch (error) {
    result.errors.push(serializeError(error));
    throw error;
  }
};

export const syncAllWalletsIncome = async (options: SyncOptions = {}): Promise<WalletSyncResult[]> => {
  const liveWallets = await db
    .select()
    .from(wallets)
    .where(eq(wallets.marketType, 'FUTURES'));

  const realWallets = liveWallets.filter((w) => !isPaperWallet(w));

  const results: WalletSyncResult[] = [];
  for (const wallet of realWallets) {
    try {
      results.push(await syncWalletIncome(wallet, options));
    } catch (error) {
      logger.error(
        { walletId: wallet.id, error: serializeError(error) },
        '[IncomeSync] Failed to sync wallet',
      );
      results.push({
        walletId: wallet.id,
        walletName: wallet.name,
        fetched: 0,
        inserted: 0,
        linked: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        errors: [serializeError(error)],
      });
    }
  }

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalLinked = results.reduce((sum, r) => sum + r.linked, 0);

  logger.info(
    {
      walletsProcessed: results.length,
      totalInserted,
      totalLinked,
    },
    '[IncomeSync] Sync cycle complete',
  );

  return results;
};

const SYNC_INTERVAL_MS = TIME_MS.HOUR;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncRunning = false;

export interface StartIncomeSyncOptions {
  delayFirstSync?: number;
}

export const startIncomeSync = (options: StartIncomeSyncOptions = {}): void => {
  if (syncRunning) return;
  syncRunning = true;

  syncTimer = setInterval(() => {
    void syncAllWalletsIncome();
  }, SYNC_INTERVAL_MS);

  if (options.delayFirstSync) {
    setTimeout(() => void syncAllWalletsIncome(), options.delayFirstSync);
  } else {
    void syncAllWalletsIncome();
  }

  logger.info('[IncomeSync] Started');
};

export const stopIncomeSync = (): void => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  syncRunning = false;
  logger.info('[IncomeSync] Stopped');
};

export const runIncomeSyncOnce = async (): Promise<WalletSyncResult[]> => syncAllWalletsIncome();
