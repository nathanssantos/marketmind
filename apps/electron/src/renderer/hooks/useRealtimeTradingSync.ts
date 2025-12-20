import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { socketService } from '../services/socketService';
import { trpc } from '../utils/trpc';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

interface PositionUpdate {
  id: string;
  status: string;
  entryPrice?: string;
  exitPrice?: string;
  pnl?: string;
  pnlPercent?: string;
}

interface OrderUpdate {
  orderId: number;
  status: string;
  symbol: string;
}

const BACKUP_POLLING_INTERVAL = 30000;

export const useRealtimeTradingSync = (walletId: string | undefined) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const utils = trpc.useUtils();
  const priceCallbacksRef = useRef<Map<string, (price: number) => void>>(new Map());

  const invalidateTradingData = useCallback(() => {
    if (!walletId) return;
    utils.trading.getTradeExecutions.invalidate({ walletId });
    utils.trading.getOrders.invalidate({ walletId });
    utils.trading.getPositions.invalidate({ walletId });
    utils.wallet.list.invalidate();
    utils.analytics.getPerformance.invalidate({ walletId });
  }, [utils, walletId]);

  const invalidateOrders = useCallback(() => {
    if (!walletId) return;
    utils.trading.getOrders.invalidate({ walletId });
  }, [utils, walletId]);

  const invalidatePositions = useCallback(() => {
    if (!walletId) return;
    utils.trading.getTradeExecutions.invalidate({ walletId });
    utils.trading.getPositions.invalidate({ walletId });
  }, [utils, walletId]);

  const invalidateWallet = useCallback(() => {
    if (!walletId) return;
    utils.wallet.list.invalidate();
    utils.analytics.getPerformance.invalidate({ walletId });
  }, [utils, walletId]);

  useEffect(() => {
    if (!walletId) return;

    const socket = socketService.connect();

    socket.on('connect', () => {
      console.log('[RealtimeSync] WebSocket connected');
      isConnectedRef.current = true;

      socket.emit('subscribe:positions', walletId);
      socket.emit('subscribe:orders', walletId);
      socket.emit('subscribe:wallet', walletId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[RealtimeSync] WebSocket disconnected:', reason);
      isConnectedRef.current = false;
    });

    socket.on('connect_error', (err) => {
      console.error('[RealtimeSync] Connection error:', err.message);
      isConnectedRef.current = false;
    });

    socket.on('position:update', (position: PositionUpdate) => {
      console.log('[RealtimeSync] Position update received:', position.id, position.status);
      invalidatePositions();
      invalidateWallet();
    });

    socket.on('order:update', (_order: OrderUpdate) => {
      invalidateOrders();
    });

    socket.on('order:created', (_order: OrderUpdate) => {
      invalidateOrders();
      invalidateWallet();
    });

    socket.on('order:cancelled', (_data: { orderId: string }) => {
      invalidateOrders();
      invalidateWallet();
    });

    socket.on('wallet:update', () => {
      invalidateWallet();
    });

    socket.on('price:update', (data: PriceUpdate) => {
      const callback = priceCallbacksRef.current.get(data.symbol);
      if (callback) {
        callback(data.price);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.emit('unsubscribe:positions', walletId);
      socket.emit('unsubscribe:orders', walletId);
      socket.emit('unsubscribe:wallet', walletId);
      socketService.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, [walletId, invalidatePositions, invalidateOrders, invalidateWallet]);

  const subscribeToPrice = useCallback((symbol: string, onUpdate: (price: number) => void) => {
    priceCallbacksRef.current.set(symbol, onUpdate);
    socketRef.current?.emit('subscribe:prices', symbol);

    return () => {
      priceCallbacksRef.current.delete(symbol);
      socketRef.current?.emit('unsubscribe:prices', symbol);
    };
  }, []);

  const forceRefresh = useCallback(() => {
    invalidateTradingData();
  }, [invalidateTradingData]);

  return {
    isConnected: isConnectedRef.current,
    subscribeToPrice,
    forceRefresh,
    backupPollingInterval: BACKUP_POLLING_INTERVAL,
  };
};
