import { useEffect, useState, useRef } from 'react';
import type { BookTickerUpdate } from '@marketmind/types';
import { socketService } from '../services/socketService';

export const useBookTicker = (symbol: string | null, enabled = true, throttleMs = 0) => {
  const [data, setData] = useState<BookTickerUpdate | null>(null);
  const latestRef = useRef<BookTickerUpdate | null>(null);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    setData(null);
    socket.emit('subscribe:bookTicker', symbol);

    const flush = () => {
      if (latestRef.current) setData(latestRef.current);
    };

    const handler = (update: BookTickerUpdate) => {
      latestRef.current = update;
      if (throttleMs > 0) {
        if (timeoutRef.current) return;
        timeoutRef.current = setTimeout(() => {
          flush();
          timeoutRef.current = null;
        }, throttleMs);
        return;
      }
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          flush();
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [symbol, enabled, throttleMs]);

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
