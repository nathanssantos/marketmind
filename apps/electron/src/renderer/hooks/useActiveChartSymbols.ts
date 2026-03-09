import { useEffect, useMemo } from 'react';
import { socketService } from '../services/socketService';
import { trpc } from '../utils/trpc';

export const useActiveChartSymbols = (): Set<string> => {
  const utils = trpc.useUtils();

  const { data } = trpc.kline.getActiveSymbols.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: 30_000,
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
