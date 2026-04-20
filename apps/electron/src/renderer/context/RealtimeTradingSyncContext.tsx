import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { createPlatformAdapter } from '../adapters/factory';
import { socketService } from '../services/socketService';
import { QUERY_CONFIGS } from '../services/queryConfig';
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
}

const RealtimeTradingSyncContext = createContext<RealtimeTradingSyncContextValue | null>(null);

interface RealtimeTradingSyncProviderProps {
  walletId: string | undefined;
  children: ReactNode;
}

export const RealtimeTradingSyncProvider = ({ walletId, children }: RealtimeTradingSyncProviderProps) => {
  const socketRef = useRef<Socket | null>(null);
  const recentAlertsRef = useRef<Map<string, number>>(new Map());
  const utils = trpc.useUtils();
  const priceCallbacksRef = useRef<Map<string, Set<(price: number) => void>>>(new Map());
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const currentWalletIdRef = useRef<string | undefined>(undefined);
  const pendingPriceUpdates = useRef(new Map<string, number>());
  const priceFlushScheduled = useRef(false);

  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.tradeExecutions.staleTime }
  );

  const { data: orders } = trpc.trading.getOrders.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.orders.staleTime }
  );

  const stableSymbolsRef = useRef<Set<string>>(new Set());
  const allRequiredSymbolsRef = useRef<Set<string>>(new Set());

  const allRequiredSymbols = useMemo(() => {
    const symbols = new Set<string>();

    for (const exec of (tradeExecutions ?? []))
      {if (exec.status === 'open' || exec.status === 'pending') symbols.add(exec.symbol);}

    for (const order of (orders ?? []))
      {if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') symbols.add(order.symbol);}

    const newKey = [...symbols].sort().join(',');
    const oldKey = [...stableSymbolsRef.current].sort().join(',');
    if (newKey === oldKey) return stableSymbolsRef.current;
    stableSymbolsRef.current = symbols;
    allRequiredSymbolsRef.current = symbols;
    return symbols;
  }, [tradeExecutions, orders]);

  const pendingInvalidations = useRef(new Set<string>());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushInvalidations = useCallback(() => {
    if (!currentWalletIdRef.current) return;
    const keys = pendingInvalidations.current;
    pendingInvalidations.current = new Set();
    flushTimeoutRef.current = null;

    if (keys.has('positions')) {
      void utils.trading.getTradeExecutions.invalidate();
      void utils.trading.getPositions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    }
    if (keys.has('orders')) void utils.trading.getOrders.invalidate();
    if (keys.has('wallet')) {
      void utils.wallet.list.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    }
    if (keys.has('setupStats')) void utils.analytics.getSetupStats.invalidate();
    if (keys.has('equityCurve')) void utils.analytics.getEquityCurve.invalidate();
  }, [utils]);

  const scheduleInvalidation = useCallback((...keys: string[]) => {
    for (const key of keys) pendingInvalidations.current.add(key);
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(flushInvalidations, 16);
  }, [flushInvalidations]);

  const scheduleRef = useRef(scheduleInvalidation);
  useEffect(() => { scheduleRef.current = scheduleInvalidation; });

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
      if (import.meta.env.DEV) console.log('[RealtimeSync] Auto-subscribed to:', newSymbols);
    }
    if (removedSymbols.length > 0) {
      if (import.meta.env.DEV) console.log('[RealtimeSync] Auto-unsubscribed from:', removedSymbols);
    }
  }, [allRequiredSymbols]);

  useEffect(() => {
    if (!walletId) return;

    const socket = socketService.connect();
    socketRef.current = socket;

    const subscribeAll = () => {
      if (currentWalletIdRef.current) {
        socket.emit('subscribe:orders', currentWalletIdRef.current);
        socket.emit('subscribe:positions', currentWalletIdRef.current);
        socket.emit('subscribe:wallet', currentWalletIdRef.current);
      }
      for (const symbol of allRequiredSymbolsRef.current) {
        subscribedSymbolsRef.current.add(symbol);
      }
      const symbolsToSubscribe = [...subscribedSymbolsRef.current];
      if (symbolsToSubscribe.length > 0) {
        if (import.meta.env.DEV) console.log('[RealtimeSync] Batch subscribing to prices:', symbolsToSubscribe);
        socket.emit('subscribe:prices:batch', symbolsToSubscribe);
      }
    };

    const handleConnect = () => {
      if (import.meta.env.DEV) console.log('[RealtimeSync] WebSocket connected');
      subscribeAll();
    };

    const handleDisconnect = (reason: string) => {
      if (import.meta.env.DEV) console.log('[RealtimeSync] WebSocket disconnected:', reason);
    };

    const handleConnectError = (err: Error) => {
      if (import.meta.env.DEV) console.error('[RealtimeSync] Connection error:', err.message);
    };

    const handlePositionUpdate = (position: PositionUpdate) => {
      if (import.meta.env.DEV) console.log('[RealtimeSync] Position update received:', position.id, position.status);
      scheduleRef.current('positions', 'wallet');
    };

    const handlePositionClosed = (_data: { positionId: string; symbol: string; side: string; exitReason: string; pnl: number; pnlPercent: number }) => {
      scheduleRef.current('positions', 'wallet', 'setupStats', 'equityCurve');
    };

    const handleOrderUpdate = (_order: OrderUpdate) => {
      scheduleRef.current('orders');
    };

    const handleOrderCreated = (_order: OrderUpdate) => {
      scheduleRef.current('orders', 'wallet');
    };

    const handleOrderCancelled = (_data: { orderId: string }) => {
      scheduleRef.current('orders', 'wallet');
    };

    const handleWalletUpdate = () => {
      scheduleRef.current('wallet');
    };

    const flushPriceUpdates = () => {
      priceFlushScheduled.current = false;
      const updates = pendingPriceUpdates.current;
      if (updates.size === 0) return;

      const batch = new Map(updates);
      updates.clear();

      usePriceStore.getState().updatePriceBatch(batch);

      for (const [sym, price] of batch) {
        const callbacks = priceCallbacksRef.current.get(sym);
        if (callbacks) callbacks.forEach((cb) => cb(price));
      }
    };

    const handlePriceUpdate = (data: PriceUpdate) => {
      pendingPriceUpdates.current.set(data.symbol, data.price);

      if (!priceFlushScheduled.current) {
        priceFlushScheduled.current = true;
        requestAnimationFrame(flushPriceUpdates);
      }
    };

    const handleRiskAlert = (alert: RiskAlert) => {
      if (alert.type !== 'LIQUIDATION_RISK' || alert.level !== 'critical') return;
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
      if (import.meta.env.DEV) console.log('[RealtimeSync] Trade notification received:', notification.type, notification.title);

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
        if (import.meta.env.DEV) console.log('[RealtimeSync] Platform adapter created:', adapter.platform);
        const isSupported = await adapter.notification.isSupported();
        if (import.meta.env.DEV) console.log('[RealtimeSync] Notification isSupported:', isSupported);
        if (isSupported) {
          const result = await adapter.notification.show({
            title: notification.title,
            body: notification.body,
            urgency: notification.urgency,
          });
          if (import.meta.env.DEV) console.log('[RealtimeSync] Notification show result:', result);
        } else {
          if (import.meta.env.DEV) console.warn('[RealtimeSync] Native notifications not supported on this system');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[RealtimeSync] Native notification error:', err);
      }

      scheduleRef.current('positions', 'wallet');
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
      if (import.meta.env.DEV) console.log('[RealtimeSync] Socket already connected, subscribing immediately');
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

      socket.emit('unsubscribe:orders', walletId);
      socket.emit('unsubscribe:positions', walletId);
      socket.emit('unsubscribe:wallet', walletId);
    };
  }, [walletId]);

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      socketService.disconnect();
      socketRef.current = null;
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
    for (const key of ['positions', 'orders', 'wallet', 'setupStats', 'equityCurve']) {
      pendingInvalidations.current.add(key);
    }
    flushInvalidations();
  }, [flushInvalidations]);

  const value: RealtimeTradingSyncContextValue = {
    subscribeToPrice,
    forceRefresh,
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
    };
  }
  return context;
};
