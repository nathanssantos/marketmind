import { useEffect, useMemo } from 'react';
import type { MarketType } from '@marketmind/types';
import { usePriceStore } from '../store/priceStore';
import { trpc } from '../utils/trpc';
import { usePriceSubscription, useSocketEvent } from './socket';

export interface TabTickerTarget {
  symbol: string;
  marketType: MarketType;
}

const MS_PER_DAY = 86_400_000;

const msUntilNextUtcMidnight = (now: number = Date.now()): number => {
  const nextOpen = Math.floor(now / MS_PER_DAY) * MS_PER_DAY + MS_PER_DAY;
  return nextOpen - now;
};

const groupByMarketType = (targets: TabTickerTarget[]): Record<MarketType, string[]> => {
  const groups: Record<MarketType, string[]> = { SPOT: [], FUTURES: [] };
  const seen: Record<MarketType, Set<string>> = { SPOT: new Set(), FUTURES: new Set() };
  for (const { symbol, marketType } of targets) {
    if (seen[marketType].has(symbol)) continue;
    seen[marketType].add(symbol);
    groups[marketType].push(symbol);
  }
  return groups;
};

export const useTabTickers = (targets: TabTickerTarget[]): void => {
  const groups = useMemo(() => groupByMarketType(targets), [targets]);

  const spotKey = useMemo(() => [...groups.SPOT].sort().join(','), [groups.SPOT]);
  const futuresKey = useMemo(() => [...groups.FUTURES].sort().join(','), [groups.FUTURES]);

  const utils = trpc.useUtils();

  const { data: spotData } = trpc.ticker.getDailyBatch.useQuery(
    { symbols: groups.SPOT, marketType: 'SPOT' },
    {
      enabled: groups.SPOT.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  const { data: futuresData } = trpc.ticker.getDailyBatch.useQuery(
    { symbols: groups.FUTURES, marketType: 'FUTURES' },
    {
      enabled: groups.FUTURES.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!spotData || spotData.length === 0) return;
    usePriceStore.getState().setDailyOpenBatch(
      'SPOT',
      spotData.map((t) => ({ symbol: t.symbol, open: t.dailyOpen, lastPrice: t.lastPrice, openTime: t.openTime })),
    );
  }, [spotData]);

  useEffect(() => {
    if (!futuresData || futuresData.length === 0) return;
    usePriceStore.getState().setDailyOpenBatch(
      'FUTURES',
      futuresData.map((t) => ({ symbol: t.symbol, open: t.dailyOpen, lastPrice: t.lastPrice, openTime: t.openTime })),
    );
  }, [futuresData]);

  useEffect(() => {
    if (!spotKey && !futuresKey) return;

    const scheduleRollover = (): ReturnType<typeof setTimeout> => {
      return setTimeout(() => {
        void utils.ticker.getDailyBatch.invalidate();
        timer = scheduleRollover();
      }, msUntilNextUtcMidnight() + 1_000);
    };

    let timer = scheduleRollover();
    return () => clearTimeout(timer);
  }, [spotKey, futuresKey, utils]);

  const allSymbols = useMemo(() => [...new Set([...groups.SPOT, ...groups.FUTURES])], [groups]);

  usePriceSubscription(allSymbols);

  useSocketEvent('price:update', (data) => {
    usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
  });
};
