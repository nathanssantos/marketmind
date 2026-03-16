import { useEffect, useState, useCallback } from 'react';
import type { ScalpingSignal } from '@marketmind/types';
import { socketService } from '../services/socketService';

const MAX_SIGNALS = 50;

export const useScalpingSignals = (walletId: string | null, enabled = true) => {
  const [signals, setSignals] = useState<ScalpingSignal[]>([]);

  const clearSignals = useCallback(() => setSignals([]), []);

  useEffect(() => {
    if (!walletId || !enabled) return;

    const socket = socketService.connect();

    socket.emit('subscribe:scalpingSignals', walletId);

    const handler = (signal: ScalpingSignal) => {
      setSignals((prev) => {
        const next = [signal, ...prev];
        return next.length > MAX_SIGNALS ? next.slice(0, MAX_SIGNALS) : next;
      });
    };

    socket.on('scalpingSignal:new', handler);

    return () => {
      socket.off('scalpingSignal:new', handler);
      socket.emit('unsubscribe:scalpingSignals', walletId);
      socketService.disconnect();
    };
  }, [walletId, enabled]);

  return { signals, clearSignals };
};
