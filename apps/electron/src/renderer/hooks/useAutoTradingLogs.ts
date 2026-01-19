import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket, type FrontendLogEntry } from './useWebSocket';

const MAX_LOGS = 500;

export const useAutoTradingLogs = (walletId: string, enabled = true) => {
  const logsRef = useRef<FrontendLogEntry[]>([]);
  const [logs, setLogs] = useState<FrontendLogEntry[]>([]);
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({
    autoConnect: enabled && !!walletId,
  });

  const { data: initialLogs, isLoading } = trpc.autoTrading.getRecentLogs.useQuery(
    { walletId, limit: 100 },
    { enabled: !!walletId && enabled }
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

  useEffect(() => {
    if (!enabled || !isConnected || !walletId) return;

    subscribe.autoTradingLogs(walletId);
    on('autoTrading:log', handleNewLog);

    return () => {
      off('autoTrading:log', handleNewLog);
      unsubscribe.autoTradingLogs(walletId);
    };
  }, [enabled, isConnected, walletId, subscribe, unsubscribe, on, off, handleNewLog]);

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return {
    logs,
    isLoading,
    isConnected,
    clearLogs,
  };
};
