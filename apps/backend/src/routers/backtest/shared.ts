import { and, desc, eq, lt } from 'drizzle-orm';
import type { BacktestResult, MultiWatcherBacktestResult } from '@marketmind/types';
import { db } from '../../db/client';
import { backtestRuns, type BacktestRunRow } from '../../db/schema';
import { logger } from '../../services/logger';

export type CachedBacktestResult = Partial<BacktestResult> & { id: string; status: BacktestResult['status'] };
export type CachedMultiWatcherResult = Partial<MultiWatcherBacktestResult> & { id: string; status: BacktestResult['status'] };

const MAX_CACHE_SIZE = 100;
const HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const backtestResults = new Map<string, { createdAt: number; data: CachedBacktestResult }>();
export const multiWatcherResults = new Map<string, { createdAt: number; data: CachedMultiWatcherResult }>();

/**
 * Tracks the in-flight engine.run + persistTerminalRun promise for each
 * RUNNING backtest. Lets `delete` (and tests) await the natural settle of
 * the void-IIFE so we don't race the cache write or DB persistence.
 * Entries are removed in the IIFE's `finally` block.
 */
export const inFlightRuns = new Map<string, Promise<void>>();

const evictOldestIfNeeded = () => {
  if (backtestResults.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of backtestResults.entries()) {
      if (value.createdAt < oldestTime) {
        oldestTime = value.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) backtestResults.delete(oldestKey);
  }
};

export const setCacheEntry = (id: string, data: CachedBacktestResult) => {
  evictOldestIfNeeded();
  backtestResults.set(id, { createdAt: Date.now(), data });
};

export const getCacheEntry = (id: string): CachedBacktestResult | undefined => {
  const entry = backtestResults.get(id);
  return entry?.data;
};

const safeStringify = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (err) {
    logger.warn({ err: String(err) }, 'Failed to stringify backtest payload for persistence');
    return null;
  }
};

const safeParse = <T,>(value: string | null | undefined): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    logger.warn({ err: String(err) }, 'Failed to parse backtest payload from DB');
    return undefined;
  }
};

const rowToCached = (row: BacktestRunRow): CachedBacktestResult => ({
  id: row.id,
  status: row.status as CachedBacktestResult['status'],
  config: safeParse(row.config),
  metrics: safeParse(row.metrics),
  equityCurve: safeParse(row.equityCurve),
  trades: safeParse(row.tradesJson),
  startTime: row.startTime.toISOString(),
  endTime: row.endTime.toISOString(),
  duration: row.durationMs,
  ...(row.error ? { error: row.error } : {}),
});

/**
 * Mirror a terminal backtest result (COMPLETED or FAILED) into the
 * `backtest_runs` table so RecentRunsPanel survives a server restart.
 * Best-effort — errors are logged but never propagated; the cache is
 * still authoritative for the originating request.
 */
export const persistTerminalRun = async (
  userId: string,
  data: CachedBacktestResult,
): Promise<void> => {
  if (data.status !== 'COMPLETED' && data.status !== 'FAILED') return;
  if (!data.startTime || !data.endTime || data.duration === undefined) return;

  try {
    await db.insert(backtestRuns).values({
      id: data.id,
      userId,
      status: data.status,
      config: safeStringify(data.config) ?? '{}',
      metrics: safeStringify(data.metrics),
      equityCurve: safeStringify(data.equityCurve),
      tradesJson: safeStringify(data.trades),
      error: data.error ?? null,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      durationMs: data.duration,
    });

    const cutoff = new Date(Date.now() - HISTORY_RETENTION_MS);
    await db
      .delete(backtestRuns)
      .where(and(eq(backtestRuns.userId, userId), lt(backtestRuns.createdAt, cutoff)));
  } catch (err) {
    logger.warn({ err: String(err), backtestId: data.id }, 'Failed to persist backtest run');
  }
};

/**
 * Cache-first lookup. Falls through to the DB row scoped to the
 * calling user — caller-side authorization is the user_id check in
 * the WHERE clause.
 */
export const findRunForUser = async (
  id: string,
  userId: string,
): Promise<CachedBacktestResult | undefined> => {
  const cached = getCacheEntry(id);
  if (cached) return cached;

  const row = await db.query.backtestRuns.findFirst({
    where: and(eq(backtestRuns.id, id), eq(backtestRuns.userId, userId)),
  });
  return row ? rowToCached(row) : undefined;
};

/**
 * Lists terminal runs for the user from the DB plus any in-flight
 * cache entries that haven't yet been mirrored. Cache wins on
 * collision (which only happens for the just-completed-but-not-yet-
 * persisted window).
 */
export const listRunsForUser = async (userId: string): Promise<CachedBacktestResult[]> => {
  const dbRows = await db
    .select()
    .from(backtestRuns)
    .where(eq(backtestRuns.userId, userId))
    .orderBy(desc(backtestRuns.createdAt));

  const dbCached = dbRows.map(rowToCached);
  const dbIds = new Set(dbCached.map((r) => r.id));

  const cacheExtras: CachedBacktestResult[] = [];
  for (const entry of backtestResults.values()) {
    if (dbIds.has(entry.data.id)) continue;
    cacheExtras.push(entry.data);
  }

  return [...cacheExtras, ...dbCached];
};
