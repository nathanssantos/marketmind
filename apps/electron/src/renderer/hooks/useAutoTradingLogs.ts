import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutoTradingLogEntryPayload } from '@marketmind/types';
import { useConnectionStore } from '../store/connectionStore';
import { trpc } from '../utils/trpc';
import { useSocketEvent, useWalletStreamSubscription } from './socket';

export type FrontendLogEntry = AutoTradingLogEntryPayload;

const MAX_LOGS = 500;

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

  const handleNewLog = useCallback((entry: FrontendLogEntry) => {
    logsRef.current = [...logsRef.current, entry].slice(-MAX_LOGS);
    setLogs(logsRef.current);
  }, []);

  useWalletStreamSubscription('autoTradingLogs', enabled && walletId ? walletId : undefined);
  useSocketEvent('autoTrading:log', handleNewLog, enabled && !!walletId);

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return { logs, isLoading, isConnected, clearLogs };
};
