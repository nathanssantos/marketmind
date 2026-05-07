import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ScalpingMetrics } from '@marketmind/types';
import { useLiveStream } from './useLiveStream';
import { useSocketEvent, useSymbolStreamSubscription } from './socket';

const MAX_HISTORY = 2000;

export interface ScalpingMetricsHistoryEntry {
  cvd: number;
  imbalanceRatio: number;
  timestamp: number;
}

// Two-track architecture:
//
//   1. The `metrics` value the React tree consumes — throttled (200ms,
//      4× during pan) via `useLiveStream`. This drives the displayed
//      gauges/ratios in the panel and is what was forcing re-renders
//      every ~30ms before.
//
//   2. The `historyRef` — populated on EVERY raw update via the
//      lower-level `useSocketEvent` listener (no throttle, no
//      coalesce). The history feeds chart-overlay computations
//      (CVD/imbalance per kline in `useChartAlternativeKlines`) which
//      are themselves polled from a 500ms interval — so we don't want
//      to drop intermediate samples. Imperative ref-only update means
//      it doesn't trigger React re-renders either.
export const useScalpingMetrics = (symbol: string | null, enabled = true) => {
  const historyRef = useRef<ScalpingMetricsHistoryEntry[]>([]);

  useEffect(() => {
    historyRef.current = [];
  }, [symbol]);

  useSymbolStreamSubscription('scalpingMetrics', enabled && symbol ? symbol : undefined);

  // Imperative high-frequency tap: feeds the history buffer used by
  // `useChartAlternativeKlines` and signal hit-tests. Doesn't update
  // any React state — pure ref mutation, no re-render cost.
  useSocketEvent(
    'scalpingMetrics:update',
    (data) => {
      const history = historyRef.current;
      history.push({
        cvd: data.cvd,
        imbalanceRatio: data.imbalanceRatio,
        timestamp: Date.now(),
      });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    },
    enabled && !!symbol,
  );

  // Throttled-and-coalesced snapshot for React consumers (the panel
  // labels, chart overlays at panel level). At 200ms cadence this is
  // visually realtime but ~5× cheaper. The payload doesn't carry
  // `symbol`, but the bus is scoped per-symbol via
  // `useSymbolStreamSubscription` above, so the only events reaching
  // this hook are for the symbol we asked about.
  const metrics = useLiveStream('scalpingMetrics:update', {
    enabled: enabled && !!symbol,
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
