import { useEffect, useRef, useState, useCallback } from 'react';
import type { AggTrade } from '@marketmind/types';
import { socketService } from '../services/socketService';
import { trpc } from '../utils/trpc';

const MAX_BUFFER_SIZE = 10_000;
const PRELOAD_WINDOW_MS = 2 * 60 * 60 * 1000;

interface AggTradeWithLarge extends AggTrade {
  isLargeTrade?: boolean;
}

export const useAggTrades = (symbol: string | null, enabled = true) => {
  const [trades, setTrades] = useState<AggTradeWithLarge[]>([]);
  const [largeTrades, setLargeTrades] = useState<AggTradeWithLarge[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const bufferRef = useRef<AggTradeWithLarge[]>([]);
  const frameRef = useRef<number | null>(null);
  const preloadedRef = useRef<string | null>(null);

  const utils = trpc.useUtils();

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

    if (preloadedRef.current !== symbol) {
      const now = Date.now();
      utils.scalping.getAggTradeHistory.fetch({
        symbol,
        from: now - PRELOAD_WINDOW_MS,
        to: now,
        limit: MAX_BUFFER_SIZE,
      }).then((historical) => {
        if (historical.length > 0) {
          setTrades((prev) => {
            if (prev.length === 0) return historical as AggTradeWithLarge[];
            const lastHistTs = historical[historical.length - 1]!.timestamp;
            const newOnly = prev.filter((t) => t.timestamp > lastHistTs);
            const merged = [...(historical as AggTradeWithLarge[]), ...newOnly];
            return merged.length > MAX_BUFFER_SIZE ? merged.slice(-MAX_BUFFER_SIZE) : merged;
          });
        }
        preloadedRef.current = symbol;
      }).catch(() => {});
    }

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
  }, [symbol, enabled, flush, utils]);

  return { trades, largeTrades, isConnected };
};
