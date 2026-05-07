import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutoTradingLogEntryPayload } from '@marketmind/types';
import { useConnectionStore } from '../store/connectionStore';
import { trpc } from '../utils/trpc';
import { useLiveStream } from './useLiveStream';
import { useWalletStreamSubscription } from './socket';

export type FrontendLogEntry = AutoTradingLogEntryPayload;

const MAX_LOGS = 500;

// Two-track architecture under a single live-stream subscription:
//
//   1. `logsRef` — ref-only buffer. Receives EVERY log entry via
//      `onRawTick` BEFORE the throttle pipeline. Trimmed to MAX_LOGS.
//      No React re-render cost. The ref is what `clearLogs` mutates,
//      and what consumers read after a state flush.
//
//   2. `logs` state — published to React on the policy's throttle
//      window (250ms idle, 1000ms during pan). Each flush copies the
//      ref's current snapshot to state, batching all entries that
//      landed inside the window.
//
// During an active auto-trading session, watchers can fire 10+ log
// entries per second when all symbols evaluate simultaneously. Without
// throttling, the activity log re-rendered ~10×/sec — visible jank in
// multi-panel layouts. The 250ms cadence is visually realtime to the
// user but ~5× cheaper.
export const useAutoTradingLogs = (walletId: string, enabled = true) => {
  const logsRef = useRef<FrontendLogEntry[]>([]);
  const [logs, setLogs] = useState<FrontendLogEntry[]>([]);
  const isConnected = useConnectionStore((s) => s.wsConnected);

  const { data: initialLogs, isLoading } = trpc.autoTrading.getRecentLogs.useQuery(
    { walletId, limit: 100 },
    { enabled: !!walletId && enabled },
  );

  useEffect(() => {
    if (initialLogs) {
      logsRef.current = initialLogs;
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  useWalletStreamSubscription('autoTradingLogs', enabled && walletId ? walletId : undefined);

  const recordEntry = useCallback((entry: FrontendLogEntry) => {
    logsRef.current = [...logsRef.current, entry].slice(-MAX_LOGS);
  }, []);

  // useLiveStream returns the latest published payload, but for a list
  // builder we only care about the side-effect of triggering a state
  // flush at the throttle window. The state updates here are driven by
  // the throttled flush — when it fires, we copy the ref snapshot.
  const latestThrottled = useLiveStream('autoTrading:log', {
    enabled: enabled && !!walletId,
    onRawTick: recordEntry,
  });

  useEffect(() => {
    if (latestThrottled === null) return;
    setLogs(logsRef.current);
  }, [latestThrottled]);

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return { logs, isLoading, isConnected, clearLogs };
};
