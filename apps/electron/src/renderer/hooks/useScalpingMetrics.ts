import { useEffect, useState, useRef } from 'react';
import type { ScalpingMetrics } from '@marketmind/types';
import { socketService } from '../services/socketService';

export const useScalpingMetrics = (symbol: string | null, enabled = true) => {
  const [metrics, setMetrics] = useState<ScalpingMetrics | null>(null);
  const latestRef = useRef<ScalpingMetrics | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    setMetrics(null);
    socket.emit('subscribe:scalpingMetrics', symbol);

    const handler = (data: ScalpingMetrics) => {
      latestRef.current = data;
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
    };
  }, [symbol, enabled]);

  return {
    cvd: metrics?.cvd ?? 0,
    imbalanceRatio: metrics?.imbalanceRatio ?? 0,
    microprice: metrics?.microprice ?? 0,
    spread: metrics?.spread ?? 0,
    spreadPercent: metrics?.spreadPercent ?? 0,
    largeBuyVol: metrics?.largeBuyVol ?? 0,
    largeSellVol: metrics?.largeSellVol ?? 0,
    absorptionScore: metrics?.absorptionScore ?? 0,
    exhaustionScore: metrics?.exhaustionScore ?? 0,
  };
};
