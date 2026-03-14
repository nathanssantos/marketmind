import { useEffect, useState, useRef } from 'react';
import type { BookTickerUpdate } from '@marketmind/types';
import { socketService } from '../services/socketService';

export const useBookTicker = (symbol: string | null, enabled = true) => {
  const [data, setData] = useState<BookTickerUpdate | null>(null);
  const latestRef = useRef<BookTickerUpdate | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    setData(null);
    socket.emit('subscribe:bookTicker', symbol);

    const handler = (update: BookTickerUpdate) => {
      latestRef.current = update;
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          if (latestRef.current) setData(latestRef.current);
          frameRef.current = null;
        });
      }
    };

    socket.on('bookTicker:update', handler);

    return () => {
      socket.off('bookTicker:update', handler);
      socket.emit('unsubscribe:bookTicker', symbol);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [symbol, enabled]);

  return {
    bidPrice: data?.bidPrice ?? 0,
    bidQty: data?.bidQty ?? 0,
    askPrice: data?.askPrice ?? 0,
    askQty: data?.askQty ?? 0,
    microprice: data?.microprice ?? 0,
    spread: data?.spread ?? 0,
    spreadPercent: data?.spreadPercent ?? 0,
    imbalanceRatio: 0,
  };
};
