import type { Interval } from '@marketmind/types';
import type { Kline, TradingSetup } from '@shared/types';
import { useBackendSetups } from './useBackendSetups';

export interface UseSetupDetectionOptions {
  symbol?: string;
  interval?: Interval;
  userId?: string;
  enableRealtimeUpdates?: boolean;
}

export interface UseSetupDetectionResult {
  detectSetups: (klines: Kline[]) => TradingSetup[];
  isDetecting: boolean;
}

export const useSetupDetection = (options: UseSetupDetectionOptions = {}): UseSetupDetectionResult => {
  const { symbol, interval, userId, enableRealtimeUpdates = true } = options;

  const {
    useDetectCurrent,
    useRealtimeSetups,
  } = useBackendSetups();

  if (userId && enableRealtimeUpdates) {
    useRealtimeSetups(userId, true);
  }

  const { data: result, isPending } = useDetectCurrent({
    symbol: symbol || '',
    interval: interval || '1h',
  });

  const detectSetups = (klines: Kline[]): TradingSetup[] => {
    if (!symbol || !interval || klines.length === 0 || !result) return [];

    return result.setups.map((setup) => ({
      id: setup.id,
      type: setup.type,
      direction: setup.direction,
      openTime: setup.openTime,
      entryPrice: setup.entryPrice,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      confidence: setup.confidence,
      riskRewardRatio: setup.riskRewardRatio,
      volumeConfirmation: setup.volumeConfirmation,
      indicatorConfluence: setup.indicatorConfluence,
      klineIndex: klines.length - 1,
      setupData: setup.setupData || {},
      visible: true,
      source: 'algorithm' as const,
      isCancelled: setup.isCancelled,
      cancelledAt: setup.cancelledAt,
      cancellationReason: setup.cancellationReason,
      isTriggered: setup.isTriggered,
      triggeredAt: setup.triggeredAt,
    }));
  };

  return {
    detectSetups,
    isDetecting: isPending,
  };
};
