import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { ScalpingMetrics } from '@marketmind/types';
import { socketService } from '../services/socketService';

const MAX_HISTORY = 2000;

export interface ScalpingMetricsHistoryEntry {
  cvd: number;
  imbalanceRatio: number;
  timestamp: number;
}

export const useScalpingMetrics = (symbol: string | null, enabled = true) => {
  const [metrics, setMetrics] = useState<ScalpingMetrics | null>(null);
  const latestRef = useRef<ScalpingMetrics | null>(null);
  const frameRef = useRef<number | null>(null);
  const historyRef = useRef<ScalpingMetricsHistoryEntry[]>([]);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.connect();

    setMetrics(null);
    historyRef.current = [];
    socket.emit('subscribe:scalpingMetrics', symbol);

    const handler = (data: ScalpingMetrics) => {
      latestRef.current = data;

      const history = historyRef.current;
      history.push({
        cvd: data.cvd,
        imbalanceRatio: data.imbalanceRatio,
        timestamp: Date.now(),
      });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          if (latestRef.current) setMetrics(latestRef.current);
          frameRef.current = null;
        });
      }
    };

    socket.on('scalpingMetrics:update', handler);

    return () => {
      socket.off('scalpingMetrics:update', handler);
      socket.emit('unsubscribe:scalpingMetrics', symbol);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      socketService.disconnect();
    };
  }, [symbol, enabled]);

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
