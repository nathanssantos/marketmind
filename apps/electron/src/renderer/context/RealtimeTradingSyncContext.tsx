import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { createPlatformAdapter } from '../adapters/factory';
import { socketService } from '../services/socketService';
import { trpc } from '../utils/trpc';
import { usePriceStore } from '../store/priceStore';
import { toaster } from '../utils/toaster';

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

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

interface TradeNotification {
  type: 'POSITION_OPENED' | 'POSITION_CLOSED' | 'TRAILING_STOP_UPDATED' | 'LIMIT_FILLED';
  title: string;
  body: string;
  urgency: 'low' | 'normal' | 'critical';
  data: {
    executionId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice?: string;
    exitPrice?: string;
    pnl?: string;
    pnlPercent?: string;
    exitReason?: string;
    oldStopLoss?: string;
    newStopLoss?: string;
  };
}

interface RealtimeTradingSyncContextValue {
  subscribeToPrice: (symbol: string, onUpdate: (price: number) => void) => () => void;
  forceRefresh: () => void;
  isConnected: boolean;
}

const RealtimeTradingSyncContext = createContext<RealtimeTradingSyncContextValue | null>(null);

interface RealtimeTradingSyncProviderProps {
  walletId: string | undefined;
  children: ReactNode;
}

export const RealtimeTradingSyncProvider = ({ walletId, children }: RealtimeTradingSyncProviderProps) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const listenersRegisteredRef = useRef(false);
  const utils = trpc.useUtils();
  const priceCallbacksRef = useRef<Map<string, (price: number) => void>>(new Map());
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const currentWalletIdRef = useRef<string | undefined>(undefined);

  const invalidatePositions = useCallback(() => {
    if (!currentWalletIdRef.current) return;
    utils.trading.getTradeExecutions.invalidate({ walletId: currentWalletIdRef.current });
    utils.trading.getPositions.invalidate({ walletId: currentWalletIdRef.current });
    utils.autoTrading.getActiveExecutions.invalidate({ walletId: currentWalletIdRef.current });
    utils.autoTrading.getExecutionHistory.invalidate({ walletId: currentWalletIdRef.current });
  }, [utils]);

  const invalidateOrders = useCallback(() => {
    if (!currentWalletIdRef.current) return;
    utils.trading.getOrders.invalidate({ walletId: currentWalletIdRef.current });
  }, [utils]);

  const invalidateWallet = useCallback(() => {
    if (!currentWalletIdRef.current) return;
    utils.wallet.list.invalidate();
    utils.analytics.getPerformance.invalidate({ walletId: currentWalletIdRef.current });
  }, [utils]);

  const invalidateTradingData = useCallback(() => {
    if (!currentWalletIdRef.current) return;
    utils.trading.getTradeExecutions.invalidate({ walletId: currentWalletIdRef.current });
    utils.trading.getOrders.invalidate({ walletId: currentWalletIdRef.current });
    utils.trading.getPositions.invalidate({ walletId: currentWalletIdRef.current });
    utils.autoTrading.getActiveExecutions.invalidate({ walletId: currentWalletIdRef.current });
    utils.autoTrading.getExecutionHistory.invalidate({ walletId: currentWalletIdRef.current });
    utils.wallet.list.invalidate();
    utils.analytics.getPerformance.invalidate({ walletId: currentWalletIdRef.current });
  }, [utils]);

  useEffect(() => {
    currentWalletIdRef.current = walletId;
  }, [walletId]);

  useEffect(() => {
    if (!walletId) return;

    const socket = socketService.connect();
    socketRef.current = socket;

    if (!listenersRegisteredRef.current) {
      socket.on('connect', () => {
        console.log('[RealtimeSync] WebSocket connected');
        isConnectedRef.current = true;
        if (currentWalletIdRef.current) {
          socket.emit('subscribe:positions', currentWalletIdRef.current);
          socket.emit('subscribe:wallet', currentWalletIdRef.current);
        }
        for (const symbol of subscribedSymbolsRef.current) {
          console.log('[RealtimeSync] Re-subscribing to price:', symbol);
          socket.emit('subscribe:prices', symbol);
        }
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
        usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
        const callback = priceCallbacksRef.current.get(data.symbol);
        if (callback) {
          callback(data.price);
        }
      });

      socket.on('trade:notification', async (notification: TradeNotification) => {
        console.log('[RealtimeSync] Trade notification received:', notification.type, notification.title);

        const toastType = notification.type === 'POSITION_CLOSED'
          ? (parseFloat(notification.data.pnl || '0') >= 0 ? 'success' : 'error')
          : notification.type === 'TRAILING_STOP_UPDATED'
            ? 'info'
            : 'success';

        toaster.create({
          title: notification.title,
          description: notification.body,
          type: toastType,
          duration: notification.urgency === 'critical' ? undefined : 8000,
        });

        try {
          const adapter = await createPlatformAdapter();
          const isSupported = await adapter.notification.isSupported();
          if (isSupported) {
            await adapter.notification.show({
              title: notification.title,
              body: notification.body,
              urgency: notification.urgency,
            });
          }
        } catch (err) {
          console.error('[RealtimeSync] Native notification error:', err);
        }

        invalidatePositions();
        invalidateWallet();
      });

      listenersRegisteredRef.current = true;
    } else if (socket.connected) {
      socket.emit('subscribe:positions', walletId);
      socket.emit('subscribe:wallet', walletId);
    }

    return () => {
      socket.emit('unsubscribe:positions', walletId);
      socket.emit('unsubscribe:wallet', walletId);
    };
  }, [walletId, invalidatePositions, invalidateOrders, invalidateWallet]);

  useEffect(() => {
    return () => {
      if (listenersRegisteredRef.current) {
        socketService.disconnect();
        socketRef.current = null;
        listenersRegisteredRef.current = false;
        isConnectedRef.current = false;
      }
    };
  }, []);

  const subscribeToPrice = useCallback((symbol: string, onUpdate: (price: number) => void) => {
    priceCallbacksRef.current.set(symbol, onUpdate);
    subscribedSymbolsRef.current.add(symbol);

    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:prices', symbol);
    }

    return () => {
      priceCallbacksRef.current.delete(symbol);
      subscribedSymbolsRef.current.delete(symbol);
      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe:prices', symbol);
      }
    };
  }, []);

  const forceRefresh = useCallback(() => {
    invalidateTradingData();
  }, [invalidateTradingData]);

  const value: RealtimeTradingSyncContextValue = {
    subscribeToPrice,
    forceRefresh,
    isConnected: isConnectedRef.current,
  };

  return (
    <RealtimeTradingSyncContext.Provider value={value}>
      {children}
    </RealtimeTradingSyncContext.Provider>
  );
};

export const useRealtimeTradingSyncContext = (): RealtimeTradingSyncContextValue => {
  const context = useContext(RealtimeTradingSyncContext);
  if (!context) {
    return {
      subscribeToPrice: () => () => {},
      forceRefresh: () => {},
      isConnected: false,
    };
  }
  return context;
};
