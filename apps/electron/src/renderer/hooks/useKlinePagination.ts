import type { Interval, Kline, MarketType } from '@marketmind/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHART_INITIAL_LOAD, CHART_PAGE_SIZE } from '../constants/defaults';
import { trpc } from '../utils/trpc';

interface UseKlinePaginationProps {
  symbol: string;
  interval: Interval;
  marketType: MarketType;
  enabled: boolean;
}

interface UseKlinePaginationReturn {
  allKlines: Kline[];
  isLoadingMore: boolean;
  hasMore: boolean;
  loadOlderKlines: () => Promise<void>;
  isInitialLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const parseTimestamp = (time: unknown): number => {
  if (typeof time === 'string') return new Date(time).getTime();
  if (time instanceof Date) return time.getTime();
  return Number(time);
};

const mapToKline = (k: {
  openTime: unknown;
  closeTime: unknown;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string | null;
  trades: number | null;
  takerBuyBaseVolume: string | null;
  takerBuyQuoteVolume: string | null;
}): Kline => ({
  openTime: parseTimestamp(k.openTime),
  closeTime: parseTimestamp(k.closeTime),
  open: k.open,
  high: k.high,
  low: k.low,
  close: k.close,
  volume: k.volume,
  quoteVolume: k.quoteVolume || '0',
  trades: k.trades || 0,
  takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
  takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
});

export const useKlinePagination = ({
  symbol,
  interval,
  marketType,
  enabled,
}: UseKlinePaginationProps): UseKlinePaginationReturn => {
  const [olderKlines, setOlderKlines] = useState<Kline[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const utils = trpc.useUtils();

  const initialQuery = trpc.kline.list.useQuery(
    { symbol, interval, marketType, limit: CHART_INITIAL_LOAD },
    { enabled: enabled && !!symbol && !!interval },
  );

  useEffect(() => {
    setOlderKlines([]);
    setHasMore(true);
    setIsLoadingMore(false);
    loadingRef.current = false;
  }, [symbol, interval, marketType]);

  const baseKlines = initialQuery.data
    ? initialQuery.data.map(mapToKline)
    : [];

  const allKlines = olderKlines.length > 0
    ? [...olderKlines, ...baseKlines]
    : baseKlines;

  const loadOlderKlines = useCallback(async () => {
    if (loadingRef.current || !hasMore || allKlines.length === 0) return;

    loadingRef.current = true;
    setIsLoadingMore(true);

    try {
      const oldestKline = allKlines[0];
      if (!oldestKline) return;

      const endTime = new Date(oldestKline.openTime - 1);

      const result = await utils.kline.list.fetch({
        symbol,
        interval,
        marketType,
        endTime,
        limit: CHART_PAGE_SIZE,
      });

      if (!result || result.length === 0) {
        setHasMore(false);
        return;
      }

      const mapped = result.map(mapToKline);

      setOlderKlines(prev => [...mapped, ...prev]);

      if (result.length < CHART_PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [allKlines, hasMore, symbol, interval, marketType, utils.kline.list]);

  return {
    allKlines,
    isLoadingMore,
    hasMore,
    loadOlderKlines,
    isInitialLoading: initialQuery.isLoading,
    error: initialQuery.error ? new Error(initialQuery.error.message) : null,
    refetch: initialQuery.refetch,
  };
};
