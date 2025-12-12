/**
 * @deprecated This hook is no longer used. Auto-trading is now handled entirely by the backend.
 * The backend uses AutoTradingScheduler to detect setups and create trade executions.
 * Frontend should use useBackendAutoTrading for controlling the watcher (start/stop).
 */

import { useBackendAutoTrading } from './useBackendAutoTrading';

interface UseAutoTradingOptions {
  walletId: string;
}

export const useAutoTrading = ({ walletId }: UseAutoTradingOptions) => {
  const {
    config: backendConfig,
    isExecutingSetup,
    executeSetupError,
  } = useBackendAutoTrading(walletId);

  const isAutoTradingEnabled = backendConfig?.isEnabled ?? false;

  return {
    isAutoTradingEnabled,
    isExecutingSetup,
    executeSetupError,
    config: backendConfig,
  };
};
