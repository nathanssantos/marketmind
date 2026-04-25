import { useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';
import { useSocketEvent } from './socket';

export const useActiveChartSymbols = (): Set<string> => {
  const utils = trpc.useUtils();
  const pollingInterval = usePollingInterval(30_000);

  const { data } = trpc.kline.getActiveSymbols.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: pollingInterval,
  });

  useSocketEvent('symbols:active:updated', () => {
    void utils.kline.getActiveSymbols.invalidate();
  });

  return useMemo(() => new Set(data ?? []), [data]);
};
