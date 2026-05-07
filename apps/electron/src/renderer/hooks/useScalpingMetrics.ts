import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ScalpingMetrics } from '@marketmind/types';
import { useLiveStream } from './useLiveStream';
import { useSymbolStreamSubscription } from './socket';

const MAX_HISTORY = 2000;

export interface ScalpingMetricsHistoryEntry {
  cvd: number;
  imbalanceRatio: number;
  timestamp: number;
}

// Two-track architecture under a single useLiveStream subscription:
//
//   1. The `metrics` value React consumes — throttled (200ms idle,
//      800ms during pan) via `useLiveStream`. Drives the displayed
//      gauges/ratios in the Order Flow panel and chart overlays.
//
//   2. The `historyRef` — populated on EVERY raw update via
//      `onRawTick`, BEFORE the throttle decision. The history feeds
//      chart overlay computations (CVD/imbalance per kline in
//      `useChartAlternativeKlines`) which run on a 500ms interval —
//      so we must NOT drop intermediate samples. Imperative ref-only
//      mutation: no React re-render cost.
//
// Single socket subscription serves both — previously this hook
// registered two separate `useSocketEvent` listeners on the same
// event, which doubled the dispatch handler count for no benefit.
export const useScalpingMetrics = (symbol: string | null, enabled = true) => {
  const historyRef = useRef<ScalpingMetricsHistoryEntry[]>([]);

  useEffect(() => {
    historyRef.current = [];
  }, [symbol]);

  useSymbolStreamSubscription('scalpingMetrics', enabled && symbol ? symbol : undefined);

  const recordHistory = useCallback((data: ScalpingMetrics) => {
    const history = historyRef.current;
    history.push({
      cvd: data.cvd,
      imbalanceRatio: data.imbalanceRatio,
      timestamp: Date.now(),
    });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  }, []);

  const metrics = useLiveStream('scalpingMetrics:update', {
    enabled: enabled && !!symbol,
    onRawTick: recordHistory,
  }) as ScalpingMetrics | null;

  const getHistory = useCallback(() => historyRef.current, []);

  return useMemo(() => ({
    cvd: metrics?.cvd ?? 0,
    imbalanceRatio: metrics?.imbalanceRatio ?? 0,
    microprice: metrics?.microprice ?? 0,
    spread: metrics?.spread ?? 0,
    spreadPercent: metrics?.spreadPercent ?? 0,
    largeBuyVol: metrics?.largeBuyVol ?? 0,
    largeSellVol: metrics?.largeSellVol ?? 0,
    absorptionScore: metrics?.absorptionScore ?? 0,
    exhaustionScore: metrics?.exhaustionScore ?? 0,
    metricsHistory: getHistory,
  }), [metrics, getHistory]);
};
