import type { AssetClass, Interval, MarketType } from '@marketmind/types';
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
      void utils.kline.list.invalidate();
    },
  });

  const unsubscribe = trpc.kline.unsubscribe.useMutation();

  const backfill = trpc.kline.backfill.useMutation({
    onSuccess: () => {
      void utils.kline.list.invalidate();
    },
  });

  const useKlineList = (params: ListParams) =>
    trpc.kline.list.useQuery(
      {
        ...params,
        marketType: params.marketType ?? 'FUTURES',
      },
      {
        enabled: !!params.symbol && !!params.interval,
      }
    );

  const useLatestKline = (symbol: string, interval: Interval, marketType: MarketType = 'FUTURES') =>
    trpc.kline.latest.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval }
    );

  const useKlineCount = (symbol: string, interval: Interval, marketType: MarketType = 'FUTURES') =>
    trpc.kline.count.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval }
    );

  const useSearchSymbols = (query: string, marketType: MarketType = 'FUTURES', assetClass: AssetClass = 'CRYPTO') =>
    trpc.kline.searchSymbols.useQuery(
      { query, marketType, assetClass },
      { enabled: query.length >= 2 }
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
    useSearchSymbols,
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
  marketType: MarketType = 'FUTURES'
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

    const handleKlineUpdate = (kline: Parameters<typeof onKlineUpdate>[0]) => {
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
