import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { BACKEND_URL } from '@shared/constants/api';
import { socketService } from '../services/socketService';
import { useConnectionStore } from '../store/connectionStore';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  auth?: {
    token?: string;
  };
}

export interface FrontendLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  emoji: string;
  message: string;
  symbol?: string;
  interval?: string;
}

interface WebSocketEvents {
  'order:update': (order: unknown) => void;
  'order:created': (order: unknown) => void;
  'order:cancelled': (data: { orderId: string }) => void;
  'position:update': (position: unknown) => void;
  'wallet:update': (wallet: unknown) => void;
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
  'autoTrading:log': (entry: FrontendLogEntry) => void;
  'signal-suggestion': (data: {
    id: string;
    symbol: string;
    interval: string;
    side: 'LONG' | 'SHORT';
    setupType: string;
    strategyId: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    confidence: number;
    positionSizePercent: string;
    expiresAt: string;
    createdAt: string;
  }) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url: _url = BACKEND_URL,
    autoConnect = true,
    auth: _auth,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const isConnected = useConnectionStore((s) => s.wsConnected);

  useEffect(() => {
    if (!autoConnect) return;

    const socket = socketService.connect();
    socketRef.current = socket;

    return () => {
      socketService.disconnect();
      socketRef.current = null;
    };
  }, [autoConnect]);

  const subscribe = {
    orders: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:orders', walletId);
    },
    positions: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:positions', walletId);
    },
    wallet: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:wallet', walletId);
    },
    prices: (symbol: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:prices', symbol);
    },
    klines: (data: { symbol: string; interval: string }) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:klines', data);
    },
    setups: (userId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:setups', userId);
    },
    autoTradingLogs: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('subscribe:autoTradingLogs', walletId);
    },
  };

  const unsubscribe = {
    orders: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:orders', walletId);
    },
    positions: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:positions', walletId);
    },
    wallet: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:wallet', walletId);
    },
    prices: (symbol: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:prices', symbol);
    },
    klines: (data: { symbol: string; interval: string }) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:klines', data);
    },
    setups: (userId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:setups', userId);
    },
    autoTradingLogs: (walletId: string) => {
      const socket = socketService.getSocket();
      socket?.emit('unsubscribe:autoTradingLogs', walletId);
    },
  };

  const on = <K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void => {
    const socket = socketService.getSocket();
    socket?.on(event, handler as never);
  };

  const off = <K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void => {
    const socket = socketService.getSocket();
    socket?.off(event, handler as never);
  };

  return {
    socket: socketRef.current,
    isConnected,
    subscribe,
    unsubscribe,
    on,
    off,
  };
};
