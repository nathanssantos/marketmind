import { useEffect, useState, useRef } from 'react';
import type { DepthUpdate, DepthLevel } from '@marketmind/types';
import { socketService } from '../services/socketService';

export const useDepth = (symbol: string | null, enabled = true) => {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const latestRef = useRef<DepthUpdate | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    setBids([]);
    setAsks([]);
    socket.emit('subscribe:depth', symbol);

    const handler = (update: DepthUpdate) => {
      latestRef.current = update;
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          if (latestRef.current) {
            setBids(latestRef.current.bids);
            setAsks(latestRef.current.asks);
          }
          frameRef.current = null;
        });
      }
    };

    socket.on('depth:update', handler);

    return () => {
      socket.off('depth:update', handler);
      socket.emit('unsubscribe:depth', symbol);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [symbol, enabled]);

  return { bids, asks };
};
