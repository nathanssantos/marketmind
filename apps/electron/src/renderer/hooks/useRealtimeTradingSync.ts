import { useRealtimeTradingSyncContext } from '../context/RealtimeTradingSyncContext';

const BACKUP_POLLING_INTERVAL = 30000;

export const useRealtimeTradingSync = (_walletId: string | undefined) => {
  const { subscribeToPrice, forceRefresh, isConnected } = useRealtimeTradingSyncContext();

  return {
    isConnected,
    subscribeToPrice,
    forceRefresh,
    backupPollingInterval: BACKUP_POLLING_INTERVAL,
  };
};
