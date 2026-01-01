import type { Interval } from '@marketmind/types';
import { useEffect } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

type SetupType =
  | 'setup91'
  | 'setup92'
  | 'setup93'
  | 'setup94'
  | 'pattern123'
  | 'bullTrap'
  | 'bearTrap'
  | 'breakoutRetest';

interface DetectCurrentParams {
  symbol: string;
  interval: Interval;
}

interface GetHistoryParams {
  symbol?: string;
  setupType?: SetupType;
  direction?: 'LONG' | 'SHORT';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface GetStatsParams {
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
}

export const useBackendSetups = () => {
  const utils = trpc.useUtils();

  const useDetectCurrent = (params: DetectCurrentParams) =>
    trpc.setup.detectCurrent.useQuery(params, {
      enabled: !!params.symbol && !!params.interval,
      refetchInterval: QUERY_CONFIG.REFETCH_INTERVAL.SLOW,
    });

  const useDetectRange = (
    symbol: string,
    interval: Interval,
    startTime: Date,
    endTime: Date
  ) =>
    trpc.setup.detectRange.useQuery(
      { symbol, interval, startTime, endTime },
      {
        enabled: !!symbol && !!interval && !!startTime && !!endTime,
        staleTime: QUERY_CONFIG.STALE_TIME.LONG,
      }
    );

  const useHistory = (params: GetHistoryParams) =>
    trpc.setup.getHistory.useQuery(params, {
      enabled: true,
      staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    });

  const useStats = (params: GetStatsParams) =>
    trpc.setup.getStats.useQuery(params, {
      enabled: true,
      staleTime: QUERY_CONFIG.STALE_TIME.SLOW,
    });

  const useConfig = () =>
    trpc.setup.getConfig.useQuery(undefined, {
      staleTime: QUERY_CONFIG.STALE_TIME.PERMANENT,
    });

  const updateConfig = trpc.setup.updateConfig.useMutation({
    onSuccess: () => {
      utils.setup.getConfig.invalidate();
      utils.setup.detectCurrent.invalidate();
      utils.setup.getHistory.invalidate();
      utils.setup.getStats.invalidate();
    },
  });

  const useRealtimeSetups = (userId: string, enabled = true) => {
    const { subscribe, unsubscribe, on, off } = useWebSocket();

    useEffect(() => {
      if (!enabled || !userId) return;

      subscribe.setups(userId);

      const handleSetupDetected = () => {
        utils.setup.detectCurrent.invalidate();
        utils.setup.getHistory.invalidate();
        utils.setup.getStats.invalidate();
      };

      on('setup-detected', handleSetupDetected);

      return () => {
        off('setup-detected', handleSetupDetected);
        unsubscribe.setups(userId);
      };
    }, [userId, enabled, subscribe, unsubscribe, on, off, utils]);
  };

  return {
    useDetectCurrent,
    useDetectRange,
    useHistory,
    useStats,
    useConfig,
    updateConfig,
    useRealtimeSetups,
  };
};
