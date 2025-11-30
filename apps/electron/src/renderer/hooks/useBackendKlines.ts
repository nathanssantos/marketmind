import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';
import type { Interval } from '@marketmind/types';

interface SubscribeParams {
  symbol: string;
  interval: Interval;
}

interface ListParams {
  symbol: string;
  interval: Interval;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

interface BackfillParams {
  symbol: string;
  interval: Interval;
  periodsBack?: number;
}

export const useBackendKlines = () => {
  const queryClient = useQueryClient();

  const subscribe = useMutation({
    mutationFn: (params: SubscribeParams) =>
      trpc.kline.subscribe.mutate(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['klines', variables.symbol, variables.interval] 
      });
    },
  });

  const unsubscribe = useMutation({
    mutationFn: (params: SubscribeParams) =>
      trpc.kline.unsubscribe.mutate(params),
  });

  const backfill = useMutation({
    mutationFn: (params: BackfillParams) =>
      trpc.kline.backfill.mutate(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['klines', variables.symbol, variables.interval] 
      });
    },
  });

  const useKlineList = (params: ListParams) =>
    useQuery({
      queryKey: ['klines', params.symbol, params.interval, params.startTime, params.endTime],
      queryFn: () => trpc.kline.list.query(params),
      enabled: !!params.symbol && !!params.interval,
    });

  const useLatestKline = (symbol: string, interval: Interval) =>
    useQuery({
      queryKey: ['klines', 'latest', symbol, interval],
      queryFn: () => trpc.kline.latest.query({ symbol, interval }),
      enabled: !!symbol && !!interval,
    });

  const useKlineCount = (symbol: string, interval: Interval) =>
    useQuery({
      queryKey: ['klines', 'count', symbol, interval],
      queryFn: () => trpc.kline.count.query({ symbol, interval }),
      enabled: !!symbol && !!interval,
    });

  return {
    subscribe,
    unsubscribe,
    backfill,
    useKlineList,
    useLatestKline,
    useKlineCount,
  };
};
