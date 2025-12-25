
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
