import type { TradingSetup } from '@marketmind/types';
import { useCallback } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useBackendAutoTrading } from './useBackendAutoTrading';

interface UseAutoTradingOptions {
  walletId: string;
  isSimulatorMode: boolean;
}

export const useAutoTrading = ({ walletId, isSimulatorMode }: UseAutoTradingOptions) => {
  const addOrder = useTradingStore((state) => state.addOrder);

  const {
    config: backendConfig,
    executeSetup: executeBackendSetup,
    isExecutingSetup,
    executeSetupError,
  } = useBackendAutoTrading(walletId);

  const executeSetup = useCallback(
    async (
      setup: TradingSetup | null,
      symbol: string,
      quantity: number,
      fees: {
        entryFee: number;
        exitFee: number;
        totalFees: number;
      },
      currentPrice?: number
    ) => {
      if (!setup) {
        return { success: false, error: 'Invalid setup' };
      }

      if (isSimulatorMode) {
        const isLong = setup.direction === 'LONG';

        addOrder({
          symbol,
          side: isLong ? 'BUY' : 'SELL',
          status: 'NEW' as const,
          entryPrice: setup.entryPrice,
          quantity,
          walletId,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          setupId: setup.id,
          setupType: setup.type,
          setupDirection: setup.direction,
          setupConfidence: setup.confidence,
          entryFee: fees.entryFee.toString(),
          exitFee: fees.exitFee.toString(),
          totalFees: fees.totalFees.toString(),
          ...(currentPrice !== undefined && { currentPrice }),
        });

        return { success: true };
      } else {
        try {
          const result = await executeBackendSetup(setup.id, walletId);
          return { success: true, executionId: result.executionId };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute setup',
          };
        }
      }
    },
    [isSimulatorMode, addOrder, walletId, executeBackendSetup]
  );

  const isAutoTradingEnabled = isSimulatorMode
    ? true
    : backendConfig?.isEnabled ?? false;

  return {
    executeSetup,
    isAutoTradingEnabled,
    isExecutingSetup,
    executeSetupError,
    config: backendConfig,
  };
};
