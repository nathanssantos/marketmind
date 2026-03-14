import { useEffect, useMemo } from 'react';
import { socketService } from '../services/socketService';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';

export const useActiveChartSymbols = (): Set<string> => {
  const utils = trpc.useUtils();
  const pollingInterval = usePollingInterval(30_000);

  const { data } = trpc.kline.getActiveSymbols.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: pollingInterval,
  });

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handler = () => {
      utils.kline.getActiveSymbols.invalidate();
    };

    socket.on('symbols:active:updated', handler);
    return () => { socket.off('symbols:active:updated', handler); };
  }, [utils]);

  return useMemo(() => new Set(data ?? []), [data]);
};
