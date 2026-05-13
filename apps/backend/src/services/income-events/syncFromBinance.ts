import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
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

const SYNTHETIC_WINDOW_MS = 60_000;

// Binance `/fapi/v1/income` enforces a max 7-day window per call. Older
// callers only requested 24h-30d, so the bug rarely surfaced — but it
// silently truncated any range >7d to the latest 7 days, leaving holes
// in the income table. We now paginate explicitly in 7-day windows.
const INCOME_API_WINDOW_MS = 7 * 24 * TIME_MS.HOUR;

// Binance retains income history for ~6 months. Going further back via
// `/fapi/v1/income` returns empty pages — we cap the initial backfill
// at this horizon for fresh-wallet syncs to avoid 26+ pointless calls.
const MAX_BACKFILL_MS = 180 * 24 * TIME_MS.HOUR;

// Per-page limit on records (Binance max).
const PAGE_LIMIT = 1000;

// Hard cap on total API calls per `syncWalletIncome` invocation. With
// 7-day windows, 200 pages = ~3.8 years of history — far past Binance's
// 6-month retention, but the safety net protects against runaway pagination
// if a dense window keeps returning full pages of 1000.
const MAX_PAGES_PER_SYNC = 200;

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

/**
 * The WS handler `handle-exit-fill` writes REALIZED_PNL + COMMISSION
 * rows with a NEGATIVE synthetic `binanceTranId` (`-tradeId`) at fill
 * time so Today's P&L updates instantly — without waiting for the
 * Binance /fapi/v1/income REST endpoint's 1–30s propagation lag. When
 * the real income record eventually shows up here, we look up the
 * synthetic by `(walletId, incomeType, tradeId, binanceTranId < 0)`
 * and delete it. The real row then inserts cleanly via the unique
 * constraint on `(walletId, binanceTranId, incomeType)` — no double-
 * counting and the daily-PnL aggregation stays consistent.
 *
 * The TRANSFER variant below uses a time-window+abs(amount) match
 * because Binance doesn't echo a tradeId for transfers. PnL /
 * commission carry the same tradeId on both sides, so the match is
 * exact and cheaper.
 */
const takeOverSyntheticPnlOrCommissionRow = async (
  walletId: string,
  record: IncomeHistoryRecord,
): Promise<{ tookOver: boolean }> => {
  if (record.incomeType !== 'REALIZED_PNL' && record.incomeType !== 'COMMISSION') {
    return { tookOver: false };
  }
  if (!record.tradeId) return { tookOver: false };

  const [sibling] = await db
    .select({ id: incomeEvents.id })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, walletId),
        eq(incomeEvents.incomeType, record.incomeType),
        eq(incomeEvents.tradeId, record.tradeId),
        lt(incomeEvents.binanceTranId, 0),
      ),
    )
    .limit(1);

  if (!sibling) return { tookOver: false };

  await db.delete(incomeEvents).where(eq(incomeEvents.id, sibling.id));
  logger.info(
    { walletId, syntheticId: sibling.id, realTranId: record.tranId, tradeId: record.tradeId, incomeType: record.incomeType },
    '[IncomeSync] Took over synthetic WS-derived row with real Binance tran_id',
  );
  return { tookOver: true };
};

const takeOverSyntheticTransferRow = async (
  walletId: string,
  record: IncomeHistoryRecord,
): Promise<{ tookOver: boolean }> => {
  if (record.incomeType !== 'TRANSFER') return { tookOver: false };

  const amount = parseFloat(record.income);
  const absAmount = Math.abs(amount);
  const windowStart = new Date(record.time - SYNTHETIC_WINDOW_MS);
  const windowEnd = new Date(record.time + SYNTHETIC_WINDOW_MS);

  const [sibling] = await db
    .select({ id: incomeEvents.id })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, walletId),
        eq(incomeEvents.incomeType, 'TRANSFER'),
        lt(incomeEvents.binanceTranId, 0),
        gte(incomeEvents.incomeTime, windowStart),
        lte(incomeEvents.incomeTime, windowEnd),
        sql`ABS(${incomeEvents.amount}::numeric) = ${absAmount}`,
      ),
    )
    .limit(1);

  if (!sibling) return { tookOver: false };

  await db.delete(incomeEvents).where(eq(incomeEvents.id, sibling.id));
  logger.info(
    { walletId, syntheticId: sibling.id, realTranId: record.tranId, amount },
    '[IncomeSync] Took over synthetic TRANSFER row with real Binance tran_id',
  );
  return { tookOver: true };
};

const updateTransferTotals = async (
  wallet: Wallet,
  records: IncomeHistoryRecord[],
  skipTranIds: ReadonlySet<number>,
): Promise<{ deposits: number; withdrawals: number }> => {
  const walletCreatedAt = wallet.createdAt.getTime();
  let deposits = 0;
  let withdrawals = 0;

  for (const record of records) {
    if (record.incomeType !== 'TRANSFER') continue;
    if (record.time < walletCreatedAt) continue;
    if (skipTranIds.has(record.tranId)) continue;

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

    // Pick a startTime that captures everything the user has done on
    // Binance for this wallet:
    //   - Resync (lastSynced exists) → continue from the last event we
    //     ingested. Cap at MAX_BACKFILL_MS so an interrupted sync that
    //     hasn't run for years doesn't try to pull >6 months (Binance's
    //     retention horizon) for nothing.
    //   - First sync (lastSynced is null) → go back to wallet.createdAt
    //     so we catch every income event since the user connected the
    //     wallet to MarketMind. Bounded by MAX_BACKFILL_MS for the same
    //     reason.
    //   - The previous logic capped at 24h on first sync and 30 days on
    //     resync — which silently truncated months of history for any
    //     trader who'd been on Binance before connecting their wallet.
    //     That's the root cause of the lifetime-PNL discrepancy this
    //     fix addresses.
    const horizonStart = now - MAX_BACKFILL_MS;
    const startTime = lastSynced
      ? Math.max(lastSynced + 1, horizonStart)
      : Math.max(wallet.createdAt.getTime(), horizonStart);

    const client = createBinanceFuturesClient(wallet);
    const records: IncomeHistoryRecord[] = [];

    // Paginate in 7-day windows because Binance enforces a max time
    // range per call. Within each window, paginate again on `time` if
    // a single 7-day slice somehow has >1000 events (a heavy scalping
    // session can hit this). The outer loop runs at least once even
    // when startTime >= now (e.g. wallet was created in the same ms
    // we're syncing — happens in tests, and harmless in prod since
    // Binance just returns an empty page).
    let pageCount = 0;
    let windowStart = Math.min(startTime, now);
    let done = false;
    while (!done) {
      const windowEnd = Math.min(windowStart + INCOME_API_WINDOW_MS, now);
      let pageStart = windowStart;

      while (true) {
        if (pageCount >= MAX_PAGES_PER_SYNC) {
          done = true;
          break;
        }
        pageCount++;

        const batch = await getIncomeHistory(client, {
          startTime: pageStart,
          endTime: windowEnd,
          limit: PAGE_LIMIT,
        });
        records.push(...batch);
        if (batch.length < PAGE_LIMIT) break;

        const lastTime = batch[batch.length - 1]?.time ?? pageStart;
        if (lastTime <= pageStart) break;
        pageStart = lastTime + 1;
      }

      if (windowEnd >= now) done = true;
      else windowStart = windowEnd + 1;
    }

    result.fetched = records.length;

    const skipTranIds = new Set<number>();
    for (const record of records) {
      if (record.incomeType === 'TRANSFER') {
        const { tookOver } = await takeOverSyntheticTransferRow(wallet.id, record);
        if (tookOver) skipTranIds.add(record.tranId);
      } else if (record.incomeType === 'REALIZED_PNL' || record.incomeType === 'COMMISSION') {
        // Replace any WS-derived synthetic row (`binanceTranId < 0`) for this
        // trade. The real record then inserts normally below — single row
        // post-takeover, no aggregation skew.
        await takeOverSyntheticPnlOrCommissionRow(wallet.id, record);
      }
    }

    const insertRows = toInsertRows(wallet, records);
    result.inserted = await insertIncomeEventsBatch(insertRows);

    const { deposits, withdrawals } = await updateTransferTotals(wallet, records, skipTranIds);
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
