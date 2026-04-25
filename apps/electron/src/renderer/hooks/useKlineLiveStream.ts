import type { Kline, MarketType, TimeInterval } from '@marketmind/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { INTERVAL_MS_MAP, MIN_UPDATE_INTERVAL_MS } from '../constants/defaults';
import { useKlineStream } from './useBackendKlines';
import type { VisibilityState } from './useVisibilityChange';
import { useVisibilityChange } from './useVisibilityChange';

interface KlineStreamUpdate {
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
  quoteVolume?: string;
  trades?: number;
  takerBuyBaseVolume?: string;
  takerBuyQuoteVolume?: string;
  isClosed: boolean;
  timestamp: number;
}

interface UseKlineLiveStreamOptions {
  symbol: string;
  timeframe: string;
  marketType: MarketType;
  baseKlines: Kline[] | undefined;
  enabled: boolean;
  refetchKlines: () => Promise<unknown>;
}

export interface KlineSource {
  /** Always points to the freshest displayKlines array. Read inside imperative subscribers. */
  klinesRef: React.MutableRefObject<Kline[]>;
  /**
   * Subscribe to live-tick events. Called once per RAF flush after the live kline
   * mutates. Use this to update canvas state imperatively without re-rendering React.
   * Returns an unsubscribe function. The source's identity is stable across renders
   * — pass it as a prop without breaking React.memo.
   */
  subscribe: (cb: () => void) => () => void;
}

interface UseKlineLiveStreamReturn {
  displayKlines: Kline[];
  klineSource: KlineSource;
}

const MIN_REFETCH_INTERVAL_MS = 30_000;
const VISIBILITY_REFRESH_THRESHOLD_MS = 5_000;

export const useKlineLiveStream = ({
  symbol,
  timeframe,
  marketType,
  baseKlines,
  enabled,
  refetchKlines,
}: UseKlineLiveStreamOptions): UseKlineLiveStreamReturn => {
  const [liveKlines, setLiveKlines] = useState<Kline[]>([]);
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const getIntervalMs = useCallback((tf: string): number =>
    INTERVAL_MS_MAP[tf as TimeInterval] || 60_000, []);

  useEffect(() => {
    setLiveKlines([]);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingUpdateRef.current = null;
    lastRefetchRef.current = 0;
    lastUpdateRef.current = 0;
  }, [symbol, timeframe, marketType]);

  const processUpdate = useCallback(() => {
    const update = pendingUpdateRef.current;
    if (!update) return;

    const { kline: latestKline } = update;
    lastUpdateRef.current = Date.now();

    setLiveKlines(prev => {
      if (prev.length === 0) return [latestKline];

      const lastKline = prev[prev.length - 1];
      if (!lastKline) return [latestKline];

      if (latestKline.openTime === lastKline.openTime) {
        if (getKlineClose(latestKline) === getKlineClose(lastKline) &&
          getKlineHigh(latestKline) === getKlineHigh(lastKline) &&
          getKlineLow(latestKline) === getKlineLow(lastKline) &&
          getKlineVolume(latestKline) === getKlineVolume(lastKline)) return prev;
        return [...prev.slice(0, -1), latestKline];
      }

      if (latestKline.openTime > lastKline.openTime) return [...prev, latestKline];

      return prev;
    });

    rafIdRef.current = null;
    pendingUpdateRef.current = null;
  }, []);

  const handleRealtimeUpdate = useCallback((kline: Kline, isFinal: boolean) => {
    if (isFinal) {
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingUpdateRef.current = { kline, isFinal };
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(processUpdate);
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS) {
      pendingUpdateRef.current = { kline, isFinal };

      flushTimerRef.current ??= setTimeout(() => {
        flushTimerRef.current = null;
        if (pendingUpdateRef.current) {
          if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = requestAnimationFrame(processUpdate);
        }
      }, MIN_UPDATE_INTERVAL_MS);
      return;
    }

    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    pendingUpdateRef.current = { kline, isFinal };

    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(processUpdate);
  }, [processUpdate]);

  const handleKlineStreamUpdate = useCallback((backendKline: KlineStreamUpdate) => {
    const kline: Kline = {
      openTime: backendKline.openTime,
      closeTime: backendKline.closeTime,
      open: backendKline.open,
      high: backendKline.high,
      low: backendKline.low,
      close: backendKline.close,
      volume: backendKline.volume,
      quoteVolume: backendKline.quoteVolume ?? '0',
      trades: backendKline.trades ?? 0,
      takerBuyBaseVolume: backendKline.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: backendKline.takerBuyQuoteVolume ?? '0',
    };
    handleRealtimeUpdate(kline, backendKline.isClosed);
  }, [handleRealtimeUpdate]);

  useKlineStream(
    symbol,
    timeframe as TimeInterval,
    handleKlineStreamUpdate,
    enabled,
    marketType,
  );

  const handleBecameVisible = useCallback((state: VisibilityState) => {
    if (state.hiddenDuration < VISIBILITY_REFRESH_THRESHOLD_MS) return;

    const now = Date.now();
    if (now - lastRefetchRef.current < MIN_REFETCH_INTERVAL_MS) return;
    lastRefetchRef.current = now;

    void refetchKlines();
  }, [refetchKlines]);

  useVisibilityChange({
    onBecameVisible: handleBecameVisible,
    minHiddenDurationForRefresh: VISIBILITY_REFRESH_THRESHOLD_MS,
  });

  useEffect(() => {
    if (!baseKlines || baseKlines.length === 0 || liveKlines.length === 0) return;

    const lastBaseKline = baseKlines[baseKlines.length - 1];
    const firstLiveKline = liveKlines[0];
    if (!lastBaseKline || !firstLiveKline) return;

    const intervalMs = getIntervalMs(timeframe);
    const gap = firstLiveKline.openTime - lastBaseKline.openTime;
    const gapCandles = Math.floor(gap / intervalMs);

    if (gapCandles > 1) {
      const now = Date.now();
      if (now - lastRefetchRef.current > MIN_REFETCH_INTERVAL_MS) {
        lastRefetchRef.current = now;
        void refetchKlines();
      }
    }
  }, [baseKlines, liveKlines, timeframe, getIntervalMs, refetchKlines]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const displayKlines = useMemo(() => {
    if (!baseKlines || baseKlines.length === 0) return [];
    if (liveKlines.length === 0) return baseKlines;

    const lastBaseKline = baseKlines[baseKlines.length - 1];
    if (!lastBaseKline) return baseKlines;

    const lastBaseOpenTime = lastBaseKline.openTime;
    const filteredLiveKlines = liveKlines.filter(k => k.openTime >= lastBaseOpenTime);

    if (filteredLiveKlines.length === 0) return baseKlines;

    const firstFiltered = filteredLiveKlines[0];
    if (!firstFiltered) return baseKlines;

    if (firstFiltered.openTime === lastBaseOpenTime) {
      return [...baseKlines.slice(0, -1), ...filteredLiveKlines];
    }

    return [...baseKlines, ...filteredLiveKlines];
  }, [baseKlines, liveKlines]);

  const klinesRef = useRef<Kline[]>(displayKlines);
  klinesRef.current = displayKlines;

  const tickSubscribersRef = useRef<Set<() => void>>(new Set());

  const klineSource = useMemo<KlineSource>(() => ({
    klinesRef,
    subscribe: (cb) => {
      tickSubscribersRef.current.add(cb);
      return () => { tickSubscribersRef.current.delete(cb); };
    },
  }), []);

  useEffect(() => {
    for (const cb of tickSubscribersRef.current) {
      try { cb(); } catch { /* best-effort */ }
    }
  }, [displayKlines]);

  return { displayKlines, klineSource };
};
