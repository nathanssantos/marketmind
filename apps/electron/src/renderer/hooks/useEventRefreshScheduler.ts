import type { TimeInterval } from '@marketmind/types';
import { INTERVAL_MS } from '@marketmind/types';
import { useEffect, useRef } from 'react';

export interface ActiveWatcher {
  interval: string;
}

export interface UseEventRefreshSchedulerProps {
  activeWatchers: ActiveWatcher[];
  chartInterval: TimeInterval;
  enabled: boolean;
  onRefresh: () => void;
}

const getMinimumIntervalMs = (watchers: ActiveWatcher[]): number | null => {
  if (watchers.length === 0) return null;

  let minMs = Infinity;

  for (const watcher of watchers) {
    const interval = watcher.interval as TimeInterval;
    const ms = INTERVAL_MS[interval];
    if (ms && ms < minMs) minMs = ms;
  }

  return minMs === Infinity ? null : minMs;
};

const getNextCycleBoundary = (intervalMs: number): number => {
  const now = Date.now();
  const cycleStart = Math.floor(now / intervalMs) * intervalMs;
  return cycleStart + intervalMs;
};

const getTimeUntilNextBoundary = (intervalMs: number): number => {
  const nextBoundary = getNextCycleBoundary(intervalMs);
  return Math.max(0, nextBoundary - Date.now());
};

export const useEventRefreshScheduler = ({
  activeWatchers,
  chartInterval,
  enabled,
  onRefresh,
}: UseEventRefreshSchedulerProps): void => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const watcherIntervalMs = getMinimumIntervalMs(activeWatchers);
    const effectiveIntervalMs = watcherIntervalMs ?? INTERVAL_MS[chartInterval] ?? INTERVAL_MS['1h'];
    const timeUntilNextBoundary = getTimeUntilNextBoundary(effectiveIntervalMs);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    timeoutRef.current = setTimeout(() => {
      onRefresh();

      intervalRef.current = setInterval(() => {
        onRefresh();
      }, effectiveIntervalMs);
    }, timeUntilNextBoundary);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeWatchers, chartInterval, enabled, onRefresh]);
};
