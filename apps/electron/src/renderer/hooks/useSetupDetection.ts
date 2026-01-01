import type { Interval, Kline, TradingSetup } from '@marketmind/types';
import { useQuery } from '@tanstack/react-query';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../services/trpc';
import { useBackendSetups } from './useBackendSetups';

interface UseStrategyListOptions {
  includeStatuses?: ('active' | 'experimental' | 'deprecated' | 'unprofitable')[];
  excludeStatuses?: ('active' | 'experimental' | 'deprecated' | 'unprofitable')[];
  includeUnprofitable?: boolean;
}

export const useStrategyList = (options: UseStrategyListOptions = {}) => {
  return useQuery({
    queryKey: ['strategies', options],
    queryFn: async () => {
      const strategies = await trpc.setupDetection.listStrategies.query(options);
      return strategies;
    },
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });
};

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
