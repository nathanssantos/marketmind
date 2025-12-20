import type { Interval, MarketType } from '@marketmind/types';
import { useEffect, useRef } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

interface ListParams {
  symbol: string;
  interval: Interval;
  marketType?: MarketType;
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
    trpc.kline.list.useQuery(
      {
        ...params,
        marketType: params.marketType ?? 'SPOT',
      },
      {
        enabled: !!params.symbol && !!params.interval,
      }
    );

  const useLatestKline = (symbol: string, interval: Interval, marketType: MarketType = 'SPOT') =>
    trpc.kline.latest.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval }
    );

  const useKlineCount = (symbol: string, interval: Interval, marketType: MarketType = 'SPOT') =>
    trpc.kline.count.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval }
    );

  const subscribeStream = trpc.kline.subscribeStream.useMutation();
  const unsubscribeStream = trpc.kline.unsubscribeStream.useMutation();

  return {
    subscribe,
    unsubscribe,
    subscribeStream,
    unsubscribeStream,
    backfill,
    useKlineList,
    useLatestKline,
    useKlineCount,
  };
};

export const useKlineStream = (
  symbol: string,
  interval: Interval,
  onKlineUpdate: (kline: {
    symbol: string;
    interval: string;
    marketType?: MarketType;
    openTime: number;
    closeTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    isClosed: boolean;
    timestamp: number;
  }) => void,
  enabled = true,
  marketType: MarketType = 'SPOT'
) => {
  const { subscribeStream, unsubscribeStream } = useBackendKlines();
  const { isConnected, on, off, subscribe, unsubscribe } = useWebSocket({ autoConnect: enabled });
  const subscribedRef = useRef(false);
  const onKlineUpdateRef = useRef(onKlineUpdate);

  useEffect(() => {
    onKlineUpdateRef.current = onKlineUpdate;
  }, [onKlineUpdate]);

  useEffect(() => {
    if (!enabled || !isConnected || !symbol || !interval) return;

    const handleKlineUpdate = (kline: any) => {
      if (
        kline.symbol === symbol &&
        kline.interval === interval &&
        (kline.marketType === marketType || !kline.marketType)
      ) {
        onKlineUpdateRef.current(kline);
      }
    };

    if (!subscribedRef.current) {
      subscribeStream.mutate({ symbol, interval, marketType });
      subscribedRef.current = true;
    }

    subscribe.klines({ symbol, interval });

    on('kline:update', handleKlineUpdate);

    return () => {
      off('kline:update', handleKlineUpdate);

      unsubscribe.klines({ symbol, interval });

      if (subscribedRef.current) {
        unsubscribeStream.mutate({ symbol, interval, marketType });
        subscribedRef.current = false;
      }
    };
  }, [enabled, isConnected, symbol, interval, marketType]);

  return {
    isConnected,
    isSubscribing: subscribeStream.isPending,
  };
};
