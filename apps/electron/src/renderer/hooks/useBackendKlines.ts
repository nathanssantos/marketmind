import type { Interval } from '@marketmind/types';
import { useEffect, useRef } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

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
  enabled = true
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
      console.log('[useBackendKlines] Received kline update:', {
        symbol: kline.symbol,
        interval: kline.interval,
        close: kline.close,
        expectedSymbol: symbol,
        expectedInterval: interval,
      });
      
      if (kline.symbol === symbol && kline.interval === interval) {
        onKlineUpdateRef.current(kline);
      }
    };

    if (!subscribedRef.current) {
      subscribeStream.mutate({ symbol, interval });
      subscribedRef.current = true;
    }

    subscribe.klines({ symbol, interval });

    on('kline:update', handleKlineUpdate);

    return () => {
      off('kline:update', handleKlineUpdate);

      unsubscribe.klines({ symbol, interval });

      if (subscribedRef.current) {
        unsubscribeStream.mutate({ symbol, interval });
        subscribedRef.current = false;
      }
    };
  }, [enabled, isConnected, symbol, interval]);

  return {
    isConnected,
    isSubscribing: subscribeStream.isPending,
  };
};
