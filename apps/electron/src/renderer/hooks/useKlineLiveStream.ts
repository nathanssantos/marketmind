import type { Kline, MarketType, TimeInterval } from '@marketmind/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { INTERVAL_MS_MAP, MIN_UPDATE_INTERVAL_MS } from '../constants/defaults';
import { useKlineStream } from './useBackendKlines';

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

// Merge baseKlines + liveKlines into the array consumers see. Pulled
// out of the displayKlines useMemo so we can also call it imperatively
// inside processUpdate (where there is no React render to trigger the
// memo). Pure — same logic as before, just hoisted.
const mergeKlines = (base: Kline[] | undefined, live: Kline[]): Kline[] => {
  if (!base || base.length === 0) return [];
  if (live.length === 0) return base;
  const lastBase = base[base.length - 1];
  if (!lastBase) return base;
  const lastBaseOpenTime = lastBase.openTime;
  const filtered = live.filter((k) => k.openTime >= lastBaseOpenTime);
  if (filtered.length === 0) return base;
  const first = filtered[0];
  if (!first) return base;
  if (first.openTime === lastBaseOpenTime) {
    return [...base.slice(0, -1), ...filtered];
  }
  return [...base, ...filtered];
};

export const useKlineLiveStream = ({
  symbol,
  timeframe,
  marketType,
  baseKlines,
  enabled,
  refetchKlines,
}: UseKlineLiveStreamOptions): UseKlineLiveStreamReturn => {
  // `liveKlines` STATE only changes when the array LENGTH changes (new
  // minute / new symbol / initial). Intra-minute price updates flow
  // through `liveKlinesRef` + tick subscribers without setting state —
  // that keeps `ChartPanelContent` and `App` from re-rendering on every
  // tick (the canvas paint and pan handler want full main-thread time).
  // The canvas consumes the freshest array via `klineSource.klinesRef`,
  // so the displayed chart never lags despite the state-update gating.
  const [liveKlines, setLiveKlines] = useState<Kline[]>([]);
  const liveKlinesRef = useRef<Kline[]>([]);
  const baseKlinesRef = useRef<Kline[] | undefined>(baseKlines);
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const getIntervalMs = useCallback((tf: string): number =>
    INTERVAL_MS_MAP[tf as TimeInterval] || 60_000, []);

  useEffect(() => {
    setLiveKlines([]);
    liveKlinesRef.current = [];
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

  const tickSubscribersRef = useRef<Set<() => void>>(new Set());
  const klinesRef = useRef<Kline[]>([]);

  // Imperative ref-based update path. Updates `liveKlinesRef`,
  // recomputes the merged `klinesRef` (= base + live), and notifies
  // tick subscribers (the canvas redraws via `manager.markDirty`
  // through this). React state (`setLiveKlines`) is only set when the
  // length CHANGES — i.e. a new minute closed and the next opened, or
  // the very first kline arrived. That prevents `ChartPanelContent` /
  // `App` from re-rendering on every intra-minute tick. The chart still
  // paints every tick because the imperative `klineSource.subscribe`
  // path is decoupled from React.
  const processUpdate = useCallback(() => {
    const update = pendingUpdateRef.current;
    if (!update) return;

    const { kline: latestKline } = update;
    lastUpdateRef.current = Date.now();

    const prev = liveKlinesRef.current;
    const lastKline = prev[prev.length - 1];

    let next: Kline[];
    let lengthChanged = false;

    if (prev.length === 0 || !lastKline) {
      next = [latestKline];
      lengthChanged = true;
    } else if (latestKline.openTime === lastKline.openTime) {
      // Intra-minute update: same candle, possibly new OHLCV values.
      if (
        getKlineClose(latestKline) === getKlineClose(lastKline) &&
        getKlineHigh(latestKline) === getKlineHigh(lastKline) &&
        getKlineLow(latestKline) === getKlineLow(lastKline) &&
        getKlineVolume(latestKline) === getKlineVolume(lastKline)
      ) {
        rafIdRef.current = null;
        pendingUpdateRef.current = null;
        return;
      }
      next = [...prev.slice(0, -1), latestKline];
    } else if (latestKline.openTime > lastKline.openTime) {
      // New minute closed — array length grows.
      next = [...prev, latestKline];
      lengthChanged = true;
    } else {
      // Out-of-order (older than current head) — ignore.
      rafIdRef.current = null;
      pendingUpdateRef.current = null;
      return;
    }

    liveKlinesRef.current = next;
    klinesRef.current = mergeKlines(baseKlinesRef.current, next);

    // Notify imperative subscribers — the canvas updates here without
    // React reconciling.
    for (const cb of tickSubscribersRef.current) {
      try { cb(); } catch { /* best-effort */ }
    }

    // React state update only on length change. Within a minute the
    // ref-based path keeps everything in sync without re-rendering the
    // host component.
    if (lengthChanged) setLiveKlines(next);

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

  // displayKlines only changes when:
  //   - baseKlines reference changes (initial load, pagination prepend,
  //     symbol change, refetch), OR
  //   - liveKlines state changes (which now only happens on minute
  //     boundary or first kline — see processUpdate above).
  // Inside a minute the array reference is stable; the canvas pulls
  // intra-minute values from `klineSource.klinesRef` instead.
  const displayKlines = useMemo(
    () => mergeKlines(baseKlines, liveKlines),
    [baseKlines, liveKlines],
  );

  // Sync baseKlines into the ref so processUpdate's mergeKlines call
  // sees the freshest base. Also rebuild klinesRef when base changes
  // (e.g. pagination prepend) and notify subscribers so the canvas
  // picks up the new history.
  useEffect(() => {
    baseKlinesRef.current = baseKlines;
    klinesRef.current = mergeKlines(baseKlines, liveKlinesRef.current);
    for (const cb of tickSubscribersRef.current) {
      try { cb(); } catch { /* best-effort */ }
    }
  }, [baseKlines]);

  // Keep klinesRef in sync with displayKlines on the React-render path
  // too — covers the case where liveKlines state updated (length
  // change) without going through processUpdate (e.g. reset). Cheap
  // assignment, no extra render cost.
  klinesRef.current = displayKlines;

  const klineSource = useMemo<KlineSource>(() => ({
    klinesRef,
    subscribe: (cb) => {
      tickSubscribersRef.current.add(cb);
      return () => { tickSubscribersRef.current.delete(cb); };
    },
  }), []);

  return { displayKlines, klineSource };
};
