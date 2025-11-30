import { trpc } from '../utils/trpc';
import type { Interval } from '@marketmind/types';

interface ListParams {
  symbol: string;
  interval: Interval;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export const useBackendKlines = () => {
  const utils = trpc.useUtils();

  const subscribe = trpc.kline.subscribe.useMutation({
    onSuccess: () => {
      utils.kline.list.invalidate();
    },
  });

  const unsubscribe = trpc.kline.unsubscribe.useMutation();

  const backfill = trpc.kline.backfill.useMutation({
    onSuccess: () => {
      utils.kline.list.invalidate();
    },
  });

  const useKlineList = (params: ListParams) =>
    trpc.kline.list.useQuery(params, {
      enabled: !!params.symbol && !!params.interval,
    });

  const useLatestKline = (symbol: string, interval: Interval) =>
    trpc.kline.latest.useQuery(
      { symbol, interval },
      { enabled: !!symbol && !!interval }
    );

  const useKlineCount = (symbol: string, interval: Interval) =>
    trpc.kline.count.useQuery(
      { symbol, interval },
      { enabled: !!symbol && !!interval }
    );

  return {
    subscribe,
    unsubscribe,
    backfill,
    useKlineList,
    useLatestKline,
    useKlineCount,
  };
};
