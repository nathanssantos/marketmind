import { useEffect, useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { socketService } from '../services/socketService';
import { usePriceStore } from '../store/priceStore';
import { trpc } from '../utils/trpc';

interface TickerUpdate {
  symbol: string;
  priceChangePercent: number;
  lastPrice: number;
  timestamp: number;
}

export const useTabTickers = (symbols: string[]): void => {
  const sortedKey = useMemo(() => [...symbols].sort().join(','), [symbols]);
  const subscribedRef = useRef<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const { data: snapshot } = trpc.ticker.get24hBatch.useQuery(
    { symbols, marketType: 'FUTURES' },
    {
      enabled: symbols.length > 0,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!snapshot || snapshot.length === 0) return;
    usePriceStore.getState().setDailyChangeBatch(
      snapshot.map((t) => ({ symbol: t.symbol, pct: t.priceChangePercent, lastPrice: t.lastPrice })),
    );
  }, [snapshot]);

  useEffect(() => {
    const socket = socketService.connect();
    socketRef.current = socket;

    const handleTicker = (data: TickerUpdate) => {
      usePriceStore.getState().setDailyChange(data.symbol, {
        pct: data.priceChangePercent,
        lastPrice: data.lastPrice,
      });
    };

    socket.on('ticker:update', handleTicker);

    return () => {
      socket.off('ticker:update', handleTicker);
      const symbolsToUnsubscribe = Array.from(subscribedRef.current);
      subscribedRef.current.clear();
      if (socket.connected) {
        for (const symbol of symbolsToUnsubscribe) socket.emit('unsubscribe:tickers', symbol);
      }
      socketService.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const desired = new Set(sortedKey ? sortedKey.split(',') : []);
    const currentlySubscribed = subscribedRef.current;

    const toAdd: string[] = [];
    for (const symbol of desired) {
      if (!currentlySubscribed.has(symbol)) {
        toAdd.push(symbol);
        currentlySubscribed.add(symbol);
      }
    }
    const toRemove: string[] = [];
    for (const symbol of currentlySubscribed) {
      if (!desired.has(symbol)) {
        toRemove.push(symbol);
        currentlySubscribed.delete(symbol);
      }
    }

    const doSubscribe = () => {
      if (toAdd.length > 0) socket.emit('subscribe:tickers:batch', toAdd);
      if (toRemove.length > 0) {
        for (const symbol of toRemove) socket.emit('unsubscribe:tickers', symbol);
      }
    };

    if (socket.connected) {
      doSubscribe();
    } else {
      socket.once('connect', doSubscribe);
    }
  }, [sortedKey]);
};
