import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  auth?: {
    token?: string;
  };
}

interface WebSocketEvents {
  'order:update': (order: unknown) => void;
  'order:created': (order: unknown) => void;
  'order:cancelled': (data: { orderId: string }) => void;
  'position:update': (position: unknown) => void;
  'price:update': (data: { symbol: string; price: number; timestamp: number }) => void;
  'kline:update': (kline: {
    symbol: string;
    interval: string;
    openTime: number;
    closeTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    isClosed: boolean;
    timestamp: number;
  }) => void;
  'setup-detected': (data: {
    symbol: string;
    interval: string;
    setup: {
      id: string;
      setupType: string;
      direction: 'LONG' | 'SHORT';
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      confidence: number;
      riskRewardRatio: number;
      detectedAt: Date;
    };
  }) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = 'http://localhost:3001',
    autoConnect = true,
    auth,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
      auth: auth ?? {},
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      console.error('WebSocket connection error:', err);
      setError(err);
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, autoConnect, auth]);

  const subscribe = {
    orders: (walletId: string) => {
      socketRef.current?.emit('subscribe:orders', walletId);
    },
    positions: (walletId: string) => {
      socketRef.current?.emit('subscribe:positions', walletId);
    },
    prices: (symbol: string) => {
      socketRef.current?.emit('subscribe:prices', symbol);
    },
    klines: (data: { symbol: string; interval: string }) => {
      socketRef.current?.emit('subscribe:klines', data);
    },
    setups: (userId: string) => {
      socketRef.current?.emit('subscribe:setups', userId);
    },
  };

  const unsubscribe = {
    orders: (walletId: string) => {
      socketRef.current?.emit('unsubscribe:orders', walletId);
    },
    positions: (walletId: string) => {
      socketRef.current?.emit('unsubscribe:positions', walletId);
    },
    prices: (symbol: string) => {
      socketRef.current?.emit('unsubscribe:prices', symbol);
    },
    klines: (data: { symbol: string; interval: string }) => {
      socketRef.current?.emit('unsubscribe:klines', data);
    },
    setups: (userId: string) => {
      socketRef.current?.emit('unsubscribe:setups', userId);
    },
  };

  const on = <K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void => {
    socketRef.current?.on(event, handler as never);
  };

  const off = <K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void => {
    socketRef.current?.off(event, handler as never);
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    on,
    off,
  };
};
