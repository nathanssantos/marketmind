import { useEffect, useRef, useState, useCallback } from 'react';
import type { AggTrade } from '@marketmind/types';
import { socketService } from '../services/socketService';

const MAX_BUFFER_SIZE = 5000;

interface AggTradeWithLarge extends AggTrade {
  isLargeTrade?: boolean;
}

export const useAggTrades = (symbol: string | null, enabled = true) => {
  const [trades, setTrades] = useState<AggTradeWithLarge[]>([]);
  const [largeTrades, setLargeTrades] = useState<AggTradeWithLarge[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const bufferRef = useRef<AggTradeWithLarge[]>([]);
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);

    setTrades((prev) => {
      const next = [...prev, ...batch];
      return next.length > MAX_BUFFER_SIZE ? next.slice(-MAX_BUFFER_SIZE) : next;
    });

    const large = batch.filter((t) => t.isLargeTrade);
    if (large.length > 0) {
      setLargeTrades((prev) => {
        const next = [...prev, ...large];
        return next.length > 200 ? next.slice(-200) : next;
      });
    }
  }, []);

  useEffect(() => {
    if (!symbol || !enabled) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    setTrades([]);
    setLargeTrades([]);
    bufferRef.current = [];
    socket.emit('subscribe:aggTrades', symbol);
    setIsConnected(true);

    const handler = (data: AggTradeWithLarge) => {
      bufferRef.current.push(data);
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          flush();
          frameRef.current = null;
        });
      }
    };

    socket.on('aggTrade:update', handler);

    return () => {
      socket.off('aggTrade:update', handler);
      socket.emit('unsubscribe:aggTrades', symbol);
      setIsConnected(false);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [symbol, enabled, flush]);

  return { trades, largeTrades, isConnected };
};
