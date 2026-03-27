import type { BacktestResult, MultiWatcherBacktestResult } from '@marketmind/types';

export type CachedBacktestResult = Partial<BacktestResult> & { id: string; status: BacktestResult['status'] };
export type CachedMultiWatcherResult = Partial<MultiWatcherBacktestResult> & { id: string; status: BacktestResult['status'] };

const MAX_CACHE_SIZE = 100;
export const backtestResults = new Map<string, { createdAt: number; data: CachedBacktestResult }>();
export const multiWatcherResults = new Map<string, { createdAt: number; data: CachedMultiWatcherResult }>();

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
