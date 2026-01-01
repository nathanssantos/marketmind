import { QUERY_CONFIG } from '@shared/constants';
import { useRealtimeTradingSyncContext } from '../context/RealtimeTradingSyncContext';

export const useRealtimeTradingSync = (_walletId: string | undefined) => {
  const { subscribeToPrice, forceRefresh, isConnected } = useRealtimeTradingSyncContext();

  return {
    isConnected,
    subscribeToPrice,
    forceRefresh,
    backupPollingInterval: QUERY_CONFIG.BACKUP_POLLING_INTERVAL,
  };
};
