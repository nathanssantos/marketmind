import type { AssetClass, Interval, KlineUpdatePayload, MarketType } from '@marketmind/types';
import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { trpc } from '../utils/trpc';
import { useKlineSubscription, useSocketEvent } from './socket';

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
      },
    );

  const useLatestKline = (symbol: string, interval: Interval, marketType: MarketType = 'FUTURES') =>
    trpc.kline.latest.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval },
    );

  const useKlineCount = (symbol: string, interval: Interval, marketType: MarketType = 'FUTURES') =>
    trpc.kline.count.useQuery(
      { symbol, interval, marketType },
      { enabled: !!symbol && !!interval },
    );

  const useSearchSymbols = (query: string, marketType: MarketType = 'FUTURES', assetClass: AssetClass = 'CRYPTO') =>
    trpc.kline.searchSymbols.useQuery(
      { query, marketType, assetClass },
      { enabled: query.length >= 2 },
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
  onKlineUpdate: (kline: KlineUpdatePayload) => void,
  enabled = true,
  marketType: MarketType = 'FUTURES',
) => {
  const { subscribeStream, unsubscribeStream } = useBackendKlines();
  const isConnected = useConnectionStore((s) => s.wsConnected);
  const subscribedRef = useRef(false);
  const onKlineUpdateRef = useRef(onKlineUpdate);

  useEffect(() => {
    onKlineUpdateRef.current = onKlineUpdate;
  }, [onKlineUpdate]);

  useEffect(() => {
    if (!enabled || !symbol || !interval) return;
    if (!subscribedRef.current) {
      subscribeStream.mutate({ symbol, interval, marketType });
      subscribedRef.current = true;
    }
    return () => {
      if (subscribedRef.current) {
        unsubscribeStream.mutate({ symbol, interval, marketType });
        subscribedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbol, interval, marketType]);

  useKlineSubscription(enabled ? symbol : undefined, enabled ? interval : undefined);

  useSocketEvent(
    'kline:update',
    (kline) => {
      if (
        kline.symbol === symbol &&
        kline.interval === interval &&
        (kline.marketType === marketType || !kline.marketType)
      ) {
        onKlineUpdateRef.current(kline);
      }
    },
    enabled && !!symbol && !!interval,
  );

  return {
    isConnected,
    isSubscribing: subscribeStream.isPending,
  };
};
