import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScalpingMetrics } from '@marketmind/types';
import { useSocketEvent, useSymbolStreamSubscription } from './socket';

const MAX_HISTORY = 2000;

export interface ScalpingMetricsHistoryEntry {
  cvd: number;
  imbalanceRatio: number;
  timestamp: number;
}

export const useScalpingMetrics = (symbol: string | null, enabled = true) => {
  const [metrics, setMetrics] = useState<ScalpingMetrics | null>(null);
  const historyRef = useRef<ScalpingMetricsHistoryEntry[]>([]);

  useEffect(() => {
    setMetrics(null);
    historyRef.current = [];
  }, [symbol]);

  useSymbolStreamSubscription('scalpingMetrics', enabled && symbol ? symbol : undefined);

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
      setMetrics(data);
    },
    enabled && !!symbol,
  );

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
