import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { createPlatformAdapter } from '../adapters/factory';
import { socketService } from '../services/socketService';
import { QUERY_CONFIGS } from '../services/queryConfig';
import { trpc } from '../utils/trpc';
import { useOrderFlashStore } from '../store/orderFlashStore';
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
  id?: string;
  orderId?: number;
  status: string;
  symbol: string;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

interface RiskAlert {
  type: 'LIQUIDATION_RISK' | 'DAILY_LOSS_LIMIT' | 'MAX_DRAWDOWN' | 'POSITION_CLOSED' | 'MARGIN_TOP_UP' | 'UNKNOWN_POSITION' | 'ORDER_REJECTED' | 'ORPHAN_ORDERS' | 'ORDER_MISMATCH' | 'UNPROTECTED_POSITION';
  level: 'info' | 'warning' | 'danger' | 'critical';
  symbol?: string;
  message: string;
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
  const recentAlertsRef = useRef<Map<string, number>>(new Map());
  const utils = trpc.useUtils();
  const priceCallbacksRef = useRef<Map<string, Set<(price: number) => void>>>(new Map());
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const currentWalletIdRef = useRef<string | undefined>(undefined);

  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.tradeExecutions.staleTime }
  );

  const { data: orders } = trpc.trading.getOrders.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.orders.staleTime }
  );

  const allRequiredSymbols = useMemo(() => {
    const symbols = new Set<string>();

    const openExecutions = tradeExecutions?.filter((e) => e.status === 'open' || e.status === 'pending') ?? [];
    for (const exec of openExecutions) {
      symbols.add(exec.symbol);
    }

    const activeOrders = orders?.filter((o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED') ?? [];
    for (const order of activeOrders) {
      symbols.add(order.symbol);
    }

    return symbols;
  }, [tradeExecutions, orders]);

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
    if (!socketRef.current?.connected) return;

    const currentSubscribed = subscribedSymbolsRef.current;
    const newSymbols: string[] = [];
    const removedSymbols: string[] = [];

    for (const symbol of allRequiredSymbols) {
      if (!currentSubscribed.has(symbol)) {
        newSymbols.push(symbol);
        currentSubscribed.add(symbol);
      }
    }
    if (newSymbols.length > 0) {
      socketRef.current.emit('subscribe:prices:batch', newSymbols);
    }

    for (const symbol of currentSubscribed) {
      if (!allRequiredSymbols.has(symbol) && !priceCallbacksRef.current.has(symbol)) {
        removedSymbols.push(symbol);
        currentSubscribed.delete(symbol);
        socketRef.current.emit('unsubscribe:prices', symbol);
      }
    }

    if (newSymbols.length > 0) {
      console.log('[RealtimeSync] Auto-subscribed to:', newSymbols);
    }
    if (removedSymbols.length > 0) {
      console.log('[RealtimeSync] Auto-unsubscribed from:', removedSymbols);
    }
  }, [allRequiredSymbols]);

  useEffect(() => {
    if (!walletId) return;

    const socket = socketService.connect();
    socketRef.current = socket;

    const subscribeAll = () => {
      if (currentWalletIdRef.current) {
        socket.emit('subscribe:positions', currentWalletIdRef.current);
        socket.emit('subscribe:wallet', currentWalletIdRef.current);
      }
      for (const symbol of allRequiredSymbols) {
        subscribedSymbolsRef.current.add(symbol);
      }
      const symbolsToSubscribe = [...subscribedSymbolsRef.current];
      if (symbolsToSubscribe.length > 0) {
        console.log('[RealtimeSync] Batch subscribing to prices:', symbolsToSubscribe);
        socket.emit('subscribe:prices:batch', symbolsToSubscribe);
      }
    };

    const handleConnect = () => {
      console.log('[RealtimeSync] WebSocket connected');
      isConnectedRef.current = true;
      subscribeAll();
    };

    const handleDisconnect = (reason: string) => {
      console.log('[RealtimeSync] WebSocket disconnected:', reason);
      isConnectedRef.current = false;
    };

    const handleConnectError = (err: Error) => {
      console.error('[RealtimeSync] Connection error:', err.message);
      isConnectedRef.current = false;
    };

    const handlePositionUpdate = (position: PositionUpdate) => {
      console.log('[RealtimeSync] Position update received:', position.id, position.status);
      invalidatePositions();
      invalidateWallet();
    };

    const handlePositionClosed = (_data: { positionId: string; symbol: string; side: string; exitReason: string; pnl: number; pnlPercent: number }) => {
      invalidatePositions();
      invalidateWallet();
    };

    const handleOrderUpdate = (order: OrderUpdate) => {
      invalidateOrders();
      const flashId = order.id ?? order.orderId?.toString();
      if (flashId) useOrderFlashStore.getState().flashOrder(flashId);
    };

    const handleOrderCreated = (order: OrderUpdate) => {
      invalidateOrders();
      invalidateWallet();
      const flashId = order.id ?? order.orderId?.toString();
      if (flashId) useOrderFlashStore.getState().flashOrder(flashId);
    };

    const handleOrderCancelled = (_data: { orderId: string }) => {
      invalidateOrders();
      invalidateWallet();
    };

    const handleWalletUpdate = () => {
      invalidateWallet();
    };

    const handlePriceUpdate = (data: PriceUpdate) => {
      usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
      const callbacks = priceCallbacksRef.current.get(data.symbol);
      if (callbacks) {
        callbacks.forEach((callback) => callback(data.price));
      }
    };

    const handleRiskAlert = (alert: RiskAlert) => {
      const dedupKey = `${alert.type}:${alert.symbol ?? ''}:${alert.message}`;
      const lastShown = recentAlertsRef.current.get(dedupKey) ?? 0;
      const COOLDOWN_MS = 5 * 60 * 1000;
      if (Date.now() - lastShown < COOLDOWN_MS) return;
      recentAlertsRef.current.set(dedupKey, Date.now());

      const toastType = alert.level === 'critical' || alert.level === 'danger' ? 'error' : alert.level === 'warning' ? 'warning' : 'info';
      toaster.create({
        type: toastType,
        title: alert.symbol ? `${alert.type.replace(/_/g, ' ')} — ${alert.symbol}` : alert.type.replace(/_/g, ' '),
        description: alert.message,
        duration: alert.level === 'critical' ? undefined : 10000,
      });
    };

    const handleTradeNotification = async (notification: TradeNotification) => {
      console.log('[RealtimeSync] Trade notification received:', notification.type, notification.title);

      if (notification.type !== 'TRAILING_STOP_UPDATED') {
        const toastType = notification.type === 'POSITION_CLOSED'
          ? (parseFloat(notification.data.pnl || '0') >= 0 ? 'success' : 'error')
          : 'success';

        toaster.create({
          title: notification.title,
          description: notification.body,
          type: toastType,
          duration: notification.urgency === 'critical' ? undefined : 8000,
          meta: { symbol: notification.data.symbol },
        });
      }

      try {
        const adapter = await createPlatformAdapter();
        console.log('[RealtimeSync] Platform adapter created:', adapter.platform);
        const isSupported = await adapter.notification.isSupported();
        console.log('[RealtimeSync] Notification isSupported:', isSupported);
        if (isSupported) {
          const result = await adapter.notification.show({
            title: notification.title,
            body: notification.body,
            urgency: notification.urgency,
          });
          console.log('[RealtimeSync] Notification show result:', result);
        } else {
          console.warn('[RealtimeSync] Native notifications not supported on this system');
        }
      } catch (err) {
        console.error('[RealtimeSync] Native notification error:', err);
      }

      invalidatePositions();
      invalidateWallet();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('position:update', handlePositionUpdate);
    socket.on('position:closed', handlePositionClosed);
    socket.on('order:update', handleOrderUpdate);
    socket.on('order:created', handleOrderCreated);
    socket.on('order:cancelled', handleOrderCancelled);
    socket.on('wallet:update', handleWalletUpdate);
    socket.on('price:update', handlePriceUpdate);
    socket.on('trade:notification', handleTradeNotification);
    socket.on('risk:alert', handleRiskAlert);

    if (socket.connected) {
      console.log('[RealtimeSync] Socket already connected, subscribing immediately');
      isConnectedRef.current = true;
      subscribeAll();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('position:update', handlePositionUpdate);
      socket.off('position:closed', handlePositionClosed);
      socket.off('order:update', handleOrderUpdate);
      socket.off('order:created', handleOrderCreated);
      socket.off('order:cancelled', handleOrderCancelled);
      socket.off('wallet:update', handleWalletUpdate);
      socket.off('price:update', handlePriceUpdate);
      socket.off('trade:notification', handleTradeNotification);
      socket.off('risk:alert', handleRiskAlert);

      socket.emit('unsubscribe:positions', walletId);
      socket.emit('unsubscribe:wallet', walletId);
    };
  }, [walletId, allRequiredSymbols, invalidatePositions, invalidateOrders, invalidateWallet]);

  useEffect(() => {
    return () => {
      socketService.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, []);

  const subscribeToPrice = useCallback((symbol: string, onUpdate: (price: number) => void) => {
    let callbacks = priceCallbacksRef.current.get(symbol);
    const isFirstSubscription = !callbacks;

    if (!callbacks) {
      callbacks = new Set();
      priceCallbacksRef.current.set(symbol, callbacks);
    }
    callbacks.add(onUpdate);
    subscribedSymbolsRef.current.add(symbol);

    if (isFirstSubscription && socketRef.current?.connected) {
      socketRef.current.emit('subscribe:prices', symbol);
    }

    return () => {
      const cbs = priceCallbacksRef.current.get(symbol);
      if (cbs) {
        cbs.delete(onUpdate);
        if (cbs.size === 0) {
          priceCallbacksRef.current.delete(symbol);
          subscribedSymbolsRef.current.delete(symbol);
          if (socketRef.current?.connected) {
            socketRef.current.emit('unsubscribe:prices', symbol);
          }
        }
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
